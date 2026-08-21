from app.supabase_client import get_supabase

TABLE = "account_events"
COLUMNS = "id, event_type, old_value, new_value, changed_by_name, created_at"


def create(
    user_id: str,
    event_type: str,
    old_value: str | None,
    new_value: str | None,
    changed_by: str | None,
    changed_by_name: str,
) -> None:
    get_supabase().table(TABLE).insert(
        {
            "user_id": user_id,
            "event_type": event_type,
            "old_value": old_value,
            "new_value": new_value,
            "changed_by": changed_by,
            "changed_by_name": changed_by_name,
        }
    ).execute()


def find_by_user(user_id: str) -> list[dict]:
    res = (
        get_supabase()
        .table(TABLE)
        .select(COLUMNS)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data
