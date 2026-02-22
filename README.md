# Sesli Notlar - Android Voice Notes App

Whisper AI (yerel/cihaz uzerinde) ve Edge TTS destekli Android sesli not alma uygulamasi.
**API anahtari gerekmez** - tamamen cevrimdisi ses tanima!

## Ozellikler

- **Ses Kaydi**: Yuksek kaliteli ses kaydi (AAC, 44.1kHz, 128kbps)
- **Yerel Whisper AI**: whisper.cpp ile cihaz uzerinde ses tanima (internet gerekmez!)
- **Edge TTS Seslendirme**: Microsoft Edge TTS (tr-TR-AhmetNeural) ile metni seslendirir
- **Not Yonetimi**: Notlari kaydetme, duzenleme, arama ve silme
- **Turkce Destek**: Tam Turkce arayuz ve Turkce ses tanima/sentez
- **Model Secimi**: Tiny (75MB), Base (142MB), Small (466MB) model secenekleri

## Teknolojiler

| Bilesen | Teknoloji |
|---------|-----------|
| Platform | Android (API 26+) |
| Dil | Kotlin + C++ (JNI) |
| Ses Tanima (STT) | whisper.cpp (yerel, cevrimdisi) |
| Ses Sentez (TTS) | Microsoft Edge TTS WebSocket |
| Veritabani | Room Database |
| HTTP | OkHttp 4 |
| UI | Material Design 3 |
| Native Build | CMake + NDK |
| Async | Kotlin Coroutines + Flow |

## Proje Yapisi

```
app/src/main/
├── cpp/
│   ├── CMakeLists.txt        # Native build yapilandirmasi
│   ├── whisper_jni.cpp        # JNI koprusu (C++ <-> Kotlin)
│   └── whisper.cpp/           # whisper.cpp kaynak kodu (setup ile indirilir)
└── java/com/voicenotes/app/
    ├── VoiceNotesApp.kt       # Application sinifi
    ├── Note.kt                # Room Entity
    ├── NoteDao.kt             # Room DAO
    ├── NoteDatabase.kt        # Room Database
    ├── NoteAdapter.kt         # RecyclerView Adapter
    ├── AudioRecorder.kt       # Ses kaydi yonetimi (MediaRecorder)
    ├── AudioPlayerManager.kt  # Ses oynatma yonetimi
    ├── AudioConverter.kt      # M4A -> WAV donusturucu (16kHz, mono)
    ├── WhisperLib.kt          # JNI wrapper (native metodlar)
    ├── WhisperService.kt      # Yerel Whisper ses tanima servisi
    ├── ModelManager.kt        # Model indirme ve yonetim
    ├── EdgeTTSService.kt      # Edge TTS WebSocket entegrasyonu
    ├── MainActivity.kt        # Ana ekran - not listesi ve kayit
    ├── NoteDetailActivity.kt  # Not detay ve duzenleme
    └── SettingsActivity.kt    # Ayarlar - model indirme, ses secimi
```

## Kurulum ve Derleme

### Gereksinimler
- Android Studio Hedgehog (2023.1.1) veya ustu
- JDK 17
- Android SDK 34
- Android NDK 26.1.10909125
- CMake 3.22.1
- Git

### Adimlar

1. **Projeyi klonlayin:**
   ```bash
   git clone <repo-url>
   cd ege
   ```

2. **whisper.cpp kaynak kodunu indirin:**
   ```bash
   chmod +x setup_whisper.sh
   ./setup_whisper.sh
   ```
   Bu script whisper.cpp'yi `app/src/main/cpp/whisper.cpp/` dizinine indirir.

3. **Android Studio ile acin** veya komut satirindan derleyin:
   ```bash
   ./gradlew assembleDebug
   ```

4. **APK dosyasini bulun:**
   ```
   app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Telefona yukleyin:**
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

### Ilk Kullanim

1. Uygulamayi acin
2. **Ayarlar** ekranina gidin
3. Whisper modelini secin (Base onerilen) ve **Modeli Indir** butonuna basin
4. Model indirildikten sonra ana ekrana donun
5. **Kayit Baslat** butonuna basin ve konusmaya baslayin
6. **Kaydi Durdur** deyin - ses otomatik olarak yaziya cevrilecek
7. Not detayinda **Metni Seslendir** ile Edge TTS kullanin

## Whisper Modelleri

Model ilk kulanimda uygulamanin icinden Hugging Face'den indirilir:

| Model | Boyut | Kalite | Hiz |
|-------|-------|--------|-----|
| Tiny | ~75 MB | Dusuk | Cok Hizli |
| Base | ~142 MB | Orta (Onerilen) | Hizli |
| Small | ~466 MB | Yuksek | Yavas |

Modeller cihazin dahili deposunda saklanir ve bir kez indirildikten sonra
tamamen cevrimdisi calisir.

## Edge TTS Sesleri

| Ses | Kod | Cinsiyet |
|-----|-----|----------|
| Ahmet | tr-TR-AhmetNeural | Erkek |
| Emel | tr-TR-EmelNeural | Kadin |

## Izinler

- `RECORD_AUDIO` - Ses kaydi icin
- `INTERNET` - Model indirme ve Edge TTS icin (ses tanima icin gerekmez)
- `POST_NOTIFICATIONS` - Bildirimler icin (Android 13+)

## Nasil Calisiyor?

1. **Ses Kaydi**: MediaRecorder ile M4A formatinda kaydedilir
2. **Format Donusum**: M4A dosyasi MediaCodec ile decode edilir ve 16kHz/mono/16-bit WAV'a donusturulur
3. **Ses Tanima**: WAV dosyasi whisper.cpp native kutuphanesine JNI uzerinden gonderilir
4. **Transkripsiyon**: whisper.cpp modeli cihaz CPU'sunda calisir ve metni dondurur
5. **Seslendirme**: Metin Edge TTS WebSocket protokolu uzerinden sentezlenir

## Lisans

MIT License
