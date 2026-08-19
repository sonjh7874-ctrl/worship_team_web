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

  if (loading) return <p>불러오는 중...</p>;
  if (error) return <p>등록된 콘티가 없습니다.</p>;

  // 전체 목록에는 최신 콘티도 포함돼 있으므로, 위에서 이미 보여준 것과 중복되지 않게 제외한다.
  const olderContis = pastContis.filter((item) => item.id !== conti.id);

  return (
    <div>
      <Link to="/conti/new">새 콘티 만들기</Link>{" "}
      <Link to={`/conti/${conti.id}/edit`}>편집</Link>{" "}
      <Link to="/members">인명부</Link>{" "}
      <Link to="/notices">공지사항</Link>{" "}
      <Link to="/schedules">월간 스케줄</Link>
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
