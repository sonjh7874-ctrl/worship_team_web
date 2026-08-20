import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ROLE_RANK = { member: 0, leader: 1, admin: 2 };

// 편집 전용 라우트를 감싸 권한이 없으면 /login으로 보낸다.
// minRole="leader"면 leader 이상(leader, admin), "admin"이면 admin만 통과한다.
export default function RequireRole({ minRole, children }) {
  const { role, loading } = useAuth();
  const location = useLocation();

  // 새로고침 직후 세션 복원 중에는 판단을 보류한다 — 로그인 상태인데도 잠깐 튕기는 것을 막기 위함.
  if (loading) return null;

  const hasAccess = role != null && ROLE_RANK[role] >= ROLE_RANK[minRole];
  if (!hasAccess) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
