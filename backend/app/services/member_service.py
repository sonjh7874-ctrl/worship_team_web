from fastapi import HTTPException

from app.repositories import member_repository, schedule_repository
from app.schemas.member import Member, MemberCreate, MemberUpdate


def list_members(team: str | None, active: bool | None) -> list[Member]:
    return [Member(**row) for row in member_repository.find_all(team, active)]


def create_member(payload: MemberCreate) -> Member:
    birth_date = payload.birth_date.isoformat() if payload.birth_date else None
    row = member_repository.create(payload.name, payload.team, payload.is_active, payload.gender, birth_date)
    return Member(**row)


def update_member(member_id: int, payload: MemberUpdate) -> Member:
    # exclude_unset으로 요청에 포함된 필드만 갱신하는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("birth_date") is not None:
        fields["birth_date"] = fields["birth_date"].isoformat()
    row = member_repository.update(member_id, fields) if fields else member_repository.find_by_id(member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
    return Member(**row)


def delete_member(member_id: int) -> None:
    member = member_repository.find_by_id(member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")

    # 삭제로 배정 행의 member_id가 NULL이 되기 전에 이름을 name_snapshot으로 남겨,
    # 과거 스케줄 기록에서 이름이 사라지지 않게 한다 (ERD 3-3).
    schedule_repository.backfill_assignment_names(member_id, member["name"])
    member_repository.delete(member_id)
