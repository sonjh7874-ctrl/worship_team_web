from fastapi import APIRouter, Depends

from app.dependencies import verify_edit_password
from app.schemas.member import Member, MemberCreate, MemberUpdate
from app.services import member_service

router = APIRouter(prefix="/api/v1/members", tags=["members"])


@router.get("", response_model=list[Member])
def list_members(team: str | None = None, active: bool | None = None):
    return member_service.list_members(team, active)


@router.post(
    "",
    response_model=Member,
    status_code=201,
    dependencies=[Depends(verify_edit_password)],
)
def create_member(payload: MemberCreate):
    return member_service.create_member(payload)


@router.patch(
    "/{member_id}",
    response_model=Member,
    dependencies=[Depends(verify_edit_password)],
)
def update_member(member_id: int, payload: MemberUpdate):
    return member_service.update_member(member_id, payload)


@router.delete(
    "/{member_id}",
    status_code=204,
    dependencies=[Depends(verify_edit_password)],
)
def delete_member(member_id: int):
    member_service.delete_member(member_id)
