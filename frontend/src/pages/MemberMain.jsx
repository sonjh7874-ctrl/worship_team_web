import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createMember, deleteMember, fetchMembers, updateMember } from "../api/members";
import { useAuth } from "../contexts/AuthContext";

const TEAM_LABELS = { singer: "싱어팀", instrument: "악기팀" };
const GENDER_LABELS = { male: "남", female: "여" };

// 스케줄 배정 드롭다운의 마스터 데이터인 인명부를 리더십이 관리하는 최소 화면.
// 성별은 싱어팀 마이크 1~8번 배치가 성별 고정이라(Phase 12 후속) 필수 필드,
// 생년월일은 선택 입력(있으면 캘린더에 생일이 자동 표시됨)이라 두 필드 모두
// 나중에 값을 바꿀 수 있어야 해서 인라인 수정 기능을 추가했다.
function MemberMain() {
  const { canEdit } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [name, setName] = useState("");
  const [team, setTeam] = useState("singer");
  const [gender, setGender] = useState("male");
  const [birthDate, setBirthDate] = useState("");

  // 인라인 수정 중인 팀원 id. 한 번에 한 행만 편집한다.
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editTeam, setEditTeam] = useState("singer");
  const [editGender, setEditGender] = useState("male");
  const [editBirthDate, setEditBirthDate] = useState("");

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
      const created = await createMember({
        name,
        team,
        gender,
        birth_date: birthDate || null,
      });
      setMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setBirthDate("");
      setMessage("팀원이 추가되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(member) {
    setEditingId(member.id);
    setEditName(member.name);
    setEditTeam(member.team);
    setEditGender(member.gender);
    setEditBirthDate(member.birth_date || "");
    setError(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(e, member) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const updated = await updateMember(member.id, {
        name: editName,
        team: editTeam,
        gender: editGender,
        birth_date: editBirthDate || null,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setMessage("팀원 정보가 저장되었습니다.");
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
          <li key={member.id} style={{ marginBottom: "0.4rem" }}>
            {editingId === member.id ? (
              <form onSubmit={(e) => handleSaveEdit(e, member)} style={{ display: "inline" }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required />{" "}
                <select value={editTeam} onChange={(e) => setEditTeam(e.target.value)}>
                  <option value="singer">싱어팀</option>
                  <option value="instrument">악기팀</option>
                </select>{" "}
                <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                  <option value="male">남</option>
                  <option value="female">여</option>
                </select>{" "}
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                />{" "}
                <button type="submit">저장</button>{" "}
                <button type="button" onClick={cancelEdit}>
                  취소
                </button>
              </form>
            ) : (
              <>
                {member.name} ({TEAM_LABELS[member.team]} · {GENDER_LABELS[member.gender]}
                {member.birth_date && ` · ${member.birth_date}`}) —{" "}
                {member.is_active ? "활동중" : "비활동"}{" "}
                {canEdit && (
                  <>
                    <button type="button" onClick={() => startEdit(member)}>
                      수정
                    </button>{" "}
                    <button type="button" onClick={() => handleToggleActive(member)}>
                      {member.is_active ? "비활동으로 전환" : "활동으로 전환"}
                    </button>{" "}
                    <button type="button" onClick={() => handleDelete(member)} style={{ color: "red" }}>
                      삭제
                    </button>
                  </>
                )}
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
            <label>
              성별{" "}
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="male">남</option>
                <option value="female">여</option>
              </select>
            </label>{" "}
            <label>
              생년월일(선택){" "}
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </label>{" "}
            <button type="submit">추가</button>
          </form>
        </>
      )}
    </div>
  );
}

export default MemberMain;
