from pydantic import BaseModel


class SongItem(BaseModel):
    id: int
    title: str
    artist: str | None = None
    default_key: str | None = None


class SongCreate(BaseModel):
    title: str
    artist: str | None = None
    default_key: str | None = None


class SongUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    default_key: str | None = None
