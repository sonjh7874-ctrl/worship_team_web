"""싱어팀 자동 배정 제안(app/services/singer_suggestion_service.py)의 순수 로직 테스트 (Phase 12).

DB 접근 없는 순수 함수라 pytest만으로 돈다 — Phase 9 test_lyrics_service.py,
Phase 10 test_comment_service.py, Phase 11-A test_schedule_counts.py와 같은 패턴.

실행: backend 디렉터리에서 `python -m pytest`
"""

from datetime import date

from app.schemas.availability import AvailabilityEntry, AvailabilitySubmissionItem
from app.schemas.schedule import AssignedPerson, MicAssignmentCount
from app.services.singer_suggestion_service import build_singer_suggestions

SERVICE_DATE = date(2026, 8, 2)


def _member(member_id: int, name: str) -> dict:
    return {"id": member_id, "name": name, "team": "singer", "is_active": True}


def _submission(
    member_id: int,
    name: str,
    default_status: str | None = None,
    entries: list[AvailabilityEntry] | None = None,
) -> AvailabilitySubmissionItem:
    return AvailabilitySubmissionItem(
        id=member_id,
        member_id=member_id,
        name=name,
        default_status=default_status,
        raw_text="dummy",
        entries=entries or [],
    )


def _count(member_id: int, name: str, month: int, year: int) -> MicAssignmentCount:
    return MicAssignmentCount(member_id=member_id, name=name, month_count=month, year_count=year)


EMPTY_MIC: dict[str, AssignedPerson | None] = {str(i): None for i in range(1, 9)}


def test_sorted_by_month_then_year_then_name():
    members = [_member(1, "정승주"), _member(2, "임하늘")]
    submissions = [
        _submission(1, "정승주", default_status="available"),
        _submission(2, "임하늘", default_status="available"),
    ]
    counts = [_count(1, "정승주", month=2, year=5), _count(2, "임하늘", month=1, year=9)]

    mic, choir, skipped = build_singer_suggestions(members, submissions, counts, EMPTY_MIC, [], SERVICE_DATE)

    assert [m.name for m in mic[:2]] == ["임하늘", "정승주"]
    assert skipped.already_assigned == []
    assert skipped.unavailable == []
    assert skipped.unknown == []


def test_unavailable_member_excluded_and_reported():
    members = [_member(1, "정승주")]
    submissions = [_submission(1, "정승주", default_status="unavailable")]
    mic, choir, skipped = build_singer_suggestions(members, submissions, [], EMPTY_MIC, [], SERVICE_DATE)

    assert mic == []
    assert choir == []
    assert skipped.unavailable == ["정승주"]


def test_no_submission_is_unknown_not_unavailable():
    members = [_member(1, "정승주")]
    mic, choir, skipped = build_singer_suggestions(members, [], [], EMPTY_MIC, [], SERVICE_DATE)

    assert mic == []
    assert skipped.unknown == ["정승주"]
    assert skipped.unavailable == []


def test_entry_without_matching_date_falls_back_to_unknown():
    # 토요일(8/1)만 제출하고 주일(8/2) 항목이 없는 경우 — default_status도 없으면 불명확이다.
    members = [_member(1, "정승주")]
    submissions = [
        _submission(1, "정승주", entries=[AvailabilityEntry(date=date(2026, 8, 1), status="unavailable")])
    ]
    mic, choir, skipped = build_singer_suggestions(members, submissions, [], EMPTY_MIC, [], SERVICE_DATE)

    assert mic == []
    assert skipped.unknown == ["정승주"]


def test_entry_exact_date_overrides_default_status():
    members = [_member(1, "정승주")]
    submissions = [
        _submission(
            1,
            "정승주",
            default_status="available",
            entries=[AvailabilityEntry(date=SERVICE_DATE, status="unavailable", reason="결혼식")],
        )
    ]
    mic, choir, skipped = build_singer_suggestions(members, submissions, [], EMPTY_MIC, [], SERVICE_DATE)

    assert mic == []
    assert skipped.unavailable == ["정승주"]


def test_already_assigned_slot_and_member_are_not_overwritten_or_recommended():
    members = [_member(1, "정승주"), _member(2, "임하늘")]
    submissions = [
        _submission(1, "정승주", default_status="available"),
        _submission(2, "임하늘", default_status="available"),
    ]
    current_mic: dict[str, AssignedPerson | None] = dict(EMPTY_MIC)
    current_mic["1"] = AssignedPerson(member_id=1, name="정승주")

    mic, choir, skipped = build_singer_suggestions(members, submissions, [], current_mic, [], SERVICE_DATE)

    # 슬롯 1은 이미 채워져 있으므로 추천 목록의 slot에 1이 없어야 하고, 정승주는 후보에서 제외된다.
    assert all(m.slot != 1 for m in mic)
    assert all(m.name != "정승주" for m in mic)
    assert skipped.already_assigned == ["정승주"]
    # 남은 빈 슬롯(2~8) 중 하나에 임하늘이 채워진다.
    assert any(m.name == "임하늘" for m in mic)


def test_candidates_fewer_than_empty_slots_leave_remaining_slots_unfilled():
    members = [_member(1, "정승주")]
    submissions = [_submission(1, "정승주", default_status="available")]
    mic, choir, skipped = build_singer_suggestions(members, submissions, [], EMPTY_MIC, [], SERVICE_DATE)

    assert len(mic) == 1
    assert choir == []


def test_leftover_candidates_after_mic_slots_become_choir_suggestions():
    members = [_member(i, f"멤버{i}") for i in range(1, 10)]
    submissions = [_submission(i, f"멤버{i}", default_status="available") for i in range(1, 10)]
    mic, choir, skipped = build_singer_suggestions(members, submissions, [], EMPTY_MIC, [], SERVICE_DATE)

    assert len(mic) == 8
    assert len(choir) == 1
    assert choir[0].name == "멤버9"


def test_submission_without_member_id_is_ignored():
    members = [_member(1, "정승주")]
    unmatched = AvailabilitySubmissionItem(
        id=99, member_id=None, name="미등록", default_status="available", raw_text="x", entries=[]
    )
    mic, choir, skipped = build_singer_suggestions(members, [unmatched], [], EMPTY_MIC, [], SERVICE_DATE)

    # member_id 없는 제출은 candidate 매칭에 쓰이지 않고, members 목록에도 없어 unknown으로 잡힌다.
    assert skipped.unknown == ["정승주"]
    assert mic == []


def test_deterministic_output_for_same_input():
    members = [_member(1, "정승주"), _member(2, "임하늘")]
    submissions = [
        _submission(1, "정승주", default_status="available"),
        _submission(2, "임하늘", default_status="available"),
    ]
    counts = [_count(1, "정승주", month=1, year=1)]

    result_a = build_singer_suggestions(members, submissions, counts, EMPTY_MIC, [], SERVICE_DATE)
    result_b = build_singer_suggestions(members, submissions, counts, EMPTY_MIC, [], SERVICE_DATE)

    assert [m.name for m in result_a[0]] == [m.name for m in result_b[0]]
    assert [c.name for c in result_a[1]] == [c.name for c in result_b[1]]
