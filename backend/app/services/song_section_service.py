from fastapi import HTTPException

from app.repositories import song_repository, song_section_repository
from app.schemas.song_section import SongSectionItem, SongSectionsUpdate


def list_sections(song_id: int) -> list[SongSectionItem]:
    if song_repository.find_by_id(song_id) is None:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")
    return [SongSectionItem(**row) for row in song_section_repository.find_by_song_id(song_id)]


def replace_sections(song_id: int, payload: SongSectionsUpdate) -> list[SongSectionItem]:
    if song_repository.find_by_id(song_id) is None:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")

    codes = [item.section_code for item in payload.sections]
    if len(codes) != len(set(codes)):
        raise HTTPException(status_code=400, detail="구간 코드가 중복됐습니다.")

    rows = [
        {
            "song_id": song_id,
            "section_code": item.section_code,
            "lyrics": item.lyrics,
            "display_order": item.display_order,
        }
        for item in payload.sections
    ]
    song_section_repository.replace_sections(song_id, rows)
    return [SongSectionItem(**row) for row in song_section_repository.find_by_song_id(song_id)]
