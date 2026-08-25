# 프로젝트 컨텍스트 — 청운교회 청년부 주일찬양팀 웹

claude.ai Project("DX스쿨 개인 사이드 프로젝트")의 설계 문서를 Claude Code가 세션 시작 시 자동으로 읽도록 임포트한다. 두 환경은 자동 동기화되지 않으므로, 문서를 이 폴더에 내려받아두고 아래 @import로 로드한다.

@docs/README.md
@docs/문제정의-재료.md
@docs/ERD.md
@docs/API명세.md
@docs/전체_로드맵.md

(`schema.sql`은 대량 DDL이라 항상 불러오지 않는다. 필요할 때 `docs/schema.sql`을 직접 Read해서 참고할 것.)

## 프로젝트 원칙

- 기간: 2026-08-17 ~ 08-28 (10일), LG DX SCHOOL 바이브코딩 개인 사이드 프로젝트
- MVP 범위: 핵심 페르소나 1명(주일찬양팀 리더), 핵심 기능 3개(콘티/공지·스케줄/캘린더)를 넘지 않는다.
- 기능이 많은 것보다 작아도 실제로 동작하는 완성본을 우선한다.
- 로그인/관리자 페이지/복잡한 권한/결제 등은 핵심 기능과 무관하면 제안하지 않는다. 새 기능 제안 시 "핵심 기능 3개 안에 드는가?"를 먼저 점검한다.
- 기술 스택: Backend FastAPI(Python), Frontend React(웹, 모바일 우선 반응형), DB Supabase(PostgreSQL). 이 스택 밖 기술은 꼭 필요한 이유가 없으면 제안하지 않는다.
- 작업 순서: 문제 정의 → MVP 범위 결정 → 최소 설계 사양(PRD/ERD/API 명세) → 구현(Controller-Service-Repository) → 테스트 → 오류 수정 → 운영 반영 → README 정리. 큰 기능도 이 순서로 쪼개 진행한다.
- 화면 → API → 데이터 저장 → 조회까지 한 흐름을 끝까지 동작시키는 것을 우선한다 (Vertical Slice 우선, 디자인은 나중).
- 오류 발생 시 HTTP 요청 → 로그 → 코드 → DB 순으로 원인을 좁혀간다.
- 기술/구조 선택 시 근거를 함께 제시한다.
- 일정: 8/17 문제 정의, 8/18 MVP 확정·환경 세팅, 8/19 핵심 기능 1개 Vertical Slice, 8/20~26 집중 개발, 8/27 최종 테스트/검수, 8/28 배포·README·포트폴리오 마무리. 지금이 일정상 어느 단계인지 감안해 우선순위를 조언한다.

## 디렉터리 구조

- `backend/` — FastAPI 프로젝트. `backend/app/` 하위에 `routers/`(엔드포인트) · `services/`(비즈니스 로직) · `repositories/`(Supabase 접근) · `schemas/`(Pydantic 모델) 계층을 유지한다. 임의로 계층을 늘리거나 줄이지 않는다.
- `frontend/` — React 프로젝트. API 호출은 `frontend/src/api/` 하위로 모은다.
- Frontend-Backend는 REST API로만 통신한다 (`/api/v1/...`, `API명세.md` 기준). SSR·GraphQL 등 다른 통신 방식은 쓰지 않는다.

## 협업 규칙

**코드 주석**: 함수/컴포넌트/엔드포인트 단위로 무엇을 하는지, 왜 그렇게 구현했는지 설명하는 주석을 반드시 남긴다. 특히 (1) 비즈니스 로직 분기, (2) 외부 서비스(Supabase 등) 호출, (3) 복잡한 조건문·계산식에는 한글로 간결한 설명 주석을 추가한다. 자명한 한 줄짜리 코드에는 굳이 달지 않는다.

**불필요한 라이브러리 추가 금지**: 현재 정의된 최소 의존성(FastAPI, Pydantic, Supabase 클라이언트, React, 기본 fetch/axios 등) 외의 라이브러리(상태관리, UI 컴포넌트 프레임워크, ORM 등)는 임의로 추가하지 않는다. 꼭 필요하면 추가 전에 이유를 설명하고 확인받는다.

**Secret 하드코딩 금지**: `EDIT_PASSWORD`, `ANTHROPIC_API_KEY`, Supabase `service_role` 키, `DATABASE_URL` 등은 소스 코드나 커밋되는 설정 파일에 직접 작성하지 않는다. 환경변수 또는 `.env`, `backend/.env.local` 등 버전 관리 제외 파일을 사용하고, 커밋 전 `.gitignore` 포함 여부를 확인한다.

**대량 삭제 금지**: 작업 범위와 무관한 파일·폴더를 임의로 삭제하지 않는다. 삭제가 꼭 필요하면 전에 어떤 파일을 왜 삭제하는지 먼저 설명한다.

**큰 변경 전 계획 설명**: 여러 파일에 걸친 변경, 구조 변경(계층 변경 등), 새 의존성 추가처럼 영향 범위가 큰 작업은 실행 전에 계획을 먼저 설명하고 확인받는다. 단순 오타 수정, 단일 파일 사소한 수정은 예외.

**구현 후 빌드/테스트**: 코드 변경 후 정상 동작을 확인한다.
- Backend: `uvicorn app.main:app --reload` 기동 확인, 테스트가 있으면 `pytest`
- Frontend: `npm run build` (또는 `npm run dev` 기동 확인)
빌드/실행이 실패하면 숨기지 않고 오류 내용을 그대로 알린다.

**작업 마무리 시 안내**: 생성/수정/삭제한 파일 목록, 실행한 주요 명령어, 빌드/테스트 결과를 정리해서 안내한다.

**Codex와의 역할 분리(2026-08-24 확정)**: 이 저장소는 Codex가 구현하고 Claude Code가 검토·커밋하는 방식으로 병행 운영한다. 세션 시작 시 `git status`/`git diff`로 Codex가 남긴 커밋되지 않은 변경이 있는지 먼저 확인하고, 있으면 그 변경을 검토(빌드·테스트, 문서 정합성, 이 파일의 협업 규칙 준수 여부)한 뒤 커밋한다. Codex 쪽 작업 절차는 `AGENTS.md`에 있으며, Codex는 스스로 커밋하지 않으므로 워킹 트리의 미커밋 변경을 사용자의 작업 지시 없이 되돌리지 않는다.

## 이 폴더 안 문서 안내

- `README.md` — 외부 공유용 프로젝트 소개, 주요 기능, 로컬 실행·환경변수·검증 방법
- `docs/README.md` — 내부 제품 정의, 사용자, 현재 기능 범위, AI·권한·제외 원칙 (가장 먼저 읽을 문서)
- `backend/.env.example`, `frontend/.env.example` — Secret 없이 환경변수 이름과 로컬 기본값만 제공하는 설정 예시
- `docs/screenshots/README.md` — 공개 README용 화면 파일명, 촬영 조건, 개인정보 점검 기준
- `docs/문제정의-재료.md` — README보다 상세한 배경 맥락, 실제 데이터 소스, 배제된 대안과 이유
- `docs/ERD.md` — 테이블 19개 구조와 설계 결정 근거 (mermaid ERD 포함)
- `docs/API명세.md` — 실제 Swagger(`/docs`)와 동기화한 63개 엔드포인트 명세
- `docs/schema.sql` — Supabase에 그대로 실행 가능한 DDL (테이블/제약/RLS/seed 데이터 포함)
- `docs/전체_로드맵.md` — Phase 0~13의 설계 결정, 작업 분해, 구현 결과와 트러블슈팅

## 다음 세션에서 이어갈 작업 (2026-08-25 기준)

Phase 0~12(후속 포함) 전부 완료. 콘티/공지사항/인명부/월간 스케줄(배정·마이크 배치도·배정 횟수·참불참 파싱·자동 배정 제안)/대시보드/캘린더(특순·생일 자동 동기화)/AI 콘티 이미지 인식/자막 가사/댓글/정식 로그인(Supabase Auth, admin/leader/member)까지 전부 화면-API-DB 흐름이 동작한다. 자세한 내용은 `docs/전체_로드맵.md`의 각 Phase 절 참고.

**AI 인식 정확도를 건드릴 때**: 프롬프트·모델 설정을 바꾸면 반드시 `backend/tests/ai_parse_baseline.py`로 재측정하고 숫자로 비교할 것(현재 94.8%). 실제 콘티 이미지와 정답은 `backend/tests/fixtures/`에 있고 git에는 없다 — 다른 환경에서는 이미지를 다시 넣어야 한다.

**디자인 개편 0~6단계**와 Phase 13의 테스트 배포까지 완료했다. Frontend는 Vercel
(`everydayworship.vercel.app`), Backend는 Render에 분리 배포했고 운영 CORS도 최종 도메인으로 설정했다.
실제 모바일 기기에서 발견한 로그인 버튼, 캘린더 너비·툴바 문제도 수정했다.

공개용 루트 `README.md`, 내부 제품 정의 `docs/README.md`, 환경변수 예시와 대표 화면 자료를 정리했다.
다음은 **Phase 13 실사용자 테스트 결과 수집과 최종 포트폴리오 정리**다. 남은 확인 사항:

- [ ] 리더십 포함 5~10명의 실제 사용 피드백 수집
- [ ] 키보드 탭 순서와 데스크톱 주요 뷰포트 수동 QA
- [ ] 운영 Supabase에 `docs/schema.sql` 최신 구조(특히 `uq_event_source_member_date`, `members.gender NOT NULL`)가 실제 적용됐는지 확인
- [ ] `AuthContext.jsx`의 `react(only-export-components)` 경고는 의도적으로 보류한 상태 유지 여부 결정

**개발 중 주의**: 백엔드를 고친 뒤에는 `uvicorn --reload`가 변경을 놓치는 경우가 있으므로, 동작이 이상하면 코드보다 `/openapi.json`(Swagger)에 새 필드가 반영됐는지부터 확인하고 서버를 재기동한다. Windows에서는 `--reload`가 리로더(부모)와 워커(자식) 프로세스를 분리 실행해, 리로더만 죽이면 워커가 고아로 남아 옛 코드로 계속 응답하는 경우가 있다 — 재시작 시 `Get-CimInstance Win32_Process`로 모든 python 프로세스(리로더+워커)를 확인해서 정리할 것(Phase 11-B 후속 2에서 원인 확인).

## claude.ai Project와 이 로컬 저장소의 관계

- claude.ai Project 문서를 갱신했다면 `docs/*.md`에도 반영해야 Claude Code가 최신 컨텍스트를 본다 (자동 동기화 없음).
- 로컬에서 설계가 바뀌면 claude.ai Project 쪽 문서도 사람이 직접 갱신해야 한다.
