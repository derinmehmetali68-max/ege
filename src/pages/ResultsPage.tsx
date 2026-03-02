import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  Home,
  RotateCcw,
  CheckCircle,
  XCircle,
  MinusCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useQuiz } from "../context/QuizContext";
import { getImage } from "../utils/imageDB";
import PodiumScreen from "../components/Kahoot/PodiumScreen";

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state, enterReview, exitReview, reviewGoTo } = useQuiz();
  const { score, sessionQuestions, answers, reviewMode, reviewIndex, totalTimeSpent } = state;
  const isKahoot = state.kahoot.enabled;

  const [reviewImageSrc, setReviewImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewMode) {
      setReviewImageSrc(null);
      return;
    }
    const question = sessionQuestions[reviewIndex];
    if (!question) return;

    let cancelled = false;
    getImage(question.id).then((src) => {
      if (!cancelled) {
        setReviewImageSrc(src || question.imagePath || null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reviewMode, reviewIndex, sessionQuestions]);

  const handleReviewPrev = useCallback(() => {
    if (reviewIndex > 0) reviewGoTo(reviewIndex - 1);
  }, [reviewIndex, reviewGoTo]);

  const handleReviewNext = useCallback(() => {
    if (reviewIndex < sessionQuestions.length - 1) reviewGoTo(reviewIndex + 1);
  }, [reviewIndex, sessionQuestions.length, reviewGoTo]);

  useEffect(() => {
    if (!reviewMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleReviewPrev();
      if (e.key === "ArrowRight") handleReviewNext();
      if (e.key === "Escape") exitReview();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reviewMode, handleReviewPrev, handleReviewNext, exitReview]);

  if (sessionQuestions.length === 0) {
    navigate("/");
    return null;
  }

  const getGrade = () => {
    if (score.percentage >= 80) return { label: "Mukemmel!", color: "text-green-600 dark:text-green-400" };
    if (score.percentage >= 60) return { label: "Iyi!", color: "text-blue-600 dark:text-blue-400" };
    if (score.percentage >= 40) return { label: "Orta", color: "text-yellow-600 dark:text-yellow-400" };
    return { label: "Daha Cok Calis", color: "text-red-600 dark:text-red-400" };
  };

  const grade = getGrade();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} dk ${s} sn`;
  };

  const avgTime =
    sessionQuestions.length > 0
      ? Math.round(totalTimeSpent / sessionQuestions.length)
      : 0;

  // Review mode overlay
  if (reviewMode) {
    const question = sessionQuestions[reviewIndex];
    const answer = question ? answers[question.id] : undefined;

    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Soru {reviewIndex + 1} / {sessionQuestions.length}
            </h2>
            <button
              onClick={exitReview}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-4">
            {reviewImageSrc ? (
              <img
                src={reviewImageSrc}
                alt={`Soru ${reviewIndex + 1}`}
                className="max-w-full mx-auto rounded-lg border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-400 dark:text-gray-500">Gorsel yuklenemedi</span>
              </div>
            )}
          </div>

          {question && (
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                    Dogru Cevap
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {question.correctAnswer}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    answer
                      ? answer.isCorrect
                        ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <p
                    className={`text-xs font-medium mb-1 ${
                      answer
                        ? answer.isCorrect
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Senin Cevabin
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      answer
                        ? answer.isCorrect
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {answer ? answer.selectedAnswer || "-" : "Bos"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    question.difficulty === "kolay"
                      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                      : question.difficulty === "orta"
                        ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"
                        : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                  }`}
                >
                  {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                </span>
                {answer && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {answer.timeSpent} sn
                  </span>
                )}
                {isKahoot && answer && (
                  <span className="text-xs font-bold text-purple-500">
                    +{answer.kahootPoints || 0} puan
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleReviewPrev}
              disabled={reviewIndex === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Onceki
            </button>

            <div className="flex flex-wrap gap-1 max-w-xs justify-center">
              {sessionQuestions.map((q, i) => {
                const a = answers[q.id];
                let dotColor = "bg-gray-300 dark:bg-gray-600";
                if (a) {
                  dotColor = a.isCorrect ? "bg-green-500" : "bg-red-500";
                }
                return (
                  <button
                    key={q.id}
                    onClick={() => reviewGoTo(i)}
                    className={`w-6 h-6 rounded text-xs font-bold transition-all ${dotColor} ${
                      i === reviewIndex
                        ? "ring-2 ring-blue-500 text-white"
                        : "text-white/80 hover:opacity-80"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleReviewNext}
              disabled={reviewIndex >= sessionQuestions.length - 1}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Sonraki
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Kahoot Podium */}
      {isKahoot && <PodiumScreen />}

      {/* Header */}
      <div className="text-center mb-8">
        {!isKahoot && (
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full mb-4">
            <Trophy className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Sonucu</h1>
        <p className={`text-xl font-bold mt-2 ${grade.color}`}>
          {grade.label}
        </p>
      </div>

      {/* Score card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="text-center mb-6">
          <p className="text-5xl font-bold text-blue-600 dark:text-blue-400">
            %{score.percentage}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Basari Orani</p>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{score.correct}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dogru</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{score.incorrect}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Yanlis</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <MinusCircle className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-400">
              {score.unanswered}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bos</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Net</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {score.netScore.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {score.total} soru
            </p>
          </div>
        </div>
      </div>

      {/* Time stats */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Zaman Istatistikleri
        </h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatTime(totalTimeSpent)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam Sure</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {avgTime} sn
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ort. Soru Basina</p>
          </div>
        </div>
      </div>

      {/* Question breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Soru Detayi
        </h3>
        <div className="flex flex-wrap gap-2">
          {sessionQuestions.map((q, i) => {
            const answer = answers[q.id];
            let bgColor = "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400";
            if (answer) {
              bgColor = answer.isCorrect
                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400";
            }
            return (
              <button
                key={q.id}
                onClick={() => enterReview(i)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${bgColor} hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer`}
                title={
                  answer
                    ? `Soru ${i + 1}: ${answer.isCorrect ? "Dogru" : "Yanlis"} (${answer.selectedAnswer}) - Cevap: ${q.correctAnswer}`
                    : `Soru ${i + 1}: Bos - Cevap: ${q.correctAnswer}`
                }
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        >
          <Home className="w-4 h-4" />
          Ana Sayfa
        </button>
        <button
          onClick={() => enterReview(0)}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Incele
        </button>
        <button
          onClick={() => {
            navigate("/quiz");
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Tekrar Coz
        </button>
      </div>
    </div>
  );
}
