from fastapi import HTTPException

from app.repositories import member_repository
from app.schemas.member import Member, MemberCreate, MemberUpdate


def list_members(team: str | None, active: bool | None) -> list[Member]:
    return [Member(**row) for row in member_repository.find_all(team, active)]


def create_member(payload: MemberCreate) -> Member:
    row = member_repository.create(payload.name, payload.team, payload.is_active)
    return Member(**row)


def update_member(member_id: int, payload: MemberUpdate) -> Member:
    # exclude_unset으로 요청에 포함된 필드만 갱신하는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    row = member_repository.update(member_id, fields) if fields else member_repository.find_by_id(member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
    return Member(**row)


def delete_member(member_id: int) -> None:
    if not member_repository.delete(member_id):
        raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
