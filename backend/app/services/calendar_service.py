from datetime import date

from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.repositories import calendar_repository, member_repository
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

# 이벤트가 어떤 원본에서 자동 생성됐는지에 따라 안내 메시지가 다르다 — 특순은 스케줄에서,
# 생일은 인명부에서 고쳐야 한다(3-12절). "manual"은 이 맵에 없으므로 애초에 가드에 걸리지 않는다.
_AUTO_EDIT_BLOCKED_MESSAGES = {
    "auto_from_schedule": "공지사항(월간 스케줄)에서 수정해주세요.",
    "auto_birthday": "인명부에서 생년월일을 수정해주세요.",
}


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


def _pop_comment_count(row: dict) -> int:
    # Supabase가 중첩 집계를 [{"count": n}] 형태로 내려주므로 응답 스키마의 comment_count로 펴서 담는다
    # (song_service.list_songs, notice_service와 동일한 패턴).
    nested = row.pop("calendar_event_comments", None) or [{}]
    return nested[0].get("count", 0)


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
        source_member_id=row.get("source_member_id"),
        comment_count=_pop_comment_count(row),
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
    # 자동 생성 이벤트(특순 ERD 3-4, 생일 3-12절)는 각자의 원본이 진짜 출처라 캘린더 API로
    # 직접 수정/삭제할 수 없다 (단방향 동기화 강제).
    message = _AUTO_EDIT_BLOCKED_MESSAGES.get(row["source_type"])
    if message:
        raise HTTPException(status_code=403, detail=message)


def _birthday_event_date(birth_date: date, year: int) -> date:
    try:
        return birth_date.replace(year=year)
    except ValueError:
        # 2/29 생일이 평년과 겹치면 2/28로 보정한다.
        return birth_date.replace(year=year, day=28)


def _sync_birthday_events(year: int, month: int) -> None:
    # 그 달의 생일 자동 이벤트를 현재 인명부 상태와 맞춰 재계산한다 — 특순처럼 저장 시점에
    # 동기화를 트리거할 "쓰기 이벤트"가 없으므로, 그 달을 조회할 때마다 대상자를 다시 계산해
    # 없으면 만들고, 더 이상 대상이 아니면(퇴사·생일 삭제) 지운다(3-12절). 퇴사한 팀원은
    # 애초에 활동 팀원 조회에서 빠지므로 생일이 새로 생기지 않는다.
    members = member_repository.find_all(active=True)
    desired: dict[int, tuple[date, str]] = {}
    for member in members:
        birth_date = member.get("birth_date")
        if not birth_date:
            continue
        if isinstance(birth_date, str):
            birth_date = date.fromisoformat(birth_date)
        if birth_date.month != month:
            continue
        event_date = _birthday_event_date(birth_date, year)
        desired[member["id"]] = (event_date, f"{member['name']}님 생일")

    existing = {row["source_member_id"]: row for row in calendar_repository.find_birthday_events_by_month(year, month)}

    for member_id, (event_date, title) in desired.items():
        row = existing.pop(member_id, None)
        start_date_iso = event_date.isoformat()
        if row is None:
            try:
                calendar_repository.create_event(
                    {
                        "title": title,
                        "start_date": start_date_iso,
                        "end_date": None,
                        "category": "생일",
                        "category_custom": None,
                        "color": None,
                        "memo": None,
                        "source_type": "auto_birthday",
                        "source_week_id": None,
                        "source_member_id": member_id,
                    }
                )
            except APIError as exc:
                # 이 GET 요청과 거의 동시에 들어온 다른 요청이 먼저 같은 생일 이벤트를 만든
                # 경쟁 상태(예: React StrictMode의 이중 호출, 여러 탭 동시 접속)다.
                # uq_event_source_member_year가 막아주므로 조용히 넘어간다 — 이번 조회는
                # find_by_month에서 방금 다른 요청이 만든 행을 그대로 읽어오면 된다.
                # 그 외 원인의 DB 오류는 그대로 올려 원래 있던 500 처리 경로를 따르게 한다.
                if exc.code != "23505":
                    raise
        elif row["start_date"] != start_date_iso or row["title"] != title:
            calendar_repository.update_event(row["id"], {"start_date": start_date_iso, "title": title})

    # 남은 항목은 더 이상 대상이 아닌(퇴사·생일 삭제) 이전 생일 이벤트라 지운다.
    for row in existing.values():
        calendar_repository.delete_event(row["id"])


def list_events(year: int, month: int) -> list[CalendarEventListItem]:
    _sync_birthday_events(year, month)
    items = []
    for row in calendar_repository.find_by_month(year, month):
        comment_count = _pop_comment_count(row)
        items.append(CalendarEventListItem(**row, comment_count=comment_count))
    return items


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
