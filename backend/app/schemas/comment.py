from pydantic import BaseModel


class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str


class CommentItem(BaseModel):
    id: int
    author_name: str
    content: str
    created_at: str
    updated_at: str
    # updated_at != created_at 비교로 판단 — 별도 컬럼을 늘리지 않는다.
    is_edited: bool
    # 프론트가 "현재 로그인한 사용자 id/역할"과 작성자 id를 비교하는 로직을
    # 중복 구현하지 않도록 서버가 미리 판정해 내려준다.
    can_edit: bool
    can_delete: bool
