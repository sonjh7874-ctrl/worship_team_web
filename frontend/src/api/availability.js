import { apiGet, apiPost, apiPut } from "./client";

export function parseAvailability(text, year, month, team) {
  return apiPost("/api/v1/schedules/availability/ai-parse", { text, year, month, team });
}

export function fetchAvailability(year, month, team) {
  return apiGet(`/api/v1/schedules/availability?year=${year}&month=${month}&team=${team}`);
}

export function putAvailability(year, month, team, payload) {
  return apiPut(`/api/v1/schedules/availability?year=${year}&month=${month}&team=${team}`, payload);
}
