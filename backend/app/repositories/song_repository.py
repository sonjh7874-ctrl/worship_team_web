from app.supabase_client import get_supabase

TABLE = "songs"


def find_all(q: str | None = None) -> list[dict]:
    # conti_songs(count)로 이 곡이 몇 개 콘티에 배치돼 있는지 함께 가져온다 —
    # 곡 관리 화면에서 "사용 중이라 지울 수 없음"을 미리 보여주기 위함(조회 1회로 해결).
    query = get_supabase().table(TABLE).select(
        "id, title, artist, default_key, conti_songs(count), song_sections(count)"
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


def find_last_song_forms(song_ids: list[int]) -> dict[int, str]:
    """곡별로 '가장 최근 콘티에서 쓰인 송폼'을 돌려준다.

    AI 검수 화면에서 "지난번과 송폼이 다릅니다"를 보여주기 위한 값이다. 곡마다 쿼리를 날리면
    한 콘티에 6곡이면 6번이 되므로, in_ 필터로 한 번에 가져와 파이썬에서 최신 것만 고른다.
    """
    if not song_ids:
        return {}
    rows = (
        get_supabase()
        .table("conti_songs")
        .select("song_id, song_form, contis(service_date)")
        .in_("song_id", song_ids)
        .execute()
        .data
    )
    latest: dict[int, tuple[str, str]] = {}  # song_id -> (service_date, song_form)
    for row in rows:
        service_date = (row.get("contis") or {}).get("service_date") or ""
        song_form = row.get("song_form")
        if not song_form:
            continue
        current = latest.get(row["song_id"])
        if current is None or service_date > current[0]:
            latest[row["song_id"]] = (service_date, song_form)
    return {song_id: form for song_id, (_, form) in latest.items()}


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
