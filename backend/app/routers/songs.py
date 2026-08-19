from fastapi import APIRouter, Depends

from app.dependencies import verify_edit_password
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
    dependencies=[Depends(verify_edit_password)],
)
def create_song(payload: SongCreate):
    return song_service.create_song(payload)


@router.patch(
    "/{song_id}",
    response_model=SongItem,
    dependencies=[Depends(verify_edit_password)],
)
def update_song(song_id: int, payload: SongUpdate):
    return song_service.update_song(song_id, payload)
