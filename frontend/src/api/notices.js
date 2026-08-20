import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchNoticeList() {
  return apiGet("/api/v1/notices");
}

export function fetchNotice(noticeId) {
  return apiGet(`/api/v1/notices/${noticeId}`);
}

export function createNotice(payload) {
  return apiPost("/api/v1/notices", payload);
}

export function updateNotice(noticeId, payload) {
  return apiPatch(`/api/v1/notices/${noticeId}`, payload);
}

export function deleteNotice(noticeId) {
  return apiDelete(`/api/v1/notices/${noticeId}`);
}
