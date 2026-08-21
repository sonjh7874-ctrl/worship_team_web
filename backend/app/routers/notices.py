from fastapi import APIRouter, Depends

from app.dependencies import get_current_user_optional, require_role
from app.schemas.auth import UserProfile
from app.schemas.comment import CommentCreate, CommentItem, CommentUpdate
from app.schemas.notice import NoticeCreate, NoticeDetail, NoticeListItem, NoticeUpdate
from app.services import comment_service, notice_service

router = APIRouter(prefix="/api/v1/notices", tags=["notices"])

_COMMENT_TABLE = "notice_comments"
_COMMENT_FK = "notice_id"


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


@router.get("/{notice_id}/comments", response_model=list[CommentItem])
def list_notice_comments(
    notice_id: int,
    current_user: UserProfile | None = Depends(get_current_user_optional),
):
    return comment_service.list_comments(_COMMENT_TABLE, _COMMENT_FK, notice_id, current_user)


@router.post("/{notice_id}/comments", response_model=CommentItem, status_code=201)
def create_notice_comment(
    notice_id: int,
    payload: CommentCreate,
    current_user: UserProfile = Depends(require_role("member")),
):
    # 존재하지 않는 notice_id로 댓글을 작성하면 FK 위반이 전역 예외 핸들러에서 안 잡히는
    # 코드라 500 + 원본 DB 에러 메시지가 새어나갔다 — 다른 서비스처럼 먼저 404로 막는다.
    notice_service.get_notice(notice_id)
    return comment_service.create_comment(_COMMENT_TABLE, _COMMENT_FK, notice_id, current_user, payload.content)


@router.patch("/{notice_id}/comments/{comment_id}", response_model=CommentItem)
def update_notice_comment(
    notice_id: int,
    comment_id: int,
    payload: CommentUpdate,
    current_user: UserProfile = Depends(require_role("member")),
):
    return comment_service.update_comment(_COMMENT_TABLE, _COMMENT_FK, notice_id, comment_id, current_user, payload.content)


@router.delete("/{notice_id}/comments/{comment_id}", status_code=204)
def delete_notice_comment(
    notice_id: int,
    comment_id: int,
    current_user: UserProfile = Depends(require_role("member")),
):
    comment_service.delete_comment(_COMMENT_TABLE, _COMMENT_FK, notice_id, comment_id, current_user)
