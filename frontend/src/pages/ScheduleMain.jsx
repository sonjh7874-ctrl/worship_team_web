import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createSchedule,
  createWeek,
  deleteSchedule,
  deleteWeek,
  fetchSchedule,
} from "../api/schedules";
import MicStageLayout from "../components/MicStageLayout";
import InstrumentPositionGrid from "../components/InstrumentPositionGrid";
import { useAuth } from "../contexts/AuthContext";

function WeekCard({ week, scheduleId, year, month, onDelete, canEdit }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: "0.5rem", marginBottom: "0.5rem" }}>
      <strong>{week.week_label}</strong> {week.service_date}{" "}
      {canEdit && (
        <>
          <Link to={`/schedules/${scheduleId}/weeks/${week.id}/edit?year=${year}&month=${month}`}>
            편집
          </Link>{" "}
          <button type="button" onClick={() => onDelete(week)}>
            삭제
          </button>
        </>
      )}

      {week.remark && <p>비고: {week.remark}</p>}
      {week.special && (
        <p>
          특순: {week.special.title}
          {week.special.date && ` (${week.special.date})`}
        </p>
      )}

      <InstrumentPositionGrid instrument={week.instrument} />

      <MicStageLayout mic={week.singer.mic} choir={week.singer.choir} />
      {week.singer.caption && <p>싱어 자막: {week.singer.caption.name}</p>}
      {week.singer.score.length > 0 && (
        <p>싱어 악보: {week.singer.score.map((p) => p.name).join(", ")}</p>
      )}
      {week.absence_note && <p>불참: {week.absence_note}</p>}
    </div>
  );
}

function ScheduleMain() {
  const { canEdit } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [newWeekLabel, setNewWeekLabel] = useState("");
  const [newWeekDate, setNewWeekDate] = useState("");

  function load(y, m) {
    setLoading(true);
    setError(null);
    setNotFound(false);
    fetchSchedule(y, m)
      .then(setSchedule)
      .catch(() => {
        // 해당 월 스케줄이 아예 없는 경우(404)와 그 외 에러를 구분하지 않고,
        // "없으면 만들기" 흐름으로 단순하게 처리한다.
        setSchedule(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(year, month);
  }

  async function handleCreateSchedule() {
    setError(null);
    setMessage(null);
    try {
      const created = await createSchedule({ year: Number(year), month: Number(month) });
      setSchedule(created);
      setNotFound(false);
      setMessage("월 스케줄이 생성되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSchedule() {
    if (!window.confirm(`${year}년 ${month}월 스케줄을 삭제할까요? 주차·배정이 모두 삭제됩니다.`)) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await deleteSchedule(schedule.id);
      setSchedule(null);
      setNotFound(true);
      setMessage("월 스케줄이 삭제되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddWeek(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const week = await createWeek(schedule.id, {
        week_label: newWeekLabel,
        service_date: newWeekDate || null,
      });
      setSchedule((prev) => ({ ...prev, weeks: [...prev.weeks, week] }));
      setNewWeekLabel("");
      setNewWeekDate("");
      setMessage("주차가 추가되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteWeek(week) {
    if (!window.confirm(`"${week.week_label}" 주차를 삭제할까요?`)) return;
    setError(null);
    setMessage(null);
    try {
      await deleteWeek(schedule.id, week.id);
      setSchedule((prev) => ({ ...prev, weeks: prev.weeks.filter((w) => w.id !== week.id) }));
      setMessage("주차가 삭제되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Link to="/">← 메인으로</Link>
      <h1>월간 스케줄</h1>

      <form onSubmit={handleSearch}>
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
        <button type="submit">조회</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {loading && <p>불러오는 중...</p>}

      {!loading && notFound && (
        <div>
          <p>
            {year}년 {month}월 스케줄이 없습니다.
          </p>
          {canEdit && (
            <button type="button" onClick={handleCreateSchedule}>
              이 달 스케줄 만들기
            </button>
          )}
        </div>
      )}

      {!loading && schedule && (
        <div>
          {canEdit && (
            <button type="button" onClick={handleDeleteSchedule} style={{ color: "red" }}>
              이 달 스케줄 전체 삭제
            </button>
          )}

          {schedule.weeks.length === 0 ? (
            <p>등록된 주차가 없습니다.</p>
          ) : (
            schedule.weeks.map((week) => (
              <WeekCard
                key={week.id}
                week={week}
                scheduleId={schedule.id}
                year={year}
                month={month}
                onDelete={handleDeleteWeek}
                canEdit={canEdit}
              />
            ))
          )}

          {canEdit && (
            <>
              <h2>주차 추가</h2>
              <form onSubmit={handleAddWeek}>
                <label>
                  주차 라벨(예: 01-02){" "}
                  <input
                    value={newWeekLabel}
                    onChange={(e) => setNewWeekLabel(e.target.value)}
                    required
                  />
                </label>{" "}
                <label>
                  날짜{" "}
                  <input
                    type="date"
                    value={newWeekDate}
                    onChange={(e) => setNewWeekDate(e.target.value)}
                  />
                </label>{" "}
                <button type="submit">추가</button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ScheduleMain;
