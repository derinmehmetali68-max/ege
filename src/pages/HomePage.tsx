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
  Bookmark,
  Filter,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useQuiz } from "../context/QuizContext";
import { useTheme } from "../context/ThemeContext";

const iconMap: Record<string, React.ReactNode> = {
  calculator: <Calculator className="w-8 h-8" />,
  atom: <Atom className="w-8 h-8" />,
  "flask-conical": <FlaskConical className="w-8 h-8" />,
  leaf: <Leaf className="w-8 h-8" />,
  "book-open": <BookOpen className="w-8 h-8" />,
};

const colorMap: Record<
  string,
  { bg: string; text: string; border: string; light: string; darkLight: string; darkBorder: string }
> = {
  blue: {
    bg: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    light: "bg-blue-50 dark:bg-blue-950/40",
    darkLight: "dark:bg-blue-950/40",
    darkBorder: "dark:border-blue-800",
  },
  purple: {
    bg: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    light: "bg-purple-50 dark:bg-purple-950/40",
    darkLight: "dark:bg-purple-950/40",
    darkBorder: "dark:border-purple-800",
  },
  green: {
    bg: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    light: "bg-green-50 dark:bg-green-950/40",
    darkLight: "dark:bg-green-950/40",
    darkBorder: "dark:border-green-800",
  },
  emerald: {
    bg: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    light: "bg-emerald-50 dark:bg-emerald-950/40",
    darkLight: "dark:bg-emerald-950/40",
    darkBorder: "dark:border-emerald-800",
  },
  orange: {
    bg: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    light: "bg-orange-50 dark:bg-orange-950/40",
    darkLight: "dark:bg-orange-950/40",
    darkBorder: "dark:border-orange-800",
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const { state, startQuiz } = useQuiz();
  const { theme } = useTheme();
  void theme;

  const [selectedCount, setSelectedCount] = useState(20);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [kahootMode, setKahootMode] = useState(false);

  const bookmarkedCount = state.questions.filter((q) => q.bookmarked).length;

  const getFilteredCount = (catId?: string) => {
    let filtered = state.questions;
    if (catId) filtered = filtered.filter((q) => q.categoryId === catId);
    if (selectedDifficulty) filtered = filtered.filter((q) => q.difficulty === selectedDifficulty);
    if (bookmarkedOnly) filtered = filtered.filter((q) => q.bookmarked);
    return filtered.length;
  };

  const totalFiltered = getFilteredCount();
  const totalQuestions = state.questions.length;

  const handleStartQuiz = (categoryId: string) => {
    const count = getFilteredCount(categoryId);
    if (count === 0) {
      navigate("/upload");
      return;
    }
    startQuiz({
      categoryId,
      difficulty: selectedDifficulty || undefined,
      bookmarkedOnly: bookmarkedOnly || undefined,
      count: Math.min(selectedCount, count),
      kahootMode,
    });
    navigate("/quiz");
  };

  const handleStartAll = () => {
    if (totalFiltered === 0) {
      navigate("/upload");
      return;
    }
    startQuiz({
      difficulty: selectedDifficulty || undefined,
      bookmarkedOnly: bookmarkedOnly || undefined,
      count: Math.min(selectedCount, totalFiltered),
      kahootMode,
    });
    navigate("/quiz");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          EGE Soru Bankasi
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          PNG formatinda soru yukleyin, cozun, basarinizi takip edin.
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {/* Question count */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Soru sayisi:</span>
          <div className="relative">
            <select
              value={selectedCount}
              onChange={(e) => setSelectedCount(Number(e.target.value))}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={9999}>Tumu</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Difficulty filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <div className="relative">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tum Zorluklar</option>
              <option value="kolay">Kolay</option>
              <option value="orta">Orta</option>
              <option value="zor">Zor</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Bookmarked only toggle */}
        <button
          onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
            bookmarkedOnly
              ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${bookmarkedOnly ? "fill-amber-500" : ""}`} />
          Isaretliler ({bookmarkedCount})
        </button>

        {/* Kahoot mode toggle */}
        <button
          onClick={() => setKahootMode(!kahootMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
            kahootMode
              ? "bg-gradient-to-r from-purple-500 to-blue-500 border-purple-400 text-white shadow-lg shadow-purple-500/25"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
          }`}
        >
          <Zap className={`w-4 h-4 ${kahootMode ? "text-yellow-300" : ""}`} />
          Kahoot Modu
        </button>
      </div>

      {/* Kahoot info banner */}
      {kahootMode && (
        <div className="mb-8 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-purple-700 dark:text-purple-300">Kahoot Modu Aktif!</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-purple-600 dark:text-purple-400">
            <span>🏆 Hiz bazli puanlama</span>
            <span>🔥 Seri bonus sistemi</span>
            <span>⏱️ 30sn geri sayim</span>
            <span>⚡ Power-up'lar</span>
          </div>
        </div>
      )}

      {/* No questions prompt */}
      {totalQuestions === 0 && (
        <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl text-center">
          <Upload className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-amber-800 dark:text-amber-300 font-medium mb-2">
            Henuz soru yuklenmemis
          </p>
          <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
            Baslamak icin PNG formatindaki sorularinizi yukleyin.
          </p>
          <button
            onClick={() => navigate("/upload")}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Soru Yukle
          </button>
        </div>
      )}

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {state.categories.map((cat) => {
          const colors = colorMap[cat.color] || colorMap.blue;
          const count = getFilteredCount(cat.id);
          const catStats = state.userStats.categoryStats[cat.id];

          return (
            <button
              key={cat.id}
              onClick={() => handleStartQuiz(cat.id)}
              className={`group p-6 rounded-2xl border ${colors.border} ${colors.light} hover:shadow-md transition-all text-left ${
                kahootMode ? "ring-2 ring-purple-300/50 dark:ring-purple-700/50" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colors.text}`}>
                  {iconMap[cat.icon] || <BookOpen className="w-8 h-8" />}
                </div>
                {count > 0 && (
                  kahootMode ? (
                    <Zap className="w-5 h-5 text-purple-400 group-hover:text-purple-500 transition-colors" />
                  ) : (
                    <Play className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                  )
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                {cat.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {count > 0 ? `${count} soru` : "Soru yuklenmemis"}
              </p>
              {catStats && catStats.solved > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {catStats.correct} dogru
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {catStats.incorrect} yanlis
                  </span>
                  <span>
                    %{Math.round((catStats.correct / catStats.solved) * 100)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Start all button */}
      {totalFiltered > 0 && (
        <div className="text-center">
          <button
            onClick={handleStartAll}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors shadow-sm ${
              kahootMode
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-purple-500/25"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {kahootMode ? <Zap className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {kahootMode ? "Kahoot Testi Baslat" : "Karisik Test Baslat"} ({totalFiltered} soru)
          </button>
        </div>
      )}

      {/* Stats summary */}
      {state.userStats.totalQuestionsSolved > 0 && (
        <div className="mt-10 grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {state.userStats.totalQuestionsSolved}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cozulen Soru</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {state.userStats.totalCorrect}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Dogru</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              %
              {state.userStats.totalQuestionsSolved > 0
                ? Math.round(
                    (state.userStats.totalCorrect /
                      state.userStats.totalQuestionsSolved) *
                      100
                  )
                : 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Basari</p>
          </div>
        </div>
      )}
    </div>
  );
}
