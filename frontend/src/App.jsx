import { Route, Routes } from "react-router-dom";
import ContiDetail from "./pages/ContiDetail";
import ContiEdit from "./pages/ContiEdit";
import ContiMain from "./pages/ContiMain";
import MemberMain from "./pages/MemberMain";
import NoticeDetail from "./pages/NoticeDetail";
import NoticeEdit from "./pages/NoticeEdit";
import NoticeMain from "./pages/NoticeMain";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ContiMain />} />
      <Route path="/conti/new" element={<ContiEdit />} />
      <Route path="/conti/:contiId" element={<ContiDetail />} />
      <Route path="/conti/:contiId/edit" element={<ContiEdit />} />
      <Route path="/members" element={<MemberMain />} />
      <Route path="/notices" element={<NoticeMain />} />
      <Route path="/notices/new" element={<NoticeEdit />} />
      <Route path="/notices/:noticeId" element={<NoticeDetail />} />
      <Route path="/notices/:noticeId/edit" element={<NoticeEdit />} />
    </Routes>
  );
}

export default App;
