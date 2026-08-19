import { Route, Routes } from "react-router-dom";
import ContiDetail from "./pages/ContiDetail";
import ContiEdit from "./pages/ContiEdit";
import ContiMain from "./pages/ContiMain";
import MemberMain from "./pages/MemberMain";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ContiMain />} />
      <Route path="/conti/new" element={<ContiEdit />} />
      <Route path="/conti/:contiId" element={<ContiDetail />} />
      <Route path="/conti/:contiId/edit" element={<ContiEdit />} />
      <Route path="/members" element={<MemberMain />} />
    </Routes>
  );
}

export default App;
