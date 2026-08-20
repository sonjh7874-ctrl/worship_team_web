from fastapi import HTTPException

from app.repositories import calendar_repository
from app.schemas.calendar import (
    FIXED_CATEGORIES,
    PRESET_COLORS,
    CalendarEventCreate,
    CalendarEventDetail,
    CalendarEventListItem,
    CalendarEventUpdate,
    ParticipantInput,
    ParticipantItem,
)

AUTO_EDIT_BLOCKED_MESSAGE = "공지사항(월간 스케줄)에서 수정해주세요."


def _resolve_participant(row: dict) -> ParticipantItem | None:
    # 인명부 연결이 있으면 최신 이름 + member_id를, 없으면 저장된 스냅샷 이름만 돌려준다
    # (schedule_assignments의 _resolve_assignment와 동일 규칙, ERD 3-3).
    if row.get("member_id") is not None:
        member = row.get("members")
        name = member.get("name") if member else None
        if name:
            return ParticipantItem(member_id=row["member_id"], name=name)
    name_snapshot = row.get("name_snapshot")
    if name_snapshot:
        return ParticipantItem(member_id=None, name=name_snapshot)
    return None


def _to_detail(row: dict) -> CalendarEventDetail:
    participants = [
        p for p in (_resolve_participant(r) for r in row.get("event_participants", [])) if p is not None
    ]
    return CalendarEventDetail(
        id=row["id"],
        title=row["title"],
        start_date=row["start_date"],
        end_date=row.get("end_date"),
        category=row["category"],
        category_custom=row.get("category_custom"),
        color=row.get("color"),
        memo=row.get("memo"),
        source_type=row["source_type"],
        source_week_id=row.get("source_week_id"),
        participants=participants,
    )


def _validate_category(category: str, category_custom: str | None) -> str | None:
    # 카테고리는 고정값(수련회/엠티/특순/기타)만 허용한다. "기타"를 골랐을 때만
    # category_custom 자유 입력을 받고, 그 외에는 항상 null로 정규화한다 (README 5절).
    if category not in FIXED_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category는 {sorted(FIXED_CATEGORIES)} 중 하나여야 합니다.")
    if category == "기타":
        if not (category_custom or "").strip():
            raise HTTPException(status_code=400, detail="'기타' 카테고리는 category_custom이 필요합니다.")
        return category_custom
    return None


def _validate_color(color: str | None) -> None:
    # 자유 컬러피커 대신 프리셋 8개 중 하나만 허용한다 — null은 "카테고리 기본색 사용".
    if color is not None and color not in PRESET_COLORS:
        raise HTTPException(status_code=400, detail=f"color는 {PRESET_COLORS} 중 하나이거나 null이어야 합니다.")


def _validate_participants(participants: list[ParticipantInput]) -> list[dict]:
    rows = []
    for p in participants:
        # member_id/name_snapshot 중 하나는 필수 — DB의 chk_participant_identity 제약과 동일 규칙을
        # API 레벨에서도 사전 검증해 더 친절한 400 메시지로 막는다.
        if p.member_id is None and not (p.name_snapshot or "").strip():
            raise HTTPException(status_code=400, detail="member_id 또는 name_snapshot 중 하나는 필수입니다.")
        rows.append({"member_id": p.member_id, "name_snapshot": p.name_snapshot})
    return rows


def _validate_date_order(start_date: str, end_date: str | None) -> None:
    # end_date가 start_date보다 빠르면 프론트 캘린더 그리드의 막대 렌더링(grid-column
    # 계산)이 역전돼 깨진다. ISO 형식(YYYY-MM-DD) 문자열은 사전순 비교가 곧 날짜 비교와
    # 같아서 파싱 없이 그대로 비교한다.
    if end_date is not None and end_date < start_date:
        raise HTTPException(status_code=400, detail="종료일은 시작일보다 빠를 수 없습니다.")


def _guard_manual_only(row: dict) -> None:
    # 특순 자동 동기화 이벤트는 공지사항(월간 스케줄)이 원본이라 캘린더 API로 직접
    # 수정/삭제할 수 없다 (ERD 3-4, API명세 3절 — 단방향 동기화 강제).
    if row["source_type"] == "auto_from_schedule":
        raise HTTPException(status_code=403, detail=AUTO_EDIT_BLOCKED_MESSAGE)


def list_events(year: int, month: int) -> list[CalendarEventListItem]:
    return [CalendarEventListItem(**row) for row in calendar_repository.find_by_month(year, month)]


def get_event(event_id: int) -> CalendarEventDetail:
    row = calendar_repository.find_by_id(event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    return _to_detail(row)


def create_event(payload: CalendarEventCreate) -> CalendarEventDetail:
    category_custom = _validate_category(payload.category, payload.category_custom)
    _validate_color(payload.color)
    participant_rows = _validate_participants(payload.participants)
    start_date_iso = payload.start_date.isoformat()
    end_date_iso = payload.end_date.isoformat() if payload.end_date else None
    _validate_date_order(start_date_iso, end_date_iso)

    fields = {
        "title": payload.title,
        "start_date": start_date_iso,
        "end_date": end_date_iso,
        "category": payload.category,
        "category_custom": category_custom,
        "color": payload.color,
        "memo": payload.memo,
        # 직접 API로 생성하는 이벤트는 항상 manual로 강제한다 — auto 이벤트는
        # 스케줄 저장 로직(schedule_service)만 만들 수 있다.
        "source_type": "manual",
        "source_week_id": None,
    }
    row = calendar_repository.create_event(fields)
    event_id = row["id"]
    if participant_rows:
        calendar_repository.replace_participants(
            event_id, [{**r, "event_id": event_id} for r in participant_rows]
        )
    return get_event(event_id)


def update_event(event_id: int, payload: CalendarEventUpdate) -> CalendarEventDetail:
    row = calendar_repository.find_by_id(event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    _guard_manual_only(row)

    data = payload.model_dump(exclude_unset=True)
    participants = data.pop("participants", None)

    if "category" in data or "category_custom" in data:
        category = data.get("category", row["category"])
        category_custom = data.get("category_custom", row.get("category_custom"))
        data["category_custom"] = _validate_category(category, category_custom)

    if "color" in data:
        _validate_color(data["color"])

    if "start_date" in data and data["start_date"] is not None:
        data["start_date"] = data["start_date"].isoformat()
    if "end_date" in data and data["end_date"] is not None:
        data["end_date"] = data["end_date"].isoformat()

    # 이번 요청에서 안 바뀐 값은 기존 행의 값을 그대로 써서, 시작일만 바꾸거나
    # 종료일만 바꾸는 부분 수정에서도 최종 상태 기준으로 순서를 검증한다.
    final_start = data.get("start_date", row["start_date"])
    final_end = data.get("end_date", row.get("end_date"))
    _validate_date_order(final_start, final_end)

    if data:
        calendar_repository.update_event(event_id, data)

    if participants is not None:
        participant_rows = _validate_participants([ParticipantInput(**p) for p in participants])
        calendar_repository.replace_participants(
            event_id, [{**r, "event_id": event_id} for r in participant_rows]
        )

    return get_event(event_id)


def delete_event(event_id: int) -> None:
    row = calendar_repository.find_by_id(event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    _guard_manual_only(row)
    calendar_repository.delete_event(event_id)
