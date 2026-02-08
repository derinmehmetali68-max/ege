import { useEffect, useRef } from "react";
import { useQuiz } from "../../context/QuizContext";
import { playLobbyTickSound, playStartSound } from "../../utils/sounds";

export default function GameLobby() {
  const { state, kahootLobbyTick } = useQuiz();
  const { lobbyCountdown, inLobby } = state.kahoot;
  const intervalRef = useRef<number | null>(null);
  const prevCountdown = useRef(lobbyCountdown);

  useEffect(() => {
    if (!inLobby) return;

    intervalRef.current = window.setInterval(() => {
      kahootLobbyTick();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [inLobby, kahootLobbyTick]);

  // Sound effects
  useEffect(() => {
    if (lobbyCountdown !== prevCountdown.current) {
      prevCountdown.current = lobbyCountdown;
      if (lobbyCountdown === 0) {
        playStartSound();
      } else if (lobbyCountdown > 0) {
        playLobbyTickSound();
      }
    }
  }, [lobbyCountdown]);

  if (!inLobby) return null;

  const totalQuestions = state.sessionQuestions.length;
  const categoryName = state.categories.find((c) => c.id === state.selectedCategory)?.name || "Karisik";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
      <div className="text-center space-y-8">
        {/* Kahoot logo area */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-white tracking-tight">
            KAHOOT MODU
          </h1>
          <p className="text-xl text-white/80 font-medium">
            {categoryName} - {totalQuestions} Soru
          </p>
        </div>

        {/* Countdown */}
        <div className="relative">
          <div className="w-40 h-40 mx-auto rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="text-8xl font-black text-white lobby-pulse">
              {lobbyCountdown}
            </span>
          </div>

          {/* Animated ring */}
          <svg className="absolute inset-0 w-40 h-40 mx-auto" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="4"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - lobbyCountdown / 5)}`}
              className="transition-all duration-1000 ease-linear"
              transform="rotate(-90 50 50)"
            />
          </svg>
        </div>

        {/* Tips */}
        <div className="space-y-2 text-white/70">
          <p className="text-sm">🏆 Hizli cevapla daha cok puan kazan!</p>
          <p className="text-sm">🔥 Seri bonusu ile puanini katla!</p>
          <p className="text-sm">⚡ Power-up'lari akilli kullan!</p>
        </div>
      </div>
    </div>
  );
}
