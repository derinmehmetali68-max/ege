import { useQuiz } from "../../context/QuizContext";
import { playCorrectSound, playWrongSound, playStreakSound } from "../../utils/sounds";
import { getStreakLabel, getStreakColor } from "../../utils/kahootScoring";

// Kahoot-style colored answer buttons with shapes
const KAHOOT_STYLES: Record<string, { bg: string; hoverBg: string; shape: string; icon: string }> = {
  A: { bg: "bg-red-500", hoverBg: "hover:bg-red-600", shape: "triangle", icon: "▲" },
  B: { bg: "bg-blue-500", hoverBg: "hover:bg-blue-600", shape: "diamond", icon: "◆" },
  C: { bg: "bg-yellow-500", hoverBg: "hover:bg-yellow-600", shape: "circle", icon: "●" },
  D: { bg: "bg-green-500", hoverBg: "hover:bg-green-600", shape: "square", icon: "■" },
  E: { bg: "bg-purple-500", hoverBg: "hover:bg-purple-600", shape: "pentagon", icon: "⬠" },
};

export default function KahootAnswerButtons() {
  const { state, submitAnswer } = useQuiz();
  const question = state.sessionQuestions[state.currentIndex];
  if (!question) return null;

  const answer = state.answers[question.id];
  const hasAnswered = !!answer;
  const { eliminatedOptions, streak } = state.kahoot;

  const handleSelect = (opt: string) => {
    if (hasAnswered) return;
    submitAnswer(question.id, opt);

    const isCorrect = opt === question.correctAnswer;
    if (isCorrect) {
      playCorrectSound();
      if (streak + 1 >= 2) {
        setTimeout(() => playStreakSound(streak + 1), 300);
      }
    } else {
      playWrongSound();
    }
  };

  const getButtonStyle = (opt: string) => {
    const style = KAHOOT_STYLES[opt] || KAHOOT_STYLES.A;
    const isEliminated = eliminatedOptions.includes(opt);

    if (isEliminated) {
      return "bg-gray-300 dark:bg-gray-700 opacity-40 cursor-not-allowed text-gray-500";
    }

    if (!hasAnswered) {
      return `${style.bg} ${style.hoverBg} text-white cursor-pointer active:scale-95 shadow-lg hover:shadow-xl`;
    }

    if (opt === question.correctAnswer) {
      return "bg-green-500 text-white ring-4 ring-green-300 shadow-lg animate-pulse";
    }
    if (opt === answer.selectedAnswer && !answer.isCorrect) {
      return "bg-red-600 text-white ring-4 ring-red-300 kahoot-shake";
    }
    return `${style.bg} text-white opacity-40`;
  };

  const streakLabel = hasAnswered && answer.isCorrect ? getStreakLabel(answer.streak || 0) : "";
  const streakColor = hasAnswered && answer.isCorrect ? getStreakColor(answer.streak || 0) : "";

  return (
    <div className="space-y-3">
      {/* Streak display */}
      {streakLabel && (
        <div className={`text-center text-lg font-black ${streakColor} animate-bounce`}>
          🔥 {streakLabel} ({answer.streak} seri)
        </div>
      )}

      {/* Points earned */}
      {hasAnswered && answer.isCorrect && (answer.kahootPoints || 0) > 0 && (
        <div className="text-center">
          <span className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black text-xl px-4 py-1 rounded-full kahoot-points-pop">
            +{answer.kahootPoints} puan
          </span>
        </div>
      )}

      {/* Kahoot answer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.options.map((opt) => {
          const style = KAHOOT_STYLES[opt] || KAHOOT_STYLES.A;
          const isEliminated = eliminatedOptions.includes(opt);

          return (
            <button
              key={opt}
              onClick={() => !isEliminated && handleSelect(opt)}
              disabled={hasAnswered || isEliminated}
              className={`relative flex items-center justify-center gap-3 py-6 rounded-xl text-xl font-black transition-all duration-200 ${getButtonStyle(opt)}`}
            >
              <span className="text-2xl opacity-80">{style.icon}</span>
              <span>{opt}</span>
              {hasAnswered && opt === question.correctAnswer && (
                <span className="absolute right-3 text-2xl">✓</span>
              )}
              {hasAnswered && opt === answer.selectedAnswer && !answer.isCorrect && (
                <span className="absolute right-3 text-2xl">✗</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {hasAnswered && (
        <div
          className={`p-4 rounded-xl text-center font-bold text-lg ${
            answer.isCorrect
              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-2 border-green-400"
              : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-2 border-red-400"
          }`}
        >
          {answer.isCorrect
            ? "Dogru Cevap! 🎉"
            : `Yanlis! Dogru cevap: ${question.correctAnswer}`}
        </div>
      )}
    </div>
  );
}
