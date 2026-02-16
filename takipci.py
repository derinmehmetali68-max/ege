"""
Otobüs Takip Motoru

Belirli bir hat üzerindeki otobüslerin seçilen durağa kaç durak
kaldığını hesaplar ve yaklaşma durumunda bildirim gönderir.
"""

import logging
import time
from dataclasses import dataclass, field

from iett_api import IETTApi, IETTApiError
from bildirim import bildirim_gonder

logger = logging.getLogger(__name__)


@dataclass
class Durak:
    """Bir durağın bilgileri."""
    kod: str
    ad: str
    enlem: float
    boylam: float
    sira: int


@dataclass
class OtobusKonum:
    """Bir otobüsün anlık konum bilgisi."""
    plaka: str
    enlem: float
    boylam: float
    hiz: float
    saat: str
    kapi_no: str
    yakin_durak_sira: int = -1
    yakin_durak_ad: str = ""


@dataclass
class TakipSonucu:
    """Takip döngüsünün bir iterasyonunun sonucu."""
    hat_kodu: str
    hedef_durak: Durak
    otobusler: list[OtobusKonum] = field(default_factory=list)
    uyari_verilen: list[OtobusKonum] = field(default_factory=list)
    hata: str = ""


class OtobusTakipci:
    """
    Bir İETT hattını izler ve hedef durağa yaklaşan otobüsleri bildirir.

    Kullanım:
        takipci = OtobusTakipci(
            hat_kodu="500T",
            hedef_durak_kodu="123456",
            uyari_durak_sayisi=3,
        )
        takipci.takip_baslat()
    """

    def __init__(
        self,
        hat_kodu: str,
        hedef_durak_kodu: str = "",
        hedef_durak_adi: str = "",
        uyari_durak_sayisi: int = 3,
        kontrol_araligi: int = 30,
        bildirim_sesi: bool = True,
    ):
        self.hat_kodu = hat_kodu.upper().strip()
        self.hedef_durak_kodu = hedef_durak_kodu.strip()
        self.hedef_durak_adi = hedef_durak_adi.strip()
        self.uyari_durak_sayisi = uyari_durak_sayisi
        self.kontrol_araligi = kontrol_araligi
        self.bildirim_sesi = bildirim_sesi

        self.api = IETTApi()
        self.hat_duraklari: list[Durak] = []
        self.hedef_durak: Durak | None = None
        self._bildirim_gonderilen: set[str] = set()
        self._calisiyor = False

    def hat_bilgilerini_yukle(self) -> None:
        """Hat durak bilgilerini API'den yükler."""
        logger.info("Hat '%s' durak bilgileri yükleniyor...", self.hat_kodu)

        ham_duraklar = self.api.hat_durak_getir(self.hat_kodu)
        if not ham_duraklar:
            raise IETTApiError(
                f"'{self.hat_kodu}' hattı için durak bilgisi bulunamadı. "
                "Hat kodunu kontrol edin."
            )

        self.hat_duraklari = []
        for i, d in enumerate(ham_duraklar):
            try:
                durak = Durak(
                    kod=str(d.get("DUESSION", d.get("DURESSION", d.get("SDURAKKODU", "")))),
                    ad=str(d.get("DAESSION", d.get("SDURAKADI", ""))),
                    enlem=float(d.get("YKOORD", d.get("ENLEM", 0))),
                    boylam=float(d.get("XKOORD", d.get("BOYLAM", 0))),
                    sira=int(d.get("SIESSION", i + 1)),
                )
                self.hat_duraklari.append(durak)
            except (ValueError, TypeError) as e:
                logger.warning("Durak parse hatası (atlanıyor): %s", e)

        self.hat_duraklari.sort(key=lambda d: d.sira)
        logger.info(
            "Hat '%s': %d durak yüklendi.", self.hat_kodu, len(self.hat_duraklari)
        )

    def hedef_durak_belirle(self) -> Durak:
        """Hedef durağı belirler (kod veya isme göre)."""
        if not self.hat_duraklari:
            self.hat_bilgilerini_yukle()

        # Durak kodu ile ara
        if self.hedef_durak_kodu:
            for durak in self.hat_duraklari:
                if durak.kod == self.hedef_durak_kodu:
                    self.hedef_durak = durak
                    logger.info(
                        "Hedef durak: [%s] %s (sıra: %d)",
                        durak.kod, durak.ad, durak.sira,
                    )
                    return durak

        # Durak adı ile ara (kısmi eşleşme)
        if self.hedef_durak_adi:
            aranan = self.hedef_durak_adi.upper()
            for durak in self.hat_duraklari:
                if aranan in durak.ad.upper():
                    self.hedef_durak = durak
                    logger.info(
                        "Hedef durak (isim eşleşmesi): [%s] %s (sıra: %d)",
                        durak.kod, durak.ad, durak.sira,
                    )
                    return durak

        raise IETTApiError(
            f"Hedef durak bulunamadı. Kod: '{self.hedef_durak_kodu}', "
            f"Ad: '{self.hedef_durak_adi}'"
        )

    def duraklari_listele(self) -> list[Durak]:
        """Hattın tüm duraklarını listeler (interaktif seçim için)."""
        if not self.hat_duraklari:
            self.hat_bilgilerini_yukle()
        return self.hat_duraklari

    def otobus_konumlari_getir(self) -> list[OtobusKonum]:
        """Hat üzerindeki otobüslerin anlık konumlarını getirir."""
        ham = self.api.hat_otobusleri_getir(self.hat_kodu)
        otobusler = []

        for o in ham:
            try:
                otobus = OtobusKonum(
                    plaka=str(o.get("Plaka", "")),
                    enlem=float(o.get("Enlem", 0)),
                    boylam=float(o.get("Boylam", 0)),
                    hiz=float(o.get("Hiz", 0)),
                    saat=str(o.get("Saat", "")),
                    kapi_no=str(o.get("KapiNo", "")),
                )
                if otobus.enlem != 0 and otobus.boylam != 0:
                    otobusler.append(otobus)
            except (ValueError, TypeError) as e:
                logger.warning("Otobüs konum parse hatası: %s", e)

        return otobusler

    def en_yakin_durak_bul(self, otobus: OtobusKonum) -> tuple[int, str]:
        """
        Otobüsün en yakın olduğu durağı bulur.

        Returns:
            (durak_sira_no, durak_adi) tuple'ı
        """
        min_mesafe = float("inf")
        en_yakin_sira = -1
        en_yakin_ad = ""

        for durak in self.hat_duraklari:
            mesafe = IETTApi._haversine(
                otobus.enlem, otobus.boylam, durak.enlem, durak.boylam
            )
            if mesafe < min_mesafe:
                min_mesafe = mesafe
                en_yakin_sira = durak.sira
                en_yakin_ad = durak.ad

        return en_yakin_sira, en_yakin_ad

    def kalan_durak_hesapla(self, otobus_durak_sira: int) -> int:
        """
        Otobüsün hedef durağa kaç durak kaldığını hesaplar.

        Returns:
            Kalan durak sayısı. Negatif ise otobüs hedefi geçmiştir.
        """
        if self.hedef_durak is None:
            return -999
        return self.hedef_durak.sira - otobus_durak_sira

    def kontrol_et(self) -> TakipSonucu:
        """
        Tek bir kontrol döngüsü çalıştırır.

        Returns:
            TakipSonucu nesnesi
        """
        if self.hedef_durak is None:
            self.hedef_durak_belirle()

        sonuc = TakipSonucu(
            hat_kodu=self.hat_kodu,
            hedef_durak=self.hedef_durak,
        )

        try:
            otobusler = self.otobus_konumlari_getir()
            sonuc.otobusler = otobusler

            if not otobusler:
                logger.info("Şu an hat '%s' üzerinde aktif otobüs yok.", self.hat_kodu)
                return sonuc

            for otobus in otobusler:
                yakin_sira, yakin_ad = self.en_yakin_durak_bul(otobus)
                otobus.yakin_durak_sira = yakin_sira
                otobus.yakin_durak_ad = yakin_ad
                kalan = self.kalan_durak_hesapla(yakin_sira)

                if 0 < kalan <= self.uyari_durak_sayisi:
                    bildirim_key = f"{otobus.plaka}_{kalan}"
                    if bildirim_key not in self._bildirim_gonderilen:
                        self._bildirim_gonderilen.add(bildirim_key)

                        aciliyet = "acil" if kalan == 1 else "normal"
                        baslik = f"Otobüs {kalan} Durak Kala!"
                        mesaj = (
                            f"Hat {self.hat_kodu} - Plaka: {otobus.plaka}\n"
                            f"Şu an: {yakin_ad}\n"
                            f"Hedef: {self.hedef_durak.ad}\n"
                            f"Kalan: {kalan} durak"
                        )

                        bildirim_gonder(
                            baslik=baslik,
                            mesaj=mesaj,
                            ses_cal=self.bildirim_sesi,
                            aciliyet=aciliyet,
                        )
                        sonuc.uyari_verilen.append(otobus)
                        logger.info(
                            "UYARI: %s plakalı otobüs %d durak kala! (%s)",
                            otobus.plaka, kalan, yakin_ad,
                        )

                elif kalan == 0:
                    bildirim_key = f"{otobus.plaka}_VARILDI"
                    if bildirim_key not in self._bildirim_gonderilen:
                        self._bildirim_gonderilen.add(bildirim_key)
                        bildirim_gonder(
                            baslik="Otobüs Durağınıza Ulaştı!",
                            mesaj=(
                                f"Hat {self.hat_kodu} - Plaka: {otobus.plaka}\n"
                                f"Durağınız: {self.hedef_durak.ad}\n"
                                f"Otobüs durağınıza ulaştı!"
                            ),
                            ses_cal=self.bildirim_sesi,
                            aciliyet="acil",
                        )
                        sonuc.uyari_verilen.append(otobus)

        except IETTApiError as e:
            sonuc.hata = str(e)
            logger.error("API hatası: %s", e)

        return sonuc

    def durum_ozeti(self, sonuc: TakipSonucu) -> str:
        """Takip sonucunun okunabilir özetini döndürür."""
        lines = []
        lines.append(f"Hat: {sonuc.hat_kodu} | Hedef: {sonuc.hedef_durak.ad}")
        lines.append(f"Aktif otobüs: {len(sonuc.otobusler)}")
        lines.append("-" * 50)

        for otobus in sonuc.otobusler:
            kalan = self.kalan_durak_hesapla(otobus.yakin_durak_sira)
            durum = ""
            if kalan > 0:
                durum = f"{kalan} durak kala"
            elif kalan == 0:
                durum = "DURAKTA!"
            else:
                durum = "Geçti"

            lines.append(
                f"  {otobus.plaka:12s} | {otobus.yakin_durak_ad:30s} | {durum}"
            )

        if sonuc.hata:
            lines.append(f"\nHATA: {sonuc.hata}")

        return "\n".join(lines)

    def takip_baslat(self) -> None:
        """
        Sürekli takip döngüsünü başlatır.
        Ctrl+C ile durdurulabilir.
        """
        logger.info("Takip başlatılıyor: Hat %s", self.hat_kodu)
        self.hat_bilgilerini_yukle()
        self.hedef_durak_belirle()

        print(f"\n{'=' * 60}")
        print(f"  İETT Otobüs Takip Sistemi")
        print(f"  Hat: {self.hat_kodu}")
        print(f"  Hedef Durak: [{self.hedef_durak.kod}] {self.hedef_durak.ad}")
        print(f"  Uyarı: {self.uyari_durak_sayisi} durak kala bildirim")
        print(f"  Kontrol Aralığı: {self.kontrol_araligi} saniye")
        print(f"{'=' * 60}")
        print(f"  Durdurmak için Ctrl+C\n")

        self._calisiyor = True
        try:
            while self._calisiyor:
                sonuc = self.kontrol_et()
                print(f"\n[{time.strftime('%H:%M:%S')}]")
                print(self.durum_ozeti(sonuc))
                time.sleep(self.kontrol_araligi)
        except KeyboardInterrupt:
            print("\nTakip durduruldu.")
            self._calisiyor = False

    def takip_durdur(self) -> None:
        """Takip döngüsünü durdurur."""
        self._calisiyor = False
