package com.voicenotes.app

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

class AudioRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var currentFilePath: String? = null
    private var startTime: Long = 0
    var isRecording: Boolean = false
        private set

    fun startRecording(): String {
        val audioDir = File(context.filesDir, "recordings")
        if (!audioDir.exists()) {
            audioDir.mkdirs()
        }

        val fileName = "voice_note_${System.currentTimeMillis()}.m4a"
        val audioFile = File(audioDir, fileName)
        currentFilePath = audioFile.absolutePath

        recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }

        recorder?.apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioSamplingRate(44100)
            setAudioEncodingBitRate(128000)
            setAudioChannels(1)
            setOutputFile(currentFilePath)
            prepare()
            start()
        }

        startTime = System.currentTimeMillis()
        isRecording = true
        return currentFilePath!!
    }

    fun stopRecording(): RecordingResult {
        val duration = System.currentTimeMillis() - startTime
        recorder?.apply {
            stop()
            release()
        }
        recorder = null
        isRecording = false

        return RecordingResult(
            filePath = currentFilePath ?: "",
            durationMs = duration
        )
    }

    fun cancelRecording() {
        recorder?.apply {
            stop()
            release()
        }
        recorder = null
        isRecording = false

        // Delete the file
        currentFilePath?.let { path ->
            File(path).delete()
        }
        currentFilePath = null
    }

    fun getAmplitude(): Int {
        return try {
            recorder?.maxAmplitude ?: 0
        } catch (e: Exception) {
            0
        }
    }

    fun release() {
        try {
            recorder?.release()
        } catch (_: Exception) {}
        recorder = null
        isRecording = false
    }

    data class RecordingResult(
        val filePath: String,
        val durationMs: Long
    )
}
