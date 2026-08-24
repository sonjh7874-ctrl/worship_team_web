from datetime import date

from fastapi import HTTPException

from app.repositories import calendar_repository, schedule_repository
from app.schemas.schedule import (
    AssignedPerson,
    AssignmentCountsResponse,
    InstrumentAssignment,
    MicAssignmentCount,
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


def _resolve_assignment(row: dict) -> AssignedPerson | None:
    # 인명부 연결이 있으면 최신 이름 + member_id를, 없으면(탈퇴자/동명이인 표기) 저장된
    # 스냅샷 이름만 돌려준다 (ERD 3-3). member_id가 있어야 프론트 편집 화면에서 드롭다운을
    # 미리 채울 수 있다 — name만으로는 어떤 팀원인지 되짚을 수 없기 때문.
    if row.get("member_id") is not None:
        member = row.get("members")
        name = member.get("name") if member else None
        if name:
            return AssignedPerson(member_id=row["member_id"], name=name)
    name_snapshot = row.get("name_snapshot")
    if name_snapshot:
        return AssignedPerson(member_id=None, name=name_snapshot)
    return None


def _pivot_assignments(rows: list[dict]) -> tuple[InstrumentAssignment, SingerAssignment]:
    instrument = InstrumentAssignment()
    singer = SingerAssignment()
    for row in sorted(rows, key=lambda r: r.get("slot_order") or 0):
        person = _resolve_assignment(row)
        if person is None:
            continue
        code = row["position_code"]
        if code in MIC_SLOT_CODES:
            singer.mic[MIC_SLOT_CODES[code]] = person
        elif code == "choir":
            singer.choir.append(person)
        elif code == "singer_score":
            singer.score.append(person)
        elif code in POSITION_FIELD_MAP:
            group, field = POSITION_FIELD_MAP[code]
            setattr(instrument if group == "instrument" else singer, field, person)
        # 'special'(특순 참여자) 배정은 이번 MVP 응답 스펙에 포함하지 않는다 —
        # 특순 자체는 schedule_weeks.special_*(캘린더 동기화용 텍스트)로 별도 관리한다.
    return instrument, singer


def _sync_special_calendar_event(week_row: dict) -> None:
    # schedule_weeks.special_title이 원본(source of truth)이다 (ERD 3-4). 저장할 때마다
    # 최종 상태를 기준으로 캘린더 이벤트를 만들거나/갱신하거나/지운다 — 어떤 필드가 바뀌었는지
    # 따지지 않고 항상 이 함수 하나로 수렴시켜야 두 곳 값이 어긋나는 문제가 재발하지 않는다.
    special_title = week_row.get("special_title")
    if not special_title:
        calendar_repository.delete_special_event(week_row["id"])
        return

    # 특순 날짜가 따로 없으면 예배 날짜를 대신 쓴다. 둘 다 없으면 캘린더 이벤트의
    # start_date(NOT NULL)를 채울 수 없어 동기화를 건너뛴다.
    special_date = week_row.get("special_date") or week_row.get("service_date")
    if special_date is None:
        return
    if isinstance(special_date, str):
        special_date = date.fromisoformat(special_date)

    calendar_repository.upsert_special_event(
        week_row["id"], special_title, special_date, week_row.get("special_memo")
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
    # special_title이 없는 새 주차는 캘린더에 지울 이벤트도 없으니 굳이 동기화를
    # 호출하지 않는다 (어차피 no-op DELETE라 결과는 같지만 불필요한 쓰기를 피한다).
    if row.get("special_title"):
        _sync_special_calendar_event(row)
    return _to_week_item(row)


def update_week(week_id: int, payload: ScheduleWeekUpdate) -> ScheduleWeekItem:
    # exclude_unset으로 요청에 포함된 필드만 갱신하는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    touched = fields.keys()
    if fields.get("service_date") is not None:
        fields["service_date"] = fields["service_date"].isoformat()
    if fields.get("special_date") is not None:
        fields["special_date"] = fields["special_date"].isoformat()

    row = schedule_repository.update_week(week_id, fields) if fields else schedule_repository.find_week_by_id(week_id)
    if row is None:
        raise HTTPException(status_code=404, detail="주차를 찾을 수 없습니다.")

    # 특순 관련 필드가 이번 요청에 직접 포함됐을 때(설정/해제 포함)는 항상 동기화한다.
    # 그 외에는, 이미 특순이 걸려 있는 주차에서 service_date가 바뀐 경우만 추가로
    # 동기화한다 — special_date가 비어 service_date를 폴백으로 쓰는 주차는 그 폴백
    # 값이 바뀌는 셈이라 캘린더 이벤트도 갱신해야 하기 때문. 비고·불참사항처럼
    # 특순과 무관한 필드만 고친 경우는 건너뛰어 불필요한 DB 쓰기를 피한다.
    special_touched = bool({"special_title", "special_date", "special_memo"} & touched)
    if not special_touched and row.get("special_title") and "service_date" in touched:
        special_touched = True
    if special_touched:
        _sync_special_calendar_event(row)
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


def aggregate_mic_counts(rows: list[dict], month: int) -> list[MicAssignmentCount]:
    # 순수 함수 — DB/네트워크 없이 마이크 배정 원자재 행을 사람별 월/연 카운트로 집계한다.
    # member_id가 없는 행(인명부 밖 인물, name_snapshot만 저장된 경우)은 애초에 배정
    # 드롭다운 선택지에 없어 숫자를 붙일 자리가 없으므로 집계에서 제외한다 (ERD 3-3).
    counts: dict[int, MicAssignmentCount] = {}
    for row in rows:
        member_id = row.get("member_id")
        if member_id is None:
            continue
        member = row.get("members")
        name = member.get("name") if member else None
        if not name:
            continue
        entry = counts.get(member_id)
        if entry is None:
            entry = MicAssignmentCount(member_id=member_id, name=name, month_count=0, year_count=0)
            counts[member_id] = entry
        entry.year_count += 1
        if row.get("month") == month:
            entry.month_count += 1
    return sorted(counts.values(), key=lambda c: c.name)


def get_assignment_counts(year: int, month: int) -> AssignmentCountsResponse:
    rows = schedule_repository.find_mic_assignments_by_year(year)
    counts = aggregate_mic_counts(rows, month)
    return AssignmentCountsResponse(year=year, month=month, counts=counts)
