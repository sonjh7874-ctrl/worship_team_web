"""참/불참 텍스트 파싱 결과 및 확정 저장용 스키마 (Phase 11-B).

저장 단위는 "날짜별 항목 + 월 단위 기본값" 조합이다. `29일 불참(결혼식), 30일 참`처럼 페어 안에서
날짜별로 상태가 갈리는 경우를 표현하려면 날짜 단위가 필요하고, `전참`/`전체 불참(사유)` 같은 월 전체
축약형은 그 달의 실제 날짜를 계산하지 않고 기본값 자체로만 저장한다(전체_로드맵.md Phase 11-B 파생 결정 5).

**팀 단위 저장(후속)**: 싱어팀장·악기팀장이 각자 자기 팀 데이터만 관리하므로, 저장(PUT)이 그 달
전체를 교체하면 한쪽이 저장할 때 다른 팀 데이터가 사라진다. `team`을 저장·조회 범위에 포함시켜
같은 달이라도 팀별로 독립적으로 교체되게 한다.
"""

from datetime import date as date_type

from pydantic import BaseModel


class AvailabilityEntry(BaseModel):
    date: date_type
    status: str  # "available" | "unavailable"
    reason: str | None = None


class ParsedPerson(BaseModel):
    # AI가 텍스트에서 추출한 이름 원문. matched_member_id가 있으면 인명부와 자동 매칭된 것이고,
    # 없으면(match_status="unmatched") 검수 화면에서 사람이 확정해야 한다(ERD 3-1 곡 매칭과 동일 패턴).
    name_raw: str
    matched_member_id: int | None = None
    match_status: str  # "matched" | "unmatched"
    # 매칭된 인명부 사람의 실제 팀. 파싱을 요청한 team(어느 팀 화면에서 붙여넣었는지)과 다르면
    # 프론트가 "인명부상 악기팀원인데 싱어팀 화면에 입력됨" 같은 경고를 보여준다(저장은 막지 않음).
    matched_member_team: str | None = None
    default_status: str | None = None
    default_reason: str | None = None
    entries: list[AvailabilityEntry] = []
    raw_text: str


class AvailabilityParseResult(BaseModel):
    people: list[ParsedPerson] = []


class AvailabilityParseRequest(BaseModel):
    # year/month는 "일(day)" 숫자만 담긴 파싱 결과를 실제 date로 조합하는 데 쓰인다(서버가 계산,
    # Phase 6의 "날짜는 서버가 계산" 원칙과 동일). team은 이 붙여넣기가 어느 팀 화면에서 이뤄졌는지를
    # 나타내며, 매칭된 인명부 사람의 실제 팀과 비교해 불일치 경고를 만드는 데 쓰인다.
    text: str
    year: int
    month: int
    team: str  # "singer" | "instrument"


class AvailabilitySubmissionInput(BaseModel):
    # member_id/name_snapshot 중 하나만 필수인 schedule_assignments와 달리, 참/불참 제출은 항상
    # 이름이 있는 텍스트에서 시작하므로 name_snapshot은 항상 채워진다.
    member_id: int | None = None
    name_snapshot: str
    default_status: str | None = None
    default_reason: str | None = None
    raw_text: str
    entries: list[AvailabilityEntry] = []


class AvailabilitySubmissionsPutRequest(BaseModel):
    submissions: list[AvailabilitySubmissionInput]


class AvailabilitySubmissionItem(BaseModel):
    id: int
    member_id: int | None = None
    name: str  # 인명부 연결이 있으면 최신 이름, 없으면 name_snapshot (ERD 3-3 COALESCE 규칙)
    default_status: str | None = None
    default_reason: str | None = None
    raw_text: str
    entries: list[AvailabilityEntry] = []


class AvailabilityResponse(BaseModel):
    year: int
    month: int
    team: str
    submissions: list[AvailabilitySubmissionItem] = []
