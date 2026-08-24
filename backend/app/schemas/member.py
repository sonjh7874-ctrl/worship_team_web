from datetime import date

from typing import Literal

from pydantic import BaseModel

Team = Literal["singer", "instrument"]
# 싱어팀 마이크 1~8번 배치가 성별 고정이라(Phase 12 후속) 필수 필드다.
Gender = Literal["male", "female"]


class Member(BaseModel):
    id: int
    name: str
    team: Team
    is_active: bool
    gender: Gender
    # 선택 입력 — 있으면 캘린더에 생일이 매년 자동 표시된다(Phase 12 후속).
    birth_date: date | None = None


class MemberCreate(BaseModel):
    name: str
    team: Team
    is_active: bool = True
    gender: Gender
    birth_date: date | None = None


class MemberUpdate(BaseModel):
    name: str | None = None
    team: Team | None = None
    is_active: bool | None = None
    gender: Gender | None = None
    birth_date: date | None = None
