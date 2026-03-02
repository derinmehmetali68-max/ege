import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuiz } from "../../context/QuizContext";

export default function QuestionNav() {
  const { state, goNext, goPrev } = useQuiz();
  const total = state.sessionQuestions.length;
  const current = state.currentIndex + 1;
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={state.currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Önceki
        </button>

        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {current} / {total}
        </span>

        <button
          onClick={goNext}
          disabled={state.currentIndex >= total - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Sonraki
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
