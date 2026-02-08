import { useQuiz } from "../../context/QuizContext";

const OPTION_COLORS: Record<string, string> = {
  A: "bg-red-500",
  B: "bg-blue-500",
  C: "bg-yellow-500",
  D: "bg-green-500",
  E: "bg-purple-500",
};

export default function AnswerDistribution() {
  const { state, kahootDismissDistribution, goNext } = useQuiz();
  const { showAnswerDistribution, enabled } = state.kahoot;

  const question = state.sessionQuestions[state.currentIndex];
  const answer = question ? state.answers[question.id] : undefined;
  const isLast = state.currentIndex >= state.sessionQuestions.length - 1;

  if (!enabled || !showAnswerDistribution || !question || !answer) return null;

  // Simulate distribution (since single player, just show the user's answer)
  const options = question.options;
  const correctOpt = question.correctAnswer;
  const userOpt = answer.selectedAnswer;

  const handleNext = () => {
    kahootDismissDistribution();
    if (!isLast) {
      goNext();
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white">
          Cevap Dagilimi
        </h3>

        {/* Bars */}
        <div className="space-y-3">
          {options.map((opt) => {
            const isCorrect = opt === correctOpt;
            const isUserAnswer = opt === userOpt;
            // Simulated percentage: correct option gets more
            const pct = isCorrect ? 100 : isUserAnswer && !isCorrect ? 60 : 20;
            const barColor = OPTION_COLORS[opt] || "bg-gray-500";

            return (
              <div key={opt} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    {opt}
                    {isCorrect && <span className="text-green-500">✓</span>}
                    {isUserAnswer && !isCorrect && <span className="text-red-500">✗</span>}
                    {isUserAnswer && <span className="text-xs text-gray-400">(senin cevabin)</span>}
                  </span>
                </div>
                <div className="w-full h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                    style={{ width: `${pct}%` }}
                  >
                    <span className="text-white text-xs font-bold">
                      {isUserAnswer ? "Sen" : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Points info */}
        {answer.isCorrect && (answer.kahootPoints || 0) > 0 && (
          <div className="text-center">
            <span className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black text-lg px-4 py-2 rounded-full">
              +{answer.kahootPoints} puan kazandin!
            </span>
          </div>
        )}

        {/* Time info */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Cevap suresi: {answer.timeSpent} saniye
        </p>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-lg"
        >
          {isLast ? "Sonuclari Gor" : "Sonraki Soru →"}
        </button>
      </div>
    </div>
  );
}
