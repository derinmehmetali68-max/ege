# Sesli Notlar - Android Voice Notes App

Whisper AI ve Edge TTS destekli Android sesli not alma uygulamasi.

## Ozellikler

- **Ses Kaydi**: Yuksek kaliteli ses kaydi (AAC, 44.1kHz, 128kbps)
- **Whisper AI ile Yaziya Cevirme**: OpenAI Whisper API kullanarak sesi otomatik olarak yaziya cevirir
- **Edge TTS ile Seslendirme**: Microsoft Edge TTS (tr-TR-AhmetNeural) ile metni seslendirir
- **Not Yonetimi**: Notlari kaydetme, duzenleme, arama ve silme
- **Turkce Destek**: Tam Turkce arayuz ve Turkce ses tanima/sentez

## Teknolojiler

| Bilesen | Teknoloji |
|---------|-----------|
| Platform | Android (API 26+) |
| Dil | Kotlin |
| Ses Tanima (STT) | OpenAI Whisper API |
| Ses Sentez (TTS) | Microsoft Edge TTS WebSocket |
| Veritabani | Room Database |
| HTTP | OkHttp 4 |
| UI | Material Design 3 |
| Async | Kotlin Coroutines + Flow |

## Proje Yapisi

```
app/src/main/java/com/voicenotes/app/
├── VoiceNotesApp.kt          # Application sinifi
├── Note.kt                    # Room Entity
├── NoteDao.kt                 # Room DAO
├── NoteDatabase.kt            # Room Database
├── NoteAdapter.kt             # RecyclerView Adapter
├── AudioRecorder.kt           # Ses kaydi yonetimi
├── AudioPlayerManager.kt      # Ses oynatma yonetimi
├── WhisperService.kt          # OpenAI Whisper API entegrasyonu
├── EdgeTTSService.kt          # Edge TTS WebSocket entegrasyonu
├── MainActivity.kt            # Ana ekran - not listesi ve kayit
├── NoteDetailActivity.kt      # Not detay ve duzenleme
└── SettingsActivity.kt        # Ayarlar ekrani
```

## Kurulum ve Derleme

### Gereksinimler
- Android Studio Hedgehog (2023.1.1) veya ustu
- JDK 17
- Android SDK 34
- OpenAI API anahtari (Whisper icin)

### Adimlar

1. **Projeyi klonlayin:**
   ```bash
   git clone <repo-url>
   cd ege
   ```

2. **Android Studio ile acin** veya komut satirindan derleyin:
   ```bash
   ./gradlew assembleDebug
   ```

3. **APK dosyasini bulun:**
   ```
   app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Telefona yukleyin:**
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

### Ilk Kullanim

1. Uygulamayi acin
2. **Ayarlar** > OpenAI API anahtarinizi girin
3. TTS sesi secin (Ahmet veya Emel)
4. Ana ekranda **Kayit Baslat** butonuna basin
5. Konusmanizi bitirince **Kaydi Durdur** deyin
6. Whisper AI otomatik olarak sesi yaziya cevirecek
7. Not detayinda **Metni Seslendir** ile Edge TTS kullanin

## Edge TTS Sesleri

| Ses | Kod | Cinsiyet |
|-----|-----|----------|
| Ahmet | tr-TR-AhmetNeural | Erkek |
| Emel | tr-TR-EmelNeural | Kadin |

## API Anahtari

Bu uygulama OpenAI Whisper API kullanir. API anahtari almak icin:
1. https://platform.openai.com adresine gidin
2. Hesap olusturun / giris yapin
3. API Keys bolumunden yeni anahtar olusturun
4. Anahtari uygulamanin Ayarlar ekranina girin

## Izinler

- `RECORD_AUDIO` - Ses kaydi icin
- `INTERNET` - Whisper API ve Edge TTS icin
- `POST_NOTIFICATIONS` - Bildirimler icin (Android 13+)

## Lisans

MIT License
