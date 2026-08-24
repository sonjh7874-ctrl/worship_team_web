import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchNotice } from "../api/notices";
import Button from "../components/Button";
import CommentList from "../components/CommentList";
import EmptyState from "../components/EmptyState";
import NoticeDetailView from "../components/NoticeDetailView";
import PageContainer from "../components/PageContainer";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../contexts/AuthContext";

function NoticeDetail() {
  const { canEdit } = useAuth();
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

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="공지사항을 불러오는 중..." />
      </PageContainer>
    );
  }

  if (error || !notice) {
    return (
      <PageContainer>
        <EmptyState
          title="공지사항을 찾을 수 없습니다"
          action={
            <Button as={Link} to="/notices" variant="secondary">
              공지 목록
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="content-page">
      <div className="page-action-row">
        {canEdit && (
          <Button as={Link} to={`/notices/${noticeId}/edit`} variant="secondary">
            편집
          </Button>
        )}
      </div>
      <NoticeDetailView notice={notice} />
      <CommentList kind="notices" parentId={noticeId} />
    </PageContainer>
  );
}

export default NoticeDetail;
