import { useNavigate } from "react-router-dom";
import {
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  BookOpen,
  Play,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useQuiz } from "../context/QuizContext";

const iconMap: Record<string, React.ReactNode> = {
  calculator: <Calculator className="w-8 h-8" />,
  atom: <Atom className="w-8 h-8" />,
  "flask-conical": <FlaskConical className="w-8 h-8" />,
  leaf: <Leaf className="w-8 h-8" />,
  "book-open": <BookOpen className="w-8 h-8" />,
};

const colorMap: Record<string, { bg: string; text: string; border: string; light: string }> = {
  blue: { bg: "bg-blue-500", text: "text-blue-600", border: "border-blue-200", light: "bg-blue-50" },
  purple: { bg: "bg-purple-500", text: "text-purple-600", border: "border-purple-200", light: "bg-purple-50" },
  green: { bg: "bg-green-500", text: "text-green-600", border: "border-green-200", light: "bg-green-50" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-200", light: "bg-emerald-50" },
  orange: { bg: "bg-orange-500", text: "text-orange-600", border: "border-orange-200", light: "bg-orange-50" },
};

export default function HomePage() {
  const navigate = useNavigate();
  const { state, startQuiz } = useQuiz();
  const [selectedCount, setSelectedCount] = useState(20);

  const getCategoryCount = (catId: string) =>
    state.questions.filter((q) => q.categoryId === catId).length;

  const totalQuestions = state.questions.length;

  const handleStartQuiz = (categoryId: string) => {
    const count = getCategoryCount(categoryId);
    if (count === 0) {
      navigate("/upload");
      return;
    }
    startQuiz({
      categoryId,
      count: Math.min(selectedCount, count),
    });
    navigate("/quiz");
  };

  const handleStartAll = () => {
    if (totalQuestions === 0) {
      navigate("/upload");
      return;
    }
    startQuiz({ count: Math.min(selectedCount, totalQuestions) });
    navigate("/quiz");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          EGE Soru Bankası
        </h1>
        <p className="text-gray-500 text-lg">
          PNG formatında soru yükleyin, çözün, başarınızı takip edin.
        </p>
      </div>

      {/* Question count selector */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className="text-sm text-gray-600">Soru sayısı:</span>
        <div className="relative">
          <select
            value={selectedCount}
            onChange={(e) => setSelectedCount(Number(e.target.value))}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={9999}>Tümü</option>
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* No questions prompt */}
      {totalQuestions === 0 && (
        <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center">
          <Upload className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-amber-800 font-medium mb-2">
            Henüz soru yüklenmemiş
          </p>
          <p className="text-amber-600 text-sm mb-4">
            Başlamak için PNG formatındaki sorularınızı yükleyin.
          </p>
          <button
            onClick={() => navigate("/upload")}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Soru Yükle
          </button>
        </div>
      )}

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {state.categories.map((cat) => {
          const colors = colorMap[cat.color] || colorMap.blue;
          const count = getCategoryCount(cat.id);
          const catStats = state.userStats.categoryStats[cat.id];

          return (
            <button
              key={cat.id}
              onClick={() => handleStartQuiz(cat.id)}
              className={`group p-6 rounded-2xl border ${colors.border} ${colors.light} hover:shadow-md transition-all text-left`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colors.text}`}>
                  {iconMap[cat.icon] || <BookOpen className="w-8 h-8" />}
                </div>
                {count > 0 && (
                  <Play className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {cat.name}
              </h3>
              <p className="text-sm text-gray-500">
                {count > 0 ? `${count} soru` : "Soru yüklenmemiş"}
              </p>
              {catStats && catStats.solved > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span className="text-green-600 font-medium">
                    {catStats.correct} doğru
                  </span>
                  <span className="text-red-600 font-medium">
                    {catStats.incorrect} yanlış
                  </span>
                  <span>
                    %
                    {Math.round(
                      (catStats.correct / catStats.solved) * 100
                    )}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Start all button */}
      {totalQuestions > 0 && (
        <div className="text-center">
          <button
            onClick={handleStartAll}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Play className="w-5 h-5" />
            Karışık Test Başlat ({totalQuestions} soru)
          </button>
        </div>
      )}

      {/* Stats summary */}
      {state.userStats.totalQuestionsSolved > 0 && (
        <div className="mt-10 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {state.userStats.totalQuestionsSolved}
            </p>
            <p className="text-xs text-gray-500 mt-1">Çözülen Soru</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {state.userStats.totalCorrect}
            </p>
            <p className="text-xs text-gray-500 mt-1">Doğru</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              %
              {state.userStats.totalQuestionsSolved > 0
                ? Math.round(
                    (state.userStats.totalCorrect /
                      state.userStats.totalQuestionsSolved) *
                      100
                  )
                : 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Başarı</p>
          </div>
        </div>
      )}
    </div>
  );
}
