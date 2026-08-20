from fastapi import APIRouter, Depends

from app.dependencies import require_role
from app.services import conti_service

router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.delete(
    "/{file_id}",
    status_code=204,
    dependencies=[Depends(require_role("leader"))],
)
def delete_file(file_id: int):
    conti_service.delete_sheet_file(file_id)
