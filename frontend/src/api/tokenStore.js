// 로그인 세션(액세스/리프레시 토큰 + 사용자 정보)을 localStorage에 보관한다.
// client.js(요청마다 Authorization 헤더를 붙이고 401 시 갱신)와
// AuthContext(화면에 로그인 상태를 반영) 양쪽이 이 모듈을 통해서만 세션을 읽고 쓴다.
const STORAGE_KEY = "worship_team_auth";

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession({ accessToken, refreshToken, expiresAt, user }) {
  const session = { accessToken, refreshToken, expiresAt, user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// 세션이 강제로 끊겼을 때(리프레시 실패 등) client.js가 이 이벤트를 쏘고,
// AuthContext가 구독해서 화면의 로그인 상태를 즉시 반영한다.
export const SESSION_EXPIRED_EVENT = "worship-team:session-expired";

export function notifySessionExpired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
