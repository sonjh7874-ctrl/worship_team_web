from app.supabase_client import get_supabase

TABLE = "songs"


def find_all(q: str | None = None) -> list[dict]:
    # conti_songs(count)로 이 곡이 몇 개 콘티에 배치돼 있는지 함께 가져온다 —
    # 곡 관리 화면에서 "사용 중이라 지울 수 없음"을 미리 보여주기 위함(조회 1회로 해결).
    query = get_supabase().table(TABLE).select(
        "id, title, artist, default_key, conti_songs(count)"
    )
    # q가 있으면 제목 부분 일치 검색(대소문자 무시)으로 좁힌다. 콘티 편집 화면의 곡 검색용.
    if q:
        query = query.ilike("title", f"%{q}%")
    res = query.order("title").execute()
    return res.data


def find_by_id(song_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, title, artist, default_key")
        .eq("id", song_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create(title: str, artist: str | None, default_key: str | None) -> dict:
    res = (
        get_supabase()
        .table(TABLE)
        .insert({"title": title, "artist": artist, "default_key": default_key})
        .execute()
    )
    return res.data[0]


def count_usage(song_id: int) -> int:
    """이 곡이 배치된 콘티 수. conti_songs FK가 on delete restrict라 삭제 전에 먼저 확인한다."""
    res = (
        get_supabase()
        .table("conti_songs")
        .select("id", count="exact")
        .eq("song_id", song_id)
        .execute()
    )
    return res.count or 0


def delete(song_id: int) -> bool:
    res = get_supabase().table(TABLE).delete().eq("id", song_id).execute()
    return bool(res.data)


def update(song_id: int, fields: dict) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update(fields)
        .eq("id", song_id)
        .execute()
    )
    return res.data[0] if res.data else None
