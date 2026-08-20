from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.schedule import (
    MonthlyScheduleCreate,
    MonthlyScheduleResponse,
    ScheduleAssignmentsPutRequest,
    ScheduleWeekCreate,
    ScheduleWeekItem,
    ScheduleWeekUpdate,
)
from app.services import schedule_service

router = APIRouter(prefix="/api/v1/schedules", tags=["schedules"])


@router.get("", response_model=MonthlyScheduleResponse)
def get_schedule(year: int, month: int):
    return schedule_service.get_schedule(year, month)


@router.post(
    "",
    response_model=MonthlyScheduleResponse,
    status_code=201,
    dependencies=[Depends(require_role("leader"))],
)
def create_schedule(payload: MonthlyScheduleCreate):
    return schedule_service.create_schedule(payload)


@router.delete(
    "/{schedule_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_schedule(schedule_id: int):
    schedule_service.delete_schedule(schedule_id)


@router.post(
    "/{schedule_id}/weeks",
    response_model=ScheduleWeekItem,
    status_code=201,
    dependencies=[Depends(require_role("leader"))],
)
def create_week(schedule_id: int, payload: ScheduleWeekCreate):
    return schedule_service.create_week(schedule_id, payload)


@router.patch(
    "/{schedule_id}/weeks/{week_id}",
    response_model=ScheduleWeekItem,
    dependencies=[Depends(require_role("leader"))],
)
def update_week(schedule_id: int, week_id: int, payload: ScheduleWeekUpdate):
    return schedule_service.update_week(week_id, payload)


@router.delete(
    "/{schedule_id}/weeks/{week_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_week(schedule_id: int, week_id: int):
    schedule_service.delete_week(week_id)


@router.put(
    "/{schedule_id}/weeks/{week_id}/assignments",
    response_model=ScheduleWeekItem,
    dependencies=[Depends(require_role("leader"))],
)
def put_assignments(schedule_id: int, week_id: int, payload: ScheduleAssignmentsPutRequest):
    return schedule_service.put_assignments(week_id, payload)
