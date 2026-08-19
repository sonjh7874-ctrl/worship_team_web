import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchMembers(team, active) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  if (active !== undefined) params.set("active", active);
  const query = params.toString();
  return apiGet(`/api/v1/members${query ? `?${query}` : ""}`);
}

export function createMember(payload, password) {
  return apiPost("/api/v1/members", payload, password);
}

export function updateMember(memberId, payload, password) {
  return apiPatch(`/api/v1/members/${memberId}`, payload, password);
}

export function deleteMember(memberId, password) {
  return apiDelete(`/api/v1/members/${memberId}`, password);
}
