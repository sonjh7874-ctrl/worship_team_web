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

    fetchContiList()
      .then(setPastContis)
      .catch(() => {});
  }, []);

  if (loading) return <p>불러오는 중...</p>;
  if (error) return <p>등록된 콘티가 없습니다.</p>;

  const olderContis = pastContis.filter((item) => item.id !== conti.id);

  return (
    <div>
      <Link to="/conti/new">새 콘티 만들기</Link>{" "}
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
