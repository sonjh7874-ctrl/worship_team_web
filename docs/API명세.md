# API 명세서 — 청년부 주일찬양팀 웹

> 기준일: 2026-08-18 / Backend: FastAPI / DB: Supabase (PostgreSQL)
> 이 문서는 설계 근거를 담은 초안이다. 실제 API 문서는 FastAPI 구동 시 `/docs` (Swagger UI)에서 자동 생성되며, 이 문서와 동기화되어야 한다.

---

## 0. 공통 규칙

### 0-1. Base URL / 인증

- Base URL: `/api/v1`
- **Supabase Auth 기반 로그인** (Phase 7, 2026-08-20). 조회(GET)는 로그인 여부와 무관하게 **전체 공개**이며, 쓰기(POST/PATCH/DELETE)는 **역할(role)** 로 게이트한다.
- 인증은 요청 헤더로 전달한다: `Authorization: Bearer <access_token>`. 토큰은 `POST /auth/login`(또는 `/auth/signup`) 응답의 `access_token`이다.
- 서버는 이 토큰을 Supabase Auth로 검증한 뒤, `user_profiles.role`을 조회해 등급을 비교한다(`app/dependencies.py`의 `require_role(min_role)`). 등급은 `member < leader < admin` — `require_role("leader")`는 leader 이상을, `require_role("admin")`은 admin만 통과시킨다.
  - 헤더가 없거나 토큰이 무효/만료: `401 Unauthorized`
  - 역할이 부족: `403 Forbidden`
- 콘티/곡/파일/공지사항/스케줄/캘린더/인명부의 **쓰기 엔드포인트는 모두 `require_role("leader")`**. 사용자 역할 관리(`/auth/users`)만 `require_role("admin")`이다.
- 액세스 토큰은 기본 1시간 만료다. 만료 시 `POST /auth/refresh`에 `refresh_token`을 보내 재발급받는다(프론트는 401 응답을 받으면 이 과정을 자동으로 1회 재시도한다).
- **이전 방식이던 `X-Edit-Password` 단일 비밀번호 게이트(`EDIT_PASSWORD`)는 완전히 제거됐다.** 문제가 생기면 Phase 7의 교체 커밋을 git revert해 되돌아간다.

### 0-2. 공통 응답 형식

성공 응답은 데이터를 바로 반환한다(불필요한 wrapper 없음). 에러는 아래 형식으로 통일한다.

```json
{
  "detail": "사람이 읽을 수 있는 에러 메시지",
  "error_code": "DUPLICATE"
}
```

| 상태 코드 | 의미 |
|---|---|
| 400 | 요청 값 오류 (필수 필드 누락, 형식 오류) |
| 401 | 인증 토큰 없음/무효/만료 |
| 403 | 역할 등급 부족(leader/admin 권한 필요) |
| 404 | 대상 리소스 없음 |
| 409 | 유니크 제약 충돌 (예: 마이크 슬롯 중복 배정) |
| 422 | FastAPI 기본 유효성 검사 오류 |
| 500 | 서버 오류 |

### 0-3. 날짜/시간

- 날짜는 `YYYY-MM-DD` (ISO 8601), 타임존은 Asia/Seoul 기준으로 서버가 처리한다.
- 목록 API는 **페이지네이션 없이 전체 반환**한다. 팀 규모(22명), 연간 데이터량(콘티 ~60건, 스케줄 12건) 모두 작아 불필요한 복잡도로 판단.

### 0-4. 빈 값 처리

README/ERD 원칙과 동일하게, **값이 없는 필드는 응답 JSON에서 `null`로 내려주고 프론트가 렌더링 시 숨긴다.** 서버가 필드 자체를 생략하지는 않는다 (스키마 예측 가능성을 위해).

---

## 1. 기능 1 — 콘티 / 곡 / 악보

### 1-1. 콘티 CRUD

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/contis` | 콘티 목록 (날짜 최신순, 기본 **published만**) | 불필요 |
| GET | `/contis?status=draft` | 검수 대기 중인 초안 목록 | 불필요 |
| GET | `/contis/latest` | 가장 최근/다가오는 콘티 1건 (메인 화면용, **published만**) | 불필요 |
| GET | `/contis/{conti_id}` | 콘티 상세 (곡 목록 + 악보 포함, **status 무관하게 조회 가능**) | 불필요 |
| POST | `/contis` | 콘티 신규 생성 (빈 콘티, `status` 기본값 **published**) | 필요 |
| PATCH | `/contis/{conti_id}` | 콘티 제목/날짜/상태 수정 | 필요 |
| DELETE | `/contis/{conti_id}` | 콘티 삭제 (곡 배치·악보 CASCADE) | 필요 |

> **draft/published 동작**: 목록·메인 조회는 `published` 콘티만 보여준다. `draft`는 아직 확정 전이라 팀 전체에 노출되면 안 되기 때문 — 리더십이 콘티를 미리 입력해두되 아직 확정이 아니면(예: 목사님이 순서를 바꿀 수 있는 상태) `PATCH`로 `status: "draft"`로 바꿔 잠시 숨겨둘 수 있다. 반대로 수동 생성(`POST /contis`)은 리더십이 직접 입력하는 것 자체가 이미 검수를 거친 콘텐츠라 **기본값이 draft가 아니라 즉시 published**다. `draft`는 Phase 6(AI 이미지 인식 결과를 사람이 검수하기 전)에서만 실제로 쓰이며, 이때는 `POST /contis`에 `status: "draft"`를 실어 처음부터 초안으로 만든다 — 생성 후 `PATCH`로 되돌리면 그사이 팀 전체에 잠깐 노출되기 때문이다.
>
> **초안을 다시 찾는 방법**: 로그인이 없어 "내 draft"를 구분할 수 없으므로, `GET /contis?status=draft`로 검수 대기 중인 초안을 모두 조회한다. 프론트는 이 목록을 콘티 화면(`/conti`)의 "검수 대기" 섹션에 띄워, 검수를 마치지 못한 초안을 이어서 처리하거나 지울 수 있게 한다.
>
> 상세 조회(`GET /contis/{conti_id}`)는 status와 무관하게 열려 있다 — 작성자가 편집 화면(`/conti/{id}/edit`)에서 자신의 draft를 계속 보고 고칠 수 있어야 하기 때문. 다만 로그인이 없어 "내가 만든 draft 목록"을 모아보는 화면은 없으므로, draft로 전환한 콘티는 URL(ID)을 기억해야 다시 찾아갈 수 있다.

**`GET /contis` 응답 예시**

```json
[
  { "id": 12, "service_date": "2026-08-09", "title": "주일예배", "status": "published" },
  { "id": 11, "service_date": "2026-08-02", "title": "주일예배", "status": "published" }
]
```

**`GET /contis/{conti_id}` 응답 예시**

```json
{
  "id": 12,
  "service_date": "2026-08-09",
  "title": "주일예배",
  "status": "published",
  "songs": [
    {
      "order_no": 1,
      "song": { "id": 3, "title": "삶의 예배", "artist": "아이자야" },
      "song_key": "G-A",
      "song_form": "(4) A1 A2 B (맞4) A2 B (맞4) (up) B B",
      "note": null
    }
  ],
  "sheet_files": [
    { "id": 5, "file_type": "score_pdf", "file_name": "0809_score.pdf", "url": "<signed url>" }
  ]
}
```

### 1-2. 곡 관리

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/songs` | 곡 마스터 목록 (검색용, `?q=제목검색`) | 불필요 |
| POST | `/songs` | 곡 신규 등록 | 필요 |
| PATCH | `/songs/{song_id}` | 곡 정보 수정 (제목/아티스트/기본키) | 필요 |
| DELETE | `/songs/{song_id}` | 곡 삭제 (**어떤 콘티에도 배치되지 않은 곡만**) | 필요 |

- `GET /songs` 응답의 각 곡에는 `usage_count`(이 곡이 배치된 콘티 수)가 함께 내려간다. 곡 관리 화면이 삭제 가능 여부를 미리 보여주기 위한 값이며, 중첩 count 집계라 조회 횟수는 늘지 않는다.
- `DELETE`는 `usage_count > 0`이면 **409**로 거부한다. `conti_songs.song_id` FK가 `on delete restrict`라 그냥 지우면 DB 오류가 500으로 새어 나가고, 무엇보다 과거 콘티의 곡 정보가 깨지기 때문이다. AI 인식이 제목을 잘못 읽어 생긴 곡처럼 **아직 어디에도 안 쓰인 찌꺼기만** 지울 수 있다.

### 1-3. 콘티-곡 배치

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| PUT | `/contis/{conti_id}/songs` | **콘티의 곡 배치 전체 교체** (배열 통째로) | 필요 |
| DELETE | `/contis/{conti_id}/songs/{order_no}` | 특정 순서의 곡 삭제 | 필요 |

> **설계 근거**: 곡 순서를 개별 API로 하나씩 추가/재정렬하면 프론트-백엔드 상태 동기화가 복잡해진다. 검수 화면에서 "AI가 추출한 곡 목록을 사람이 통째로 확인·수정 후 저장"하는 흐름이므로, **배열 전체를 PUT으로 교체**하는 방식이 가장 단순하고 검수 UX와도 맞는다.

**`PUT /contis/{conti_id}/songs` 요청 예시**

```json
{
  "songs": [
    { "song_id": 3, "song_key": "G-A", "song_form": "(4) A1 A2 B ...", "note": null },
    { "song_id": null, "new_song": { "title": "전신갑주", "artist": "잔치공동체", "default_key": "G" },
      "song_key": "G", "song_form": "(8) A B C ...", "note": null }
  ]
}
```

`song_id`가 없고 `new_song`이 있으면 서버가 곡을 먼저 생성한 뒤 배치한다 (검수 화면에서 "새로 등록" 선택 시).

### 1-4. AI 콘티 이미지 인식

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/contis/ai-parse` | 콘티 이미지를 업로드해 AI로 구조화 데이터 추출 | 필요 |

- **요청**: `multipart/form-data`, 필드 `image` (콘티 이미지 파일). 허용 형식 `image/png` · `image/jpeg` · `image/webp`, 최대 8MB — 벗어나면 `400`.
- **처리**: 이미지를 base64 data URL로 실어 **OpenAI API**(vision 지원 모델)에 전달 → "곡 순서·제목·아티스트·키·송폼을 JSON으로 추출"하는 고정 프롬프트로 1회 호출. JSON 모드(`response_format: json_object`)를 강제해 설명 문장이 섞이지 않게 하고, `temperature=0`으로 고정한다(이미지를 옮겨 적는 작업이라 무작위성이 손해만 된다).
- **프롬프트에 기존 곡 목록을 함께 넣는다.** 같은 곡이 매주 반복되는 팀 특성상 "아는 곡이면 그 표기를 그대로 쓰라"고 알려주는 것만으로 오독이 크게 준다(실측: 제목 93%→96%, 아티스트 89%→96%). 다만 **송폼은 넣지 않는다** — 송폼은 매주 바뀔 수 있어 힌트로 주면 모델이 지난주 값을 베낄 위험이 있고, 그건 이 프로젝트가 없애려는 문제 그 자체다.
- **응답**: 추출된 JSON을 **그대로 반환만 하고 DB에 저장하지 않는다.** 사람이 검수 화면에서 확인 후 `PUT /contis/{conti_id}/songs`로 별도 저장.

```json
{
  "service_date_guess": "2026-08-09",
  "title_guess": "4부예배 콘티",
  "songs": [
    {
      "title": "삶의 예배",
      "artist": "아이자야",
      "song_key": "G-A",
      "song_form": "(4) A1 A2 B ...",
      "note": null,
      "matched_song_id": 3,
      "match_status": "matched",
      "last_song_form": "(4) A1 A2 B ...",
      "candidates": []
    }
  ],
  "raw_model_output": "{ ... 원본 JSON ... }"
}
```

- 곡의 필드명은 `PUT /contis/{conti_id}/songs`의 요청 스키마와 동일하게 맞췄다(`song_key`/`song_form`/`note`). 검수 화면이 변환 없이 그대로 저장 요청에 실어 보낼 수 있게 하기 위함이다.
- `matched_song_id` / `match_status`(`matched` | `new`)는 **서버가 수행한 곡 마스터 매칭 결과**다. ERD 3-1대로 정규화된 제목(공백·특수문자 제거, 소문자화) **완전 일치**만 자동 매칭으로 인정한다. 최종 확정("기존 곡 선택 / 새로 등록")은 검수 화면에서 사람이 한다. 프론트가 곡 목록 전체를 받아 비교하지 않도록 서버가 미리 판정해 내려준다.
- `candidates`는 완전 일치가 없을 때(`match_status: "new"`) 제안하는 **유사 곡 후보**(최대 3개, `{song_id, title, artist, score, last_song_form}`)다. 한글을 자모로 분해(NFD)해 비교하는 것이 핵심이다 — `전심감주`↔`전신갑주`는 음절 단위로는 0.50이지만 자모 단위로는 0.82다. 오인식이 음절 전체가 아니라 그 안의 자음 하나가 틀리는 식이기 때문이다. 임계값 0.6은 실측 기준(무관한 곡은 0.28 이하)이며, **자동 적용하지 않고 후보만 제안**한다. 유사도 매칭이 조용히 틀리면 사람이 알아채기 어렵기 때문이다.
- `last_song_form`은 매칭된 곡이 **지난 콘티에서 쓴 송폼**이다. 이번 인식 결과와 나란히 비교해 `(8)` 누락이나 글자 오독을 사람이 잡으라고 함께 내려준다. 이 값으로 덮어쓰지 않는다 — 송폼이 실제로 바뀐 주에는 이번 값이 정답이다.
- `note`에는 `<축복송>` · `<퇴장송>` 같은 꼬리표가 담긴다(꺾쇠 제외). 곡 제목에는 넣지 않는다.
- **날짜는 모델에게 변환까지 맡기지 않는다.** 헤더의 6자리 원문(`service_date_raw`, 예: `260816`)만 받아 서버가 `2026-08-16`으로 계산한다. 모델에 맡겼을 때 `260816`을 `2016-08-26`처럼 자리를 바꿔 읽는 오류가 실제로 있었고(5장 중 2장), 서버 계산으로 바꾼 뒤 사라졌다.
- **송폼은 해석·정규화하지 않는다.** 프롬프트에서 원문 그대로 옮기도록 못 박았다 — `(맞4)` · `bis(가사~)*2` · `Tag` · `C**` 같은 팀 고유 표기를 모델이 "이해"하려 들면 오히려 틀리기 때문(README 기능 1의 정확도 기대치와 동일).
- **인식된 곡이 0건이어도 에러가 아니다.** 빈 배열을 그대로 반환하고, 프론트가 "직접 입력" 안내를 띄운다. 사람 검수가 필수 단계라 부분 인식 결과도 그대로 쓸모가 있다.
- `raw_model_output`은 `contis.ai_raw_result`(jsonb)에 저장해 정확도 검증·트러블슈팅에 활용한다. 저장 시점은 **인식 직후 draft 콘티를 만든 다음**이며, 별도 엔드포인트 없이 `PATCH /contis/{conti_id}`의 `ai_raw_result` 필드로 보낸다.
- **에러**: 타임아웃(60초) `504` / OpenAI API 오류·레이트리밋·인증 실패 `502` / 응답을 JSON으로 못 읽음 `502` / 키 미설정 `500`.
- **환경변수**: `OPENAI_API_KEY` (2026-08-20 기준 테스트 기간 제공받은 키 사용, platform.openai.com에서 발급). 모델명은 `OPENAI_VISION_MODEL`로 덮어쓸 수 있다.
- **정확도**: 실제 콘티 이미지 5장(곡 27건)으로 측정해 필드 단위 **94.8%**(날짜 5/5, 제목 96%, 아티스트 96%, 키 100%, note 100%, 송폼 81~85%). 측정 스크립트는 `backend/tests/ai_parse_baseline.py`이며, 이미지·정답은 팀 내부 자료라 git에 올리지 않는다.

### 1-5. 악보/이미지 파일

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/contis/{conti_id}/files` | 악보 PDF 또는 콘티 원본 이미지 업로드 | 필요 |
| DELETE | `/files/{file_id}` | 파일 삭제 | 필요 |

- 요청은 `multipart/form-data`, 필드는 `file_type`(`score_pdf` | `conti_image`) · `file` · `replace`(선택, 기본 `false`)
- 서버가 Supabase Storage(`sheet-files` 버킷)에 업로드 후 `sheet_files`에 경로 기록
- 조회 시(`GET /contis/{conti_id}`) 서버가 **서명된 URL(signed URL, 유효시간 1시간)** 을 발급해 응답에 포함 — 버킷이 Private이므로 필요
- `replace=true`면 **같은 `file_type`의 기존 파일을 Storage·DB에서 지우고 새로 올린다.** AI 인식을 여러 번 돌려도 콘티 원본 이미지가 1장만 유지되게 하려는 옵션이라 AI 인식 흐름만 사용하고, 악보 PDF 등 수동 업로드는 기본값 `false`라 여러 개 쌓을 수 있다.
- **콘티를 삭제하면(`DELETE /contis/{conti_id}`) 딸린 Storage 파일도 함께 지운다.** DB의 `sheet_files` 행은 FK CASCADE로 정리되지만 Storage 객체에는 DB 제약이 닿지 않아, 서비스 레이어에서 콘티 삭제 직전에 파일부터 지워야 버킷에 고아 파일이 쌓이지 않는다(무료 티어 용량 보호).

---

## 2. 기능 2 — 공지사항 / 월간 스케줄

### 2-1. 공지사항 CRUD

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/notices` | 공지 목록 (고정글 먼저, 그다음 최신순) | 불필요 |
| GET | `/notices/{notice_id}` | 공지 상세 | 불필요 |
| POST | `/notices` | 공지 작성 | 필요 |
| PATCH | `/notices/{notice_id}` | 공지 수정 | 필요 |
| DELETE | `/notices/{notice_id}` | 공지 삭제 | 필요 |

### 2-2. 월간 스케줄

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/schedules?year=2026&month=8` | 해당 월 스케줄 전체 (주차별 배정 포함) | 불필요 |
| POST | `/schedules` | 월 스케줄 생성 (`year`, `month`) | 필요 |
| DELETE | `/schedules/{schedule_id}` | 월 스케줄 삭제 (주차·배정 CASCADE) | 필요 |
| POST | `/schedules/{schedule_id}/weeks` | 주차 추가 | 필요 |
| PATCH | `/schedules/{schedule_id}/weeks/{week_id}` | 주차 정보 수정 (비고/불참사항/특순) | 필요 |
| DELETE | `/schedules/{schedule_id}/weeks/{week_id}` | 주차 삭제 | 필요 |
| PUT | `/schedules/{schedule_id}/weeks/{week_id}/assignments` | **해당 주차의 배정 전체 교체** | 필요 |

> **설계 근거**: 배정도 콘티-곡 배치와 동일하게, 리더십이 "이번 주 포지션표 전체"를 한 화면에서 입력하고 저장 버튼 한 번으로 반영하는 흐름이다. 포지션 19개 중 채워진 것만 배열로 보내면 서버가 `schedule_assignments`를 통째로 교체한다.

**`GET /schedules?year=2026&month=8` 응답 예시 (마이크 배치 포함, 화면에서 바로 렌더 가능한 형태로 피벗)**

```json
{
  "year": 2026, "month": 8,
  "weeks": [
    {
      "id": 1, "week_label": "01-02", "service_date": "2026-08-02",
      "remark": null, "absence_note": "불참: 노유안(1 청소년부)",
      "special": { "title": "청년부 특별찬양", "date": "2026-08-02", "memo": null },
      "instrument": {
        "key1": null, "key2": null,
        "drum": { "member_id": 4, "name": "박시우" },
        "bass": { "member_id": 5, "name": "강태호" },
        "electric": { "member_id": 6, "name": "조민준" },
        "singer_helper": null, "score": null
      },
      "singer": {
        "mic": {
          "1": { "member_id": 21, "name": "정승주" },
          "2": { "member_id": 22, "name": "임하늘" },
          "3": { "member_id": 23, "name": "서다은" },
          "4": { "member_id": 24, "name": "최나린" },
          "5": { "member_id": 25, "name": "배현우" },
          "6": { "member_id": 26, "name": "윤소미" },
          "7": { "member_id": 27, "name": "오세진" },
          "8": { "member_id": 28, "name": "한도윤" }
        },
        "choir": [
          { "member_id": 29, "name": "노유안" },
          { "member_id": null, "name": "류지원" }
        ],
        "caption": null,
        "score": [
          { "member_id": 22, "name": "임하늘" },
          { "member_id": 24, "name": "최나린" }
        ]
      }
    }
  ]
}
```

> **설계 근거**: ERD의 세로형 `schedule_assignments`를 그대로 노출하면 프론트에서 매번 피벗 로직을 짜야 한다. **서비스 레이어에서 미리 피벗해 응답**하면, 마이크 배치도 컴포넌트는 `singer.mic["1"]`~`["8"]`을 그대로 그리드에 꽂기만 하면 된다. 값이 없는 포지션은 `null`로 내려 프론트가 숨긴다.
>
> **배정된 사람은 문자열이 아니라 `{ "member_id": number | null, "name": string }` 객체**로 내려온다. `member_id`가 있으면 편집 화면이 인명부 드롭다운을 그 값으로 미리 채워 재선택할 수 있고(수정 시 기존 배정이 사라지지 않게 하기 위함), `member_id`가 `null`이면 인명부에 없는 인물(`name_snapshot`만 저장된 경우)이라 이름만 표시하고 드롭다운엔 미리 채우지 못한다.
>
> `singer.score`(싱어 악보)와 `choir`는 배열이다 — 각각 여러 명이 나눠 맡을 수 있어 `positions.is_multi=true`이기 때문. 나머지 단일 슬롯 포지션(`instrument.*`, `singer.mic.*`, `singer.caption`)은 배정이 없으면 `null`, 있으면 위 객체 하나다.

### 2-3. 배정 저장 요청 형식

**`PUT /schedules/{schedule_id}/weeks/{week_id}/assignments`**

```json
{
  "assignments": [
    { "position_code": "mic1", "member_id": 21, "name_snapshot": null },
    { "position_code": "mic2", "member_id": 22, "name_snapshot": null },
    { "position_code": "choir", "member_id": 29, "name_snapshot": null, "slot_order": 1 },
    { "position_code": "choir", "member_id": 30, "name_snapshot": null, "slot_order": 2 },
    { "position_code": "singer_score", "member_id": 22, "name_snapshot": null, "slot_order": 1 },
    { "position_code": "singer_score", "member_id": 23, "name_snapshot": null, "slot_order": 2 },
    { "position_code": "key1", "member_id": null, "name_snapshot": "01우진" }
  ]
}
```

- `member_id`와 `name_snapshot` 중 하나는 필수 (ERD `chk_assignment_identity` 제약과 동일 규칙을 API 레벨에서도 400으로 사전 검증)
- 단일 슬롯 포지션(콰이어/특순/싱어 악보 제외)에 같은 `position_code`가 두 번 들어오면 `400`

---

## 3. 기능 3 — 캘린더

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/calendar?year=2026&month=8` | 해당 월 이벤트 목록 | 불필요 |
| GET | `/calendar/{event_id}` | 이벤트 상세 (참여 인원 포함) | 불필요 |
| POST | `/calendar` | 이벤트 생성 (`source_type=manual`만 허용) | 필요 |
| PATCH | `/calendar/{event_id}` | 이벤트 수정 | 필요 |
| DELETE | `/calendar/{event_id}` | 이벤트 삭제 | 필요 |

- `source_type=auto_from_schedule`인 이벤트를 `PATCH`/`DELETE` 요청하면 **`403 Forbidden`** + `"공지사항에서 수정해주세요"` 메시지 반환 (ERD의 단방향 동기화 원칙을 API 레벨에서도 강제)
- 특순 이벤트 생성/수정/삭제는 API로 직접 호출하지 않는다. **`PATCH /schedules/{schedule_id}/weeks/{week_id}`에서 `special.title`이 바뀌면 서버가 내부적으로 `calendar_events`를 upsert/삭제**한다 (별도 엔드포인트 없음, 서비스 레이어 내부 로직).

---

## 4. 공통 — 인명부

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/members?team=singer&active=true` | 인명부 목록 (배정 드롭다운용, 필터 가능) | 불필요 |
| POST | `/members` | 팀원 추가 | 필요 |
| PATCH | `/members/{member_id}` | 팀원 정보/활동여부 수정 | 필요 |
| DELETE | `/members/{member_id}` | 팀원 삭제 | 필요 |

> `DELETE` 대신 `PATCH`로 `is_active=false` 처리하는 것을 권장 (README 흐름). 실제 하드 삭제는 과거 배정 기록의 `member_id` FK가 `on delete set null`이라 데이터가 깨지진 않지만, "탈퇴 처리"라는 의미가 `is_active`로 더 명확히 드러난다.

---

## 4-1. 인증 / 사용자 (Phase 7)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/auth/signup` | 회원가입. 항상 `member` 역할로 생성된다 | 불필요 |
| POST | `/auth/login` | 로그인 | 불필요 |
| POST | `/auth/refresh` | 리프레시 토큰으로 액세스 토큰 재발급 | 불필요(refresh_token 자체가 자격) |
| GET | `/auth/me` | 내 프로필(이메일·이름·role) 조회 | 필요(로그인만 하면 됨) |
| GET | `/auth/users` | 전체 사용자 목록 (`/admin/users` 화면용) | 필요(admin) |
| PATCH | `/auth/users/{user_id}/role` | 역할 변경. `leader`↔`member`만 가능(admin 부여는 API로 불가) | 필요(admin) |

> `role`은 `member`(기본) / `leader`(콘티·공지·스케줄·캘린더·인명부·곡 마스터 편집 가능) / `admin`(역할 관리까지 가능) 3단계다. 최초 admin 계정은 Supabase SQL로 직접 승격한다(앱에는 admin 발급 경로가 없다).

---

## 5. 엔드포인트 전체 요약

> 2026-08-20 기준 실제 Swagger(`/docs`)와 대조해 갱신했다. 헬스체크(`GET /`)는 제외한 숫자다.

| 그룹 | 엔드포인트 수 | 내역 |
|---|---|---|
| 콘티/곡/악보 | 15 | 콘티 10(AI 인식 포함) + 곡 4 + 파일 삭제 1 |
| 공지사항/스케줄 | 12 | 공지 5 + 스케줄 7 |
| 캘린더 | 5 | |
| 인명부 | 4 | |
| 인증/사용자 | 6 | Phase 7 신설 |
| **합계** | **42** | |

---

## 6. 다음 단계

- [ ] FastAPI 프로젝트 스캐폴딩 (Router - Service - Repository 구조)
- [ ] Pydantic 스키마 정의 (이 문서의 요청/응답 예시를 그대로 모델링)
- [ ] Supabase 클라이언트 연결 (`DATABASE_URL`, `service_role` 키)
- [ ] `/contis` 콘티 CRUD부터 Vertical Slice 착수 (8/19 목표)
- [ ] 완성 후 FastAPI 자동 Swagger(`/docs`)와 본 문서 내용 일치 여부 확인
