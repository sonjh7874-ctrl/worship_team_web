from fastapi import APIRouter, Depends

from app.dependencies import verify_edit_password
from app.schemas.conti import ContiCreate, ContiDetail, ContiListItem
from app.services import conti_service

router = APIRouter(prefix="/api/v1/contis", tags=["contis"])


@router.get("", response_model=list[ContiListItem])
def list_contis():
    return conti_service.list_contis()


@router.get("/latest", response_model=ContiDetail)
def get_latest_conti():
    return conti_service.get_latest_conti()


@router.get("/{conti_id}", response_model=ContiDetail)
def get_conti(conti_id: int):
    return conti_service.get_conti(conti_id)


@router.post(
    "",
    response_model=ContiListItem,
    status_code=201,
    dependencies=[Depends(verify_edit_password)],
)
def create_conti(payload: ContiCreate):
    return conti_service.create_conti(payload)
