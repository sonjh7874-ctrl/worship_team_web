import { apiGet, apiPost, apiPut } from "./client";

export function parseAvailability(text, year, month) {
  return apiPost("/api/v1/schedules/availability/ai-parse", { text, year, month });
}

export function fetchAvailability(year, month) {
  return apiGet(`/api/v1/schedules/availability?year=${year}&month=${month}`);
}

export function putAvailability(year, month, payload) {
  return apiPut(`/api/v1/schedules/availability?year=${year}&month=${month}`, payload);
}
