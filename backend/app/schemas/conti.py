from datetime import date
from typing import Literal

from pydantic import BaseModel


class SongBrief(BaseModel):
    id: int
    title: str
    artist: str | None = None


class ContiSongItem(BaseModel):
    order_no: int
    song: SongBrief
    song_key: str | None = None
    song_form: str | None = None
    note: str | None = None


class SheetFileItem(BaseModel):
    id: int
    file_type: str
    file_name: str | None = None
    url: str | None = None


class ContiListItem(BaseModel):
    id: int
    service_date: date
    title: str
    status: str


class ContiDetail(ContiListItem):
    songs: list[ContiSongItem] = []
    sheet_files: list[SheetFileItem] = []


class ContiCreate(BaseModel):
    service_date: date
    title: str = "주일예배"


class NewSongInput(BaseModel):
    title: str
    artist: str | None = None
    default_key: str | None = None


class ContiSongInput(BaseModel):
    song_id: int | None = None
    new_song: NewSongInput | None = None
    song_key: str | None = None
    song_form: str | None = None
    note: str | None = None


class ContiSongsPutRequest(BaseModel):
    songs: list[ContiSongInput]


class ContiUpdate(BaseModel):
    service_date: date | None = None
    title: str | None = None
    status: Literal["draft", "published"] | None = None
