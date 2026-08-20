from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RoleUpdate,
    SignupRequest,
    TokenResponse,
    UserProfile,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest):
    return auth_service.signup(payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    return auth_service.login(payload)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest):
    return auth_service.refresh(payload.refresh_token)


@router.get("/me", response_model=UserProfile)
def get_me(current_user: UserProfile = Depends(require_role("member"))):
    return current_user


@router.get("/users", response_model=list[UserProfile], dependencies=[Depends(require_role("admin"))])
def list_users():
    return auth_service.list_users()


@router.patch("/users/{user_id}/role", response_model=UserProfile)
def update_role(
    user_id: str,
    payload: RoleUpdate,
    current_user: UserProfile = Depends(require_role("admin")),
):
    return auth_service.update_role(current_user.id, user_id, payload.role)
