import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchContiLyrics } from "../api/lyrics";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";

// 마디/간주 표기(마커)는 가사가 아니라 진행 정보라 옅고 좁게, 실제 가사 블록(파트)은
// 들여쓰기 + 넉넉한 간격을 줘서 파트 사이가 눈에 띄게 구분되도록 한다. 해석 실패(unresolved)
// 토큰은 사람이 알아채야 하므로 눈에 띄게 스타일을 다르게 준다.
function LyricsBlockView({ block, songId, contiId }) {
  return (
    <div className={`lyrics-block lyrics-block--${block.kind}`}>
      {block.kind === "unresolved" ? `[?] ${block.text}` : block.text}
      {block.note && (
        <Badge tone="warm" className="lyrics-block__note">{block.note}</Badge>
      )}
      {block.kind === "unresolved" && songId != null && (
        <Link
          to={`/songs/${songId}/sections?prefill=${encodeURIComponent(block.text)}&contiId=${contiId}`}
          className="lyrics-block__resolve"
        >
          이 표기로 구간 등록
        </Link>
      )}
    </div>
  );
}

function SongLyricsView({ song, contiId }) {
  const [copied, setCopied] = useState(false);

  // 자막팀에 넘길 때는 마디 표기·미해결 표기 없이 실제 가사 줄만 필요하므로,
  // kind가 "lyrics"인 블록만 골라 곡 단위로 복사한다(연습용 "전체 복사"와는 별개 버튼).
  function handleCopyLyricsOnly() {
    const text = song.blocks
      .filter((block) => block.kind === "lyrics")
      .map((block) => block.text)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="lyrics-song-card">
      <h2>
        {song.order_no}. {song.title}
        {song.artist ? ` _ ${song.artist}` : ""}
        {song.song_key ? ` (${song.song_key})` : ""}
      </h2>
      <Button variant="secondary" onClick={handleCopyLyricsOnly}>
        {copied ? "복사됨" : "이 곡 가사만 복사"}
      </Button>{" "}
      {song.song_id != null && (
        <Link to={`/songs/${song.song_id}/sections?contiId=${contiId}`}>가사 구간 편집</Link>
      )}
      {song.unresolved_count > 0 && (
        <p className="inline-notice inline-notice--danger">미해결 {song.unresolved_count}건 — 아래 표기 옆 링크로 바로 등록할 수 있습니다.</p>
      )}
      <div>
        {song.blocks.map((block, i) => (
          <LyricsBlockView key={i} block={block} songId={song.song_id} contiId={contiId} />
        ))}
      </div>
    </Card>
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

  if (loading) {
    return (
      <PageContainer><p className="page-status">가사를 불러오는 중...</p></PageContainer>
    );
  }

  if (needsLogin) {
    return (
      <PageContainer><EmptyState title="로그인이 필요합니다" description="자막용 가사는 로그인 후 볼 수 있습니다." action={<Button as={Link} to={`/login?next=${encodeURIComponent(`/conti/${contiId}/lyrics`)}`}>로그인하기</Button>} /></PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer><EmptyState title="가사를 불러오지 못했습니다" description={error} /></PageContainer>
    );
  }

  const unresolvedTotal = lyrics.unresolved_total;

  return (
    <PageContainer className="content-page lyrics-page">
      <header className="page-heading"><div><h1>{lyrics.title} — 자막용 가사</h1><p>{lyrics.service_date}</p></div><Button variant="secondary" onClick={handleCopy}>{copied ? "복사됨" : "전체 복사"}</Button></header>

      {unresolvedTotal > 0 && (
        <p className="inline-notice inline-notice--danger">
          전체 미해결 {unresolvedTotal}건 — 해석하지 못한 송폼 표기입니다. 각 곡 아래 안내를 참고해 가사
          구간을 등록하면 다음부터 자동으로 해결됩니다.
        </p>
      )}

      {lyrics.songs.map((song) => (
        <SongLyricsView key={song.order_no} song={song} contiId={contiId} />
      ))}
    </PageContainer>
  );
}

export default ContiLyrics;
