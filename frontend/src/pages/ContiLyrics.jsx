import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchContiLyrics } from "../api/lyrics";

// 마디/간주 표기(마커)는 가사가 아니라 진행 정보라 옅게, 해석 실패(unresolved) 토큰은
// 사람이 알아채야 하므로 눈에 띄게 스타일을 다르게 준다.
const BLOCK_STYLE = {
  lyrics: {},
  marker: { color: "#888", fontStyle: "italic" },
  unresolved: { color: "#c00", fontWeight: "bold" },
};

function LyricsBlockView({ block }) {
  const style = BLOCK_STYLE[block.kind] || {};
  return (
    <div style={{ marginBottom: 4, ...style }}>
      {block.kind === "unresolved" ? `[?] ${block.text}` : block.text}
      {block.note && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "#888", fontStyle: "normal", fontWeight: "normal" }}>
          ({block.note})
        </span>
      )}
    </div>
  );
}

function SongLyricsView({ song }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2>
        {song.order_no}. {song.title}
        {song.artist ? ` _ ${song.artist}` : ""}
        {song.song_key ? ` (${song.song_key})` : ""}
      </h2>
      {song.unresolved_count > 0 && (
        <p style={{ color: "#c00" }}>
          미해결 {song.unresolved_count}건 —{" "}
          <Link to={`/songs/${song.song_id ?? ""}/sections`}>가사 구간 등록하러 가기</Link>
        </p>
      )}
      <div>
        {song.blocks.map((block, i) => (
          <LyricsBlockView key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function ContiLyrics() {
  const { contiId } = useParams();
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setNeedsLogin(false);
    fetchContiLyrics(contiId)
      .then(setLyrics)
      .catch((err) => {
        if (err.status === 401) {
          setNeedsLogin(true);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [contiId]);

  function handleCopy() {
    if (!lyrics) return;
    const text = lyrics.songs
      .map((song) => {
        const header = `${song.order_no}. ${song.title}${song.artist ? ` _ ${song.artist}` : ""}`;
        const body = song.blocks
          .map((block) => (block.kind === "unresolved" ? `[?] ${block.text}` : block.text))
          .join("\n");
        return `${header}\n${body}`;
      })
      .join("\n\n");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError("복사에 실패했습니다."));
  }

  const nav = (
    <div>
      <Link to={`/conti/${contiId}`}>← 콘티 상세로</Link>
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

  if (needsLogin) {
    return (
      <div>
        {nav}
        <p>가사는 로그인 후 볼 수 있습니다.</p>
        <Link to={`/login?next=${encodeURIComponent(`/conti/${contiId}/lyrics`)}`}>로그인하기</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {nav}
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  const unresolvedTotal = lyrics.unresolved_total;

  return (
    <div>
      {nav}
      <h1>{lyrics.title} — 자막용 가사</h1>
      <p>{lyrics.service_date}</p>

      {unresolvedTotal > 0 && (
        <p style={{ color: "#c00" }}>
          전체 미해결 {unresolvedTotal}건 — 해석하지 못한 송폼 표기입니다. 각 곡 아래 안내를 참고해 가사
          구간을 등록하면 다음부터 자동으로 해결됩니다.
        </p>
      )}

      <button type="button" onClick={handleCopy}>
        {copied ? "복사됨" : "전체 복사"}
      </button>

      {lyrics.songs.map((song) => (
        <SongLyricsView key={song.order_no} song={song} />
      ))}
    </div>
  );
}

export default ContiLyrics;
