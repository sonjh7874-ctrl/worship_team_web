import { Route, Routes } from "react-router-dom";
import ContiDetail from "./pages/ContiDetail";
import ContiEdit from "./pages/ContiEdit";
import ContiMain from "./pages/ContiMain";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ContiMain />} />
      <Route path="/conti/new" element={<ContiEdit />} />
      <Route path="/conti/:contiId" element={<ContiDetail />} />
      <Route path="/conti/:contiId/edit" element={<ContiEdit />} />
    </Routes>
  );
}

export default App;
