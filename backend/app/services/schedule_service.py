from datetime import date

from fastapi import HTTPException

from app.repositories import schedule_repository
from app.schemas.schedule import (
    InstrumentAssignment,
    MonthlyScheduleCreate,
    MonthlyScheduleResponse,
    ScheduleAssignmentsPutRequest,
    ScheduleWeekCreate,
    ScheduleWeekItem,
    ScheduleWeekSpecial,
    ScheduleWeekUpdate,
    SingerAssignment,
)

# position_code -> (배정 그룹, 응답 필드명). positions 마스터의 고정 항목과 1:1 대응한다
# (API명세 2-2 응답 예시 기준. inst_score/singer_score는 응답 필드명이 둘 다 "score"라 그룹으로 구분).
# singer_score는 여러 명 배정 가능(is_multi=true)이라 choir처럼 리스트에 append하는 별도 분기로 처리하고,
# 여기서는 단일 값으로 setattr하는 포지션만 남긴다.
POSITION_FIELD_MAP = {
    "key1": ("instrument", "key1"),
    "key2": ("instrument", "key2"),
    "drum": ("instrument", "drum"),
    "bass": ("instrument", "bass"),
    "electric": ("instrument", "electric"),
    "singer_helper": ("instrument", "singer_helper"),
    "inst_score": ("instrument", "score"),
    "singer_caption": ("singer", "caption"),
}
MIC_SLOT_CODES = {f"mic{i}": str(i) for i in range(1, 9)}
# 콰이어/특순/싱어 악보는 한 주차에 여러 명이 들어갈 수 있는 예외 포지션 (positions.is_multi).
# 싱어 악보는 보통 2명이 나눠 맡아 여기 포함됨.
MULTI_SLOT_CODES = {"choir", "special", "singer_score"}


def _resolve_assignment_name(row: dict) -> str | None:
    # 인명부 연결이 있으면 최신 이름을, 없으면(탈퇴자/동명이인 표기) 저장된 스냅샷을 쓴다 (ERD 3-3).
    if row.get("member_id") is not None:
        member = row.get("members")
        if member:
            return member.get("name")
    return row.get("name_snapshot")


def _pivot_assignments(rows: list[dict]) -> tuple[InstrumentAssignment, SingerAssignment]:
    instrument = InstrumentAssignment()
    singer = SingerAssignment()
    for row in sorted(rows, key=lambda r: r.get("slot_order") or 0):
        name = _resolve_assignment_name(row)
        if name is None:
            continue
        code = row["position_code"]
        if code in MIC_SLOT_CODES:
            singer.mic[MIC_SLOT_CODES[code]] = name
        elif code == "choir":
            singer.choir.append(name)
        elif code == "singer_score":
            singer.score.append(name)
        elif code in POSITION_FIELD_MAP:
            group, field = POSITION_FIELD_MAP[code]
            setattr(instrument if group == "instrument" else singer, field, name)
        # 'special'(특순 참여자) 배정은 이번 MVP 응답 스펙에 포함하지 않는다 —
        # 특순 자체는 schedule_weeks.special_*(캘린더 동기화용 텍스트)로 별도 관리한다.
    return instrument, singer


def _to_week_item(row: dict) -> ScheduleWeekItem:
    # special_title이 있는 행만 특순 정보를 중첩 객체로 묶어 내려준다 (없으면 null, README 빈 값 숨김 원칙).
    special = None
    if row.get("special_title"):
        special = ScheduleWeekSpecial(
            title=row["special_title"],
            date=row.get("special_date"),
            memo=row.get("special_memo"),
        )
    instrument, singer = _pivot_assignments(row.get("schedule_assignments", []))
    return ScheduleWeekItem(
        id=row["id"],
        week_label=row["week_label"],
        service_date=row.get("service_date"),
        remark=row.get("remark"),
        absence_note=row.get("absence_note"),
        special=special,
        instrument=instrument,
        singer=singer,
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


def put_assignments(week_id: int, payload: ScheduleAssignmentsPutRequest) -> ScheduleWeekItem:
    if schedule_repository.find_week_by_id(week_id) is None:
        raise HTTPException(status_code=404, detail="주차를 찾을 수 없습니다.")

    seen_single_slot_codes: set[str] = set()
    rows = []
    for item in payload.assignments:
        # member_id/name_snapshot 중 하나는 필수 — DB의 chk_assignment_identity 제약과 동일 규칙을
        # API 레벨에서도 사전 검증해 더 친절한 400 메시지로 막는다 (API명세 2-3).
        if item.member_id is None and not (item.name_snapshot or "").strip():
            raise HTTPException(
                status_code=400, detail="member_id 또는 name_snapshot 중 하나는 필수입니다."
            )
        # 단일 슬롯 포지션(콰이어/특순 제외)은 같은 주차에 중복 배정할 수 없다 (uq_assignment_single_slot).
        if item.position_code not in MULTI_SLOT_CODES:
            if item.position_code in seen_single_slot_codes:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{item.position_code}' 포지션은 한 주차에 한 명만 배정할 수 있습니다.",
                )
            seen_single_slot_codes.add(item.position_code)

        rows.append(
            {
                "week_id": week_id,
                "position_code": item.position_code,
                "member_id": item.member_id,
                "name_snapshot": item.name_snapshot,
                "slot_order": item.slot_order,
            }
        )

    schedule_repository.replace_assignments(week_id, rows)
    row = schedule_repository.find_week_with_assignments(week_id)
    return _to_week_item(row)
