import { apiGet, apiPatch, apiPost } from "./client";

export function signup(payload) {
  return apiPost("/api/v1/auth/signup", payload);
}

export function login(payload) {
  return apiPost("/api/v1/auth/login", payload);
}

export function fetchMe() {
  return apiGet("/api/v1/auth/me");
}

// 관리자 전용 — 사용자 목록 + 역할 변경(/admin/users 화면에서 사용).
export function fetchUsers() {
  return apiGet("/api/v1/auth/users");
}

export function updateUserRole(userId, role) {
  return apiPatch(`/api/v1/auth/users/${userId}/role`, { role });
}

// 관리자가 비밀번호를 초기화한다. 서버가 무작위 임시 비밀번호를 생성해 응답으로 1회 돌려주고,
// 그 사용자는 다음 로그인 시 강제로 비밀번호 변경 화면으로 이동한다. 이메일 발송 없음 — 관리자가
// 응답에 담긴 임시 비밀번호를 직접(카톡 등) 안내해야 한다.
export function resetUserPassword(userId) {
  return apiPost(`/api/v1/auth/users/${userId}/password`);
}

// 본인이 로그인한 상태에서 비밀번호를 직접 바꾼다(강제 변경 화면 + 일반 변경 모두 사용).
export function changeMyPassword(newPassword) {
  return apiPost("/api/v1/auth/me/password", { new_password: newPassword });
}

// 본인 표시 이름을 수정한다(/me 화면). 가입 시 정한 이름을 본인이 직접 바꿀 방법이 없어서 추가.
export function updateMyProfile(displayName) {
  return apiPatch("/api/v1/auth/me", { display_name: displayName });
}
