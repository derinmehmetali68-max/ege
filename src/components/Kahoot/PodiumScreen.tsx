import { useEffect } from "react";
import { Trophy, Star, Flame, Zap, Target } from "lucide-react";
import { useQuiz } from "../../context/QuizContext";
import { playPodiumSound } from "../../utils/sounds";
import ConfettiEffect from "./ConfettiEffect";

export default function PodiumScreen() {
  const { state } = useQuiz();
  const { totalPoints, bestStreak, enabled } = state.kahoot;
  const { score, sessionQuestions, answers } = state;

  useEffect(() => {
    if (enabled) {
      playPodiumSound();
    }
  }, [enabled]);

  if (!enabled) return null;

  // Calculate stats
  const totalAnswered = Object.values(answers).length;
  const avgPoints = totalAnswered > 0 ? Math.round(totalPoints / totalAnswered) : 0;
  const fastestAnswer = Object.values(answers).reduce(
    (min, a) => (a.isCorrect && a.timeSpent < min ? a.timeSpent : min),
    Infinity
  );
  const fastestTime = fastestAnswer === Infinity ? 0 : fastestAnswer;

  // Rank based on percentage
  const getRank = () => {
    if (score.percentage >= 90) return { label: "GRANDMASTER", color: "text-purple-400", bg: "from-purple-600 to-pink-600" };
    if (score.percentage >= 75) return { label: "MASTER", color: "text-yellow-400", bg: "from-yellow-600 to-orange-600" };
    if (score.percentage >= 60) return { label: "UZMAN", color: "text-blue-400", bg: "from-blue-600 to-cyan-600" };
    if (score.percentage >= 40) return { label: "OGRENME YOLUNDA", color: "text-green-400", bg: "from-green-600 to-emerald-600" };
    return { label: "BASLANGIÇ", color: "text-gray-400", bg: "from-gray-600 to-gray-700" };
  };

  const rank = getRank();

  return (
    <div className="space-y-6">
      <ConfettiEffect active={score.percentage >= 60} />

      {/* Podium header */}
      <div className={`bg-gradient-to-br ${rank.bg} rounded-2xl p-8 text-center text-white relative overflow-hidden`}>
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 text-6xl">🏆</div>
          <div className="absolute top-4 right-4 text-6xl">⭐</div>
          <div className="absolute bottom-4 left-1/4 text-4xl">🎯</div>
          <div className="absolute bottom-4 right-1/4 text-4xl">🔥</div>
        </div>

        <div className="relative">
          <Trophy className="w-16 h-16 mx-auto text-yellow-300 mb-3" />
          <p className={`text-sm font-bold uppercase tracking-widest ${rank.color} mb-2`}>
            {rank.label}
          </p>
          <p className="text-5xl font-black mb-2">
            {totalPoints.toLocaleString()}
          </p>
          <p className="text-lg opacity-80">toplam puan</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{score.correct}/{sessionQuestions.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Dogru Cevap</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Flame className="w-6 h-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{bestStreak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">En iyi Seri</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Zap className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{avgPoints}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ort. Puan/Soru</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{fastestTime}sn</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">En Hizli Cevap</p>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Soru Bazinda Puanlar
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sessionQuestions.map((q, i) => {
            const a = answers[q.id];
            return (
              <div
                key={q.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-750"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 w-6">{i + 1}</span>
                  {a ? (
                    a.isCorrect ? (
                      <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✗</span>
                    )
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white text-xs">-</span>
                  )}
                  <span className="text-xs text-gray-500">{a ? `${a.timeSpent}sn` : "-"}</span>
                </div>
                <span className={`text-sm font-bold ${(a?.kahootPoints || 0) > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                  +{a?.kahootPoints || 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
