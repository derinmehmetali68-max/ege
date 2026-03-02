import { useState, useRef, useCallback, type DragEvent } from "react";
import {
  Upload,
  ImagePlus,
  X,
  CheckCircle,
  AlertCircle,
  FileImage,
} from "lucide-react";

interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

interface UploadZoneProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  multiple?: boolean;
}

export default function UploadZone({
  onFilesSelected,
  multiple = true,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      setError(null);
      const validFiles: UploadedFile[] = [];
      const fileArray = Array.from(fileList);

      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) {
          setError("Sadece resim dosyaları (PNG, JPG) yüklenebilir.");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          setError("Dosya boyutu 10MB'dan büyük olamaz.");
          continue;
        }
        const preview = URL.createObjectURL(file);
        const id =
          Date.now().toString(36) +
          Math.random().toString(36).substring(2, 8);
        validFiles.push({ file, preview, id });
      }

      if (multiple) {
        const updated = [...files, ...validFiles];
        setFiles(updated);
        onFilesSelected(updated);
      } else {
        setFiles(validFiles.slice(0, 1));
        onFilesSelected(validFiles.slice(0, 1));
      }
    },
    [files, multiple, onFilesSelected]
  );

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeFile = (id: string) => {
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    onFilesSelected(updated);
  };

  const clearAll = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    onFilesSelected([]);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-50 scale-[1.02]"
            : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={`p-4 rounded-full ${isDragging ? "bg-blue-100" : "bg-gray-100"}`}
          >
            {isDragging ? (
              <ImagePlus className="w-8 h-8 text-blue-600" />
            ) : (
              <Upload className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">
              {multiple
                ? "PNG dosyalarını sürükleyin veya tıklayın"
                : "PNG dosyası sürükleyin veya tıklayın"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {multiple
                ? "Birden fazla dosya seçebilirsiniz (toplu yükleme)"
                : "Tek bir dosya seçin"}
            </p>
          </div>
          <p className="text-xs text-gray-400">
            PNG, JPG - Maks. 10MB
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                {files.length} dosya seçildi
              </span>
            </div>
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Tümünü Kaldır
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1">
            {files.map((f) => (
              <div
                key={f.id}
                className="relative group bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate">
                    {f.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(f.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {files.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <FileImage className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            {multiple
              ? "Toplu yükleme: Birden fazla PNG dosyası seçerek tüm soruları tek seferde yükleyebilirsiniz."
              : "Tek soru yüklemek için PNG dosyanızı seçin."}
          </p>
        </div>
      )}
    </div>
  );
}
