import { Route, Routes } from "react-router-dom";
import ContiDetail from "./pages/ContiDetail";
import ContiMain from "./pages/ContiMain";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ContiMain />} />
      <Route path="/conti/:contiId" element={<ContiDetail />} />
    </Routes>
  );
}

export default App;
