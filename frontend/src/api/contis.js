import { apiGet } from "./client";

export function fetchContiList() {
  return apiGet("/api/v1/contis");
}

export function fetchLatestConti() {
  return apiGet("/api/v1/contis/latest");
}

export function fetchConti(contiId) {
  return apiGet(`/api/v1/contis/${contiId}`);
}
