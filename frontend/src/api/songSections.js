import { apiGet, apiPut } from "./client";

// 곡의 구간별 가사 목록. 저작권 있는 콘텐츠라 서버가 member 이상 로그인을 요구한다(비로그인이면 401).
export function fetchSongSections(songId) {
  return apiGet(`/api/v1/songs/${songId}/sections`);
}

// 구간 배열 전체 교체. conti_songs/schedule_assignments와 같은 "한 화면에서 통째로 저장" 패턴.
export function putSongSections(songId, sections) {
  return apiPut(`/api/v1/songs/${songId}/sections`, { sections });
}
