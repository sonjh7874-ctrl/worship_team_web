import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchUsers, updateUserRole } from "../api/auth";

const ROLE_LABELS = { admin: "관리자", leader: "리더십", member: "팀원" };

// admin 전용 — leader 권한을 부여·회수한다. admin 승격은 앱에서 하지 않고
// Supabase SQL로만 하도록 SDD가 정했으므로(관리자 증식 경로를 앱에 두지 않기 위함),
// 여기서는 leader ↔ member 토글만 제공한다.
function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  function load() {
    setLoading(true);
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(user) {
    const nextRole = user.role === "leader" ? "member" : "leader";
    setError(null);
    setMessage(null);
    try {
      const updated = await updateUserRole(user.id, nextRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setMessage(`${updated.display_name}님의 역할을 ${ROLE_LABELS[updated.role]}(으)로 변경했습니다.`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <Link to="/">← 메인으로</Link>
      <h1>사용자 관리</h1>
      <p style={{ fontSize: 13 }}>
        리더십(leader) 권한을 부여·회수합니다. 관리자(admin) 권한은 여기서 바꿀 수 없습니다.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.display_name} ({user.email}) — {ROLE_LABELS[user.role]}{" "}
            {user.role === "admin" ? (
              <span style={{ fontSize: 12, color: "#555" }}>관리자는 SQL로만 변경 가능</span>
            ) : (
              <button type="button" onClick={() => handleToggle(user)}>
                {user.role === "leader" ? "팀원으로 전환" : "리더십으로 전환"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AdminUsers;
