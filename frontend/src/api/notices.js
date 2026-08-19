import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchNoticeList() {
  return apiGet("/api/v1/notices");
}

export function fetchNotice(noticeId) {
  return apiGet(`/api/v1/notices/${noticeId}`);
}

export function createNotice(payload, password) {
  return apiPost("/api/v1/notices", payload, password);
}

export function updateNotice(noticeId, payload, password) {
  return apiPatch(`/api/v1/notices/${noticeId}`, payload, password);
}

export function deleteNotice(noticeId, password) {
  return apiDelete(`/api/v1/notices/${noticeId}`, password);
}
