from datetime import datetime

from pydantic import BaseModel


class NoticeListItem(BaseModel):
    id: int
    title: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


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
