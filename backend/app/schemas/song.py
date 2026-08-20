from pydantic import BaseModel


class SongItem(BaseModel):
    id: int
    title: str
    artist: str | None = None
    default_key: str | None = None
    # 이 곡이 배치된 콘티 수. 곡 관리 화면에서 삭제 가능 여부를 미리 알려주는 용도다.
    usage_count: int = 0
    # 등록된 가사 구간 수. 곡 관리 화면에서 "가사 등록됨/미등록" 배지를 보여주는 용도다(Phase 9).
    section_count: int = 0


class SongCreate(BaseModel):
    title: str
    artist: str | None = None
    default_key: str | None = None


class SongUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    default_key: str | None = None
