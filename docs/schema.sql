-- ============================================================
-- 청년부 주일찬양팀 웹 — Supabase (PostgreSQL) 스키마
-- 기준일: 2026-08-18
-- 실행: Supabase Dashboard > SQL Editor 에 붙여넣어 실행
-- ============================================================

-- ------------------------------------------------------------
-- 공통: updated_at 자동 갱신 트리거 함수
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ============================================================
-- 1. 공통 — 인명부 / 포지션 마스터
-- ============================================================

create table members (
  id          bigserial primary key,
  name        text not null,
  team        text not null check (team in ('singer', 'instrument')),
  is_active   boolean not null default true,
  gender      text not null check (gender in ('male', 'female')),
  birth_date  date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_members_active on members (is_active, team);
create trigger trg_members_updated before update on members
  for each row execute function set_updated_at();

comment on table members is '인명부. 배정 드롭다운의 마스터 데이터';
comment on column members.is_active is 'false = 탈퇴/비활동. 과거 배정 기록은 유지';
comment on column members.gender is '싱어팀 마이크 1~8번 배치가 성별 고정이라(Phase 12 후속) 필수 필드로 둔다';
comment on column members.birth_date is '선택 입력. 있으면 캘린더에 생일이 매년 자동 표시된다(Phase 12 후속)';


create table positions (
  code          text primary key,
  team          text not null check (team in ('singer', 'instrument', 'common')),
  label         text not null,
  display_order int  not null,
  is_multi      boolean not null default false
);

comment on column positions.is_multi is 'true = 한 주차에 여러 명 배정 가능 (콰이어, 특순)';


-- ============================================================
-- 2. 기능 1 — 콘티 / 곡 / 악보
-- ============================================================

create table contis (
  id             bigserial primary key,
  service_date   date not null,
  title          text not null default '주일예배',
  status         text not null default 'draft' check (status in ('draft', 'published')),
  ai_raw_result  jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (service_date, title)
);
create index idx_contis_date on contis (service_date desc);
create trigger trg_contis_updated before update on contis
  for each row execute function set_updated_at();

comment on column contis.title is '기본값 주일예배. 수련회 등 예외 콘티는 제목으로 구분';
comment on column contis.status is 'draft = 아직 팀 전체 공개 전(AI 추출 검수 대기 또는 리더십이 잠시 숨겨둔 초안), published = 공개됨. 목록/최신 조회는 published만 노출';
comment on column contis.ai_raw_result is 'AI 추출 원본 JSON. 정확도 검증/트러블슈팅용';


create table songs (
  id           bigserial primary key,
  title        text not null,
  artist       text,
  default_key  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (title, artist)
);
create index idx_songs_title on songs (title);
create trigger trg_songs_updated before update on songs
  for each row execute function set_updated_at();

comment on table songs is '곡 마스터. 매주 재사용되는 불변 속성만 보관';


create table conti_songs (
  id         bigserial primary key,
  conti_id   bigint not null references contis (id) on delete cascade,
  song_id    bigint not null references songs (id) on delete restrict,
  order_no   int    not null,
  song_key   text,
  song_form  text,
  note       text,
  unique (conti_id, order_no)
);
create index idx_conti_songs_conti on conti_songs (conti_id, order_no);

comment on table conti_songs is '콘티별 곡 배치. 주간 가변 속성(순서/키/송폼)을 보관';
comment on column conti_songs.song_form is '자유 텍스트. 표기가 불규칙해 구조화하지 않음 (예: (4) A1 A2 B (맞4) (up) B B)';
comment on column conti_songs.note is '축복송 / 퇴장송 등 부가 표기';


create table sheet_files (
  id            bigserial primary key,
  conti_id      bigint not null references contis (id) on delete cascade,
  file_type     text not null check (file_type in ('score_pdf', 'conti_image')),
  storage_path  text not null,
  file_name     text,
  uploaded_at   timestamptz not null default now()
);
create index idx_sheet_files_conti on sheet_files (conti_id, file_type);

comment on table sheet_files is 'Supabase Storage 경로만 보관. 악보 PDF와 콘티 원본 이미지';


-- ============================================================
-- 3. 기능 2 — 공지사항 / 월간 스케줄 / 배정
-- ============================================================

create table notices (
  id          bigserial primary key,
  title       text not null,
  content     text,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_notices_list on notices (is_pinned desc, created_at desc);
create trigger trg_notices_updated before update on notices
  for each row execute function set_updated_at();


create table monthly_schedules (
  id          bigserial primary key,
  year        int not null,
  month       int not null check (month between 1 and 12),
  memo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (year, month)
);
create trigger trg_monthly_schedules_updated before update on monthly_schedules
  for each row execute function set_updated_at();


create table schedule_weeks (
  id             bigserial primary key,
  schedule_id    bigint not null references monthly_schedules (id) on delete cascade,
  week_label     text not null,
  service_date   date,
  remark         text,
  absence_note   text,
  special_title  text,
  special_date   date,
  special_memo   text,
  unique (schedule_id, week_label)
);
create index idx_schedule_weeks_schedule on schedule_weeks (schedule_id);

comment on column schedule_weeks.week_label is '예: 01-02 (토-일)';
comment on column schedule_weeks.remark is '수련회주간, 특새주간 등';
comment on column schedule_weeks.special_title is '특순. 값이 있으면 calendar_events에 단방향 동기화됨';


create table schedule_assignments (
  id             bigserial primary key,
  week_id        bigint not null references schedule_weeks (id) on delete cascade,
  position_code  text   not null references positions (code) on delete restrict,
  member_id      bigint references members (id) on delete set null,
  name_snapshot  text,
  slot_order     int not null default 0,
  -- 인명부 연결이 없으면 이름 텍스트라도 반드시 있어야 함
  constraint chk_assignment_identity
    check (member_id is not null or nullif(btrim(name_snapshot), '') is not null)
);
create index idx_assignments_week on schedule_assignments (week_id);
create index idx_assignments_member on schedule_assignments (member_id);

-- 단일 슬롯 포지션(콰이어/특순/싱어 악보 제외)은 주차당 1건만 허용.
-- 싱어 악보(singer_score)는 보통 2명이 나눠 맡아 다중 배정 예외에 포함된다.
create unique index uq_assignment_single_slot
  on schedule_assignments (week_id, position_code)
  where position_code not in ('choir', 'special', 'singer_score');

comment on table schedule_assignments is '세로형 배정. 한 행 = 한 사람의 한 배정';
comment on column schedule_assignments.name_snapshot is '인명부에 없는 인물(탈퇴자, 동명이인 구분 표기)용 이름 보관';
comment on column schedule_assignments.slot_order is '콰이어처럼 여러 명이 들어가는 포지션의 표시 순서';


-- ============================================================
-- 4. 기능 3 — 캘린더
-- ============================================================

create table calendar_events (
  id               bigserial primary key,
  title            text not null,
  start_date       date not null,
  end_date         date,
  category         text not null default '기타',
  category_custom  text,
  color            text,
  memo             text,
  source_type      text not null default 'manual'
                     check (source_type in ('manual', 'auto_from_schedule', 'auto_birthday')),
  source_week_id   bigint references schedule_weeks (id) on delete cascade,
  source_member_id bigint references members (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 자동 생성 이벤트는 각자의 원본(주차 또는 팀원)을 반드시 가리켜야 하고, 수동 이벤트는
  -- 둘 다 가리키면 안 됨. auto_birthday는 Phase 12 후속에서 추가됐다(3-12절).
  constraint chk_event_source check (
    (source_type = 'auto_from_schedule' and source_week_id is not null and source_member_id is null)
    or (source_type = 'auto_birthday' and source_member_id is not null and source_week_id is null)
    or (source_type = 'manual' and source_week_id is null and source_member_id is null)
  ),
  constraint chk_event_period check (end_date is null or end_date >= start_date)
);
create index idx_events_period on calendar_events (start_date, end_date);
create trigger trg_calendar_events_updated before update on calendar_events
  for each row execute function set_updated_at();

-- 한 주차의 특순은 캘린더 이벤트 1건에만 대응 (단방향 동기화 보장)
create unique index uq_event_source_week
  on calendar_events (source_week_id)
  where source_week_id is not null;

comment on column calendar_events.source_type is 'auto_from_schedule 인 행은 API에서 수정/삭제 거부. 공지사항이 원본';
comment on column calendar_events.color is '프리셋 팔레트 색상(hex, 8개 중 하나). null이면 카테고리 기본색 사용. 허용값은 API 서비스 레이어에서 검증(DB 제약 없음)';


create table event_participants (
  id             bigserial primary key,
  event_id       bigint not null references calendar_events (id) on delete cascade,
  member_id      bigint references members (id) on delete set null,
  name_snapshot  text,
  constraint chk_participant_identity
    check (member_id is not null or nullif(btrim(name_snapshot), '') is not null)
);
create index idx_participants_event on event_participants (event_id);


-- ============================================================
-- 4-1. user_profiles (Phase 7 — 로그인 계정별 역할)
--      auth.users(Supabase Auth)에 딸린 프로필. 계정과 1:1이며,
--      "배정 드롭다운용 마스터 데이터"인 members와는 성격이 달라 별도 테이블로 둔다.
-- ============================================================

create table user_profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  role                   text not null default 'member' check (role in ('admin', 'leader', 'member')),
  display_name           text not null,
  member_id              bigint references members (id) on delete set null,
  -- true면 관리자가 비밀번호를 초기화한 직후 상태 — 로그인 시 강제로 비밀번호 변경 화면으로 이동시킨다.
  force_password_change  boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_user_profiles_updated before update on user_profiles
  for each row execute function set_updated_at();

comment on table user_profiles is '로그인 계정별 역할(admin/leader/member). 비밀번호는 저장하지 않음(auth.users가 보관)';


-- ============================================================
-- 5. 자막용 가사 정리 — 곡별 가사 구간 매핑 (Phase 9, 2026-08-20 실행)
-- ============================================================

create table song_sections (
  id            bigserial primary key,
  song_id       bigint not null references songs (id) on delete cascade,
  section_code  text not null,   -- A1, A2, B, C, Tag ...
  lyrics        text not null,
  display_order int not null default 0,
  aliases       text,            -- 같은 가사를 가리키는 다른 표기(쉼표 구분). 곡마다 송폼 표기가 바뀔 때 재매칭용
  unique (song_id, section_code)
);
comment on table song_sections is '곡별 가사 구간 매핑. 한 번 정하면 재사용 (사람이 입력/검수)';


-- ============================================================
-- 5-1. account_events (Phase 7 후속 — 계정 이벤트 로그, 2026-08-21)
--      admin이 계정 관련 보안 이벤트(표시 이름 변경/역할 변경/비밀번호 초기화)를
--      추적할 수 있도록 남기는 로그. 비밀번호 값 자체는 절대 기록하지 않는다.
-- ============================================================

create table account_events (
  id               bigserial primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  event_type       text not null check (event_type in ('display_name_changed', 'role_changed', 'password_reset')),
  old_value        text,
  new_value        text,
  changed_by       uuid references auth.users (id) on delete set null,
  changed_by_name  text not null,
  created_at       timestamptz not null default now()
);
create index idx_account_events_user on account_events (user_id, created_at desc);
comment on table account_events is '계정 보안 이벤트 로그(이름/역할 변경, 비밀번호 초기화). 비밀번호 값 자체는 저장하지 않음';


-- ============================================================
-- 5-2. notice_comments / calendar_event_comments (Phase 10 — 댓글 기능)
--      범용 다형성 테이블 없이 구체적 FK 2개로 분리(이 프로젝트의 기존 관례).
--      author_name은 작성 시점 display_name 스냅샷 — 조회 시 user_profiles를 조인하지 않는다.
-- ============================================================

create table notice_comments (
  id           bigserial primary key,
  notice_id    bigint not null references notices (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  author_name  text not null,
  content      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_notice_comments_notice on notice_comments (notice_id, created_at);
create trigger trg_notice_comments_updated before update on notice_comments
  for each row execute function set_updated_at();

create table calendar_event_comments (
  id           bigserial primary key,
  event_id     bigint not null references calendar_events (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  author_name  text not null,
  content      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_calendar_event_comments_event on calendar_event_comments (event_id, created_at);
create trigger trg_calendar_event_comments_updated before update on calendar_event_comments
  for each row execute function set_updated_at();

comment on table notice_comments is '공지사항 댓글. 작성은 member 이상, 수정은 본인만, 삭제는 본인 또는 leader 이상';
comment on table calendar_event_comments is '캘린더 이벤트 댓글. 작성은 member 이상, 수정은 본인만, 삭제는 본인 또는 leader 이상';


-- ============================================================
-- 6. 포지션 초기 데이터 (seed)
-- ============================================================

insert into positions (code, team, label, display_order, is_multi) values
  ('key1',           'instrument', 'Key1',      1,  false),
  ('key2',           'instrument', 'Key2',      2,  false),
  ('drum',           'instrument', '드럼',       3,  false),
  ('bass',           'instrument', '베이스',     4,  false),
  ('electric',       'instrument', '일렉',       5,  false),
  ('singer_helper',  'instrument', '싱도/자막',  6,  false),
  ('inst_score',     'instrument', '악보',       7,  false),
  ('mic1',           'singer',     '마이크 1',   11, false),
  ('mic2',           'singer',     '마이크 2',   12, false),
  ('mic3',           'singer',     '마이크 3',   13, false),
  ('mic4',           'singer',     '마이크 4',   14, false),
  ('mic5',           'singer',     '마이크 5',   15, false),
  ('mic6',           'singer',     '마이크 6',   16, false),
  ('mic7',           'singer',     '마이크 7',   17, false),
  ('mic8',           'singer',     '마이크 8',   18, false),
  ('choir',          'singer',     '콰이어',     19, true),
  ('singer_caption', 'singer',     '자막',       20, false),
  ('singer_score',   'singer',     '악보',       21, true),
  ('special',        'common',     '특순',       30, true);


-- ============================================================
-- 6-2. availability_submissions / availability_entries (Phase 11-B — 참/불참 텍스트 파싱)
--      부모(사람×월 제출) + 자식(날짜별 항목) 구조. contis/conti_songs, monthly_schedules/schedule_weeks와
--      동일한 패턴. 저장 단위는 "날짜별 항목 + 월 단위 기본값" 조합 — "29일 불참(결혼식), 30일 참"처럼
--      주차 페어 안에서도 날짜별로 상태가 갈리는 실제 사례가 있어 날짜 단위로 저장하고,
--      "전참"/"전체 불참(사유)" 같은 축약형은 달력 계산 없이 기본값 자체로 저장한다.
-- ============================================================

create table availability_submissions (
  id             bigserial primary key,
  year           int not null,
  month          int not null,
  -- 싱어팀장·악기팀장이 각자 자기 팀만 관리하므로, 저장(PUT)이 team으로 범위를 좁혀
  -- 한 팀이 저장할 때 다른 팀 데이터가 지워지지 않게 한다(실사용 피드백으로 추가, 후속).
  team           text not null check (team in ('singer', 'instrument')),
  member_id      bigint references members (id) on delete set null,
  name_snapshot  text not null,
  default_status text check (default_status in ('available', 'unavailable')),
  default_reason text,
  raw_text       text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_availability_submissions_month_team on availability_submissions (year, month, team);

create trigger trg_availability_submissions_updated before update on availability_submissions
  for each row execute function set_updated_at();

create table availability_entries (
  id            bigserial primary key,
  submission_id bigint not null references availability_submissions (id) on delete cascade,
  date          date not null,
  status        text not null check (status in ('available', 'unavailable')),
  reason        text
);
create index idx_availability_entries_submission on availability_entries (submission_id);

comment on table availability_submissions is '참/불참 텍스트 파싱 결과(사람×월 단위 제출). AI가 구조화하고 사람이 검수 후 확정 저장(Phase 11-B)';
comment on table availability_entries is '제출된 날짜별 참/불참 항목. 기본값(전참/전체 불참)과 다른 날짜만이 아니라, 축약형 없이 나열된 사람은 언급된 날짜 전부가 여기 들어간다';


-- ============================================================
-- 7. RLS — 서버(service_role)만 접근 허용
--    브라우저는 FastAPI를 거쳐서만 데이터에 접근한다
-- ============================================================

alter table members             enable row level security;
alter table positions           enable row level security;
alter table contis              enable row level security;
alter table songs               enable row level security;
alter table conti_songs         enable row level security;
alter table sheet_files         enable row level security;
alter table notices             enable row level security;
alter table monthly_schedules   enable row level security;
alter table schedule_weeks      enable row level security;
alter table schedule_assignments enable row level security;
alter table calendar_events     enable row level security;
alter table event_participants  enable row level security;
alter table user_profiles       enable row level security;
alter table song_sections       enable row level security;
alter table account_events      enable row level security;
alter table notice_comments     enable row level security;
alter table calendar_event_comments enable row level security;
alter table availability_submissions enable row level security;
alter table availability_entries enable row level security;

-- 정책을 만들지 않으므로 anon / authenticated 키로는 아무 것도 조회되지 않는다.
-- service_role 키는 RLS를 우회하므로 FastAPI 서버만 정상 접근한다.
