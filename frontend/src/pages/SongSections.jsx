import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchSongSections, putSongSections } from "../api/songSections";
import { fetchSongs } from "../api/songs";
import LoadingState from "../components/LoadingState";
import PageContainer from "../components/PageContainer";

// 자주 쓰이는 구간 코드 프리셋. 목록에 없으면 "기타"를 골라 직접 입력한다
// (CalendarEdit의 카테고리 드롭다운과 같은 패턴).
const PRESET_CODES = ["A", "A1", "A2", "B", "B1", "B2", "C", "Tag", "Intro", "Outro", "Bridge"];

function toEditableRow(section, index) {
  return {
    section_code: section.section_code,
    lyrics: section.lyrics,
    display_order: index,
    aliasesInput: (section.aliases || []).join(", "),
    custom: !PRESET_CODES.includes(section.section_code),
  };
}

// 곡별 가사 구간(A/B/C ...) 등록·수정 화면. 한 번 등록해두면 그 곡이 다음에 나올 때마다
// /conti/:id/lyrics 조합에 자동으로 재사용된다(README 5절 "곡 고유 속성" 설계).
//
// 저장은 항상 전체 교체(PUT)다 — conti_songs/schedule_assignments와 같은 패턴으로,
// 한 화면에서 구간 전체를 확인·수정하고 저장 버튼 한 번으로 반영한다.
function SongSections() {
  const { songId } = useParams();
  const [searchParams] = useSearchParams();
  // /conti/:id/lyrics의 미해결 표기에서 "이 표기로 구간 만들기"를 누르면 넘어오는 원문.
  const prefillCode = searchParams.get("prefill");
  // /conti/:id/lyrics에서 넘어온 경우, 저장 후 그 콘티의 자막 화면으로 바로 돌아갈 수 있게 한다.
  const contiId = searchParams.get("contiId");

  const [song, setSong] = useState(null);
  const [rows, setRows] = useState([]);
  const [lastSongForm, setLastSongForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchSongs(), fetchSongSections(songId)])
      .then(([songs, { sections, last_song_form }]) => {
        setSong(songs.find((s) => String(s.id) === songId) || null);
        setLastSongForm(last_song_form);

        let nextRows = sections.map(toEditableRow);
        if (prefillCode && !nextRows.some((r) => r.section_code === prefillCode)) {
          nextRows = [
            ...nextRows,
            {
              section_code: prefillCode,
              lyrics: "",
              display_order: nextRows.length,
              aliasesInput: "",
              custom: !PRESET_CODES.includes(prefillCode),
            },
          ];
        }
        if (nextRows.length === 0) {
          nextRows = [{ section_code: "", lyrics: "", display_order: 0, aliasesInput: "", custom: false }];
        }
        setRows(nextRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // prefillCode는 최초 진입 시 한 번만 반영하면 되므로 의도적으로 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  function updateRow(index, field, value) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function selectCode(index, value) {
    if (value === "__custom__") {
      updateRow(index, "custom", true);
      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, section_code: "" } : r)));
    } else {
      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, custom: false, section_code: value } : r)));
    }
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { section_code: "", lyrics: "", display_order: prev.length, aliasesInput: "", custom: false },
    ]);
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

    const trimmed = rows.map((r) => ({
      section_code: r.section_code.trim(),
      lyrics: r.lyrics.trim(),
      aliases: r.aliasesInput
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    }));
    if (trimmed.some((r) => !r.section_code || !r.lyrics)) {
      setError("구간 코드와 가사를 모두 입력해주세요.");
      return;
    }
    // 구간 코드와 별칭을 합쳐서 중복을 확인한다 — 서버도 같은 기준으로 400을 낸다.
    const allNames = trimmed.flatMap((r) => [r.section_code, ...r.aliases]);
    if (new Set(allNames).size !== allNames.length) {
      setError("구간 코드/별칭이 중복됐습니다.");
      return;
    }

    setSaving(true);
    try {
      const { sections } = await putSongSections(
        songId,
        trimmed.map((r, i) => ({ ...r, display_order: i }))
      );
      setRows(sections.map(toEditableRow));
      setMessage("가사 구간이 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // 콘티에서 진입한 경우에만 원래 자막 검수 흐름으로 돌아가는 보조 링크를 유지한다.
  const contiLyricsLink = contiId ? (
    <Link to={`/conti/${contiId}/lyrics`}>이 콘티 자막 가사 보기</Link>
  ) : null;

  if (loading) {
    return (
      <PageContainer size="editor">
        {contiLyricsLink}
        <LoadingState label="가사 구간을 불러오는 중..." rows={4} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="editor" className="editor-page song-sections-page">
      {contiLyricsLink}
      <h1>가사 구간 관리{song ? ` — ${song.title}` : ""}</h1>
      <p className="editor-help-copy">
        구간 코드는 송폼에 쓰이는 표기(A1, B, Tag 등)와 맞춰 등록해야 자막용 가사 조합에서 자동으로
        연결됩니다. 한 번 등록하면 이 곡이 다음에 나올 때부터 계속 재사용됩니다. 곡마다 송폼 표기가
        바뀌는 경우(예: A1을 이번 주엔 A로 표기)에는 "별칭"에 다른 표기를 함께 등록해두면 됩니다.
      </p>
      {lastSongForm && (
        <p className="editor-help-copy">
          최근 이 곡이 쓰인 송폼: <code>{lastSongForm}</code>
        </p>
      )}

      {error && <p className="inline-notice inline-notice--danger" role="alert">{error}</p>}
      {message && <p className="inline-notice inline-notice--success">{message}</p>}

      <form onSubmit={handleSave}>
        {rows.map((row, index) => (
          <div key={index} className="song-section-row">
            <div className="song-section-row__meta">
              <select
                value={row.custom ? "__custom__" : row.section_code}
                onChange={(e) => selectCode(index, e.target.value)}
                className="song-section-row__code"
              >
                <option value="" disabled>
                  선택...
                </option>
                {PRESET_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
                <option value="__custom__">기타(직접입력)</option>
              </select>
              {row.custom && (
                <input
                  value={row.section_code}
                  onChange={(e) => updateRow(index, "section_code", e.target.value)}
                  placeholder="구간 코드 직접 입력"
                />
              )}
              <input
                value={row.aliasesInput}
                onChange={(e) => updateRow(index, "aliasesInput", e.target.value)}
                placeholder="별칭(쉼표 구분, 선택)"
              />
            </div>
            <textarea
              value={row.lyrics}
              onChange={(e) => updateRow(index, "lyrics", e.target.value)}
              placeholder="이 구간 가사"
              rows={3}
              className="song-section-row__lyrics"
            />
            <div className="song-section-row__actions">
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
    </PageContainer>
  );
}

export default SongSections;
