import { Link, NavLink, useLocation } from "react-router-dom";
import Badge from "./Badge";
import Button from "./Button";
import TopBar from "./TopBar";
import { useAuth } from "../contexts/AuthContext";

const PRIMARY_NAV_ITEMS = [
  { to: "/conti", label: "콘티" },
  { to: "/schedules", label: "스케줄" },
  { to: "/notices", label: "공지" },
  { to: "/calendar", label: "캘린더" },
  { to: "/members", label: "인명부", requiresAuth: true },
];

const ROLE_LABELS = { member: "팀원", leader: "리더십", admin: "관리자" };

// 고정 경로와 동적 id 경로를 실제 사용자 관점의 화면명·상위 경로로 변환한다.
function getTopBarMeta(pathname) {
  if (pathname === "/login") return { title: "로그인", backTo: "/", backLabel: "메인" };
  if (pathname === "/signup") return { title: "회원가입", backTo: "/login", backLabel: "로그인" };
  if (pathname === "/change-password") return { title: "비밀번호 변경" };
  if (pathname === "/profile") return { title: "내 정보", backTo: "/", backLabel: "메인" };
  if (pathname === "/conti/new") return { title: "콘티 만들기", backTo: "/conti", backLabel: "콘티" };
  if (/^\/conti\/[^/]+\/lyrics$/.test(pathname)) {
    const contiId = pathname.split("/")[2];
    return { title: "자막용 가사", backTo: `/conti/${contiId}`, backLabel: "콘티 상세" };
  }
  if (/^\/conti\/[^/]+\/edit$/.test(pathname)) {
    const contiId = pathname.split("/")[2];
    return { title: "콘티 편집", backTo: `/conti/${contiId}`, backLabel: "콘티 상세" };
  }
  if (/^\/conti\/[^/]+$/.test(pathname)) {
    return { title: "콘티 상세", backTo: "/conti", backLabel: "콘티" };
  }
  if (/^\/songs\/[^/]+\/sections$/.test(pathname)) {
    return { title: "가사 구간 관리", backTo: "/songs", backLabel: "곡 관리" };
  }
  if (pathname === "/notices/new") return { title: "공지 작성", backTo: "/notices", backLabel: "공지" };
  if (/^\/notices\/[^/]+\/edit$/.test(pathname)) {
    const noticeId = pathname.split("/")[2];
    return { title: "공지 편집", backTo: `/notices/${noticeId}`, backLabel: "공지 상세" };
  }
  if (/^\/notices\/[^/]+$/.test(pathname)) {
    return { title: "공지 상세", backTo: "/notices", backLabel: "공지" };
  }
  if (pathname === "/schedules/availability") {
    return { title: "참/불참 현황", backTo: "/schedules", backLabel: "스케줄" };
  }
  if (/^\/schedules\/[^/]+\/weeks\/[^/]+\/edit$/.test(pathname)) {
    return { title: "주차 편집", backTo: "/schedules", backLabel: "스케줄" };
  }
  if (pathname === "/calendar/new") return { title: "이벤트 작성", backTo: "/calendar", backLabel: "캘린더" };
  if (/^\/calendar\/[^/]+\/edit$/.test(pathname)) {
    const eventId = pathname.split("/")[2];
    return { title: "이벤트 편집", backTo: `/calendar/${eventId}`, backLabel: "이벤트 상세" };
  }
  if (/^\/calendar\/[^/]+$/.test(pathname)) {
    return { title: "이벤트 상세", backTo: "/calendar", backLabel: "캘린더" };
  }
  if (pathname === "/admin/users") return { title: "사용자 관리", backTo: "/", backLabel: "메인" };
  if (pathname === "/members") return { title: "인명부", backTo: "/", backLabel: "메인" };
  if (pathname === "/songs") return { title: "곡 관리", backTo: "/conti", backLabel: "콘티" };
  return null;
}

function PrimaryNav() {
  const { user } = useAuth();
  const visibleItems = PRIMARY_NAV_ITEMS.filter((item) => !item.requiresAuth || user);

  return (
    <nav className="app-shell__nav" aria-label="주요 메뉴">
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// 브랜드·주요 메뉴·로그인 상태를 전역에서 한 번만 렌더링해 페이지별 링크 중복을 줄인다.
function AppShell({ children }) {
  const { user, role, logout } = useAuth();
  const { pathname } = useLocation();
  const topBarMeta = getTopBarMeta(pathname);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <div className="app-shell__brand-row">
            <Link className="app-shell__brand" to="/">
              EVERYDAY WORSHIP
            </Link>
            <div className="app-shell__account">
              {user ? (
                <>
                  <Link className="app-shell__profile-link" to="/profile">
                    <span>{user.display_name}</span>
                    <Badge tone={role === "admin" ? "warm" : "neutral"}>{ROLE_LABELS[role] ?? role}</Badge>
                  </Link>
                  {role === "admin" && <Link to="/admin/users">사용자 관리</Link>}
                  <Button variant="secondary" onClick={logout}>
                    로그아웃
                  </Button>
                </>
              ) : (
                <Button as={Link} to="/login" variant="secondary">
                  로그인
                </Button>
              )}
            </div>
          </div>
          <PrimaryNav />
        </div>
      </header>

      {topBarMeta && (
        <div className="app-shell__topbar-wrap">
          <TopBar {...topBarMeta} />
        </div>
      )}

      <div className="app-shell__content">{children}</div>
    </div>
  );
}

export default AppShell;
