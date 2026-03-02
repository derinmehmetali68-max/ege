import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Trash2,
  ArrowLeft,
  TrendingUp,
  Clock,
  Calendar,
} from "lucide-react";
import { useQuiz } from "../context/QuizContext";
import { useToast } from "../context/ToastContext";

export default function StatsPage() {
  const navigate = useNavigate();
  const { state, resetStats } = useQuiz();
  const { toast } = useToast();
  const { userStats, categories, questions } = state;

  const handleReset = () => {
    if (
      window.confirm(
        "Tum istatistikleri sifirlamak istediginize emin misiniz?"
      )
    ) {
      resetStats();
      toast("Istatistikler sifirlandi", "success");
    }
  };

  const overall =
    userStats.totalQuestionsSolved > 0
      ? Math.round(
          (userStats.totalCorrect / userStats.totalQuestionsSolved) * 100
        )
      : 0;

  const sessionHistory = userStats.sessionHistory || [];
  const last10Sessions = sessionHistory.slice(0, 10);
  const last20Sessions = sessionHistory.slice(0, 20);

  const maxPct = last10Sessions.length > 0
    ? Math.max(...last10Sessions.map((s) => s.percentage), 1)
    : 100;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (secs: number) => {
    if (!secs) return "-";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Karisik";
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Istatistikler
          </h1>
        </div>
      </div>

      {userStats.totalQuestionsSolved === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">Henuz soru cozmediniz.</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Soru cozdukce istatistikleriniz burada gorunecek.
          </p>
        </div>
      ) : (
        <>
          {/* Overall stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {userStats.totalQuestionsSolved}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Toplam Cozulen</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {userStats.totalCorrect}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Dogru</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {userStats.totalIncorrect}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Yanlis</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">%{overall}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Basari</p>
            </div>
          </div>

          {/* Bar chart - Last 10 sessions percentage */}
          {last10Sessions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Son 10 Oturum - Basari Orani (%)
              </h3>
              <div className="flex items-end gap-2 h-40">
                {[...last10Sessions].reverse().map((session) => {
                  const heightPct = maxPct > 0 ? (session.percentage / maxPct) * 100 : 0;
                  const barColor =
                    session.percentage >= 70
                      ? "bg-green-500 dark:bg-green-400"
                      : session.percentage >= 40
                        ? "bg-yellow-500 dark:bg-yellow-400"
                        : "bg-red-500 dark:bg-red-400";
                  return (
                    <div
                      key={session.id}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                      title={`${getCategoryName(session.categoryId)} - %${session.percentage}`}
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        %{session.percentage}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${barColor} transition-all duration-500 min-h-[4px]`}
                        style={{ height: `${Math.max(heightPct, 3)}%` }}
                      />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate w-full text-center">
                        {getCategoryName(session.categoryId).substring(0, 4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Net score trend */}
          {last10Sessions.length > 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Net Puan Trendi
              </h3>
              <div className="flex items-end gap-2 h-32">
                {(() => {
                  const reversed = [...last10Sessions].reverse();
                  const nets = reversed.map((s) => s.netScore);
                  const minNet = Math.min(...nets, 0);
                  const maxNet = Math.max(...nets, 1);
                  const range = maxNet - minNet || 1;

                  return reversed.map((session) => {
                    const normalizedHeight = ((session.netScore - minNet) / range) * 100;
                    return (
                      <div
                        key={session.id}
                        className="flex-1 flex flex-col items-center justify-end h-full"
                        title={`Net: ${session.netScore.toFixed(2)}`}
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {session.netScore.toFixed(1)}
                        </span>
                        <div
                          className="w-full rounded-t-md bg-blue-500 dark:bg-blue-400 transition-all duration-500 min-h-[4px]"
                          style={{ height: `${Math.max(normalizedHeight, 3)}%` }}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Per-category breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Ders Bazli Performans
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
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {cat.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cs ? `${cs.correct}/${cs.solved}` : "0/0"} - %{pct}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session history table */}
          {last20Sessions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Oturum Gecmisi (Son {last20Sessions.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                        Tarih
                      </th>
                      <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                        Kategori
                      </th>
                      <th className="text-center py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                        D/Y/T
                      </th>
                      <th className="text-center py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                        Net
                      </th>
                      <th className="text-center py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                        %
                      </th>
                      <th className="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">
                        <Clock className="w-3.5 h-3.5 inline" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {last20Sessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(session.date)}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">
                          {getCategoryName(session.categoryId)}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {session.correct}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500">/</span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {session.incorrect}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500">/</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {session.total}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-center font-medium text-blue-600 dark:text-blue-400">
                          {session.netScore.toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              session.percentage >= 70
                                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                                : session.percentage >= 40
                                  ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"
                                  : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                            }`}
                          >
                            %{session.percentage}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-gray-500 dark:text-gray-400">
                          {formatTime(session.timeSpent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="text-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Istatistikleri Sifirla
            </button>
          </div>
        </>
      )}
    </div>
  );
}
