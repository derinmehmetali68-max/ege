package com.voicenotes.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Local Whisper speech-to-text service.
 * Uses whisper.cpp via JNI for on-device transcription.
 * No internet or API key required.
 */
class WhisperService(private val context: Context) {

    private val whisperLib = WhisperLib()
    private var contextPtr: Long = 0
    private var isModelLoaded = false

    /**
     * Load the Whisper model from disk.
     * Must be called before transcription.
     */
    suspend fun loadModel(): Boolean = withContext(Dispatchers.IO) {
        if (isModelLoaded && contextPtr != 0L) {
            return@withContext true
        }

        val modelPath = ModelManager.getModelPath(context)
        if (modelPath == null || !java.io.File(modelPath).exists()) {
            Log.e(TAG, "Model file not found")
            return@withContext false
        }

        Log.i(TAG, "Loading model from: $modelPath")
        contextPtr = whisperLib.initModel(modelPath)

        if (contextPtr == 0L) {
            Log.e(TAG, "Failed to load model")
            isModelLoaded = false
            return@withContext false
        }

        Log.i(TAG, "Model loaded successfully (ptr=$contextPtr)")
        isModelLoaded = true
        return@withContext true
    }

    /**
     * Transcribe a WAV file (must be 16kHz, 16-bit, mono PCM).
     * Use AudioConverter to convert M4A/other formats first.
     *
     * @param wavFilePath Path to WAV file
     * @param language Language code (default: "tr" for Turkish)
     * @return TranscriptionResult with success/failure and text
     */
    suspend fun transcribe(
        wavFilePath: String,
        language: String = "tr"
    ): TranscriptionResult = withContext(Dispatchers.IO) {
        if (!isModelLoaded || contextPtr == 0L) {
            val loaded = loadModel()
            if (!loaded) {
                return@withContext TranscriptionResult(
                    success = false,
                    text = "",
                    error = "Whisper modeli yüklenemedi. Lütfen Ayarlar'dan modeli indirin."
                )
            }
        }

        val file = java.io.File(wavFilePath)
        if (!file.exists()) {
            return@withContext TranscriptionResult(
                success = false,
                text = "",
                error = "Ses dosyası bulunamadı."
            )
        }

        try {
            Log.i(TAG, "Starting transcription: $wavFilePath")
            val numThreads = getOptimalThreadCount()
            val result = whisperLib.transcribeFile(contextPtr, wavFilePath, language, numThreads)

            if (result.startsWith("[HATA:")) {
                Log.e(TAG, "Transcription error: $result")
                TranscriptionResult(
                    success = false,
                    text = "",
                    error = result.removePrefix("[HATA: ").removeSuffix("]")
                )
            } else {
                val cleanedText = result.trim()
                Log.i(TAG, "Transcription success: ${cleanedText.take(100)}")
                TranscriptionResult(
                    success = true,
                    text = cleanedText,
                    error = null
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Transcription exception", e)
            TranscriptionResult(
                success = false,
                text = "",
                error = "Çeviri hatası: ${e.localizedMessage}"
            )
        }
    }

    /**
     * Transcribe from raw float PCM data.
     * @param pcmData Float array at 16kHz mono
     * @param language Language code
     */
    suspend fun transcribeBuffer(
        pcmData: FloatArray,
        language: String = "tr"
    ): TranscriptionResult = withContext(Dispatchers.IO) {
        if (!isModelLoaded || contextPtr == 0L) {
            val loaded = loadModel()
            if (!loaded) {
                return@withContext TranscriptionResult(
                    success = false,
                    text = "",
                    error = "Model yüklenemedi."
                )
            }
        }

        try {
            val numThreads = getOptimalThreadCount()
            val result = whisperLib.transcribeBuffer(contextPtr, pcmData, language, numThreads)

            if (result.startsWith("[HATA:")) {
                TranscriptionResult(false, "", result)
            } else {
                TranscriptionResult(true, result.trim(), null)
            }
        } catch (e: Exception) {
            TranscriptionResult(false, "", "Çeviri hatası: ${e.localizedMessage}")
        }
    }

    fun isReady(): Boolean = isModelLoaded && contextPtr != 0L

    fun getSystemInfo(): String {
        return try {
            whisperLib.getSystemInfo()
        } catch (e: Exception) {
            "N/A"
        }
    }

    fun release() {
        if (contextPtr != 0L) {
            whisperLib.freeModel(contextPtr)
            contextPtr = 0
            isModelLoaded = false
            Log.i(TAG, "Model released")
        }
    }

    private fun getOptimalThreadCount(): Int {
        val cores = Runtime.getRuntime().availableProcessors()
        return cores.coerceIn(2, 8)
    }

    data class TranscriptionResult(
        val success: Boolean,
        val text: String,
        val error: String?
    )

    companion object {
        private const val TAG = "WhisperService"
    }
}
