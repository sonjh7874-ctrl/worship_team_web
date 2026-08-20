import { Link, Route, Routes } from "react-router-dom";
import AdminUsers from "./pages/AdminUsers";
import CalendarDetail from "./pages/CalendarDetail";
import CalendarEdit from "./pages/CalendarEdit";
import CalendarMain from "./pages/CalendarMain";
import ContiDetail from "./pages/ContiDetail";
import ContiEdit from "./pages/ContiEdit";
import ContiMain from "./pages/ContiMain";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MemberMain from "./pages/MemberMain";
import NoticeDetail from "./pages/NoticeDetail";
import NoticeEdit from "./pages/NoticeEdit";
import NoticeMain from "./pages/NoticeMain";
import ScheduleEdit from "./pages/ScheduleEdit";
import Signup from "./pages/Signup";
import SongMain from "./pages/SongMain";
import ScheduleMain from "./pages/ScheduleMain";
import RequireRole from "./components/RequireRole";
import { useAuth } from "./contexts/AuthContext";

function Header() {
  const { user, role, logout } = useAuth();

  return (
    <header style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "8px 0" }}>
      {user ? (
        <>
          <span>
            {user.display_name} ({role})
          </span>
          {role === "admin" && <Link to="/admin/users">사용자 관리</Link>}
          <button type="button" onClick={logout}>
            로그아웃
          </button>
        </>
      ) : (
        <Link to="/login">로그인</Link>
      )}
    </header>
  );
}

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/conti" element={<ContiMain />} />
        <Route
          path="/conti/new"
          element={
            <RequireRole minRole="leader">
              <ContiEdit />
            </RequireRole>
          }
        />
        <Route path="/conti/:contiId" element={<ContiDetail />} />
        <Route
          path="/conti/:contiId/edit"
          element={
            <RequireRole minRole="leader">
              <ContiEdit />
            </RequireRole>
          }
        />
        <Route path="/songs" element={<SongMain />} />
        <Route path="/members" element={<MemberMain />} />
        <Route path="/notices" element={<NoticeMain />} />
        <Route
          path="/notices/new"
          element={
            <RequireRole minRole="leader">
              <NoticeEdit />
            </RequireRole>
          }
        />
        <Route path="/notices/:noticeId" element={<NoticeDetail />} />
        <Route
          path="/notices/:noticeId/edit"
          element={
            <RequireRole minRole="leader">
              <NoticeEdit />
            </RequireRole>
          }
        />
        <Route path="/schedules" element={<ScheduleMain />} />
        <Route
          path="/schedules/:scheduleId/weeks/:weekId/edit"
          element={
            <RequireRole minRole="leader">
              <ScheduleEdit />
            </RequireRole>
          }
        />
        <Route path="/calendar" element={<CalendarMain />} />
        <Route
          path="/calendar/new"
          element={
            <RequireRole minRole="leader">
              <CalendarEdit />
            </RequireRole>
          }
        />
        <Route path="/calendar/:eventId" element={<CalendarDetail />} />
        <Route
          path="/calendar/:eventId/edit"
          element={
            <RequireRole minRole="leader">
              <CalendarEdit />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireRole minRole="admin">
              <AdminUsers />
            </RequireRole>
          }
        />
      </Routes>
    </>
  );
}

export default App;
