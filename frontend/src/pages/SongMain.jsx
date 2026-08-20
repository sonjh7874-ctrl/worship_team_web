import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteSong, fetchSongs, updateSong } from "../api/songs";
import { useAuth } from "../contexts/AuthContext";

// 곡 마스터를 리더십이 정리하는 최소 화면. 곡 등록은 콘티 편집 화면에서 이뤄지므로 여기서는
// 잘못 저장된 곡을 고치거나 지우는 일만 한다.
//
// 제목 수정이 특히 중요한 이유: AI 인식이 곡 마스터를 힌트로 참고하기 때문에, 잘못된 제목이
// 한 번 저장되면 다음 인식에서도 같은 오타가 반복해서 나온다(실측으로 확인됨).
function SongMain() {
  const { canEdit } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  // 수정 중인 곡 id와 편집 중인 값. 한 번에 한 곡만 연다.
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", artist: "", default_key: "" });

  function startEdit(song) {
    setEditingId(song.id);
    setDraft({
      title: song.title,
      artist: song.artist || "",
      default_key: song.default_key || "",
    });
    setError(null);
    setMessage(null);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      // 빈 문자열은 null로 보내야 "값 없음"으로 저장된다(빈 문자열이 그대로 들어가면 검색·비교가 어긋난다).
      const updated = await updateSong(editingId, {
        title: draft.title.trim(),
        artist: draft.artist.trim() || null,
        default_key: draft.default_key.trim() || null,
      });
      // 서버 응답에는 usage_count가 없으므로 기존 값을 유지한 채 나머지만 갈아끼운다.
      setSongs((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated, usage_count: s.usage_count } : s))
      );
      setEditingId(null);
      setMessage("곡 정보가 수정되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchSongs()
      .then(setSongs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // 콘티에 배치된 곡은 서버가 삭제를 막지만(409), 지울 수 있는 곡도 되돌릴 수 없으므로 한 번 더 확인한다.
  async function handleDelete(song) {
    if (!window.confirm(`"${song.title}" 곡을 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await deleteSong(song.id);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      setMessage("곡이 삭제되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  const nav = (
    <div>
      <Link to="/">← 메인으로</Link> <Link to="/conti">콘티</Link>
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
      <h1>곡 마스터 관리</h1>
      <p style={{ fontSize: 13 }}>
        콘티에 한 번이라도 배치된 곡은 과거 콘티 기록이 깨지므로 삭제할 수 없습니다(수정은 가능). AI 콘티 인식이
        이 목록을 참고하므로, 잘못된 제목을 고쳐두면 다음 인식부터 같은 오타가 반복되지 않습니다.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {songs.length === 0 ? (
        <p>등록된 곡이 없습니다.</p>
      ) : (
        <ul>
          {songs.map((song) => (
            <li key={song.id}>
              {canEdit && editingId === song.id ? (
                <form onSubmit={handleSaveEdit}>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="곡 제목"
                    required
                  />{" "}
                  <input
                    value={draft.artist}
                    onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
                    placeholder="아티스트"
                  />{" "}
                  <input
                    value={draft.default_key}
                    onChange={(e) => setDraft({ ...draft, default_key: e.target.value })}
                    placeholder="기본 키"
                    size={6}
                  />{" "}
                  <button type="submit">저장</button>{" "}
                  <button type="button" onClick={() => setEditingId(null)}>
                    취소
                  </button>
                </form>
              ) : (
                <>
                  {song.title}
                  {song.artist ? ` _ ${song.artist}` : ""}
                  {song.default_key ? ` (${song.default_key})` : ""}{" "}
                  {canEdit && (
                    <>
                      <button type="button" onClick={() => startEdit(song)}>
                        수정
                      </button>{" "}
                      {/* 콘티에 배치된 곡은 과거 기록이 깨지므로 서버가 삭제를 막는다(409).
                          버튼 자체를 감추고 어디에 쓰이는지 알려준다. */}
                      {song.usage_count > 0 ? (
                        <span style={{ fontSize: 12, color: "#555" }}>
                          콘티 {song.usage_count}건에서 사용 중
                        </span>
                      ) : (
                        <button type="button" onClick={() => handleDelete(song)}>
                          삭제
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SongMain;
