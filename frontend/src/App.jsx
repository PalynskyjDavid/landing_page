import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import GamePage from "./pages/GamePage.jsx";
import StatisticsPage from "./pages/StatisticsPage.jsx";

import Shell from "./components/Shell.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<LandingPage />} />
        <Route path="game" element={<GamePage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="dev/analytics" element={<Navigate to="/statistics" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
