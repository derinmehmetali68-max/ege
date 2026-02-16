"""
Masaüstü Bildirim Sistemi

Otobüs yaklaşma uyarıları için çapraz platform bildirim desteği.
Linux, macOS ve Windows'ta çalışır.
"""

import logging
import platform
import subprocess
import threading

logger = logging.getLogger(__name__)


def bildirim_gonder(
    baslik: str,
    mesaj: str,
    ses_cal: bool = True,
    aciliyet: str = "normal",
) -> None:
    """
    Masaüstü bildirimi gönderir.

    Args:
        baslik: Bildirim başlığı
        mesaj: Bildirim mesajı
        ses_cal: Bildirim sesi çalınsın mı
        aciliyet: "normal" veya "acil"
    """
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
        logger.warning("Bildirim gönderilemedi (%s), fallback kullanılıyor: %s", sistem, e)
        _bildirim_fallback(baslik, mesaj)


def _bildirim_linux(baslik: str, mesaj: str, ses_cal: bool, aciliyet: str) -> None:
    """Linux notify-send ile bildirim."""
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
        _ses_cal_linux()


def _ses_cal_linux() -> None:
    """Linux'ta uyarı sesi çalar."""
    def _play():
        try:
            # paplay (PulseAudio) ile sistem sesi çal
            subprocess.run(
                ["paplay", "/usr/share/sounds/freedesktop/stereo/complete.oga"],
                check=False,
                timeout=5,
            )
        except FileNotFoundError:
            try:
                # Alternatif: aplay
                subprocess.run(
                    ["aplay", "/usr/share/sounds/alsa/Front_Center.wav"],
                    check=False,
                    timeout=5,
                )
            except FileNotFoundError:
                # Son çare: terminal bell
                print("\a", end="", flush=True)

    threading.Thread(target=_play, daemon=True).start()


def _bildirim_macos(baslik: str, mesaj: str, ses_cal: bool) -> None:
    """macOS osascript ile bildirim."""
    ses_param = 'sound name "Ping"' if ses_cal else ""
    script = (
        f'display notification "{mesaj}" '
        f'with title "{baslik}" {ses_param}'
    )
    subprocess.run(["osascript", "-e", script], check=False, timeout=5)


def _bildirim_windows(baslik: str, mesaj: str, ses_cal: bool) -> None:
    """Windows toast bildirimi (plyer veya PowerShell fallback)."""
    try:
        from plyer import notification as plyer_notification

        plyer_notification.notify(
            title=baslik,
            message=mesaj,
            app_name="İETT Otobüs Takip",
            timeout=10,
        )
    except ImportError:
        # PowerShell ile Windows toast bildirimi
        ps_script = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName('text')
        $textNodes.Item(0).AppendChild($template.CreateTextNode('{baslik}')) > $null
        $textNodes.Item(1).AppendChild($template.CreateTextNode('{mesaj}')) > $null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('İETT Otobüs Takip').Show($toast)
        """
        subprocess.run(
            ["powershell", "-Command", ps_script],
            check=False,
            timeout=10,
        )

    if ses_cal:
        try:
            import winsound
            winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
        except Exception:
            print("\a", end="", flush=True)


def _bildirim_fallback(baslik: str, mesaj: str) -> None:
    """Terminal tabanlı basit bildirim (fallback)."""
    print("\a", end="", flush=True)  # Terminal bell
    print()
    print("=" * 60)
    print(f"  🔔 {baslik}")
    print(f"  {mesaj}")
    print("=" * 60)
    print()
