import { apiDelete, apiGet, apiPatch } from "./client";

// 곡 마스터 목록. AI 검수 화면에서 "기존 곡 선택" 드롭다운 옵션으로 쓴다.
export function fetchSongs() {
  return apiGet("/api/v1/songs");
}

// 곡 제목·아티스트 수정. AI 인식 힌트가 곡 마스터를 참고하므로, 잘못 저장된 제목을 여기서 고쳐두면
// 다음 인식부터 그 오타가 재생산되지 않는다.
export function updateSong(songId, payload, password) {
  return apiPatch(`/api/v1/songs/${songId}`, payload, password);
}

// 어떤 콘티에도 배치되지 않은 곡만 지울 수 있다(사용 중이면 서버가 409).
export function deleteSong(songId, password) {
  return apiDelete(`/api/v1/songs/${songId}`, password);
}
