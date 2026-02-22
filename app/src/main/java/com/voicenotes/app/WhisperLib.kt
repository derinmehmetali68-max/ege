package com.voicenotes.app

/**
 * JNI bridge to whisper.cpp native library.
 * All native methods run on CPU - no GPU required.
 */
class WhisperLib {

    companion object {
        init {
            System.loadLibrary("whisper_jni")
        }
    }

    /**
     * Load a Whisper GGML model from file.
     * @param modelPath Absolute path to the .bin model file
     * @return Native context pointer (0 if failed)
     */
    external fun initModel(modelPath: String): Long

    /**
     * Transcribe a WAV file (16kHz, 16-bit, mono PCM).
     * @param contextPtr Native context pointer from initModel
     * @param audioPath Absolute path to the WAV file
     * @param language Language code (e.g., "tr" for Turkish)
     * @param numThreads Number of CPU threads to use
     * @return Transcribed text
     */
    external fun transcribeFile(
        contextPtr: Long,
        audioPath: String,
        language: String,
        numThreads: Int
    ): String

    /**
     * Transcribe from float PCM buffer (16kHz, mono).
     * @param contextPtr Native context pointer from initModel
     * @param audioData Float array of PCM samples [-1.0, 1.0]
     * @param language Language code
     * @param numThreads Number of CPU threads
     * @return Transcribed text
     */
    external fun transcribeBuffer(
        contextPtr: Long,
        audioData: FloatArray,
        language: String,
        numThreads: Int
    ): String

    /**
     * Free the loaded model and release memory.
     * @param contextPtr Native context pointer
     */
    external fun freeModel(contextPtr: Long)

    /**
     * Get whisper.cpp system info string.
     */
    external fun getSystemInfo(): String
}
