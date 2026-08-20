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
