const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(method, path, { body, password, isFormData = false } = {}) {
  const headers = {};
  if (password) headers["X-Edit-Password"] = password;

  let fetchBody;
  if (isFormData) {
    // 파일 업로드(FormData)는 Content-Type을 직접 지정하면 안 된다 —
    // 브라우저가 multipart 경계(boundary)를 자동으로 채워 넣어야 하기 때문.
    fetchBody = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: fetchBody });
  if (!res.ok) {
    // 백엔드 에러 응답의 detail 메시지를 그대로 화면에 보여주기 위해 우선 사용하고,
    // JSON이 아니거나 detail이 없으면 상태 코드 기반 기본 메시지로 대체한다.
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `${method} ${path} failed: ${res.status}`);
  }
  // DELETE 성공(204 No Content)은 응답 본문이 없어 res.json()을 호출하면 에러가 난다.
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
