import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchSongSections, putSongSections } from "../api/songSections";
import { fetchSongs } from "../api/songs";

// 곡별 가사 구간(A/B/C ...) 등록·수정 화면. 한 번 등록해두면 그 곡이 다음에 나올 때마다
// /conti/:id/lyrics 조합에 자동으로 재사용된다(README 5절 "곡 고유 속성" 설계).
//
// 저장은 항상 전체 교체(PUT)다 — conti_songs/schedule_assignments와 같은 패턴으로,
// 한 화면에서 구간 전체를 확인·수정하고 저장 버튼 한 번으로 반영한다.
function SongSections() {
  const { songId } = useParams();
  const [song, setSong] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchSongs(), fetchSongSections(songId)])
      .then(([songs, sections]) => {
        setSong(songs.find((s) => String(s.id) === songId) || null);
        setRows(
          sections.length > 0
            ? sections.map((s) => ({ ...s }))
            : [{ section_code: "", lyrics: "", display_order: 0 }]
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [songId]);

  function updateRow(index, field, value) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { section_code: "", lyrics: "", display_order: prev.length }]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function moveRow(index, direction) {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmed = rows.map((r) => ({ ...r, section_code: r.section_code.trim(), lyrics: r.lyrics.trim() }));
    if (trimmed.some((r) => !r.section_code || !r.lyrics)) {
      setError("구간 코드와 가사를 모두 입력해주세요.");
      return;
    }
    const codes = trimmed.map((r) => r.section_code);
    if (new Set(codes).size !== codes.length) {
      setError("구간 코드가 중복됐습니다.");
      return;
    }

    setSaving(true);
    try {
      const saved = await putSongSections(
        songId,
        trimmed.map((r, i) => ({ ...r, display_order: i }))
      );
      setRows(saved.map((s) => ({ ...s })));
      setMessage("가사 구간이 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const nav = (
    <div>
      <Link to="/">← 메인으로</Link> <Link to="/songs">곡 관리</Link>
    </div>
  );

  if (loading) {
    return (
      <div>
        {nav}
        <p>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      {nav}
      <h1>가사 구간 관리{song ? ` — ${song.title}` : ""}</h1>
      <p style={{ fontSize: 13 }}>
        구간 코드는 송폼에 쓰이는 표기(A1, B, Tag 등)와 맞춰 등록해야 자막용 가사 조합에서 자동으로
        연결됩니다. 한 번 등록하면 이 곡이 다음에 나올 때부터 계속 재사용됩니다.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      <form onSubmit={handleSave}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
            <input
              value={row.section_code}
              onChange={(e) => updateRow(index, "section_code", e.target.value)}
              placeholder="구간 코드 (A1, B, Tag ...)"
              size={12}
            />
            <textarea
              value={row.lyrics}
              onChange={(e) => updateRow(index, "lyrics", e.target.value)}
              placeholder="이 구간 가사"
              rows={3}
              style={{ flex: 1 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0}>
                ↑
              </button>
              <button type="button" onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1}>
                ↓
              </button>
              <button type="button" onClick={() => removeRow(index)}>
                삭제
              </button>
            </div>
          </div>
        ))}

        <button type="button" onClick={addRow}>
          구간 추가
        </button>{" "}
        <button type="submit" disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}

export default SongSections;
