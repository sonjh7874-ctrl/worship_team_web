import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Badge from "./Badge";
import Button from "./Button";

const ROLE_LABELS = { member: "팀원", leader: "리더십", admin: "관리자" };

// 로그인 상태 헤더 영역. 데스크톱은 기존과 동일한 인라인 표시를,
// 모바일(<=640px)은 이니셜 아바타 트리거 + 드롭다운 패널을 CSS로 골라 보여준다.
function AccountMenu({ user, role, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { pathname } = useLocation();
  const roleLabel = ROLE_LABELS[role] ?? role;

  // 메뉴 항목 클릭(또는 뒤로가기)으로 경로가 바뀌면 열려 있던 메뉴를 닫는다.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 이 앱 최초의 플로팅 오버레이라 별도 훅 파일 없이 인라인으로 바깥 클릭/Esc를 처리한다.
  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={rootRef}>
      {/* 데스크톱 전용 — 기존 마크업 그대로, 640px 이하에서 CSS로 숨김 */}
      <div className="account-menu__inline">
        <Link className="app-shell__profile-link" to="/profile">
          <span>{user.display_name}</span>
          <Badge tone={role === "admin" ? "warm" : "neutral"}>{roleLabel}</Badge>
        </Link>
        {role === "admin" && (
          <Link className="app-shell__admin-link" to="/admin/users">
            사용자 관리
          </Link>
        )}
        <Button variant="secondary" onClick={onLogout}>
          로그아웃
        </Button>
      </div>

      {/* 모바일 전용 — 640px 초과에서 CSS로 숨김 */}
      <button
        type="button"
        className="account-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="계정 메뉴"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {(user.display_name || "?").trim().slice(0, 1)}
        </span>
      </button>

      {open && (
        <div className="account-menu__panel" role="menu">
          <div className="account-menu__summary">
            <span className="account-menu__name">{user.display_name}</span>
            <Badge tone={role === "admin" ? "warm" : "neutral"}>{roleLabel}</Badge>
          </div>
          <Link role="menuitem" className="account-menu__item" to="/profile" onClick={() => setOpen(false)}>
            내 정보
          </Link>
          {role === "admin" && (
            <Link
              role="menuitem"
              className="account-menu__item"
              to="/admin/users"
              onClick={() => setOpen(false)}
            >
              사용자 관리
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            className="account-menu__item account-menu__item--danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
