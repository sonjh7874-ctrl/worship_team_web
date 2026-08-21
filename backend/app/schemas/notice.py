from datetime import datetime

from pydantic import BaseModel


class NoticeListItem(BaseModel):
    id: int
    title: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    # 목록 화면에서 상세로 들어가지 않아도 댓글이 있는지 알 수 있도록 함께 내려준다.
    comment_count: int = 0


class NoticeDetail(NoticeListItem):
    content: str | None = None


class NoticeCreate(BaseModel):
    title: str
    content: str | None = None
    is_pinned: bool = False


class NoticeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_pinned: bool | None = None
