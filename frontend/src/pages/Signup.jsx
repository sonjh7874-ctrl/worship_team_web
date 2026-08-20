import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // 가입은 항상 member 권한으로 시작한다 — 편집 권한(leader)은 관리자가 /admin/users에서 부여한다.
      await signup(email, password, displayName);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link to="/login">← 로그인으로</Link>

      <h1>회원가입</h1>

      <p>
        가입 후에는 조회만 가능합니다. 콘티·공지·스케줄 편집 권한은 리더에게
        요청해주세요.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            이름{" "}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            이메일{" "}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            비밀번호{" "}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "가입 중..." : "가입하기"}
        </button>
      </form>
    </div>
  );
}

export default Signup;
