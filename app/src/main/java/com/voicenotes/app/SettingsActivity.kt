package com.voicenotes.app

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.voicenotes.app.databinding.ActivitySettingsBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var edgeTTSService: EdgeTTSService
    private var downloadJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        edgeTTSService = EdgeTTSService(this)

        setupToolbar()
        loadSettings()
        updateModelStatus()
        setupListeners()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun loadSettings() {
        val prefs = getSharedPreferences("voice_notes_prefs", MODE_PRIVATE)

        // Load model selection
        val selectedModel = ModelManager.getSelectedModel(this)
        when (selectedModel) {
            ModelManager.WhisperModel.TINY -> binding.radioModelTiny.isChecked = true
            ModelManager.WhisperModel.BASE -> binding.radioModelBase.isChecked = true
            ModelManager.WhisperModel.SMALL -> binding.radioModelSmall.isChecked = true
        }

        // Load voice selection
        val voice = prefs.getString("tts_voice", EdgeTTSService.DEFAULT_VOICE)
        when (voice) {
            EdgeTTSService.DEFAULT_VOICE -> binding.radioAhmet.isChecked = true
            EdgeTTSService.VOICE_FEMALE -> binding.radioEmel.isChecked = true
        }

        // Load speech rate
        val rate = prefs.getInt("speech_rate", 0)
        binding.speechRateSlider.value = rate.toFloat()
        updateSpeechRateLabel(rate)
    }

    private fun updateModelStatus() {
        val selectedModel = getSelectedModelFromRadio()
        val isDownloaded = ModelManager.isModelDownloaded(this, selectedModel)

        if (isDownloaded) {
            binding.modelStatusDot.setBackgroundColor(
                ContextCompat.getColor(this, R.color.speaking_green)
            )
            binding.modelStatusText.text = "${selectedModel.displayName} - Hazır"
            binding.modelStatusText.setTextColor(
                ContextCompat.getColor(this, R.color.speaking_green)
            )
            binding.btnDownloadModel.text = "Yeniden İndir"
            binding.btnDeleteModel.visibility = View.VISIBLE
        } else {
            binding.modelStatusDot.setBackgroundColor(
                ContextCompat.getColor(this, R.color.recording_red)
            )
            binding.modelStatusText.text = "Model indirilmemiş"
            binding.modelStatusText.setTextColor(
                ContextCompat.getColor(this, R.color.recording_red)
            )
            binding.btnDownloadModel.text = "Modeli İndir"
            binding.btnDeleteModel.visibility = View.GONE
        }
    }

    private fun setupListeners() {
        // Model radio group change
        binding.modelRadioGroup.setOnCheckedChangeListener { _, _ ->
            updateModelStatus()
        }

        // Download model
        binding.btnDownloadModel.setOnClickListener {
            downloadModel()
        }

        // Delete model
        binding.btnDeleteModel.setOnClickListener {
            val model = getSelectedModelFromRadio()
            AlertDialog.Builder(this)
                .setTitle("Modeli Sil")
                .setMessage("${model.displayName} modelini silmek istediğinizden emin misiniz?")
                .setPositiveButton("Sil") { _, _ ->
                    ModelManager.deleteModel(this, model)
                    updateModelStatus()
                    Toast.makeText(this, "Model silindi", Toast.LENGTH_SHORT).show()
                }
                .setNegativeButton("İptal", null)
                .show()
        }

        // Voice selection
        binding.voiceRadioGroup.setOnCheckedChangeListener { _, checkedId ->
            val voice = when (checkedId) {
                R.id.radioAhmet -> EdgeTTSService.DEFAULT_VOICE
                R.id.radioEmel -> EdgeTTSService.VOICE_FEMALE
                else -> EdgeTTSService.DEFAULT_VOICE
            }
            getSharedPreferences("voice_notes_prefs", MODE_PRIVATE)
                .edit()
                .putString("tts_voice", voice)
                .apply()
        }

        // Test TTS
        binding.btnTestTTS.setOnClickListener {
            val voice = when (binding.voiceRadioGroup.checkedRadioButtonId) {
                R.id.radioAhmet -> EdgeTTSService.DEFAULT_VOICE
                R.id.radioEmel -> EdgeTTSService.VOICE_FEMALE
                else -> EdgeTTSService.DEFAULT_VOICE
            }
            val rate = binding.speechRateSlider.value.toInt()
            val rateStr = if (rate >= 0) "+${rate}%" else "${rate}%"

            edgeTTSService.onSpeakingStarted = {
                runOnUiThread {
                    binding.btnTestTTS.text = "Konuşuyor..."
                    binding.btnTestTTS.isEnabled = false
                }
            }
            edgeTTSService.onSpeakingFinished = {
                runOnUiThread {
                    binding.btnTestTTS.text = "Sesi Test Et"
                    binding.btnTestTTS.isEnabled = true
                }
            }
            edgeTTSService.onError = { error ->
                runOnUiThread {
                    binding.btnTestTTS.text = "Sesi Test Et"
                    binding.btnTestTTS.isEnabled = true
                    Toast.makeText(this, error, Toast.LENGTH_LONG).show()
                }
            }

            lifecycleScope.launch {
                edgeTTSService.speak(
                    "Merhaba! Ben sesli notlar uygulamasının ses asistanıyım. Size yardımcı olmaktan mutluluk duyarım.",
                    voice = voice,
                    rate = rateStr
                )
            }
        }

        // Speech rate slider
        binding.speechRateSlider.addOnChangeListener { _, value, _ ->
            val rate = value.toInt()
            updateSpeechRateLabel(rate)
            getSharedPreferences("voice_notes_prefs", MODE_PRIVATE)
                .edit()
                .putInt("speech_rate", rate)
                .apply()
        }
    }

    private fun downloadModel() {
        val model = getSelectedModelFromRadio()

        binding.btnDownloadModel.isEnabled = false
        binding.btnDownloadModel.text = "İndiriliyor..."
        binding.downloadProgress.visibility = View.VISIBLE
        binding.downloadProgress.isIndeterminate = false
        binding.downloadProgress.progress = 0
        binding.downloadProgressText.visibility = View.VISIBLE
        binding.downloadProgressText.text = "Hazırlanıyor..."
        binding.modelRadioGroup.isEnabled = false

        downloadJob = lifecycleScope.launch {
            val result = ModelManager.downloadModel(this@SettingsActivity, model) { downloaded, total ->
                runOnUiThread {
                    if (total > 0) {
                        val percent = (downloaded * 100 / total).toInt()
                        binding.downloadProgress.progress = percent
                        val downloadedMB = downloaded / (1024 * 1024)
                        val totalMB = total / (1024 * 1024)
                        binding.downloadProgressText.text = "${downloadedMB} MB / ${totalMB} MB (%${percent})"
                    } else {
                        binding.downloadProgress.isIndeterminate = true
                        val downloadedMB = downloaded / (1024 * 1024)
                        binding.downloadProgressText.text = "${downloadedMB} MB indirildi"
                    }
                }
            }

            runOnUiThread {
                binding.downloadProgress.visibility = View.GONE
                binding.downloadProgressText.visibility = View.GONE
                binding.btnDownloadModel.isEnabled = true
                binding.modelRadioGroup.isEnabled = true

                if (result.success) {
                    Toast.makeText(this@SettingsActivity, "Model başarıyla indirildi!", Toast.LENGTH_LONG).show()
                    updateModelStatus()
                } else {
                    binding.btnDownloadModel.text = "Modeli İndir"
                    Toast.makeText(this@SettingsActivity, result.error ?: "İndirme başarısız", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun getSelectedModelFromRadio(): ModelManager.WhisperModel {
        return when (binding.modelRadioGroup.checkedRadioButtonId) {
            R.id.radioModelTiny -> ModelManager.WhisperModel.TINY
            R.id.radioModelBase -> ModelManager.WhisperModel.BASE
            R.id.radioModelSmall -> ModelManager.WhisperModel.SMALL
            else -> ModelManager.WhisperModel.BASE
        }
    }

    private fun updateSpeechRateLabel(rate: Int) {
        binding.speechRateLabel.text = when {
            rate < -30 -> "Çok Yavaş"
            rate < -10 -> "Yavaş"
            rate <= 10 -> "Normal"
            rate <= 40 -> "Hızlı"
            else -> "Çok Hızlı"
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        downloadJob?.cancel()
        edgeTTSService.release()
    }
}
