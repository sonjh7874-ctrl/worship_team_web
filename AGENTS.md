# AGENTS.md — Codex 작업 지침

이 파일은 이 저장소에서 작업하는 Codex 및 호환 에이전트용 지침이다. 프로젝트의 상세 맥락과 설계는 기존 `CLAUDE.md`와 `docs/` 문서를 단일 출처로 활용하고, 이 파일에는 작업 절차와 안전 규칙만 정리한다.

## 1. 작업 시작 시 반드시 확인할 것

1. 루트의 `CLAUDE.md`를 가장 먼저 끝까지 읽는다.
2. `docs/README.md`와 `docs/전체_로드맵.md`를 읽어 제품 범위와 현재 Phase를 확인한다.
3. 작업에 관련된 문서를 추가로 읽는다.
   - API·인증·응답 형식: `docs/API명세.md`
   - 테이블·관계·설계 근거: `docs/ERD.md`
   - 실제 DDL·제약·RLS: `docs/schema.sql`
   - UI·디자인 토큰: `docs/DESIGN.md`
   - 배경 맥락·배제된 대안: `docs/문제정의-재료.md`
4. `git status --short`로 사용자의 기존 변경을 확인하고 보존한다.
5. 문서 설명만 믿지 말고 관련 코드, 테스트, 설정을 직접 확인한 뒤 작업한다.

### `CLAUDE.md` 동기화 점검

`AGENTS.md`를 읽는 매 세션마다 `CLAUDE.md`도 반드시 다시 확인한다. 다음 중 하나에 해당하면 현재 작업 범위 안에서 `AGENTS.md` 또는 `CLAUDE.md`를 함께 갱신한다.

- `CLAUDE.md`에 새 규칙, 새 문서, 변경된 기술 스택이나 디렉터리 구조가 추가됨
- `docs/전체_로드맵.md`의 현재 Phase와 `CLAUDE.md`의 "다음 세션에서 이어갈 작업"이 불일치함
- 구현 결과로 실행 명령, 테스트 방법, 보안·협업 규칙이 바뀜
- 이 파일의 경로나 설명이 실제 저장소와 달라짐

단, 사용자의 미완성 변경을 추측해 덮어쓰지 않는다. 불일치가 현재 작업과 무관하거나 어느 문서가 맞는지 불명확하면 결과 보고에 명시하고 확인을 요청한다. 현재 상태 판단은 실제 코드와 `docs/전체_로드맵.md`의 최신 기록을 우선하며, `CLAUDE.md`의 날짜가 지난 세션 메모를 맹목적으로 따르지 않는다.

## 2. 프로젝트 핵심 원칙

- 제품은 청운교회 청년부 주일찬양팀용 모바일 우선 반응형 웹이다.
- 핵심 범위는 콘티, 공지·월간 스케줄, 캘린더다. 확장 기능은 로드맵에 확정된 범위만 진행한다.
- 작아도 화면 → REST API → DB 저장·조회가 끝까지 동작하는 Vertical Slice를 우선한다.
- 기술 스택은 FastAPI + React/Vite + Supabase(PostgreSQL)이며, 다른 스택이나 새 의존성을 임의로 도입하지 않는다.
- 브라우저는 Supabase DB를 직접 조회하지 않고 FastAPI의 `/api/v1/...` REST API를 거친다.
- AI 기능은 결과를 제안하고 사람이 검수·확정하는 구조를 유지한다.
- 과장된 문제 서술이나 근거 없는 자동화·범위 확장을 피한다.

## 3. 코드 구조와 구현 규칙

### Backend

- `backend/app/routers/`: HTTP 입출력과 의존성 주입
- `backend/app/services/`: 비즈니스 로직
- `backend/app/repositories/`: Supabase 접근
- `backend/app/schemas/`: Pydantic 요청·응답 모델
- 기존 Controller-Service-Repository 경계를 유지하고, DB 접근을 라우터나 서비스에 새로 흩뿌리지 않는다.
- 인증·권한은 기존 `dependencies.py`, `auth_service.py`, 역할 규칙을 재사용한다.

### Frontend

- 페이지는 `frontend/src/pages/`, 재사용 UI는 `frontend/src/components/`에 둔다.
- API 호출은 `frontend/src/api/`에 모으고 기존 공통 클라이언트와 토큰 처리를 재사용한다.
- `docs/DESIGN.md`의 토큰과 모바일 우선 패턴을 따른다.

### 공통

- 함수, 컴포넌트, 엔드포인트 단위로 "무엇을/왜" 하는지 필요한 한글 주석을 남긴다. 자명한 코드에는 과도하게 달지 않는다.
- 비즈니스 분기, Supabase 같은 외부 호출, 복잡한 조건에는 근거가 드러나는 주석을 우선한다.
- Secret과 실제 비밀번호를 코드, 문서, 로그, 테스트 fixture에 넣지 않는다. `.env.local`은 읽더라도 값은 출력하거나 커밋하지 않는다.
- 관련 없는 파일 삭제, 대규모 포맷 변경, 구조 개편을 하지 않는다.
- 여러 파일을 바꾸는 큰 변경, 새 의존성, 스키마 변경은 먼저 영향 범위와 계획을 설명하고 사용자 확인을 받는다.

## 4. 문서와 스키마 동기화

구현과 문서가 어긋나지 않게 같은 작업에서 필요한 문서를 함께 갱신한다.

- API 추가·변경: `docs/API명세.md` 및 엔드포인트 총계
- 테이블·컬럼·제약 변경: `docs/schema.sql`과 `docs/ERD.md`
- 제품 범위·완료 상태 변경: `docs/README.md`와 `docs/전체_로드맵.md`
- 디자인 규칙 변경: `docs/DESIGN.md`
- 다음 작업이나 현재 Phase가 바뀜: `CLAUDE.md`의 세션 인계 메모도 확인·갱신

Supabase에 적용된 운영 스키마를 로컬 DDL만 보고 단정하지 않는다. 마이그레이션이나 콘솔 적용이 필요한 변경은 실행 여부와 적용 절차를 분명히 보고한다.

## 5. 검증 기준

변경 범위에 맞는 최소 검증을 반드시 수행한다.

- Backend: `cd backend && pytest`; 필요 시 `uvicorn app.main:app --reload`와 `/openapi.json` 확인
- Frontend: `cd frontend && npm run build`; 관련 정적 검사 시 `npm run lint`
- API 스키마가 이상하면 stale reload 가능성을 먼저 배제하고 서버를 완전히 재기동한다.
- AI 콘티 인식 프롬프트나 모델 설정 변경 시 `backend/tests/ai_parse_baseline.py`로 기존 기준과 수치 비교한다. `backend/tests/fixtures/`는 git 제외이며 로컬에 없을 수 있다.
- 테스트를 실행하지 못했거나 실패했다면 이유와 오류를 숨기지 않고 보고한다.

## 6. 작업 종료 보고

최종 응답에는 다음을 간결하게 포함한다.

- 생성·수정·삭제한 파일과 핵심 변경
- 실행한 테스트·빌드 및 결과
- 문서/DB/배포에 남은 수동 작업이나 확인이 필요한 불일치

## 7. 현재 인계 메모

이 절은 편의를 위한 스냅샷이며, 항상 `docs/전체_로드맵.md`의 최신 내용으로 재검증한다.

- 2026-08-24 기준 Phase 11까지 완료됐다.
- 다음 구현은 Phase 12 "싱어팀 자동 배정 제안"이며 SDD는 `docs/전체_로드맵.md`에 확정돼 있다.
- Phase 12는 AI가 아닌 결정론적 순수 로직, 싱어팀 전용, 제안 후 사람 확정, 기존 배정 보존, DB 스키마 변경 없음이 핵심이다.
- 루트 `CLAUDE.md`의 오래된 "다음 Phase 7" 메모는 최신 로드맵과 불일치하므로, 다음 관련 작업에서 최신 상태로 갱신해야 한다.
