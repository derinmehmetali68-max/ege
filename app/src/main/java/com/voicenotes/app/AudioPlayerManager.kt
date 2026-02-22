package com.voicenotes.app

import android.media.MediaPlayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

class AudioPlayerManager {

    private var mediaPlayer: MediaPlayer? = null

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying

    private val _currentPosition = MutableStateFlow(0)
    val currentPosition: StateFlow<Int> = _currentPosition

    private val _duration = MutableStateFlow(0)
    val duration: StateFlow<Int> = _duration

    var onCompletion: (() -> Unit)? = null

    fun playFile(filePath: String) {
        stop()

        if (!File(filePath).exists()) return

        mediaPlayer = MediaPlayer().apply {
            setDataSource(filePath)
            prepare()
            start()

            _duration.value = duration
            _isPlaying.value = true

            setOnCompletionListener {
                _isPlaying.value = false
                _currentPosition.value = 0
                onCompletion?.invoke()
            }
        }
    }

    fun pause() {
        mediaPlayer?.let {
            if (it.isPlaying) {
                it.pause()
                _isPlaying.value = false
            }
        }
    }

    fun resume() {
        mediaPlayer?.let {
            it.start()
            _isPlaying.value = true
        }
    }

    fun stop() {
        mediaPlayer?.let {
            try {
                if (it.isPlaying) it.stop()
                it.release()
            } catch (_: Exception) {}
        }
        mediaPlayer = null
        _isPlaying.value = false
        _currentPosition.value = 0
    }

    fun seekTo(position: Int) {
        mediaPlayer?.seekTo(position)
        _currentPosition.value = position
    }

    fun updatePosition() {
        mediaPlayer?.let {
            try {
                if (it.isPlaying) {
                    _currentPosition.value = it.currentPosition
                }
            } catch (_: Exception) {}
        }
    }

    fun release() {
        stop()
    }
}
