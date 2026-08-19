from app.supabase_client import get_supabase

SCHEDULE_TABLE = "monthly_schedules"
WEEK_TABLE = "schedule_weeks"

# 월 스케줄 조회 시 주차(schedule_weeks)까지 중첩 select로 한 번에 가져온다 (콘티-곡 패턴과 동일).
DETAIL_SELECT = (
    "id, year, month, memo,"
    "schedule_weeks(id, week_label, service_date, remark, absence_note,"
    " special_title, special_date, special_memo)"
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
