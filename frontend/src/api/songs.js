import { apiDelete, apiGet } from "./client";

// 곡 마스터 목록. AI 검수 화면에서 "기존 곡 선택" 드롭다운 옵션으로 쓴다.
export function fetchSongs() {
  return apiGet("/api/v1/songs");
}

// 어떤 콘티에도 배치되지 않은 곡만 지울 수 있다(사용 중이면 서버가 409).
export function deleteSong(songId, password) {
  return apiDelete(`/api/v1/songs/${songId}`, password);
}
