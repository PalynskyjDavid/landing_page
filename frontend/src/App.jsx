import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import GamePage from "./pages/GamePage.jsx";
import StatisticsPage from "./pages/StatisticsPage.jsx";

import Shell from "./components/Shell.jsx";

const CvPage = lazy(() => import("./pages/CvPage.jsx"));
const HandControllerPage = lazy(() => import("./pages/HandControllerPage.jsx"));
const FlowentoPage = lazy(() => import("./pages/FlowentoPage.jsx"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<LandingPage />} />
        <Route
          path="projects/flowento"
          element={
            <Suspense
              fallback={
                <main className="p-8" aria-busy="true">
                  Flowento…
                </main>
              }
            >
              <FlowentoPage />
            </Suspense>
          }
        />
        <Route
          path="projects/hand-controller"
          element={
            <Suspense
              fallback={
                <main className="p-8" aria-busy="true">
                  Hand Controller…
                </main>
              }
            >
              <HandControllerPage />
            </Suspense>
          }
        />
        <Route
          path="cv"
          element={
            <Suspense
              fallback={
                <main className="p-8" aria-busy="true">
                  CV…
                </main>
              }
            >
              <CvPage />
            </Suspense>
          }
        />
        <Route path="game" element={<GamePage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="dev/analytics" element={<Navigate to="/statistics" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
