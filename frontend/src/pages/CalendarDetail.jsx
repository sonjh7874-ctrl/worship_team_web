import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCalendarEvent } from "../api/calendar";

function CalendarDetail() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCalendarEvent(eventId)
      .then(setEvent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p>불러오는 중...</p>;
  if (error || !event) {
    return (
      <div>
        <Link to="/calendar">← 캘린더로</Link>
        <p>이벤트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const isAuto = event.source_type === "auto_from_schedule";
  const categoryLabel = event.category === "기타" ? event.category_custom : event.category;

  return (
    <div>
      <Link to="/calendar">← 캘린더로</Link>{" "}
      {isAuto ? null : <Link to={`/calendar/${eventId}/edit`}>편집</Link>}

      <h1>{event.title}</h1>

      <p>
        {event.start_date}
        {event.end_date && ` ~ ${event.end_date}`}
      </p>
      <p>카테고리: {categoryLabel}</p>
      {event.memo && <p>메모: {event.memo}</p>}

      {event.participants.length > 0 && (
        <p>참여 인원: {event.participants.map((p) => p.name).join(", ")}</p>
      )}

      {isAuto && (
        <div style={{ background: "#ede9fe", padding: "0.5rem", marginTop: "1rem" }}>
          <p>
            🔗 이 이벤트는 공지사항(월간 스케줄)의 특순 정보에서 자동으로 만들어졌습니다. 여기서
            직접 수정·삭제할 수 없고, <Link to="/schedules">월간 스케줄</Link>에서 특순 정보를
            바꾸면 이 이벤트도 함께 갱신됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default CalendarDetail;
