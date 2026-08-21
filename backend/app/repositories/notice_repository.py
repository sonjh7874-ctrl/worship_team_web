from app.supabase_client import get_supabase

TABLE = "notices"

LIST_SELECT = "id, title, is_pinned, created_at, updated_at, notice_comments(count)"
DETAIL_SELECT = "id, title, content, is_pinned, created_at, updated_at, notice_comments(count)"


def find_all() -> list[dict]:
    # 고정글을 항상 위로 올리고, 그 안에서는 최신순으로 정렬한다 (API명세 2-1).
    res = (
        get_supabase()
        .table(TABLE)
        .select(LIST_SELECT)
        .order("is_pinned", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def find_by_id(notice_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select(DETAIL_SELECT)
        .eq("id", notice_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create(title: str, content: str | None, is_pinned: bool) -> dict:
    res = (
        get_supabase()
        .table(TABLE)
        .insert({"title": title, "content": content, "is_pinned": is_pinned})
        .execute()
    )
    return res.data[0]


def update(notice_id: int, fields: dict) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update(fields)
        .eq("id", notice_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete(notice_id: int) -> bool:
    res = get_supabase().table(TABLE).delete().eq("id", notice_id).execute()
    return bool(res.data)
