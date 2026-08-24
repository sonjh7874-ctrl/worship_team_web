import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createNotice, deleteNotice, fetchNotice, updateNotice } from "../api/notices";

function NoticeEdit() {
  const { noticeId } = useParams();
  const navigate = useNavigate();
  // 라우트 파라미터 유무로 작성 화면(/notices/new)과 편집 화면(/notices/:id/edit)을 한 컴포넌트에서 겸용한다.
  const isNew = !noticeId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetchNotice(noticeId)
      .then((notice) => {
        setTitle(notice.title);
        setContent(notice.content || "");
        setIsPinned(notice.is_pinned);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [noticeId, isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = { title, content: content || null, is_pinned: isPinned };
    try {
      if (isNew) {
        const created = await createNotice(payload);
        navigate(`/notices/${created.id}`);
      } else {
        await updateNotice(noticeId, payload);
        navigate(`/notices/${noticeId}`);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // 삭제는 되돌릴 수 없으므로 실수 클릭을 막기 위해 confirm으로 한 번 더 확인한다.
  async function handleDelete() {
    if (!window.confirm(`"${title}" 공지를 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    setError(null);
    try {
      await deleteNotice(noticeId);
      navigate("/notices");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <h1>{isNew ? "공지 작성" : "공지 편집"}</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            제목{" "}
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
        </div>
        <div>
          <label>
            내용{" "}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />{" "}
            상단 고정
          </label>
        </div>
        <button type="submit">{isNew ? "작성" : "저장"}</button>
      </form>

      {!isNew && (
        <button type="button" onClick={handleDelete} style={{ color: "red" }}>
          공지 삭제
        </button>
      )}
    </div>
  );
}

export default NoticeEdit;
