import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchNotice } from "../api/notices";
import NoticeDetailView from "../components/NoticeDetailView";

function NoticeDetail() {
  const { noticeId } = useParams();
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 목록에서 다른 상세 페이지로 이동해도 같은 컴포넌트가 재사용되므로(라우트 파라미터만 변경),
    // noticeId가 바뀔 때마다 로딩/에러 상태를 초기화하고 새로 조회한다.
    setLoading(true);
    setError(null);
    fetchNotice(noticeId)
      .then(setNotice)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [noticeId]);

  if (loading) return <p>불러오는 중...</p>;
  if (error) return (
    <div>
      <Link to="/notices">← 공지 목록으로</Link>
      <p>공지사항을 찾을 수 없습니다.</p>
    </div>
  );

  return (
    <div>
      <Link to="/notices">← 목록으로</Link>{" "}
      <Link to={`/notices/${noticeId}/edit`}>편집</Link>
      <NoticeDetailView notice={notice} />
    </div>
  );
}

export default NoticeDetail;
