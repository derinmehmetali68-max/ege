# İETT Otobüs Bildirim & Takip Sistemi

İstanbul İETT otobüslerini anlık olarak takip eden, seçtiğiniz durağa belirli sayıda durak kala **masaüstü + Telegram bildirimi** gönderen ve **harita üzerinde canlı takip** sunan Python uygulaması.

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
main.py          CLI giriş noktası + interaktif mod
web_panel.py     Flask + Leaflet + Socket.IO web dashboard
iett_api.py      İBB SOAP API istemcisi (retry, cache, timeout)
takipci.py       Otobüs takip motoru + ETA + çoklu hat desteği
bildirim.py      Çoklu kanal bildirim (masaüstü, Telegram, web)
veritabani.py    SQLite (geçmiş, favoriler, ETA verileri)
config.json      Kullanıcı ayarları
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
