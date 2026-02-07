import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, ArrowLeft } from "lucide-react";
import { useQuiz } from "../context/QuizContext";
import { useTimer } from "../hooks/useTimer";
import QuestionCard from "../components/Question/QuestionCard";
import QuestionNav from "../components/Question/QuestionNav";
import QuestionGrid from "../components/Question/QuestionGrid";
import ScoreBoard from "../components/Score/ScoreBoard";

export default function QuizPage() {
  const navigate = useNavigate();
  const { state, endQuiz, goNext, goPrev } = useQuiz();
  const timer = useTimer();

  useEffect(() => {
    if (state.sessionQuestions.length === 0) {
      navigate("/");
      return;
    }
    timer.start();
    return () => timer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  if (state.sessionQuestions.length === 0) return null;

  const answeredCount = Object.keys(state.answers).length;
  const totalCount = state.sessionQuestions.length;

  const handleFinish = () => {
    timer.stop();
    endQuiz();
    navigate("/results");
  };

  const currentCategory = state.categories.find(
    (c) => c.id === state.selectedCategory
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {currentCategory ? currentCategory.name : "Karışık Test"}
            </h1>
            <p className="text-xs text-gray-500">
              {answeredCount} / {totalCount} cevaplanmış
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-mono bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700">
            {timer.formatted}
          </div>
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            <Flag className="w-4 h-4" />
            Testi Bitir
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <QuestionCard />
          <QuestionNav />
        </div>
        <div className="space-y-4">
          <ScoreBoard />
          <QuestionGrid />
        </div>
      </div>
    </div>
  );
}
