import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchConti } from "../api/contis";
import Button from "../components/Button";
import ContiDetailView from "../components/ContiDetailView";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../contexts/AuthContext";

function ContiDetail() {
  const { canEdit } = useAuth();
  const { contiId } = useParams();
  const [conti, setConti] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 과거 콘티 목록에서 다른 상세 페이지로 이동해도 같은 컴포넌트가 재사용되므로(라우트 파라미터만 변경),
    // contiId가 바뀔 때마다 로딩/에러 상태를 초기화하고 새로 조회한다.
    setLoading(true);
    setError(null);
    fetchConti(contiId)
      .then(setConti)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contiId]);

  if (loading) {
    return (
      <PageContainer>
        <p className="page-status">콘티를 불러오는 중...</p>
      </PageContainer>
    );
  }

  if (error || !conti) {
    return (
      <PageContainer>
        <EmptyState
          title="콘티를 찾을 수 없습니다"
          description="목록에서 다른 콘티를 선택해주세요."
          action={
            <Button as={Link} to="/conti" variant="secondary">
              콘티 목록
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
          <Button as={Link} to={`/conti/${contiId}/edit`} variant="secondary">
            편집
          </Button>
        )}
      </div>
      <ContiDetailView conti={conti} />
    </PageContainer>
  );
}

export default ContiDetail;
