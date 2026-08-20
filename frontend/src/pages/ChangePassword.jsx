import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeMyPassword } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

// 관리자가 비밀번호를 초기화했을 때(mustChangePassword) 강제로 이 화면으로 오게 되며,
// 완료 전에는 다른 화면으로 이동할 수 없다(App.jsx의 ForcePasswordChangeGuard). 로그인 상태에서
// 스스로 비밀번호를 바꾸고 싶을 때도 같은 화면을 그대로 쓴다.
function ChangePassword() {
  const { mustChangePassword, updateUser } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const profile = await changeMyPassword(newPassword);
      updateUser(profile);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>비밀번호 변경</h1>

      {mustChangePassword && (
        <p style={{ color: "#a06000" }}>
          관리자가 비밀번호를 초기화했습니다. 계속하려면 새 비밀번호로 바꿔주세요.
        </p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            새 비밀번호{" "}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
        </div>
        <div>
          <label>
            새 비밀번호 확인{" "}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}

export default ChangePassword;
