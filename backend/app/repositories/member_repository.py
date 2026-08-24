from app.supabase_client import get_supabase

TABLE = "members"


def find_all(team: str | None = None, active: bool | None = None) -> list[dict]:
    query = get_supabase().table(TABLE).select("id, name, team, is_active, gender, birth_date")
    # 스케줄 배정 드롭다운에서 팀/활동여부로 좁혀 쓰므로 두 필터를 선택적으로 적용한다.
    if team:
        query = query.eq("team", team)
    if active is not None:
        query = query.eq("is_active", active)
    res = query.order("name").execute()
    return res.data


def find_by_id(member_id: int) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .select("id, name, team, is_active, gender, birth_date")
        .eq("id", member_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def create(name: str, team: str, is_active: bool, gender: str, birth_date: str | None) -> dict:
    res = (
        get_supabase()
        .table(TABLE)
        .insert(
            {
                "name": name,
                "team": team,
                "is_active": is_active,
                "gender": gender,
                "birth_date": birth_date,
            }
        )
        .execute()
    )
    return res.data[0]


def update(member_id: int, fields: dict) -> dict | None:
    res = (
        get_supabase()
        .table(TABLE)
        .update(fields)
        .eq("id", member_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete(member_id: int) -> bool:
    res = get_supabase().table(TABLE).delete().eq("id", member_id).execute()
    return bool(res.data)
