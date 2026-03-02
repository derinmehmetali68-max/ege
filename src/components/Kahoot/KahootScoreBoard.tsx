import { Trophy, Flame, Zap } from "lucide-react";
import { useQuiz } from "../../context/QuizContext";

export default function KahootScoreBoard() {
  const { state } = useQuiz();
  const { totalPoints, streak, bestStreak, enabled } = state.kahoot;

  if (!enabled) return null;

  return (
    <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-4 text-white">
      <h3 className="text-sm font-semibold opacity-80 mb-3">Kahoot Skor</h3>
      <div className="space-y-3">
        {/* Total points */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-medium">Puan</span>
          </div>
          <span className="text-2xl font-black">{totalPoints.toLocaleString()}</span>
        </div>

        {/* Current streak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`w-5 h-5 ${streak >= 2 ? "text-orange-300 animate-pulse" : "text-white/50"}`} />
            <span className="text-sm font-medium">Seri</span>
          </div>
          <span className={`text-lg font-bold ${streak >= 2 ? "text-orange-300" : ""}`}>
            {streak}
          </span>
        </div>

        {/* Best streak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-medium">En iyi Seri</span>
          </div>
          <span className="text-lg font-bold">{bestStreak}</span>
        </div>
      </div>
    </div>
  );
}
