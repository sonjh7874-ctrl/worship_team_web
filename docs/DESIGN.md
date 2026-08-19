# 청운교회 청년부 주일찬양팀 웹 — Design System Reference

> 상시 컨텍스트용 요약본. 프론트(React, 모바일 우선 반응형) 구현 시 이 문서를 기준으로 컴포넌트를 만든다.
> 기준일: 2026-08-18 / 대상: 팀원 약 22명이 매주 실사용하는 소규모 유틸리티 웹 (마케팅 랜딩페이지 아님)

## Brand Snapshot

청년부 찬양팀 전용 경량 도구. Tone: **차분하고, 명확하고, 부담 없음** — "카톡방에 흩어진 콘티·스케줄을 한 곳에 모으는 조용한 도구." 광고성 임팩트나 화려함이 아니라, **매주 켜서 빠르게 확인하고 닫는 실용 도구**로서의 신뢰감이 목표다. 기존 `그리팅` 계열(엔터프라이즈 B2B SaaS, 파란색 단일 강조, 진한 대비, 마케팅 크레센도 레이아웃) 톤은 이 프로젝트와 맞지 않아 폐기하고, 아래 기준으로 새로 정의한다.

**Do:** 정보 밀도를 낮게, 터치 타깃을 크게, 빈 값은 숨기고, 상태(초안/게시·불참·특순)를 색이 아닌 텍스트/뱃지로도 항상 병기.
**Don't:** 마케팅 사이트풍 큰 히어로 타이포, 드롭섀도 남발, 화려한 그라디언트, 존댓말 톤을 벗어난 캐주얼체.

## Color Tokens

교회 청년부 대상 커뮤니티 도구다운 **차분한 인디고 + 따뜻한 앰버** 투톤. 파랑은 신뢰/명료함(콘티·스케줄 정보), 앰버는 따뜻함/강조(특순·축복송·공지 고정) 용도로 역할을 분리한다.

| Token | Hex | Role |
|---|---|---|
| primary | `#4C5FD5` | 단일 핵심 액션 — 저장/게시 버튼, 활성 탭, 링크 |
| primary-hover | `#5E70E0` | primary 호버 |
| primary-soft | `#EEF0FC` | primary 배경 틴트 (선택된 카드, 활성 배지 배경) |
| accent-warm | `#E0A23A` | 강조 포인트 — 특순/축복송 태그, 고정 공지 뱃지, 오늘 날짜 표시 |
| accent-warm-soft | `#FBF1DE` | accent 배경 틴트 |
| ink | `#1F2430` | 본문 제목, 최고 강조 텍스트 |
| body | `#3A4150` | 본문 텍스트 |
| muted | `#767F91` | 캡션, 메타 정보(작성일, 업로더) |
| faint | `#A6ADBB` | 최저 강조, 빈 상태 안내 문구 |
| disabled | `#D3D7DF` | 비활성 텍스트/아이콘 |
| canvas | `#FFFFFF` | 페이지 배경 |
| surface | `#F7F8FB` | 카드/섹션 배경 |
| surface-alt | `#F1F2F7` | 리스트 항목 hover, 인풋 배경 |
| hairline | `#E4E6ED` | 구분선, 카드 테두리 |
| danger | `#D8493A` | 삭제 확인, 편집 비밀번호 오류, 필수값 누락 |
| success | `#3E9A5F` | 저장 완료, 게시 상태 |
| status-draft | `#9AA0AF` | 콘티 `draft` 상태 뱃지 |
| status-published | `#3E9A5F` | 콘티 `published` 상태 뱃지 |

**규칙**: azure(primary)는 실행 가능한 핵심 액션에만 사용하고, 앰버(accent-warm)는 절대 버튼에 쓰지 않는다 — 오직 라벨/뱃지/포인트 텍스트용. 두 색을 한 화면에 남발하지 않는다(화면당 accent-warm은 보통 1~2곳).

## Typography

Family: **Pretendard** (SemiBold 600 = 제목/라벨, Regular 400 = 본문). 마케팅 사이트가 아니므로 Hero/Display급 초대형 사이즈는 쓰지 않는다. 숫자(마이크 번호, 날짜)는 Pretendard 그대로 사용 — 별도 넘버 폰트 불필요.

| Role | Size | Weight | LH | 용도 |
|---|---|---|---|---|
| Page Title | 22px | 600 | 1.35 | "이번 주 콘티", "8월 스케줄" |
| Section Title | 18px | 600 | 1.40 | 카드 그룹 제목 |
| Card Title | 16px | 600 | 1.45 | 콘티 곡 제목, 공지 제목 |
| Body | 15px | 400 | 1.55 | 본문, 송폼 텍스트 |
| Label | 13px | 600 | 1.30 | 뱃지, 포지션 라벨(Key1, 드럼 등) |
| Caption | 12px | 400 | 1.40 | 날짜, 업로더, 메타정보 |
| Mic Number | 15px | 600 | 1.00 | 마이크 배치도 슬롯 번호 |

원칙: 모바일 뷰포트(360~430px)에서 실제 렌더링 크기 기준으로 잡았다. 본문은 항상 Regular, 순수 블랙(`#000`) 금지 — `ink`/`body` 사다리 사용.

## Spacing / Radius / Shadow

- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`
- Radius scale: sm 6px(뱃지, 인풋) · md 10px(리스트 카드) · lg 14px(상세 페이지 섹션 카드) · pill 999px(상태 뱃지)
- Shadow: 마케팅 사이트와 달리 **모바일 카드 앱**이므로 옅은 그림자로 리스트 위 카드의 뜬 느낌을 준다. `0px 1px 2px rgba(31, 36, 48, 0.06)` 하나만 표준으로 쓰고, 강조가 필요한 곳(모달, 검수 화면)에만 `0px 4px 16px rgba(31, 36, 48, 0.10)`. 두 단계 이상 만들지 않는다.
- 최소 터치 타깃: 44×44px (버튼, 드롭다운, 마이크 슬롯 셀 포함) — 리더십이 스케줄 입력을 모바일에서도 하는 것을 전제.

## Core Components

| Component | Bg | Text | Radius | Notes |
|---|---|---|---|---|
| Button — Primary | `primary` | white | 6px | h44, 저장/게시/AI 인식 시작 |
| Button — Secondary | white | `ink` | 6px | border 1px `hairline`, 취소/뒤로 |
| Button — Danger | white | `danger` | 6px | border 1px `danger`(20% 투명도), 삭제 |
| Badge — Status(published) | `success`(10%) | `status-published` | pill | 콘티/공지 게시 상태 |
| Badge — Status(draft) | `surface-alt` | `status-draft` | pill | AI 추출 후 검수 대기 |
| Badge — Warm Tag | `accent-warm-soft` | `accent-warm` | pill | 특순, 축복송, 퇴장송, 고정 공지 |
| Card — List Item | `surface` | `ink`/`body` | md | 콘티/공지 목록 한 줄 카드 |
| Card — Detail Section | white | `ink`/`body` | lg | border 1px `hairline`, 상세 페이지 곡별 블록 |
| Input — Edit Password | `surface-alt` | `ink` | sm | 헤더 우측 자물쇠 아이콘 + 인라인 입력, 오류 시 `danger` 테두리 |
| Empty State | `surface` | `faint` | md | "아직 등록된 콘티가 없어요" 톤 — 안내형 문구, 죄책감 유발 문구 금지 |

버튼 텍스트: 항상 15px Pretendard SemiBold(모바일 가독성 우선, 기존 12px보다 키움).

## 기능별 컴포넌트 스펙

### 1. 콘티/송폼 상세

- 곡 블록: `Card — Detail Section` 반복. 곡 순서 번호(원형 배지, `surface-alt` 배경 + `ink` 텍스트) + 곡 제목(`Card Title`) + 아티스트/키(`Caption`, muted) + 송폼(자유 텍스트, `Body`, `surface` 배경 블록에 `pre-wrap`으로 줄바꿈 보존).
- 축복송/퇴장송 등 `note` 값이 있으면 곡 제목 옆에 `Badge — Warm Tag`.
- 악보 PDF는 리스트가 아니라 카드 하단 고정 버튼("악보 PDF 보기", Secondary 버튼 + 아이콘)로 노출.
- AI 검수 화면: 추출된 곡마다 "기존 곡 선택 / 새로 등록" 토글이 필요 — 토글 활성 상태는 `primary-soft` 배경으로 구분.

### 2. 싱어팀 마이크 배치도 (이 프로젝트의 시각적 핵심 컴포넌트)

- CSS Grid 2단 고정 좌표. 각 마이크 슬롯 셀: `md` radius, `surface` 배경, 이름이 채워지면 `primary-soft` 배경 + `ink` 텍스트로 전환, 비어있으면 렌더링 자체를 생략(빈 값 숨김 원칙).
- 슬롯 번호는 셀 좌상단에 `Mic Number` 스타일로 작게 표기.
- 상단에 "회중석" 캡션(`Caption`, `faint`), 하단에 "콰이어" 행(가로 스크롤 가능한 pill 리스트, `Badge — Warm Tag` 재사용 대신 중립 톤 `surface-alt` pill).
- 목사님/강대상 자리(가운데 여백)는 실제 셀이 아니라 시각적 여백 + `faint` 텍스트 라벨만.
- 앞줄(4·3·2·1)과 뒷줄(8·7·6·5) 사이 간격은 `spacing 24` 이상으로 둬서 두 줄임이 명확히 구분되게 한다.

### 3. 월간 스케줄 / 공지사항

- 주차별 카드 하나 = `Card — Detail Section`. 상단에 주차 라벨(`Section Title`) + 날짜(`Caption`).
- 포지션 그리드(악기팀 7종): 2열 또는 3열 반응형 그리드, 값 없는 포지션은 행 자체를 렌더링하지 않음.
- 불참사항: 카드 하단에 `danger`(10% 배경) 박스로 별도 분리 — 놓치기 쉬운 정보이므로 시각적으로 튀게.
- 특순: `Badge — Warm Tag`로 카드 상단에 노출, 클릭 시 "공지사항에서 관리됨" 안내와 함께 캘린더 이동 링크(캘린더에서는 수정 불가이므로 편집 아이콘 대신 안내 아이콘).
- 고정 공지: 목록 최상단, `Badge — Warm Tag`("고정") + `surface` 대신 `accent-warm-soft` 배경으로 다른 공지와 구분.

### 4. 캘린더

- 월간 그리드보다는 **리스트형 타임라인**을 우선 고려(개발 비용 대비 가독성). 날짜별로 묶고, 카테고리별 색은 `primary`(정기 관련), `accent-warm`(특순, 읽기 전용), `muted` 아웃라인(기타)로 3톤만 사용 — 카테고리가 늘어나도 색을 늘리지 말고 아이콘/라벨로 구분.
- `source_type=auto_from_schedule` 이벤트는 카드 우측에 자물쇠 아이콘 + "공지사항에서 수정" 캡션을 항상 표기해 편집 불가 상태를 명확히 한다.

### 5. 편집 비밀번호 게이트

- 페이지 전체를 막는 모달이 아니라, 편집 버튼을 누를 때만 나타나는 작은 인라인 팝오버로 구현(모바일에서 전체 화면 모달은 과함).
- 실패 시 `danger` 테두리 + shake 없이 텍스트 메시지("비밀번호가 일치하지 않아요")로만 피드백 — 과한 모션 지양.

## Layout & Depth

- 마케팅 사이트의 white → surface → navy 크레센도 구조 대신, **모바일 앱형 단일 배경**(canvas) 위에 카드로만 위계를 표현한다. 어두운 색 섹션(딥네이비 등)은 이 프로젝트에 없음.
- 섹션 간 여백은 마케팅 사이트보다 좁게(24~32px) — 정보를 빨리 훑고 나가는 유틸리티 사용 패턴을 고려.
- 리스트 화면은 상단 고정 헤더(현재 화면 제목 + 편집 비밀번호 아이콘) + 스크롤 영역 구조를 기본으로 한다.

## Do / Don't

**Do:** Pretendard SemiBold 제목 / Regular 본문 / primary는 액션 버튼·링크에만, accent-warm은 뱃지·태그에만 / 빈 값은 렌더링 자체를 생략 / 최소 44px 터치 타깃 / 옅은 그림자 한 단계로 카드 구분 / 불참사항·오류는 danger로 시각적으로 튀게 / 마이크 배치도는 실제 무대 좌표를 그대로 반영.

**Don't:** 대형 마케팅 히어로 타이포 사용 / 드롭섀도 다단계 사용 / 파랑·앰버 외 새 강조색 추가 / 빈 필드를 회색 placeholder로라도 표시 / 전체 화면 모달 남용 / 딥네이비 등 어두운 섹션 배경 사용 / 순수 블랙(#000) 본문.

## Voice (짧게)

톤: 차분하고 친근하되 존댓말 유지. 팀 내부 도구이므로 마케팅 문구가 아니라 **안내문 톤**("악보가 아직 없어요", "이번 주 콘티가 게시되지 않았어요"). 오류 메시지도 사용자를 탓하지 않는 톤으로("비밀번호가 일치하지 않아요" O, "잘못된 비밀번호입니다" 같은 사무적 표현 지양). 이모지·느낌표 남발 금지, 팀 내부 용어(싱도, 콰이어, 송폼 등)는 그대로 사용해도 무방 — 실제 사용자가 이미 익숙한 용어.

---
*이 문서는 claude.ai Project 문서(`README.md`, `ERD.md`, `API명세.md`)와 함께 로컬 `CLAUDE.md`에서 참고하되, 프론트 구현 착수 시점(대략 8/20 이후, 기능 1 Vertical Slice 이후)에 본격적으로 적용한다. 그 전까지는 상시 로드하지 않아도 무방.*
