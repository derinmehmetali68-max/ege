#!/usr/bin/env python3
"""
İETT Otobüs Bildirim & Takip Sistemi
=====================================

İstanbul İETT otobüslerini anlık takip eder ve seçtiğiniz durağa
belirli sayıda durak kala masaüstü bildirimi gönderir.

Kullanım:
    python main.py                  # İnteraktif mod
    python main.py --hat 500T       # Doğrudan hat belirt
    python main.py --hat 500T --durak-kod 123456
    python main.py --hat 500T --durak-ad "Kadıköy"
    python main.py --listele 500T   # Hattın duraklarını listele
    python main.py --hatlar         # Tüm hatları listele

Veri Kaynağı:
    İBB Açık Veri Portalı SOAP API
    https://data.ibb.gov.tr
"""

import argparse
import json
import logging
import os
import sys

from iett_api import IETTApi, IETTApiError
from takipci import OtobusTakipci

CONFIG_DOSYASI = os.path.join(os.path.dirname(__file__), "config.json")


def konfigurasyon_yukle() -> dict:
    """config.json dosyasından ayarları yükler."""
    varsayilan = {
        "hat_kodu": "",
        "hedef_durak_kodu": "",
        "hedef_durak_adi": "",
        "uyari_durak_sayisi": 3,
        "kontrol_araligi_saniye": 30,
        "bildirim_sesi": True,
    }
    if os.path.exists(CONFIG_DOSYASI):
        try:
            with open(CONFIG_DOSYASI, "r", encoding="utf-8") as f:
                kayitli = json.load(f)
                varsayilan.update(kayitli)
        except (json.JSONDecodeError, OSError) as e:
            logging.warning("config.json okunamadı: %s", e)
    return varsayilan


def konfigurasyon_kaydet(config: dict) -> None:
    """Ayarları config.json dosyasına kaydeder."""
    try:
        with open(CONFIG_DOSYASI, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
    except OSError as e:
        logging.warning("config.json yazılamadı: %s", e)


def hatlari_listele() -> None:
    """Tüm İETT hatlarını listeler."""
    api = IETTApi()
    print("İETT hat listesi yükleniyor...")
    try:
        hatlar = api.tum_hatlari_getir()
        if not hatlar:
            print("Hat listesi boş döndü. API erişilemez olabilir.")
            return

        print(f"\nToplam {len(hatlar)} hat bulundu:\n")
        for hat in hatlar:
            kod = hat.get("SHESSION", hat.get("SHATNO", "?"))
            aciklama = hat.get("TAESSION", hat.get("SHATADI", ""))
            print(f"  {kod:10s}  {aciklama}")
    except IETTApiError as e:
        print(f"Hata: {e}")


def duraklari_listele(hat_kodu: str) -> None:
    """Bir hattın duraklarını listeler."""
    takipci = OtobusTakipci(hat_kodu=hat_kodu)
    print(f"Hat '{hat_kodu}' durak listesi yükleniyor...")
    try:
        duraklar = takipci.duraklari_listele()
        if not duraklar:
            print("Durak bilgisi bulunamadı.")
            return

        print(f"\nHat {hat_kodu} - {len(duraklar)} durak:\n")
        print(f"  {'Sıra':>5s}  {'Durak Kodu':>12s}  {'Durak Adı'}")
        print(f"  {'─' * 5}  {'─' * 12}  {'─' * 40}")
        for durak in duraklar:
            print(f"  {durak.sira:5d}  {durak.kod:>12s}  {durak.ad}")
    except IETTApiError as e:
        print(f"Hata: {e}")


def interaktif_hat_sec() -> str:
    """Kullanıcıdan hat kodu alır."""
    print("\n" + "=" * 60)
    print("  İETT Otobüs Bildirim Sistemi")
    print("  İstanbul Otobüs Takip & Uyarı")
    print("=" * 60)

    while True:
        hat_kodu = input("\nHat kodu girin (örn: 500T, 34BZ, 15F): ").strip().upper()
        if hat_kodu:
            return hat_kodu
        print("Lütfen geçerli bir hat kodu girin.")


def interaktif_durak_sec(takipci: OtobusTakipci) -> None:
    """Kullanıcıya duraklardan birini seçtirir."""
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
        secim = input("Hedef durak sıra numarasını girin: ").strip()
        try:
            sira = int(secim)
            for durak in duraklar:
                if durak.sira == sira:
                    takipci.hedef_durak_kodu = durak.kod
                    takipci.hedef_durak = durak
                    print(f"\nSeçilen durak: [{durak.kod}] {durak.ad}")
                    return
            print("Geçersiz sıra numarası. Tekrar deneyin.")
        except ValueError:
            print("Lütfen bir sayı girin.")


def main() -> None:
    """Ana giriş noktası."""
    parser = argparse.ArgumentParser(
        description="İETT Otobüs Bildirim & Takip Sistemi",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Örnekler:
  %(prog)s --hat 500T                    İnteraktif durak seçimi
  %(prog)s --hat 500T --durak-kod 123456 Direkt takip başlat
  %(prog)s --hat 500T --durak-ad Kadıköy İsimle durak ara
  %(prog)s --listele 500T                Hattın duraklarını listele
  %(prog)s --hatlar                      Tüm hatları listele
  %(prog)s --hat 500T --kala 5           5 durak kala uyar

Veri Kaynağı: İBB Açık Veri Portalı (data.ibb.gov.tr)
        """,
    )

    parser.add_argument("--hat", type=str, help="Hat kodu (örn: 500T)")
    parser.add_argument("--durak-kod", type=str, help="Hedef durak kodu")
    parser.add_argument("--durak-ad", type=str, help="Hedef durak adı (kısmi eşleşme)")
    parser.add_argument(
        "--kala", type=int, default=None,
        help="Kaç durak kala uyarı verilsin (varsayılan: 3)",
    )
    parser.add_argument(
        "--aralik", type=int, default=None,
        help="Kontrol aralığı - saniye (varsayılan: 30)",
    )
    parser.add_argument(
        "--sessiz", action="store_true",
        help="Bildirim sesini kapat",
    )
    parser.add_argument(
        "--listele", type=str, metavar="HAT_KODU",
        help="Hattın duraklarını listele",
    )
    parser.add_argument(
        "--hatlar", action="store_true",
        help="Tüm İETT hatlarını listele",
    )
    parser.add_argument(
        "--debug", action="store_true",
        help="Debug loglarını göster",
    )

    args = parser.parse_args()

    # Loglama ayarı
    log_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Tüm hatları listele
    if args.hatlar:
        hatlari_listele()
        return

    # Belirli bir hattın duraklarını listele
    if args.listele:
        duraklari_listele(args.listele)
        return

    # Konfigürasyon yükle
    config = konfigurasyon_yukle()

    # Hat kodunu belirle
    hat_kodu = args.hat or config.get("hat_kodu", "")
    if not hat_kodu:
        hat_kodu = interaktif_hat_sec()

    # Takipci oluştur
    takipci = OtobusTakipci(
        hat_kodu=hat_kodu,
        hedef_durak_kodu=args.durak_kod or config.get("hedef_durak_kodu", ""),
        hedef_durak_adi=args.durak_ad or config.get("hedef_durak_adi", ""),
        uyari_durak_sayisi=args.kala or config.get("uyari_durak_sayisi", 3),
        kontrol_araligi=args.aralik or config.get("kontrol_araligi_saniye", 30),
        bildirim_sesi=not args.sessiz and config.get("bildirim_sesi", True),
    )

    # Hedef durak belirlenmemişse interaktif seç
    if not takipci.hedef_durak_kodu and not takipci.hedef_durak_adi:
        interaktif_durak_sec(takipci)

    # Ayarları kaydet
    config.update({
        "hat_kodu": hat_kodu,
        "hedef_durak_kodu": takipci.hedef_durak_kodu,
        "hedef_durak_adi": takipci.hedef_durak_adi,
        "uyari_durak_sayisi": takipci.uyari_durak_sayisi,
        "kontrol_araligi_saniye": takipci.kontrol_araligi,
        "bildirim_sesi": takipci.bildirim_sesi,
    })
    konfigurasyon_kaydet(config)

    # Takibi başlat
    try:
        takipci.takip_baslat()
    except IETTApiError as e:
        print(f"\nAPI Hatası: {e}")
        print("İBB SOAP servisleri gece 00:15'ten sonra kapatılır.")
        print("Lütfen daha sonra tekrar deneyin.")
        sys.exit(1)
    except Exception as e:
        logging.exception("Beklenmeyen hata:")
        sys.exit(1)


if __name__ == "__main__":
    main()
