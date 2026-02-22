package com.voicenotes.app

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.voicenotes.app.databinding.ActivitySettingsBinding
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var whisperService: WhisperService
    private lateinit var edgeTTSService: EdgeTTSService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        whisperService = WhisperService(this)
        edgeTTSService = EdgeTTSService(this)

        setupToolbar()
        loadSettings()
        setupListeners()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun loadSettings() {
        val prefs = getSharedPreferences("voice_notes_prefs", MODE_PRIVATE)

        // Load API key
        val apiKey = prefs.getString("openai_api_key", "") ?: ""
        if (apiKey.isNotBlank()) {
            binding.editApiKey.setText(apiKey)
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

    private fun setupListeners() {
        // Save API Key
        binding.btnSaveApiKey.setOnClickListener {
            val apiKey = binding.editApiKey.text?.toString()?.trim() ?: ""
            whisperService.setApiKey(apiKey)
            Toast.makeText(this, getString(R.string.api_key_saved), Toast.LENGTH_SHORT).show()
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
        edgeTTSService.release()
    }
}
