import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/UI/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateSessionPage } from "./pages/CreateSessionPage";
import { ScannerPage } from "./pages/ScannerPage";
import { ResultsPage } from "./pages/ResultsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ReviewPage } from "./pages/ReviewPage";
import { LabPage } from "./pages/LabPage";
import { RecognitionDebugPage } from "./pages/RecognitionDebugPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/session/new" element={<CreateSessionPage />} />
        <Route path="/scan" element={<ScannerPage />} />
        <Route path="/results/:resultId" element={<ResultsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/review/:resultId" element={<ReviewPage />} />
        <Route path="/lab" element={<LabPage />} />
        <Route path="/lab/debug" element={<RecognitionDebugPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
