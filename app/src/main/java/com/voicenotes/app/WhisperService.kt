package com.voicenotes.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Whisper AI speech-to-text service.
 * Uses OpenAI Whisper API for transcription.
 */
class WhisperService(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * Transcribe an audio file using OpenAI Whisper API.
     *
     * @param audioFilePath Path to the audio file
     * @param language Language code (default: "tr" for Turkish)
     * @return Transcribed text
     */
    suspend fun transcribe(
        audioFilePath: String,
        language: String = "tr"
    ): TranscriptionResult = withContext(Dispatchers.IO) {
        val apiKey = getApiKey()
        if (apiKey.isBlank()) {
            return@withContext TranscriptionResult(
                success = false,
                text = "",
                error = "API anahtarı ayarlanmamış. Ayarlar'dan OpenAI API anahtarınızı girin."
            )
        }

        val audioFile = File(audioFilePath)
        if (!audioFile.exists()) {
            return@withContext TranscriptionResult(
                success = false,
                text = "",
                error = "Ses dosyası bulunamadı."
            )
        }

        try {
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file",
                    audioFile.name,
                    audioFile.asRequestBody("audio/m4a".toMediaType())
                )
                .addFormDataPart("model", "whisper-1")
                .addFormDataPart("language", language)
                .addFormDataPart("response_format", "json")
                .build()

            val request = Request.Builder()
                .url(WHISPER_API_URL)
                .addHeader("Authorization", "Bearer $apiKey")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (response.isSuccessful) {
                val json = JSONObject(responseBody)
                val text = json.optString("text", "")
                TranscriptionResult(
                    success = true,
                    text = text,
                    error = null
                )
            } else {
                val errorJson = try {
                    JSONObject(responseBody)
                } catch (_: Exception) {
                    null
                }
                val errorMessage = errorJson?.optJSONObject("error")?.optString("message")
                    ?: "Sunucu hatası: ${response.code}"
                TranscriptionResult(
                    success = false,
                    text = "",
                    error = errorMessage
                )
            }
        } catch (e: IOException) {
            TranscriptionResult(
                success = false,
                text = "",
                error = "Ağ hatası: ${e.localizedMessage}"
            )
        } catch (e: Exception) {
            TranscriptionResult(
                success = false,
                text = "",
                error = "Beklenmeyen hata: ${e.localizedMessage}"
            )
        }
    }

    private fun getApiKey(): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_OPENAI_API_KEY, "") ?: ""
    }

    fun setApiKey(apiKey: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_OPENAI_API_KEY, apiKey).apply()
    }

    fun hasApiKey(): Boolean {
        return getApiKey().isNotBlank()
    }

    data class TranscriptionResult(
        val success: Boolean,
        val text: String,
        val error: String?
    )

    companion object {
        private const val WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions"
        private const val PREFS_NAME = "voice_notes_prefs"
        private const val KEY_OPENAI_API_KEY = "openai_api_key"
    }
}
