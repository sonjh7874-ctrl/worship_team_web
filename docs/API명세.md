# API 명세서 — 청년부 주일찬양팀 웹

> 기준일: 2026-08-18 / Backend: FastAPI / DB: Supabase (PostgreSQL)
> 이 문서는 설계 근거를 담은 초안이다. 실제 API 문서는 FastAPI 구동 시 `/docs` (Swagger UI)에서 자동 생성되며, 이 문서와 동기화되어야 한다.

---

## 0. 공통 규칙

### 0-1. Base URL / 인증

- Base URL: `/api/v1`
- **Supabase Auth 기반 로그인** (Phase 7, 2026-08-20). 일반 콘텐츠 조회(GET)는 비로그인 공개를 유지하되, 개인정보·저작권 또는 민감한 운영 데이터가 포함된 조회는 아래 예외 정책에 따라 인증한다. 쓰기(POST/PATCH/DELETE)는 **역할(role)** 로 게이트한다.
- 인증은 요청 헤더로 전달한다: `Authorization: Bearer <access_token>`. 토큰은 `POST /auth/login`(또는 `/auth/signup`) 응답의 `access_token`이다.
- 서버는 이 토큰을 Supabase Auth로 검증한 뒤, `user_profiles.role`을 조회해 등급을 비교한다(`app/dependencies.py`의 `require_role(min_role)`). 등급은 `member < leader < admin` — `require_role("leader")`는 leader 이상을, `require_role("admin")`은 admin만 통과시킨다.
  - 헤더가 없거나 토큰이 무효/만료: `401 Unauthorized`
  - 역할이 부족: `403 Forbidden`
- 콘티/곡/파일/공지사항/스케줄/캘린더/인명부의 **쓰기 엔드포인트는 모두 `require_role("leader")`**. 사용자 관리(`/auth/users` — 목록 조회·역할 변경·비밀번호 초기화)만 `require_role("admin")`이고, 내 정보 조회·수정·비밀번호 변경(`/auth/me`)은 로그인만 하면 된다(`require_role("member")`).
- **예외 — 가사 관련 조회(GET)는 member 이상 필요**: `GET /songs/{song_id}/sections`, `GET /contis/{conti_id}/lyrics`(Phase 9). 저작권 있는 콘텐츠라 일반 공개 조회와 달리 비로그인 접근은 `401`이다.
- **예외 — 인명부 조회(GET)는 member 이상 필요**: `GET /members`는 이름·성별·생년월일 등 개인정보를 포함하므로 `require_role("member")`를 적용한다. 프론트도 비로그인 상태에서는 홈 진입점과 상단 인명부 메뉴를 숨기고, `/members` 직접 접근은 로그인 화면으로 보낸다(2026-08-24 개인정보 보호 후속).
- **예외 — 댓글은 작성/수정/삭제만 로그인 필요**: `POST/PATCH/DELETE /notices/{id}/comments`, `/calendar/{id}/comments`(Phase 10)는 `require_role("member")`이지만, **목록 조회(GET)는 다른 콘텐츠와 동일하게 비로그인 공개**다. 수정은 작성자 본인만, 삭제는 본인 또는 `leader` 이상만 가능하도록 서비스 레이어에서 소유권을 추가로 검사한다(역할 게이트만으로는 표현할 수 없는 리소스 소유권 비교).
- **예외 — 참/불참 조회는 leader 이상 필요**: `GET/PUT /schedules/availability`(Phase 11-B)는 조회(`GET`)도 `require_role("leader")`다. 참/불참 사유(`결혼식`, `가족일정` 등)가 팀원 개인 사정을 담은 텍스트라, 다른 도메인의 "조회는 비로그인 공개" 원칙과 달리 리더십 전용으로 좁혔다. `GET /schedules/{schedule_id}/weeks/{week_id}/suggestions`(Phase 12)도 이 참/불참 데이터에서 파생된 값이라 같은 이유로 leader 이상만 조회할 수 있다.
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

- `GET /songs` 응답의 각 곡에는 `usage_count`(이 곡이 배치된 콘티 수)와 `section_count`(등록된 가사 구간 수, Phase 9)가 함께 내려간다. 둘 다 곡 관리 화면(`/songs`)이 삭제 가능 여부와 "가사 등록됨/미등록" 배지를 미리 보여주기 위한 값이며, 중첩 count 집계라 조회 횟수는 늘지 않는다.
- `DELETE`는 `usage_count > 0`이면 **409**로 거부한다. `conti_songs.song_id` FK가 `on delete restrict`라 그냥 지우면 DB 오류가 500으로 새어 나가고, 무엇보다 과거 콘티의 곡 정보가 깨지기 때문이다. AI 인식이 제목을 잘못 읽어 생긴 곡처럼 **아직 어디에도 안 쓰인 찌꺼기만** 지울 수 있다.

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/songs/{song_id}/sections` | 곡의 구간별 가사 목록 (A/B/C ...) | **member 이상** |
| PUT | `/songs/{song_id}/sections` | 구간 배열 전체 교체 | 필요(leader) |

- 구간 저장(`PUT`)은 `conti_songs`/`schedule_assignments`와 동일한 전체 교체 패턴이다 — 한 화면에서 구간 전체를 확인·수정하고 저장 버튼 한 번으로 반영한다.
- 요청 본문은 `{"sections": [{"section_code": "A1", "lyrics": "...", "display_order": 0, "aliases": ["A"]}, ...]}`. `aliases`는 같은 가사를 가리키는 다른 표기(곡마다 송폼 표기가 바뀌는 경우 대비, 예: `A1` 등록 시 별칭에 `A` 추가)로 생략 시 빈 배열이다. **구간 코드와 별칭을 합친 전체 이름공간에서 중복이 있으면 400**(DB 유니크 제약과 별개로 API 레벨에서 사전 검증).
- `GET`/`PUT` 응답은 `{"sections": [...], "last_song_form": "..." | null}` 형태다. `last_song_form`은 이 곡이 가장 최근 콘티에서 쓰인 송폼 원문으로, 어떤 코드로 등록해야 할지 감을 잡는 힌트용이다(편집 대상 아님, `song_repository.find_last_song_forms` 재사용).
- **가사는 저작권 있는 콘텐츠라 조회(`GET`)도 `member` 이상 로그인이 필요하다** — 다른 조회 엔드포인트와 달리 비로그인 접근은 401.

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

### 1-6. 콘티 자막용 가사 (Phase 9)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/contis/{conti_id}/lyrics` | 콘티의 자막용 가사(송폼 순서로 조합된 결과) | **member 이상** |

- **저장하지 않고 매 요청마다 계산한다.** `conti_songs.song_form`을 파서로 토큰 분류한 뒤 `song_sections`와 매칭해 조합한다 — 저장해두면 가사를 고친 뒤 결과가 옛날 값으로 남는 "원본-사본 불일치" 문제가 재발하기 때문이다.
- 응답은 곡별로 `blocks` 배열(각 블록은 `kind`: `lyrics` | `marker` | `unresolved`)을 담는다. `unresolved_count`(곡별)와 `unresolved_total`(콘티 전체)로 해석 실패 건수를 함께 내려준다.
- **송폼 해석 실패는 에러가 아니다.** 등록되지 않은 구간 코드나 가사 첫 구절이 그대로 토큰인 경우(`kind: "unresolved"`)는 원문 그대로 담아 반환하고, 프론트가 해당 곡의 구간 등록 화면(`/songs/{song_id}/sections`) 링크를 함께 보여준다. 한 번 등록하면 다음 조회부터 자동으로 해결된다.
- 변주 표기(`C*` → `C`)로 대체 매칭됐거나, 반복(`x2`)으로 복제됐거나, 인용 딸린 지시(`bis(...)`/`Tag(...)`)가 등록된 구간 없이 인용 원문으로 대체된 경우는 각 블록의 `note` 필드에 그 사실을 남긴다.

**응답 예시**

```json
{
  "conti_id": 12,
  "service_date": "2026-08-09",
  "title": "주일예배",
  "songs": [
    {
      "order_no": 1,
      "song_id": 3,
      "title": "삶의 예배",
      "artist": "아이자야",
      "song_key": "G-A",
      "song_form": "(4) A1 A2 B (맞4) A2 B (맞4) (up) B B",
      "blocks": [
        { "kind": "lyrics", "section_code": "A1", "text": "...", "note": null },
        { "kind": "marker", "section_code": null, "text": "(4)", "note": null },
        { "kind": "unresolved", "section_code": null, "text": "B'", "note": null }
      ],
      "unresolved_count": 1
    }
  ],
  "unresolved_total": 1
}
```

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
| GET | `/schedules/assignment-counts?year=2026&month=8` | 마이크 1~8 배정 횟수(해당 월 + 올해 누적, Phase 11-A) | 불필요 |
| POST | `/schedules` | 월 스케줄 생성 (`year`, `month`) | 필요 |
| DELETE | `/schedules/{schedule_id}` | 월 스케줄 삭제 (주차·배정 CASCADE) | 필요 |
| POST | `/schedules/{schedule_id}/weeks` | 주차 추가 | 필요 |
| PATCH | `/schedules/{schedule_id}/weeks/{week_id}` | 주차 정보 수정 (비고/불참사항/특순) | 필요 |
| DELETE | `/schedules/{schedule_id}/weeks/{week_id}` | 주차 삭제 | 필요 |
| PUT | `/schedules/{schedule_id}/weeks/{week_id}/assignments` | **해당 주차의 배정 전체 교체** | 필요 |
| GET | `/schedules/{schedule_id}/weeks/{week_id}/suggestions` | 그 주차의 싱어팀 마이크/콰이어 자동 배정 제안(Phase 12) | 필요(leader) |

> **부모 `schedule_id` 검증(전체_구현_점검_보고서.md 2-2절 수정)**: 위 `PATCH`/`DELETE weeks/{week_id}`와
> `PUT .../assignments`는 URL의 `week_id`가 실제로 존재하더라도, 그 주차의 실제 부모 `schedule_id`가
> URL의 `schedule_id`와 다르면 `404`를 반환하고 아무것도 바꾸지 않는다. `suggestions` 엔드포인트가
> 이미 쓰던 부모-자식 일치 검증(Phase 12)을 나머지 세 엔드포인트에도 동일하게 적용한 것이다 —
> 이전에는 `week_id`만 맞으면 잘못된 `schedule_id`로도 다른 달의 주차를 수정·삭제할 수 있었다.
| POST | `/schedules/availability/ai-parse` | 여러 명 참/불참 텍스트를 AI로 구조화(저장 안 함, Phase 11-B) | 필요 |
| GET | `/schedules/availability?year=2026&month=8&team=singer` | 해당 월·팀의 참/불참 제출 현황 조회(Phase 11-B) | 필요(leader) |
| PUT | `/schedules/availability?year=2026&month=8&team=singer` | 해당 월·팀의 참/불참 제출 전체 교체(확정 저장, Phase 11-B) | 필요 |

> **설계 근거**: 배정도 콘티-곡 배치와 동일하게, 리더십이 "이번 주 포지션표 전체"를 한 화면에서 입력하고 저장 버튼 한 번으로 반영하는 흐름이다. 포지션 19개 중 채워진 것만 배열로 보내면 서버가 `schedule_assignments`를 통째로 교체한다.

**`GET /schedules/assignment-counts?year=2026&month=8` 응답 예시 (Phase 11-A)**

```json
{
  "year": 2026, "month": 8,
  "counts": [
    { "member_id": 21, "name": "정승주", "month_count": 2, "year_count": 11 },
    { "member_id": 22, "name": "임하늘", "month_count": 1, "year_count": 9 }
  ]
}
```

- **집계 대상은 마이크 1~8번 포지션뿐이다.** 콰이어·싱어 악보·자막·악기 포지션은 세지 않는다 — 싱어/악기는 별도 팀으로 보고,
  콰이어 횟수는 배정 형평성 판단에 중요하지 않다는 실사용 판단(2026-08-21)에 따른 것이다.
- `month_count`는 요청한 `year`/`month`의 배정 횟수, `year_count`는 그 해 전체 누적이다. 그 해에 마이크 배정이 한 번도 없는
  팀원은 `counts` 배열에 아예 담기지 않는다(0으로 채우지 않음) — 프론트가 인명부 목록을 이미 갖고 있어 없으면 0으로 취급한다.
- `member_id`가 없는 배정(인명부에 없는 인물, `name_snapshot`만 저장된 경우)은 집계에서 제외한다 — 애초에 배정 드롭다운
  선택지에 없어 숫자를 붙일 자리가 없다(ERD 3-3).
- **표시 위치는 `ScheduleEdit`의 마이크 1~8 드롭다운뿐**이다. 숫자는 항상 저장된 DB 기준이라, 아직 저장하지 않은 화면상의
  배정 변경은 반영되지 않는다.

**`GET /schedules/{schedule_id}/weeks/{week_id}/suggestions` 응답 예시 (Phase 12)**

```json
{
  "week_id": 9,
  "service_date": "2026-08-02",
  "has_availability": true,
  "mic": [
    { "member_id": 21, "name": "정승주", "month_count": 0, "year_count": 9, "slot": 1 },
    { "member_id": 23, "name": "서다은", "month_count": 1, "year_count": 7, "slot": 3 }
  ],
  "choir": [
    { "member_id": 29, "name": "노유안", "month_count": 2, "year_count": 11 }
  ],
  "skipped": {
    "already_assigned": ["임하늘"],
    "unavailable": ["김예진"],
    "unknown": ["백지은"]
  }
}
```

- Phase 11의 데이터(참/불참 + 마이크 배정 횟수) 위에 **순수 로직(AI 아님)** 만 얹어 "참석 가능 + 배정 적은 순"으로
  싱어팀 마이크·콰이어를 제안한다. **자동 확정이 아니라 제안**이고 최종 배정은 사람이 한다.
- **악기 포지션은 대상이 아니다** — 인원이 9명뿐이고 포지션별 가능 여부가 인명부에 없어 자동화 이득이 적다.
- `mic` 배열에는 **비어 있던 슬롯만** 담긴다. 이미 채워진 슬롯(리드보컬·특순 등 예외 배치)은 절대 덮어쓰지 않고,
  그 슬롯에 배정된 사람은 `choir`를 포함해 후보 풀에서도 제외된다(`skipped.already_assigned`).
- **정렬은 이번 달 배정 횟수 → 올해 누적 → 이름순**이다. 참석 여부가 불확실한 사람(미제출 또는 그 주일 정보가
  없는 제출)과 그 주일에 불참으로 확인된 사람은 각각 `skipped.unknown`/`skipped.unavailable`로 분류되고
  추천 대상에서 제외된다 — 참석이 확인된 사람만 제안해야 신뢰할 수 있는 추천이 된다.
- **마이크 슬롯은 성별이 고정이다(Phase 12 후속, ERD 3-11)** — 1·4·5·8번은 남자, 2·3·6·7번은 여자 자리라
  슬롯마다 해당 성별 후보를 위 정렬 순서대로 우선 채우고, 그 성별 후보가 소진되면 다른 성별로 대체한다.
  응답 스키마 자체에는 성별 필드가 없다(인명부 `gender`를 서버 내부 판단에만 쓴다).
- **콰이어 추천은 마이크에 안 뽑히고 남은 참석 가능자 전원**이다(인원수 상한 없음, 성별도 가리지 않는다).
- 그 달 싱어팀 참/불참 제출이 하나도 없으면 `has_availability: false`이고 `mic`/`choir`는 빈 배열이다 — 프론트가
  추천 버튼을 비활성화하고 `/schedules/availability` 화면으로 안내한다.
- **추천 결과는 저장하지 않는다.** 매 요청 계산하므로 참/불참이나 배정이 바뀌면 다음 조회에 곧바로 반영된다.
- 조회(`GET`)도 leader 이상만 가능하다 — 참석 가능 여부가 리더십 전용인 참/불참 데이터(2-2절 참/불참 파싱 참고)에서
  파생된 값이기 때문이다.

**참/불참 텍스트 파싱 (Phase 11-B)**

카톡에 올라오는 자유 텍스트(참·불참 명단)를 콘티 이미지 인식(1-4절)과 동일한 "AI가 구조화 → 사람이 검수 → 확정 저장"
패턴으로 처리한다. 저장 단위는 "날짜별 항목 + 월 단위 기본값" 조합이다 — `29일 불참(결혼식), 30일 참`처럼 한 주차
페어 안에서도 날짜별로 상태가 갈리는 실제 사례가 있어, 주차 단위가 아니라 날짜 단위로 저장한다. `전참`/`전체 불참(사유)`
같은 축약형은 그 달의 실제 날짜를 계산하지 않고 기본값 자체로만 저장한다.

`POST /schedules/availability/ai-parse` 요청/응답 예시:

```json
// 요청 — team은 이 붙여넣기가 어느 팀 화면에서 이뤄졌는지를 나타낸다.
{ "text": "8월 섬김 일정 (서유진)\n1,2일 참\n...\n\n8월 섬김 일정 (송지오)\n\n전참/ 특새 참", "year": 2026, "month": 8, "team": "singer" }
```

```json
// 응답 — DB에 저장하지 않는다. 사람이 검수 후 PUT /schedules/availability로 확정 저장한다.
{
  "people": [
    {
      "name_raw": "서유진",
      "matched_member_id": 29,
      "match_status": "matched",
      "matched_member_team": "singer",
      "default_status": null,
      "default_reason": null,
      "entries": [
        { "date": "2026-08-29", "status": "unavailable", "reason": "결혼식" },
        { "date": "2026-08-30", "status": "available", "reason": null }
      ],
      "raw_text": "8월 섬김 일정 (서유진)\n1,2일 참\n..."
    },
    {
      "name_raw": "송지오",
      "matched_member_id": 27,
      "match_status": "matched",
      "matched_member_team": "singer",
      "default_status": "available",
      "default_reason": null,
      "entries": [],
      "raw_text": "8월 섬김 일정 (송지오)\n\n전참/ 특새 참"
    }
  ]
}
```

- **날짜는 서버가 계산한다.** 모델에게는 "일(day)" 숫자만 뽑게 하고, 서버가 요청받은 `year`/`month`와 조합해 실제
  날짜를 만든다 — 콘티 이미지 인식(1-4절)의 "날짜는 서버가 계산" 원칙과 동일하게, 모델이 연/월을 잘못 짚는 위험을
  원천 차단한다.
- **특새(특별새벽집회) 관련 줄은 파싱 대상이 아니다.** 정기 주일 스케줄과 테이블 구조 자체가 달라 이번 범위에서
  제외했다. 텍스트에 `특새 참` 같은 줄이 있어도 결과에 포함하지 않는다.
- **이름 매칭은 곡 매칭(1-4절)과 동일 패턴** — 정규화 완전 일치로 인명부와 자동 매칭하고, 실패하면
  `match_status: "unmatched"`로 표시해 검수 화면에서 사람이 인명부 선택 또는 미등록 인물로 확정한다.
- **`matched_member_team`은 매칭된 인명부 사람의 실제 팀이다.** 요청의 `team`과 다르면(예: 싱어팀 화면에서
  붙여넣었는데 인명부상 악기팀원과 매칭된 경우) 프론트가 경고를 보여준다 — 저장은 막지 않는다(후속, 실사용 피드백).
- **조회(`GET`)도 leader 이상만 필요하다.** 다른 도메인(콘티/공지/스케줄)의 조회는 비로그인 공개지만, 참/불참
  사유(`결혼식`, `가족일정` 등)는 팀원 개인 사정을 담은 텍스트라 리더십 전용으로 좁혔다.
- **저장(`PUT`)·조회(`GET`)는 모두 `team`으로 범위가 좁혀진다.** 싱어팀장·악기팀장이 각자 자기 팀 데이터만
  독립적으로 관리하므로, `PUT`은 그 달-그 팀의 제출 전체만 교체한다(`conti_songs`/`schedule_assignments`와 동일한
  delete-then-insert 패턴이되 team으로 한 번 더 좁힘). 한쪽 팀이 저장해도 다른 팀 데이터는 전혀 건드리지 않는다
  — 초기 구현은 `team` 없이 그 달 전체를 교체했는데, 두 팀장이 각자 저장하면 서로의 데이터를 지우는 문제가 있어
  후속으로 team을 저장 범위에 포함시켰다.
- **이 API는 저장·조회까지만 하고, 배정 화면(`ScheduleEdit`)과 연동되지 않는다.** 불참자를 배정 드롭다운에서
  자동으로 걸러내거나 추천에 반영하는 것은 Phase 12(싱어팀 자동 배정 제안)의 범위다.

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

### 2-4. 공지사항 댓글 (Phase 10)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/notices/{notice_id}/comments` | 댓글 목록(작성순) | 불필요 |
| POST | `/notices/{notice_id}/comments` | 댓글 작성 | member |
| PATCH | `/notices/{notice_id}/comments/{comment_id}` | 댓글 수정(본인만) | member(+소유권) |
| DELETE | `/notices/{notice_id}/comments/{comment_id}` | 댓글 삭제(본인 또는 leader 이상) | member(+소유권 또는 leader) |

캘린더 이벤트 댓글(3-1절)과 완전히 동일한 패턴 — 상세 설계는 3-1절 참고.

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
- **생일 자동 이벤트 (Phase 12 후속, ERD 3-12)**: `source_type=auto_birthday`인 이벤트도 위와 동일하게
  `PATCH`/`DELETE`가 `403 Forbidden`(`"인명부에서 생년월일을 수정해주세요"`)으로 막힌다. 특순과 달리 저장
  시점에 동기화되는 게 아니라, **`GET /calendar?year=&month=`로 그 달을 조회할 때마다** 활동 중인 팀원의
  `birth_date`를 다시 계산해 upsert/삭제한다(자주 보는 화면일수록 최신 상태로 스스로 정리되는 레이지 동기화).
  응답의 `source_member_id`가 이벤트가 가리키는 팀원(`members.id`)이며, 카테고리는 항상 `생일`이다.
  `생일`은 특순(`특순`)과 달리 수동 생성 카테고리 목록에 없어 `POST /calendar`로 직접 만들 수 없다.

### 3-1. 캘린더 이벤트 댓글 (Phase 10)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/calendar/{event_id}/comments` | 댓글 목록(작성순) | 불필요 |
| POST | `/calendar/{event_id}/comments` | 댓글 작성 | member |
| PATCH | `/calendar/{event_id}/comments/{comment_id}` | 댓글 수정(본인만) | member(+소유권) |
| DELETE | `/calendar/{event_id}/comments/{comment_id}` | 댓글 삭제(본인 또는 leader 이상) | member(+소유권 또는 leader) |

- 로그인 여부와 무관하게 조회만 가능해 "로그인의 실질적 이점이 없다"는 실사용 피드백에서 나온 기능(README 5절). **목록 조회는 비로그인 공개를 유지하고 작성만 로그인(member 이상)을 요구**한다 — Phase 9 가사 조회와 달리 저작권 문제가 없어 조회까지 좁힐 이유가 없다.
- 응답(`CommentItem`)에는 `can_edit`/`can_delete`를 서버가 미리 계산해 내려준다: 수정은 작성자 본인만, 삭제는 본인 또는 `leader` 이상 가능(README 확정 사항). 프론트가 "현재 로그인한 사용자 id/역할"과 "댓글 작성자 id"를 비교하는 로직을 중복 구현하지 않게 하기 위함(Phase 6 `match_status`와 같은 접근).
- `author_name`은 **작성 시점 `display_name` 스냅샷**이다. 조회 때마다 `user_profiles`를 조인하지 않아 단순하고, 작성자가 나중에 표시 이름을 바꿔도(Phase 7 후속 `/profile`) 과거 댓글의 표기는 바뀌지 않는다.
- 삭제는 **완전 삭제**(하드 delete)다 — 스레드 구조가 아니라 단순 목록이라 "삭제된 댓글" 흔적을 남길 실익이 적다.
- `is_edited`는 별도 컬럼 없이 `updated_at != created_at` 비교로 판단한다. **내용이 실제로 바뀌지 않았으면 `PATCH`가 DB `UPDATE` 자체를 건너뛴다** — 그냥 실행하면 트리거가 `updated_at`을 무조건 갱신해 "(수정됨)"이 잘못 표시되는 버그가 있었다(Phase 10 후속).
- **댓글 내용은 최대 1000자**(`400`으로 거부). 도배성 장문 게시를 막는 최소한의 상한.
- `PATCH`/`DELETE`는 `comment_id`뿐 아니라 **URL의 `notice_id`/`event_id`가 실제 댓글의 부모와 일치하는지도 검증**한다(불일치 시 `404`) — 처음엔 `comment_id`만 보고 판정해 URL의 부모 id가 사실상 무의미했던 정합성 버그가 있었다(Phase 10 후속).
- `POST`는 부모(`notice_id`/`event_id`)가 존재하지 않으면 `404`를 반환한다. 존재 확인 없이 바로 insert하면 FK 위반이 그대로 `500`으로 새어나가 원본 DB 에러 메시지가 노출되는 문제가 있었다(Phase 10 후속).
- `GET /notices`, `GET /calendar` 목록 응답의 각 항목에는 **`comment_count`**가 함께 내려간다(Phase 10 후속) — 상세로 들어가지 않아도 댓글이 있는지 알 수 있게 하기 위함. `songs.usage_count`와 같은 중첩 집계 패턴(`select(..., notice_comments(count))`)이라 조회 횟수는 늘지 않는다.

```json
{
  "id": 12, "author_name": "손지헌", "content": "확인했습니다!",
  "created_at": "2026-08-21T10:00:00+09:00", "updated_at": "2026-08-21T10:00:00+09:00",
  "is_edited": false, "can_edit": true, "can_delete": true
}
```

---

## 4. 공통 — 인명부

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/members?team=singer&active=true` | 인명부 목록 (배정 드롭다운용, 필터 가능) | 로그인 필요 (`member` 이상) |
| POST | `/members` | 팀원 추가 | 필요 |
| PATCH | `/members/{member_id}` | 팀원 정보/활동여부 수정 | 필요 |
| DELETE | `/members/{member_id}` | 팀원 삭제 | 필요 |

> `DELETE` 대신 `PATCH`로 `is_active=false` 처리하는 것을 권장 (README 흐름). 실제 하드 삭제는 과거 배정 기록의 `member_id` FK가 `on delete set null`이라 데이터가 깨지진 않지만, "탈퇴 처리"라는 의미가 `is_active`로 더 명확히 드러난다.

**`gender`/`birth_date` (Phase 12 후속)**: `POST /members` 요청에 `gender`(`"male"` | `"female"`, **필수**)가
추가됐다 — 싱어팀 마이크 1~8번 무대 배치가 성별 고정이라(ERD 3-11) 배정 제안 알고리즘이 이 값을 직접 쓴다.
`birth_date`(`"YYYY-MM-DD"`, 선택)도 함께 추가됐다 — 있으면 캘린더에 생일이 매년 자동 표시된다(ERD 3-12).
`PATCH`는 두 필드 모두 부분 수정 가능(생략하면 변경 없음). `GET /members` 응답의 각 항목에도 두 필드가
포함된다.

---

## 4-1. 인증 / 사용자 (Phase 7)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/auth/signup` | 회원가입. 항상 `member` 역할로 생성된다 | 불필요 |
| POST | `/auth/login` | 로그인 | 불필요 |
| POST | `/auth/refresh` | 리프레시 토큰으로 액세스 토큰 재발급 | 불필요(refresh_token 자체가 자격) |
| GET | `/auth/me` | 내 프로필(이메일·이름·role) 조회 | 필요(로그인만 하면 됨) |
| PATCH | `/auth/me` | 내 표시 이름(`display_name`) 수정. 가입 시 정한 이름을 본인이 직접 바꿀 수 있다(`/profile` 화면) | 필요(로그인만 하면 됨) |
| GET | `/auth/users` | 전체 사용자 목록 (`/admin/users` 화면용) | 필요(admin) |
| PATCH | `/auth/users/{user_id}/role` | 역할 변경. `leader`↔`member`만 가능(admin 부여는 API로 불가) | 필요(admin) |
| POST | `/auth/users/{user_id}/password` | 비밀번호 초기화. 서버가 무작위 임시 비밀번호를 생성해 `{ "temp_password": "..." }`로 1회 반환하고, 해당 사용자의 `force_password_change`를 `true`로 켠다 | 필요(admin) |
| POST | `/auth/me/password` | 내 비밀번호 변경(6자 이상). 성공 시 `force_password_change`가 `false`로 풀린다 | 필요(로그인만 하면 됨) |
| GET | `/auth/users/{user_id}/events` | 계정 이벤트 로그 조회(이름 변경/역할 변경/비밀번호 초기화, 최신순) | 필요(admin) |
| DELETE | `/auth/users/{user_id}` | 계정 완전 삭제(하드 삭제, 되돌릴 수 없음). 자기 자신·admin 계정은 삭제 불가 | 필요(admin) |

> `role`은 `member`(기본) / `leader`(콘티·공지·스케줄·캘린더·인명부·곡 마스터 편집 가능) / `admin`(역할 관리까지 가능) 3단계다. 최초 admin 계정은 Supabase SQL로 직접 승격한다(앱에는 admin 발급 경로가 없다).
>
> **비밀번호 재설정은 이메일을 보내지 않는다.** 22명 규모의 폐쇄형 팀이라 "리더에게 요청 → 리더가 초기화 → 본인에게 직접 안내"가 실제 운영 흐름과 맞고, Supabase 무료 티어의 발송 한도·스팸함 문제(회원가입 이메일 인증과 동일한 이슈)를 피할 수 있다. 임시 비밀번호는 관리자가 확인하는 그 순간에만 응답으로 노출되고 서버 어디에도 저장되지 않으며, `force_password_change`가 켜져 있으면 로그인 직후 프론트가 `/change-password` 화면으로 강제 이동시켜 본인이 즉시 새 비밀번호로 바꾸게 한다.
>
> **계정 이벤트 로그(`account_events`, Phase 7 후속)**: admin이 표시 이름 변경·역할 변경·비밀번호 초기화 3가지를 이력으로 확인할 수 있다. 전체 CRUD를 추적하는 범용 감사로그가 아니라 admin이 실제로 다루는 계정 보안 이벤트로 범위를 좁혔다. `password_reset` 이벤트는 비밀번호 값 자체를 남기지 않고 발생 사실만 기록한다.
>
> **계정 삭제(Phase 13 후속)**: 이메일 인증을 꺼둔 상태라(README 6절) 잘못된 이메일로 가입했거나 테스트로
> 만든 계정을 정리할 수단이 없었던 문제를 보완했다. `auth.users`를 완전히 지우는 하드 삭제이며
> `user_profiles`는 FK CASCADE로 함께 삭제된다. 자기 자신은 삭제할 수 없고(관리자 0명 사고 방지와
> 같은 부류의 방어), `admin` 역할 계정도 삭제할 수 없다(admin 부여를 SQL로만 하는 것과 대칭 —
> 관리자 계정의 소멸 경로도 앱에 두지 않는다). `account_events.user_id`가 `on delete cascade`라 삭제
> 즉시 그 계정의 이벤트 로그도 함께 사라지므로, 이 액션 자체는 별도로 로그에 남기지 않는다.

---

## 5. 엔드포인트 전체 요약

> 2026-08-24 기준 실제 Swagger(`/docs`)와 대조해 갱신했다. 헬스체크(`GET /`)는 제외한 숫자다.

| 그룹 | 엔드포인트 수 | 내역 |
|---|---|---|
| 콘티/곡/악보 | 18 | 콘티 11(AI 인식 + 자막 가사 포함) + 곡 4 + 곡 가사 구간 2(Phase 9) + 파일 삭제 1 |
| 공지사항/스케줄 | 21 | 공지 5 + 공지 댓글 4(Phase 10) + 스케줄 7 + 배정 횟수 조회 1(Phase 11-A) + 참/불참 파싱 3(Phase 11-B) + 싱어팀 배정 제안 1(Phase 12) |
| 캘린더 | 9 | 이벤트 5 + 이벤트 댓글 4(Phase 10) |
| 인명부 | 4 | |
| 인증/사용자 | 11 | Phase 7 신설(비밀번호 초기화·변경·내 정보 수정 3개 추가) + 계정 이벤트 로그(Phase 7 후속) 1개 + 계정 삭제(Phase 13 후속) 1개 |
| **합계** | **63** | |

---

## 6. 다음 단계

- [ ] FastAPI 프로젝트 스캐폴딩 (Router - Service - Repository 구조)
- [ ] Pydantic 스키마 정의 (이 문서의 요청/응답 예시를 그대로 모델링)
- [ ] Supabase 클라이언트 연결 (`DATABASE_URL`, `service_role` 키)
- [ ] `/contis` 콘티 CRUD부터 Vertical Slice 착수 (8/19 목표)
- [ ] 완성 후 FastAPI 자동 Swagger(`/docs`)와 본 문서 내용 일치 여부 확인
