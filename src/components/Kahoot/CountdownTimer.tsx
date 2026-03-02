import { useEffect, useRef } from "react";
import { useQuiz } from "../../context/QuizContext";
import { playCountdownTickSound, playCountdownUrgentSound, playTimeUpSound } from "../../utils/sounds";

export default function CountdownTimer() {
  const { state, kahootCountdownTick } = useQuiz();
  const { countdownRemaining, countdownPerQuestion, enabled, freezeTimeActive } = state.kahoot;
  const intervalRef = useRef<number | null>(null);
  const prevRemaining = useRef(countdownRemaining);

  const question = state.sessionQuestions[state.currentIndex];
  const hasAnswered = question ? !!state.answers[question.id] : false;

  // Countdown interval
  useEffect(() => {
    if (!enabled || hasAnswered || countdownRemaining <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      kahootCountdownTick();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, hasAnswered, countdownRemaining, kahootCountdownTick]);

  // Sound effects
  useEffect(() => {
    if (countdownRemaining !== prevRemaining.current) {
      prevRemaining.current = countdownRemaining;
      if (countdownRemaining <= 0 && !hasAnswered) {
        playTimeUpSound();
      } else if (countdownRemaining <= 5 && countdownRemaining > 0) {
        playCountdownUrgentSound();
      } else if (countdownRemaining <= 10 && countdownRemaining > 0) {
        playCountdownTickSound();
      }
    }
  }, [countdownRemaining, hasAnswered]);

  if (!enabled) return null;

  const percentage = (countdownRemaining / countdownPerQuestion) * 100;
  const isUrgent = countdownRemaining <= 5;
  const isWarning = countdownRemaining <= 10;

  const barColor = isUrgent
    ? "bg-red-500"
    : isWarning
      ? "bg-yellow-500"
      : "bg-green-500";

  const textColor = isUrgent
    ? "text-red-500"
    : isWarning
      ? "text-yellow-500"
      : "text-green-500";

  return (
    <div className="space-y-2">
      {/* Timer bar */}
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-linear`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Timer number */}
      <div className="flex items-center justify-center">
        <div
          className={`text-3xl font-black ${textColor} ${
            isUrgent ? "animate-pulse scale-110" : ""
          } ${freezeTimeActive ? "text-cyan-400" : ""} transition-all`}
        >
          {freezeTimeActive && <span className="text-lg mr-1">❄️</span>}
          {countdownRemaining}
          <span className="text-sm font-normal ml-1">sn</span>
        </div>
      </div>

      {/* Time's up overlay */}
      {countdownRemaining <= 0 && !hasAnswered && (
        <div className="text-center text-red-500 font-black text-xl animate-bounce">
          Sure Doldu!
        </div>
      )}
    </div>
  );
}
