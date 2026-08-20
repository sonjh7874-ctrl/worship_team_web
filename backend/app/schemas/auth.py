from typing import Literal

from pydantic import BaseModel

Role = Literal["admin", "leader", "member"]


class SignupRequest(BaseModel):
    # 이메일 형식 자체는 Supabase Auth가 최종 검증하므로 여기서는 str로 두고
    # email-validator 같은 신규 의존성을 추가하지 않는다.
    email: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserProfile(BaseModel):
    id: str
    email: str | None = None
    display_name: str
    role: Role
    member_id: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int
    user: UserProfile


class RoleUpdate(BaseModel):
    role: Role
