from datetime import date

from pydantic import BaseModel


class LyricsBlock(BaseModel):
    # kind: "lyrics"(가사) | "marker"(마디/간주, 가사 없음) | "unresolved"(해석 실패, 사람 확인 필요)
    kind: str
    section_code: str | None = None
    text: str
    note: str | None = None


class ContiLyricsSong(BaseModel):
    order_no: int
    title: str
    artist: str | None = None
    song_key: str | None = None
    song_form: str | None = None
    blocks: list[LyricsBlock]
    unresolved_count: int = 0


class ContiLyricsResponse(BaseModel):
    conti_id: int
    service_date: date
    title: str
    songs: list[ContiLyricsSong]
    unresolved_total: int = 0
