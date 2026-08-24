import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNotice, fetchNoticeList } from "../api/notices";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import NoticeDetailView from "../components/NoticeDetailView";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../contexts/AuthContext";

function NoticeMain() {
  const { canEdit } = useAuth();
  const [notice, setNotice] = useState(null);
  const [pastNotices, setPastNotices] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // 지난 공지 목록 검색(제목 기준, 클라이언트 필터). 목록 API가 페이지네이션 없이
  // 전체를 반환하므로(API명세 0-3) 서버 쪽 검색 API 없이 이미 받은 목록만 걸러도 충분하다.
  const [query, setQuery] = useState("");

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

  if (loading) {
    return (
      <PageContainer>
        <p className="page-status">공지사항을 불러오는 중...</p>
      </PageContainer>
    );
  }

  const header = (
    <header className="page-heading">
      <div>
        <h1>공지사항</h1>
        <p>팀에 공유된 안내와 변경 사항을 확인하세요.</p>
      </div>
      {canEdit && (
        <Button as={Link} to="/notices/new">
          새 공지 작성
        </Button>
      )}
    </header>
  );

  if (error || !notice) {
    return (
      <PageContainer className="content-page">
        {header}
        <EmptyState
          title={error ? "공지사항을 불러오지 못했습니다" : "등록된 공지사항이 없습니다"}
          description={error ? "잠시 후 다시 시도해주세요." : "새 공지가 등록되면 이곳에 표시됩니다."}
        />
      </PageContainer>
    );
  }

  // 목록에는 위에서 이미 보여준 최상단 공지도 포함돼 있으므로 중복되지 않게 제외한다.
  const olderNotices = pastNotices
    .filter((item) => item.id !== notice.id)
    .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <PageContainer className="content-page">
      {header}
      <div className="page-action-row">
        {canEdit && (
          <Button as={Link} to={`/notices/${notice.id}/edit`} variant="secondary">
            현재 공지 편집
          </Button>
        )}
      </div>
      <NoticeDetailView notice={notice} />
      {pastNotices.length > 1 && (
        <section className="content-section">
          <div className="section-heading">
            <h2>지난 공지</h2>
          </div>
          <input
            className="search-input"
            type="search"
            placeholder="제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {olderNotices.length === 0 ? (
            <EmptyState title="검색 결과가 없습니다" titleAs="h3" />
          ) : (
            <Card variant="list" className="compact-list-card">
              <ul className="content-link-list">
                {olderNotices.map((item) => (
                  <li key={item.id}>
                    <Link to={`/notices/${item.id}`}>
                      <span>
                        <span className="list-title-row">
                          {item.is_pinned && <Badge tone="warm">고정</Badge>}
                          <strong>{item.title}</strong>
                        </span>
                        <small>
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                          {item.comment_count > 0 && ` · 댓글 ${item.comment_count}`}
                        </small>
                      </span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}
    </PageContainer>
  );
}

export default NoticeMain;
