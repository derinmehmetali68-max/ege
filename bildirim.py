"""
Bildirim Sistemi

Otobüs yaklaşma uyarıları için çoklu kanal desteği:
- Masaüstü bildirimi (Linux/macOS/Windows)
- Telegram bot
- Sesli uyarı
- Terminal fallback
"""

import logging
import platform
import shlex
import subprocess
import threading
from typing import Optional

import requests

logger = logging.getLogger(__name__)


# --- Masaüstü Bildirimi ---

def bildirim_gonder(
    baslik: str,
    mesaj: str,
    ses_cal: bool = True,
    aciliyet: str = "normal",
) -> None:
    """Masaüstü bildirimi gönderir."""
    sistem = platform.system()

    try:
        if sistem == "Linux":
            _bildirim_linux(baslik, mesaj, ses_cal, aciliyet)
        elif sistem == "Darwin":
            _bildirim_macos(baslik, mesaj, ses_cal)
        elif sistem == "Windows":
            _bildirim_windows(baslik, mesaj, ses_cal)
        else:
            _bildirim_fallback(baslik, mesaj)
    except Exception as e:
        logger.warning("Bildirim gönderilemedi: %s", e)
        _bildirim_fallback(baslik, mesaj)


def _bildirim_linux(baslik: str, mesaj: str, ses_cal: bool, aciliyet: str) -> None:
    urgency = "critical" if aciliyet == "acil" else "normal"
    cmd = [
        "notify-send",
        "--urgency", urgency,
        "--app-name", "İETT Otobüs Takip",
        baslik,
        mesaj,
    ]
    subprocess.run(cmd, check=False, timeout=5)
    if ses_cal:
        _ses_cal_async()


def _bildirim_macos(baslik: str, mesaj: str, ses_cal: bool) -> None:
    # osascript için güvenli escape
    safe_baslik = baslik.replace('"', '\\"').replace("'", "\\'")
    safe_mesaj = mesaj.replace('"', '\\"').replace("'", "\\'")
    ses_param = 'sound name "Ping"' if ses_cal else ""
    script = (
        f'display notification "{safe_mesaj}" '
        f'with title "{safe_baslik}" {ses_param}'
    )
    subprocess.run(["osascript", "-e", script], check=False, timeout=5)


def _bildirim_windows(baslik: str, mesaj: str, ses_cal: bool) -> None:
    try:
        from plyer import notification as plyer_notification
        plyer_notification.notify(
            title=baslik,
            message=mesaj,
            app_name="İETT Otobüs Takip",
            timeout=10,
        )
    except ImportError:
        _bildirim_fallback(baslik, mesaj)

    if ses_cal:
        try:
            import winsound
            winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
        except Exception:
            print("\a", end="", flush=True)


def _ses_cal_async() -> None:
    """Arka planda ses çalar."""
    def _play():
        for cmd in [
            ["paplay", "/usr/share/sounds/freedesktop/stereo/complete.oga"],
            ["aplay", "/usr/share/sounds/alsa/Front_Center.wav"],
        ]:
            try:
                subprocess.run(cmd, check=True, timeout=5,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return
            except (FileNotFoundError, subprocess.CalledProcessError):
                continue
        print("\a", end="", flush=True)

    threading.Thread(target=_play, daemon=True).start()


def _bildirim_fallback(baslik: str, mesaj: str) -> None:
    print("\a", end="", flush=True)
    print()
    print("=" * 60)
    print(f"  BILDIRIM: {baslik}")
    print(f"  {mesaj}")
    print("=" * 60)
    print()


# --- Telegram Bildirimi ---

class TelegramBildirim:
    """Telegram Bot API üzerinden bildirim gönderir."""

    API_URL = "https://api.telegram.org/bot{token}/sendMessage"

    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self._aktif = bool(bot_token and chat_id)

    @property
    def aktif(self) -> bool:
        return self._aktif

    def gonder(self, baslik: str, mesaj: str, aciliyet: str = "normal") -> bool:
        """
        Telegram mesajı gönderir.

        Returns:
            True: başarılı, False: başarısız
        """
        if not self._aktif:
            return False

        ikon = "🔴" if aciliyet == "acil" else "🔔"
        text = f"{ikon} *{self._escape_md(baslik)}*\n\n{self._escape_md(mesaj)}"

        try:
            url = self.API_URL.format(token=self.bot_token)
            resp = requests.post(
                url,
                json={
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                logger.debug("Telegram mesajı gönderildi.")
                return True
            else:
                logger.warning("Telegram hata: %s %s", resp.status_code, resp.text)
                return False
        except requests.RequestException as e:
            logger.warning("Telegram bağlantı hatası: %s", e)
            return False

    def konum_gonder(self, enlem: float, boylam: float, baslik: str = "") -> bool:
        """Telegram'a konum gönderir."""
        if not self._aktif:
            return False
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendLocation"
            payload = {
                "chat_id": self.chat_id,
                "latitude": enlem,
                "longitude": boylam,
            }
            resp = requests.post(url, json=payload, timeout=10)
            return resp.status_code == 200
        except requests.RequestException:
            return False

    @staticmethod
    def _escape_md(text: str) -> str:
        """Markdown özel karakterlerini escape eder."""
        for ch in ['_', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']:
            text = text.replace(ch, f"\\{ch}")
        return text


# --- Birleşik Bildirim Yöneticisi ---

class BildirimYoneticisi:
    """
    Tüm bildirim kanallarını yöneten merkezi sınıf.

    Masaüstü, Telegram ve ses bildirimlerini tek noktadan yönetir.
    """

    def __init__(
        self,
        masaustu: bool = True,
        ses: bool = True,
        telegram_token: str = "",
        telegram_chat_id: str = "",
    ):
        self.masaustu_aktif = masaustu
        self.ses_aktif = ses
        self.telegram = TelegramBildirim(telegram_token, telegram_chat_id)

        # Bildirim geçmişi (son 100 bildirim)
        self._gecmis: list[dict] = []
        self._max_gecmis = 100

    def gonder(self, baslik: str, mesaj: str, aciliyet: str = "normal") -> None:
        """Tüm aktif kanallardan bildirim gönderir."""
        # Geçmişe kaydet
        import time
        self._gecmis.append({
            "zaman": time.strftime("%H:%M:%S"),
            "baslik": baslik,
            "mesaj": mesaj,
            "aciliyet": aciliyet,
        })
        if len(self._gecmis) > self._max_gecmis:
            self._gecmis = self._gecmis[-self._max_gecmis:]

        # Masaüstü bildirimi
        if self.masaustu_aktif:
            bildirim_gonder(baslik, mesaj, self.ses_aktif, aciliyet)

        # Telegram bildirimi
        if self.telegram.aktif:
            self.telegram.gonder(baslik, mesaj, aciliyet)

    @property
    def gecmis(self) -> list[dict]:
        return list(self._gecmis)
