#!/usr/bin/env python3
"""
İETT Otobüs Bildirim & Takip Sistemi
=====================================

Kullanım:
    python main.py                          # İnteraktif mod
    python main.py --hat 500T               # Doğrudan hat belirt
    python main.py --hat 500T --durak-kod 123456
    python main.py --hat 500T --durak-ad "Kadıköy"
    python main.py --listele 500T           # Duraklarını listele
    python main.py --hatlar                 # Tüm hatları listele
    python main.py --web                    # Web dashboard başlat
    python main.py --favoriler              # Favori listesinden takip başlat
"""

import argparse
import json
import logging
import os
import sys

from iett_api import IETTApi, IETTApiError
from takipci import OtobusTakipci, CokluTakipci
from bildirim import BildirimYoneticisi
from veritabani import Veritabani

CONFIG_DOSYASI = os.path.join(os.path.dirname(__file__), "config.json")


def konfigurasyon_yukle() -> dict:
    varsayilan = {
        "hat_kodu": "",
        "hedef_durak_kodu": "",
        "hedef_durak_adi": "",
        "uyari_durak_sayisi": 3,
        "kontrol_araligi_saniye": 30,
        "bildirim_sesi": True,
        "telegram_token": "",
        "telegram_chat_id": "",
    }
    if os.path.exists(CONFIG_DOSYASI):
        try:
            with open(CONFIG_DOSYASI, "r", encoding="utf-8") as f:
                varsayilan.update(json.load(f))
        except (json.JSONDecodeError, OSError):
            pass
    return varsayilan


def konfigurasyon_kaydet(config: dict) -> None:
    try:
        with open(CONFIG_DOSYASI, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
    except OSError:
        pass


def hatlari_listele() -> None:
    api = IETTApi()
    print("İETT hat listesi yükleniyor...")
    try:
        hatlar = api.tum_hatlari_getir()
        if not hatlar:
            print("Hat listesi boş. API erişilemez olabilir.")
            return
        print(f"\nToplam {len(hatlar)} hat:\n")
        for hat in hatlar:
            kod = hat.get("SHESSION", hat.get("SHATNO", "?"))
            aciklama = hat.get("TAESSION", hat.get("SHATADI", ""))
            print(f"  {kod:10s}  {aciklama}")
    except IETTApiError as e:
        print(f"Hata: {e}")


def duraklari_listele(hat_kodu: str) -> None:
    takipci = OtobusTakipci(hat_kodu=hat_kodu)
    print(f"Hat '{hat_kodu}' durak listesi yükleniyor...")
    try:
        duraklar = takipci.duraklari_listele()
        if not duraklar:
            print("Durak bilgisi bulunamadı.")
            return
        print(f"\nHat {hat_kodu} - {len(duraklar)} durak:\n")
        print(f"  {'Sıra':>5s}  {'Kod':>12s}  {'Durak Adı'}")
        print(f"  {'─' * 5}  {'─' * 12}  {'─' * 40}")
        for durak in duraklar:
            print(f"  {durak.sira:5d}  {durak.kod:>12s}  {durak.ad}")
    except IETTApiError as e:
        print(f"Hata: {e}")


def favoriler_goster(db: Veritabani) -> None:
    favoriler = db.favorileri_getir()
    if not favoriler:
        print("Kayıtlı favori yok. Web panelden veya --favori-ekle ile ekleyebilirsiniz.")
        return

    print(f"\nFavoriler ({len(favoriler)} kayıt):\n")
    for i, f in enumerate(favoriler, 1):
        print(f"  {i}. Hat {f.hat_kodu} -> {f.durak_adi} ({f.uyari_durak_sayisi} durak kala)")

    secim = input("\nTakip başlatmak için numara girin (0=çık): ").strip()
    try:
        idx = int(secim)
        if 1 <= idx <= len(favoriler):
            fav = favoriler[idx - 1]
            return fav
    except ValueError:
        pass
    return None


def interaktif_hat_sec() -> str:
    print("\n" + "=" * 60)
    print("  İETT Otobüs Bildirim Sistemi")
    print("=" * 60)
    while True:
        hat_kodu = input("\nHat kodu girin (örn: 500T, 34BZ): ").strip().upper()
        if hat_kodu:
            return hat_kodu
        print("Geçerli bir hat kodu girin.")


def interaktif_durak_sec(takipci: OtobusTakipci) -> None:
    try:
        duraklar = takipci.duraklari_listele()
    except IETTApiError as e:
        print(f"Hata: {e}")
        sys.exit(1)

    if not duraklar:
        print("Bu hat için durak bulunamadı.")
        sys.exit(1)

    print(f"\nHat {takipci.hat_kodu} durakları:")
    print(f"  {'No':>4s}  {'Durak Adı'}")
    print(f"  {'─' * 4}  {'─' * 45}")
    for durak in duraklar:
        print(f"  {durak.sira:4d}  {durak.ad}")

    print()
    while True:
        secim = input("Hedef durak sıra numarası: ").strip()
        try:
            sira = int(secim)
            for durak in duraklar:
                if durak.sira == sira:
                    takipci.hedef_durak_kodu = durak.kod
                    takipci.hedef_durak = durak
                    print(f"\nSeçilen: [{durak.kod}] {durak.ad}")
                    return
            print("Geçersiz numara.")
        except ValueError:
            print("Sayı girin.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="İETT Otobüs Bildirim & Takip Sistemi",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Örnekler:
  %(prog)s --hat 500T --durak-ad Kadıköy   CLI takip
  %(prog)s --web                            Web dashboard
  %(prog)s --web --port 8080                Farklı port
  %(prog)s --favoriler                      Favorilerden takip
  %(prog)s --listele 500T                   Durak listesi
  %(prog)s --hatlar                         Tüm hatlar
        """,
    )

    parser.add_argument("--hat", type=str, help="Hat kodu (örn: 500T)")
    parser.add_argument("--durak-kod", type=str, help="Hedef durak kodu")
    parser.add_argument("--durak-ad", type=str, help="Hedef durak adı")
    parser.add_argument("--kala", type=int, help="Kaç durak kala uyarı (varsayılan: 3)")
    parser.add_argument("--aralik", type=int, help="Kontrol aralığı saniye (varsayılan: 30)")
    parser.add_argument("--sessiz", action="store_true", help="Ses kapalı")
    parser.add_argument("--listele", type=str, metavar="HAT", help="Hattın duraklarını listele")
    parser.add_argument("--hatlar", action="store_true", help="Tüm hatları listele")
    parser.add_argument("--web", action="store_true", help="Web dashboard başlat")
    parser.add_argument("--port", type=int, default=5000, help="Web dashboard portu")
    parser.add_argument("--favoriler", action="store_true", help="Favorilerden takip başlat")
    parser.add_argument("--istatistik", action="store_true", help="İstatistikleri göster")
    parser.add_argument("--debug", action="store_true", help="Debug logları")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Web dashboard modu
    if args.web:
        from web_panel import main as web_main
        sys.argv = ["web_panel.py", "--port", str(args.port)]
        if args.debug:
            sys.argv.append("--debug")
        web_main()
        return

    # Tüm hatlar
    if args.hatlar:
        hatlari_listele()
        return

    # Durak listesi
    if args.listele:
        duraklari_listele(args.listele)
        return

    # DB & config
    db = Veritabani()
    config = konfigurasyon_yukle()

    # İstatistik
    if args.istatistik:
        stats = db.istatistik_getir()
        print("\nİstatistikler:")
        print(f"  Toplam konum kaydı: {stats['toplam_konum_kaydi']}")
        print(f"  Toplam bildirim:    {stats['toplam_bildirim']}")
        print(f"  Toplam favori:      {stats['toplam_favori']}")
        return

    # Favorilerden seç
    if args.favoriler:
        fav = favoriler_goster(db)
        if fav is None:
            return
        args.hat = fav.hat_kodu
        args.durak_kod = fav.durak_kodu
        args.kala = fav.uyari_durak_sayisi

    # Bildirim yöneticisi
    bildirim_yon = BildirimYoneticisi(
        masaustu=True,
        ses=not args.sessiz and config.get("bildirim_sesi", True),
        telegram_token=config.get("telegram_token", ""),
        telegram_chat_id=config.get("telegram_chat_id", ""),
    )

    # Hat kodu
    hat_kodu = args.hat or config.get("hat_kodu", "")
    if not hat_kodu:
        hat_kodu = interaktif_hat_sec()

    # Takipci
    takipci = OtobusTakipci(
        hat_kodu=hat_kodu,
        hedef_durak_kodu=args.durak_kod or config.get("hedef_durak_kodu", ""),
        hedef_durak_adi=args.durak_ad or config.get("hedef_durak_adi", ""),
        uyari_durak_sayisi=args.kala or config.get("uyari_durak_sayisi", 3),
        kontrol_araligi=args.aralik or config.get("kontrol_araligi_saniye", 30),
        bildirim=bildirim_yon,
        veritabani=db,
    )

    if not takipci.hedef_durak_kodu and not takipci.hedef_durak_adi:
        interaktif_durak_sec(takipci)

    # Config kaydet
    config.update({
        "hat_kodu": hat_kodu,
        "hedef_durak_kodu": takipci.hedef_durak_kodu,
        "hedef_durak_adi": takipci.hedef_durak_adi,
        "uyari_durak_sayisi": takipci.uyari_durak_sayisi,
        "kontrol_araligi_saniye": takipci.kontrol_araligi,
    })
    konfigurasyon_kaydet(config)

    try:
        takipci.takip_baslat()
    except IETTApiError as e:
        print(f"\nAPI Hatası: {e}")
        print("İBB SOAP servisleri gece 00:15'ten sonra kapatılır.")
        sys.exit(1)


if __name__ == "__main__":
    main()
