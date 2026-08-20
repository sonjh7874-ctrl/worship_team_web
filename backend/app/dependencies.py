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
