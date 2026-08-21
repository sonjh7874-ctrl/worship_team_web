import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

// kind는 "notices" | "calendar" — 두 엔드포인트 모양이 동일해서 함수 하나로 처리한다.
function basePath(kind, parentId) {
  return `/api/v1/${kind}/${parentId}/comments`;
}

export function fetchComments(kind, parentId) {
  return apiGet(basePath(kind, parentId));
}

export function createComment(kind, parentId, content) {
  return apiPost(basePath(kind, parentId), { content });
}

export function updateComment(kind, parentId, commentId, content) {
  return apiPatch(`${basePath(kind, parentId)}/${commentId}`, { content });
}

export function deleteComment(kind, parentId, commentId) {
  return apiDelete(`${basePath(kind, parentId)}/${commentId}`);
}
