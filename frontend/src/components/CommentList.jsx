import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createComment, deleteComment, fetchComments, updateComment } from "../api/comments";
import { useAuth } from "../contexts/AuthContext";

// 백엔드 comment_service.MAX_CONTENT_LENGTH와 동일한 값 — 도배성 장문 게시를 막는다.
const MAX_CONTENT_LENGTH = 1000;

// 공지사항/캘린더 이벤트 상세 화면에 공용으로 쓰는 댓글 목록 + 작성/수정/삭제 UI.
// kind는 "notices" | "calendar" — 두 엔드포인트 모양이 동일해서 컴포넌트 하나로 처리한다.
function CommentList({ kind, parentId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 인라인 수정 중인 댓글 id와 그 입력값 — 한 번에 하나만 수정 가능하면 충분한 규모(22명)라
  // 별도 폼 상태 관리 없이 값 하나로 처리한다.
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // 더블클릭으로 같은 댓글에 삭제 요청이 중복으로 나가는 것을 막는다 (댓글 id를 담아둠).
  const [deletingId, setDeletingId] = useState(null);

  // 목록을 다시 불러오는 함수 하나로 초기 로드와 작성/수정/삭제 후 갱신을 모두 처리한다.
  // 처음엔 생성/수정/삭제 직후 배열을 직접 patch했으나, 초기 GET이 그 이후에 뒤늦게 도착하면
  // (fetchComments().then(setComments)이 낙관적 업데이트를 통째로 덮어써서) 방금 단 댓글이
  // 화면에서 사라지는 경쟁 상태 버그가 있었다(DB엔 남지만 화면에서만 사라짐) — 매번 다시
  // 조회하는 방식으로 바꿔 이 경쟁을 원천적으로 없앴다.
  function load() {
    setLoading(true);
    setError(null);
    return fetchComments(kind, parentId)
      .then(setComments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, parentId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createComment(kind, parentId, content.trim());
      setContent("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(comment) {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingContent("");
  }

  async function saveEdit(commentId) {
    if (!editingContent.trim() || savingEdit) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateComment(kind, parentId, commentId, editingContent.trim());
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(commentId) {
    if (deletingId !== null) return;
    if (!window.confirm("댓글을 삭제할까요?")) return;
    setDeletingId(commentId);
    setError(null);
    try {
      await deleteComment(kind, parentId, commentId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ marginTop: "1.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
      <h3 style={{ fontSize: "1rem" }}>댓글 {comments.length > 0 ? `(${comments.length})` : ""}</h3>

      {loading && <p>불러오는 중...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading &&
        comments.map((comment) => (
          <div key={comment.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
            {editingId === comment.id ? (
              <div>
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  maxLength={MAX_CONTENT_LENGTH}
                  rows={2}
                  style={{ width: "100%" }}
                />
                <div style={{ fontSize: 11, color: "#999", textAlign: "right" }}>
                  {editingContent.length}/{MAX_CONTENT_LENGTH}
                </div>
                <button type="button" onClick={() => saveEdit(comment.id)} disabled={savingEdit || !editingContent.trim()}>
                  저장
                </button>{" "}
                <button type="button" onClick={cancelEdit} disabled={savingEdit}>
                  취소
                </button>
              </div>
            ) : (
              <>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{comment.content}</p>
                <p style={{ margin: "0.2rem 0 0", fontSize: 12, color: "#666" }}>
                  {comment.author_name} · {new Date(comment.created_at).toLocaleString("ko-KR")}
                  {comment.is_edited && " (수정됨)"}
                  {comment.can_edit && (
                    <>
                      {" · "}
                      <button type="button" onClick={() => startEdit(comment)} disabled={deletingId === comment.id}>
                        수정
                      </button>
                    </>
                  )}
                  {comment.can_delete && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                      >
                        {deletingId === comment.id ? "삭제 중..." : "삭제"}
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        ))}

      {!loading && comments.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>아직 댓글이 없습니다.</p>}

      {user ? (
        <form onSubmit={handleSubmit} style={{ marginTop: "0.8rem" }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글을 입력하세요"
            maxLength={MAX_CONTENT_LENGTH}
            rows={2}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: 11, color: "#999", textAlign: "right" }}>
            {content.length}/{MAX_CONTENT_LENGTH}
          </div>
          <button type="submit" disabled={submitting || !content.trim()}>
            등록
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 13, marginTop: "0.8rem" }}>
          <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>로그인</Link> 후 댓글을 남길 수 있습니다.
        </p>
      )}
    </div>
  );
}

export default CommentList;
