import { useQuiz } from "../../context/QuizContext";
import { CheckCircle, XCircle, MinusCircle, Clock } from "lucide-react";

export default function ScoreBoard() {
  const { state } = useQuiz();
  const { score, answers } = state;

  // Calculate average time per answered question
  const answeredList = Object.values(answers);
  const answeredCount = answeredList.length;
  const totalTimeSec = answeredList.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
  const avgTime = answeredCount > 0 ? totalTimeSec / answeredCount : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}sn`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}dk ${s}sn`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Anlık Skor
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Doğru</span>
          </div>
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            {score.correct}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">Yanlış</span>
          </div>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">
            {score.incorrect}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
            <MinusCircle className="w-4 h-4" />
            <span className="text-sm">Boş</span>
          </div>
          <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
            {score.unanswered}
          </span>
        </div>
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Net
          </span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {score.netScore.toFixed(2)}
          </span>
        </div>

        {/* Average time per question */}
        {answeredCount > 0 && (
          <>
            <hr className="my-2 border-gray-200 dark:border-gray-700" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Ort. Süre</span>
              </div>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                {formatTime(avgTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Toplam</span>
              </div>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                {formatTime(totalTimeSec)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
