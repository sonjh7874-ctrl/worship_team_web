// 콘티의 ContiDetailView처럼 메인/상세 화면에서 공용으로 쓰는 공지 표시 컴포넌트.
function NoticeDetailView({ notice }) {
  return (
    <div>
      <h1>
        {notice.is_pinned && "📌 "}
        {notice.title}
      </h1>
      <p>{new Date(notice.created_at).toLocaleDateString()}</p>
      {notice.content ? (
        <p style={{ whiteSpace: "pre-wrap" }}>{notice.content}</p>
      ) : (
        <p>내용이 없습니다.</p>
      )}
    </div>
  );
}

export default NoticeDetailView;
