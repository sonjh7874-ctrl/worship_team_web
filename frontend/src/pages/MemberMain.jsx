import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createMember, deleteMember, fetchMembers, updateMember } from "../api/members";
import { useAuth } from "../contexts/AuthContext";

const TEAM_LABELS = { singer: "싱어팀", instrument: "악기팀" };

// 스케줄 배정 드롭다운의 마스터 데이터인 인명부를 리더십이 관리하는 최소 화면.
// 풀 CRUD UI가 아니라 목록 조회 + 추가 + 활동여부 토글 + 삭제만 제공한다(README상 상세 필드 없음 원칙).
function MemberMain() {
  const { canEdit } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [name, setName] = useState("");
  const [team, setTeam] = useState("singer");

  function loadMembers() {
    setLoading(true);
    fetchMembers()
      .then(setMembers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const created = await createMember({ name, team });
      setMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setMessage("팀원이 추가되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleActive(member) {
    setError(null);
    setMessage(null);
    try {
      const updated = await updateMember(member.id, { is_active: !member.is_active });
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err.message);
    }
  }

  // 배정 기록이 남아있을 수 있어 완전 삭제는 되돌릴 수 없다 — 실수 클릭 방지용 확인창.
  async function handleDelete(member) {
    if (!window.confirm(`"${member.name}" 팀원을 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await deleteMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setMessage("팀원이 삭제되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <Link to="/">← 메인으로</Link>
      <h1>인명부</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      <ul>
        {members.map((member) => (
          <li key={member.id}>
            {member.name} ({TEAM_LABELS[member.team]}) —{" "}
            {member.is_active ? "활동중" : "비활동"}{" "}
            {canEdit && (
              <>
                <button type="button" onClick={() => handleToggleActive(member)}>
                  {member.is_active ? "비활동으로 전환" : "활동으로 전환"}
                </button>{" "}
                <button type="button" onClick={() => handleDelete(member)} style={{ color: "red" }}>
                  삭제
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <>
          <h2>팀원 추가</h2>
          <form onSubmit={handleAdd}>
            <label>
              이름{" "}
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>{" "}
            <label>
              팀구분{" "}
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="singer">싱어팀</option>
                <option value="instrument">악기팀</option>
              </select>
            </label>{" "}
            <button type="submit">추가</button>
          </form>
        </>
      )}
    </div>
  );
}

export default MemberMain;
