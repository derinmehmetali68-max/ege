import { useQuiz } from "../../context/QuizContext";

export default function QuestionGrid() {
  const { state, goToQuestion } = useQuiz();

  const getColor = (index: number) => {
    const q = state.sessionQuestions[index];
    if (!q) return "bg-gray-100 text-gray-500";
    const answer = state.answers[q.id];
    if (index === state.currentIndex) return "bg-blue-600 text-white ring-2 ring-blue-300";
    if (!answer) return "bg-gray-100 text-gray-600 hover:bg-gray-200";
    if (answer.isCorrect) return "bg-green-500 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Soru Haritası</h3>
      <div className="grid grid-cols-5 gap-2">
        {state.sessionQuestions.map((_, i) => (
          <button
            key={i}
            onClick={() => goToQuestion(i)}
            className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${getColor(i)}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Doğru
          <span className="w-3 h-3 rounded bg-red-500 inline-block ml-2" /> Yanlış
          <span className="w-3 h-3 rounded bg-gray-100 inline-block ml-2" /> Boş
        </div>
      </div>
    </div>
  );
}
