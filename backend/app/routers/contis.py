from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.dependencies import verify_edit_password
from app.schemas.conti import (
    AiParseResult,
    ContiCreate,
    ContiDetail,
    ContiListItem,
    ContiSongsPutRequest,
    ContiUpdate,
    SheetFileItem,
)
from app.services import ai_parse_service, conti_service

router = APIRouter(prefix="/api/v1/contis", tags=["contis"])


@router.get("", response_model=list[ContiListItem])
def list_contis():
    return conti_service.list_contis()


@router.get("/latest", response_model=ContiDetail)
def get_latest_conti():
    return conti_service.get_latest_conti()


# 주의: 경로 변수 라우트(`/{conti_id}`)보다 반드시 위에 선언해야 한다.
# 아래에 두면 "ai-parse"가 conti_id 값으로 잡혀 422가 난다(`/latest`와 동일한 이유).
@router.post(
    "/ai-parse",
    response_model=AiParseResult,
    dependencies=[Depends(verify_edit_password)],
)
async def ai_parse_conti(image: UploadFile = File(...)):
    """콘티 이미지를 AI로 구조화한다. 결과는 DB에 저장하지 않고 검수 화면으로 그대로 반환한다."""
    return await ai_parse_service.parse_conti_image(image)


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


@router.post(
    "/{conti_id}/files",
    response_model=SheetFileItem,
    status_code=201,
    dependencies=[Depends(verify_edit_password)],
)
async def upload_sheet_file(
    conti_id: int,
    file_type: str = Form(...),
    file: UploadFile = File(...),
    # 같은 종류의 기존 파일을 교체할지 여부. AI 인식 흐름만 true로 보낸다(원본 이미지 중복 누적 방지).
    replace: bool = Form(False),
):
    return await conti_service.upload_sheet_file(conti_id, file_type, file, replace)
