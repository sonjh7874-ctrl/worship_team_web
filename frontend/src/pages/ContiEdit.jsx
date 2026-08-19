import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createConti, fetchConti, putContiSongs, updateConti } from "../api/contis";

function emptyRow() {
  return { song_id: null, title: "", artist: "", song_key: "", song_form: "", note: "" };
}

function ContiEdit() {
  const { contiId } = useParams();
  const navigate = useNavigate();
  const isNew = !contiId;

  const [password, setPassword] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [title, setTitle] = useState("주일예배");
  const [status, setStatus] = useState("draft");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetchConti(contiId)
      .then((conti) => {
        setServiceDate(conti.service_date);
        setTitle(conti.title);
        setStatus(conti.status);
        setRows(
          conti.songs.map((item) => ({
            song_id: item.song.id,
            title: item.song.title,
            artist: item.song.artist || "",
            song_key: item.song_key || "",
            song_form: item.song_form || "",
            note: item.note || "",
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contiId, isNew]);

  function updateRow(index, field, value) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      const created = await createConti({ service_date: serviceDate, title }, password);
      navigate(`/conti/${created.id}/edit`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveMeta(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await updateConti(contiId, { service_date: serviceDate, title, status }, password);
      setMessage("콘티 정보가 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveSongs(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const invalidRow = rows.find((row) => row.song_id === null && !row.title.trim());
    if (invalidRow) {
      setError("모든 곡에 제목을 입력해주세요.");
      return;
    }

    const payload = {
      songs: rows.map((row) => {
        const base = {
          song_key: row.song_key || null,
          song_form: row.song_form || null,
          note: row.note || null,
        };
        if (row.song_id !== null) {
          return { ...base, song_id: row.song_id };
        }
        return {
          ...base,
          new_song: {
            title: row.title.trim(),
            artist: row.artist || null,
            default_key: row.song_key || null,
          },
        };
      }),
    };

    try {
      const updated = await putContiSongs(contiId, payload, password);
      setRows(
        updated.songs.map((item) => ({
          song_id: item.song.id,
          title: item.song.title,
          artist: item.song.artist || "",
          song_key: item.song_key || "",
          song_form: item.song_form || "",
          note: item.note || "",
        }))
      );
      setMessage("곡 배치가 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      {!isNew && <Link to={`/conti/${contiId}`}>← 상세로</Link>}

      <h1>{isNew ? "콘티 만들기" : "콘티 편집"}</h1>

      <div>
        <label>
          편집 비밀번호{" "}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {isNew ? (
        <form onSubmit={handleCreate}>
          <div>
            <label>
              날짜{" "}
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <label>
              제목{" "}
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
          </div>
          <button type="submit">만들기</button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSaveMeta}>
            <h2>콘티 정보</h2>
            <div>
              <label>
                날짜{" "}
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <div>
              <label>
                제목{" "}
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
            </div>
            <div>
              <label>
                상태{" "}
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">검수중(draft)</option>
                  <option value="published">게시됨(published)</option>
                </select>
              </label>
            </div>
            <button type="submit">정보 저장</button>
          </form>

          <form onSubmit={handleSaveSongs}>
            <h2>곡 배치</h2>
            {rows.map((row, index) => (
              <fieldset key={index}>
                <legend>{index + 1}번 곡</legend>
                <div>
                  <label>
                    곡 제목{" "}
                    <input
                      value={row.title}
                      onChange={(e) => updateRow(index, "title", e.target.value)}
                      disabled={row.song_id !== null}
                      required
                    />
                  </label>
                </div>
                <div>
                  <label>
                    아티스트{" "}
                    <input
                      value={row.artist}
                      onChange={(e) => updateRow(index, "artist", e.target.value)}
                      disabled={row.song_id !== null}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    이번 주 키{" "}
                    <input
                      value={row.song_key}
                      onChange={(e) => updateRow(index, "song_key", e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    송폼{" "}
                    <input
                      value={row.song_form}
                      onChange={(e) => updateRow(index, "song_form", e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    비고{" "}
                    <input
                      value={row.note}
                      onChange={(e) => updateRow(index, "note", e.target.value)}
                    />
                  </label>
                </div>
                <button type="button" onClick={() => removeRow(index)}>
                  이 곡 삭제
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={addRow}>
              곡 추가
            </button>
            <div>
              <button type="submit">곡 배치 저장</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default ContiEdit;
