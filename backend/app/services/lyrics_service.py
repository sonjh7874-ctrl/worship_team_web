"""콘티 자막용 가사를 송폼 순서대로 조합하는 서비스 (Phase 9).

song_form_parser가 분류한 토큰을 song_sections 데이터와 매칭해 최종 블록 배열을 만든다.
조합 결과는 DB에 저장하지 않고 매 요청마다 계산한다 — 저장해두면 가사를 고친 뒤 자막 결과가
옛날 값으로 남는 "원본-사본 불일치" 문제가 재발하기 때문이다(README/ERD 3-1 원칙과 동일).
"""

from fastapi import HTTPException

from app.repositories import conti_repository, song_section_repository
from app.schemas.lyrics import ContiLyricsResponse, ContiLyricsSong, LyricsBlock
from app.services import song_form_parser
from app.services.song_form_parser import Token


def _build_section_lookup(rows: list[dict]) -> dict[str, dict]:
    """구간 코드+별칭을 한 이름공간으로 모은다. 실제 코드가 별칭보다 우선한다
    (두 구간이 같은 별칭을 등록해도 실제 코드로 등록된 쪽이 항상 이긴다).
    """
    lookup: dict[str, dict] = {}
    for row in rows:
        lookup[row["section_code"]] = {
            "lyrics": row["lyrics"],
            "canonical": row["section_code"],
            "via_alias": False,
        }
    for row in rows:
        for alias in song_section_repository.split_aliases(row.get("aliases")):
            if alias not in lookup:
                lookup[alias] = {"lyrics": row["lyrics"], "canonical": row["section_code"], "via_alias": True}
    return lookup


def _resolve_section(sections_by_code: dict[str, dict], token: Token) -> LyricsBlock | None:
    # 정확 일치(코드 또는 별칭) 우선, 없으면 변주 접미사(*, ')를 뗀 기본 구간으로 재조회한다.
    entry = sections_by_code.get(token.section_code) if token.section_code else None
    if entry:
        note = f"별칭 표기 → {entry['canonical']}" if entry["via_alias"] else None
        return LyricsBlock(kind="lyrics", section_code=entry["canonical"], text=entry["lyrics"], note=note)

    if token.fallback_code:
        entry = sections_by_code.get(token.fallback_code)
        if entry:
            return LyricsBlock(
                kind="lyrics",
                section_code=entry["canonical"],
                text=entry["lyrics"],
                note=f"변주 표기({token.raw} → {entry['canonical']})",
            )
    return None


def _duplicate(block: LyricsBlock, extra_count: int, repeat_total: int) -> list[LyricsBlock]:
    # extra_count = repeat_total - 1 (원본 1개 + 추가분). 각 사본에 "반복 N/전체" 주석을 남긴다.
    copies = []
    for i in range(extra_count):
        note = f"반복 {i + 2}/{repeat_total}"
        if block.note:
            note = f"{block.note} · {note}"
        copies.append(LyricsBlock(kind=block.kind, section_code=block.section_code, text=block.text, note=note))
    return copies


def _build_song_blocks(song_form: str | None, sections_by_code: dict[str, dict]) -> tuple[list[LyricsBlock], int]:
    tokens = song_form_parser.parse_song_form(song_form)
    blocks: list[LyricsBlock] = []
    unresolved_count = 0

    for token in tokens:
        if token.kind == "marker":
            blocks.append(LyricsBlock(kind="marker", text=token.raw))
            continue

        if token.kind == "repeat":
            # 직전 블록이 없으면(송폼이 x2로 시작하는 등) 반복 지시를 적용할 대상이 없어 미해결 처리한다.
            if not blocks:
                blocks.append(LyricsBlock(kind="unresolved", text=token.raw))
                unresolved_count += 1
                continue
            blocks.extend(_duplicate(blocks[-1], max(token.repeat_count - 1, 0), token.repeat_count))
            continue

        if token.kind in ("section", "quoted"):
            resolved = _resolve_section(sections_by_code, token)
            if resolved is None and token.kind == "quoted" and token.quote_text:
                # 등록된 구간 코드가 아니면 인용 원문을 그대로 블록으로 삼는다 — 다만 "~"로 줄인
                # 축약 표기라 가사 전문으로 확정하지 않는다는 것을 주석으로 남긴다.
                resolved = LyricsBlock(
                    kind="lyrics",
                    text=token.quote_text,
                    note="인용 표기(축약) — 등록된 구간 없음, 원문 가사 아님",
                )
            if resolved is None:
                blocks.append(LyricsBlock(kind="unresolved", text=token.raw))
                unresolved_count += 1
                continue
            blocks.append(resolved)
            if token.repeat_count and token.repeat_count > 1:
                blocks.extend(_duplicate(resolved, token.repeat_count - 1, token.repeat_count))
            continue

        # kind == "unresolved"
        blocks.append(LyricsBlock(kind="unresolved", text=token.raw))
        unresolved_count += 1

    return blocks, unresolved_count


def build_conti_lyrics(conti_id: int) -> ContiLyricsResponse:
    conti = conti_repository.find_by_id(conti_id)
    if conti is None:
        raise HTTPException(status_code=404, detail="콘티를 찾을 수 없습니다.")

    conti_songs = conti.get("conti_songs", [])
    song_ids = [cs["songs"]["id"] for cs in conti_songs if cs.get("songs")]
    sections_by_song = song_section_repository.find_by_song_ids(song_ids)

    songs: list[ContiLyricsSong] = []
    unresolved_total = 0
    for cs in sorted(conti_songs, key=lambda row: row["order_no"]):
        song = cs.get("songs") or {}
        sections_by_code = _build_section_lookup(sections_by_song.get(song.get("id"), []))
        blocks, unresolved_count = _build_song_blocks(cs.get("song_form"), sections_by_code)
        unresolved_total += unresolved_count
        songs.append(
            ContiLyricsSong(
                order_no=cs["order_no"],
                song_id=song.get("id"),
                title=song.get("title", ""),
                artist=song.get("artist"),
                song_key=cs.get("song_key"),
                song_form=cs.get("song_form"),
                blocks=blocks,
                unresolved_count=unresolved_count,
            )
        )

    return ContiLyricsResponse(
        conti_id=conti["id"],
        service_date=conti["service_date"],
        title=conti["title"],
        songs=songs,
        unresolved_total=unresolved_total,
    )
