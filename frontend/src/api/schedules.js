import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";

export function fetchSchedule(year, month) {
  return apiGet(`/api/v1/schedules?year=${year}&month=${month}`);
}

export function createSchedule(payload, password) {
  return apiPost("/api/v1/schedules", payload, password);
}

export function deleteSchedule(scheduleId, password) {
  return apiDelete(`/api/v1/schedules/${scheduleId}`, password);
}

export function createWeek(scheduleId, payload, password) {
  return apiPost(`/api/v1/schedules/${scheduleId}/weeks`, payload, password);
}

export function updateWeek(scheduleId, weekId, payload, password) {
  return apiPatch(`/api/v1/schedules/${scheduleId}/weeks/${weekId}`, payload, password);
}

export function deleteWeek(scheduleId, weekId, password) {
  return apiDelete(`/api/v1/schedules/${scheduleId}/weeks/${weekId}`, password);
}

export function putAssignments(scheduleId, weekId, payload, password) {
  return apiPut(
    `/api/v1/schedules/${scheduleId}/weeks/${weekId}/assignments`,
    payload,
    password
  );
}
