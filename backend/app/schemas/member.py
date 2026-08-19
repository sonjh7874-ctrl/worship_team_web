from typing import Literal

from pydantic import BaseModel

Team = Literal["singer", "instrument"]


class Member(BaseModel):
    id: int
    name: str
    team: Team
    is_active: bool


class MemberCreate(BaseModel):
    name: str
    team: Team
    is_active: bool = True


class MemberUpdate(BaseModel):
    name: str | None = None
    team: Team | None = None
    is_active: bool | None = None
