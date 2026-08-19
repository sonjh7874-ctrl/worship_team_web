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


def get_signed_url(storage_path: str) -> str | None:
    # 버킷이 Private이므로 조회할 때마다 만료 시간이 있는 서명 URL을 새로 발급한다(1시간).
    res = get_supabase().storage.from_(BUCKET).create_signed_url(
        storage_path, SIGNED_URL_EXPIRES_IN
    )
    return res.get("signedURL")
