import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";
import PageContainer from "../components/PageContainer";

const REMEMBERED_EMAIL_KEY = "worship_team_remembered_email";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";

  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // 비밀번호는 저장하지 않고 이메일만 기억한다 — 다음 로그인 때 입력칸에 자동으로 채워진다.
      if (rememberEmail) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer className="auth-page">
      <Card className="auth-card">
        <header>
          <p className="auth-card__eyebrow">WORSHIP TEAM</p>
          <h1>로그인</h1>
          <p>팀 일정과 콘티를 확인하려면 로그인해주세요.</p>
        </header>

        {error && (
          <p className="inline-notice inline-notice--danger" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
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
              />
            </label>
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
              />{" "}
              아이디 기억하기
            </label>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <p>
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
        <p className="auth-card__help">비밀번호를 잊으셨다면 리더에게 재설정을 요청해주세요.</p>
      </Card>
    </PageContainer>
  );
}

export default Login;
