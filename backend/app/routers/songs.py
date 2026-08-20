from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.song import SongCreate, SongItem, SongUpdate
from app.services import song_service

router = APIRouter(prefix="/api/v1/songs", tags=["songs"])


@router.get("", response_model=list[SongItem])
def list_songs(q: str | None = None):
    return song_service.list_songs(q)


@router.post(
    "",
    response_model=SongItem,
    status_code=201,
    dependencies=[Depends(require_role("leader"))],
)
def create_song(payload: SongCreate):
    return song_service.create_song(payload)


@router.delete(
    "/{song_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_song(song_id: int):
    """곡 마스터 삭제. 어떤 콘티에도 배치돼 있지 않은 곡만 지울 수 있다."""
    song_service.delete_song(song_id)


@router.patch(
    "/{song_id}",
    response_model=SongItem,
    dependencies=[Depends(require_role("leader"))],
)
def update_song(song_id: int, payload: SongUpdate):
    return song_service.update_song(song_id, payload)
