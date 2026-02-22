package com.voicenotes.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.widget.addTextChangedListener
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.voicenotes.app.databinding.ActivityMainBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var noteAdapter: NoteAdapter
    private lateinit var audioRecorder: AudioRecorder
    private lateinit var whisperService: WhisperService
    private lateinit var edgeTTSService: EdgeTTSService
    private lateinit var audioPlayerManager: AudioPlayerManager

    private val noteDao by lazy { VoiceNotesApp.instance.database.noteDao() }

    private var recordingTimerHandler: Handler? = null
    private var recordingStartTime: Long = 0
    private var searchJob: Job? = null
    private var isSearchVisible = false

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val audioGranted = permissions[Manifest.permission.RECORD_AUDIO] == true
        if (audioGranted) {
            startRecording()
        } else {
            Toast.makeText(this, getString(R.string.microphone_permission_message), Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        audioRecorder = AudioRecorder(this)
        whisperService = WhisperService(this)
        edgeTTSService = EdgeTTSService(this)
        audioPlayerManager = AudioPlayerManager()

        setupToolbar()
        setupRecyclerView()
        setupFAB()
        setupRecordingOverlay()
        setupSearch()
        setupTTSCallbacks()
        observeNotes()
        preloadModel()
    }

    private fun preloadModel() {
        if (ModelManager.isModelDownloaded(this)) {
            lifecycleScope.launch {
                whisperService.loadModel()
            }
        }
    }

    private fun setupToolbar() {
        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_search -> {
                    toggleSearch()
                    true
                }
                R.id.action_settings -> {
                    startActivity(Intent(this, SettingsActivity::class.java))
                    true
                }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        noteAdapter = NoteAdapter(
            onNoteClick = { note ->
                val intent = Intent(this, NoteDetailActivity::class.java)
                intent.putExtra("note_id", note.id)
                startActivity(intent)
            },
            onPlayClick = { note ->
                note.audioFilePath?.let { path ->
                    if (audioPlayerManager.isPlaying.value) {
                        audioPlayerManager.stop()
                    } else {
                        audioPlayerManager.playFile(path)
                    }
                }
            },
            onSpeakClick = { note ->
                if (note.content.isNotBlank()) {
                    lifecycleScope.launch {
                        edgeTTSService.speak(note.content)
                    }
                } else {
                    Toast.makeText(this, "Seslendirilecek metin yok", Toast.LENGTH_SHORT).show()
                }
            },
            onDeleteClick = { note ->
                showDeleteDialog(note)
            }
        )

        binding.notesRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = noteAdapter
        }
    }

    private fun setupFAB() {
        binding.fabRecord.setOnClickListener {
            if (audioRecorder.isRecording) return@setOnClickListener
            checkPermissionsAndRecord()
        }
    }

    private fun setupRecordingOverlay() {
        binding.btnStopRecording.setOnClickListener {
            stopRecordingAndTranscribe()
        }

        binding.btnCancelRecording.setOnClickListener {
            audioRecorder.cancelRecording()
            hideRecordingOverlay()
            Toast.makeText(this, getString(R.string.recording_cancelled), Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupSearch() {
        binding.searchEditText.addTextChangedListener { editable ->
            val query = editable?.toString() ?: ""
            searchJob?.cancel()
            searchJob = lifecycleScope.launch {
                if (query.isBlank()) {
                    noteDao.getAllNotes().collectLatest { notes ->
                        updateNotesList(notes)
                    }
                } else {
                    noteDao.searchNotes(query).collectLatest { notes ->
                        updateNotesList(notes)
                    }
                }
            }
        }
    }

    private fun setupTTSCallbacks() {
        edgeTTSService.onSpeakingStarted = {
            runOnUiThread {
                Toast.makeText(this, getString(R.string.speaking), Toast.LENGTH_SHORT).show()
            }
        }
        edgeTTSService.onSpeakingFinished = {
            runOnUiThread {
                // Speaking done
            }
        }
        edgeTTSService.onError = { error ->
            runOnUiThread {
                Toast.makeText(this, error, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun observeNotes() {
        lifecycleScope.launch {
            noteDao.getAllNotes().collectLatest { notes ->
                updateNotesList(notes)
            }
        }
    }

    private fun updateNotesList(notes: List<Note>) {
        noteAdapter.submitList(notes)
        binding.emptyState.visibility = if (notes.isEmpty()) View.VISIBLE else View.GONE
        binding.notesRecyclerView.visibility = if (notes.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun toggleSearch() {
        isSearchVisible = !isSearchVisible
        binding.searchLayout.visibility = if (isSearchVisible) View.VISIBLE else View.GONE
        if (!isSearchVisible) {
            binding.searchEditText.setText("")
        }
    }

    private fun checkPermissionsAndRecord() {
        val permissions = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val allGranted = permissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

        if (allGranted) {
            startRecording()
        } else {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun startRecording() {
        // Check if Whisper model is downloaded
        if (!ModelManager.isModelDownloaded(this)) {
            AlertDialog.Builder(this)
                .setTitle("Whisper Modeli Gerekli")
                .setMessage("Ses tanıma için önce Whisper modelini indirmeniz gerekiyor. Ayarlar'a gitmek ister misiniz?")
                .setPositiveButton("Ayarlar") { _, _ ->
                    startActivity(Intent(this, SettingsActivity::class.java))
                }
                .setNegativeButton(getString(R.string.cancel), null)
                .show()
            return
        }

        try {
            audioRecorder.startRecording()
            showRecordingOverlay()
            startRecordingTimer()
        } catch (e: Exception) {
            Toast.makeText(this, "Kayıt başlatılamadı: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    private fun stopRecordingAndTranscribe() {
        val result = audioRecorder.stopRecording()
        hideRecordingOverlay()
        stopRecordingTimer()

        // Show transcribing overlay
        binding.transcribingOverlay.visibility = View.VISIBLE

        lifecycleScope.launch {
            // Step 1: Convert M4A to WAV (16kHz, 16-bit, mono) for whisper.cpp
            val wavPath = AudioConverter.convertToWav(this@MainActivity, result.filePath)

            if (wavPath == null) {
                binding.transcribingOverlay.visibility = View.GONE
                // Save note without transcription
                val note = Note(
                    title = "Sesli Not",
                    content = "",
                    audioFilePath = result.filePath,
                    duration = result.durationMs,
                    isTranscribed = false
                )
                val noteId = noteDao.insertNote(note)
                Toast.makeText(this@MainActivity, "Ses dosyası dönüştürülemedi", Toast.LENGTH_LONG).show()
                openNoteDetail(noteId)
                return@launch
            }

            // Step 2: Transcribe with local Whisper
            val transcription = whisperService.transcribe(wavPath)

            // Clean up temp WAV file
            java.io.File(wavPath).delete()

            binding.transcribingOverlay.visibility = View.GONE

            if (transcription.success) {
                val note = Note(
                    title = generateTitle(transcription.text),
                    content = transcription.text,
                    audioFilePath = result.filePath,
                    duration = result.durationMs,
                    isTranscribed = true
                )
                val noteId = noteDao.insertNote(note)

                Toast.makeText(
                    this@MainActivity,
                    getString(R.string.transcription_complete),
                    Toast.LENGTH_SHORT
                ).show()

                openNoteDetail(noteId)
            } else {
                val note = Note(
                    title = "Sesli Not",
                    content = "",
                    audioFilePath = result.filePath,
                    duration = result.durationMs,
                    isTranscribed = false
                )
                val noteId = noteDao.insertNote(note)

                AlertDialog.Builder(this@MainActivity)
                    .setTitle(getString(R.string.transcription_failed))
                    .setMessage(transcription.error ?: "Bilinmeyen hata")
                    .setPositiveButton("Notu Aç") { _, _ ->
                        openNoteDetail(noteId)
                    }
                    .setNegativeButton(getString(R.string.ok), null)
                    .show()
            }
        }
    }

    private fun openNoteDetail(noteId: Long) {
        val intent = Intent(this, NoteDetailActivity::class.java)
        intent.putExtra("note_id", noteId)
        startActivity(intent)
    }

    private fun generateTitle(text: String): String {
        if (text.isBlank()) return "Sesli Not"
        val words = text.trim().split("\\s+".toRegex())
        return words.take(5).joinToString(" ").let {
            if (it.length > 40) it.substring(0, 40) + "…" else it
        }
    }

    private fun showRecordingOverlay() {
        binding.recordingOverlay.visibility = View.VISIBLE
        binding.fabRecord.visibility = View.GONE
    }

    private fun hideRecordingOverlay() {
        binding.recordingOverlay.visibility = View.GONE
        binding.fabRecord.visibility = View.VISIBLE
    }

    private fun startRecordingTimer() {
        recordingStartTime = System.currentTimeMillis()
        recordingTimerHandler = Handler(Looper.getMainLooper())

        val timerRunnable = object : Runnable {
            override fun run() {
                val elapsed = System.currentTimeMillis() - recordingStartTime
                val minutes = TimeUnit.MILLISECONDS.toMinutes(elapsed)
                val seconds = TimeUnit.MILLISECONDS.toSeconds(elapsed) % 60
                binding.recordingTimer.text = String.format("%02d:%02d", minutes, seconds)
                recordingTimerHandler?.postDelayed(this, 1000)
            }
        }
        recordingTimerHandler?.post(timerRunnable)
    }

    private fun stopRecordingTimer() {
        recordingTimerHandler?.removeCallbacksAndMessages(null)
        recordingTimerHandler = null
    }

    private fun showDeleteDialog(note: Note) {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.delete_note))
            .setMessage(getString(R.string.delete_confirm))
            .setPositiveButton(getString(R.string.yes)) { _, _ ->
                lifecycleScope.launch {
                    noteDao.deleteNote(note)
                    note.audioFilePath?.let { path ->
                        java.io.File(path).delete()
                    }
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, getString(R.string.note_deleted), Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton(getString(R.string.no), null)
            .show()
    }

    override fun onResume() {
        super.onResume()
        // Reload model if it was downloaded while in settings
        if (ModelManager.isModelDownloaded(this) && !whisperService.isReady()) {
            lifecycleScope.launch {
                whisperService.loadModel()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        audioRecorder.release()
        audioPlayerManager.release()
        edgeTTSService.release()
        whisperService.release()
        stopRecordingTimer()
    }
}
