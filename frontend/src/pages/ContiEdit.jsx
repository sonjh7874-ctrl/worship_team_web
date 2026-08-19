import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createConti,
  deleteConti,
  deleteSheetFile,
  fetchConti,
  putContiSongs,
  updateConti,
  uploadSheetFile,
} from "../api/contis";

const FILE_TYPE_LABELS = { score_pdf: "악보 PDF", conti_image: "콘티 원본 이미지" };

function emptyRow() {
  return { song_id: null, title: "", artist: "", song_key: "", song_form: "", note: "" };
}

function ContiEdit() {
  const { contiId } = useParams();
  const navigate = useNavigate();
  // 라우트 파라미터 유무로 생성 화면(/conti/new)과 편집 화면(/conti/:id/edit)을 한 컴포넌트에서 겸용한다.
  const isNew = !contiId;

  const [password, setPassword] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [title, setTitle] = useState("주일예배");
  const [status, setStatus] = useState("draft");
  const [rows, setRows] = useState([]);
  const [sheetFiles, setSheetFiles] = useState([]);
  const [fileType, setFileType] = useState("score_pdf");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
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
        // 서버 응답(song 중첩 객체)을 폼에서 다루기 쉬운 평평한 행(row) 구조로 펼친다.
        // song_id를 채워두면 "기존 곡"으로 취급해 제목/아티스트 입력을 잠근다 (아래 handleSaveSongs 참고).
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
        setSheetFiles(conti.sheet_files);
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
    // 여기서는 화면 상태에서만 지운다. 서버 반영은 "곡 배치 저장"을 눌러 PUT 전체 교체가
    // 실행될 때 한 번에 이뤄진다(백엔드가 기존 배치를 지우고 새 배열로 다시 채우는 방식).
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

    // 새로 추가한 행(song_id 없음)은 제목이 없으면 곡 마스터를 만들 수 없으므로 저장 전에 막는다.
    const invalidRow = rows.find((row) => row.song_id === null && !row.title.trim());
    if (invalidRow) {
      setError("모든 곡에 제목을 입력해주세요.");
      return;
    }

    // 배열 순서 = 콘티 상의 곡 순서(order_no)로 백엔드가 그대로 채택하므로 여기서는 순서만 맞추면 된다.
    // song_id가 있으면 기존 곡을 그대로 재배치, 없으면 new_song으로 새 곡 생성까지 함께 요청한다
    // (PUT /contis/{id}/songs, API명세 1-3).
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
      // 새로 생성된 곡들이 서버에서 발급받은 실제 song_id를 응답으로 돌려주므로,
      // 그 결과로 rows를 다시 채워야 다음 저장부터 "기존 곡"으로 정상 처리된다.
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

  async function handleUploadFile(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!file) {
      setError("업로드할 파일을 선택해주세요.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadSheetFile(contiId, fileType, file, password);
      setSheetFiles((prev) => [...prev, uploaded]);
      setFile(null);
      e.target.reset();
      setMessage("파일이 업로드되었습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId) {
    setError(null);
    setMessage(null);
    try {
      await deleteSheetFile(fileId, password);
      setSheetFiles((prev) => prev.filter((f) => f.id !== fileId));
      setMessage("파일이 삭제되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  // 콘티 삭제는 복구 수단이 없는 완전 삭제이므로, 실수 클릭을 막기 위해 confirm으로 한 번 더 확인한다.
  async function handleDeleteConti() {
    if (!window.confirm(`"${title}"(${serviceDate}) 콘티를 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    setError(null);
    try {
      await deleteConti(contiId, password);
      navigate("/conti");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <Link to={isNew ? "/conti" : `/conti/${contiId}`}>
        {isNew ? "← 콘티 목록으로" : "← 상세로"}
      </Link>

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

          <button type="button" onClick={handleDeleteConti} style={{ color: "red" }}>
            콘티 삭제
          </button>

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

          <div>
            <h2>악보 / 콘티 원본</h2>
            {sheetFiles.length === 0 ? (
              <p>등록된 파일이 없습니다.</p>
            ) : (
              <ul>
                {sheetFiles.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.file_name || FILE_TYPE_LABELS[f.file_type]}
                    </a>{" "}
                    ({FILE_TYPE_LABELS[f.file_type] || f.file_type}){" "}
                    <button type="button" onClick={() => handleDeleteFile(f.id)}>
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleUploadFile}>
              <label>
                종류{" "}
                <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
                  <option value="score_pdf">악보 PDF</option>
                  <option value="conti_image">콘티 원본 이미지</option>
                </select>
              </label>{" "}
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />{" "}
              <button type="submit" disabled={uploading}>
                {uploading ? "업로드 중..." : "업로드"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default ContiEdit;
