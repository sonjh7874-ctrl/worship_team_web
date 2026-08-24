import Badge from "./Badge";
import Card from "./Card";

// 콘티의 ContiDetailView처럼 메인/상세 화면에서 공용으로 쓰는 공지 표시 컴포넌트.
function NoticeDetailView({ notice }) {
  return (
    <Card className="notice-detail-card">
      <header className="detail-heading">
        <div>
          <div className="detail-heading__meta">
            {notice.is_pinned && <Badge tone="warm">고정</Badge>}
            <span>{new Date(notice.created_at).toLocaleDateString("ko-KR")}</span>
          </div>
          <h1>{notice.title}</h1>
        </div>
      </header>
      {notice.content ? (
        <div className="notice-detail-card__content">{notice.content}</div>
      ) : (
        <p className="empty-copy">내용이 없습니다.</p>
      )}
    </Card>
  );
}

export default NoticeDetailView;
