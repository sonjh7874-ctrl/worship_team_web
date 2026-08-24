"""싱어팀 마이크/콰이어 자동 배정 제안 — 순수 로직 (Phase 12).

Phase 11의 데이터(참/불참 + 마이크 배정 횟수) 위에 "참석 가능 + 배정 적은 순"으로 빈 마이크
슬롯과 콰이어를 채워 제안한다. 여기 담긴 함수는 DB·네트워크 접근이 전혀 없는 순수 함수라
pytest만으로 회귀 테스트가 가능하다(Phase 9 song_form_parser, Phase 10 compute_permissions,
Phase 11-A aggregate_mic_counts와 동일한 분리 방식).

DB 조회를 엮어 실제 응답을 만드는 조립 로직은 schedule_service.get_week_suggestions에 있다.
"""

from datetime import date as date_type

from app.schemas.availability import AvailabilitySubmissionItem
from app.schemas.schedule import (
    AssignedPerson,
    MicAssignmentCount,
    SuggestedMicSlot,
    SuggestedPerson,
    SuggestionSkipped,
)

MIC_SLOTS = [str(i) for i in range(1, 9)]


def resolve_attendance(submission: AvailabilitySubmissionItem | None, service_date: date_type) -> str:
    """그 주일(service_date)의 참석 여부를 판정한다.

    우선순위: 날짜별 항목(entries) 정확 매칭 → 월 단위 기본값(default_status) → 불명확("unknown").
    제출 자체가 없으면(None) 무조건 unknown이다. 결과는 "available" | "unavailable" | "unknown".
    """
    if submission is None:
        return "unknown"
    for entry in submission.entries:
        if entry.date == service_date:
            return entry.status
    if submission.default_status:
        return submission.default_status
    return "unknown"


def build_singer_suggestions(
    members: list[dict],
    submissions: list[AvailabilitySubmissionItem],
    mic_counts: list[MicAssignmentCount],
    current_mic: dict[str, AssignedPerson | None],
    current_choir: list[AssignedPerson],
    service_date: date_type,
) -> tuple[list[SuggestedMicSlot], list[SuggestedPerson], SuggestionSkipped]:
    """빈 마이크 슬롯과 콰이어를 채울 후보를 계산한다.

    - members: 활동 중인 싱어팀원 목록({"id": int, "name": str, ...}), 이름순 정렬 가정.
    - submissions: 그 달 싱어팀 참/불참 제출(Phase 11-B), member_id가 있는 것만 참고한다.
    - mic_counts: 그 달/올해 마이크 배정 횟수(Phase 11-A).
    - current_mic/current_choir: 그 주차에 이미 채워진 배정 — 빈 슬롯만 채우고 기존 값은
      절대 덮어쓰지 않으며, 이미 배정된 사람은 후보 풀에서도 제외한다.

    무작위 요소가 없어 같은 입력이면 항상 같은 결과를 반환한다.
    """
    submission_by_member = {s.member_id: s for s in submissions if s.member_id is not None}
    count_by_member = {c.member_id: c for c in mic_counts}

    already_assigned_ids: set[int] = set()
    already_assigned_names: list[str] = []
    for person in list(current_mic.values()) + list(current_choir):
        if person is not None and person.member_id is not None:
            already_assigned_ids.add(person.member_id)
            already_assigned_names.append(person.name)

    unavailable_names: list[str] = []
    unknown_names: list[str] = []
    candidates: list[SuggestedPerson] = []

    for member in members:
        member_id = member["id"]
        name = member["name"]
        if member_id in already_assigned_ids:
            continue  # 이미 배정된 사람은 already_assigned_names에서 별도로 안내한다.

        status = resolve_attendance(submission_by_member.get(member_id), service_date)
        if status == "unavailable":
            unavailable_names.append(name)
        elif status == "unknown":
            unknown_names.append(name)
        else:
            count = count_by_member.get(member_id)
            candidates.append(
                SuggestedPerson(
                    member_id=member_id,
                    name=name,
                    month_count=count.month_count if count else 0,
                    year_count=count.year_count if count else 0,
                )
            )

    # 이번 달 → 올해 누적 → 이름순. 이름순 tie-breaker가 무작위 요소를 없애 결정론을 보장한다.
    candidates.sort(key=lambda c: (c.month_count, c.year_count, c.name))

    empty_slots = [slot for slot in MIC_SLOTS if current_mic.get(slot) is None]

    mic_suggestions: list[SuggestedMicSlot] = []
    remaining = list(candidates)
    for slot in empty_slots:
        if not remaining:
            break
        person = remaining.pop(0)
        mic_suggestions.append(SuggestedMicSlot(slot=int(slot), **person.model_dump()))

    # 마이크에 안 뽑히고 남은 참석 가능자 전원이 콰이어 추천이다(인원수 상한을 두지 않는다).
    choir_suggestions = remaining

    skipped = SuggestionSkipped(
        already_assigned=already_assigned_names,
        unavailable=unavailable_names,
        unknown=unknown_names,
    )
    return mic_suggestions, choir_suggestions, skipped
