"""AI 콘티 이미지 인식 (Phase 6).

콘티 이미지를 OpenAI vision 모델에 1회 호출해 곡 순서·제목·아티스트·키·송폼을 JSON으로 추출한다.
여기서는 DB에 아무것도 저장하지 않는다 — 결과는 검수 화면에 그대로 전달되고, 사람이 확인·수정한 뒤
`PUT /contis/{id}/songs`로 확정 저장한다 (API명세 1-4).

외부 API 호출이지만 Supabase 접근이 아니므로 repository가 아닌 service 계층에 둔다.
"""

import base64
import difflib
import json
import re
import unicodedata
from datetime import date

import openai
from fastapi import HTTPException, UploadFile

from app.config import OPENAI_API_KEY, OPENAI_TIMEOUT_SECONDS, OPENAI_VISION_MODEL
from app.repositories import song_repository
from app.schemas.conti import AiParsedSong, AiParseResult, SongCandidate

# 목사님이 올리는 콘티는 인쇄 텍스트를 캡처한 이미지라 아래 3종이면 충분하다.
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024

# 고정 프롬프트. 송폼 약어(A1/(맞4)/bis/Tag/x2 등)는 팀 고유 표기라 모델이 "이해·재구성"하면 오히려 틀린다.
# 그래서 원문 그대로 옮기라고 반복해서 못 박는다 (README 기능 1의 정확도 기대치와 동일).
PROMPT = """당신은 교회 찬양팀의 주간 콘티(송폼) 이미지를 읽어 JSON으로 옮기는 도구입니다.

이미지의 일반적인 구조:
- 첫 줄에 헤더가 있습니다. 예: `260809 4부예배 콘티` (YYMMDD 날짜 + 예배 이름)
- 그 아래로 곡이 번호순으로 나열됩니다. 예: `1. 삶의 예배_아이자야(G-A)`
  - `곡제목_아티스트(키)` 형식이며, 아티스트나 키가 없는 경우도 있습니다.
  - 곡 제목 앞에 `<축복송>`, `<퇴장송>` 같은 꼬리표가 붙기도 합니다.
- 각 곡 바로 다음 줄(들)에 송폼이 적혀 있습니다. 예: `(4) A1 A2 B (맞4) A2 B (맞4) (up) B B`

다음 JSON 형식으로만 응답하세요:
{
  "service_date_raw": "헤더에 적힌 날짜 숫자 원문 그대로 (예: 260809). 없으면 null",
  "service_date": "YYYY-MM-DD 또는 null",
  "title": "날짜를 제외한 예배 이름 또는 null",
  "songs": [
    {
      "title": "곡 제목",
      "artist": "아티스트 또는 null",
      "key": "키 또는 null",
      "song_form": "송폼 원문 또는 null",
      "note": "<축복송> 같은 꼬리표 또는 null"
    }
  ]
}

규칙:
1. `song_form`은 절대 해석하거나 정규화하지 마세요. 보이는 문자열을 그대로 옮깁니다.
   `A1`, `(맞4)`, `(up)`, `bis(가사~)*2`, `Tag`, `x2`, `*`, `**` 같은 표기를 임의로 바꾸거나 풀어쓰지 마세요.
   송폼이 여러 줄이면 공백 하나로 이어 붙인 한 줄로 만듭니다.
2. 곡 순서는 이미지에 적힌 번호 순서를 그대로 유지합니다.
3. `<축복송>`, `<퇴장송>` 같은 꼬리표는 `note`로 분리하고 `title`에는 넣지 않습니다.
   꺾쇠 괄호는 빼고 내용만 담습니다.
4. 날짜 6자리는 **앞에서부터 YY MM DD 순서**입니다. `260816`은 2026년 08월 16일이며,
   2016년이나 26일로 바꿔 읽지 마세요. `service_date_raw`에는 숫자 6자리를 그대로 옮깁니다.
5. 읽을 수 없거나 없는 값은 추측하지 말고 null로 둡니다.
6. 곡이 하나도 보이지 않으면 `songs`를 빈 배열로 두세요.
7. **이미지에 없는 글자·기호를 만들어 넣지 마세요.** 익숙한 단어로 고쳐 읽지 말고 보이는 그대로 옮깁니다.
"""

# 기존 곡 목록을 프롬프트에 함께 넣어 오인식을 줄인다. 이 팀은 같은 곡을 반복해서 쓰기 때문에
# "아는 곡이면 그 표기를 그대로 쓰라"고 알려주는 것만으로 위러브->워리브 같은 오독이 크게 준다.
# 다만 **송폼은 절대 넣지 않는다** — 송폼은 매주 바뀔 수 있고, 힌트로 주면 모델이 지난주 송폼을
# 그대로 베낄 위험이 있다. 그건 이 프로젝트가 없애려는 문제(옛 송폼을 최신인 줄 알고 보는 것) 그 자체다.
KNOWN_SONGS_HINT = """
참고: 이 팀이 지금까지 사용한 곡 목록입니다. 이미지의 곡이 아래 중 하나로 보이면 **아래 표기를 그대로** 사용하세요.
목록에 없는 곡이면 목록에 억지로 맞추지 말고 이미지에 보이는 대로 옮깁니다.

{songs}
"""


def _normalize_title(title: str) -> str:
    """곡 제목 매칭용 정규화 — 공백·특수문자 제거 후 소문자화.

    ERD 3-1대로 '정규화된 제목 완전 일치'만 후보로 삼는다. 유사도 매칭을 하지 않는 이유는
    잘못 매칭된 곡이 조용히 확정되는 것보다 신규 곡으로 제안하고 사람이 고르는 편이 안전하기 때문.
    """
    return re.sub(r"[^0-9a-z가-힣]", "", title.lower())


def _build_title_index(songs: list[dict]) -> dict[str, int]:
    """곡 마스터를 {정규화 제목: song_id}로 만든다.

    같은 정규화 제목이 여러 건이면(아티스트만 다른 동명 곡 등) 먼저 나온 것을 후보로 쓴다 —
    어차피 검수 화면에서 사람이 최종 확정하므로 여기서 더 정교하게 고르지 않는다.
    """
    index: dict[str, int] = {}
    for row in songs:
        key = _normalize_title(row["title"])
        if key and key not in index:
            index[key] = row["id"]
    return index


# 유사 곡 후보로 제안할 최소 유사도와 최대 개수.
# 0.6은 실측 기준으로 잡았다 — 실제 오인식(전심감주↔전신갑주 0.82, 워리브↔위러브 0.67)은 위에 있고,
# 무관한 곡(전심감주↔우리가 주를 더욱 사랑하고 0.28)은 아래에 있어 둘이 깨끗하게 갈린다.
CANDIDATE_THRESHOLD = 0.6
CANDIDATE_LIMIT = 3


def _to_jamo(title: str) -> str:
    """제목을 자모 단위로 분해한다.

    한글 음절 그대로 비교하면 '전심감주'와 '전신갑주'가 4글자 중 2글자 차이(0.5)로 멀어 보이지만,
    자모로 풀면 12자 중 2자 차이(0.82)라 실제 오인식을 훨씬 잘 잡는다. 오인식은 대개 음절 전체가
    아니라 그 안의 자음 하나가 틀리는 식이기 때문이다.
    """
    return unicodedata.normalize("NFD", _normalize_title(title))


def _find_candidates(title: str, songs: list[dict], exclude_id: int | None = None) -> list[dict]:
    """제목이 비슷한 기존 곡 후보를 유사도 높은 순으로 돌려준다.

    자동으로 골라주지 않는 이유는 ERD 3-1 그대로다 — 유사도 매칭이 조용히 틀리면 사람이 알아채기
    어렵다. 여기서는 후보만 제안하고 확정은 검수 화면에서 사람이 한다.
    """
    target = _to_jamo(title)
    if not target:
        return []

    scored = []
    for row in songs:
        if exclude_id is not None and row["id"] == exclude_id:
            continue
        score = difflib.SequenceMatcher(None, target, _to_jamo(row["title"])).ratio()
        if score >= CANDIDATE_THRESHOLD:
            scored.append({**row, "score": round(score, 3)})
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored[:CANDIDATE_LIMIT]


def _build_prompt(songs: list[dict]) -> str:
    """고정 프롬프트 + 기존 곡 목록 힌트."""
    if not songs:
        return PROMPT
    lines = []
    for row in songs:
        artist = row.get("artist")
        lines.append(f"- {row['title']}" + (f" _ {artist}" if artist else ""))
    return PROMPT + KNOWN_SONGS_HINT.format(songs="\n".join(lines))


def _parse_date(value) -> date | None:
    """모델이 돌려준 날짜 문자열을 date로 변환한다. 형식이 어긋나면 조용히 null 처리.

    날짜는 검수 화면에서 사람이 어차피 확인·수정하므로, 여기서 400을 던져 인식 결과 전체를
    버리는 것보다 비워서 넘기는 편이 낫다.
    """
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def _date_from_raw(value) -> date | None:
    """헤더의 6자리 원문(예: 260816)을 YY-MM-DD로 직접 계산한다.

    모델에게 변환까지 맡기면 `260816`을 `2016-08-26`처럼 자리를 바꿔 읽는 일이 실제로 있었다.
    숫자를 옮겨 적는 것까지만 모델에 맡기고 해석은 서버에서 하면 이 오류가 사라진다.
    """
    if not isinstance(value, str):
        return None
    digits = re.sub(r"[^0-9]", "", value)
    if len(digits) != 6:
        return None
    try:
        return date(2000 + int(digits[:2]), int(digits[2:4]), int(digits[4:6]))
    except ValueError:
        return None


def _clean(value) -> str | None:
    """모델 응답의 문자열 필드를 정리한다. 빈 문자열·"null" 문자열도 None으로 취급."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or text.lower() == "null":
        return None
    return text


def _call_openai(image_bytes: bytes, content_type: str, prompt: str) -> str:
    """OpenAI vision 모델을 1회 호출하고 원본 응답 문자열을 돌려준다."""
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY가 설정되지 않았습니다.",
        )

    # 이미지는 별도 업로드 없이 data URL(base64)로 프롬프트에 함께 실어 1회 호출로 끝낸다.
    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode()}"
    client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=OPENAI_TIMEOUT_SECONDS)

    try:
        response = client.chat.completions.create(
            model=OPENAI_VISION_MODEL,
            # 이미지를 그대로 옮겨 적는 작업이라 창의성이 필요 없다. 기본값(1.0)으로 두면 같은 이미지를
            # 다시 넣어도 결과가 흔들리고, 없는 글자를 지어내는 빈도도 올라간다.
            temperature=0,
            # JSON 외의 설명 문장이 섞이면 파싱이 깨지므로 JSON 모드를 강제한다.
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        # detail은 기본값(auto)을 쓴다. high로 올려 측정해봤으나 정확도가 오르지 않고
                        # (94.8% -> 94.1%, 측정 편차 범위) 토큰만 더 썼다. tests/ai_parse_baseline.py 참고.
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
        )
    except openai.APITimeoutError:
        raise HTTPException(
            status_code=504,
            detail="AI 인식이 시간 내에 끝나지 않았습니다. 다시 시도하거나 직접 입력해주세요.",
        )
    except openai.APIError as exc:
        # 인증 실패·레이트리밋·모델 오류 등을 한데 묶는다. 사용자는 어차피 "직접 입력"으로 우회하면 되고,
        # 원인 구분은 서버 로그(exc)에 남는 메시지로 확인한다.
        raise HTTPException(
            status_code=502,
            detail=f"AI 인식에 실패했습니다. 다시 시도하거나 직접 입력해주세요. ({type(exc).__name__})",
        )

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise HTTPException(
            status_code=502,
            detail="AI 인식 결과가 비어 있습니다. 다시 시도하거나 직접 입력해주세요.",
        )
    return content


def _attach_last_song_forms(songs: list[AiParsedSong]) -> None:
    """매칭된 곡·후보 곡의 '지난번 송폼'을 채운다(있는 것만)."""
    song_ids = set()
    for song in songs:
        if song.matched_song_id:
            song_ids.add(song.matched_song_id)
        song_ids.update(c.song_id for c in song.candidates)
    if not song_ids:
        return

    last_forms = song_repository.find_last_song_forms(sorted(song_ids))
    for song in songs:
        if song.matched_song_id:
            song.last_song_form = last_forms.get(song.matched_song_id)
        for candidate in song.candidates:
            candidate.last_song_form = last_forms.get(candidate.song_id)


async def parse_conti_image(image: UploadFile, known_songs: list[dict] | None = None) -> AiParseResult:
    """콘티 이미지 → 구조화된 곡 목록. DB 저장 없이 검수용 결과만 반환한다."""
    # 일부 클라이언트가 "image/png; charset=..." 처럼 파라미터를 붙여 보내므로 앞부분만 떼어 비교한다.
    # 이 값은 아래 data URL에도 그대로 들어가므로 정규화해두지 않으면 호출까지 깨진다.
    content_type = (image.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"이미지 형식은 {sorted(ALLOWED_IMAGE_TYPES)} 중 하나여야 합니다.",
        )

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="이미지 파일이 비어 있습니다.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"이미지 크기는 {MAX_IMAGE_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
        )

    # known_songs를 넘기지 않으면 곡 마스터 전체를 쓴다(테스트에서 시점별 목록을 주입하려고 열어둔 인자).
    songs_master = song_repository.find_all() if known_songs is None else known_songs
    raw_output = _call_openai(image_bytes, content_type, _build_prompt(songs_master))

    try:
        parsed = json.loads(raw_output)
    except json.JSONDecodeError:
        # 원본 앞부분을 메시지에 실어 어떤 형태로 깨졌는지 바로 확인할 수 있게 한다.
        raise HTTPException(
            status_code=502,
            detail=f"AI 응답을 JSON으로 읽지 못했습니다: {raw_output[:200]}",
        )
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="AI 응답 형식이 올바르지 않습니다.")

    title_index = _build_title_index(songs_master)
    songs: list[AiParsedSong] = []
    for item in parsed.get("songs") or []:
        if not isinstance(item, dict):
            continue
        title = _clean(item.get("title"))
        # 제목 없는 행은 곡으로 성립하지 않으므로 버린다(에러로 만들지 않고 조용히 건너뜀).
        if not title:
            continue
        matched_song_id = title_index.get(_normalize_title(title))
        # 완전 일치하는 곡을 이미 찾았으면 후보를 더 제안하지 않는다 — 화면만 복잡해진다.
        candidates = [] if matched_song_id else _find_candidates(title, songs_master)
        songs.append(
            AiParsedSong(
                title=title,
                artist=_clean(item.get("artist")),
                song_key=_clean(item.get("key")),
                song_form=_clean(item.get("song_form")),
                note=_clean(item.get("note")),
                matched_song_id=matched_song_id,
                match_status="matched" if matched_song_id else "new",
                candidates=[
                    SongCandidate(
                        song_id=c["id"], title=c["title"], artist=c.get("artist"), score=c["score"]
                    )
                    for c in candidates
                ],
            )
        )

    # 매칭된 곡과 후보 곡이 지난번에 쓴 송폼을 한 번의 쿼리로 붙인다.
    # 이번 인식 결과와 나란히 보여주면 (8) 누락이나 글자 오독을 사람이 바로 알아챌 수 있다.
    _attach_last_song_forms(songs)

    # 곡이 0건이어도 에러로 처리하지 않는다 — 사람 검수가 필수 단계라 빈 결과도 그대로 넘겨
    # "직접 입력"으로 이어갈 수 있게 하는 편이 낫다.
    # 원문 6자리 계산을 우선하고, 없으면 모델이 변환한 값으로 폴백한다.
    service_date = _date_from_raw(parsed.get("service_date_raw")) or _parse_date(parsed.get("service_date"))

    return AiParseResult(
        service_date_guess=service_date,
        title_guess=_clean(parsed.get("title")),
        songs=songs,
        raw_model_output=raw_output,
    )
