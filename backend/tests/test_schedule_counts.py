"""마이크 배정 횟수 집계(app/services/schedule_service.py의 aggregate_mic_counts)의 순수 로직 테스트 (Phase 11-A).

DB 접근 없는 순수 함수라 pytest만으로 돈다 — Phase 9 test_lyrics_service.py, Phase 10 test_comment_service.py와 같은 패턴.

실행: backend 디렉터리에서 `python -m pytest`
"""

from app.services.schedule_service import aggregate_mic_counts


def _row(member_id: int, name: str, month: int) -> dict:
    return {"member_id": member_id, "members": {"name": name}, "month": month}


def test_month_and_year_counts_split_correctly():
    rows = [_row(1, "정승주", 8), _row(1, "정승주", 8), _row(1, "정승주", 7)]
    result = aggregate_mic_counts(rows, month=8)
    assert len(result) == 1
    assert result[0].member_id == 1
    assert result[0].month_count == 2
    assert result[0].year_count == 3


def test_rows_without_member_id_are_excluded():
    rows = [_row(1, "정승주", 8), {"member_id": None, "members": None, "month": 8}]
    result = aggregate_mic_counts(rows, month=8)
    assert len(result) == 1
    assert result[0].member_id == 1


def test_multiple_members_accumulate_independently():
    rows = [_row(1, "정승주", 8), _row(2, "임하늘", 8), _row(1, "정승주", 6)]
    result = aggregate_mic_counts(rows, month=8)
    by_id = {c.member_id: c for c in result}
    assert by_id[1].month_count == 1
    assert by_id[1].year_count == 2
    assert by_id[2].month_count == 1
    assert by_id[2].year_count == 1


def test_no_rows_returns_empty_list():
    assert aggregate_mic_counts([], month=8) == []


def test_result_sorted_by_name():
    rows = [_row(2, "최나린", 8), _row(1, "김정은", 8)]
    result = aggregate_mic_counts(rows, month=8)
    assert [c.name for c in result] == ["김정은", "최나린"]
