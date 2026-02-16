"""
İETT / İBB Açık Veri SOAP API İstemcisi

İBB'nin SOAP web servisleri üzerinden İETT otobüs verilerine erişim sağlar.
API Kaynak: https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx?wsdl

Önemli Kısıtlamalar:
  - SOAP servisleri her gece 00:15'ten sonra kapatılır
  - Servisler yavaş olabilir (özellikle durak verileri)
  - Anlık konum verileri belirli aralıklarla güncellenir
"""

import json
import logging
from typing import Optional

from zeep import Client
from zeep.exceptions import Fault, TransportError

logger = logging.getLogger(__name__)

# İBB SOAP Web Servis URL'leri
HAT_DURAK_GUZERGAH_WSDL = (
    "https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx?wsdl"
)
FILO_YONETIM_WSDL = (
    "https://api.ibb.gov.tr/iett/FiloYonetim/SeferGercworkleme.asmx?wsdl"
)


class IETTApiError(Exception):
    """İETT API hatası."""
    pass


class IETTApi:
    """İBB/İETT SOAP API istemcisi."""

    def __init__(self):
        self._hat_durak_client: Optional[Client] = None
        self._filo_client: Optional[Client] = None

    def _get_hat_durak_client(self) -> Client:
        if self._hat_durak_client is None:
            try:
                self._hat_durak_client = Client(HAT_DURAK_GUZERGAH_WSDL)
                logger.info("Hat/Durak SOAP istemcisi bağlandı.")
            except Exception as e:
                raise IETTApiError(f"SOAP servisine bağlanılamadı: {e}")
        return self._hat_durak_client

    def _get_filo_client(self) -> Client:
        if self._filo_client is None:
            try:
                self._filo_client = Client(FILO_YONETIM_WSDL)
                logger.info("Filo Yönetim SOAP istemcisi bağlandı.")
            except Exception as e:
                raise IETTApiError(f"Filo SOAP servisine bağlanılamadı: {e}")
        return self._filo_client

    def _parse_json_response(self, raw: str) -> list[dict]:
        """SOAP'tan dönen JSON string'i parse eder."""
        if not raw:
            return []
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("JSON parse hatası: %s", e)
            return []

    def durak_getir(self, durak_kodu: str = "") -> list[dict]:
        """
        Durak bilgilerini getirir.

        Args:
            durak_kodu: Belirli bir durak kodu. Boş bırakılırsa tüm duraklar döner.

        Returns:
            Durak listesi. Her durak şu alanları içerir:
            - SDURAKKODU: Durak kodu
            - SDURAKADI: Durak adı
            - KOORDINAT: Koordinat bilgisi
            - ILCEADI: İlçe adı
            - SYON: Yön bilgisi
            - AKILLI: Akıllı durak mı
            - FIZIKI: Fiziki durak bilgisi
            - DURAK_TIPI: Durak tipi
            - ENGELLIKULLANIM: Engelli kullanımı
        """
        try:
            client = self._get_hat_durak_client()
            result = client.service.GetDurak_json(DurakKodu=durak_kodu)
            return self._parse_json_response(result)
        except (Fault, TransportError) as e:
            raise IETTApiError(f"Durak verisi alınamadı: {e}")

    def hat_durak_getir(self, hat_kodu: str) -> list[dict]:
        """
        Bir hattın durak listesini sıralı olarak getirir.

        Args:
            hat_kodu: Hat kodu (örn: "500T", "34BZ")

        Returns:
            Hattın durak listesi (sıralı). Her kayıt şu alanları içerir:
            - HESSION: Hat yön bilgisi
            - SIESSION: Sıra numarası
            - DURESSION: Durak kodu
            - DAESSION: Durak adı
            - XKOORD: X koordinatı (Boylam)
            - YKOORD: Y koordinatı (Enlem)
            - DUESSION: Durak tipi
            - ISESSION: İlçe
        """
        try:
            client = self._get_hat_durak_client()
            result = client.service.GetDurakDetay_json(hat_kodu=hat_kodu)
            return self._parse_json_response(result)
        except (Fault, TransportError) as e:
            raise IETTApiError(f"Hat durak detayı alınamadı: {e}")

    def hat_otobusleri_getir(self, hat_kodu: str) -> list[dict]:
        """
        Bir hat üzerindeki otobüslerin anlık konumlarını getirir.

        Args:
            hat_kodu: Hat kodu (örn: "500T", "34BZ")

        Returns:
            Otobüs konum listesi. Her kayıt şu alanları içerir:
            - Operator: Operatör
            - Garaj: Garaj adı
            - KapiNo: Kapı numarası
            - Saat: Zaman damgası
            - Boylam: Boylam (longitude)
            - Enlem: Enlem (latitude)
            - Hiz: Hız (km/s)
            - Plaka: Araç plakası
        """
        try:
            client = self._get_hat_durak_client()
            result = client.service.GetHatOtobusleri_json(HatKodu=hat_kodu)
            return self._parse_json_response(result)
        except (Fault, TransportError) as e:
            raise IETTApiError(f"Hat otobüsleri alınamadı: {e}")

    def tum_hatlari_getir(self) -> list[dict]:
        """
        Tüm İETT hat bilgilerini getirir.

        Returns:
            Hat listesi. Her kayıt şu alanları içerir:
            - SHESSION: Hat kodu
            - TAESSION: Hat açıklaması
        """
        try:
            client = self._get_hat_durak_client()
            result = client.service.GetHat_json(HatKodu="")
            return self._parse_json_response(result)
        except (Fault, TransportError) as e:
            raise IETTApiError(f"Hat listesi alınamadı: {e}")

    def yakin_duraklar_getir(self, enlem: float, boylam: float) -> list[dict]:
        """
        Koordinata en yakın durakları getirir.

        Args:
            enlem: Enlem (latitude)
            boylam: Boylam (longitude)

        Returns:
            Yakın durak listesi.
        """
        try:
            client = self._get_hat_durak_client()
            result = client.service.GetDurak_json(DurakKodu="")
            duraklar = self._parse_json_response(result)

            # Koordinat alanını parse et ve mesafe hesapla
            for durak in duraklar:
                koord = durak.get("KOORDINAT", "")
                if koord:
                    try:
                        parts = koord.split(",")
                        if len(parts) == 2:
                            d_enlem = float(parts[0].strip())
                            d_boylam = float(parts[1].strip())
                            durak["_enlem"] = d_enlem
                            durak["_boylam"] = d_boylam
                            durak["_mesafe"] = self._haversine(
                                enlem, boylam, d_enlem, d_boylam
                            )
                    except ValueError:
                        durak["_mesafe"] = float("inf")
                else:
                    durak["_mesafe"] = float("inf")

            duraklar.sort(key=lambda d: d.get("_mesafe", float("inf")))
            return duraklar[:10]
        except (Fault, TransportError) as e:
            raise IETTApiError(f"Yakın duraklar alınamadı: {e}")

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """İki koordinat arasındaki mesafeyi metre cinsinden hesaplar."""
        import math

        R = 6371000  # Dünya yarıçapı (metre)
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
