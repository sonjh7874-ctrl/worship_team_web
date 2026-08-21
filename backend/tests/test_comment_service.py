"""댓글 수정/삭제 권한 판정(app/services/comment_service.py의 compute_permissions)의 순수 로직 테스트 (Phase 10).

DB 접근 없는 순수 함수라 pytest만으로 돈다 — Phase 9 test_lyrics_service.py와 같은 패턴.

실행: backend 디렉터리에서 `python -m pytest`
"""

from app.schemas.auth import UserProfile
from app.services.comment_service import compute_permissions

COMMENT_AUTHOR_ID = "author-uuid"


def _user(user_id: str, role: str) -> UserProfile:
    return UserProfile(id=user_id, email=None, display_name="테스트", role=role)


def test_not_logged_in_cannot_edit_or_delete():
    can_edit, can_delete = compute_permissions(COMMENT_AUTHOR_ID, None)
    assert (can_edit, can_delete) == (False, False)


def test_author_can_edit_and_delete_own_comment():
    author = _user(COMMENT_AUTHOR_ID, "member")
    can_edit, can_delete = compute_permissions(COMMENT_AUTHOR_ID, author)
    assert (can_edit, can_delete) == (True, True)


def test_other_member_cannot_edit_or_delete():
    other = _user("other-uuid", "member")
    can_edit, can_delete = compute_permissions(COMMENT_AUTHOR_ID, other)
    assert (can_edit, can_delete) == (False, False)


def test_leader_cannot_edit_but_can_delete_others_comment():
    leader = _user("leader-uuid", "leader")
    can_edit, can_delete = compute_permissions(COMMENT_AUTHOR_ID, leader)
    assert (can_edit, can_delete) == (False, True)


def test_admin_cannot_edit_but_can_delete_others_comment():
    admin = _user("admin-uuid", "admin")
    can_edit, can_delete = compute_permissions(COMMENT_AUTHOR_ID, admin)
    assert (can_edit, can_delete) == (False, True)
