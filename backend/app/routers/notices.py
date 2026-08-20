from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.notice import NoticeCreate, NoticeDetail, NoticeListItem, NoticeUpdate
from app.services import notice_service

router = APIRouter(prefix="/api/v1/notices", tags=["notices"])


@router.get("", response_model=list[NoticeListItem])
def list_notices():
    return notice_service.list_notices()


@router.get("/{notice_id}", response_model=NoticeDetail)
def get_notice(notice_id: int):
    return notice_service.get_notice(notice_id)


@router.post(
    "",
    response_model=NoticeDetail,
    status_code=201,
    dependencies=[Depends(require_role("leader"))],
)
def create_notice(payload: NoticeCreate):
    return notice_service.create_notice(payload)


@router.patch(
    "/{notice_id}",
    response_model=NoticeDetail,
    dependencies=[Depends(require_role("leader"))],
)
def update_notice(notice_id: int, payload: NoticeUpdate):
    return notice_service.update_notice(notice_id, payload)


@router.delete(
    "/{notice_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_notice(notice_id: int):
    notice_service.delete_notice(notice_id)
