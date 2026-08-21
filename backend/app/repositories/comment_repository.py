from app.supabase_client import get_supabase

COLUMNS = "id, user_id, author_name, content, created_at, updated_at"

# notice_comments/calendar_event_comments는 구조가 동일하므로(FK 컬럼명만 다름)
# 테이블명을 인자로 받는 공용 함수로 구현한다 — DB는 여전히 구체적 FK를 가진 테이블 2개로
# 분리돼 있고(이 프로젝트의 범용 다형성 테이블 회피 관례), 코드만 공유한다.


def find_by_parent(table: str, fk_column: str, parent_id: int) -> list[dict]:
    res = (
        get_supabase()
        .table(table)
        .select(COLUMNS)
        .eq(fk_column, parent_id)
        .order("created_at")
        .execute()
    )
    return res.data


def find_by_id(table: str, comment_id: int) -> dict | None:
    # "*"로 조회해 FK 컬럼(notice_id/event_id)까지 함께 받는다 — 수정/삭제 시
    # URL의 parent_id와 실제 소속이 일치하는지 검증하는 데 필요하다(comment_service 참고).
    res = (
        get_supabase()
        .table(table)
        .select("*")
        .eq("id", comment_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create(table: str, fk_column: str, parent_id: int, user_id: str, author_name: str, content: str) -> dict:
    res = (
        get_supabase()
        .table(table)
        .insert({fk_column: parent_id, "user_id": user_id, "author_name": author_name, "content": content})
        .execute()
    )
    return res.data[0]


def update_content(table: str, comment_id: int, content: str) -> dict | None:
    res = (
        get_supabase()
        .table(table)
        .update({"content": content})
        .eq("id", comment_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete(table: str, comment_id: int) -> None:
    get_supabase().table(table).delete().eq("id", comment_id).execute()
