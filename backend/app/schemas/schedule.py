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
