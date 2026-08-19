import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchContiList, fetchLatestConti } from "../api/contis";
import ContiDetailView from "../components/ContiDetailView";

function ContiMain() {
  const [conti, setConti] = useState(null);
  const [pastContis, setPastContis] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestConti()
      .then(setConti)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // 과거 콘티 목록은 있으면 좋은 보조 정보라 실패해도 메인 화면 전체를 에러로 막지 않는다.
    fetchContiList()
      .then(setPastContis)
      .catch(() => {});
  }, []);

  // 인명부/공지사항/스케줄 링크는 콘티 유무와 무관한 전역 내비게이션이므로, 콘티가
  // 하나도 없는 상태(신규 배포 직후 등)에서도 항상 보여야 다른 화면으로 갈 수 있다.
  const nav = (
    <div>
      <Link to="/">← 메인으로</Link>{" "}
      <Link to="/conti/new">새 콘티 만들기</Link>{" "}
      <Link to="/members">인명부</Link>{" "}
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

  if (error) {
    return (
      <div>
        {nav}
        <p>등록된 콘티가 없습니다.</p>
      </div>
    );
  }

  // 전체 목록에는 최신 콘티도 포함돼 있으므로, 위에서 이미 보여준 것과 중복되지 않게 제외한다.
  const olderContis = pastContis.filter((item) => item.id !== conti.id);

  return (
    <div>
      {nav}
      <Link to={`/conti/${conti.id}/edit`}>편집</Link>
      <ContiDetailView conti={conti} />
      {olderContis.length > 0 && (
        <div>
          <h2>과거 콘티</h2>
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
