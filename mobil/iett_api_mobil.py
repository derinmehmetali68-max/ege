"""
İETT API İstemcisi - Mobil (Hafif)

Zeep yerine requests + XML ile SOAP çağrısı yapar.
Android'de çalışabilmesi için bağımlılık minimumda tutulmuştur.
"""

import json
import math
import time
import logging
from xml.etree import ElementTree

import requests

logger = logging.getLogger(__name__)

SOAP_URL = "https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx"

SOAP_ENVELOPE = """<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"
                 xmlns:tem="http://tempuri.org/">
  <soap12:Body>
    <tem:{method}>
      {params}
    </tem:{method}>
  </soap12:Body>
</soap12:Envelope>"""

TIMEOUT = 30
MAX_RETRIES = 3


class IETTApiError(Exception):
    pass


def _soap_call(method: str, params: dict = None) -> list[dict]:
    """SOAP çağrısı yapar ve JSON yanıtı parse eder."""
    params = params or {}
    param_xml = "".join(
        f"<tem:{k}>{v}</tem:{k}>" for k, v in params.items()
    )
    body = SOAP_ENVELOPE.format(method=method, params=param_xml)

    headers = {
        "Content-Type": "application/soap+xml; charset=utf-8",
    }

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(
                SOAP_URL, data=body.encode("utf-8"),
                headers=headers, timeout=TIMEOUT,
            )
            resp.raise_for_status()

            # SOAP yanıtından JSON string'i çıkar
            root = ElementTree.fromstring(resp.content)
            # Namespace'leri temizle
            for elem in root.iter():
                if "}" in elem.tag:
                    elem.tag = elem.tag.split("}", 1)[1]

            # Result elemanını bul
            result_elem = root.find(f".//{method}Result")
            if result_elem is None or not result_elem.text:
                return []

            return json.loads(result_elem.text)

        except Exception as e:
            last_error = e
            if attempt < MAX_RETRIES:
                wait = 1.5 * (2 ** (attempt - 1))
                logger.warning("API hatası (deneme %d): %s", attempt, e)
                time.sleep(wait)

    raise IETTApiError(f"API çağrısı başarısız: {last_error}")


def hat_durak_getir(hat_kodu: str) -> list[dict]:
    """Hattın duraklarını sıralı getirir."""
    return _soap_call("GetDurakDetay_json", {"hat_kodu": hat_kodu})


def hat_otobusleri_getir(hat_kodu: str) -> list[dict]:
    """Hattaki otobüslerin anlık konumlarını getirir."""
    return _soap_call("GetHatOtobusleri_json", {"HatKodu": hat_kodu})


def tum_hatlari_getir() -> list[dict]:
    """Tüm İETT hatlarını getirir."""
    return _soap_call("GetHat_json", {"HatKodu": ""})


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki koordinat arası mesafe (metre)."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
