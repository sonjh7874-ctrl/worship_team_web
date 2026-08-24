import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchContiList, fetchLatestConti } from "../api/contis";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import ContiDetailView from "../components/ContiDetailView";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../contexts/AuthContext";

function PageHeader({ title, description, action }) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

function ContiMain() {
  const { canEdit } = useAuth();
  const [conti, setConti] = useState(null);
  const [pastContis, setPastContis] = useState([]);
  const [draftContis, setDraftContis] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // 과거 콘티 검색(제목 기준, 클라이언트 필터) — NoticeMain과 동일한 패턴.
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchLatestConti()
      .then(setConti)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // 과거 콘티 목록은 있으면 좋은 보조 정보라 실패해도 메인 화면 전체를 에러로 막지 않는다.
    fetchContiList()
      .then(setPastContis)
      .catch(() => {});

    // 검수 대기(draft) 목록. 로그인이 없어 "내 초안"을 따로 모을 수단이 없으므로,
    // AI 인식만 해두고 검수를 마치지 못한 콘티를 여기서 찾아 이어가거나 지울 수 있게 한다.
    fetchContiList("draft")
      .then(setDraftContis)
      .catch(() => {});
  }, []);

  // 새 콘티 만들기와 곡 관리는 콘티 유무와 무관한 화면 진입점이므로, 콘티가 하나도
  // 없는 상태(신규 배포 직후 등)에서도 항상 보여야 다른 화면으로 갈 수 있다.
  const headerAction = (
    <div className="inline-actions">
      <Button as={Link} to="/songs" variant="secondary">
        곡 관리
      </Button>
      {canEdit && (
        <Button as={Link} to="/conti/new">
          새 콘티 만들기
        </Button>
      )}
    </div>
  );

  // 검수 대기는 편집 권한이 있는 사람만 의미가 있는 작업 목록이라 leader 이상에게만 보여준다.
  const draftSection = canEdit && draftContis.length > 0 && (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">LEADER</p>
          <h2>검수 대기</h2>
        </div>
      </div>
      <Card variant="list" className="compact-list-card">
        <ul className="content-link-list">
          {draftContis.map((item) => (
            <li key={item.id}>
              <Link to={`/conti/${item.id}/edit`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.service_date}</small>
                </span>
                <Badge tone="warm">검수 필요</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );

  if (loading) {
    return (
      <PageContainer className="content-page">
        <LoadingState label="콘티를 불러오는 중..." />
      </PageContainer>
    );
  }

  if (error || !conti) {
    return (
      <PageContainer className="content-page">
        <PageHeader title="콘티" action={headerAction} />
        <EmptyState
          title="게시된 콘티가 없습니다"
          description="새 콘티가 게시되면 이곳에서 바로 확인할 수 있습니다."
        />
        {draftSection}
      </PageContainer>
    );
  }

  // 전체 목록에는 최신 콘티도 포함돼 있으므로, 위에서 이미 보여준 것과 중복되지 않게 제외한다.
  const olderContis = pastContis
    .filter((item) => item.id !== conti.id)
    .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <PageContainer className="content-page">
      <PageHeader
        title="콘티"
        description="예배 순서와 송폼, 악보를 한곳에서 확인하세요."
        action={headerAction}
      />
      <div className="page-action-row">
        {canEdit && (
          <Button as={Link} to={`/conti/${conti.id}/edit`} variant="secondary">
            현재 콘티 편집
          </Button>
        )}
      </div>
      <ContiDetailView conti={conti} />
      {draftSection}
      {pastContis.length > 1 && (
        <section className="content-section">
          <div className="section-heading">
            <h2>과거 콘티</h2>
          </div>
          <input
            className="search-input"
            type="search"
            placeholder="제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {olderContis.length === 0 ? (
            <EmptyState title="검색 결과가 없습니다" titleAs="h3" />
          ) : (
            <Card variant="list" className="compact-list-card">
              <ul className="content-link-list">
                {olderContis.map((item) => (
                  <li key={item.id}>
                    <Link to={`/conti/${item.id}`}>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.service_date}</small>
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

export default ContiMain;
