import uuid

from app.supabase_client import get_supabase

TABLE = "sheet_files"
BUCKET = "sheet-files"
SIGNED_URL_EXPIRES_IN = 3600


def create(
    conti_id: int, file_type: str, file_name: str, content: bytes, content_type: str | None
) -> dict:
    storage_path = f"{conti_id}/{uuid.uuid4()}_{file_name}"
    get_supabase().storage.from_(BUCKET).upload(
        storage_path,
        content,
        {"content-type": content_type or "application/octet-stream"},
    )
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
    get_supabase().storage.from_(BUCKET).remove([row["storage_path"]])
    get_supabase().table(TABLE).delete().eq("id", file_id).execute()
    return True


def get_signed_url(storage_path: str) -> str | None:
    res = get_supabase().storage.from_(BUCKET).create_signed_url(
        storage_path, SIGNED_URL_EXPIRES_IN
    )
    return res.get("signedURL")
