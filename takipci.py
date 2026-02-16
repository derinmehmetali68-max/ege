"""
Otobüs Takip Motoru

Belirli bir hat üzerindeki otobüslerin seçilen durağa kaç durak
kaldığını hesaplar, ETA tahmini yapar ve bildirim gönderir.
Aynı anda birden fazla hat takip edilebilir.
"""

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from iett_api import IETTApi, IETTApiError
from bildirim import BildirimYoneticisi
from veritabani import Veritabani

logger = logging.getLogger(__name__)


@dataclass
class Durak:
    kod: str
    ad: str
    enlem: float
    boylam: float
    sira: int


@dataclass
class OtobusKonum:
    plaka: str
    enlem: float
    boylam: float
    hiz: float
    saat: str
    kapi_no: str
    yakin_durak_sira: int = -1
    yakin_durak_ad: str = ""
    yakin_durak_kod: str = ""
    kalan_durak: int = -999
    tahmini_varis: Optional[float] = None  # saniye


@dataclass
class TakipSonucu:
    hat_kodu: str
    hedef_durak: Durak
    otobusler: list[OtobusKonum] = field(default_factory=list)
    uyari_verilen: list[OtobusKonum] = field(default_factory=list)
    hata: str = ""
    kontrol_zamani: str = ""


class OtobusTakipci:
    """
    Bir İETT hattını izler ve hedef durağa yaklaşan otobüsleri bildirir.
    """

    def __init__(
        self,
        hat_kodu: str,
        hedef_durak_kodu: str = "",
        hedef_durak_adi: str = "",
        uyari_durak_sayisi: int = 3,
        kontrol_araligi: int = 30,
        bildirim: Optional[BildirimYoneticisi] = None,
        veritabani: Optional[Veritabani] = None,
    ):
        self.hat_kodu = hat_kodu.upper().strip()
        self.hedef_durak_kodu = hedef_durak_kodu.strip()
        self.hedef_durak_adi = hedef_durak_adi.strip()
        self.uyari_durak_sayisi = uyari_durak_sayisi
        self.kontrol_araligi = kontrol_araligi

        self.api = IETTApi()
        self.bildirim = bildirim or BildirimYoneticisi()
        self.db = veritabani or Veritabani()

        self.hat_duraklari: list[Durak] = []
        self.hedef_durak: Optional[Durak] = None

        # Bildirim tekrarını engelleme (TTL ile - 10 dakika sonra sıfırlanır)
        self._bildirim_cache: dict[str, float] = {}
        self._bildirim_ttl = 600  # 10 dakika

        # Önceki konum bilgisi (ETA hesabı için)
        self._onceki_konumlar: dict[str, tuple[int, float]] = {}  # plaka -> (durak_sira, zaman)

        self._calisiyor = False
        self._son_sonuc: Optional[TakipSonucu] = None

    @property
    def son_sonuc(self) -> Optional[TakipSonucu]:
        return self._son_sonuc

    def hat_bilgilerini_yukle(self) -> None:
        logger.info("Hat '%s' durak bilgileri yükleniyor...", self.hat_kodu)
        ham_duraklar = self.api.hat_durak_getir(self.hat_kodu)
        if not ham_duraklar:
            raise IETTApiError(
                f"'{self.hat_kodu}' hattı için durak bilgisi bulunamadı."
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
        logger.info("Hat '%s': %d durak yüklendi.", self.hat_kodu, len(self.hat_duraklari))

    def hedef_durak_belirle(self) -> Durak:
        if not self.hat_duraklari:
            self.hat_bilgilerini_yukle()

        if self.hedef_durak_kodu:
            for durak in self.hat_duraklari:
                if durak.kod == self.hedef_durak_kodu:
                    self.hedef_durak = durak
                    return durak

        if self.hedef_durak_adi:
            aranan = self.hedef_durak_adi.upper()
            for durak in self.hat_duraklari:
                if aranan in durak.ad.upper():
                    self.hedef_durak = durak
                    return durak

        raise IETTApiError(
            f"Hedef durak bulunamadı. Kod: '{self.hedef_durak_kodu}', Ad: '{self.hedef_durak_adi}'"
        )

    def duraklari_listele(self) -> list[Durak]:
        if not self.hat_duraklari:
            self.hat_bilgilerini_yukle()
        return self.hat_duraklari

    def _bildirim_gonderildi_mi(self, key: str) -> bool:
        """TTL tabanlı bildirim tekrar kontrolü."""
        if key in self._bildirim_cache:
            if (time.time() - self._bildirim_cache[key]) < self._bildirim_ttl:
                return True
            del self._bildirim_cache[key]
        return False

    def _bildirim_isaretle(self, key: str) -> None:
        self._bildirim_cache[key] = time.time()
        # Eski kayıtları temizle
        now = time.time()
        self._bildirim_cache = {
            k: v for k, v in self._bildirim_cache.items()
            if (now - v) < self._bildirim_ttl
        }

    def otobus_konumlari_getir(self) -> list[OtobusKonum]:
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
            except (ValueError, TypeError):
                continue
        return otobusler

    def en_yakin_durak_bul(self, otobus: OtobusKonum) -> tuple[int, str, str]:
        """Otobüsün en yakın durağını bulur. (sıra, ad, kod) döner."""
        min_mesafe = float("inf")
        en_yakin = (-1, "", "")

        for durak in self.hat_duraklari:
            mesafe = IETTApi.haversine(
                otobus.enlem, otobus.boylam, durak.enlem, durak.boylam
            )
            if mesafe < min_mesafe:
                min_mesafe = mesafe
                en_yakin = (durak.sira, durak.ad, durak.kod)

        return en_yakin

    def eta_hesapla(self, otobus: OtobusKonum, kalan_durak: int) -> Optional[float]:
        """
        Tahmini varış süresi hesaplar (saniye).

        Önce veritabanındaki geçmiş verilere bakar,
        yoksa otobüs hızı ve durak arası ortalama mesafeye göre hesaplar.
        """
        if kalan_durak <= 0 or self.hedef_durak is None:
            return None

        # 1. Veritabanından geçmiş ortalama
        db_eta = self.db.ortalama_varis_suresi(
            self.hat_kodu, otobus.yakin_durak_sira, self.hedef_durak.sira
        )
        if db_eta is not None:
            return db_eta

        # 2. Hız tabanlı tahmin
        if otobus.hiz > 0:
            mesafe = IETTApi.haversine(
                otobus.enlem, otobus.boylam,
                self.hedef_durak.enlem, self.hedef_durak.boylam,
            )
            # Kuş uçuşu mesafeyi 1.4 ile çarp (yol faktörü)
            yol_mesafe = mesafe * 1.4
            hiz_ms = otobus.hiz * 1000 / 3600
            return yol_mesafe / hiz_ms

        # 3. Kaba tahmin: durak başı ~2 dakika
        return kalan_durak * 120.0

    def _eta_gecmis_kaydet(self, otobus: OtobusKonum) -> None:
        """ETA geçmiş verisini günceller (otobus hedef durağa vardığında)."""
        plaka = otobus.plaka
        if plaka in self._onceki_konumlar:
            onceki_sira, onceki_zaman = self._onceki_konumlar[plaka]
            if self.hedef_durak and otobus.yakin_durak_sira == self.hedef_durak.sira:
                sure = time.time() - onceki_zaman
                if 30 < sure < 7200:  # 30sn - 2 saat arası makul
                    self.db.varis_suresi_kaydet(
                        self.hat_kodu, onceki_sira, self.hedef_durak.sira, sure
                    )
        self._onceki_konumlar[plaka] = (otobus.yakin_durak_sira, time.time())

    def kontrol_et(self) -> TakipSonucu:
        if self.hedef_durak is None:
            self.hedef_durak_belirle()

        sonuc = TakipSonucu(
            hat_kodu=self.hat_kodu,
            hedef_durak=self.hedef_durak,
            kontrol_zamani=time.strftime("%H:%M:%S"),
        )

        try:
            otobusler = self.otobus_konumlari_getir()
            sonuc.otobusler = otobusler

            if not otobusler:
                logger.info("Hat '%s' üzerinde aktif otobüs yok.", self.hat_kodu)
                return sonuc

            for otobus in otobusler:
                sira, ad, kod = self.en_yakin_durak_bul(otobus)
                otobus.yakin_durak_sira = sira
                otobus.yakin_durak_ad = ad
                otobus.yakin_durak_kod = kod
                kalan = self.hedef_durak.sira - sira
                otobus.kalan_durak = kalan

                # ETA hesapla
                otobus.tahmini_varis = self.eta_hesapla(otobus, kalan)

                # ETA geçmişi güncelle
                self._eta_gecmis_kaydet(otobus)

                # Veritabanına konum kaydet
                try:
                    self.db.otobus_konum_kaydet(
                        self.hat_kodu, otobus.plaka, kod, ad,
                        sira, otobus.enlem, otobus.boylam, otobus.hiz,
                    )
                except Exception:
                    pass  # DB yazma hatası takibi durdurmasın

                # Bildirim kontrolü
                if 0 < kalan <= self.uyari_durak_sayisi:
                    bildirim_key = f"{otobus.plaka}_{kalan}"
                    if not self._bildirim_gonderildi_mi(bildirim_key):
                        self._bildirim_isaretle(bildirim_key)

                        eta_str = ""
                        if otobus.tahmini_varis:
                            dakika = int(otobus.tahmini_varis / 60)
                            eta_str = f"\nTahmini varış: ~{dakika} dk"

                        aciliyet = "acil" if kalan == 1 else "normal"
                        baslik = f"Otobüs {kalan} Durak Kala!"
                        mesaj = (
                            f"Hat {self.hat_kodu} - Plaka: {otobus.plaka}\n"
                            f"Şu an: {ad}\n"
                            f"Hedef: {self.hedef_durak.ad}\n"
                            f"Kalan: {kalan} durak{eta_str}"
                        )

                        self.bildirim.gonder(baslik, mesaj, aciliyet)
                        sonuc.uyari_verilen.append(otobus)

                        # DB'ye bildirim kaydet
                        try:
                            self.db.bildirim_kaydet(
                                self.hat_kodu, otobus.plaka,
                                self.hedef_durak.ad, kalan, mesaj,
                            )
                        except Exception:
                            pass

                elif kalan == 0:
                    bildirim_key = f"{otobus.plaka}_VARILDI"
                    if not self._bildirim_gonderildi_mi(bildirim_key):
                        self._bildirim_isaretle(bildirim_key)
                        self.bildirim.gonder(
                            "Otobüs Durağınızda!",
                            (
                                f"Hat {self.hat_kodu} - {otobus.plaka}\n"
                                f"Durağınız: {self.hedef_durak.ad}"
                            ),
                            "acil",
                        )
                        sonuc.uyari_verilen.append(otobus)

        except IETTApiError as e:
            sonuc.hata = str(e)
            logger.error("API hatası: %s", e)

        self._son_sonuc = sonuc
        return sonuc

    def durum_ozeti(self, sonuc: TakipSonucu) -> str:
        lines = [
            f"Hat: {sonuc.hat_kodu} | Hedef: {sonuc.hedef_durak.ad} | {sonuc.kontrol_zamani}",
            f"Aktif otobüs: {len(sonuc.otobusler)}",
            "-" * 65,
        ]

        for otobus in sorted(sonuc.otobusler, key=lambda o: o.kalan_durak, reverse=True):
            kalan = otobus.kalan_durak
            if kalan > 0:
                eta_str = ""
                if otobus.tahmini_varis:
                    dk = int(otobus.tahmini_varis / 60)
                    eta_str = f" (~{dk}dk)"
                durum = f"{kalan} durak{eta_str}"
            elif kalan == 0:
                durum = ">> DURAKTA <<"
            else:
                durum = "Geçti"

            lines.append(
                f"  {otobus.plaka:12s} | {otobus.yakin_durak_ad:28s} | {durum}"
            )

        if sonuc.hata:
            lines.append(f"\nHATA: {sonuc.hata}")

        return "\n".join(lines)

    def takip_baslat(self) -> None:
        """Sürekli takip döngüsünü başlatır."""
        self.hat_bilgilerini_yukle()
        self.hedef_durak_belirle()

        print(f"\n{'=' * 65}")
        print(f"  İETT Otobüs Takip Sistemi")
        print(f"  Hat: {self.hat_kodu}")
        print(f"  Hedef Durak: [{self.hedef_durak.kod}] {self.hedef_durak.ad}")
        print(f"  Uyarı: {self.uyari_durak_sayisi} durak kala bildirim")
        print(f"  Kontrol: her {self.kontrol_araligi} saniye")
        telegram_durum = "Aktif" if self.bildirim.telegram.aktif else "Kapalı"
        print(f"  Telegram: {telegram_durum}")
        print(f"{'=' * 65}")
        print(f"  Ctrl+C ile durdur\n")

        self._calisiyor = True
        try:
            while self._calisiyor:
                sonuc = self.kontrol_et()
                print(f"\n{self.durum_ozeti(sonuc)}")
                time.sleep(self.kontrol_araligi)
        except KeyboardInterrupt:
            print("\nTakip durduruldu.")
            self._calisiyor = False

    def takip_durdur(self) -> None:
        self._calisiyor = False


# --- Çoklu Hat Takipçisi ---

class CokluTakipci:
    """Birden fazla hattı aynı anda takip eder."""

    def __init__(self, bildirim: Optional[BildirimYoneticisi] = None,
                 veritabani: Optional[Veritabani] = None):
        self.bildirim = bildirim or BildirimYoneticisi()
        self.db = veritabani or Veritabani()
        self._takipciler: dict[str, OtobusTakipci] = {}
        self._threadler: dict[str, threading.Thread] = {}
        self._calisiyor = False

    def hat_ekle(self, hat_kodu: str, hedef_durak_kodu: str = "",
                 hedef_durak_adi: str = "", uyari: int = 3,
                 aralik: int = 30) -> OtobusTakipci:
        """Takip edilecek hat ekler."""
        key = f"{hat_kodu}_{hedef_durak_kodu or hedef_durak_adi}"
        takipci = OtobusTakipci(
            hat_kodu=hat_kodu,
            hedef_durak_kodu=hedef_durak_kodu,
            hedef_durak_adi=hedef_durak_adi,
            uyari_durak_sayisi=uyari,
            kontrol_araligi=aralik,
            bildirim=self.bildirim,
            veritabani=self.db,
        )
        self._takipciler[key] = takipci
        return takipci

    def hat_sil(self, hat_kodu: str) -> None:
        keys_to_remove = [k for k in self._takipciler if k.startswith(hat_kodu)]
        for k in keys_to_remove:
            self._takipciler[k].takip_durdur()
            del self._takipciler[k]

    @property
    def takipciler(self) -> dict[str, OtobusTakipci]:
        return dict(self._takipciler)

    def toplu_baslat(self) -> None:
        """Tüm hatları ayrı thread'lerde başlatır."""
        self._calisiyor = True
        for key, takipci in self._takipciler.items():
            t = threading.Thread(target=takipci.takip_baslat, daemon=True, name=f"takip_{key}")
            self._threadler[key] = t
            t.start()

        try:
            while self._calisiyor:
                time.sleep(1)
        except KeyboardInterrupt:
            self.toplu_durdur()

    def toplu_durdur(self) -> None:
        self._calisiyor = False
        for takipci in self._takipciler.values():
            takipci.takip_durdur()
