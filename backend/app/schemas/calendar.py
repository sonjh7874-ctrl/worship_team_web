from datetime import date

from pydantic import BaseModel

# 카테고리는 README/ERD 원칙대로 고정값 + "기타"만 허용한다. "기타"를 고르면
# category_custom에 자유 텍스트를 받고, 그 외 값이면 category_custom은 항상 null이어야 한다
# (서비스 레이어에서 검증).
FIXED_CATEGORIES = {"수련회", "엠티", "특순", "기타"}

# 이벤트 막대 색상은 자유 컬러피커 대신 프리셋 8개 중 하나만 고르게 한다 — 검증이
# "이 목록에 있는가"로 단순해지고, 프론트 UI도 스와치 8개만 그리면 되어 가볍다.
# null이면 카테고리 기본색(CATEGORY_COLORS)을 그대로 쓴다.
PRESET_COLORS = [
    "#fecaca",  # red
    "#fed7aa",  # orange
    "#fef08a",  # yellow
    "#bbf7d0",  # green
    "#99f6e4",  # teal
    "#bfdbfe",  # blue
    "#ddd6fe",  # purple
    "#fbcfe8",  # pink
]


class ParticipantItem(BaseModel):
    # 인명부 연결이 있으면 member_id를, 탈퇴자/인명부 밖 인물은 name만 내려준다
    # (schedule_assignments의 AssignedPerson과 동일한 COALESCE 규칙, ERD 3-3).
    member_id: int | None = None
    name: str


class ParticipantInput(BaseModel):
    member_id: int | None = None
    name_snapshot: str | None = None


class CalendarEventListItem(BaseModel):
    id: int
    title: str
    start_date: date
    end_date: date | None = None
    category: str
    category_custom: str | None = None
    # 프리셋 8색 중 하나(hex) 또는 null(카테고리 기본색 사용). 그리드 막대 색상에 쓰인다.
    color: str | None = None
    # 자동 생성된 이벤트인지 여부 — 프론트가 그리드 칩에 배지를 붙이고
    # 상세 화면에서 수정/삭제 버튼 대신 안내문을 보여줄지 판단하는 데 쓴다.
    # "auto_from_schedule"(특순, ERD 3-4) / "auto_birthday"(생일, 3-12절) / "manual".
    source_type: str
    source_week_id: int | None = None
    # 생일 자동 이벤트가 가리키는 팀원(members.id). 특순 이벤트에는 항상 null이다.
    source_member_id: int | None = None
    # 목록 화면에서 상세로 들어가지 않아도 댓글이 있는지 알 수 있도록 함께 내려준다.
    comment_count: int = 0


class CalendarEventDetail(CalendarEventListItem):
    memo: str | None = None
    participants: list[ParticipantItem] = []


class CalendarEventCreate(BaseModel):
    # source_type/source_week_id는 요청 스키마에 없다 — 직접 API로 auto 이벤트를 만들 수 없고,
    # 항상 서비스 레이어가 manual로 강제한다 (특순 동기화는 스케줄 저장 로직 내부에서만 발생).
    title: str
    start_date: date
    end_date: date | None = None
    category: str
    category_custom: str | None = None
    color: str | None = None
    memo: str | None = None
    participants: list[ParticipantInput] = []


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    category: str | None = None
    category_custom: str | None = None
    color: str | None = None
    memo: str | None = None
    # None이면 "참여 인원 변경 없음", 빈 리스트면 "전원 삭제"를 의미한다
    # (exclude_unset으로 구분하므로 필드 생략과는 다른 의미).
    participants: list[ParticipantInput] | None = None
