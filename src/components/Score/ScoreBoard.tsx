import { useQuiz } from "../../context/QuizContext";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";

export default function ScoreBoard() {
  const { state } = useQuiz();
  const { score } = state;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Anlık Skor</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Doğru</span>
          </div>
          <span className="text-sm font-bold text-green-600">
            {score.correct}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">Yanlış</span>
          </div>
          <span className="text-sm font-bold text-red-600">
            {score.incorrect}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <MinusCircle className="w-4 h-4" />
            <span className="text-sm">Boş</span>
          </div>
          <span className="text-sm font-bold text-gray-400">
            {score.unanswered}
          </span>
        </div>
        <hr className="my-2" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Net</span>
          <span className="text-lg font-bold text-blue-600">
            {score.netScore.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
