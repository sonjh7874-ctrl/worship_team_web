from fastapi import APIRouter, Depends

from app.dependencies import verify_edit_password
from app.schemas.conti import (
    ContiCreate,
    ContiDetail,
    ContiListItem,
    ContiSongsPutRequest,
    ContiUpdate,
)
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


@router.patch(
    "/{conti_id}",
    response_model=ContiListItem,
    dependencies=[Depends(verify_edit_password)],
)
def update_conti(conti_id: int, payload: ContiUpdate):
    return conti_service.update_conti(conti_id, payload)


@router.delete(
    "/{conti_id}",
    status_code=204,
    dependencies=[Depends(verify_edit_password)],
)
def delete_conti(conti_id: int):
    conti_service.delete_conti(conti_id)


@router.put(
    "/{conti_id}/songs",
    response_model=ContiDetail,
    dependencies=[Depends(verify_edit_password)],
)
def put_conti_songs(conti_id: int, payload: ContiSongsPutRequest):
    return conti_service.put_conti_songs(conti_id, payload)


@router.delete(
    "/{conti_id}/songs/{order_no}",
    status_code=204,
    dependencies=[Depends(verify_edit_password)],
)
def delete_conti_song(conti_id: int, order_no: int):
    conti_service.delete_conti_song(conti_id, order_no)
