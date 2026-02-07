import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Trash2,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";
import { useQuiz } from "../context/QuizContext";

export default function StatsPage() {
  const navigate = useNavigate();
  const { state, resetStats } = useQuiz();
  const { userStats, categories, questions } = state;

  const handleReset = () => {
    if (
      window.confirm(
        "Tüm istatistikleri sıfırlamak istediğinize emin misiniz?"
      )
    ) {
      resetStats();
    }
  };

  const overall =
    userStats.totalQuestionsSolved > 0
      ? Math.round(
          (userStats.totalCorrect / userStats.totalQuestionsSolved) * 100
        )
      : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            İstatistikler
          </h1>
        </div>
      </div>

      {userStats.totalQuestionsSolved === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Henüz soru çözmediniz.</p>
          <p className="text-gray-400 text-sm mt-1">
            Soru çözdükçe istatistikleriniz burada görünecek.
          </p>
        </div>
      ) : (
        <>
          {/* Overall stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-3xl font-bold text-gray-900">
                {userStats.totalQuestionsSolved}
              </p>
              <p className="text-xs text-gray-500 mt-1">Toplam Çözülen</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-3xl font-bold text-green-600">
                {userStats.totalCorrect}
              </p>
              <p className="text-xs text-gray-500 mt-1">Doğru</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-3xl font-bold text-red-600">
                {userStats.totalIncorrect}
              </p>
              <p className="text-xs text-gray-500 mt-1">Yanlış</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">%{overall}</p>
              <p className="text-xs text-gray-500 mt-1">Başarı</p>
            </div>
          </div>

          {/* Per-category breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Ders Bazlı Performans
            </h3>
            <div className="space-y-4">
              {categories.map((cat) => {
                const cs = userStats.categoryStats[cat.id];
                const catQuestionCount = questions.filter(
                  (q) => q.categoryId === cat.id
                ).length;
                if (!cs && catQuestionCount === 0) return null;

                const pct =
                  cs && cs.solved > 0
                    ? Math.round((cs.correct / cs.solved) * 100)
                    : 0;

                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {cat.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {cs ? `${cs.correct}/${cs.solved}` : "0/0"} - %{pct}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          <div className="text-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              İstatistikleri Sıfırla
            </button>
          </div>
        </>
      )}
    </div>
  );
}
