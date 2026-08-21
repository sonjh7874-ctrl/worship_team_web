import calendar as cal
from datetime import date

from app.supabase_client import get_supabase

TABLE = "calendar_events"
PARTICIPANT_TABLE = "event_participants"

# 인명부 연결이 있으면 members.name을, 없으면 name_snapshot을 서비스 레이어가 골라 쓴다
# (schedule_assignments와 동일한 ERD 3-3 COALESCE 규칙).
PARTICIPANTS_SELECT = f"{PARTICIPANT_TABLE}(member_id, name_snapshot, members(name))"

LIST_SELECT = (
    "id, title, start_date, end_date, category, category_custom, color, source_type, source_week_id,"
    " calendar_event_comments(count)"
)
DETAIL_SELECT = (
    "id, title, start_date, end_date, category, category_custom, color, memo,"
    f" source_type, source_week_id, calendar_event_comments(count), {PARTICIPANTS_SELECT}"
)


def find_by_month(year: int, month: int) -> list[dict]:
    # 해당 월과 겹치는 이벤트를 모두 가져온다: 시작일이 그달 말일 이전이면서,
    # (종료일이 그달 1일 이후) 또는 (종료일이 없고 시작일이 그달 1일 이후)인 경우.
    # 멀티데이 이벤트가 월 경계를 걸치는 케이스까지 포함하기 위한 오버랩 조건이다.
    month_start = date(year, month, 1)
    month_end = date(year, month, cal.monthrange(year, month)[1])

    res = (
        get_supabase()
        .table(TABLE)
        .select(LIST_SELECT)
        .lte("start_date", month_end.isoformat())
        .or_(
            f"end_date.gte.{month_start.isoformat()},"
            f"and(end_date.is.null,start_date.gte.{month_start.isoformat()})"
        )
        .order("start_date")
        .execute()
    )
    return res.data


def find_by_id(event_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select(DETAIL_SELECT)
        .eq("id", event_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def find_by_source_week(week_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id")
        .eq("source_week_id", week_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create_event(fields: dict) -> dict:
    res = get_supabase().table(TABLE).insert(fields).execute()
    return res.data[0]


def update_event(event_id: int, fields: dict) -> dict | None:
    res = get_supabase().table(TABLE).update(fields).eq("id", event_id).execute()
    return res.data[0] if res.data else None


def delete_event(event_id: int) -> bool:
    res = get_supabase().table(TABLE).delete().eq("id", event_id).execute()
    return bool(res.data)


def replace_participants(event_id: int, rows: list[dict]) -> None:
    # PUT 방식 전체 교체 — conti_songs/schedule_assignments와 동일한 delete-then-insert 패턴.
    supabase = get_supabase()
    supabase.table(PARTICIPANT_TABLE).delete().eq("event_id", event_id).execute()
    if rows:
        supabase.table(PARTICIPANT_TABLE).insert(rows).execute()


def upsert_special_event(week_id: int, title: str, start_date: date, memo: str | None) -> dict:
    # calendar_events.source_week_id에는 부분 유니크 인덱스(uq_event_source_week)만 걸려있어
    # Postgres의 ON CONFLICT 자동 추론이 걸리지 않는다. DB upsert 대신 조회 후 분기해
    # 갱신/삽입을 직접 결정한다 (ERD 3-4 단방향 동기화).
    payload = {
        "title": title,
        "start_date": start_date.isoformat(),
        "end_date": None,
        "category": "특순",
        "category_custom": None,
        "memo": memo,
        "source_type": "auto_from_schedule",
        "source_week_id": week_id,
    }
    supabase = get_supabase()
    existing = find_by_source_week(week_id)
    if existing:
        res = supabase.table(TABLE).update(payload).eq("id", existing["id"]).execute()
        return res.data[0]
    res = supabase.table(TABLE).insert(payload).execute()
    return res.data[0]


def delete_special_event(week_id: int) -> None:
    get_supabase().table(TABLE).delete().eq("source_week_id", week_id).execute()
