package com.voicenotes.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/**
 * Manages Whisper GGML model files.
 * Downloads models from Hugging Face and stores them locally.
 */
object ModelManager {

    private const val TAG = "ModelManager"
    private const val MODELS_DIR = "whisper_models"

    // Available models with sizes
    enum class WhisperModel(
        val displayName: String,
        val fileName: String,
        val url: String,
        val sizeDescription: String,
        val sizeBytes: Long
    ) {
        TINY(
            displayName = "Tiny (Hızlı, Düşük Kalite)",
            fileName = "ggml-tiny.bin",
            url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
            sizeDescription = "~75 MB",
            sizeBytes = 75_000_000
        ),
        BASE(
            displayName = "Base (Dengeli)",
            fileName = "ggml-base.bin",
            url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
            sizeDescription = "~142 MB",
            sizeBytes = 142_000_000
        ),
        SMALL(
            displayName = "Small (Yüksek Kalite, Yavaş)",
            fileName = "ggml-small.bin",
            url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            sizeDescription = "~466 MB",
            sizeBytes = 466_000_000
        );
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    /**
     * Get the path to the currently selected model.
     * Returns null if no model is downloaded.
     */
    fun getModelPath(context: Context): String? {
        val prefs = context.getSharedPreferences("voice_notes_prefs", Context.MODE_PRIVATE)
        val modelName = prefs.getString("whisper_model", WhisperModel.BASE.fileName)
            ?: WhisperModel.BASE.fileName

        val modelFile = File(getModelsDir(context), modelName)
        return if (modelFile.exists()) modelFile.absolutePath else null
    }

    /**
     * Check if any model is downloaded.
     */
    fun isModelDownloaded(context: Context): Boolean {
        return getModelPath(context) != null
    }

    /**
     * Check if a specific model is downloaded.
     */
    fun isModelDownloaded(context: Context, model: WhisperModel): Boolean {
        val modelFile = File(getModelsDir(context), model.fileName)
        return modelFile.exists() && modelFile.length() > 1_000_000
    }

    /**
     * Get the currently selected model type.
     */
    fun getSelectedModel(context: Context): WhisperModel {
        val prefs = context.getSharedPreferences("voice_notes_prefs", Context.MODE_PRIVATE)
        val modelName = prefs.getString("whisper_model", WhisperModel.BASE.fileName)
        return WhisperModel.entries.find { it.fileName == modelName } ?: WhisperModel.BASE
    }

    /**
     * Set the selected model.
     */
    fun setSelectedModel(context: Context, model: WhisperModel) {
        context.getSharedPreferences("voice_notes_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("whisper_model", model.fileName)
            .apply()
    }

    /**
     * Download a model file with progress callback.
     *
     * @param context Android context
     * @param model Model to download
     * @param onProgress Callback with (bytesDownloaded, totalBytes)
     * @return true if successful
     */
    suspend fun downloadModel(
        context: Context,
        model: WhisperModel,
        onProgress: ((Long, Long) -> Unit)? = null
    ): DownloadResult = withContext(Dispatchers.IO) {
        val modelsDir = getModelsDir(context)
        if (!modelsDir.exists()) modelsDir.mkdirs()

        val targetFile = File(modelsDir, model.fileName)
        val tempFile = File(modelsDir, "${model.fileName}.tmp")

        Log.i(TAG, "Downloading model: ${model.displayName} from ${model.url}")

        try {
            val request = Request.Builder()
                .url(model.url)
                .build()

            val response = client.newCall(request).execute()

            if (!response.isSuccessful) {
                Log.e(TAG, "Download failed: ${response.code}")
                return@withContext DownloadResult(
                    success = false,
                    error = "İndirme hatası: HTTP ${response.code}"
                )
            }

            val body = response.body ?: return@withContext DownloadResult(
                success = false,
                error = "Boş yanıt alındı."
            )

            val totalBytes = body.contentLength()
            var downloadedBytes = 0L

            body.byteStream().use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int

                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                        downloadedBytes += bytesRead
                        onProgress?.invoke(downloadedBytes, totalBytes)
                    }

                    output.flush()
                }
            }

            // Verify file size
            if (tempFile.length() < 1_000_000) {
                tempFile.delete()
                return@withContext DownloadResult(
                    success = false,
                    error = "İndirilen dosya çok küçük, bozuk olabilir."
                )
            }

            // Rename temp to final
            if (targetFile.exists()) targetFile.delete()
            tempFile.renameTo(targetFile)

            // Save as selected model
            setSelectedModel(context, model)

            Log.i(TAG, "Model downloaded: ${targetFile.absolutePath} (${targetFile.length()} bytes)")

            DownloadResult(success = true, error = null)
        } catch (e: Exception) {
            Log.e(TAG, "Download exception", e)
            tempFile.delete()
            DownloadResult(
                success = false,
                error = "İndirme hatası: ${e.localizedMessage}"
            )
        }
    }

    /**
     * Delete a downloaded model.
     */
    fun deleteModel(context: Context, model: WhisperModel): Boolean {
        val modelFile = File(getModelsDir(context), model.fileName)
        return if (modelFile.exists()) {
            modelFile.delete()
        } else {
            true
        }
    }

    /**
     * Get total size of all downloaded models.
     */
    fun getTotalModelsSize(context: Context): Long {
        val modelsDir = getModelsDir(context)
        if (!modelsDir.exists()) return 0
        return modelsDir.listFiles()?.sumOf { it.length() } ?: 0
    }

    private fun getModelsDir(context: Context): File {
        return File(context.filesDir, MODELS_DIR)
    }

    data class DownloadResult(
        val success: Boolean,
        val error: String?
    )
}
