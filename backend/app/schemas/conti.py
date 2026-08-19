from datetime import date

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
    storage_path: str


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
