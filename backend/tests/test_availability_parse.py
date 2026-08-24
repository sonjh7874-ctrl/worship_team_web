"""참/불참 텍스트 파싱의 순수 로직 테스트 (Phase 11-B).

이름 정규화, 날짜(day) -> date 조합, 사람 블록 추출은 DB/네트워크가 없는 순수 함수라 pytest만으로
돈다 — Phase 9 test_lyrics_service.py, Phase 10 test_comment_service.py, Phase 11-A
test_schedule_counts.py와 같은 패턴.

실행: backend 디렉터리에서 `python -m pytest`
"""

from datetime import date

from app.services.availability_parse_service import (
    _day_entries_to_dates,
    _normalize_name,
    split_person_blocks,
)


def test_normalize_name_strips_spaces_and_ignores_case():
    assert _normalize_name("서 유진") == _normalize_name("서유진")


def test_day_entries_combine_with_year_month():
    days = [
        {"day": 1, "status": "available", "reason": None},
        {"day": 29, "status": "unavailable", "reason": "결혼식"},
        {"day": 30, "status": "available", "reason": None},
    ]
    entries = _day_entries_to_dates(days, year=2026, month=8)
    assert [e.date for e in entries] == [date(2026, 8, 1), date(2026, 8, 29), date(2026, 8, 30)]
    assert entries[1].status == "unavailable"
    assert entries[1].reason == "결혼식"


def test_day_entries_pair_split_correctly():
    # 29일 불참(결혼식), 30일 참 — 같은 페어 안에서 날짜별로 상태가 갈리는 실제 관찰 케이스.
    days = [
        {"day": 29, "status": "unavailable", "reason": "결혼식"},
        {"day": 30, "status": "available", "reason": None},
    ]
    entries = _day_entries_to_dates(days, year=2026, month=8)
    assert entries[0].status == "unavailable"
    assert entries[1].status == "available"


def test_day_entries_skip_invalid_day():
    days = [{"day": 35, "status": "available", "reason": None}]
    assert _day_entries_to_dates(days, year=2026, month=8) == []


def test_day_entries_skip_malformed_items():
    days = [{"day": "이상함", "status": "available"}, {"day": 1, "status": "모름"}]
    assert _day_entries_to_dates(days, year=2026, month=8) == []


def test_split_person_blocks_handles_blank_line_after_header():
    # 헤더와 본문 사이에 빈 줄이 낀 실제 사례(송지오) — 빈 줄 개수로 나누면 본문이
    # 통째로 잘리는 버그가 있었다(실사용 검증에서 발견, 이 테스트로 회귀 방지).
    text = (
        "8월 섬김 일정 (서유진)\n1,2일 참\n\n"
        "8월 섬김 일정 (송지오)\n\n전참/ 특새 참"
    )
    blocks = split_person_blocks(text, ["서유진", "송지오"])
    assert "전참" in blocks["송지오"]
    assert "서유진" not in blocks["송지오"]
    assert "1,2일 참" in blocks["서유진"]
    assert "송지오" not in blocks["서유진"]


def test_split_person_blocks_last_person_reaches_end_of_text():
    text = "8월 섬김 일정 (서유진)\n1,2일 참\n\n8월 섬김 일정 (송지오)\n\n전참/ 특새 참\n\n특새 참"
    blocks = split_person_blocks(text, ["서유진", "송지오"])
    assert "특새 참" in blocks["송지오"]
