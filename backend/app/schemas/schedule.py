from datetime import date as date_type

from pydantic import BaseModel


class ScheduleWeekSpecial(BaseModel):
    # 필드명이 date라 타입 힌트에서 datetime.date를 그대로 쓰면 자기 자신을 가리키는
    # 순환 참조로 평가에 실패한다 (Pydantic이 forward-ref를 클래스 네임스페이스에서 평가하기 때문).
    # API 응답 필드명은 API명세대로 date를 유지하고, 타입만 별칭(date_type)으로 참조한다.
    title: str
    date: date_type | None = None
    memo: str | None = None


class AssignedPerson(BaseModel):
    # member_id가 있으면 인명부 드롭다운에서 그대로 재선택(편집 시 미리 채우기)할 수 있다.
    # 인명부에 없는 인물(name_snapshot만 있는 경우)은 member_id가 null이라 이름만 표시하고
    # 드롭다운에는 미리 채우지 못한다 — 애초에 인명부 밖 인물이라 선택지에 없기 때문.
    member_id: int | None = None
    name: str


class InstrumentAssignment(BaseModel):
    key1: AssignedPerson | None = None
    key2: AssignedPerson | None = None
    drum: AssignedPerson | None = None
    bass: AssignedPerson | None = None
    electric: AssignedPerson | None = None
    singer_helper: AssignedPerson | None = None
    score: AssignedPerson | None = None


class SingerAssignment(BaseModel):
    # 마이크 1~8은 무대 좌표가 고정이라(Phase 3 배치도) 값이 없어도 키 자체는 항상 유지한다.
    mic: dict[str, AssignedPerson | None] = {str(i): None for i in range(1, 9)}
    choir: list[AssignedPerson] = []
    caption: AssignedPerson | None = None
    # 싱어 악보 담당은 보통 2명이 나눠 맡아 positions.singer_score.is_multi=true로 변경됨.
    # 악기 악보(inst_score)는 그대로 1명이라 InstrumentAssignment.score는 단일 값 유지.
    score: list[AssignedPerson] = []


class ScheduleWeekItem(BaseModel):
    id: int
    week_label: str
    service_date: date_type | None = None
    remark: str | None = None
    absence_note: str | None = None
    special: ScheduleWeekSpecial | None = None
    instrument: InstrumentAssignment = InstrumentAssignment()
    singer: SingerAssignment = SingerAssignment()


class ScheduleAssignmentInput(BaseModel):
    position_code: str
    member_id: int | None = None
    name_snapshot: str | None = None
    slot_order: int = 0


class ScheduleAssignmentsPutRequest(BaseModel):
    assignments: list[ScheduleAssignmentInput]


class MonthlyScheduleResponse(BaseModel):
    id: int
    year: int
    month: int
    memo: str | None = None
    weeks: list[ScheduleWeekItem] = []


class MonthlyScheduleCreate(BaseModel):
    year: int
    month: int
    memo: str | None = None


class ScheduleWeekCreate(BaseModel):
    week_label: str
    service_date: date_type | None = None
    remark: str | None = None
    absence_note: str | None = None
    special_title: str | None = None
    special_date: date_type | None = None
    special_memo: str | None = None


class ScheduleWeekUpdate(BaseModel):
    week_label: str | None = None
    service_date: date_type | None = None
    remark: str | None = None
    absence_note: str | None = None
    special_title: str | None = None
    special_date: date_type | None = None
    special_memo: str | None = None


class MicAssignmentCount(BaseModel):
    member_id: int
    name: str
    month_count: int
    year_count: int


class AssignmentCountsResponse(BaseModel):
    year: int
    month: int
    counts: list[MicAssignmentCount] = []


# ---------------------------------------------------------------------------
# 싱어팀 마이크/콰이어 자동 배정 제안 (Phase 12)
# 참/불참(Phase 11-B) + 배정 횟수(Phase 11-A) 위에 순수 로직만 얹어 "제안"하고,
# 최종 배정은 사람이 확정한다(전체_로드맵.md Phase 12 SDD).
# ---------------------------------------------------------------------------


class SuggestedPerson(BaseModel):
    member_id: int
    name: str
    month_count: int
    year_count: int


class SuggestedMicSlot(SuggestedPerson):
    slot: int


class SuggestionSkipped(BaseModel):
    # 왜 이 사람이 추천에 없는지 리더가 알 수 있게 하는 안내용. 불참 사유 텍스트는 담지 않는다
    # (사유는 참/불참 화면에서 보면 되고, 배정 화면에 개인 사정을 다시 노출할 이유가 없다).
    already_assigned: list[str] = []
    unavailable: list[str] = []
    unknown: list[str] = []


class SingerSuggestionsResponse(BaseModel):
    week_id: int
    service_date: date_type | None = None
    # 그 달 참/불참 제출이 하나도 없으면 false — 프론트가 추천 버튼을 비활성화하고
    # 참/불참 화면 링크를 안내한다(README/로드맵의 "미제출자는 추천 대상에서 제외" 원칙과 일관).
    has_availability: bool
    mic: list[SuggestedMicSlot] = []
    choir: list[SuggestedPerson] = []
    skipped: SuggestionSkipped = SuggestionSkipped()
