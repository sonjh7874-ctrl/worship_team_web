from app.supabase_client import get_supabase

SCHEDULE_TABLE = "monthly_schedules"
WEEK_TABLE = "schedule_weeks"
ASSIGNMENT_TABLE = "schedule_assignments"

# 배정(schedule_assignments)까지 중첩 select로 함께 가져온다. member_id가 있으면
# members.name을, 없으면 name_snapshot을 서비스 레이어에서 골라 쓴다(ERD 3-3 COALESCE 규칙).
ASSIGNMENTS_SELECT = (
    "schedule_assignments(position_code, slot_order, member_id, name_snapshot, members(name))"
)

# 월 스케줄 조회 시 주차(schedule_weeks)와 그 안의 배정까지 한 번에 조인해 가져온다
# (콘티-곡-악보 3단 중첩 select와 동일한 패턴).
DETAIL_SELECT = (
    "id, year, month, memo,"
    "schedule_weeks(id, week_label, service_date, remark, absence_note,"
    f" special_title, special_date, special_memo, {ASSIGNMENTS_SELECT})"
)

WEEK_DETAIL_SELECT = (
    "id, week_label, service_date, remark, absence_note,"
    f" special_title, special_date, special_memo, {ASSIGNMENTS_SELECT}"
)


def find_by_year_month(year: int, month: int) -> dict | None:
    res = (
        get_supabase()
        .table(SCHEDULE_TABLE)
        .select(DETAIL_SELECT)
        .eq("year", year)
        .eq("month", month)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def find_by_id(schedule_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(SCHEDULE_TABLE)
        .select("id, year, month, memo")
        .eq("id", schedule_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create_schedule(year: int, month: int, memo: str | None) -> dict:
    res = (
        get_supabase()
        .table(SCHEDULE_TABLE)
        .insert({"year": year, "month": month, "memo": memo})
        .execute()
    )
    return res.data[0]


def delete_schedule(schedule_id: int) -> bool:
    # schedule_weeks가 ON DELETE CASCADE라 주차·배정까지 함께 정리된다.
    res = get_supabase().table(SCHEDULE_TABLE).delete().eq("id", schedule_id).execute()
    return bool(res.data)


def find_week_by_id(week_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(WEEK_TABLE)
        .select(
            "id, week_label, service_date, remark, absence_note,"
            " special_title, special_date, special_memo"
        )
        .eq("id", week_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create_week(schedule_id: int, fields: dict) -> dict:
    res = (
        get_supabase()
        .table(WEEK_TABLE)
        .insert({**fields, "schedule_id": schedule_id})
        .execute()
    )
    return res.data[0]


def update_week(week_id: int, fields: dict) -> dict | None:
    res = (
        get_supabase()
        .table(WEEK_TABLE)
        .update(fields)
        .eq("id", week_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete_week(week_id: int) -> bool:
    res = get_supabase().table(WEEK_TABLE).delete().eq("id", week_id).execute()
    return bool(res.data)


def find_week_with_assignments(week_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(WEEK_TABLE)
        .select(WEEK_DETAIL_SELECT)
        .eq("id", week_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def replace_assignments(week_id: int, rows: list[dict]) -> None:
    # PUT은 "전체 교체" 방식(API명세 2-3)이라 기존 배정을 모두 지우고 새로 넣는다.
    # conti_songs의 replace_songs와 동일한 delete-then-insert 패턴.
    supabase = get_supabase()
    supabase.table(ASSIGNMENT_TABLE).delete().eq("week_id", week_id).execute()
    if rows:
        supabase.table(ASSIGNMENT_TABLE).insert(rows).execute()
