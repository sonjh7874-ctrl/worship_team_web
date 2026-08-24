import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCalendarEvent } from "../api/calendar";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import CommentList from "../components/CommentList";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../contexts/AuthContext";

function CalendarDetail() {
  const { canEdit } = useAuth();
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

  if (loading) {
    return (
      <PageContainer>
        <p className="page-status">이벤트를 불러오는 중...</p>
      </PageContainer>
    );
  }

  if (error || !event) {
    return (
      <PageContainer>
        <EmptyState
          title="이벤트를 찾을 수 없습니다"
          action={
            <Button as={Link} to="/calendar" variant="secondary">
              캘린더로 이동
            </Button>
          }
        />
      </PageContainer>
    );
  }

  // 특순(auto_from_schedule)과 생일(auto_birthday)은 각각 스케줄·인명부가 원본이라
  // 여기서 직접 수정·삭제할 수 없다(README 단방향 동기화 원칙). 편집 버튼 대신 안내를 보여준다.
  const isAutoSchedule = event.source_type === "auto_from_schedule";
  const isBirthday = event.source_type === "auto_birthday";
  const isAuto = isAutoSchedule || isBirthday;
  const categoryLabel = event.category === "기타" ? event.category_custom : event.category;

  return (
    <PageContainer className="content-page">
      <div className="page-action-row">
        {!isAuto && canEdit && (
          <Button as={Link} to={`/calendar/${eventId}/edit`} variant="secondary">
            편집
          </Button>
        )}
      </div>

      <Card className="calendar-detail-card">
        <header className="detail-heading">
          <div>
            <div className="detail-heading__meta">
              <Badge tone={isBirthday ? "birthday" : isAutoSchedule ? "primary" : "neutral"}>
                {categoryLabel}
              </Badge>
              {isAuto && <Badge tone="neutral">자동 생성</Badge>}
            </div>
            <h1>
              <span className="event-color-dot" style={{ background: event.color || undefined }} />
              {event.title}
            </h1>
          </div>
        </header>

        <dl className="detail-data-list">
          <div>
            <dt>일정</dt>
            <dd>
              {event.start_date}
              {event.end_date && ` ~ ${event.end_date}`}
            </dd>
          </div>
          {event.memo && (
            <div>
              <dt>메모</dt>
              <dd>{event.memo}</dd>
            </div>
          )}
          {event.participants.length > 0 && (
            <div>
              <dt>참여 인원</dt>
              <dd>{event.participants.map((p) => p.name).join(", ")}</dd>
            </div>
          )}
        </dl>

        {isAutoSchedule && (
          <p className="source-callout">
            이 이벤트는 월간 스케줄의 특순 정보에서 자동 생성되었습니다. 수정하려면{" "}
            <Link to="/schedules">월간 스케줄</Link>에서 특순 정보를 변경해주세요.
          </p>
        )}
        {isBirthday && (
          <p className="source-callout source-callout--birthday">
            이 이벤트는 인명부의 생년월일에서 자동 생성되었습니다. 수정하려면{" "}
            <Link to="/members">인명부</Link>에서 생년월일을 변경해주세요.
          </p>
        )}
      </Card>

      <CommentList kind="calendar" parentId={eventId} />
    </PageContainer>
  );
}

export default CalendarDetail;
