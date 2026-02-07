import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QuizProvider } from "./context/QuizContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import Header from "./components/Layout/Header";
import HomePage from "./pages/HomePage";
import QuizPage from "./pages/QuizPage";
import ResultsPage from "./pages/ResultsPage";
import UploadPage from "./pages/UploadPage";
import StatsPage from "./pages/StatsPage";
import ManagePage from "./pages/ManagePage";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <QuizProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
              <Header />
              <main>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/quiz" element={<QuizPage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/stats" element={<StatsPage />} />
                  <Route path="/manage" element={<ManagePage />} />
                </Routes>
              </main>
            </div>
          </QuizProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
