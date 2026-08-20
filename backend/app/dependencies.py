from fastapi import Header, HTTPException

from app.config import EDIT_PASSWORD
from app.schemas.auth import Role, UserProfile
from app.services import auth_service

# 역할 등급 — leader는 admin 권한도 포함(등급 비교로 "이상"을 표현).
_ROLE_RANK: dict[str, int] = {"member": 0, "leader": 1, "admin": 2}


def verify_edit_password(x_edit_password: str = Header(default=None)) -> None:
    # 로그인 없이 리더십만 쓰기 권한을 갖도록, 쓰기 엔드포인트에 이 의존성을 달아
    # X-Edit-Password 헤더를 환경변수 EDIT_PASSWORD와 비교한다 (API명세 0-1).
    # Phase 7에서 require_role로 대체될 때까지 유지한다.
    if x_edit_password != EDIT_PASSWORD:
        raise HTTPException(status_code=401, detail="편집 비밀번호가 올바르지 않습니다.")


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
