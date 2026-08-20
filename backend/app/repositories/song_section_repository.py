from app.supabase_client import get_supabase

TABLE = "song_sections"


def find_by_song_id(song_id: int) -> list[dict]:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, section_code, lyrics, display_order")
        .eq("song_id", song_id)
        .order("display_order")
        .execute()
    )
    return res.data


def find_by_song_ids(song_ids: list[int]) -> dict[int, list[dict]]:
    """콘티 자막 조합용 일괄 조회. song_id별로 그룹핑해 반환한다 — 곡마다 따로 조회하면 N+1이 된다."""
    if not song_ids:
        return {}
    rows = (
        get_supabase()
        .table(TABLE)
        .select("song_id, section_code, lyrics, display_order")
        .in_("song_id", song_ids)
        .order("display_order")
        .execute()
        .data
    )
    grouped: dict[int, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["song_id"], []).append(row)
    return grouped


def replace_sections(song_id: int, rows: list[dict]) -> None:
    # PUT은 전체 교체 방식 — conti_songs/schedule_assignments와 동일한 delete-then-insert 패턴.
    supabase = get_supabase()
    supabase.table(TABLE).delete().eq("song_id", song_id).execute()
    if rows:
        supabase.table(TABLE).insert(rows).execute()
