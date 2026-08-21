from pydantic import BaseModel, Field


class SongSectionItem(BaseModel):
    section_code: str
    lyrics: str
    display_order: int = 0
    # 같은 가사를 가리키는 다른 표기. 곡마다 송폼 표기가 바뀌어도(A1 <-> A 등) 같은 가사에
    # 매칭되도록 등록해두는 값 — 가사를 복제 저장하지 않고 표기만 여러 개 연결한다.
    aliases: list[str] = Field(default_factory=list)


class SongSectionsUpdate(BaseModel):
    sections: list[SongSectionItem]


class SongSectionsResponse(BaseModel):
    sections: list[SongSectionItem]
    # 이 곡이 가장 최근 콘티에서 쓰인 송폼 원문. 어떤 코드로 등록해야 할지 감을 잡는 힌트용(편집 대상 아님).
    last_song_form: str | None = None
