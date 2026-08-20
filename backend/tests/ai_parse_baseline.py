"""AI 콘티 인식 정확도 측정 스크립트 (Phase 6 후속).

실제 콘티 이미지와 사람이 만든 정답(expected.json)을 비교해 필드별 정확도를 출력한다.
프롬프트나 모델 설정을 바꿨을 때 "좋아진 것 같다"가 아니라 숫자로 확인하기 위한 도구다.

실행: backend 디렉터리에서
    .venv/Scripts/python.exe -m tests.ai_parse_baseline [--label 설명]

이미지와 정답은 tests/fixtures/ 아래 두며, 팀 내부 자료라 git에는 올리지 않는다(.gitignore).
"""

import argparse
import asyncio
import io
import json
import re
import sys
from pathlib import Path

from app.services import ai_parse_service

FIXTURES = Path(__file__).parent / "fixtures"
IMAGE_DIR = FIXTURES / "conti_images"

# 비교 대상 필드. song_form은 공백만 정리해서 비교하고, 나머지는 문자열 그대로 본다.
SONG_FIELDS = ["title", "artist", "song_key", "song_form", "note"]


class FakeUpload:
    """UploadFile 대신 파일을 직접 읽어 서비스 함수를 그대로 재사용하기 위한 최소 껍데기."""

    def __init__(self, path: Path):
        self.path = path
        self.content_type = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"

    async def read(self) -> bytes:
        return self.path.read_bytes()


def normalize(value):
    """비교용 정규화 — 연속 공백을 하나로 줄이고 앞뒤 공백을 없앤다. 빈 값은 모두 None 취급."""
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def compare_song(expected: dict, actual: dict | None) -> dict:
    """곡 1건을 필드별로 비교해 {필드: 맞았는지} 를 돌려준다."""
    result = {}
    for field in SONG_FIELDS:
        want = normalize(expected.get(field))
        got = normalize(actual.get(field)) if actual else None
        result[field] = want == got
    return result


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="baseline", help="이번 측정에 붙일 이름(설정 비교용)")
    parser.add_argument(
        "--known-songs",
        choices=["none", "incremental"],
        default="none",
        help="프롬프트에 넣을 기존 곡 목록. incremental이면 날짜순으로 앞선 콘티의 곡만 누적해 사용한다",
    )
    args = parser.parse_args()

    expected_all = json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))
    # 실제 운영에서는 곡 마스터가 주차를 거치며 쌓이므로, 날짜순으로 앞선 콘티의 곡만 아는 상태를 재현한다.
    # 전체 정답 곡을 미리 다 넣으면 답을 알려주고 채점하는 셈이라 의미가 없다.
    expected_all = dict(sorted(expected_all.items(), key=lambda kv: kv[1]["service_date"]))
    known_songs: list[dict] = []
    seen_titles: set[str] = set()

    totals = {field: [0, 0] for field in SONG_FIELDS}  # [맞은 수, 전체]
    meta = {"service_date": [0, 0], "title": [0, 0], "song_count": [0, 0]}
    mismatches = []
    lenient_notes = []

    for file_name, expected in expected_all.items():
        image_path = IMAGE_DIR / file_name
        if not image_path.exists():
            print(f"[건너뜀] {file_name} 없음")
            continue

        songs_hint = list(known_songs) if args.known_songs == "incremental" else []
        result = await ai_parse_service.parse_conti_image(FakeUpload(image_path), known_songs=songs_hint)

        # 이번 콘티의 정답 곡을 "이후 주차가 아는 곡"으로 누적한다(사람이 검수해 확정한 결과에 해당).
        for song in expected["songs"]:
            if song.get("lenient") or song["title"] in seen_titles:
                continue
            seen_titles.add(song["title"])
            known_songs.append({"id": len(known_songs) + 1, "title": song["title"], "artist": song["artist"]})

        for key, want, got in [
            ("service_date", expected["service_date"],
             result.service_date_guess.isoformat() if result.service_date_guess else None),
            ("title", expected["title"], result.title_guess),
        ]:
            meta[key][1] += 1
            if normalize(want) == normalize(got):
                meta[key][0] += 1
            else:
                mismatches.append(f"{file_name} / {key}: 정답={want!r} 인식={got!r}")

        meta["song_count"][1] += 1
        if len(result.songs) == len(expected["songs"]):
            meta["song_count"][0] += 1
        else:
            mismatches.append(
                f"{file_name} / 곡 개수: 정답={len(expected['songs'])} 인식={len(result.songs)}"
            )

        actual_songs = [s.model_dump() for s in result.songs]
        for i, want_song in enumerate(expected["songs"]):
            got_song = actual_songs[i] if i < len(actual_songs) else None
            # lenient=true는 곡이 아닌 안내문("제직회 관계로 없음")처럼 정답을 하나로 못 박기 어려운 행이다.
            # 점수에서 빼고 실제로 뭐라고 읽었는지만 따로 보여준다.
            if want_song.get("lenient"):
                lenient_notes.append(f"{file_name} #{i + 1}: {got_song}")
                continue
            for field, ok in compare_song(want_song, got_song).items():
                totals[field][1] += 1
                if ok:
                    totals[field][0] += 1
                else:
                    got_value = got_song.get(field) if got_song else None
                    mismatches.append(
                        f"{file_name} #{i + 1} {field}: 정답={want_song.get(field)!r} 인식={got_value!r}"
                    )

    print(f"=== {args.label} / 모델={ai_parse_service.OPENAI_VISION_MODEL} / 곡목록={args.known_songs} ===")
    for key, (ok, total) in meta.items():
        print(f"  {key:14} {ok}/{total}")
    print("  --- 곡 필드 ---")
    grand_ok = grand_total = 0
    for field, (ok, total) in totals.items():
        grand_ok += ok
        grand_total += total
        rate = f"{ok / total * 100:.0f}%" if total else "-"
        print(f"  {field:14} {ok}/{total}  ({rate})")
    print(f"  {'합계':14} {grand_ok}/{grand_total}  ({grand_ok / grand_total * 100:.1f}%)")

    if mismatches:
        print("\n--- 틀린 항목 ---")
        for m in mismatches:
            print("  ", m)
    if lenient_notes:
        print("\n--- 정답 없는 특수 행(점수 제외) ---")
        for n in lenient_notes:
            print("  ", n)


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    asyncio.run(main())
