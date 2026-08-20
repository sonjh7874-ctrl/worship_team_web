import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchMembers(team, active) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  if (active !== undefined) params.set("active", active);
  const query = params.toString();
  return apiGet(`/api/v1/members${query ? `?${query}` : ""}`);
}

export function createMember(payload) {
  return apiPost("/api/v1/members", payload);
}

export function updateMember(memberId, payload) {
  return apiPatch(`/api/v1/members/${memberId}`, payload);
}

export function deleteMember(memberId) {
  return apiDelete(`/api/v1/members/${memberId}`);
}
