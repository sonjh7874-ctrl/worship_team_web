import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCalendarEvents } from "../api/calendar";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 카테고리별 칩 배경색 — 구분만 되면 충분해서 팔레트는 최소화한다.
const CATEGORY_COLORS = {
  수련회: "#e0f2fe",
  엠티: "#fef3c7",
  특순: "#ede9fe",
  기타: "#f3f4f6",
};

// 무대 좌표(MicStageLayout)처럼 무대가 아니라 달력이라 하드코딩할 상수는 없지만,
// "몇 칸짜리 그리드인지"는 요청받은 연/월에서 매번 계산해야 한다 — 매달 시작 요일과
// 날짜 수가 다르기 때문. 앞뒤 빈 칸을 채워 7의 배수로 맞춰 그리드가 항상 완전한
// 사각형이 되게 한다.
function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// 이벤트를 시작일(day-of-month) 기준으로만 묶는다. 멀티데이 이벤트도 시작일 칸에만
// 칩으로 표시하고 종료일 텍스트를 병기하는 정도로 그친다(SDD에서 셀 스패닝은
// 범위 밖으로 결정) — start_date가 이 달이 아니면(월 경계를 걸치는 이벤트) 이번
// 달 그리드에는 표시되지 않는 것이 현재 알려진 한계다.
function groupEventsByDay(events, year, month) {
  const map = {};
  for (const event of events) {
    const [y, m, d] = event.start_date.split("-").map(Number);
    if (y !== year || m !== month) continue;
    if (!map[d]) map[d] = [];
    map[d].push(event);
  }
  return map;
}

function EventChip({ event }) {
  const isAuto = event.source_type === "auto_from_schedule";
  const label = event.category === "기타" ? event.category_custom : event.category;
  const background = CATEGORY_COLORS[event.category] || "#f3f4f6";

  return (
    <Link
      to={`/calendar/${event.id}`}
      style={{
        display: "block",
        background,
        borderRadius: "4px",
        padding: "0.1rem 0.3rem",
        marginTop: "0.15rem",
        fontSize: "0.75rem",
        color: "#111",
        textDecoration: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={`${event.title}${label ? ` (${label})` : ""}`}
    >
      {isAuto && "🔗 "}
      {event.title}
      {event.end_date && ` ~${event.end_date.slice(5)}`}
    </Link>
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
  const eventsByDay = groupEventsByDay(events, Number(year), Number(month));
  const todayKey =
    now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month) ? now.getDate() : null;

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
        <table
          className="calendar-grid"
          style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label} style={{ border: "1px solid #ccc", padding: "0.25rem" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIdx) => (
              <tr key={weekIdx}>
                {week.map((day, dayIdx) => (
                  <td
                    key={dayIdx}
                    className="calendar-cell"
                    style={{
                      border: "1px solid #ccc",
                      verticalAlign: "top",
                      height: "5rem",
                      padding: "0.2rem",
                      // day가 null인 빈 칸(월 시작/끝의 여백)은 다른 달을 보고 있어
                      // todayKey도 null일 때 `null === null`로 잘못 강조되지 않도록 day를 먼저 확인한다.
                      background: day && day === todayKey ? "#fff7ed" : undefined,
                    }}
                  >
                    {day && (
                      <>
                        <div style={{ fontSize: "0.8rem", color: "#555" }}>{day}</div>
                        {(eventsByDay[day] || []).map((event) => (
                          <EventChip key={event.id} event={event} />
                        ))}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default CalendarMain;
