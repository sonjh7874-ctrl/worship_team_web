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
    // 과거 콘티 목록에서 다른 상세 페이지로 이동해도 같은 컴포넌트가 재사용되므로(라우트 파라미터만 변경),
    // contiId가 바뀔 때마다 로딩/에러 상태를 초기화하고 새로 조회한다.
    setLoading(true);
    setError(null);
    fetchConti(contiId)
      .then(setConti)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contiId]);

  if (loading) return <p>불러오는 중...</p>;
  if (error) return (
    <div>
      <Link to="/conti">← 콘티 목록으로</Link>
      <p>콘티를 찾을 수 없습니다.</p>
    </div>
  );

  return (
    <div>
      <Link to="/conti">← 콘티 목록으로</Link>{" "}
      <Link to={`/conti/${contiId}/edit`}>편집</Link>
      <ContiDetailView conti={conti} />
    </div>
  );
}

export default ContiDetail;
