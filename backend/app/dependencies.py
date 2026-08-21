from fastapi import Header, HTTPException

from app.schemas.auth import Role, UserProfile
from app.services import auth_service

# 역할 등급 — leader는 admin 권한도 포함(등급 비교로 "이상"을 표현).
_ROLE_RANK: dict[str, int] = {"member": 0, "leader": 1, "admin": 2}


def require_role(min_role: Role):
    # 사용 예: Depends(require_role("leader")) — leader 이상(leader, admin)을 통과시킨다.
    # Depends(require_role("admin")) — admin만 통과시킨다.
    def dependency(authorization: str = Header(default=None)) -> UserProfile:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
        token = authorization.removeprefix("Bearer ").strip()

        current_user = auth_service.get_current_user(token)
        if _ROLE_RANK[current_user.role] < _ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail="권한이 없습니다. 리더십에게 문의해주세요.")
        return current_user

    return dependency


def get_current_user_optional(authorization: str = Header(default=None)) -> UserProfile | None:
    # require_role과 달리 인증이 없거나 무효해도 예외를 던지지 않고 None을 반환한다.
    # 댓글 목록처럼 "비로그인도 조회는 되지만, 로그인 상태면 can_edit/can_delete를 함께 보여줘야
    # 하는" 화면에 쓴다 — 로그인 여부가 200 응답 자체를 막아서는 안 되기 때문.
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        return auth_service.get_current_user(token)
    except Exception:
        # 의도적으로 넓게 잡는다 — 토큰 무효(HTTPException)뿐 아니라 Supabase 쪽 네트워크
        # 순단 등 예상 못한 예외까지도 "비로그인으로 간주"하고 넘어가야 한다. 이 함수의
        # 존재 이유가 "비로그인 조회는 절대 깨지면 안 된다"이므로, 여기서 예외를 삼키지
        # 않으면 인증 서버 장애가 그대로 비로그인 사용자의 500 에러로 번진다.
        return None
