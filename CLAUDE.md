# 프로젝트 컨텍스트 — 청운교회 청년부 주일찬양팀 웹

이 파일은 claude.ai Project("DX스쿨 개인 사이드 프로젝트")에서 정리된 설계 문서를 Claude Code(VS Code 확장/CLI)가 세션 시작 시 자동으로 읽도록 임포트한다.
claude.ai Project와 Claude Code는 서로 자동 동기화되지 않으므로(2026-08-18 기준 공식 기능 없음), 이 폴더에 문서를 내려받아두고 아래 @import로 항상 로드되게 한다.

@docs/README.md
@docs/문제정의-재료.md
@docs/ERD.md
@docs/API명세.md

(schema.sql은 대량 DDL이라 항상 불러오지 않는다. 필요할 때 `docs/schema.sql`을 직접 Read/열어서 참고할 것.)

## 프로젝트 원칙 (claude.ai Project instructions 요약)

- 기간: LG DX SCHOOL 바이브코딩 개인 사이드 프로젝트, 2026-08-17 ~ 08-28 (10일)
- MVP 범위: 핵심 페르소나 1명(주일찬양팀 리더), 핵심 기능 3개(콘티/공지·스케줄/캘린더)를 넘지 않는다.
- 기능이 많은 것보다 작아도 실제로 동작하는 완성본을 우선한다.
- 로그인/관리자 페이지/복잡한 권한/결제 등은 핵심 기능과 무관하면 제안하지 않는다. 새 기능 제안 시 "핵심 기능 3개 안에 드는가?"를 먼저 점검한다.
- 기술 스택: Backend FastAPI(Python), Frontend React(웹, 모바일 우선 반응형), DB Supabase(PostgreSQL). 이 스택 밖 기술은 꼭 필요한 이유가 없으면 제안하지 않는다.
- 작업 순서: 문제 정의 → MVP 범위 결정 → 최소 설계 사양(PRD/ERD/API 명세) → 구현(Controller-Service-Repository) → 테스트 → 오류 수정 → 운영 반영 → README 정리. 큰 기능도 이 순서로 쪼개 진행한다.
- 화면 → API → 데이터 저장 → 조회까지 한 흐름을 끝까지 동작시키는 것을 우선한다 (Vertical Slice 우선, 디자인은 나중).
- 오류 발생 시 HTTP 요청 → 로그 → 코드 → DB 순으로 원인을 좁혀간다.
- 기술/구조 선택 시 근거를 함께 제시한다.
- 일정: 8/17 문제 정의, 8/18 MVP 확정·환경 세팅, 8/19 핵심 기능 1개 Vertical Slice, 8/20~26 집중 개발, 8/27 최종 테스트/검수, 8/28 배포·README·포트폴리오 마무리. 지금이 일정상 어느 단계인지 감안해 우선순위를 조언한다.

## 프로젝트 구조 & 협업 규칙

> 이전 바이브코딩 실습(`CLAUDE_mini_project.md`, Spring Boot+Oracle 프로젝트)에서 쓰던 협업 규칙 중, 스택에 무관하게 항상 유효한 것들을 이 프로젝트(FastAPI+React+Supabase) 기준으로 다시 정리한 것. 기술 스택이 다르므로 그대로 복사하지 않고 우리 구조에 맞게 고쳤다.

### 디렉터리 구조

- `backend/` — FastAPI 프로젝트. `backend/app/` 하위에 계층형 구조를 따른다: `routers/`(엔드포인트) · `services/`(비즈니스 로직) · `repositories/`(Supabase 접근) · `schemas/`(Pydantic 모델). 새 기능 추가 시에도 이 구조를 유지하고 임의로 계층을 늘리거나 줄이지 않는다.
- `frontend/` — React 프로젝트. API 호출은 `frontend/src/api/` 하위로 모은다.
- Frontend-Backend는 REST API로만 통신한다 (`/api/v1/...`, `API명세.md` 기준). SSR·GraphQL 등 다른 통신 방식은 쓰지 않는다.

### 불필요한 라이브러리 추가 금지

현재 정의된 최소 의존성(FastAPI, Pydantic, Supabase 클라이언트, React, 기본 fetch/axios 등) 외의 라이브러리(상태관리 라이브러리, UI 컴포넌트 프레임워크, ORM 등)는 임의로 추가하지 않는다. 꼭 필요하다고 판단되면 추가 전에 이유를 먼저 설명하고 확인을 받는다.

### Secret을 코드에 직접 작성하지 않기

`EDIT_PASSWORD`, `ANTHROPIC_API_KEY`, Supabase `service_role` 키, `DATABASE_URL` 등 민감한 값을 소스 코드나 커밋되는 설정 파일에 하드코딩하지 않는다.
- 환경변수 또는 `.env`, `backend/.env.local` 등 버전 관리에서 제외된 파일을 사용한다.
- 커밋 전 `.gitignore`에 해당 파일이 포함돼 있는지 확인한다.

### 기존 파일을 대량으로 삭제하지 않기

작업 범위와 무관한 파일·폴더를 임의로 삭제하지 않는다. 삭제가 꼭 필요하면 삭제 전에 어떤 파일을 왜 삭제하는지 먼저 설명한다.

### 큰 변경 전에 계획 먼저 설명하기

여러 파일에 걸친 변경, 구조 변경(Router-Service-Repository 계층 변경 등), 새 의존성 추가처럼 영향 범위가 큰 작업은 실행 전에 계획을 먼저 설명하고 확인받는다. 단순 오타 수정, 단일 파일의 사소한 수정은 예외로 한다.

### 구현 후 빌드 또는 테스트하기

코드 변경 후에는 정상 동작을 확인한다.
- Backend: `uvicorn app.main:app --reload`로 기동 확인, 테스트가 있으면 `pytest`
- Frontend: `npm run build` (또는 `npm run dev`로 기동 확인)
빌드/실행이 실패하면 숨기지 않고 오류 내용을 그대로 알린다.

### 변경한 파일을 작업 마지막에 설명하기

작업을 마칠 때 다음을 정리해서 안내한다.
- 생성/수정/삭제한 파일 목록
- 실행한 주요 명령어
- 빌드/테스트 결과

## 이 폴더 안 문서 안내

- `docs/README.md` — 문제 정의, 타겟 사용자, MVP 범위, 기술 스택 선정 근거, 제외 범위, 구현 우선순위 (가장 먼저 읽을 문서)
- `docs/문제정의-재료.md` — README보다 더 상세한 배경 맥락, 실제 데이터 소스(스프레드시트 구조), 배제된 대안과 이유. README에 없는 세부사항 확인 시 참고
- `docs/ERD.md` — 테이블 12개 구조와 각 설계 결정의 근거 (mermaid ERD 포함)
- `docs/API명세.md` — 31개 엔드포인트 명세 초안. FastAPI 구현 시 이 문서 기준으로 라우터를 만들고, 실제 Swagger(`/docs`)와 동기화 유지
- `docs/schema.sql` — Supabase에 그대로 실행 가능한 DDL (테이블/제약/RLS/seed 데이터 포함)

## 다음 세션에서 이어갈 작업 (2026-08-18 기준)

- [ ] FastAPI 프로젝트 스캐폴딩 (Router - Service - Repository 구조)
- [ ] Supabase 프로젝트 생성 후 `docs/schema.sql` 실행
- [ ] `/contis` 콘티 CRUD부터 Vertical Slice 착수 (8/19 목표)
- [ ] React 프론트 스캐폴딩, 콘티 상세 화면부터

## claude.ai Project와 이 로컬 저장소의 관계

- claude.ai Project 쪽 문서를 갱신했다면, 그 내용을 이 폴더의 `docs/*.md`에도 반영해야 Claude Code가 최신 컨텍스트를 본다 (자동 동기화 없음).
- 반대로 로컬에서 설계가 바뀌면, claude.ai Project 쪽 문서도 사람이 직접 갱신해야 한다.
