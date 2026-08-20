import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCalendarEvents } from "../api/calendar";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 24 * 60 * 60 * 1000;

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

// 한 주(7일) 안에서 이 주와 겹치는 이벤트 구간들을 뽑고, 겹치는 구간끼리는
// 서로 다른 레인(세로줄)에 쌓이도록 배정한다 — 그리드가 주 단위로 끊기기 때문에
// 레인 배정도 주마다 독립적으로 계산한다. 같은 이벤트가 여러 주에 걸치면 주가
// 바뀔 때 레인 번호(세로 위치)가 달라질 수 있는 것이 이 방식의 알려진 한계다.
function computeWeekSegments(weekDates, events) {
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
    });
  }

  segments.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const laneEnds = [];
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    seg.lane = lane;
  }
  return segments;
}

function EventBar({ seg }) {
  const { event, startCol, endCol, lane, isStart, isEnd } = seg;
  const isAuto = event.source_type === "auto_from_schedule";
  const label = event.category === "기타" ? event.category_custom : event.category;
  const background = CATEGORY_COLORS[event.category] || "#f3f4f6";

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

function WeekRow({ weekDates, year, month, events, todayKey }) {
  const segments = computeWeekSegments(weekDates, events);

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
        return (
          <div
            key={i}
            className="calendar-cell"
            style={{
              gridColumn: i + 1,
              gridRow: 1,
              borderLeft: i > 0 ? "1px solid #eee" : undefined,
              padding: "0.2rem 0.3rem",
              fontSize: "0.8rem",
              color: inMonth ? "#555" : "#ccc",
              background: toKey(date) === todayKey ? "#fff7ed" : undefined,
            }}
          >
            {date.getDate()}
          </div>
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

  const weeks = buildMonthGrid(Number(year), Number(month));
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
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                style={{ padding: "0.25rem", textAlign: "center", borderBottom: "1px solid #ccc" }}
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
              todayKey={todayKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarMain;
