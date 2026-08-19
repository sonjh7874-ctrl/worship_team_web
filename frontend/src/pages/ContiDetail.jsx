import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchConti } from "../api/contis";
import ContiDetailView from "../components/ContiDetailView";

function ContiDetail() {
  const { contiId } = useParams();
  const [conti, setConti] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchConti(contiId)
      .then(setConti)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contiId]);

  if (loading) return <p>불러오는 중...</p>;
  if (error) return <p>콘티를 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/">← 메인으로</Link>{" "}
      <Link to={`/conti/${contiId}/edit`}>편집</Link>
      <ContiDetailView conti={conti} />
    </div>
  );
}

export default ContiDetail;
