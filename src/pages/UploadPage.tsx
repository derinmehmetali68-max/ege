import { useState } from "react";
import {
  Upload,
  ImagePlus,
  Trash2,
  Save,
  ChevronDown,
  FileImage,
  Layers,
  X,
} from "lucide-react";
import { useQuiz } from "../context/QuizContext";
import { useToast } from "../context/ToastContext";
import UploadZone from "../components/Upload/UploadZone";
import { generateId } from "../utils/shuffle";
import { addQuestions } from "../utils/storage";
import { saveImage } from "../utils/imageDB";
import { compressImage, computeImageHash } from "../utils/compress";
import type { Question } from "../types";

type UploadMode = "single" | "bulk";

interface PendingQuestion {
  tempId: string;
  file: File;
  preview: string;
  categoryId: string;
  subcategoryId: string;
  correctAnswer: string;
  difficulty: "kolay" | "orta" | "zor";
  examType: string;
}

export default function UploadPage() {
  const { state, setQuestions } = useQuiz();
  const { toast } = useToast();
  const [mode, setMode] = useState<UploadMode>("bulk");
  const [pending, setPending] = useState<PendingQuestion[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkDifficulty, setBulkDifficulty] = useState<"kolay" | "orta" | "zor">("orta");
  const [bulkExamType, setBulkExamType] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedCat = state.categories.find((c) => c.id === bulkCategory);

  const handleFilesSelected = (
    files: { file: File; preview: string; id: string }[]
  ) => {
    const newPending: PendingQuestion[] = files.map((f) => ({
      tempId: f.id,
      file: f.file,
      preview: f.preview,
      categoryId: bulkCategory,
      subcategoryId: bulkSubcategory,
      correctAnswer: "",
      difficulty: bulkDifficulty,
      examType: bulkExamType,
    }));
    setPending(newPending);
  };

  const updatePending = (
    tempId: string,
    field: keyof PendingQuestion,
    value: string
  ) => {
    setPending((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, [field]: value } : p))
    );
  };

  const removePending = (tempId: string) => {
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const applyBulkSettings = () => {
    setPending((prev) =>
      prev.map((p) => ({
        ...p,
        categoryId: bulkCategory || p.categoryId,
        subcategoryId: bulkSubcategory || p.subcategoryId,
        difficulty: bulkDifficulty,
        examType: bulkExamType || p.examType,
      }))
    );
    toast("Ayarlar tum sorulara uygulandi", "info");
  };

  const handleSave = async () => {
    const incomplete = pending.filter(
      (p) => !p.categoryId || !p.correctAnswer
    );
    if (incomplete.length > 0) {
      toast("Tum sorular icin kategori ve dogru cevap secmelisiniz.", "warning");
      return;
    }

    setSaving(true);
    setProgress(0);

    const existingHashes = new Set(
      state.questions
        .map((q) => q.imageHash)
        .filter((h): h is string => !!h)
    );

    const newQuestions: Question[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      setProgress(Math.round(((i + 1) / pending.length) * 100));

      try {
        // Compute hash for duplicate detection
        const hash = await computeImageHash(p.file);
        if (existingHashes.has(hash)) {
          duplicateCount++;
          continue;
        }
        existingHashes.add(hash);

        // Compress image
        const compressedDataUrl = await compressImage(p.file);

        // Save to IndexedDB
        const id = generateId();
        await saveImage(id, compressedDataUrl);

        newQuestions.push({
          id,
          categoryId: p.categoryId,
          subcategoryId: p.subcategoryId,
          imagePath: "",
          imageHash: hash,
          options: ["A", "B", "C", "D", "E"],
          correctAnswer: p.correctAnswer,
          difficulty: p.difficulty,
          examType: p.examType || undefined,
        });
      } catch (err) {
        console.error("Error processing question:", err);
        toast(`Soru isleme hatasi: ${p.file.name}`, "error");
      }
    }

    if (newQuestions.length > 0) {
      const all = addQuestions(newQuestions);
      setQuestions(all);
    }

    setSaving(false);
    setProgress(0);
    setPending([]);

    if (duplicateCount > 0) {
      toast(
        `${newQuestions.length} soru kaydedildi, ${duplicateCount} kopya atildi.`,
        "warning"
      );
    } else {
      toast(`${newQuestions.length} soru basariyla kaydedildi!`, "success");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Soru Yukle</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          PNG formatindaki soru gorsellerini tekli veya toplu olarak yukleyin.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setMode("single");
            setPending([]);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            mode === "single"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
          }`}
        >
          <ImagePlus className="w-4 h-4" />
          Tekli Yukleme
        </button>
        <button
          onClick={() => {
            setMode("bulk");
            setPending([]);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            mode === "bulk"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
          }`}
        >
          <Layers className="w-4 h-4" />
          Toplu Yukleme
        </button>
      </div>

      {/* Bulk settings */}
      {mode === "bulk" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <FileImage className="w-4 h-4" />
            Toplu Ayarlar
            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
              (tum sorulara uygulanir)
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Kategori *
              </label>
              <div className="relative">
                <select
                  value={bulkCategory}
                  onChange={(e) => {
                    setBulkCategory(e.target.value);
                    setBulkSubcategory("");
                  }}
                  className="w-full appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm pr-8 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Secin...</option>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Alt Kategori
              </label>
              <div className="relative">
                <select
                  value={bulkSubcategory}
                  onChange={(e) => setBulkSubcategory(e.target.value)}
                  disabled={!bulkCategory}
                  className="w-full appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm pr-8 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Secin...</option>
                  {selectedCat?.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Zorluk
              </label>
              <div className="relative">
                <select
                  value={bulkDifficulty}
                  onChange={(e) =>
                    setBulkDifficulty(
                      e.target.value as "kolay" | "orta" | "zor"
                    )
                  }
                  className="w-full appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm pr-8 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kolay">Kolay</option>
                  <option value="orta">Orta</option>
                  <option value="zor">Zor</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Sinav Turu
              </label>
              <div className="relative">
                <select
                  value={bulkExamType}
                  onChange={(e) => setBulkExamType(e.target.value)}
                  className="w-full appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm pr-8 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Belirtilmemis</option>
                  <option value="TYT">TYT</option>
                  <option value="AYT">AYT</option>
                  <option value="YKS">YKS</option>
                  <option value="LGS">LGS</option>
                  <option value="KPSS">KPSS</option>
                  <option value="DGS">DGS</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          {pending.length > 0 && (
            <button
              onClick={applyBulkSettings}
              className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              Ayarlari Tum Sorulara Uygula
            </button>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <div className="mb-6">
        <UploadZone
          onFilesSelected={handleFilesSelected}
          multiple={mode === "bulk"}
        />
      </div>

      {/* Progress bar during save */}
      {saving && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Kaydediliyor...
            </span>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              %{progress}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Pending Questions Editor */}
      {pending.length > 0 && !saving && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Yuklenen Sorular ({pending.length})
            </h3>
            <button
              onClick={() => setPending([])}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Tumunu Sil
            </button>
          </div>

          <div className="space-y-3">
            {pending.map((p, index) => (
              <div
                key={p.tempId}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex gap-4">
                  {/* Preview */}
                  <div className="shrink-0">
                    <img
                      src={p.preview}
                      alt={`Soru ${index + 1}`}
                      className="w-40 h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                  </div>

                  {/* Settings */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2 sm:col-span-4">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Soru {index + 1} -{" "}
                        <span className="text-gray-400 dark:text-gray-500 text-xs">
                          {p.file.name}
                        </span>
                      </span>
                    </div>

                    {mode === "single" && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Kategori *
                          </label>
                          <select
                            value={p.categoryId}
                            onChange={(e) =>
                              updatePending(
                                p.tempId,
                                "categoryId",
                                e.target.value
                              )
                            }
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Secin</option>
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
                            value={p.subcategoryId}
                            onChange={(e) =>
                              updatePending(
                                p.tempId,
                                "subcategoryId",
                                e.target.value
                              )
                            }
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Secin</option>
                            {state.categories
                              .find((c) => c.id === p.categoryId)
                              ?.subcategories.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Dogru Cevap *
                      </label>
                      <div className="flex gap-1">
                        {["A", "B", "C", "D", "E"].map((opt) => (
                          <button
                            key={opt}
                            onClick={() =>
                              updatePending(p.tempId, "correctAnswer", opt)
                            }
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                              p.correctAnswer === opt
                                ? "bg-green-500 text-white"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {mode === "single" && (
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Zorluk
                        </label>
                        <select
                          value={p.difficulty}
                          onChange={(e) =>
                            updatePending(
                              p.tempId,
                              "difficulty",
                              e.target.value
                            )
                          }
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="kolay">Kolay</option>
                          <option value="orta">Orta</option>
                          <option value="zor">Zor</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removePending(p.tempId)}
                    className="shrink-0 self-start p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setPending([])}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              Iptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {pending.length} Soruyu Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Current question count */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Toplam kayitli soru:{" "}
            <span className="font-bold text-gray-800 dark:text-white">
              {state.questions.length}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
