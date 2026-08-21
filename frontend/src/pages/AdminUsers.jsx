import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAccountEvents, fetchUsers, resetUserPassword, updateUserRole } from "../api/auth";

const ROLE_LABELS = { admin: "관리자", leader: "리더십", member: "팀원" };

const EVENT_LABELS = {
  display_name_changed: "이름 변경",
  role_changed: "역할 변경",
  password_reset: "비밀번호 초기화",
};

function formatEventValue(eventType, value) {
  if (value === null || value === undefined) return null;
  return eventType === "role_changed" ? ROLE_LABELS[value] ?? value : value;
}

// admin 전용 — leader 권한을 부여·회수하고, 비밀번호를 초기화한다. admin 승격은 앱에서
// 하지 않고 Supabase SQL로만 하도록 SDD가 정했으므로(관리자 증식 경로를 앱에 두지 않기 위함),
// 여기서는 leader ↔ member 토글만 제공한다.
function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  // 방금 발급한 임시 비밀번호 — 응답에만 담기고 어디에도 저장되지 않으므로 화면에서
  // 이 순간에만 보여주고 안내를 유도한다.
  const [tempPassword, setTempPassword] = useState(null);
  // 이력 펼침 상태 — 사용자 id별로 이벤트 목록을 캐시해 다시 펼칠 때 재조회하지 않는다.
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [eventsByUser, setEventsByUser] = useState({});
  const [eventsError, setEventsError] = useState(null);

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

  async function handleResetPassword(user) {
    if (!window.confirm(`"${user.display_name}"님의 비밀번호를 초기화할까요? 기존 비밀번호는 즉시 무효화됩니다.`)) {
      return;
    }
    setError(null);
    setMessage(null);
    setTempPassword(null);
    try {
      const { temp_password } = await resetUserPassword(user.id);
      setTempPassword({ user, value: temp_password });
      // 다음 로그인부터 비밀번호 변경이 강제되므로, 관리자가 임시 비밀번호를 지금 이 순간에만
      // 직접 안내할 수 있다 — 이 값은 서버에도 저장되지 않아 다시 조회할 방법이 없다.
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, force_password_change: true } : u))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleHistory(user) {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(user.id);
    setEventsError(null);
    if (eventsByUser[user.id]) return; // 이미 불러온 적 있으면 재조회하지 않는다.
    try {
      const events = await fetchAccountEvents(user.id);
      setEventsByUser((prev) => ({ ...prev, [user.id]: events }));
    } catch (err) {
      setEventsError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <Link to="/">← 메인으로</Link>
      <h1>사용자 관리</h1>
      <p style={{ fontSize: 13 }}>
        리더십(leader) 권한을 부여·회수합니다. 관리자(admin) 권한은 여기서 바꿀 수 없습니다.
        비밀번호를 잊어버린 팀원은 여기서 초기화한 뒤 안내해주세요 — 이메일은 보내지 않으며,
        초기화된 사람은 다음 로그인 시 새 비밀번호로 바꾸라는 화면을 먼저 보게 됩니다.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {tempPassword && (
        <div style={{ border: "1px solid #a06000", padding: "0.6rem", margin: "0.6rem 0" }}>
          <strong>{tempPassword.user.display_name}</strong>님의 임시 비밀번호:{" "}
          <code style={{ fontSize: 16 }}>{tempPassword.value}</code>
          <p style={{ fontSize: 12, color: "#a06000", margin: "0.3rem 0 0" }}>
            이 값은 지금 한 번만 표시됩니다. 본인에게 직접(카톡 등) 안내해주세요. 로그인하면 즉시 새
            비밀번호로 바꾸라는 화면이 뜹니다.
          </p>
        </div>
      )}

      <ul>
        {users.map((user) => (
          <li key={user.id} style={{ marginBottom: "0.5rem" }}>
            {user.display_name} ({user.email}) — {ROLE_LABELS[user.role]}
            {user.force_password_change && (
              <span style={{ fontSize: 12, color: "#a06000" }}> · 비밀번호 변경 대기중</span>
            )}{" "}
            {user.role === "admin" ? (
              <span style={{ fontSize: 12, color: "#555" }}>관리자는 SQL로만 변경 가능</span>
            ) : (
              <button type="button" onClick={() => handleToggle(user)}>
                {user.role === "leader" ? "팀원으로 전환" : "리더십으로 전환"}
              </button>
            )}{" "}
            <button type="button" onClick={() => handleResetPassword(user)}>
              비밀번호 초기화
            </button>{" "}
            <button type="button" onClick={() => handleToggleHistory(user)}>
              {expandedUserId === user.id ? "이력 닫기" : "이력 보기"}
            </button>
            {expandedUserId === user.id && (
              <div style={{ fontSize: 12, marginTop: "0.3rem", paddingLeft: "1rem" }}>
                {eventsError && <p style={{ color: "red" }}>{eventsError}</p>}
                {eventsByUser[user.id] === undefined && !eventsError && <p>불러오는 중...</p>}
                {eventsByUser[user.id]?.length === 0 && <p>기록된 이벤트가 없습니다.</p>}
                {eventsByUser[user.id]?.map((event) => {
                  const oldLabel = formatEventValue(event.event_type, event.old_value);
                  const newLabel = formatEventValue(event.event_type, event.new_value);
                  return (
                    <p key={event.id} style={{ margin: "0.15rem 0" }}>
                      [{EVENT_LABELS[event.event_type]}]
                      {oldLabel && newLabel ? ` ${oldLabel} → ${newLabel}` : ""}{" "}
                      ({event.changed_by_name}, {new Date(event.created_at).toLocaleString("ko-KR")})
                    </p>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AdminUsers;
