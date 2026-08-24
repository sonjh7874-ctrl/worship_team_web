"""schedule_service의 update_week/delete_week/put_assignments가 URL의 schedule_id와
주차의 실제 부모가 일치하는지 검증하는지 확인한다(전체_구현_점검_보고서.md 2-2절 수정).

get_week_suggestions(Phase 12)가 이미 쓰던 부모-자식 일치 검증을 세 함수에도 동일하게
적용했는지 monkeypatch로 확인한다 — 실제 Supabase 접속 없이 pytest만으로 돈다.

실행: backend 디렉터리에서 `python -m pytest`
"""

import pytest
from fastapi import HTTPException

from app.schemas.schedule import ScheduleAssignmentsPutRequest, ScheduleWeekUpdate
from app.services import schedule_service


def _week_row(schedule_id: int = 10, week_id: int = 9) -> dict:
    return {
        "id": week_id,
        "schedule_id": schedule_id,
        "week_label": "01-02",
        "service_date": "2026-08-02",
        "remark": None,
        "absence_note": None,
        "special_title": None,
        "special_date": None,
        "special_memo": None,
    }


def _week_row_with_assignments(schedule_id: int = 10, week_id: int = 9) -> dict:
    return {**_week_row(schedule_id, week_id), "schedule_assignments": []}


# ---------- update_week ----------


def test_update_week_missing_week_returns_404(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_week_by_id", lambda wid: None)

    with pytest.raises(HTTPException) as exc:
        schedule_service.update_week(10, 999, ScheduleWeekUpdate())
    assert exc.value.status_code == 404


def test_update_week_wrong_parent_returns_404_and_does_not_write(monkeypatch):
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_by_id", lambda wid: _week_row(schedule_id=11)
    )

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("부모 불일치면 업데이트를 시도하면 안 된다")

    monkeypatch.setattr(schedule_service.schedule_repository, "update_week", _fail_if_called)

    with pytest.raises(HTTPException) as exc:
        schedule_service.update_week(10, 9, ScheduleWeekUpdate(remark="test"))
    assert exc.value.status_code == 404


def test_update_week_correct_parent_succeeds(monkeypatch):
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_by_id", lambda wid: _week_row(schedule_id=10)
    )
    monkeypatch.setattr(
        schedule_service.schedule_repository,
        "update_week",
        lambda wid, fields: {**_week_row(schedule_id=10), **fields},
    )

    result = schedule_service.update_week(10, 9, ScheduleWeekUpdate(remark="수련회주간"))
    assert result.remark == "수련회주간"


# ---------- delete_week ----------


def test_delete_week_missing_week_returns_404(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_week_by_id", lambda wid: None)

    with pytest.raises(HTTPException) as exc:
        schedule_service.delete_week(10, 999)
    assert exc.value.status_code == 404


def test_delete_week_wrong_parent_returns_404_and_does_not_delete(monkeypatch):
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_by_id", lambda wid: _week_row(schedule_id=11)
    )

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("부모 불일치면 삭제를 시도하면 안 된다")

    monkeypatch.setattr(schedule_service.schedule_repository, "delete_week", _fail_if_called)

    with pytest.raises(HTTPException) as exc:
        schedule_service.delete_week(10, 9)
    assert exc.value.status_code == 404


def test_delete_week_correct_parent_succeeds(monkeypatch):
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_by_id", lambda wid: _week_row(schedule_id=10)
    )
    monkeypatch.setattr(schedule_service.schedule_repository, "delete_week", lambda wid: True)

    schedule_service.delete_week(10, 9)  # 예외 없이 통과하면 성공


# ---------- put_assignments ----------


def test_put_assignments_missing_week_returns_404(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_week_by_id", lambda wid: None)

    with pytest.raises(HTTPException) as exc:
        schedule_service.put_assignments(10, 999, ScheduleAssignmentsPutRequest(assignments=[]))
    assert exc.value.status_code == 404


def test_put_assignments_wrong_parent_returns_404_and_does_not_write(monkeypatch):
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_by_id", lambda wid: _week_row(schedule_id=11)
    )

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("부모 불일치면 배정 저장을 시도하면 안 된다")

    monkeypatch.setattr(schedule_service.schedule_repository, "replace_assignments", _fail_if_called)

    with pytest.raises(HTTPException) as exc:
        schedule_service.put_assignments(10, 9, ScheduleAssignmentsPutRequest(assignments=[]))
    assert exc.value.status_code == 404


def test_put_assignments_correct_parent_succeeds(monkeypatch):
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_by_id", lambda wid: _week_row(schedule_id=10)
    )
    monkeypatch.setattr(
        schedule_service.schedule_repository, "replace_assignments", lambda wid, rows: None
    )
    monkeypatch.setattr(
        schedule_service.schedule_repository,
        "find_week_with_assignments",
        lambda wid: _week_row_with_assignments(schedule_id=10),
    )

    result = schedule_service.put_assignments(10, 9, ScheduleAssignmentsPutRequest(assignments=[]))
    assert result.id == 9
