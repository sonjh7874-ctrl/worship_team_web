import { apiGet } from "./client";

// 콘티의 자막용 가사(송폼 순서로 조합된 결과). 저작권 있는 콘텐츠라 서버가 member 이상
// 로그인을 요구한다 — 비로그인이면 401이 던져진다(ContiLyrics.jsx가 안내 화면으로 처리).
export function fetchContiLyrics(contiId) {
  return apiGet(`/api/v1/contis/${contiId}/lyrics`);
}
