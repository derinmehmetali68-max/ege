#include <jni.h>
#include <android/log.h>
#include <string>
#include <vector>
#include <fstream>
#include <cstdint>
#include "whisper.h"

#define TAG "WhisperJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static struct whisper_context *g_context = nullptr;

// Read WAV file and extract 16-bit PCM samples, convert to float
static bool read_wav_file(const std::string &fname, std::vector<float> &pcmf32) {
    std::ifstream file(fname, std::ios::binary);
    if (!file.is_open()) {
        LOGE("Failed to open WAV file: %s", fname.c_str());
        return false;
    }

    // Read WAV header
    char riff[4];
    file.read(riff, 4);
    if (std::string(riff, 4) != "RIFF") {
        LOGE("Not a RIFF file");
        return false;
    }

    uint32_t chunk_size;
    file.read(reinterpret_cast<char*>(&chunk_size), 4);

    char wave[4];
    file.read(wave, 4);
    if (std::string(wave, 4) != "WAVE") {
        LOGE("Not a WAVE file");
        return false;
    }

    // Find 'fmt ' and 'data' chunks
    uint16_t audio_format = 0;
    uint16_t num_channels = 0;
    uint32_t sample_rate = 0;
    uint16_t bits_per_sample = 0;
    uint32_t data_size = 0;
    bool found_fmt = false;
    bool found_data = false;

    while (!file.eof() && !(found_fmt && found_data)) {
        char sub_id[4];
        uint32_t sub_size;
        file.read(sub_id, 4);
        file.read(reinterpret_cast<char*>(&sub_size), 4);

        std::string id(sub_id, 4);

        if (id == "fmt ") {
            file.read(reinterpret_cast<char*>(&audio_format), 2);
            file.read(reinterpret_cast<char*>(&num_channels), 2);
            file.read(reinterpret_cast<char*>(&sample_rate), 4);
            uint32_t byte_rate;
            file.read(reinterpret_cast<char*>(&byte_rate), 4);
            uint16_t block_align;
            file.read(reinterpret_cast<char*>(&block_align), 2);
            file.read(reinterpret_cast<char*>(&bits_per_sample), 2);

            // Skip remaining fmt data
            if (sub_size > 16) {
                file.seekg(sub_size - 16, std::ios::cur);
            }
            found_fmt = true;
        } else if (id == "data") {
            data_size = sub_size;
            found_data = true;
        } else {
            file.seekg(sub_size, std::ios::cur);
        }
    }

    if (!found_fmt || !found_data) {
        LOGE("WAV: missing fmt or data chunk");
        return false;
    }

    LOGI("WAV: format=%d channels=%d rate=%d bps=%d data_size=%d",
         audio_format, num_channels, sample_rate, bits_per_sample, data_size);

    if (audio_format != 1) { // PCM
        LOGE("WAV: not PCM format (format=%d)", audio_format);
        return false;
    }

    if (bits_per_sample != 16) {
        LOGE("WAV: not 16-bit (bps=%d)", bits_per_sample);
        return false;
    }

    // Read PCM data
    int num_samples = data_size / (bits_per_sample / 8) / num_channels;
    std::vector<int16_t> pcm16(num_samples * num_channels);
    file.read(reinterpret_cast<char*>(pcm16.data()), data_size);

    // Convert to mono float
    pcmf32.resize(num_samples);
    if (num_channels == 1) {
        for (int i = 0; i < num_samples; i++) {
            pcmf32[i] = static_cast<float>(pcm16[i]) / 32768.0f;
        }
    } else {
        // Mix channels to mono
        for (int i = 0; i < num_samples; i++) {
            float sum = 0.0f;
            for (int c = 0; c < num_channels; c++) {
                sum += static_cast<float>(pcm16[i * num_channels + c]);
            }
            pcmf32[i] = sum / (32768.0f * num_channels);
        }
    }

    LOGI("WAV loaded: %d samples at %d Hz", num_samples, sample_rate);
    return true;
}

extern "C" {

// Initialize whisper model from file
JNIEXPORT jlong JNICALL
Java_com_voicenotes_app_WhisperLib_initModel(
    JNIEnv *env, jobject /* thiz */, jstring model_path) {

    const char *path = env->GetStringUTFChars(model_path, nullptr);
    LOGI("Loading model from: %s", path);

    struct whisper_context_params cparams = whisper_context_default_params();
    cparams.use_gpu = false; // CPU only for compatibility

    struct whisper_context *ctx = whisper_init_from_file_with_params(path, cparams);
    env->ReleaseStringUTFChars(model_path, path);

    if (ctx == nullptr) {
        LOGE("Failed to load model");
        return 0;
    }

    LOGI("Model loaded successfully");
    return reinterpret_cast<jlong>(ctx);
}

// Transcribe a WAV file
JNIEXPORT jstring JNICALL
Java_com_voicenotes_app_WhisperLib_transcribeFile(
    JNIEnv *env, jobject /* thiz */, jlong context_ptr, jstring audio_path,
    jstring language, jint num_threads) {

    auto *ctx = reinterpret_cast<struct whisper_context *>(context_ptr);
    if (ctx == nullptr) {
        return env->NewStringUTF("[HATA: Model yüklenmemiş]");
    }

    const char *path = env->GetStringUTFChars(audio_path, nullptr);
    const char *lang = env->GetStringUTFChars(language, nullptr);

    LOGI("Transcribing: %s (lang=%s, threads=%d)", path, lang, num_threads);

    // Read WAV file
    std::vector<float> pcmf32;
    if (!read_wav_file(path, pcmf32)) {
        env->ReleaseStringUTFChars(audio_path, path);
        env->ReleaseStringUTFChars(language, lang);
        return env->NewStringUTF("[HATA: Ses dosyası okunamadı]");
    }

    env->ReleaseStringUTFChars(audio_path, path);

    // Set up whisper parameters
    struct whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.print_realtime   = false;
    params.print_progress   = false;
    params.print_timestamps = false;
    params.print_special    = false;
    params.translate        = false;
    params.language         = lang;
    params.n_threads        = num_threads > 0 ? num_threads : 4;
    params.no_timestamps    = true;
    params.single_segment   = false;

    // Run inference
    LOGI("Starting inference with %d samples...", (int)pcmf32.size());
    int ret = whisper_full(ctx, params, pcmf32.data(), pcmf32.size());

    env->ReleaseStringUTFChars(language, lang);

    if (ret != 0) {
        LOGE("Inference failed with code: %d", ret);
        return env->NewStringUTF("[HATA: Çeviri başarısız]");
    }

    // Collect results
    std::string result;
    int n_segments = whisper_full_n_segments(ctx);
    LOGI("Got %d segments", n_segments);

    for (int i = 0; i < n_segments; i++) {
        const char *text = whisper_full_get_segment_text(ctx, i);
        if (text != nullptr) {
            result += text;
        }
    }

    LOGI("Transcription: %s", result.c_str());
    return env->NewStringUTF(result.c_str());
}

// Transcribe from float PCM data directly
JNIEXPORT jstring JNICALL
Java_com_voicenotes_app_WhisperLib_transcribeBuffer(
    JNIEnv *env, jobject /* thiz */, jlong context_ptr, jfloatArray audio_data,
    jstring language, jint num_threads) {

    auto *ctx = reinterpret_cast<struct whisper_context *>(context_ptr);
    if (ctx == nullptr) {
        return env->NewStringUTF("[HATA: Model yüklenmemiş]");
    }

    const char *lang = env->GetStringUTFChars(language, nullptr);
    jfloat *data = env->GetFloatArrayElements(audio_data, nullptr);
    jsize len = env->GetArrayLength(audio_data);

    // Set up whisper parameters
    struct whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.print_realtime   = false;
    params.print_progress   = false;
    params.print_timestamps = false;
    params.print_special    = false;
    params.translate        = false;
    params.language         = lang;
    params.n_threads        = num_threads > 0 ? num_threads : 4;
    params.no_timestamps    = true;
    params.single_segment   = false;

    LOGI("Transcribing buffer: %d samples", len);
    int ret = whisper_full(ctx, params, data, len);

    env->ReleaseFloatArrayElements(audio_data, data, JNI_ABORT);
    env->ReleaseStringUTFChars(language, lang);

    if (ret != 0) {
        LOGE("Inference failed with code: %d", ret);
        return env->NewStringUTF("[HATA: Çeviri başarısız]");
    }

    std::string result;
    int n_segments = whisper_full_n_segments(ctx);
    for (int i = 0; i < n_segments; i++) {
        const char *text = whisper_full_get_segment_text(ctx, i);
        if (text != nullptr) {
            result += text;
        }
    }

    return env->NewStringUTF(result.c_str());
}

// Free the model
JNIEXPORT void JNICALL
Java_com_voicenotes_app_WhisperLib_freeModel(
    JNIEnv *env, jobject /* thiz */, jlong context_ptr) {

    auto *ctx = reinterpret_cast<struct whisper_context *>(context_ptr);
    if (ctx != nullptr) {
        whisper_free(ctx);
        LOGI("Model freed");
    }
}

// Get system info
JNIEXPORT jstring JNICALL
Java_com_voicenotes_app_WhisperLib_getSystemInfo(
    JNIEnv *env, jobject /* thiz */) {
    const char *info = whisper_print_system_info();
    return env->NewStringUTF(info);
}

} // extern "C"
