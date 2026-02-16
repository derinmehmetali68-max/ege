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
import math
import time
from typing import Optional

from requests import Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from zeep import Client
from zeep.exceptions import Fault, TransportError
from zeep.transports import Transport

logger = logging.getLogger(__name__)

# İBB SOAP Web Servis URL'leri
HAT_DURAK_GUZERGAH_WSDL = (
    "https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx?wsdl"
)

# Varsayılan ayarlar
DEFAULT_TIMEOUT = 30  # saniye
MAX_RETRIES = 3
RETRY_BACKOFF = 1.5  # saniye


class IETTApiError(Exception):
    """İETT API hatası."""
    pass


class IETTApi:
    """
    İBB/İETT SOAP API istemcisi.

    Retry logic, timeout, connection pooling ve basit önbellekleme içerir.
    """

    def __init__(self, timeout: int = DEFAULT_TIMEOUT):
        self._client: Optional[Client] = None
        self._timeout = timeout

        # Statik veri önbelleği: {anahtar: (zaman_damgasi, veri)}
        self._cache: dict[str, tuple[float, list[dict]]] = {}
        self._cache_ttl = {
            "hatlar": 3600,       # Hat listesi: 1 saat
            "hat_durak": 1800,    # Hat durakları: 30 dakika
            "durak": 1800,        # Durak bilgisi: 30 dakika
            "otobus_konum": 0,    # Anlık konum: önbellek yok
        }

    def _create_session(self) -> Session:
        """Retry logic ile HTTP session oluşturur."""
        session = Session()
        retry_strategy = Retry(
            total=MAX_RETRIES,
            backoff_factor=RETRY_BACKOFF,
            status_forcelist=[500, 502, 503, 504],
        )
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=5,
            pool_maxsize=10,
        )
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

    def _get_client(self) -> Client:
        if self._client is None:
            try:
                session = self._create_session()
                transport = Transport(
                    session=session,
                    timeout=self._timeout,
                    operation_timeout=self._timeout,
                )
                self._client = Client(HAT_DURAK_GUZERGAH_WSDL, transport=transport)
                logger.info("SOAP istemcisi bağlandı.")
            except Exception as e:
                raise IETTApiError(f"SOAP servisine bağlanılamadı: {e}")
        return self._client

    def _cache_get(self, category: str, key: str) -> Optional[list[dict]]:
        """Önbellekten veri getirir. TTL geçmişse None döner."""
        cache_key = f"{category}:{key}"
        if cache_key in self._cache:
            ts, data = self._cache[cache_key]
            ttl = self._cache_ttl.get(category, 0)
            if ttl > 0 and (time.time() - ts) < ttl:
                logger.debug("Önbellek hit: %s", cache_key)
                return data
        return None

    def _cache_set(self, category: str, key: str, data: list[dict]) -> None:
        """Veriyi önbelleğe yazar."""
        ttl = self._cache_ttl.get(category, 0)
        if ttl > 0:
            cache_key = f"{category}:{key}"
            self._cache[cache_key] = (time.time(), data)

    def cache_temizle(self) -> None:
        """Tüm önbelleği temizler."""
        self._cache.clear()

    def _parse_json_response(self, raw: str) -> list[dict]:
        """SOAP'tan dönen JSON string'i parse eder."""
        if not raw:
            return []
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("JSON parse hatası: %s", e)
            return []

    def _api_cagri(self, method_name: str, **kwargs) -> list[dict]:
        """
        SOAP API çağrısı yapar, retry logic ile.

        Args:
            method_name: SOAP metod adı
            **kwargs: Metoda geçilecek parametreler

        Returns:
            Parse edilmiş JSON listesi
        """
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                client = self._get_client()
                method = getattr(client.service, method_name)
                result = method(**kwargs)
                return self._parse_json_response(result)
            except (Fault, TransportError, Exception) as e:
                last_error = e
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                    logger.warning(
                        "API çağrısı başarısız (deneme %d/%d): %s. %0.1fs sonra tekrar...",
                        attempt, MAX_RETRIES, e, wait,
                    )
                    time.sleep(wait)
                    # Bağlantıyı sıfırla
                    self._client = None

        raise IETTApiError(f"API çağrısı {MAX_RETRIES} denemeden sonra başarısız: {last_error}")

    def durak_getir(self, durak_kodu: str = "") -> list[dict]:
        """Durak bilgilerini getirir."""
        cached = self._cache_get("durak", durak_kodu)
        if cached is not None:
            return cached
        data = self._api_cagri("GetDurak_json", DurakKodu=durak_kodu)
        self._cache_set("durak", durak_kodu, data)
        return data

    def hat_durak_getir(self, hat_kodu: str) -> list[dict]:
        """Bir hattın durak listesini sıralı olarak getirir."""
        cached = self._cache_get("hat_durak", hat_kodu)
        if cached is not None:
            return cached
        data = self._api_cagri("GetDurakDetay_json", hat_kodu=hat_kodu)
        self._cache_set("hat_durak", hat_kodu, data)
        return data

    def hat_otobusleri_getir(self, hat_kodu: str) -> list[dict]:
        """Bir hat üzerindeki otobüslerin anlık konumlarını getirir (önbellek yok)."""
        return self._api_cagri("GetHatOtobusleri_json", HatKodu=hat_kodu)

    def tum_hatlari_getir(self) -> list[dict]:
        """Tüm İETT hat bilgilerini getirir."""
        cached = self._cache_get("hatlar", "all")
        if cached is not None:
            return cached
        data = self._api_cagri("GetHat_json", HatKodu="")
        self._cache_set("hatlar", "all", data)
        return data

    @staticmethod
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """İki koordinat arasındaki mesafeyi metre cinsinden hesaplar."""
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
