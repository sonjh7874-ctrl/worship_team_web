import uuid

from app.supabase_client import get_supabase

TABLE = "sheet_files"
BUCKET = "sheet-files"
SIGNED_URL_EXPIRES_IN = 3600


def create(
    conti_id: int, file_type: str, file_name: str, content: bytes, content_type: str | None
) -> dict:
    # 콘티별 폴더 + uuid 접두사로 경로를 만들어, 같은 파일명을 여러 번 올려도 덮어쓰지 않게 한다.
    storage_path = f"{conti_id}/{uuid.uuid4()}_{file_name}"
    # 1) Supabase Storage(sheet-files 버킷)에 실제 파일 업로드
    get_supabase().storage.from_(BUCKET).upload(
        storage_path,
        content,
        {"content-type": content_type or "application/octet-stream"},
    )
    # 2) 업로드 성공 후에만 DB에 메타데이터(경로) 기록 — 두 단계가 순서대로 이어져야 한다.
    res = (
        get_supabase()
        .table(TABLE)
        .insert(
            {
                "conti_id": conti_id,
                "file_type": file_type,
                "storage_path": storage_path,
                "file_name": file_name,
            }
        )
        .execute()
    )
    return res.data[0]


def find_by_id(file_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, conti_id, file_type, file_name, storage_path")
        .eq("id", file_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def delete(file_id: int) -> bool:
    row = find_by_id(file_id)
    if row is None:
        return False
    # Storage 객체와 DB row를 둘 다 지워야 고아 파일이 버킷에 남지 않는다.
    get_supabase().storage.from_(BUCKET).remove([row["storage_path"]])
    get_supabase().table(TABLE).delete().eq("id", file_id).execute()
    return True


def delete_by_conti(conti_id: int) -> int:
    """콘티에 딸린 파일을 Storage에서 모두 지운다.

    DB의 sheet_files 행은 콘티 삭제 시 FK CASCADE로 함께 지워지지만, Storage 객체는 DB 제약이
    닿지 않아 그대로 남는다. 콘티를 지우기 직전에 이 함수로 실제 파일부터 정리해야
    버킷에 고아 파일이 쌓이지 않는다(무료 티어 용량 보호).
    """
    rows = (
        get_supabase()
        .table(TABLE)
        .select("storage_path")
        .eq("conti_id", conti_id)
        .execute()
        .data
    )
    paths = [r["storage_path"] for r in rows]
    if paths:
        get_supabase().storage.from_(BUCKET).remove(paths)
    return len(paths)


def delete_by_conti_and_type(conti_id: int, file_type: str) -> int:
    """같은 종류의 기존 파일을 Storage와 DB에서 모두 지운다(교체 업로드용).

    AI 인식을 다시 돌릴 때마다 같은 콘티 원본 이미지가 한 장씩 쌓이는 것을 막는다.
    """
    rows = (
        get_supabase()
        .table(TABLE)
        .select("id, storage_path")
        .eq("conti_id", conti_id)
        .eq("file_type", file_type)
        .execute()
        .data
    )
    if not rows:
        return 0
    get_supabase().storage.from_(BUCKET).remove([r["storage_path"] for r in rows])
    for row in rows:
        get_supabase().table(TABLE).delete().eq("id", row["id"]).execute()
    return len(rows)


def get_signed_url(storage_path: str) -> str | None:
    # 버킷이 Private이므로 조회할 때마다 만료 시간이 있는 서명 URL을 새로 발급한다(1시간).
    res = get_supabase().storage.from_(BUCKET).create_signed_url(
        storage_path, SIGNED_URL_EXPIRES_IN
    )
    return res.get("signedURL")
