import { Route, Routes } from "react-router-dom";
import CalendarDetail from "./pages/CalendarDetail";
import CalendarEdit from "./pages/CalendarEdit";
import CalendarMain from "./pages/CalendarMain";
import ContiDetail from "./pages/ContiDetail";
import ContiEdit from "./pages/ContiEdit";
import ContiMain from "./pages/ContiMain";
import Home from "./pages/Home";
import MemberMain from "./pages/MemberMain";
import NoticeDetail from "./pages/NoticeDetail";
import NoticeEdit from "./pages/NoticeEdit";
import NoticeMain from "./pages/NoticeMain";
import ScheduleEdit from "./pages/ScheduleEdit";
import SongMain from "./pages/SongMain";
import ScheduleMain from "./pages/ScheduleMain";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/conti" element={<ContiMain />} />
      <Route path="/conti/new" element={<ContiEdit />} />
      <Route path="/conti/:contiId" element={<ContiDetail />} />
      <Route path="/conti/:contiId/edit" element={<ContiEdit />} />
      <Route path="/songs" element={<SongMain />} />
      <Route path="/members" element={<MemberMain />} />
      <Route path="/notices" element={<NoticeMain />} />
      <Route path="/notices/new" element={<NoticeEdit />} />
      <Route path="/notices/:noticeId" element={<NoticeDetail />} />
      <Route path="/notices/:noticeId/edit" element={<NoticeEdit />} />
      <Route path="/schedules" element={<ScheduleMain />} />
      <Route path="/schedules/:scheduleId/weeks/:weekId/edit" element={<ScheduleEdit />} />
      <Route path="/calendar" element={<CalendarMain />} />
      <Route path="/calendar/new" element={<CalendarEdit />} />
      <Route path="/calendar/:eventId" element={<CalendarDetail />} />
      <Route path="/calendar/:eventId/edit" element={<CalendarEdit />} />
    </Routes>
  );
}

export default App;
