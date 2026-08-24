import { useEffect, useState } from "react";
import { fetchAccountEvents, fetchUsers, resetUserPassword, updateUserRole } from "../api/auth";
import Badge from "../components/Badge";
import Button from "../components/Button";
import LoadingState from "../components/LoadingState";
import PageContainer from "../components/PageContainer";

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
  const [passwordCopied, setPasswordCopied] = useState(false);
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
    setPasswordCopied(false);
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

  // 임시 비밀번호는 서버에서 다시 조회할 수 없는 1회성 값이므로, 관리자가 오타 없이
  // 전달할 수 있게 현재 화면의 값만 클립보드로 복사하고 별도 저장은 하지 않는다.
  async function handleCopyTempPassword() {
    if (!tempPassword) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(tempPassword.value);
      setPasswordCopied(true);
      window.setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      setError("임시 비밀번호를 복사하지 못했습니다. 값을 직접 선택해 복사해주세요.");
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

  if (loading) return <PageContainer size="editor"><LoadingState label="사용자 목록을 불러오는 중..." rows={5} /></PageContainer>;

  return (
    <PageContainer size="editor" className="admin-users-page">
      <header className="page-heading">
        <div>
          <h1>사용자 관리</h1>
          <p>
            리더십(leader) 권한을 부여·회수합니다. 관리자(admin) 권한은 여기서 바꿀 수 없습니다.
            비밀번호를 잊어버린 팀원은 여기서 초기화한 뒤 안내해주세요 — 이메일은 보내지 않으며,
            초기화된 사람은 다음 로그인 시 새 비밀번호로 바꾸라는 화면을 먼저 보게 됩니다.
          </p>
        </div>
      </header>

      {error && <p className="inline-notice inline-notice--danger" role="alert">{error}</p>}
      {message && <p className="inline-notice inline-notice--success">{message}</p>}

      {tempPassword && (
        <aside className="temp-password-callout" role="status">
          <div className="temp-password-callout__value">
            <span><strong>{tempPassword.user.display_name}</strong>님의 임시 비밀번호: <code>{tempPassword.value}</code></span>
            <Button variant="secondary" onClick={handleCopyTempPassword} aria-live="polite">
              {passwordCopied ? "복사됨" : "복사"}
            </Button>
          </div>
          <p>
            이 값은 지금 한 번만 표시됩니다. 본인에게 직접(카톡 등) 안내해주세요. 로그인하면 즉시 새
            비밀번호로 바꾸라는 화면이 뜹니다.
          </p>
        </aside>
      )}

      <ul className="admin-user-list">
        {users.map((user) => (
          <li key={user.id} className="admin-user-card">
            <div className="admin-user-card__identity">
              <strong>{user.display_name}</strong>
              <span>{user.email}</span>
              <Badge tone={user.role === "admin" ? "warm" : user.role === "leader" ? "primary" : "neutral"}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
            {user.force_password_change && (
              <Badge tone="warm">비밀번호 변경 대기</Badge>
            )}{" "}
            {user.role === "admin" ? (
              <span className="admin-user-card__readonly">관리자는 SQL로만 변경 가능</span>
            ) : (
              <button type="button" onClick={() => handleToggle(user)}>
                {user.role === "leader" ? "팀원으로 전환" : "리더십으로 전환"}
              </button>
            )}{" "}
            <Button variant="danger" onClick={() => handleResetPassword(user)}>
              비밀번호 초기화
            </Button>{" "}
            <button
              type="button"
              onClick={() => handleToggleHistory(user)}
              aria-expanded={expandedUserId === user.id}
              aria-controls={`account-history-${user.id}`}
            >
              {expandedUserId === user.id ? "이력 닫기" : "이력 보기"}
            </button>
            {expandedUserId === user.id && (
              <div className="account-history" id={`account-history-${user.id}`}>
                {eventsError && <p className="inline-notice inline-notice--danger" role="alert">{eventsError}</p>}
                {eventsByUser[user.id] === undefined && !eventsError && <p>불러오는 중...</p>}
                {eventsByUser[user.id]?.length === 0 && <p>기록된 이벤트가 없습니다.</p>}
                {eventsByUser[user.id]?.map((event) => {
                  const oldLabel = formatEventValue(event.event_type, event.old_value);
                  const newLabel = formatEventValue(event.event_type, event.new_value);
                  return (
                    <p key={event.id}>
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
    </PageContainer>
  );
}

export default AdminUsers;
