from fastapi import Header, HTTPException

from app.config import EDIT_PASSWORD


def verify_edit_password(x_edit_password: str = Header(default=None)) -> None:
    # 로그인 없이 리더십만 쓰기 권한을 갖도록, 쓰기 엔드포인트에 이 의존성을 달아
    # X-Edit-Password 헤더를 환경변수 EDIT_PASSWORD와 비교한다 (API명세 0-1).
    if x_edit_password != EDIT_PASSWORD:
        raise HTTPException(status_code=401, detail="편집 비밀번호가 올바르지 않습니다.")
