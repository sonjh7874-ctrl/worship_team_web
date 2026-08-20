import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm, apiPut } from "./client";

// status=draft를 넘기면 검수 대기 중인 초안 목록을 받는다(기본은 게시된 콘티만).
export function fetchContiList(status) {
  return apiGet(status ? `/api/v1/contis?status=${status}` : "/api/v1/contis");
}

export function fetchLatestConti() {
  return apiGet("/api/v1/contis/latest");
}

export function fetchConti(contiId) {
  return apiGet(`/api/v1/contis/${contiId}`);
}

export function createConti(payload, password) {
  return apiPost("/api/v1/contis", payload, password);
}

export function updateConti(contiId, payload, password) {
  return apiPatch(`/api/v1/contis/${contiId}`, payload, password);
}

export function deleteConti(contiId, password) {
  return apiDelete(`/api/v1/contis/${contiId}`, password);
}

export function putContiSongs(contiId, payload, password) {
  return apiPut(`/api/v1/contis/${contiId}/songs`, payload, password);
}

export function deleteContiSong(contiId, orderNo, password) {
  return apiDelete(`/api/v1/contis/${contiId}/songs/${orderNo}`, password);
}

// 콘티 이미지를 AI로 구조화한다(POST /contis/ai-parse). 서버는 결과를 저장하지 않고 돌려주기만 하므로,
// 검수 화면이 응답을 상태로 들고 있다가 사람이 확인한 뒤 putContiSongs로 확정 저장한다.
export function aiParseConti(file, password) {
  const formData = new FormData();
  formData.append("image", file);
  return apiPostForm("/api/v1/contis/ai-parse", formData, password);
}

// replace=true면 같은 종류의 기존 파일을 지우고 새로 올린다(AI 재인식 시 원본 이미지가 쌓이지 않도록).
export function uploadSheetFile(contiId, fileType, file, password, replace = false) {
  const formData = new FormData();
  formData.append("file_type", fileType);
  formData.append("file", file);
  formData.append("replace", replace ? "true" : "false");
  return apiPostForm(`/api/v1/contis/${contiId}/files`, formData, password);
}

export function deleteSheetFile(fileId, password) {
  return apiDelete(`/api/v1/files/${fileId}`, password);
}
