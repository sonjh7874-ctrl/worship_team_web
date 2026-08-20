from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.song import SongCreate, SongItem, SongUpdate
from app.schemas.song_section import SongSectionItem, SongSectionsUpdate
from app.services import song_section_service, song_service

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


@router.get(
    "/{song_id}/sections",
    response_model=list[SongSectionItem],
    dependencies=[Depends(require_role("member"))],
)
def list_song_sections(song_id: int):
    """곡의 구간별 가사. 저작권 있는 콘텐츠라 로그인(member 이상)해야 볼 수 있다."""
    return song_section_service.list_sections(song_id)


@router.put(
    "/{song_id}/sections",
    response_model=list[SongSectionItem],
    dependencies=[Depends(require_role("leader"))],
)
def put_song_sections(song_id: int, payload: SongSectionsUpdate):
    """구간 배열 전체 교체. conti_songs/schedule_assignments와 동일한 전체 교체 패턴."""
    return song_section_service.replace_sections(song_id, payload)
