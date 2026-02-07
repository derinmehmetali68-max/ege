import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useQuiz } from "../../context/QuizContext";
import { getStoredImages } from "../../utils/storage";

export default function QuestionCard() {
  const { state, submitAnswer } = useQuiz();
  const [zoomed, setZoomed] = useState(false);

  const question = state.sessionQuestions[state.currentIndex];
  if (!question) return null;

  const answer = state.answers[question.id];
  const hasAnswered = !!answer;
  const images = getStoredImages();
  const imageSrc = images[question.id] || question.imagePath;

  const handleSelect = (opt: string) => {
    if (hasAnswered) return;
    submitAnswer(question.id, opt);
  };

  const getOptionStyle = (opt: string) => {
    if (!hasAnswered) {
      return "bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 cursor-pointer";
    }
    if (opt === question.correctAnswer) {
      return "bg-green-50 border-2 border-green-500 text-green-800";
    }
    if (opt === answer.selectedAnswer && !answer.isCorrect) {
      return "bg-red-50 border-2 border-red-500 text-red-800";
    }
    return "bg-gray-50 border-2 border-gray-200 text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Question Image */}
      <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setZoomed(!zoomed)}
          className="absolute top-3 right-3 z-10 p-2 bg-white/90 rounded-lg shadow-sm hover:bg-white transition-colors"
        >
          {zoomed ? (
            <ZoomOut className="w-4 h-4 text-gray-600" />
          ) : (
            <ZoomIn className="w-4 h-4 text-gray-600" />
          )}
        </button>
        <div
          className={`flex items-center justify-center p-4 ${zoomed ? "min-h-[500px]" : "min-h-[300px]"}`}
        >
          <img
            src={imageSrc}
            alt={`Soru ${state.currentIndex + 1}`}
            className={`max-w-full transition-transform duration-300 ${zoomed ? "scale-125" : ""}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE4Ij5Hw7Zyc2VsIHnDvGtsZW5lbWVkaTwvdGV4dD48L3N2Zz4=";
            }}
          />
        </div>
      </div>

      {/* Difficulty & Category badge */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            question.difficulty === "kolay"
              ? "bg-green-100 text-green-700"
              : question.difficulty === "orta"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {question.difficulty.charAt(0).toUpperCase() +
            question.difficulty.slice(1)}
        </span>
        {question.examType && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            {question.examType}
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

      {/* Result feedback */}
      {hasAnswered && (
        <div
          className={`p-4 rounded-xl text-center font-medium ${
            answer.isCorrect
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
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
