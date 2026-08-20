import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchCalendarEvents(year, month) {
  return apiGet(`/api/v1/calendar?year=${year}&month=${month}`);
}

export function fetchCalendarEvent(eventId) {
  return apiGet(`/api/v1/calendar/${eventId}`);
}

export function createCalendarEvent(payload, password) {
  return apiPost("/api/v1/calendar", payload, password);
}

export function updateCalendarEvent(eventId, payload, password) {
  return apiPatch(`/api/v1/calendar/${eventId}`, payload, password);
}

export function deleteCalendarEvent(eventId, password) {
  return apiDelete(`/api/v1/calendar/${eventId}`, password);
}
