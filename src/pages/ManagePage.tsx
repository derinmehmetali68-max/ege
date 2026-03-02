import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Settings,
  Trash2,
  Edit3,
  Bookmark,
  ChevronDown,
  Download,
  Upload,
  Search,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useQuiz } from "../context/QuizContext";
import { useToast } from "../context/ToastContext";
import { getImage, exportAllImages, importImages, deleteImage } from "../utils/imageDB";
import { exportData, importData } from "../utils/storage";
import type { Question } from "../types";

interface ThumbnailCache {
  [questionId: string]: string | null;
}

export default function ManagePage() {
  const navigate = useNavigate();
  const { state, setQuestions, toggleBookmark, deleteQuestionById, updateQuestionById } = useQuiz();
  const { toast } = useToast();

  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Question>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<ThumbnailCache>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter questions
  const filtered = state.questions.filter((q) => {
    if (filterCategory && q.categoryId !== filterCategory) return false;
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const catName = state.categories.find((c) => c.id === q.categoryId)?.name || "";
      if (
        !q.id.toLowerCase().includes(term) &&
        !catName.toLowerCase().includes(term) &&
        !q.correctAnswer.toLowerCase().includes(term) &&
        !(q.examType || "").toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  // Load thumbnails for visible questions
  const loadThumbnails = useCallback(async (questions: Question[]) => {
    const toLoad = questions.filter((q) => !(q.id in thumbnails));
    if (toLoad.length === 0) return;

    const newThumbs: ThumbnailCache = {};
    for (const q of toLoad.slice(0, 20)) {
      try {
        const img = await getImage(q.id);
        newThumbs[q.id] = img;
      } catch {
        newThumbs[q.id] = null;
      }
    }
    setThumbnails((prev) => ({ ...prev, ...newThumbs }));
  }, [thumbnails]);

  useEffect(() => {
    loadThumbnails(filtered.slice(0, 20));
  }, [filtered, loadThumbnails]);

  const getCategoryName = (catId: string) => {
    const cat = state.categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  const getSubcategoryName = (catId: string, subId: string) => {
    const cat = state.categories.find((c) => c.id === catId);
    const sub = cat?.subcategories.find((s) => s.id === subId);
    return sub ? sub.name : subId;
  };

  const handleStartEdit = (q: Question) => {
    setEditingId(q.id);
    setEditForm({
      categoryId: q.categoryId,
      subcategoryId: q.subcategoryId,
      difficulty: q.difficulty,
      correctAnswer: q.correctAnswer,
      examType: q.examType || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateQuestionById(editingId, editForm);
    setEditingId(null);
    setEditForm({});
    toast("Soru guncellendi", "success");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteImage(id);
    } catch {
      // Image may not exist, that's ok
    }
    deleteQuestionById(id);
    setDeleteConfirmId(null);
    toast("Soru silindi", "success");
  };

  const handleExport = async () => {
    try {
      toast("Veriler hazirlaniyor...", "info");
      const data = exportData();
      const images = await exportAllImages();
      const exportPayload = {
        ...data,
        images,
        exportedAt: Date.now(),
        version: 1,
      };
      const blob = new Blob([JSON.stringify(exportPayload)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ege-soru-bankasi-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Veriler basariyla disari aktarildi!", "success");
    } catch (err) {
      console.error("Export error:", err);
      toast("Disari aktarma hatasi!", "error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.questions) {
        const merged = importData({ questions: data.questions });
        setQuestions(merged);
      }

      if (data.images && typeof data.images === "object") {
        await importImages(data.images);
      }

      toast(
        `Icerik aktarildi! ${data.questions?.length || 0} soru, ${
          Object.keys(data.images || {}).length
        } gorsel.`,
        "success"
      );
    } catch (err) {
      console.error("Import error:", err);
      toast("Iceri aktarma hatasi! Gecerli bir JSON dosyasi secin.", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const editCat = state.categories.find((c) => c.id === editForm.categoryId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Soru Yonetimi
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {state.questions.length} soru kayitli
            </p>
          </div>
        </div>

        {/* Export / Import */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors border border-green-200 dark:border-green-800"
          >
            <Download className="w-4 h-4" />
            Disa Aktar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? "Aktariliyor..." : "Ice Aktar"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Ara (ID, kategori, cevap, sinav turu)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tum Kategoriler</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tum Zorluklar</option>
            <option value="kolay">Kolay</option>
            <option value="orta">Orta</option>
            <option value="zor">Zor</option>
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
        </div>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} sonuc
        </span>
      </div>

      {/* Questions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Settings className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {state.questions.length === 0
              ? "Henuz soru eklenmemis."
              : "Filtreye uyan soru bulunamadi."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 50).map((q) => {
            const isEditing = editingId === q.id;
            const isDeleting = deleteConfirmId === q.id;
            const thumb = thumbnails[q.id];

            return (
              <div
                key={q.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border transition-all ${
                  isEditing
                    ? "border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800"
                    : "border-gray-200 dark:border-gray-700"
                } p-4`}
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={`Soru`}
                        className="w-24 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-24 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Gorsel yok
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info / Edit */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      /* Edit mode */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Kategori
                            </label>
                            <select
                              value={editForm.categoryId || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  categoryId: e.target.value,
                                  subcategoryId: "",
                                }))
                              }
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {state.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Alt Kategori
                            </label>
                            <select
                              value={editForm.subcategoryId || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  subcategoryId: e.target.value,
                                }))
                              }
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Yok</option>
                              {editCat?.subcategories.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Zorluk
                            </label>
                            <select
                              value={editForm.difficulty || "orta"}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  difficulty: e.target.value as "kolay" | "orta" | "zor",
                                }))
                              }
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="kolay">Kolay</option>
                              <option value="orta">Orta</option>
                              <option value="zor">Zor</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Dogru Cevap
                            </label>
                            <div className="flex gap-1">
                              {["A", "B", "C", "D", "E"].map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() =>
                                    setEditForm((f) => ({
                                      ...f,
                                      correctAnswer: opt,
                                    }))
                                  }
                                  className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                                    editForm.correctAnswer === opt
                                      ? "bg-green-500 text-white"
                                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Sinav Turu
                            </label>
                            <select
                              value={editForm.examType || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  examType: e.target.value || undefined,
                                }))
                              }
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Yok</option>
                              <option value="TYT">TYT</option>
                              <option value="AYT">AYT</option>
                              <option value="YKS">YKS</option>
                              <option value="LGS">LGS</option>
                              <option value="KPSS">KPSS</option>
                              <option value="DGS">DGS</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Kaydet
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Iptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {getCategoryName(q.categoryId)}
                        </span>
                        {q.subcategoryId && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            / {getSubcategoryName(q.categoryId, q.subcategoryId)}
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            q.difficulty === "kolay"
                              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                              : q.difficulty === "orta"
                                ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"
                                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                        </span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                          Cevap: {q.correctAnswer}
                        </span>
                        {q.examType && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                            {q.examType}
                          </span>
                        )}
                        {q.bookmarked && (
                          <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                          {q.id.slice(0, 8)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => toggleBookmark(q.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          q.bookmarked
                            ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-amber-500"
                        }`}
                        title="Isaretle"
                      >
                        <Bookmark
                          className={`w-4 h-4 ${q.bookmarked ? "fill-amber-500" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => handleStartEdit(q)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Duzenle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {isDeleting ? (
                        <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline ml-1"
                          >
                            Iptal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(q.id)}
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length > 50 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ilk 50 soru gosteriliyor. Filtreleri kullanarak daraltabilirsiniz.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
