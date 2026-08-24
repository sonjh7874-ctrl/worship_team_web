"""생일 자동 캘린더 동기화(app/services/calendar_service.py)의 순수 로직 + 조립 로직 테스트
(Phase 12 후속, ERD 3-12).

_birthday_event_date는 DB 접근이 없는 순수 함수라 그대로 검증하고, _sync_birthday_events는
Phase 11-A test_schedule_service_suggestions.py와 같은 monkeypatch 패턴으로 리포지토리 호출을
가짜로 대체해 실 DB 없이 검증한다.

실행: backend 디렉터리에서 `python -m pytest`
"""

from datetime import date

import pytest
from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.services import calendar_service


def test_birthday_event_date_uses_requested_year():
    assert calendar_service._birthday_event_date(date(1999, 3, 21), 2026) == date(2026, 3, 21)


def test_birthday_event_date_leap_day_falls_back_to_feb_28_in_non_leap_year():
    # 2/29생이 평년(2026)과 겹치면 2/28로 보정한다.
    assert calendar_service._birthday_event_date(date(2000, 2, 29), 2026) == date(2026, 2, 28)


def test_birthday_event_date_leap_day_kept_in_leap_year():
    assert calendar_service._birthday_event_date(date(2000, 2, 29), 2028) == date(2028, 2, 29)


def test_guard_manual_only_blocks_both_auto_types_but_allows_manual():
    with pytest.raises(HTTPException) as exc:
        calendar_service._guard_manual_only({"source_type": "auto_from_schedule"})
    assert exc.value.status_code == 403
    assert "공지사항" in exc.value.detail

    with pytest.raises(HTTPException) as exc:
        calendar_service._guard_manual_only({"source_type": "auto_birthday"})
    assert exc.value.status_code == 403
    assert "인명부" in exc.value.detail

    calendar_service._guard_manual_only({"source_type": "manual"})  # 예외 없이 통과해야 한다


def test_sync_creates_event_for_active_member_with_matching_birth_month(monkeypatch):
    monkeypatch.setattr(
        calendar_service.member_repository,
        "find_all",
        lambda active=None: [{"id": 1, "name": "정승주", "birth_date": "1999-03-21", "is_active": True}],
    )
    monkeypatch.setattr(calendar_service.calendar_repository, "find_birthday_events_by_month", lambda y, m: [])

    created = {}

    def fake_create_event(fields):
        created.update(fields)
        return {"id": 100, **fields}

    monkeypatch.setattr(calendar_service.calendar_repository, "create_event", fake_create_event)

    calendar_service._sync_birthday_events(2026, 3)

    assert created["source_member_id"] == 1
    assert created["start_date"] == "2026-03-21"
    assert created["category"] == "생일"
    assert created["source_type"] == "auto_birthday"


def test_sync_skips_member_with_no_birth_date(monkeypatch):
    monkeypatch.setattr(
        calendar_service.member_repository,
        "find_all",
        lambda active=None: [{"id": 1, "name": "정승주", "birth_date": None, "is_active": True}],
    )
    monkeypatch.setattr(calendar_service.calendar_repository, "find_birthday_events_by_month", lambda y, m: [])

    def _fail(*a, **k):
        raise AssertionError("생년월일 없는 멤버는 이벤트를 만들면 안 된다")

    monkeypatch.setattr(calendar_service.calendar_repository, "create_event", _fail)

    calendar_service._sync_birthday_events(2026, 3)  # 예외 없이 조용히 넘어가야 한다


def test_sync_deletes_stale_event_for_member_no_longer_matching(monkeypatch):
    # 퇴사했거나 생년월일이 바뀌어 더 이상 대상이 아닌 멤버의 기존 자동 생일 이벤트는 지운다.
    monkeypatch.setattr(calendar_service.member_repository, "find_all", lambda active=None: [])
    monkeypatch.setattr(
        calendar_service.calendar_repository,
        "find_birthday_events_by_month",
        lambda y, m: [{"id": 55, "start_date": "2026-03-21", "title": "정승주님 생일", "source_member_id": 1}],
    )
    deleted_ids = []
    monkeypatch.setattr(
        calendar_service.calendar_repository, "delete_event", lambda event_id: deleted_ids.append(event_id)
    )

    calendar_service._sync_birthday_events(2026, 3)

    assert deleted_ids == [55]


def test_sync_swallows_duplicate_insert_race_condition(monkeypatch):
    # 동시 요청이 먼저 같은 생일 이벤트를 만들어 uq_event_source_member_date 위반(23505)이 나면
    # 조용히 넘어가야 한다 — 이번 요청이 500/409로 실패할 이유가 없다(다음 조회에서 정상적으로 잡힘).
    monkeypatch.setattr(
        calendar_service.member_repository,
        "find_all",
        lambda active=None: [{"id": 1, "name": "정승주", "birth_date": "1999-03-21", "is_active": True}],
    )
    monkeypatch.setattr(calendar_service.calendar_repository, "find_birthday_events_by_month", lambda y, m: [])

    def fake_create_event(fields):
        raise APIError({"code": "23505", "message": "duplicate key", "details": None, "hint": None})

    monkeypatch.setattr(calendar_service.calendar_repository, "create_event", fake_create_event)

    calendar_service._sync_birthday_events(2026, 3)  # 예외가 새어나가면 안 된다


def test_sync_reraises_non_duplicate_db_errors(monkeypatch):
    monkeypatch.setattr(
        calendar_service.member_repository,
        "find_all",
        lambda active=None: [{"id": 1, "name": "정승주", "birth_date": "1999-03-21", "is_active": True}],
    )
    monkeypatch.setattr(calendar_service.calendar_repository, "find_birthday_events_by_month", lambda y, m: [])

    def fake_create_event(fields):
        raise APIError({"code": "23503", "message": "fk violation", "details": None, "hint": None})

    monkeypatch.setattr(calendar_service.calendar_repository, "create_event", fake_create_event)

    with pytest.raises(APIError):
        calendar_service._sync_birthday_events(2026, 3)
