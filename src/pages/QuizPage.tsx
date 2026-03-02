import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, ArrowLeft } from "lucide-react";
import { useQuiz } from "../context/QuizContext";
import { useTimer } from "../hooks/useTimer";
import QuestionCard from "../components/Question/QuestionCard";
import QuestionNav from "../components/Question/QuestionNav";
import QuestionGrid from "../components/Question/QuestionGrid";
import ScoreBoard from "../components/Score/ScoreBoard";
import CountdownTimer from "../components/Kahoot/CountdownTimer";
import GameLobby from "../components/Kahoot/GameLobby";
import AnswerDistribution from "../components/Kahoot/AnswerDistribution";
import PowerUps from "../components/Kahoot/PowerUps";
import KahootScoreBoard from "../components/Kahoot/KahootScoreBoard";
import KahootAnswerButtons from "../components/Kahoot/KahootAnswerButtons";
import ConfettiEffect from "../components/Kahoot/ConfettiEffect";

export default function QuizPage() {
  const navigate = useNavigate();
  const { state, endQuiz, submitAnswer, goNext, goPrev } = useQuiz();
  const timer = useTimer();
  const isKahoot = state.kahoot.enabled;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (state.sessionQuestions.length === 0) {
      navigate("/");
      return;
    }
    if (!state.kahoot.inLobby) {
      timer.start();
    }
    return () => timer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start timer after lobby ends
  useEffect(() => {
    if (isKahoot && !state.kahoot.inLobby && !timer.isRunning) {
      timer.start();
    }
  }, [isKahoot, state.kahoot.inLobby, timer]);

  // Show confetti on correct answer in Kahoot mode
  useEffect(() => {
    if (!isKahoot) return;
    const question = state.sessionQuestions[state.currentIndex];
    if (!question) return;
    const answer = state.answers[question.id];
    if (answer?.isCorrect) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
  }, [isKahoot, state.answers, state.currentIndex, state.sessionQuestions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Don't navigate when distribution is showing
      if (isKahoot && state.kahoot.showAnswerDistribution) return;

      if (e.key === "ArrowRight") { goNext(); return; }
      if (e.key === "ArrowLeft") { goPrev(); return; }

      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D", "E"].includes(key)) {
        const question = state.sessionQuestions[state.currentIndex];
        if (!question) return;
        if (state.answers[question.id]) return;
        if (question.options.includes(key)) {
          submitAnswer(question.id, key);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, state.sessionQuestions, state.currentIndex, state.answers, submitAnswer, isKahoot, state.kahoot.showAnswerDistribution]);

  if (state.sessionQuestions.length === 0) return null;

  // Show lobby
  if (isKahoot && state.kahoot.inLobby) {
    return <GameLobby />;
  }

  const answeredCount = Object.keys(state.answers).length;
  const totalCount = state.sessionQuestions.length;

  const handleFinish = () => {
    timer.stop();
    endQuiz(timer.seconds);
    navigate("/results");
  };

  const currentCategory = state.categories.find(
    (c) => c.id === state.selectedCategory
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Confetti */}
      <ConfettiEffect active={showConfetti} />

      {/* Answer distribution overlay */}
      <AnswerDistribution />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {currentCategory ? currentCategory.name : "Karisik Test"}
              {isKahoot && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold">
                  KAHOOT
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {answeredCount} / {totalCount} cevaplanmis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isKahoot && (
            <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1.5 rounded-lg">
              {state.kahoot.totalPoints.toLocaleString()} puan
            </div>
          )}
          <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-300">
            {timer.formatted}
          </div>
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            <Flag className="w-4 h-4" />
            Testi Bitir
          </button>
        </div>
      </div>

      {/* Kahoot countdown timer */}
      {isKahoot && <div className="mb-4"><CountdownTimer /></div>}

      {/* Keyboard hint */}
      <div className="mb-4 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span>Klavye: A-E cevap sec</span>
        <span>&#8592; &#8594; soru gezin</span>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <QuestionCard hideOptions={isKahoot} />
          {isKahoot ? <KahootAnswerButtons /> : null}
          <QuestionNav />
        </div>
        <div className="space-y-4">
          {isKahoot ? (
            <>
              <KahootScoreBoard />
              <PowerUps />
            </>
          ) : (
            <ScoreBoard />
          )}
          <QuestionGrid />
        </div>
      </div>
    </div>
  );
}
