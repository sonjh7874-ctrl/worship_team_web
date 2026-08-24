"""schedule_service.get_week_suggestions 조립 로직 테스트 (Phase 12).

알고리즘 자체(build_singer_suggestions)는 test_singer_suggestion.py에서 이미 순수 함수로
검증했으므로, 여기서는 조립 함수가 리포지토리/서비스 호출 결과를 올바르게 엮는지만
monkeypatch로 확인한다 — 실제 Supabase 접속 없이 pytest만으로 돈다.

실행: backend 디렉터리에서 `python -m pytest`
"""

from datetime import date

import pytest
from fastapi import HTTPException

from app.schemas.availability import AvailabilityResponse, AvailabilitySubmissionItem
from app.services import schedule_service

SCHEDULE_ROW = {"id": 10, "year": 2026, "month": 8, "memo": None}


def _week_row(schedule_id: int = 10, week_id: int = 9, service_date: str = "2026-08-02") -> dict:
    return {
        "id": week_id,
        "schedule_id": schedule_id,
        "week_label": "01-02",
        "service_date": service_date,
        "remark": None,
        "absence_note": None,
        "special_title": None,
        "special_date": None,
        "special_memo": None,
        "schedule_assignments": [],
    }


def test_missing_schedule_returns_404(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_by_id", lambda sid: None)

    with pytest.raises(HTTPException) as exc:
        schedule_service.get_week_suggestions(999, 1)
    assert exc.value.status_code == 404


def test_week_not_found_returns_404(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_by_id", lambda sid: SCHEDULE_ROW)
    monkeypatch.setattr(schedule_service.schedule_repository, "find_week_with_assignments", lambda wid: None)

    with pytest.raises(HTTPException) as exc:
        schedule_service.get_week_suggestions(10, 999)
    assert exc.value.status_code == 404


def test_week_belonging_to_other_schedule_returns_404(monkeypatch):
    # week_id는 존재하지만 다른 스케줄(schedule_id=11) 소속이면 URL의 schedule_id(10)와
    # 불일치하므로 404여야 한다 — Phase 10 댓글 부모 검증과 같은 정합성 규칙.
    monkeypatch.setattr(schedule_service.schedule_repository, "find_by_id", lambda sid: SCHEDULE_ROW)
    monkeypatch.setattr(
        schedule_service.schedule_repository,
        "find_week_with_assignments",
        lambda wid: _week_row(schedule_id=11),
    )

    with pytest.raises(HTTPException) as exc:
        schedule_service.get_week_suggestions(10, 9)
    assert exc.value.status_code == 404


def test_no_availability_submissions_returns_unavailable_flag_without_further_lookup(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_by_id", lambda sid: SCHEDULE_ROW)
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_with_assignments", lambda wid: _week_row()
    )
    monkeypatch.setattr(
        schedule_service.availability_service,
        "get_availability",
        lambda year, month, team: AvailabilityResponse(year=year, month=month, team=team, submissions=[]),
    )

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("참/불참 제출이 없으면 인명부/배정 횟수 조회를 하면 안 된다")

    monkeypatch.setattr(schedule_service.member_repository, "find_all", _fail_if_called)

    result = schedule_service.get_week_suggestions(10, 9)
    assert result.has_availability is False
    assert result.mic == []
    assert result.choir == []
    assert result.service_date == date(2026, 8, 2)


def test_happy_path_fills_empty_mic_slot_from_available_low_count_member(monkeypatch):
    monkeypatch.setattr(schedule_service.schedule_repository, "find_by_id", lambda sid: SCHEDULE_ROW)
    monkeypatch.setattr(
        schedule_service.schedule_repository, "find_week_with_assignments", lambda wid: _week_row()
    )
    submissions = [
        AvailabilitySubmissionItem(
            id=1, member_id=21, name="정승주", default_status="available", raw_text="dummy", entries=[]
        )
    ]
    monkeypatch.setattr(
        schedule_service.availability_service,
        "get_availability",
        lambda year, month, team: AvailabilityResponse(
            year=year, month=month, team=team, submissions=submissions
        ),
    )
    monkeypatch.setattr(
        schedule_service.member_repository,
        "find_all",
        lambda team=None, active=None: [{"id": 21, "name": "정승주", "team": "singer", "is_active": True}],
    )
    monkeypatch.setattr(schedule_service.schedule_repository, "find_mic_assignments_by_year", lambda year: [])

    result = schedule_service.get_week_suggestions(10, 9)
    assert result.has_availability is True
    assert len(result.mic) == 1
    assert result.mic[0].name == "정승주"
    assert result.mic[0].slot == 1  # 빈 슬롯 중 번호가 가장 낮은 자리부터 채운다.
    assert result.choir == []
