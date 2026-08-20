from pydantic import BaseModel


class SongSectionItem(BaseModel):
    section_code: str
    lyrics: str
    display_order: int = 0


class SongSectionsUpdate(BaseModel):
    sections: list[SongSectionItem]
