from fastapi import APIRouter, Depends

from app.dependencies import get_current_user_optional, require_role
from app.schemas.auth import UserProfile
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventDetail,
    CalendarEventListItem,
    CalendarEventUpdate,
)
from app.schemas.comment import CommentCreate, CommentItem, CommentUpdate
from app.services import calendar_service, comment_service

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])

_COMMENT_TABLE = "calendar_event_comments"
_COMMENT_FK = "event_id"


@router.get("", response_model=list[CalendarEventListItem])
def list_calendar_events(year: int, month: int):
    return calendar_service.list_events(year, month)


@router.get("/{event_id}", response_model=CalendarEventDetail)
def get_calendar_event(event_id: int):
    return calendar_service.get_event(event_id)


@router.post(
    "",
    response_model=CalendarEventDetail,
    status_code=201,
    dependencies=[Depends(require_role("leader"))],
)
def create_calendar_event(payload: CalendarEventCreate):
    return calendar_service.create_event(payload)


@router.patch(
    "/{event_id}",
    response_model=CalendarEventDetail,
    dependencies=[Depends(require_role("leader"))],
)
def update_calendar_event(event_id: int, payload: CalendarEventUpdate):
    return calendar_service.update_event(event_id, payload)


@router.delete(
    "/{event_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_calendar_event(event_id: int):
    calendar_service.delete_event(event_id)


@router.get("/{event_id}/comments", response_model=list[CommentItem])
def list_calendar_event_comments(
    event_id: int,
    current_user: UserProfile | None = Depends(get_current_user_optional),
):
    return comment_service.list_comments(_COMMENT_TABLE, _COMMENT_FK, event_id, current_user)


@router.post("/{event_id}/comments", response_model=CommentItem, status_code=201)
def create_calendar_event_comment(
    event_id: int,
    payload: CommentCreate,
    current_user: UserProfile = Depends(require_role("member")),
):
    # 존재하지 않는 event_id로 댓글을 작성하면 FK 위반이 500 + 원본 DB 에러 메시지로 새어나갔다.
    calendar_service.get_event(event_id)
    return comment_service.create_comment(_COMMENT_TABLE, _COMMENT_FK, event_id, current_user, payload.content)


@router.patch("/{event_id}/comments/{comment_id}", response_model=CommentItem)
def update_calendar_event_comment(
    event_id: int,
    comment_id: int,
    payload: CommentUpdate,
    current_user: UserProfile = Depends(require_role("member")),
):
    return comment_service.update_comment(_COMMENT_TABLE, _COMMENT_FK, event_id, comment_id, current_user, payload.content)


@router.delete("/{event_id}/comments/{comment_id}", status_code=204)
def delete_calendar_event_comment(
    event_id: int,
    comment_id: int,
    current_user: UserProfile = Depends(require_role("member")),
):
    comment_service.delete_comment(_COMMENT_TABLE, _COMMENT_FK, event_id, comment_id, current_user)
