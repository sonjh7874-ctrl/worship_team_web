import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCalendarEvents } from "../api/calendar";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 24 * 60 * 60 * 1000;

// 요일 인덱스(0=일 ~ 6=토) 기준 주말 강조색 — 한국 캘린더 관례대로 일요일은 빨강,
// 토요일은 파랑. 평일은 색을 지정하지 않아 호출 쪽의 기본색을 그대로 쓴다.
const WEEKDAY_COLORS = { 0: "#dc2626", 6: "#2563eb" };

// 카테고리별 막대 배경색 — 구분만 되면 충분해서 팔레트는 최소화한다.
const CATEGORY_COLORS = {
  수련회: "#e0f2fe",
  엠티: "#fef3c7",
  특순: "#ede9fe",
  기타: "#f3f4f6",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 달력 그리드는 해당 월의 1일이 속한 주의 일요일부터, 말일이 속한 주의 토요일까지
// 채운다 — 그래야 이전/다음 달로 걸치는 멀티데이 이벤트 막대가 첫/마지막 주에서도
// 잘리지 않고 이어져 보인다. 앞뒤로 삐져나온 날짜는 옅은 색으로만 구분한다.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

  const weeks = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// 이벤트마다 달력 전체 기준으로 레인(세로줄)을 한 번만 배정한다 — 실제 날짜 구간으로
// 겹치는지를 판단하는 고전적인 구간 스케줄링(interval scheduling) 그리디 알고리즘이라,
// 겹치지 않는 두 이벤트는 서로 다른 주에 나타나더라도 같은 레인을 재사용할 수 있고,
// 여러 주에 걸치는 이벤트는 모든 주에서 항상 같은 레인(같은 세로 위치)을 유지한다.
function assignLanesByEventId(events) {
  const items = events
    .map((event) => ({
      event,
      start: parseDateKey(event.start_date),
      end: event.end_date ? parseDateKey(event.end_date) : parseDateKey(event.start_date),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const laneEnds = []; // 레인별로 마지막까지 채운 종료일
  const laneByEventId = {};
  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end < item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    laneByEventId[item.event.id] = lane;
  }
  return laneByEventId;
}

// 한 주(7일) 안에서 이 주와 겹치는 이벤트 구간만 뽑아 그 주의 칸 범위(startCol/endCol)를
// 계산한다. 레인은 이미 assignLanesByEventId가 달력 전체 기준으로 정해둔 값을 그대로 쓴다.
function computeWeekSegments(weekDates, events, laneByEventId) {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const segments = [];
  for (const event of events) {
    const startDate = parseDateKey(event.start_date);
    const endDate = event.end_date ? parseDateKey(event.end_date) : startDate;
    if (endDate < weekStart || startDate > weekEnd) continue;

    const segStart = startDate < weekStart ? weekStart : startDate;
    const segEnd = endDate > weekEnd ? weekEnd : endDate;
    segments.push({
      event,
      startCol: Math.round((segStart - weekStart) / DAY_MS),
      endCol: Math.round((segEnd - weekStart) / DAY_MS),
      isStart: segStart.getTime() === startDate.getTime(),
      isEnd: segEnd.getTime() === endDate.getTime(),
      lane: laneByEventId[event.id],
    });
  }
  return segments;
}

function EventBar({ seg }) {
  const { event, startCol, endCol, lane, isStart, isEnd } = seg;
  const isAuto = event.source_type === "auto_from_schedule";
  const label = event.category === "기타" ? event.category_custom : event.category;
  // 이벤트에 직접 지정한 프리셋 색이 있으면 그걸 우선하고, 없으면 카테고리 기본색을 쓴다.
  const background = event.color || CATEGORY_COLORS[event.category] || "#f3f4f6";

  // 이 주에서 시작/끝이 실제 이벤트의 시작/끝과 일치할 때만 그쪽 모서리를 둥글게
  // 만들어, 다음 주로 계속 이어지는 막대는 각지게 표시해 "계속됨"을 암시한다.
  const radius = `${isStart ? "4px" : "0"} ${isEnd ? "4px" : "0"} ${isEnd ? "4px" : "0"} ${
    isStart ? "4px" : "0"
  }`;

  return (
    <Link
      to={`/calendar/${event.id}`}
      className="calendar-event-bar"
      title={`${event.title}${label ? ` (${label})` : ""}`}
      style={{
        gridColumn: `${startCol + 1} / ${endCol + 2}`,
        gridRow: lane + 2,
        background,
        margin: "1px 2px",
        borderRadius: radius,
        padding: "0.1rem 0.4rem",
        fontSize: "0.75rem",
        color: "#111",
        textDecoration: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "block",
      }}
    >
      {isAuto && "🔗 "}
      {event.title}
    </Link>
  );
}

function WeekRow({ weekDates, year, month, events, laneByEventId, todayKey }) {
  const segments = computeWeekSegments(weekDates, events, laneByEventId);

  return (
    <div
      className="calendar-week"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridAutoRows: "min-content",
        borderTop: "1px solid #ccc",
      }}
    >
      {weekDates.map((date, i) => {
        const inMonth = date.getMonth() + 1 === month && date.getFullYear() === year;
        // 이번 달 안에서만 주말 색을 적용한다 — 그리드 여백(다른 달) 칸까지 색을 넣으면
        // 흐림 표시(회색)와 뒤섞여 오히려 지저분해진다.
        const color = inMonth ? WEEKDAY_COLORS[i] || "#555" : "#ccc";
        return (
          <Link
            key={i}
            to={`/calendar/new?date=${toKey(date)}`}
            className="calendar-cell"
            style={{
              display: "block",
              gridColumn: i + 1,
              gridRow: 1,
              borderLeft: i > 0 ? "1px solid #eee" : undefined,
              padding: "0.2rem 0.3rem",
              fontSize: "0.8rem",
              color,
              textDecoration: "none",
              background: toKey(date) === todayKey ? "#fff7ed" : undefined,
            }}
          >
            {date.getDate()}
          </Link>
        );
      })}
      {segments.map((seg, idx) => (
        <EventBar key={`${seg.event.id}-${idx}`} seg={seg} />
      ))}
    </div>
  );
}

function CalendarMain() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load(y, m) {
    setLoading(true);
    setError(null);
    fetchCalendarEvents(y, m)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(Number(year), Number(month));
  }

  function shiftMonth(delta) {
    let y = Number(year);
    let m = Number(month) + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
    load(y, m);
  }

  function goToToday() {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    setYear(y);
    setMonth(m);
    load(y, m);
  }

  const weeks = buildMonthGrid(Number(year), Number(month));
  const laneByEventId = assignLanesByEventId(events);
  const todayKey = toKey(now);

  return (
    <div>
      <Link to="/">← 메인으로</Link>
      <h1>캘린더</h1>

      <div>
        <Link to="/calendar/new">새 이벤트</Link>
      </div>

      <form onSubmit={handleSearch} style={{ margin: "0.5rem 0" }}>
        <button type="button" onClick={() => shiftMonth(-1)}>
          ◀
        </button>{" "}
        <button type="button" onClick={goToToday}>
          오늘
        </button>{" "}
        <label>
          연도{" "}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{ width: "5em" }}
          />
        </label>{" "}
        <label>
          월{" "}
          <input
            type="number"
            min="1"
            max="12"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: "3em" }}
          />
        </label>{" "}
        <button type="submit">조회</button>{" "}
        <button type="button" onClick={() => shiftMonth(1)}>
          ▶
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>불러오는 중...</p>}

      {!loading && !error && (
        <div className="calendar-grid" style={{ border: "1px solid #ccc", borderBottom: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={label}
                style={{
                  padding: "0.25rem",
                  textAlign: "center",
                  borderBottom: "1px solid #ccc",
                  color: WEEKDAY_COLORS[i],
                }}
              >
                {label}
              </div>
            ))}
          </div>
          {weeks.map((weekDates, idx) => (
            <WeekRow
              key={idx}
              weekDates={weekDates}
              year={Number(year)}
              month={Number(month)}
              events={events}
              laneByEventId={laneByEventId}
              todayKey={todayKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarMain;
