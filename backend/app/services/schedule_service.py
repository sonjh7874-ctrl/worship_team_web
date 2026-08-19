from datetime import date

from fastapi import HTTPException

from app.repositories import schedule_repository
from app.schemas.schedule import (
    MonthlyScheduleCreate,
    MonthlyScheduleResponse,
    ScheduleWeekCreate,
    ScheduleWeekItem,
    ScheduleWeekSpecial,
    ScheduleWeekUpdate,
)


def _to_week_item(row: dict) -> ScheduleWeekItem:
    # special_title이 있는 행만 특순 정보를 중첩 객체로 묶어 내려준다 (없으면 null, README 빈 값 숨김 원칙).
    special = None
    if row.get("special_title"):
        special = ScheduleWeekSpecial(
            title=row["special_title"],
            date=row.get("special_date"),
            memo=row.get("special_memo"),
        )
    return ScheduleWeekItem(
        id=row["id"],
        week_label=row["week_label"],
        service_date=row.get("service_date"),
        remark=row.get("remark"),
        absence_note=row.get("absence_note"),
        special=special,
    )


def get_schedule(year: int, month: int) -> MonthlyScheduleResponse:
    row = schedule_repository.find_by_year_month(year, month)
    if row is None:
        raise HTTPException(status_code=404, detail="해당 월의 스케줄이 없습니다.")

    weeks = [_to_week_item(w) for w in row.get("schedule_weeks", [])]
    # 날짜가 있으면 날짜순, 없으면 week_label 문자열순으로 화면에 일관되게 표시한다.
    weeks.sort(key=lambda w: (w.service_date is None, w.service_date or date.min, w.week_label))

    return MonthlyScheduleResponse(
        id=row["id"], year=row["year"], month=row["month"], memo=row.get("memo"), weeks=weeks
    )


def create_schedule(payload: MonthlyScheduleCreate) -> MonthlyScheduleResponse:
    row = schedule_repository.create_schedule(payload.year, payload.month, payload.memo)
    return MonthlyScheduleResponse(
        id=row["id"], year=row["year"], month=row["month"], memo=row.get("memo"), weeks=[]
    )


def delete_schedule(schedule_id: int) -> None:
    if not schedule_repository.delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="월 스케줄을 찾을 수 없습니다.")


def create_week(schedule_id: int, payload: ScheduleWeekCreate) -> ScheduleWeekItem:
    if schedule_repository.find_by_id(schedule_id) is None:
        raise HTTPException(status_code=404, detail="월 스케줄을 찾을 수 없습니다.")

    fields = payload.model_dump()
    if fields.get("service_date") is not None:
        fields["service_date"] = fields["service_date"].isoformat()
    if fields.get("special_date") is not None:
        fields["special_date"] = fields["special_date"].isoformat()

    row = schedule_repository.create_week(schedule_id, fields)
    return _to_week_item(row)


def update_week(week_id: int, payload: ScheduleWeekUpdate) -> ScheduleWeekItem:
    # exclude_unset으로 요청에 포함된 필드만 갱신하는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("service_date") is not None:
        fields["service_date"] = fields["service_date"].isoformat()
    if fields.get("special_date") is not None:
        fields["special_date"] = fields["special_date"].isoformat()

    row = schedule_repository.update_week(week_id, fields) if fields else schedule_repository.find_week_by_id(week_id)
    if row is None:
        raise HTTPException(status_code=404, detail="주차를 찾을 수 없습니다.")
    return _to_week_item(row)


def delete_week(week_id: int) -> None:
    if not schedule_repository.delete_week(week_id):
        raise HTTPException(status_code=404, detail="주차를 찾을 수 없습니다.")
