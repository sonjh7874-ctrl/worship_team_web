from fastapi import HTTPException

from app.repositories import song_repository
from app.schemas.song import SongCreate, SongItem, SongUpdate


def list_songs(q: str | None) -> list[SongItem]:
    return [SongItem(**row) for row in song_repository.find_all(q)]


def create_song(payload: SongCreate) -> SongItem:
    row = song_repository.create(payload.title, payload.artist, payload.default_key)
    return SongItem(**row)


def update_song(song_id: int, payload: SongUpdate) -> SongItem:
    # exclude_unset으로 요청에 포함된 필드만 갱신하는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    row = song_repository.update(song_id, fields) if fields else song_repository.find_by_id(song_id)
    if row is None:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다.")
    return SongItem(**row)
