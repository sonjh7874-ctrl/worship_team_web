import { clearSession, getSession, notifySessionExpired, setSession } from "./tokenStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function rawFetch(method, path, { body, isFormData = false, accessToken } = {}) {
  const headers = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let fetchBody;
  if (isFormData) {
    // 파일 업로드(FormData)는 Content-Type을 직접 지정하면 안 된다 —
    // 브라우저가 multipart 경계(boundary)를 자동으로 채워 넣어야 하기 때문.
    fetchBody = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  return fetch(`${API_BASE_URL}${path}`, { method, headers, body: fetchBody });
}

async function parseResponse(res, method, path) {
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

// 액세스 토큰 만료(401)를 사람이 겪지 않도록 리프레시 토큰으로 1회만 갱신을 시도한다.
// /auth/refresh 자체가 401을 내면(리프레시 토큰도 만료) 세션을 비우고 로그인 페이지로 보낸다.
async function refreshAccessToken(refreshToken) {
  const res = await rawFetch("POST", "/api/v1/auth/refresh", { body: { refresh_token: refreshToken } });
  if (!res.ok) return null;
  return res.json();
}

async function request(method, path, { body, isFormData = false } = {}) {
  const session = getSession();
  let res = await rawFetch(method, path, { body, isFormData, accessToken: session?.accessToken });

  if (res.status === 401 && session?.refreshToken && path !== "/api/v1/auth/refresh") {
    const refreshed = await refreshAccessToken(session.refreshToken);
    if (refreshed) {
      setSession({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: refreshed.expires_at,
        user: refreshed.user,
      });
      res = await rawFetch(method, path, { body, isFormData, accessToken: refreshed.access_token });
    } else {
      clearSession();
      notifySessionExpired();
    }
  }

  return parseResponse(res, method, path);
}

export function apiGet(path) {
  return request("GET", path);
}

export function apiPost(path, body) {
  return request("POST", path, { body });
}

export function apiPostForm(path, formData) {
  return request("POST", path, { body: formData, isFormData: true });
}

export function apiPut(path, body) {
  return request("PUT", path, { body });
}

export function apiPatch(path, body) {
  return request("PATCH", path, { body });
}

export function apiDelete(path) {
  return request("DELETE", path);
}
