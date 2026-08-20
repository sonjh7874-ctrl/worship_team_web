from fastapi import APIRouter, Depends

from app.dependencies import verify_edit_password
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventDetail,
    CalendarEventListItem,
    CalendarEventUpdate,
)
from app.services import calendar_service

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])


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
    dependencies=[Depends(verify_edit_password)],
)
def create_calendar_event(payload: CalendarEventCreate):
    return calendar_service.create_event(payload)


@router.patch(
    "/{event_id}",
    response_model=CalendarEventDetail,
    dependencies=[Depends(verify_edit_password)],
)
def update_calendar_event(event_id: int, payload: CalendarEventUpdate):
    return calendar_service.update_event(event_id, payload)


@router.delete(
    "/{event_id}",
    status_code=204,
    dependencies=[Depends(verify_edit_password)],
)
def delete_calendar_event(event_id: int):
    calendar_service.delete_event(event_id)
