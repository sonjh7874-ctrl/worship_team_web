from app.supabase_client import get_supabase

TABLE = "songs"


def find_all(q: str | None = None) -> list[dict]:
    query = get_supabase().table(TABLE).select("id, title, artist, default_key")
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


def update(song_id: int, fields: dict) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update(fields)
        .eq("id", song_id)
        .execute()
    )
    return res.data[0] if res.data else None
