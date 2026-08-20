import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNotice, fetchNoticeList } from "../api/notices";
import NoticeDetailView from "../components/NoticeDetailView";
import { useAuth } from "../contexts/AuthContext";

function NoticeMain() {
  const { canEdit } = useAuth();
  const [notice, setNotice] = useState(null);
  const [pastNotices, setPastNotices] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 목록은 고정글이 최신순보다 우선 정렬되어 오므로(백엔드), 맨 앞 항목을 그대로
    // "메인에 보여줄 공지"로 채택한다. 목록 응답에는 본문(content)이 없어 상세를 한 번 더 조회한다.
    fetchNoticeList()
      .then((list) => {
        setPastNotices(list);
        if (list.length === 0) {
          setLoading(false);
          return;
        }
        return fetchNotice(list[0].id)
          .then(setNotice)
          .finally(() => setLoading(false));
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>불러오는 중...</p>;
  if (error) return (
    <div>
      <Link to="/">← 메인으로</Link>
      <p>공지사항을 불러오지 못했습니다.</p>
    </div>
  );
  if (!notice) return (
    <div>
      <Link to="/">← 메인으로</Link>{" "}
      {canEdit && <Link to="/notices/new">새 공지 작성</Link>}
      <p>등록된 공지사항이 없습니다.</p>
    </div>
  );

  // 목록에는 위에서 이미 보여준 최상단 공지도 포함돼 있으므로 중복되지 않게 제외한다.
  const olderNotices = pastNotices.filter((item) => item.id !== notice.id);

  return (
    <div>
      <Link to="/">← 메인으로</Link>{" "}
      {canEdit && (
        <>
          <Link to="/notices/new">새 공지 작성</Link>{" "}
          <Link to={`/notices/${notice.id}/edit`}>편집</Link>
        </>
      )}
      <NoticeDetailView notice={notice} />
      {olderNotices.length > 0 && (
        <div>
          <h2>지난 공지</h2>
          <ul>
            {olderNotices.map((item) => (
              <li key={item.id}>
                <Link to={`/notices/${item.id}`}>
                  {item.is_pinned && "📌 "}
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NoticeMain;
