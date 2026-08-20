import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchCalendarEvents(year, month) {
  return apiGet(`/api/v1/calendar?year=${year}&month=${month}`);
}

export function fetchCalendarEvent(eventId) {
  return apiGet(`/api/v1/calendar/${eventId}`);
}

export function createCalendarEvent(payload) {
  return apiPost("/api/v1/calendar", payload);
}

export function updateCalendarEvent(eventId, payload) {
  return apiPatch(`/api/v1/calendar/${eventId}`, payload);
}

export function deleteCalendarEvent(eventId) {
  return apiDelete(`/api/v1/calendar/${eventId}`);
}
