from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.schemas.member import Member, MemberCreate, MemberUpdate
from app.services import member_service

router = APIRouter(prefix="/api/v1/members", tags=["members"])


@router.get(
    "",
    response_model=list[Member],
    dependencies=[Depends(require_role("member"))],
)
def list_members(team: str | None = None, active: bool | None = None):
    return member_service.list_members(team, active)


@router.post(
    "",
    response_model=Member,
    status_code=201,
    dependencies=[Depends(require_role("leader"))],
)
def create_member(payload: MemberCreate):
    return member_service.create_member(payload)


@router.patch(
    "/{member_id}",
    response_model=Member,
    dependencies=[Depends(require_role("leader"))],
)
def update_member(member_id: int, payload: MemberUpdate):
    return member_service.update_member(member_id, payload)


@router.delete(
    "/{member_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_member(member_id: int):
    member_service.delete_member(member_id)
