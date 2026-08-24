import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchContiList, fetchLatestConti } from "../api/contis";
import ContiDetailView from "../components/ContiDetailView";
import { useAuth } from "../contexts/AuthContext";

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

  // 인명부/공지사항/스케줄 링크는 콘티 유무와 무관한 전역 내비게이션이므로, 콘티가
  // 하나도 없는 상태(신규 배포 직후 등)에서도 항상 보여야 다른 화면으로 갈 수 있다.
  const nav = (
    <div>
      {canEdit && <Link to="/conti/new">새 콘티 만들기</Link>}{" "}
      <Link to="/members">인명부</Link>{" "}
      <Link to="/songs">곡 관리</Link>{" "}
      <Link to="/notices">공지사항</Link>{" "}
      <Link to="/schedules">월간 스케줄</Link>
    </div>
  );

  if (loading) {
    return (
      <div>
        {nav}
        <p>불러오는 중...</p>
      </div>
    );
  }

  // 검수 대기는 편집 권한이 있는 사람만 의미가 있는 작업 목록이라 leader 이상에게만 보여준다.
  const draftSection = canEdit && draftContis.length > 0 && (
    <div>
      <h2>검수 대기</h2>
      <ul>
        {draftContis.map((item) => (
          <li key={item.id}>
            <Link to={`/conti/${item.id}/edit`}>
              {item.service_date} - {item.title}
            </Link>{" "}
            <span style={{ fontSize: 12, color: "#a06000" }}>검수 후 게시해주세요</span>
          </li>
        ))}
      </ul>
    </div>
  );

  if (error) {
    return (
      <div>
        {nav}
        <p>등록된 콘티가 없습니다.</p>
        {draftSection}
      </div>
    );
  }

  // 전체 목록에는 최신 콘티도 포함돼 있으므로, 위에서 이미 보여준 것과 중복되지 않게 제외한다.
  const olderContis = pastContis
    .filter((item) => item.id !== conti.id)
    .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      {nav}
      {canEdit && <Link to={`/conti/${conti.id}/edit`}>편집</Link>}
      <ContiDetailView conti={conti} />
      {draftSection}
      {pastContis.length > 1 && (
        <div>
          <h2>과거 콘티</h2>
          <input
            type="search"
            placeholder="제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {olderContis.length === 0 && <p style={{ color: "#666" }}>검색 결과가 없습니다.</p>}
          <ul>
            {olderContis.map((item) => (
              <li key={item.id}>
                <Link to={`/conti/${item.id}`}>
                  {item.service_date} - {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ContiMain;
