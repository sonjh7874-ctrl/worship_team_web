from fastapi import HTTPException

from app.repositories import song_repository, song_section_repository
from app.schemas.song_section import SongSectionItem, SongSectionsResponse, SongSectionsUpdate


def _to_item(row: dict) -> SongSectionItem:
    return SongSectionItem(
        section_code=row["section_code"],
        lyrics=row["lyrics"],
        display_order=row["display_order"],
        aliases=song_section_repository.split_aliases(row.get("aliases")),
    )


def _build_response(song_id: int) -> SongSectionsResponse:
    sections = [_to_item(row) for row in song_section_repository.find_by_song_id(song_id)]
    last_song_form = song_repository.find_last_song_forms([song_id]).get(song_id)
    return SongSectionsResponse(sections=sections, last_song_form=last_song_form)


def list_sections(song_id: int) -> SongSectionsResponse:
    if song_repository.find_by_id(song_id) is None:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")
    return _build_response(song_id)


def replace_sections(song_id: int, payload: SongSectionsUpdate) -> SongSectionsResponse:
    if song_repository.find_by_id(song_id) is None:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")

    # 구간 코드와 별칭을 합쳐서 하나의 이름공간으로 본다 — 별칭이 다른 구간의 코드나
    # 또 다른 별칭과 겹치면 어느 가사로 연결될지 애매해지기 때문에 저장 전에 막는다.
    all_names = []
    for item in payload.sections:
        all_names.append(item.section_code)
        all_names.extend(item.aliases)
    if len(all_names) != len(set(all_names)):
        raise HTTPException(status_code=400, detail="구간 코드/별칭이 중복됐습니다.")

    rows = [
        {
            "song_id": song_id,
            "section_code": item.section_code,
            "lyrics": item.lyrics,
            "display_order": item.display_order,
            "aliases": song_section_repository.join_aliases(item.aliases),
        }
        for item in payload.sections
    ]
    song_section_repository.replace_sections(song_id, rows)
    return _build_response(song_id)
