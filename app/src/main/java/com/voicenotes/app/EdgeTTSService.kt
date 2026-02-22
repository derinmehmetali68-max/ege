package com.voicenotes.app

import android.content.Context
import android.media.MediaPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.*
import okio.ByteString
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

/**
 * Edge TTS Service - Microsoft Edge Text-to-Speech
 * Uses WebSocket protocol to synthesize speech.
 * Default voice: tr-TR-AhmetNeural (Turkish male)
 */
class EdgeTTSService(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private var mediaPlayer: MediaPlayer? = null
    private var currentWebSocket: WebSocket? = null

    var onSpeakingStarted: (() -> Unit)? = null
    var onSpeakingFinished: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    /**
     * Synthesize text to speech and play it.
     *
     * @param text Text to speak
     * @param voice Voice name (default: tr-TR-AhmetNeural)
     * @param rate Speech rate (default: +0%)
     * @param volume Speech volume (default: +0%)
     * @param pitch Speech pitch (default: +0Hz)
     */
    suspend fun speak(
        text: String,
        voice: String = DEFAULT_VOICE,
        rate: String = "+0%",
        volume: String = "+0%",
        pitch: String = "+0Hz"
    ) = withContext(Dispatchers.IO) {
        try {
            stopSpeaking()

            val audioData = synthesize(text, voice, rate, volume, pitch)
            if (audioData != null && audioData.isNotEmpty()) {
                val tempFile = saveTempAudio(audioData)
                playAudioFile(tempFile)
            } else {
                withContext(Dispatchers.Main) {
                    onError?.invoke("Ses sentezi başarısız oldu.")
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                onError?.invoke("TTS Hatası: ${e.localizedMessage}")
            }
        }
    }

    /**
     * Synthesize text to audio data using Edge TTS WebSocket protocol.
     */
    suspend fun synthesize(
        text: String,
        voice: String = DEFAULT_VOICE,
        rate: String = "+0%",
        volume: String = "+0%",
        pitch: String = "+0Hz"
    ): ByteArray? = withContext(Dispatchers.IO) {
        suspendCancellableCoroutine { continuation ->
            val audioChunks = mutableListOf<ByteArray>()
            val requestId = UUID.randomUUID().toString().replace("-", "")
            val timestamp = SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss 'GMT'Z", Locale.US)
                .format(Date())

            val wsUrl = buildWsUrl()

            val request = Request.Builder()
                .url(wsUrl)
                .addHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                .addHeader("User-Agent", USER_AGENT)
                .build()

            val listener = object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    // Send speech config
                    val configMessage = buildConfigMessage(timestamp)
                    webSocket.send(configMessage)

                    // Send SSML synthesis request
                    val ssmlMessage = buildSSMLMessage(
                        requestId, text, voice, rate, volume, pitch
                    )
                    webSocket.send(ssmlMessage)
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    if (text.contains("turn.end")) {
                        webSocket.close(1000, "Done")
                        if (continuation.isActive) {
                            val result = mergeAudioChunks(audioChunks)
                            continuation.resume(result)
                        }
                    }
                }

                override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                    // Extract audio data from binary message
                    val data = bytes.toByteArray()
                    val headerEnd = findHeaderEnd(data)
                    if (headerEnd >= 0 && headerEnd < data.size) {
                        val audioData = data.copyOfRange(headerEnd, data.size)
                        if (audioData.isNotEmpty()) {
                            audioChunks.add(audioData)
                        }
                    }
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    if (continuation.isActive) {
                        continuation.resume(null)
                    }
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    if (continuation.isActive) {
                        val result = mergeAudioChunks(audioChunks)
                        continuation.resume(result)
                    }
                }
            }

            val webSocket = client.newWebSocket(request, listener)
            currentWebSocket = webSocket

            continuation.invokeOnCancellation {
                webSocket.cancel()
            }
        }
    }

    /**
     * Save synthesized audio to a file and return the path.
     */
    suspend fun synthesizeToFile(
        text: String,
        voice: String = DEFAULT_VOICE,
        rate: String = "+0%",
        volume: String = "+0%",
        pitch: String = "+0Hz"
    ): String? = withContext(Dispatchers.IO) {
        val audioData = synthesize(text, voice, rate, volume, pitch)
        if (audioData != null && audioData.isNotEmpty()) {
            saveTempAudio(audioData)
        } else {
            null
        }
    }

    fun stopSpeaking() {
        currentWebSocket?.cancel()
        currentWebSocket = null
        mediaPlayer?.let {
            try {
                if (it.isPlaying) it.stop()
                it.release()
            } catch (_: Exception) {}
        }
        mediaPlayer = null
    }

    fun isSpeaking(): Boolean {
        return mediaPlayer?.isPlaying == true
    }

    fun release() {
        stopSpeaking()
    }

    // --- Private helpers ---

    private fun buildWsUrl(): String {
        val connectionId = UUID.randomUUID().toString().replace("-", "")
        return "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1" +
                "?TrustedClientToken=$TRUSTED_CLIENT_TOKEN" +
                "&ConnectionId=$connectionId"
    }

    private fun buildConfigMessage(timestamp: String): String {
        return "X-Timestamp:$timestamp\r\n" +
                "Content-Type:application/json; charset=utf-8\r\n" +
                "Path:speech.config\r\n\r\n" +
                """{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}"""
    }

    private fun buildSSMLMessage(
        requestId: String,
        text: String,
        voice: String,
        rate: String,
        volume: String,
        pitch: String
    ): String {
        val escapedText = text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;")

        val ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'>" +
                "<voice name='$voice'>" +
                "<prosody pitch='$pitch' rate='$rate' volume='$volume'>" +
                escapedText +
                "</prosody>" +
                "</voice>" +
                "</speak>"

        return "X-RequestId:$requestId\r\n" +
                "Content-Type:application/ssml+xml\r\n" +
                "X-Timestamp:${SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss 'GMT'Z", Locale.US).format(Date())}\r\n" +
                "Path:ssml\r\n\r\n" +
                ssml
    }

    private fun findHeaderEnd(data: ByteArray): Int {
        // Look for "Path:audio\r\n" header end marker
        val searchStr = "Path:audio\r\n"
        val searchBytes = searchStr.toByteArray()

        for (i in 0..data.size - searchBytes.size) {
            var found = true
            for (j in searchBytes.indices) {
                if (data[i + j] != searchBytes[j]) {
                    found = false
                    break
                }
            }
            if (found) {
                return i + searchBytes.size
            }
        }

        // Fallback: skip first 2 bytes (header length) + header
        if (data.size > 2) {
            val headerLen = ((data[0].toInt() and 0xFF) shl 8) or (data[1].toInt() and 0xFF)
            return 2 + headerLen
        }

        return -1
    }

    private fun mergeAudioChunks(chunks: List<ByteArray>): ByteArray {
        val totalSize = chunks.sumOf { it.size }
        val result = ByteArray(totalSize)
        var offset = 0
        for (chunk in chunks) {
            System.arraycopy(chunk, 0, result, offset, chunk.size)
            offset += chunk.size
        }
        return result
    }

    private fun saveTempAudio(audioData: ByteArray): String {
        val cacheDir = File(context.cacheDir, "tts")
        if (!cacheDir.exists()) cacheDir.mkdirs()

        val file = File(cacheDir, "tts_${System.currentTimeMillis()}.mp3")
        FileOutputStream(file).use { it.write(audioData) }
        return file.absolutePath
    }

    private suspend fun playAudioFile(filePath: String) {
        withContext(Dispatchers.Main) {
            onSpeakingStarted?.invoke()
        }

        withContext(Dispatchers.Main) {
            try {
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(filePath)
                    prepare()
                    start()
                    setOnCompletionListener {
                        onSpeakingFinished?.invoke()
                        it.release()
                        mediaPlayer = null
                        // Clean up temp file
                        File(filePath).delete()
                    }
                }
            } catch (e: Exception) {
                onError?.invoke("Ses çalma hatası: ${e.localizedMessage}")
            }
        }
    }

    companion object {
        const val DEFAULT_VOICE = "tr-TR-AhmetNeural"
        const val VOICE_FEMALE = "tr-TR-EmelNeural"
        private const val TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
        private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"

        val AVAILABLE_VOICES = mapOf(
            "Ahmet (Erkek)" to "tr-TR-AhmetNeural",
            "Emel (Kadın)" to "tr-TR-EmelNeural"
        )
    }
}
