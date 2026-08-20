import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";

export function fetchSchedule(year, month) {
  return apiGet(`/api/v1/schedules?year=${year}&month=${month}`);
}

export function createSchedule(payload) {
  return apiPost("/api/v1/schedules", payload);
}

export function deleteSchedule(scheduleId) {
  return apiDelete(`/api/v1/schedules/${scheduleId}`);
}

export function createWeek(scheduleId, payload) {
  return apiPost(`/api/v1/schedules/${scheduleId}/weeks`, payload);
}

export function updateWeek(scheduleId, weekId, payload) {
  return apiPatch(`/api/v1/schedules/${scheduleId}/weeks/${weekId}`, payload);
}

export function deleteWeek(scheduleId, weekId) {
  return apiDelete(`/api/v1/schedules/${scheduleId}/weeks/${weekId}`);
}

export function putAssignments(scheduleId, weekId, payload) {
  return apiPut(`/api/v1/schedules/${scheduleId}/weeks/${weekId}/assignments`, payload);
}
