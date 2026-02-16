# İETT Otobüs Bildirim & Takip Sistemi

İstanbul İETT otobüslerini anlık olarak takip eden, seçtiğiniz durağa belirli sayıda durak kala **masaüstü + Telegram bildirimi** gönderen, **harita üzerinde canlı takip** sunan ve **Android APK** olarak telefonunuza yüklenebilen Python uygulaması.

## Özellikler

### Temel
- **Anlık otobüs takibi**: İBB SOAP API üzerinden hat bazlı canlı GPS konumları
- **Durak yaklaşma uyarısı**: Hedef durağınıza X durak kala otomatik bildirim
- **ETA tahmini**: Geçmiş verilere, hıza veya mesafeye dayalı tahmini varış süresi
- **Çapraz platform bildirim**: Linux (notify-send), macOS (osascript), Windows (toast)

### Web Dashboard
- **Gerçek zamanlı harita**: Leaflet.js ile otobüsleri harita üzerinde canlı izleme
- **Socket.IO**: Anlık güncelleme, sayfa yenilemesiz veri akışı
- **Tarayıcı bildirimi**: Web push notification desteği
- **Favori yönetimi**: Sık kullandığınız hat/durak kombinasyonlarını kaydetme
- **Responsive tasarım**: Mobil ve masaüstünde çalışır

### Bildirim Kanalları
- **Masaüstü bildirimi**: OS-native bildirimler + sesli uyarı
- **Telegram bot**: Telefonunuza anlık bildirim (token ile)
- **Tarayıcı bildirimi**: Web dashboard üzerinden push notification

### Android Mobil Uygulama
- **Native Android APK**: Kivy + KivyMD ile Material Design arayüz
- **Harita**: kivy-garden MapView ile canlı otobüs haritası
- **Android bildirimi**: Native notification + titreşim
- **Arka plan servisi**: Uygulama kapalıyken bile takip (foreground service)
- **Favori hat/durak**: Tek dokunuşla takip başlatma
- **Telegram entegrasyonu**: Uygulama içinden yapılandırma
- **Offline favori**: İnternet olmasa da favori listesi erişilebilir

### Gelişmiş
- **SQLite veritabanı**: Konum geçmişi, bildirim kaydı, favori hatlar
- **ETA öğrenme**: Geçmiş varış sürelerinden gün tipi ve saat dilimine göre ortalama
- **Çoklu hat takibi**: Birden fazla hattı aynı anda thread bazlı izleme
- **API önbellekleme**: Statik veriler (hatlar, duraklar) cache'lenir
- **Retry & timeout**: Bağlantı kopsa bile otomatik yeniden deneme
- **Bildirim TTL**: Aynı bildirimin 10 dakika içinde tekrarlanmaması

## Kurulum

```bash
pip install -r requirements.txt

# Linux bildirim (opsiyonel)
sudo apt install libnotify-bin
```

## Kullanım

### 1. Web Dashboard (Önerilen)
```bash
python main.py --web
# veya farklı port
python main.py --web --port 8080
```
Tarayıcınızda `http://localhost:5000` adresini açın.

### 2. Komut Satırı
```bash
# İnteraktif mod
python main.py

# Doğrudan takip
python main.py --hat 500T --durak-ad "Kadıköy" --kala 3

# 5 durak kala, 20 saniye aralıkla
python main.py --hat 34BZ --durak-ad "Beşiktaş" --kala 5 --aralik 20

# Favorilerden başlat
python main.py --favoriler
```

### 3. Bilgi Komutları
```bash
python main.py --hatlar            # Tüm İETT hatları
python main.py --listele 500T      # Hattın durakları
python main.py --istatistik        # Kayıt istatistikleri
```

## Android APK Derleme

### Hızlı Başlangıç

```bash
cd mobil

# Bağımlılıkları kur
pip install buildozer cython kivy kivymd pillow requests

# İkonları oluştur
python create_icons.py

# APK derle (ilk seferde ~20 dakika)
chmod +x build_apk.sh
./build_apk.sh
```

### Adım Adım

**1. Sistem gereksinimleri** (Ubuntu/Debian):
```bash
sudo apt install -y python3-pip openjdk-17-jdk \
    build-essential git zip unzip autoconf libtool \
    pkg-config zlib1g-dev libncurses5-dev cmake \
    libffi-dev libssl-dev
```

**2. Buildozer kur:**
```bash
pip install --upgrade buildozer cython
```

**3. APK derle:**
```bash
cd mobil

# Debug APK
buildozer android debug

# Release APK (imzalı)
buildozer android release
```

**4. Telefona yükle:**
```bash
# USB ile (ADB gerekli)
adb install bin/iett_takip-1.0.0-debug.apk

# veya APK dosyasını telefona gönderip
# Ayarlar > Güvenlik > Bilinmeyen kaynaklar'ı açarak yükleyin
```

### Windows'ta Derleme

Windows'ta doğrudan buildozer çalışmaz. Seçenekler:

1. **WSL2** (Önerilen): Ubuntu WSL2 kurup yukarıdaki adımları takip edin
2. **Google Colab**: Ücretsiz GPU instance'da derleyin
3. **GitHub Actions**: CI/CD ile otomatik APK oluşturun

### Uygulama Ekranları

| Ekran | Açıklama |
|-------|----------|
| Ana Sayfa | Hat kodu girişi, hızlı erişim butonları |
| Hat Seçimi | Tüm hatlar listesi, arama/filtreleme |
| Durak Seçimi | Hattın durakları sıralı liste |
| Takip | Anlık otobüs listesi, ETA, kalan durak |
| Harita | Canlı harita, otobüs/durak marker'ları |
| Ayarlar | Uyarı, ses, titreşim, Telegram yapılandırma |
| Favoriler | Kayıtlı hat/durak, tek tıkla başlat |

## Telegram Bildirimi Kurulumu

1. Telegram'da [@BotFather](https://t.me/BotFather)'a `/newbot` yazın, token alın
2. Botunuza mesaj gönderin, sonra `https://api.telegram.org/bot<TOKEN>/getUpdates` ile `chat_id`'nizi öğrenin
3. `config.json`'a ekleyin:

```json
{
    "telegram_token": "123456789:ABCdefGhIjKlMnOpQrStUvWxYz",
    "telegram_chat_id": "987654321"
}
```

Artık otobüs uyarıları telefonunuza da gelecek.

## Yapılandırma

`config.json`:

```json
{
    "hat_kodu": "500T",
    "hedef_durak_kodu": "",
    "hedef_durak_adi": "",
    "uyari_durak_sayisi": 3,
    "kontrol_araligi_saniye": 30,
    "bildirim_sesi": true,
    "telegram_token": "",
    "telegram_chat_id": ""
}
```

## Mimari

```
├── main.py              CLI giriş noktası + interaktif mod
├── web_panel.py         Flask + Leaflet + Socket.IO web dashboard
├── iett_api.py          İBB SOAP API istemcisi (retry, cache, timeout)
├── takipci.py           Otobüs takip motoru + ETA + çoklu hat desteği
├── bildirim.py          Çoklu kanal bildirim (masaüstü, Telegram, web)
├── veritabani.py        SQLite (geçmiş, favoriler, ETA verileri)
├── config.json          Kullanıcı ayarları
└── mobil/
    ├── main.py          Kivy/KivyMD Android uygulaması
    ├── iett_api_mobil.py  Hafif SOAP istemci (zeep yerine requests+XML)
    ├── service_takip.py   Android arka plan servisi
    ├── buildozer.spec     APK derleme yapılandırması
    ├── build_apk.sh       Otomatik derleme scripti
    └── create_icons.py    İkon/splash oluşturucu
```

### Çalışma Akışı

```
1. Hat durakları SOAP API'den çekilir (cache'lenir)
2. Kullanıcı hedef durağı seçer
3. Her 30 saniyede otobüs GPS konumları sorgulanır
4. Haversine formülü ile her otobüsün en yakın durağı bulunur
5. Kalan durak sayısı ve ETA hesaplanır
6. Eşik değere ulaşınca tüm kanallardan bildirim gönderilir
7. Konum ve bildirim geçmişi SQLite'a kaydedilir
8. Web dashboard Socket.IO ile anlık güncellenir
```

## Veri Kaynağı

- **İBB Açık Veri Portalı**: https://data.ibb.gov.tr
- **SOAP WSDL**: `https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx?wsdl`
- **API Kısıtlaması**: Servisler her gece 00:15'ten sonra kapatılır

## İlgili Projeler

- [Otobüsüm Nerede](https://play.google.com/store/apps/details?id=com.iett.otobusumnerede) - İETT resmi uygulaması
- [iettnext](https://github.com/Rednexie/iettnext) - Açık kaynak İstanbul ulaşım uygulaması
- [dataibbgovtr](https://github.com/hakanatak/dataibbgovtr) - İBB İETT GeoJSON API
- [IBB.Api](https://github.com/AydinAdn/IBB.Api) - .NET İETT istemci kütüphanesi
- [On-Transit-App](https://github.com/EKarton/On-Transit-App) - Otobüs yaklaşma bildirimi
- [SG Bus Telegram Bot](https://github.com/guanquann/sg-bus-telegram-bot) - Singapur otobüs Telegram botu
- [Bus_Guide](https://github.com/wael-zegneni/Bus_Guide) - Flask + Leaflet canlı otobüs haritası

## Gereksinimler

- Python 3.10+
- İnternet bağlantısı
- Linux: `libnotify-bin` (bildirim için, opsiyonel)
