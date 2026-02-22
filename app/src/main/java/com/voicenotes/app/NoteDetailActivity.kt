package com.voicenotes.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.SeekBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.voicenotes.app.databinding.ActivityNoteDetailBinding
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class NoteDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityNoteDetailBinding
    private lateinit var audioPlayerManager: AudioPlayerManager
    private lateinit var edgeTTSService: EdgeTTSService
    private lateinit var whisperService: WhisperService

    private val noteDao by lazy { VoiceNotesApp.instance.database.noteDao() }
    private var currentNote: Note? = null
    private var noteId: Long = -1

    private val seekBarHandler = Handler(Looper.getMainLooper())
    private val updateSeekBar = object : Runnable {
        override fun run() {
            audioPlayerManager.updatePosition()
            binding.audioSeekBar.progress = audioPlayerManager.currentPosition.value
            seekBarHandler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNoteDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        noteId = intent.getLongExtra("note_id", -1)
        if (noteId == -1L) {
            finish()
            return
        }

        audioPlayerManager = AudioPlayerManager()
        edgeTTSService = EdgeTTSService(this)
        whisperService = WhisperService(this)

        setupToolbar()
        setupAudioPlayer()
        setupButtons()
        setupTTSCallbacks()
        loadNote()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_delete -> {
                    showDeleteDialog()
                    true
                }
                R.id.action_share -> {
                    shareNote()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupAudioPlayer() {
        audioPlayerManager.onCompletion = {
            runOnUiThread {
                binding.btnPlayPause.setImageResource(android.R.drawable.ic_media_play)
                seekBarHandler.removeCallbacks(updateSeekBar)
            }
        }

        binding.btnPlayPause.setOnClickListener {
            if (audioPlayerManager.isPlaying.value) {
                audioPlayerManager.pause()
                binding.btnPlayPause.setImageResource(android.R.drawable.ic_media_play)
                seekBarHandler.removeCallbacks(updateSeekBar)
            } else {
                val path = currentNote?.audioFilePath ?: return@setOnClickListener
                if (audioPlayerManager.currentPosition.value > 0) {
                    audioPlayerManager.resume()
                } else {
                    audioPlayerManager.playFile(path)
                    binding.audioSeekBar.max = audioPlayerManager.duration.value
                }
                binding.btnPlayPause.setImageResource(android.R.drawable.ic_media_pause)
                seekBarHandler.post(updateSeekBar)
            }
        }

        binding.audioSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    audioPlayerManager.seekTo(progress)
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
    }

    private fun setupButtons() {
        binding.btnSave.setOnClickListener {
            saveNote()
        }

        binding.btnSpeak.setOnClickListener {
            val text = binding.editContent.text?.toString() ?: ""
            if (text.isBlank()) {
                Toast.makeText(this, "Seslendirilecek metin yok", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (edgeTTSService.isSpeaking()) {
                edgeTTSService.stopSpeaking()
                binding.btnSpeak.text = getString(R.string.speak_text)
            } else {
                val voice = getSelectedVoice()
                val rate = getSpeechRate()
                lifecycleScope.launch {
                    edgeTTSService.speak(text, voice = voice, rate = rate)
                }
            }
        }

        binding.btnRetranscribe.setOnClickListener {
            retranscribe()
        }
    }

    private fun setupTTSCallbacks() {
        edgeTTSService.onSpeakingStarted = {
            runOnUiThread {
                binding.btnSpeak.text = getString(R.string.stop_speaking)
            }
        }
        edgeTTSService.onSpeakingFinished = {
            runOnUiThread {
                binding.btnSpeak.text = getString(R.string.speak_text)
            }
        }
        edgeTTSService.onError = { error ->
            runOnUiThread {
                binding.btnSpeak.text = getString(R.string.speak_text)
                Toast.makeText(this, error, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun loadNote() {
        lifecycleScope.launch {
            val note = noteDao.getNoteById(noteId) ?: run {
                finish()
                return@launch
            }
            currentNote = note

            runOnUiThread {
                binding.editTitle.setText(note.title)
                binding.editContent.setText(note.content)
                binding.textDate.text = SimpleDateFormat(
                    "d MMMM yyyy, HH:mm",
                    Locale("tr")
                ).format(Date(note.createdAt))

                // Show audio player if audio exists
                if (note.audioFilePath != null) {
                    binding.audioPlayerCard.visibility = View.VISIBLE
                    binding.audioDuration.text = formatDuration(note.duration)
                    binding.btnRetranscribe.visibility = View.VISIBLE
                } else {
                    binding.audioPlayerCard.visibility = View.GONE
                    binding.btnRetranscribe.visibility = View.GONE
                }
            }
        }
    }

    private fun saveNote() {
        val title = binding.editTitle.text?.toString()?.trim() ?: ""
        val content = binding.editContent.text?.toString()?.trim() ?: ""

        if (title.isBlank() && content.isBlank()) {
            Toast.makeText(this, "Not boş olamaz", Toast.LENGTH_SHORT).show()
            return
        }

        lifecycleScope.launch {
            currentNote?.let { note ->
                val updatedNote = note.copy(
                    title = title.ifBlank { "Sesli Not" },
                    content = content,
                    updatedAt = System.currentTimeMillis()
                )
                noteDao.updateNote(updatedNote)
                currentNote = updatedNote

                runOnUiThread {
                    Toast.makeText(this@NoteDetailActivity, getString(R.string.note_saved), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun retranscribe() {
        val audioPath = currentNote?.audioFilePath ?: return

        AlertDialog.Builder(this)
            .setTitle("Yeniden Yazıya Çevir")
            .setMessage("Ses dosyası yerel Whisper AI ile yeniden yazıya çevrilecek. Mevcut metin değiştirilecek.")
            .setPositiveButton(getString(R.string.ok)) { _, _ ->
                lifecycleScope.launch {
                    runOnUiThread {
                        binding.btnRetranscribe.isEnabled = false
                        binding.btnRetranscribe.text = "Dönüştürülüyor..."
                    }

                    // Convert M4A to WAV first
                    val wavPath = AudioConverter.convertToWav(this@NoteDetailActivity, audioPath)
                    if (wavPath == null) {
                        runOnUiThread {
                            binding.btnRetranscribe.isEnabled = true
                            binding.btnRetranscribe.text = "Yeniden Çevir"
                            Toast.makeText(this@NoteDetailActivity, "Ses dosyası dönüştürülemedi", Toast.LENGTH_LONG).show()
                        }
                        return@launch
                    }

                    runOnUiThread {
                        binding.btnRetranscribe.text = "Çevriliyor..."
                    }

                    val result = whisperService.transcribe(wavPath)

                    // Clean up temp WAV
                    java.io.File(wavPath).delete()

                    runOnUiThread {
                        binding.btnRetranscribe.isEnabled = true
                        binding.btnRetranscribe.text = "Yeniden Çevir"

                        if (result.success) {
                            binding.editContent.setText(result.text)
                            Toast.makeText(this@NoteDetailActivity, getString(R.string.transcription_complete), Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(this@NoteDetailActivity, result.error ?: getString(R.string.transcription_failed), Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
    }

    private fun showDeleteDialog() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.delete_note))
            .setMessage(getString(R.string.delete_confirm))
            .setPositiveButton(getString(R.string.yes)) { _, _ ->
                lifecycleScope.launch {
                    currentNote?.let { note ->
                        noteDao.deleteNote(note)
                        note.audioFilePath?.let { path ->
                            java.io.File(path).delete()
                        }
                    }
                    runOnUiThread {
                        Toast.makeText(this@NoteDetailActivity, getString(R.string.note_deleted), Toast.LENGTH_SHORT).show()
                        finish()
                    }
                }
            }
            .setNegativeButton(getString(R.string.no), null)
            .show()
    }

    private fun shareNote() {
        val note = currentNote ?: return
        val shareText = buildString {
            appendLine(note.title)
            appendLine()
            appendLine(note.content)
        }

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, note.title)
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        startActivity(Intent.createChooser(shareIntent, "Paylaş"))
    }

    private fun getSelectedVoice(): String {
        val prefs = getSharedPreferences("voice_notes_prefs", MODE_PRIVATE)
        return prefs.getString("tts_voice", EdgeTTSService.DEFAULT_VOICE) ?: EdgeTTSService.DEFAULT_VOICE
    }

    private fun getSpeechRate(): String {
        val prefs = getSharedPreferences("voice_notes_prefs", MODE_PRIVATE)
        val rate = prefs.getInt("speech_rate", 0)
        return if (rate >= 0) "+${rate}%" else "${rate}%"
    }

    private fun formatDuration(durationMs: Long): String {
        val minutes = TimeUnit.MILLISECONDS.toMinutes(durationMs)
        val seconds = TimeUnit.MILLISECONDS.toSeconds(durationMs) % 60
        return String.format("%02d:%02d", minutes, seconds)
    }

    override fun onDestroy() {
        super.onDestroy()
        audioPlayerManager.release()
        edgeTTSService.release()
        whisperService.release()
        seekBarHandler.removeCallbacksAndMessages(null)
    }
}
