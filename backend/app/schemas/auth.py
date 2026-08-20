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
    # true면 관리자가 비밀번호를 초기화한 직후 상태 — 프론트가 로그인 즉시
    # 비밀번호 변경 화면으로 강제 이동시킨다.
    force_password_change: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int
    user: UserProfile


class RoleUpdate(BaseModel):
    role: Role


class PasswordResetResponse(BaseModel):
    # 서버가 생성한 임시 비밀번호. 응답에만 담기고 어디에도 저장하지 않으므로
    # 관리자가 이 시점에 화면에서 확인해 본인에게 직접 안내해야 한다.
    temp_password: str


class ChangePasswordRequest(BaseModel):
    new_password: str


class UpdateProfileRequest(BaseModel):
    display_name: str

