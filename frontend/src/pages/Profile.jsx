import { useState } from "react";
import { Link } from "react-router-dom";
import { updateMyProfile } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";

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
      <PageContainer><EmptyState title="로그인이 필요합니다" action={<Button as={Link} to="/login">로그인</Button>} /></PageContainer>
    );
  }

  const roleLabel = user.role === "admin" ? "관리자" : user.role === "leader" ? "리더십" : "팀원";

  return (
    <PageContainer className="profile-page">
      <header className="page-heading">
        <div>
          <h1>내 정보</h1>
          <p>계정에 표시되는 이름과 보안 설정을 관리합니다.</p>
        </div>
        <Badge tone="primary">{roleLabel}</Badge>
      </header>

      <Card className="profile-card">
        <dl className="detail-data-list">
          <div>
            <dt>이메일</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>

        {error && (
          <p className="inline-notice inline-notice--danger" role="alert">
            {error}
          </p>
        )}
        {message && <p className="inline-notice inline-notice--success">{message}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            이름{" "}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>{" "}
          <Button type="submit" disabled={submitting}>
            {submitting ? "저장 중..." : "저장"}
          </Button>
        </form>

        <Button as={Link} to="/change-password" variant="secondary">
          비밀번호 변경
        </Button>
      </Card>
    </PageContainer>
  );
}

export default Profile;
