from datetime import date

from app.supabase_client import get_supabase

TABLE = "contis"

# 콘티 상세 조회 시 곡 배치(conti_songs)와 그 안의 곡 마스터(songs), 첨부 파일(sheet_files)까지
# Supabase의 중첩 select 구문으로 한 번에 조인해 가져온다. 라운드트립을 줄이기 위함.
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
    # PUT은 "전체 교체" 방식(API명세 1-3)이라 기존 배치를 모두 지우고 새로 넣는다.
    # 순서 변경·곡 삭제·신규 곡 추가를 모두 하나의 흐름으로 처리할 수 있어 부분 갱신보다 단순하다.
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
