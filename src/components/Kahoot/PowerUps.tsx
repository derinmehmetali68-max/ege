import { Scissors, Zap, Snowflake } from "lucide-react";
import { useQuiz } from "../../context/QuizContext";
import { playPowerUpSound } from "../../utils/sounds";
import type { PowerUpType } from "../../types";

const ICONS: Record<string, React.ReactNode> = {
  scissors: <Scissors className="w-5 h-5" />,
  zap: <Zap className="w-5 h-5" />,
  snowflake: <Snowflake className="w-5 h-5" />,
};

const COLORS: Record<PowerUpType, { active: string; inactive: string }> = {
  fiftyFifty: {
    active: "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30",
    inactive: "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed",
  },
  doublePoints: {
    active: "bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/30",
    inactive: "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed",
  },
  freezeTime: {
    active: "bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/30",
    inactive: "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed",
  },
};

export default function PowerUps() {
  const { state, kahootUsePowerUp } = useQuiz();
  const { powerUps, enabled } = state.kahoot;
  const question = state.sessionQuestions[state.currentIndex];
  const hasAnswered = question ? !!state.answers[question.id] : false;

  if (!enabled) return null;

  const handleUse = (type: PowerUpType) => {
    playPowerUpSound();
    kahootUsePowerUp(type);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Power-Up'lar
      </h3>
      <div className="flex flex-col gap-2">
        {powerUps.map((pu) => {
          const canUse = !pu.used && !hasAnswered;
          const colors = COLORS[pu.type];
          return (
            <button
              key={pu.type}
              onClick={() => canUse && handleUse(pu.type)}
              disabled={!canUse}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                canUse ? colors.active : colors.inactive
              }`}
            >
              {ICONS[pu.icon]}
              <span>{pu.label}</span>
              {pu.used && <span className="text-xs ml-auto opacity-60">Kullanildi</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
