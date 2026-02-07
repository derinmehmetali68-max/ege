import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, Bookmark, BookmarkCheck } from "lucide-react";
import { useQuiz } from "../../context/QuizContext";
import { getImage } from "../../utils/imageDB";

export default function QuestionCard() {
  const { state, submitAnswer, toggleBookmark } = useQuiz();
  const [zoomed, setZoomed] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  const question = state.sessionQuestions[state.currentIndex];

  // Load image from IndexedDB
  useEffect(() => {
    if (!question) return;
    let cancelled = false;
    setImageLoading(true);
    setImageSrc(null);

    (async () => {
      try {
        const stored = await getImage(question.id);
        if (!cancelled) {
          setImageSrc(stored || question.imagePath);
          setImageLoading(false);
        }
      } catch {
        if (!cancelled) {
          setImageSrc(question.imagePath);
          setImageLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [question?.id, question?.imagePath]);

  // Keyboard shortcuts: A-E to answer
  useEffect(() => {
    if (!question) return;
    const answer = state.answers[question.id];
    if (answer) return; // already answered

    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toUpperCase();
      if (question.options.includes(key)) {
        e.preventDefault();
        submitAnswer(question.id, key);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [question?.id, question?.options, state.answers, submitAnswer]);

  if (!question) return null;

  const answer = state.answers[question.id];
  const hasAnswered = !!answer;
  const isBookmarked = question.bookmarked ?? false;

  const handleSelect = (opt: string) => {
    if (hasAnswered) return;
    submitAnswer(question.id, opt);
  };

  const getOptionStyle = (opt: string) => {
    if (!hasAnswered) {
      return "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 cursor-pointer";
    }
    if (opt === question.correctAnswer) {
      return "bg-green-50 dark:bg-green-900/30 border-2 border-green-500 text-green-800 dark:text-green-300";
    }
    if (opt === answer.selectedAnswer && !answer.isCorrect) {
      return "bg-red-50 dark:bg-red-900/30 border-2 border-red-500 text-red-800 dark:text-red-300";
    }
    return "bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Question Image */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Zoom button */}
        <button
          onClick={() => setZoomed(!zoomed)}
          className="absolute top-3 right-3 z-10 p-2 bg-white/90 dark:bg-gray-700/90 rounded-lg shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          {zoomed ? (
            <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          ) : (
            <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          )}
        </button>

        {/* Bookmark button */}
        <button
          onClick={() => toggleBookmark(question.id)}
          className="absolute top-3 left-3 z-10 p-2 bg-white/90 dark:bg-gray-700/90 rounded-lg shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
          aria-label={isBookmarked ? "Yer imini kaldır" : "Yer imine ekle"}
        >
          {isBookmarked ? (
            <BookmarkCheck className="w-4 h-4 text-yellow-500" />
          ) : (
            <Bookmark className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          )}
        </button>

        <div
          className={`flex items-center justify-center p-4 ${zoomed ? "min-h-[500px]" : "min-h-[300px]"}`}
        >
          {imageLoading ? (
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg w-full h-64" />
          ) : (
            <img
              src={imageSrc || ""}
              alt={`Soru ${state.currentIndex + 1}`}
              className={`max-w-full transition-transform duration-300 ${zoomed ? "scale-125" : ""}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE4Ij5Hw7Zyc2VsIHnDvGtsZW5lbWVkaTwvdGV4dD48L3N2Zz4=";
              }}
            />
          )}
        </div>
      </div>

      {/* Difficulty & Category badge */}
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
          {question.difficulty.charAt(0).toUpperCase() +
            question.difficulty.slice(1)}
        </span>
        {question.examType && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
            {question.examType}
          </span>
        )}
        {isBookmarked && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">
            Yer İmi
          </span>
        )}
      </div>

      {/* Answer Options */}
      <div className="grid grid-cols-5 gap-3">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            disabled={hasAnswered}
            className={`py-4 rounded-xl text-lg font-bold transition-all ${getOptionStyle(opt)} ${!hasAnswered ? "active:scale-95" : ""}`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Keyboard hint */}
      {!hasAnswered && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
          Klavye kısayolu: A - E tuşları ile cevaplayabilirsiniz
        </p>
      )}

      {/* Result feedback */}
      {hasAnswered && (
        <div
          className={`p-4 rounded-xl text-center font-medium ${
            answer.isCorrect
              ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {answer.isCorrect
            ? "Doğru cevap!"
            : `Yanlış! Doğru cevap: ${question.correctAnswer}`}
        </div>
      )}
    </div>
  );
}
