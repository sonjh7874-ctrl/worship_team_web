import { useState } from "react";
import { Link } from "react-router-dom";
import { updateMyProfile } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

// 본인 표시 이름을 직접 고치는 화면. 이전에는 가입 시 정한 이름을 관리자가 SQL로
// 고쳐줘야 했다 — 관리자 손을 거치지 않고 본인이 바로 바꿀 수 있게 한다.
function Profile() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const profile = await updateMyProfile(displayName);
      updateUser(profile);
      setMessage("이름이 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div>
        <p>
          로그인이 필요합니다. <Link to="/login">로그인</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/">← 메인으로</Link>

      <h1>내 정보</h1>

      <p style={{ fontSize: 13 }}>이메일: {user.email}</p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      <form onSubmit={handleSubmit}>
        <label>
          이름{" "}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>{" "}
        <button type="submit" disabled={submitting}>
          {submitting ? "저장 중..." : "저장"}
        </button>
      </form>

      <p>
        <Link to="/change-password">비밀번호 변경</Link>
      </p>
    </div>
  );
}

export default Profile;
