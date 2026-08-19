from fastapi import HTTPException

from app.repositories import notice_repository
from app.schemas.notice import NoticeCreate, NoticeDetail, NoticeListItem, NoticeUpdate


def list_notices() -> list[NoticeListItem]:
    return [NoticeListItem(**row) for row in notice_repository.find_all()]


def get_notice(notice_id: int) -> NoticeDetail:
    row = notice_repository.find_by_id(notice_id)
    if row is None:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    return NoticeDetail(**row)


def create_notice(payload: NoticeCreate) -> NoticeDetail:
    row = notice_repository.create(payload.title, payload.content, payload.is_pinned)
    return NoticeDetail(**row)


def update_notice(notice_id: int, payload: NoticeUpdate) -> NoticeDetail:
    # exclude_unset으로 요청에 포함된 필드만 갱신하는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    row = notice_repository.update(notice_id, fields) if fields else notice_repository.find_by_id(notice_id)
    if row is None:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    return NoticeDetail(**row)


def delete_notice(notice_id: int) -> None:
    if not notice_repository.delete(notice_id):
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
