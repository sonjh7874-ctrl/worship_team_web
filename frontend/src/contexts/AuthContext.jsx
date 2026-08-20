import { createContext, useContext, useEffect, useState } from "react";
import { fetchMe, login as loginApi, signup as signupApi } from "../api/auth";
import { SESSION_EXPIRED_EVENT, clearSession, getSession, setSession } from "../api/tokenStore";

const ROLE_RANK = { member: 0, leader: 1, admin: 2 };

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 세션 복원이 끝나기 전에는 RequireRole이 섣불리 /login으로 튕기지 않도록 loading 상태를 둔다.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }
    // 비로그인 조회가 정상 상태이므로, 검증 실패는 에러 화면 없이 조용히 로그아웃 처리한다.
    fetchMe()
      .then((profile) => setUser(profile))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // 토큰 갱신 실패(client.js)로 세션이 강제로 끊긴 경우 화면 상태를 즉시 반영한다.
    const handleExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  async function login(email, password) {
    const res = await loginApi({ email, password });
    setSession({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: res.expires_at,
      user: res.user,
    });
    setUser(res.user);
    return res.user;
  }

  async function signup(email, password, displayName) {
    const res = await signupApi({ email, password, display_name: displayName });
    setSession({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: res.expires_at,
      user: res.user,
    });
    setUser(res.user);
    return res.user;
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  // 비밀번호 변경(force_password_change 해제) 등 프로필이 바뀐 뒤 세션에 반영한다.
  // 토큰은 그대로 두고 user 부분만 갈아끼운다.
  function updateUser(profile) {
    const session = getSession();
    if (session) {
      setSession({ ...session, user: profile });
    }
    setUser(profile);
  }

  const role = user?.role ?? null;
  const canEdit = role != null && ROLE_RANK[role] >= ROLE_RANK.leader;
  const isAdmin = role === "admin";
  const mustChangePassword = Boolean(user?.force_password_change);

  return (
    <AuthContext.Provider
      value={{ user, role, loading, canEdit, isAdmin, mustChangePassword, login, signup, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
