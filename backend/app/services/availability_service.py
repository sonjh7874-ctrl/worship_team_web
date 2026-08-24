"""참/불참 제출 조회·확정 저장 (Phase 11-B).

파싱(AI 호출)은 availability_parse_service.py가 담당하고, 여기서는 검수 확정 후의 저장·조회만 다룬다.
Phase 6의 "AI는 결과만 반환, 저장은 별도 확정 API"와 동일한 역할 분리다.

**팀 단위 저장(후속)**: 싱어팀장·악기팀장이 각자 자기 팀만 관리하므로, 조회·저장 범위를 모두
year/month/team 세 값으로 좁힌다. team으로 좁히지 않으면 한 팀이 저장할 때 다른 팀 데이터가
통째로 사라지는 사고로 이어진다(실사용 피드백으로 발견).
"""

from app.repositories import availability_repository
from app.schemas.availability import (
    AvailabilityEntry,
    AvailabilityResponse,
    AvailabilitySubmissionItem,
    AvailabilitySubmissionsPutRequest,
)


def _to_submission_item(row: dict) -> AvailabilitySubmissionItem:
    member = row.get("members")
    name = (member.get("name") if member else None) or row.get("name_snapshot")
    entries = [
        AvailabilityEntry(date=e["date"], status=e["status"], reason=e.get("reason"))
        for e in row.get("availability_entries", [])
    ]
    entries.sort(key=lambda e: e.date)
    return AvailabilitySubmissionItem(
        id=row["id"],
        member_id=row.get("member_id"),
        name=name,
        default_status=row.get("default_status"),
        default_reason=row.get("default_reason"),
        raw_text=row["raw_text"],
        entries=entries,
    )


def get_availability(year: int, month: int, team: str) -> AvailabilityResponse:
    rows = availability_repository.find_by_year_month_team(year, month, team)
    submissions = [_to_submission_item(r) for r in rows]
    submissions.sort(key=lambda s: s.name)
    return AvailabilityResponse(year=year, month=month, team=team, submissions=submissions)


def _dedupe_entries(entries: list) -> list:
    """같은 날짜가 중복 입력되면 마지막 값만 남긴다.

    AI 파싱 오류나 화면에서의 실수로 같은 사람·같은 날짜 항목이 두 번 들어올 수 있는데,
    DB에 유니크 제약이 없어 그대로 두면 조용히 중복 저장된다.
    """
    by_date = {}
    for entry in entries:
        by_date[entry.date] = entry
    return list(by_date.values())


def put_availability(
    year: int, month: int, team: str, payload: AvailabilitySubmissionsPutRequest
) -> AvailabilityResponse:
    # 그 달-그 팀 전체를 교체하는 방식(delete-then-insert) — conti_songs/schedule_assignments와
    # 동일 패턴이되, 범위를 team으로 한 번 더 좁혔다. 리더가 같은 달 참/불참을 다시 붙여넣어
    # 재파싱·재확정하는 경우가 실제로 잦을 것이므로, 부분 수정 API보다 전체 교체가 단순하다.
    availability_repository.delete_by_year_month_team(year, month, team)

    entry_rows = []
    for item in payload.submissions:
        # 제출을 한 건씩 insert해 반환된 id를 그 자리에서 바로 쓴다. 여러 건을 한 번에 insert하고
        # 반환 순서가 요청 순서와 같다고 가정하는 것보다, 순서 보장에 의존하지 않는 편이 안전하다
        # (자식 행이 잘못된 부모에 붙으면 "이 사람이 언제 불참인지"가 조용히 뒤바뀌는 데이터 정합성
        # 사고로 이어진다).
        submission = availability_repository.insert_submissions(
            [
                {
                    "year": year,
                    "month": month,
                    "team": team,
                    "member_id": item.member_id,
                    "name_snapshot": item.name_snapshot,
                    "default_status": item.default_status,
                    "default_reason": item.default_reason,
                    "raw_text": item.raw_text,
                }
            ]
        )[0]
        for entry in _dedupe_entries(item.entries):
            entry_rows.append(
                {
                    "submission_id": submission["id"],
                    "date": entry.date.isoformat(),
                    "status": entry.status,
                    "reason": entry.reason,
                }
            )
    availability_repository.insert_entries(entry_rows)

    return get_availability(year, month, team)
