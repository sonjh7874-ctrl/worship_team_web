from app.supabase_client import get_supabase

SUBMISSION_TABLE = "availability_submissions"
ENTRY_TABLE = "availability_entries"

# 제출(availability_submissions)과 그 날짜별 항목(availability_entries)을 한 번에 중첩 select로
# 가져온다. member_id가 있으면 members.name을, 없으면 name_snapshot을 서비스 레이어에서 골라 쓴다
# (ERD 3-3 COALESCE 규칙, schedule_assignments와 동일 패턴).
DETAIL_SELECT = (
    "id, member_id, name_snapshot, default_status, default_reason, raw_text,"
    " members(name), availability_entries(date, status, reason)"
)


def find_by_year_month(year: int, month: int) -> list[dict]:
    res = (
        get_supabase()
        .table(SUBMISSION_TABLE)
        .select(DETAIL_SELECT)
        .eq("year", year)
        .eq("month", month)
        .execute()
    )
    return res.data or []


def delete_by_year_month(year: int, month: int) -> None:
    # PUT은 "그 달 전체 교체" 방식(전체_로드맵.md Phase 11-B 파생 결정 9)이라, 기존 제출을 모두 지우고
    # 새로 넣는다. availability_entries는 submission_id가 ON DELETE CASCADE라 함께 정리된다.
    (
        get_supabase()
        .table(SUBMISSION_TABLE)
        .delete()
        .eq("year", year)
        .eq("month", month)
        .execute()
    )


def insert_submissions(rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    res = get_supabase().table(SUBMISSION_TABLE).insert(rows).execute()
    return res.data


def insert_entries(rows: list[dict]) -> None:
    if not rows:
        return
    get_supabase().table(ENTRY_TABLE).insert(rows).execute()
