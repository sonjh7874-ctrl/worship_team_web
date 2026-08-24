import { useMemo, useState } from "react";

// 한 화면에 보여줄 검색 결과 수. 모바일에서 목록이 길어지면 오히려 고르기 어려워 잘라서 보여준다.
const VISIBLE_LIMIT = 8;

// 검색용 정규화 — 공백과 대소문자를 무시해 "삶의예배"로도 "삶의 예배"가 걸리게 한다.
function normalize(text) {
  return (text || "").toLowerCase().replace(/\s+/g, "");
}

/**
 * 곡 마스터에서 곡을 고르는 입력. 곡이 쌓이면 <select> 전체 목록으로는 찾기 어려워 검색으로 바꿨다.
 *
 * value가 있으면 "선택된 곡"만 보여주고, [변경]을 눌러야 검색창이 열린다 —
 * 검수 화면에 곡이 6줄씩 늘어서므로 평소에는 접어두는 편이 읽기 쉽다.
 */
function SongPicker({ songs, value, onSelect }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const selected = songs.find((song) => song.id === value) || null;

  const matches = useMemo(() => {
    const q = normalize(query);
    // 검색어가 없으면 앞에서부터 몇 개만 보여준다(곡이 적을 때는 그대로 둘러보기 용도).
    const filtered = q
      ? songs.filter((song) => normalize(`${song.title}${song.artist || ""}`).includes(q))
      : songs;
    return { list: filtered.slice(0, VISIBLE_LIMIT), total: filtered.length };
  }, [songs, query]);

  function choose(song) {
    onSelect(song);
    setQuery("");
    setSearching(false);
  }

  // 곡을 이미 고른 상태 — 검색창을 접어두고 무엇을 골랐는지만 보여준다.
  if (selected && !searching) {
    return (
      <div className="song-picker song-picker--selected">
        <strong>{selected.title}</strong>
        {selected.artist ? ` _ ${selected.artist}` : ""}{" "}
        <button type="button" onClick={() => setSearching(true)}>
          변경
        </button>{" "}
        <button type="button" onClick={() => onSelect(null)}>
          새 곡으로 등록
        </button>
      </div>
    );
  }

  return (
    <div className="song-picker">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="곡 제목·아티스트로 검색"
      />{" "}
      {selected && (
        <button type="button" onClick={() => setSearching(false)}>
          취소
        </button>
      )}
      {matches.list.length === 0 ? (
        <p className="song-picker__empty">
          검색 결과가 없습니다. 이대로 두면 새 곡으로 등록됩니다.
        </p>
      ) : (
        <ul className="song-picker__results">
          {matches.list.map((song) => (
            <li key={song.id}>
              <button type="button" onClick={() => choose(song)}>
                {song.title}
                {song.artist ? ` _ ${song.artist}` : ""}
              </button>
            </li>
          ))}
          {matches.total > VISIBLE_LIMIT && (
            <li className="song-picker__more">
              외 {matches.total - VISIBLE_LIMIT}건 — 검색어를 더 입력해주세요
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SongPicker;
