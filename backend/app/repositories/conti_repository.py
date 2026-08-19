from datetime import date

from app.supabase_client import get_supabase

TABLE = "contis"

DETAIL_SELECT = (
    "id, service_date, title, status,"
    "conti_songs(order_no, song_key, song_form, note, songs(id, title, artist)),"
    "sheet_files(id, file_type, file_name, storage_path)"
)


def find_all() -> list[dict]:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, service_date, title, status")
        .order("service_date", desc=True)
        .execute()
    )
    return res.data


def find_latest() -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, service_date, title, status")
        .order("service_date", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def find_by_id(conti_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select(DETAIL_SELECT)
        .eq("id", conti_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create(service_date: date, title: str) -> dict:
    res = (
        get_supabase()
        .table(TABLE)
        .insert({"service_date": service_date.isoformat(), "title": title})
        .execute()
    )
    return res.data[0]


def update(conti_id: int, fields: dict) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update(fields)
        .eq("id", conti_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete(conti_id: int) -> bool:
    res = get_supabase().table(TABLE).delete().eq("id", conti_id).execute()
    return bool(res.data)


def replace_songs(conti_id: int, rows: list[dict]) -> None:
    supabase = get_supabase()
    supabase.table("conti_songs").delete().eq("conti_id", conti_id).execute()
    if rows:
        supabase.table("conti_songs").insert(rows).execute()


def delete_song(conti_id: int, order_no: int) -> bool:
    res = (
        get_supabase()
        .table("conti_songs")
        .delete()
        .eq("conti_id", conti_id)
        .eq("order_no", order_no)
        .execute()
    )
    return bool(res.data)
