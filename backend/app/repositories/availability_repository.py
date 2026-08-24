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


def find_by_year_month_team(year: int, month: int, team: str) -> list[dict]:
    # 팀 단위로 조회 범위를 좁힌다 — 싱어팀장·악기팀장이 각자 자기 팀 데이터만 보고 관리하므로,
    # 다른 팀 제출은 애초에 응답에 섞이지 않는다.
    res = (
        get_supabase()
        .table(SUBMISSION_TABLE)
        .select(DETAIL_SELECT)
        .eq("year", year)
        .eq("month", month)
        .eq("team", team)
        .execute()
    )
    return res.data or []


def delete_by_year_month_team(year: int, month: int, team: str) -> None:
    # PUT은 "그 달-그 팀 전체 교체" 방식이라, 해당 팀의 기존 제출만 모두 지우고 새로 넣는다.
    # team으로 좁히지 않으면 한 팀이 저장할 때 다른 팀 데이터까지 지워지는 사고로 이어진다
    # (실사용 피드백으로 발견 — 싱어팀장/악기팀장이 서로 다른 시점에 독립적으로 저장한다).
    # availability_entries는 submission_id가 ON DELETE CASCADE라 함께 정리된다.
    (
        get_supabase()
        .table(SUBMISSION_TABLE)
        .delete()
        .eq("year", year)
        .eq("month", month)
        .eq("team", team)
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
