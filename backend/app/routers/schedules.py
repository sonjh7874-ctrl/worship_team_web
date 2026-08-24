from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.availability import (
    AvailabilityParseRequest,
    AvailabilityParseResult,
    AvailabilityResponse,
    AvailabilitySubmissionsPutRequest,
)
from app.schemas.schedule import (
    AssignmentCountsResponse,
    MonthlyScheduleCreate,
    MonthlyScheduleResponse,
    ScheduleAssignmentsPutRequest,
    ScheduleWeekCreate,
    ScheduleWeekItem,
    ScheduleWeekUpdate,
)
from app.services import availability_parse_service, availability_service, schedule_service

router = APIRouter(prefix="/api/v1/schedules", tags=["schedules"])


@router.get("", response_model=MonthlyScheduleResponse)
def get_schedule(year: int, month: int):
    return schedule_service.get_schedule(year, month)


# 주의: "/{schedule_id}" 계열 경로 변수 라우트보다 반드시 위에 선언해야 한다
# ("/latest", "/ai-parse"와 동일한 이유 — Phase 1·6 교훈).
@router.get("/assignment-counts", response_model=AssignmentCountsResponse)
def get_assignment_counts(year: int, month: int):
    """마이크 1~8 배정 횟수(해당 월 + 올해 누적). 배정 편집 화면의 드롭다운에 표시하는 용도."""
    return schedule_service.get_assignment_counts(year, month)


# 참/불참 텍스트 파싱(Phase 11-B). 이 셋도 "/{schedule_id}" 계열 경로 변수 라우트보다 위에 선언한다.
# 조회(GET)도 leader 이상만 — 참/불참 사유(결혼식·가족일정 등)는 팀원 개인 사정을 담은 텍스트라
# 다른 도메인의 "조회는 비로그인 공개" 원칙과 달리 리더십 전용으로 좁힌다(전체_로드맵.md Phase 11-B 파생 결정 10).
@router.post(
    "/availability/ai-parse",
    response_model=AvailabilityParseResult,
    dependencies=[Depends(require_role("leader"))],
)
def parse_availability(payload: AvailabilityParseRequest):
    """여러 명의 참/불참 텍스트를 AI로 구조화한다. 결과는 DB에 저장하지 않고 검수 화면으로 그대로 반환한다."""
    return availability_parse_service.parse_availability_text(payload.text, payload.year, payload.month)


@router.get(
    "/availability",
    response_model=AvailabilityResponse,
    dependencies=[Depends(require_role("leader"))],
)
def get_availability(year: int, month: int):
    return availability_service.get_availability(year, month)


@router.put(
    "/availability",
    response_model=AvailabilityResponse,
    dependencies=[Depends(require_role("leader"))],
)
def put_availability(year: int, month: int, payload: AvailabilitySubmissionsPutRequest):
    return availability_service.put_availability(year, month, payload)


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
