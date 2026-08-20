import secrets

from fastapi import HTTPException
from supabase_auth.errors import AuthApiError

from app.repositories import user_profile_repository
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserProfile
from app.supabase_client import get_supabase, get_supabase_anon


def signup(payload: SignupRequest) -> TokenResponse:
    # 이메일 인증(Confirm email)이 꺼져 있으면 가입 응답에 session이 바로 담겨 온다.
    # 켜져 있으면 session이 None이라 이 시점엔 로그인 상태를 만들 수 없다 — 그 경우 401로
    # "이메일 인증 후 로그인해주세요"를 알린다(Supabase 프로젝트 설정에서 끄는 것을 전제로 함, SDD 참고).
    try:
        auth_res = get_supabase_anon().auth.sign_up(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=e.message) from e

    if auth_res.session is None or auth_res.user is None:
        raise HTTPException(
            status_code=401,
            detail="가입은 완료됐지만 이메일 인증이 필요합니다. 인증 후 로그인해주세요.",
        )

    profile_row = user_profile_repository.create(auth_res.user.id, payload.display_name)
    return _to_token_response(auth_res, profile_row)


def login(payload: LoginRequest) -> TokenResponse:
    try:
        auth_res = get_supabase_anon().auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.") from e

    profile_row = user_profile_repository.find_by_id(auth_res.user.id)
    if profile_row is None:
        # 가입은 auth.users에 있는데 user_profiles 행이 없는 경우(수동 생성 등) — 방어적으로 채운다.
        profile_row = user_profile_repository.create(auth_res.user.id, auth_res.user.email or "")
    return _to_token_response(auth_res, profile_row)


def refresh(refresh_token: str) -> TokenResponse:
    try:
        auth_res = get_supabase_anon().auth.refresh_session(refresh_token)
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다. 다시 로그인해주세요.") from e

    profile_row = user_profile_repository.find_by_id(auth_res.user.id)
    if profile_row is None:
        raise HTTPException(status_code=404, detail="사용자 프로필을 찾을 수 없습니다.")
    return _to_token_response(auth_res, profile_row)


def get_current_user(access_token: str) -> UserProfile:
    # RLS 우회 없이 토큰 자체를 검증만 하면 되므로 anon 클라이언트로 확인한다.
    try:
        user_res = get_supabase_anon().auth.get_user(access_token)
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail="인증 정보가 유효하지 않습니다.") from e

    if user_res is None or user_res.user is None:
        raise HTTPException(status_code=401, detail="인증 정보가 유효하지 않습니다.")

    profile_row = user_profile_repository.find_by_id(user_res.user.id)
    if profile_row is None:
        raise HTTPException(status_code=404, detail="사용자 프로필을 찾을 수 없습니다.")

    return _to_profile(user_res.user.id, user_res.user.email, profile_row)


def list_users() -> list[UserProfile]:
    # 목록 화면(/admin/users)용 — 이메일은 auth.users에만 있어 admin API로 채운다.
    rows = user_profile_repository.find_all()
    emails = _fetch_emails({row["id"] for row in rows})
    return [_to_profile(row["id"], emails.get(row["id"]), row) for row in rows]


def update_role(actor_id: str, target_user_id: str, role: str) -> UserProfile:
    if role == "admin":
        raise HTTPException(status_code=403, detail="admin 권한은 앱에서 부여할 수 없습니다.")
    if actor_id == target_user_id:
        raise HTTPException(status_code=403, detail="자기 자신의 역할은 변경할 수 없습니다.")

    row = user_profile_repository.update_role(target_user_id, role)
    if row is None:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    emails = _fetch_emails({target_user_id})
    return _to_profile(target_user_id, emails.get(target_user_id), row)


def reset_password(target_user_id: str) -> str:
    # 관리자가 값을 직접 정하지 않도록 서버가 무작위 임시 비밀번호를 생성한다 —
    # 관리자가 그 값을 알게 되는 건 어차피 피할 수 없지만(재설정 행위 자체가 그렇다),
    # 고정값이 아니라 매번 새로 생성해 추측 가능성을 없앤다. 응답에만 담기고
    # 서버 어디에도 저장하지 않으므로, 관리자가 이 시점에 화면에서 확인해 본인에게 안내해야 한다.
    # force_password_change를 함께 켜서, 이 임시 비밀번호로는 로그인 직후
    # 강제로 자기 비밀번호로 바꾸게 한다 — 그 순간부터는 관리자도 새 비밀번호를 모른다.
    temp_password = secrets.token_urlsafe(9)
    try:
        get_supabase().auth.admin.update_user_by_id(target_user_id, {"password": temp_password})
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=e.message) from e

    row = user_profile_repository.set_force_password_change(target_user_id, True)
    if row is None:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return temp_password


def change_own_password(user_id: str, new_password: str) -> UserProfile:
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다.")
    try:
        res = get_supabase().auth.admin.update_user_by_id(user_id, {"password": new_password})
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=e.message) from e

    row = user_profile_repository.set_force_password_change(user_id, False)
    if row is None:
        raise HTTPException(status_code=404, detail="사용자 프로필을 찾을 수 없습니다.")
    return _to_profile(user_id, res.user.email if res.user else None, row)


def update_display_name(user_id: str, email: str | None, display_name: str) -> UserProfile:
    display_name = display_name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="이름을 입력해주세요.")

    row = user_profile_repository.update_display_name(user_id, display_name)
    if row is None:
        raise HTTPException(status_code=404, detail="사용자 프로필을 찾을 수 없습니다.")
    return _to_profile(user_id, email, row)


def _to_profile(user_id: str, email: str | None, row: dict) -> UserProfile:
    return UserProfile(
        id=user_id,
        email=email,
        display_name=row["display_name"],
        role=row["role"],
        member_id=row["member_id"],
        force_password_change=row.get("force_password_change", False),
    )


def _to_token_response(auth_res, profile_row: dict) -> TokenResponse:
    session = auth_res.session
    return TokenResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at,
        user=_to_profile(auth_res.user.id, auth_res.user.email, profile_row),
    )


def _fetch_emails(user_ids: set[str]) -> dict[str, str]:
    # service_role 클라이언트의 admin API로 auth.users를 조회한다(user_profiles엔 이메일이 없다).
    emails: dict[str, str] = {}
    for user_id in user_ids:
        try:
            res = get_supabase().auth.admin.get_user_by_id(user_id)
            if res and res.user:
                emails[user_id] = res.user.email
        except AuthApiError:
            continue
    return emails
