"""
Android Arka Plan Servisi - Otobüs Takip

Bu servis, uygulama arka plandayken bile otobüs takibine devam eder
ve Android bildirim sistemi üzerinden uyarı gönderir.

Buildozer ile foreground service olarak çalışır:
  services = OtobusTakip:service_takip.py:foreground
"""

import json
import os
import time
import logging

logger = logging.getLogger(__name__)

# Android ortamı kontrolü
try:
    from jnius import autoclass
    from android import mActivity

    PythonService = autoclass("org.kivy.android.PythonService")
    Context = autoclass("android.content.Context")
    NotificationBuilder = autoclass("android.app.Notification$Builder")
    NotificationManager = autoclass("android.app.NotificationManager")
    NotificationChannel = autoclass("android.app.NotificationChannel")

    ANDROID = True
except ImportError:
    ANDROID = False


def bildirim_gonder(baslik: str, mesaj: str, acil: bool = False):
    """Android bildirim gönderir."""
    if not ANDROID:
        print(f"[BİLDİRİM] {baslik}: {mesaj}")
        return

    try:
        service = PythonService.mService
        manager = service.getSystemService(Context.NOTIFICATION_SERVICE)

        channel_id = "iett_arka_plan"
        importance = 4 if acil else 3
        channel = NotificationChannel(
            channel_id, "İETT Arka Plan Takip", importance
        )
        channel.enableVibration(True)
        manager.createNotificationChannel(channel)

        builder = NotificationBuilder(service, channel_id)
        builder.setContentTitle(baslik)
        builder.setContentText(mesaj)
        builder.setSmallIcon(service.getApplicationInfo().icon)
        builder.setAutoCancel(True)

        if acil:
            builder.setPriority(1)

        notification = builder.build()
        nid = int(time.time()) % 100000
        manager.notify(nid, notification)

    except Exception as e:
        logger.error("Bildirim hatası: %s", e)


def config_yukle() -> dict:
    """Servis konfigürasyonunu yükler."""
    defaults = {
        "hat_kodu": "",
        "durak_kodu": "",
        "durak_adi": "",
        "uyari_durak_sayisi": 3,
        "kontrol_araligi": 30,
    }

    if ANDROID:
        from android.storage import app_storage_path
        path = os.path.join(app_storage_path(), "service_config.json")
    else:
        path = os.path.join(os.path.dirname(__file__), "service_config.json")

    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                defaults.update(json.load(f))
        except Exception:
            pass

    return defaults


def main():
    """Arka plan servis ana döngüsü."""
    import iett_api_mobil as api

    config = config_yukle()
    hat_kodu = config.get("hat_kodu", "")
    durak_kodu = config.get("durak_kodu", "")
    durak_adi = config.get("durak_adi", "")
    uyari = config.get("uyari_durak_sayisi", 3)
    aralik = config.get("kontrol_araligi", 30)

    if not hat_kodu or not durak_kodu:
        logger.error("Hat veya durak bilgisi eksik!")
        return

    logger.info("Arka plan servisi başladı: %s -> %s", hat_kodu, durak_adi)

    # Durak bilgilerini yükle
    try:
        ham_duraklar = api.hat_durak_getir(hat_kodu)
    except Exception as e:
        logger.error("Durak yükleme hatası: %s", e)
        return

    duraklar = []
    hedef_sira = -1
    for i, d in enumerate(ham_duraklar):
        try:
            kod = str(d.get("DUESSION", d.get("DURESSION", "")))
            sira = int(d.get("SIESSION", i + 1))
            enlem = float(d.get("YKOORD", 0))
            boylam = float(d.get("XKOORD", 0))
            ad = d.get("DAESSION", "")
            duraklar.append({
                "kod": kod, "ad": ad, "sira": sira,
                "enlem": enlem, "boylam": boylam,
            })
            if kod == durak_kodu:
                hedef_sira = sira
        except (ValueError, TypeError):
            continue

    bildirim_cache = {}
    bildirim_ttl = 600

    # Foreground service bildirimi
    bildirim_gonder(
        "İETT Takip Aktif",
        f"Hat {hat_kodu} → {durak_adi} izleniyor",
    )

    while True:
        try:
            ham = api.hat_otobusleri_getir(hat_kodu)

            for o in ham:
                try:
                    enlem = float(o.get("Enlem", 0))
                    boylam = float(o.get("Boylam", 0))
                    if enlem == 0 and boylam == 0:
                        continue

                    plaka = str(o.get("Plaka", ""))
                    hiz = float(o.get("Hiz", 0))

                    # En yakın durak
                    min_mesafe = float("inf")
                    yakin_sira = -1
                    yakin_ad = ""
                    for durak in duraklar:
                        mesafe = api.haversine(
                            enlem, boylam, durak["enlem"], durak["boylam"]
                        )
                        if mesafe < min_mesafe:
                            min_mesafe = mesafe
                            yakin_sira = durak["sira"]
                            yakin_ad = durak["ad"]

                    kalan = hedef_sira - yakin_sira

                    # Bildirim
                    if 0 < kalan <= uyari:
                        bkey = f"{plaka}_{kalan}"
                        now = time.time()
                        if bkey not in bildirim_cache or \
                           (now - bildirim_cache[bkey]) > bildirim_ttl:
                            bildirim_cache[bkey] = now

                            eta_str = ""
                            if hiz > 0:
                                hedef_d = next(
                                    (d for d in duraklar if d["sira"] == hedef_sira),
                                    None,
                                )
                                if hedef_d:
                                    mesafe = api.haversine(
                                        enlem, boylam,
                                        hedef_d["enlem"], hedef_d["boylam"],
                                    )
                                    dk = int((mesafe * 1.4) / (hiz * 1000 / 3600) / 60)
                                    eta_str = f" (~{dk} dk)"

                            bildirim_gonder(
                                f"Otobüs {kalan} Durak Kala!",
                                f"{hat_kodu} - {plaka}\n{yakin_ad} → {durak_adi}{eta_str}",
                                kalan <= 1,
                            )

                    elif kalan == 0:
                        bkey = f"{plaka}_VARILDI"
                        now = time.time()
                        if bkey not in bildirim_cache or \
                           (now - bildirim_cache[bkey]) > bildirim_ttl:
                            bildirim_cache[bkey] = now
                            bildirim_gonder(
                                "Otobüs Durağınızda!",
                                f"{hat_kodu} - {plaka}\n{durak_adi}",
                                True,
                            )

                except (ValueError, TypeError):
                    continue

        except Exception as e:
            logger.error("Servis hata: %s", e)

        # Eski cache temizliği
        now = time.time()
        bildirim_cache = {
            k: v for k, v in bildirim_cache.items()
            if (now - v) < bildirim_ttl
        }

        time.sleep(aralik)


if __name__ == "__main__":
    main()
