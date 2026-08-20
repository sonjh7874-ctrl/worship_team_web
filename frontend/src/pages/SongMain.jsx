import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteSong, fetchSongs } from "../api/songs";

// 곡 마스터를 리더십이 정리하는 최소 화면. 곡 등록·수정은 콘티 편집 화면에서 이뤄지므로
// 여기서는 "AI 인식이 제목을 잘못 읽어 생긴 곡" 같은 찌꺼기를 확인하고 지우는 용도만 담당한다.
function SongMain() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [password, setPassword] = useState("");

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
      await deleteSong(song.id, password);
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
        콘티에 한 번이라도 배치된 곡은 과거 콘티 기록이 깨지므로 삭제할 수 없습니다. 해당 콘티에서 곡을 먼저
        빼야 지울 수 있습니다.
      </p>

      <div>
        <label>
          편집 비밀번호{" "}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {songs.length === 0 ? (
        <p>등록된 곡이 없습니다.</p>
      ) : (
        <ul>
          {songs.map((song) => (
            <li key={song.id}>
              {song.title}
              {song.artist ? ` _ ${song.artist}` : ""}
              {song.default_key ? ` (${song.default_key})` : ""}{" "}
              {song.usage_count > 0 ? (
                <span style={{ fontSize: 12, color: "#555" }}>콘티 {song.usage_count}건에서 사용 중</span>
              ) : (
                <button type="button" onClick={() => handleDelete(song)}>
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SongMain;
