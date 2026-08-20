from datetime import date
from typing import Literal

from pydantic import BaseModel


class SongBrief(BaseModel):
    id: int
    title: str
    artist: str | None = None


class ContiSongItem(BaseModel):
    order_no: int
    song: SongBrief
    song_key: str | None = None
    song_form: str | None = None
    note: str | None = None


class SheetFileItem(BaseModel):
    id: int
    file_type: str
    file_name: str | None = None
    url: str | None = None


class ContiListItem(BaseModel):
    id: int
    service_date: date
    title: str
    status: str


class ContiDetail(ContiListItem):
    songs: list[ContiSongItem] = []
    sheet_files: list[SheetFileItem] = []


class ContiCreate(BaseModel):
    service_date: date
    title: str = "주일예배"
    # 리더십이 직접 입력한 콘티는 그 자체로 검수를 거친 것이라 기본값이 published다(API명세 1-1).
    # AI 인식 흐름에서만 draft로 만들어, 사람이 검수해 게시하기 전까지 목록/최신 조회에서 숨긴다.
    status: Literal["draft", "published"] = "published"


class NewSongInput(BaseModel):
    title: str
    artist: str | None = None
    default_key: str | None = None


class ContiSongInput(BaseModel):
    song_id: int | None = None
    new_song: NewSongInput | None = None
    song_key: str | None = None
    song_form: str | None = None
    note: str | None = None


class ContiSongsPutRequest(BaseModel):
    songs: list[ContiSongInput]


class ContiUpdate(BaseModel):
    service_date: date | None = None
    title: str | None = None
    status: Literal["draft", "published"] | None = None
    # AI 추출 원본(정확도 검증·트러블슈팅용). ai-parse 시점엔 콘티 레코드가 아직 없을 수 있어
    # 검수 확정 단계에서 이 PATCH로 함께 저장한다. DB 컬럼이 jsonb라 원본 문자열/파싱된 객체 모두 허용한다.
    ai_raw_result: dict | str | None = None


class SongCandidate(BaseModel):
    """AI가 읽은 제목과 비슷한 기존 곡 후보. 자동 적용하지 않고 검수 화면에서 사람이 고른다."""

    song_id: int
    title: str
    artist: str | None = None
    # 0~1 유사도. 한글을 자모로 분해해 비교하므로 '전심감주'와 '전신갑주'처럼 한 글자 오독도 잡힌다.
    score: float
    last_song_form: str | None = None


class AiParsedSong(BaseModel):
    """AI가 콘티 이미지에서 추출한 곡 1건 + 곡 마스터 매칭 결과."""

    title: str
    artist: str | None = None
    song_key: str | None = None
    song_form: str | None = None
    note: str | None = None
    # 정규화 제목 완전 일치로 찾은 기존 곡 id (ERD 3-1). 없으면 null.
    matched_song_id: int | None = None
    # matched = 기존 곡 후보를 찾음 / new = 신규 곡으로 제안. 최종 확정은 검수 화면에서 사람이 한다.
    match_status: Literal["matched", "new"] = "new"
    # 매칭된 곡이 지난번 콘티에서 쓴 송폼. 이번 인식 결과와 비교해 오독을 눈으로 잡으라고 함께 내려준다.
    # 송폼은 매주 바뀔 수 있으므로 이 값으로 덮어쓰지 않는다 — 비교용 표시일 뿐이다.
    last_song_form: str | None = None
    # 제목이 정확히 일치하지 않을 때의 유사 곡 후보(최대 3개, 유사도 높은 순).
    candidates: list[SongCandidate] = []


class AiParseResult(BaseModel):
    """POST /contis/ai-parse 응답 (API명세 1-4). DB에 저장하지 않고 검수 화면에 그대로 전달한다."""

    service_date_guess: date | None = None
    title_guess: str | None = None
    songs: list[AiParsedSong] = []
    # 모델이 돌려준 원본 JSON 문자열. 검수 확정 시 PATCH로 contis.ai_raw_result에 저장한다.
    raw_model_output: str
