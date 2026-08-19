import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm, apiPut } from "./client";

export function fetchContiList() {
  return apiGet("/api/v1/contis");
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

export function uploadSheetFile(contiId, fileType, file, password) {
  const formData = new FormData();
  formData.append("file_type", fileType);
  formData.append("file", file);
  return apiPostForm(`/api/v1/contis/${contiId}/files`, formData, password);
}

export function deleteSheetFile(fileId, password) {
  return apiDelete(`/api/v1/files/${fileId}`, password);
}
