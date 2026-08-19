const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(method, path, { body, password, isFormData = false } = {}) {
  const headers = {};
  if (password) headers["X-Edit-Password"] = password;

  let fetchBody;
  if (isFormData) {
    fetchBody = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: fetchBody });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `${method} ${path} failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function apiGet(path) {
  return request("GET", path);
}

export function apiPost(path, body, password) {
  return request("POST", path, { body, password });
}

export function apiPostForm(path, formData, password) {
  return request("POST", path, { body: formData, password, isFormData: true });
}

export function apiPut(path, body, password) {
  return request("PUT", path, { body, password });
}

export function apiPatch(path, body, password) {
  return request("PATCH", path, { body, password });
}

export function apiDelete(path, password) {
  return request("DELETE", path, { password });
}
