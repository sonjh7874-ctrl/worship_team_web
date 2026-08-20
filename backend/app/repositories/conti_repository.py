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
    # 공개 목록/최신 조회는 검수·확정된(published) 콘티만 노출한다. draft는 아직 확정 전이라
    # (직접 입력한 초안이든, Phase 6의 AI 추출 결과든) 팀 전체에 보이면 안 된다.
    # 상세 조회(find_by_id)는 필터하지 않아 작성자가 편집 화면에서 자기 초안을 계속 볼 수 있다.
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, service_date, title, status")
        .eq("status", "published")
        .order("service_date", desc=True)
        .execute()
    )
    return res.data


def find_latest() -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, service_date, title, status")
        .eq("status", "published")
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


def create(service_date: date, title: str, status: str = "published") -> dict:
    # 기본값이 published인 이유는 수동 생성이 이미 사람이 검수한 입력이기 때문(API명세 1-1).
    # AI 인식 흐름(Phase 6)만 draft로 만들어 검수 전까지 목록/최신 조회에서 숨긴다.
    res = (
        get_supabase()
        .table(TABLE)
        .insert({"service_date": service_date.isoformat(), "title": title, "status": status})
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
