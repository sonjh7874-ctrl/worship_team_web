from fastapi import Header, HTTPException

from app.config import EDIT_PASSWORD


def verify_edit_password(x_edit_password: str = Header(default=None)) -> None:
    if x_edit_password != EDIT_PASSWORD:
        raise HTTPException(status_code=401, detail="편집 비밀번호가 올바르지 않습니다.")
