from fastapi import HTTPException

from app.repositories import comment_repository
from app.schemas.auth import UserProfile
from app.schemas.comment import CommentItem

_LEADER_OR_ABOVE = {"leader", "admin"}
# 도배성 장문 게시를 막는 최소한의 상한. 채팅 메시지 정도 길이를 기준으로 넉넉히 잡았다.
MAX_CONTENT_LENGTH = 1000


def _validate_content(content: str) -> str:
    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="내용을 입력해주세요.")
    if len(content) > MAX_CONTENT_LENGTH:
        raise HTTPException(status_code=400, detail=f"댓글은 {MAX_CONTENT_LENGTH}자를 넘을 수 없습니다.")
    return content


def compute_permissions(comment_user_id: str | None, current_user: UserProfile | None) -> tuple[bool, bool]:
    """댓글 하나에 대한 (can_edit, can_delete)를 판정하는 순수 함수.

    수정은 본인만, 삭제는 본인 또는 leader 이상 — 둘 다 역할 게이트(require_role)만으로는
    표현할 수 없는 "리소스 소유권 비교"라 서비스 레이어에서 계산한다(README 확정 사항).
    """
    if current_user is None:
        return False, False
    is_owner = comment_user_id == current_user.id
    can_edit = is_owner
    can_delete = is_owner or current_user.role in _LEADER_OR_ABOVE
    return can_edit, can_delete


def _to_item(row: dict, current_user: UserProfile | None) -> CommentItem:
    can_edit, can_delete = compute_permissions(row["user_id"], current_user)
    return CommentItem(
        id=row["id"],
        author_name=row["author_name"],
        content=row["content"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        is_edited=row["updated_at"] != row["created_at"],
        can_edit=can_edit,
        can_delete=can_delete,
    )


def list_comments(
    table: str, fk_column: str, parent_id: int, current_user: UserProfile | None
) -> list[CommentItem]:
    rows = comment_repository.find_by_parent(table, fk_column, parent_id)
    return [_to_item(row, current_user) for row in rows]


def create_comment(
    table: str, fk_column: str, parent_id: int, current_user: UserProfile, content: str
) -> CommentItem:
    content = _validate_content(content)
    row = comment_repository.create(table, fk_column, parent_id, current_user.id, current_user.display_name, content)
    return _to_item(row, current_user)


def _find_owned_comment(table: str, fk_column: str, parent_id: int, comment_id: int) -> dict:
    # comment_id만으로 조회하면 URL의 parent_id(notice_id/event_id)가 실제 소속과 다른 값이어도
    # 조용히 통과해버리는 정합성 버그가 있었다 — fk_column 값까지 함께 확인해 404로 막는다.
    existing = comment_repository.find_by_id(table, comment_id)
    if existing is None or existing.get(fk_column) != parent_id:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    return existing


def update_comment(
    table: str, fk_column: str, parent_id: int, comment_id: int, current_user: UserProfile, content: str
) -> CommentItem:
    existing = _find_owned_comment(table, fk_column, parent_id, comment_id)
    if existing["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="본인 댓글만 수정할 수 있습니다.")

    content = _validate_content(content)
    if existing["content"] == content:
        # 내용이 실제로 바뀌지 않았으면 UPDATE 자체를 건너뛴다 — 그냥 실행하면 트리거가
        # updated_at을 무조건 갱신해 "(수정됨)"이 잘못 표시되는 문제가 있었다.
        return _to_item(existing, current_user)

    row = comment_repository.update_content(table, comment_id, content)
    return _to_item(row, current_user)


def delete_comment(table: str, fk_column: str, parent_id: int, comment_id: int, current_user: UserProfile) -> None:
    existing = _find_owned_comment(table, fk_column, parent_id, comment_id)

    is_owner = existing["user_id"] == current_user.id
    if not is_owner and current_user.role not in _LEADER_OR_ABOVE:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

    comment_repository.delete(table, comment_id)
