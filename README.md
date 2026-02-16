# İETT Otobüs Bildirim & Takip Sistemi

İstanbul İETT otobüslerini anlık olarak takip eden ve seçtiğiniz durağa belirli sayıda durak kala **masaüstü bildirimi** gönderen Python uygulaması.

## Özellikler

- **Anlık otobüs takibi**: İBB Açık Veri SOAP API üzerinden hat bazlı canlı otobüs konumları
- **Durak yaklaşma uyarısı**: Hedef durağınıza X durak kala masaüstü bildirimi
- **Çapraz platform bildirim**: Linux (notify-send), macOS (osascript), Windows (toast notification)
- **Sesli uyarı**: Bildirim ile birlikte sesli ikaz
- **İnteraktif mod**: Hat ve durak seçimini adım adım yapın
- **Komut satırı desteği**: Parametrelerle doğrudan çalıştırın
- **Konfigürasyon dosyası**: Son ayarlarınız `config.json`'da saklanır

## Kurulum

```bash
# Gerekli paketleri yükleyin
pip install -r requirements.txt

# Linux'ta bildirim desteği için (Ubuntu/Debian)
sudo apt install libnotify-bin

# Linux'ta ses desteği için (opsiyonel)
sudo apt install pulseaudio-utils
```

## Kullanım

### İnteraktif Mod
```bash
python main.py
```
Hat kodunu girin, durak listesinden hedef durağınızı seçin, takip otomatik başlasın.

### Komut Satırı
```bash
# Belirli hat ve durak kodu ile
python main.py --hat 500T --durak-kod 123456

# Durak adı ile arama (kısmi eşleşme)
python main.py --hat 500T --durak-ad "Kadıköy"

# 5 durak kala uyar, 20 saniye aralıkla kontrol et
python main.py --hat 500T --durak-ad "Beşiktaş" --kala 5 --aralik 20

# Sessiz mod (ses kapalı)
python main.py --hat 34BZ --durak-ad "Taksim" --sessiz
```

### Bilgi Komutları
```bash
# Tüm İETT hatlarını listele
python main.py --hatlar

# Bir hattın duraklarını listele
python main.py --listele 500T

# Debug modu
python main.py --hat 500T --debug
```

## Yapılandırma

`config.json` dosyası ile varsayılan ayarları belirleyebilirsiniz:

```json
{
    "hat_kodu": "500T",
    "hedef_durak_kodu": "",
    "hedef_durak_adi": "",
    "uyari_durak_sayisi": 3,
    "kontrol_araligi_saniye": 30,
    "bildirim_sesi": true
}
```

| Alan | Açıklama | Varsayılan |
|------|----------|------------|
| `hat_kodu` | Takip edilecek hat | `""` |
| `hedef_durak_kodu` | Hedef durak kodu | `""` |
| `hedef_durak_adi` | Hedef durak adı (kısmi eşleşme) | `""` |
| `uyari_durak_sayisi` | Kaç durak kala uyarı | `3` |
| `kontrol_araligi_saniye` | API kontrol sıklığı (sn) | `30` |
| `bildirim_sesi` | Sesli bildirim | `true` |

## Mimari

```
main.py        → Ana uygulama (CLI + interaktif mod)
iett_api.py    → İBB SOAP API istemcisi (zeep)
takipci.py     → Otobüs takip motoru & durak yakınlık hesabı
bildirim.py    → Çapraz platform masaüstü bildirim sistemi
config.json    → Kullanıcı ayarları
```

### Nasıl Çalışır

1. **Hat durakları yüklenir**: SOAP API'den hat güzergahındaki duraklar sıralı olarak çekilir
2. **Hedef durak belirlenir**: Kullanıcının seçtiği durak sıra numarası kaydedilir
3. **Otobüs konumları sorgulanır**: Periyodik olarak hat üzerindeki otobüslerin GPS konumları alınır
4. **En yakın durak hesaplanır**: Her otobüsün Haversine formülü ile en yakın durağı bulunur
5. **Kalan durak sayısı hesaplanır**: Otobüsün bulunduğu durak ile hedef durak arasındaki fark
6. **Bildirim gönderilir**: Eşik değere (varsayılan 3 durak) ulaşınca masaüstü bildirimi

## Veri Kaynağı

- **İBB Açık Veri Portalı**: https://data.ibb.gov.tr
- **SOAP WSDL**: `https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx?wsdl`
- **API Kısıtlaması**: Servisler her gece 00:15'ten sonra kapatılır

## İlgili Projeler & Kaynaklar

- [Otobüsüm Nerede](https://play.google.com/store/apps/details?id=com.iett.otobusumnerede) - İETT resmi uygulaması
- [iettnext](https://github.com/Rednexie/iettnext) - Açık kaynak İstanbul ulaşım uygulaması
- [dataibbgovtr](https://github.com/hakanatak/dataibbgovtr) - İBB İETT GeoJSON API
- [IBB.Api](https://github.com/AydinAdn/IBB.Api) - .NET İETT istemci kütüphanesi
- [On-Transit-App](https://github.com/EKarton/On-Transit-App) - Otobüs yaklaşma bildirimi (genel)
- [İBB Mekansal Açık Veri](https://medium.com/@hakanatak34/i%CC%87bb-mekansal-a%C3%A7%C4%B1k-veri-api-d6dbe16bcb61) - API kullanım rehberi

## Gereksinimler

- Python 3.10+
- İnternet bağlantısı
- Linux: `libnotify-bin` (bildirim için)
- Windows: Ek paket gerekmez
- macOS: Ek paket gerekmez
