import { useNavigate } from "react-router-dom";
import {
  Trophy,
  Home,
  RotateCcw,
  CheckCircle,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { useQuiz } from "../context/QuizContext";

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useQuiz();
  const { score, sessionQuestions, answers } = state;

  if (sessionQuestions.length === 0) {
    navigate("/");
    return null;
  }

  const getGrade = () => {
    if (score.percentage >= 80) return { label: "Mükemmel!", color: "text-green-600" };
    if (score.percentage >= 60) return { label: "İyi!", color: "text-blue-600" };
    if (score.percentage >= 40) return { label: "Orta", color: "text-yellow-600" };
    return { label: "Daha Çok Çalış", color: "text-red-600" };
  };

  const grade = getGrade();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-4">
          <Trophy className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Test Sonucu</h1>
        <p className={`text-xl font-bold mt-2 ${grade.color}`}>
          {grade.label}
        </p>
      </div>

      {/* Score card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="text-center mb-6">
          <p className="text-5xl font-bold text-blue-600">
            %{score.percentage}
          </p>
          <p className="text-sm text-gray-500 mt-1">Başarı Oranı</p>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{score.correct}</p>
            <p className="text-xs text-gray-500">Doğru</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{score.incorrect}</p>
            <p className="text-xs text-gray-500">Yanlış</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <MinusCircle className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-400">
              {score.unanswered}
            </p>
            <p className="text-xs text-gray-500">Boş</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Net</p>
            <p className="text-2xl font-bold text-blue-600">
              {score.netScore.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              {score.total} soru
            </p>
          </div>
        </div>
      </div>

      {/* Question breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Soru Detayı
        </h3>
        <div className="flex flex-wrap gap-2">
          {sessionQuestions.map((q, i) => {
            const answer = answers[q.id];
            let bgColor = "bg-gray-100 text-gray-500";
            if (answer) {
              bgColor = answer.isCorrect
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700";
            }
            return (
              <div
                key={q.id}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${bgColor}`}
                title={
                  answer
                    ? `Soru ${i + 1}: ${answer.isCorrect ? "Doğru" : "Yanlış"} (${answer.selectedAnswer}) - Cevap: ${q.correctAnswer}`
                    : `Soru ${i + 1}: Boş - Cevap: ${q.correctAnswer}`
                }
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Home className="w-4 h-4" />
          Ana Sayfa
        </button>
        <button
          onClick={() => {
            navigate("/quiz");
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Tekrar Çöz
        </button>
      </div>
    </div>
  );
}
