from app.supabase_client import get_supabase

TABLE = "user_profiles"
COLUMNS = "id, role, display_name, member_id, force_password_change"


def find_by_id(user_id: str) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select(COLUMNS)
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create(user_id: str, display_name: str) -> dict:
    # 회원가입 직후 기본 역할(member)로 프로필을 만든다 — 승격은 admin이 별도로 수행.
    res = (
        get_supabase()
        .table(TABLE)
        .insert({"id": user_id, "display_name": display_name})
        .execute()
    )
    return res.data[0]


def find_all() -> list[dict]:
    # 관리자 화면(/admin/users)의 사용자 목록용 — 이메일은 auth.users에만 있어
    # 여기서는 role/display_name까지만 내려주고, 서비스 레이어가 이메일과 합친다.
    res = (
        get_supabase()
        .table(TABLE)
        .select(COLUMNS)
        .order("display_name")
        .execute()
    )
    return res.data


def update_role(user_id: str, role: str) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update({"role": role})
        .eq("id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None


def update_display_name(user_id: str, display_name: str) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update({"display_name": display_name})
        .eq("id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None


def set_force_password_change(user_id: str, value: bool) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update({"force_password_change": value})
        .eq("id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None
