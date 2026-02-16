"""
İETT Otobüs Takip - Android Mobil Uygulama

Kivy + KivyMD ile geliştirilmiş, Buildozer ile APK'ya derlenen
İstanbul otobüs takip uygulaması.

Özellikler:
  - Anlık otobüs konumları (harita + liste)
  - Durak yaklaşma bildirimi
  - ETA tahmini
  - Favori hat/durak kaydetme
  - Arka plan takibi (Android Service)
"""

import json
import os
import threading
import time
import logging
from functools import partial

from kivy.app import App
from kivy.clock import Clock, mainthread
from kivy.core.window import Window
from kivy.lang import Builder
from kivy.metrics import dp
from kivy.properties import (
    StringProperty, NumericProperty, ListProperty,
    BooleanProperty, ObjectProperty,
)
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.utils import platform

from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDRaisedButton, MDFlatButton, MDIconButton
from kivymd.uix.card import MDCard
from kivymd.uix.dialog import MDDialog
from kivymd.uix.label import MDLabel
from kivymd.uix.list import (
    MDList, OneLineListItem, TwoLineListItem,
    ThreeLineListItem, OneLineIconListItem, IconLeftWidget,
)
from kivymd.uix.navigationbar import MDNavigationBar, MDNavigationItem
from kivymd.uix.screen import MDScreen
from kivymd.uix.selectioncontrol import MDSwitch
from kivymd.uix.snackbar import MDSnackbar, MDSnackbarText
from kivymd.uix.textfield import MDTextField
from kivymd.uix.toolbar import MDTopAppBar

import iett_api_mobil as api

logger = logging.getLogger(__name__)

# ==================== KV DESIGN ====================

KV = """
#:import MapView kivy_garden.mapview.MapView
#:import MapMarkerPopup kivy_garden.mapview.MapMarkerPopup

<BusMarker@MapMarkerPopup>:
    source: 'bus_marker.png'

MDScreenManager:
    id: screen_manager

    AnaSayfa:
        name: 'ana'

    HatSecSayfa:
        name: 'hat_sec'

    DurakSecSayfa:
        name: 'durak_sec'

    TakipSayfa:
        name: 'takip'

    HaritaSayfa:
        name: 'harita'

    AyarlarSayfa:
        name: 'ayarlar'

    FavorilerSayfa:
        name: 'favoriler'


# ===== ANA SAYFA =====
<AnaSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "İETT Otobüs Takip"
            md_bg_color: app.theme_cls.primaryColor
            right_action_items: [["cog", lambda x: app.sayfa_git('ayarlar')], ["star", lambda x: app.sayfa_git('favoriler')]]

        MDBoxLayout:
            orientation: 'vertical'
            padding: dp(20)
            spacing: dp(16)
            adaptive_height: True
            pos_hint: {'center_y': 0.5}

            MDLabel:
                text: "Hoş Geldiniz!"
                halign: 'center'
                font_style: 'Display'
                role: 'small'
                adaptive_height: True

            MDLabel:
                text: "İstanbul otobüslerini anlık takip edin,\\ndurağınıza yaklaşınca bildirim alın."
                halign: 'center'
                theme_text_color: 'Secondary'
                adaptive_height: True

            Widget:
                size_hint_y: None
                height: dp(20)

            MDCard:
                orientation: 'vertical'
                padding: dp(20)
                spacing: dp(12)
                size_hint_x: 0.9
                pos_hint: {'center_x': 0.5}
                adaptive_height: True
                md_bg_color: app.theme_cls.surfaceContainerColor
                style: 'elevated'

                MDTextField:
                    id: hat_input
                    mode: "outlined"
                    size_hint_x: 1
                    MDTextFieldHintText:
                        text: "Hat Kodu"
                    MDTextFieldHelperText:
                        text: "Örnek: 500T, 34BZ, 15F"
                        mode: "persistent"

                MDRaisedButton:
                    text: "Takibe Başla"
                    size_hint_x: 1
                    md_bg_color: app.theme_cls.primaryColor
                    on_release: app.hat_sec_ve_basla(hat_input.text)

            MDCard:
                orientation: 'vertical'
                padding: dp(16)
                spacing: dp(8)
                size_hint_x: 0.9
                pos_hint: {'center_x': 0.5}
                adaptive_height: True
                md_bg_color: app.theme_cls.surfaceContainerColor
                style: 'elevated'

                MDLabel:
                    text: "Hızlı Erişim"
                    font_style: 'Title'
                    role: 'medium'
                    adaptive_height: True

                MDRaisedButton:
                    text: "Tüm Hatları Göster"
                    size_hint_x: 1
                    on_release: app.hatlari_yukle()

                MDRaisedButton:
                    text: "Favorilerim"
                    size_hint_x: 1
                    on_release: app.sayfa_git('favoriler')


# ===== HAT SEÇ SAYFA =====
<HatSecSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "Hat Seçimi"
            md_bg_color: app.theme_cls.primaryColor
            left_action_items: [["arrow-left", lambda x: app.sayfa_git('ana')]]

        MDTextField:
            id: hat_ara
            mode: "outlined"
            size_hint_x: 0.95
            pos_hint: {'center_x': 0.5}
            on_text: app.hatlari_filtrele(self.text)
            MDTextFieldHintText:
                text: "Hat ara..."
            MDTextFieldLeadingIcon:
                icon: "magnify"

        ScrollView:
            MDList:
                id: hat_listesi


# ===== DURAK SEÇ SAYFA =====
<DurakSecSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "Durak Seçimi"
            md_bg_color: app.theme_cls.primaryColor
            left_action_items: [["arrow-left", lambda x: app.sayfa_git('ana')]]

        MDLabel:
            id: hat_bilgi
            text: ""
            halign: 'center'
            size_hint_y: None
            height: dp(40)
            theme_text_color: 'Secondary'

        ScrollView:
            MDList:
                id: durak_listesi


# ===== TAKİP SAYFA =====
<TakipSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "Otobüs Takip"
            md_bg_color: app.theme_cls.primaryColor
            left_action_items: [["arrow-left", lambda x: app.takibi_durdur_ve_geri()]]
            right_action_items: [["map", lambda x: app.sayfa_git('harita')], ["star-outline", lambda x: app.favori_ekle_dialog()]]

        MDBoxLayout:
            orientation: 'vertical'
            padding: dp(12)
            spacing: dp(8)

            # Üst bilgi kartı
            MDCard:
                orientation: 'vertical'
                padding: dp(12)
                size_hint_y: None
                height: dp(100)
                md_bg_color: app.theme_cls.surfaceContainerColor
                style: 'elevated'

                MDLabel:
                    id: takip_hat_label
                    text: "Hat: ---"
                    font_style: 'Title'
                    role: 'medium'

                MDLabel:
                    id: takip_hedef_label
                    text: "Hedef: ---"
                    theme_text_color: 'Secondary'

                MDBoxLayout:
                    orientation: 'horizontal'
                    adaptive_height: True

                    MDLabel:
                        id: takip_durum_label
                        text: "Durum: Bekleniyor..."
                        theme_text_color: 'Secondary'
                        size_hint_x: 0.7

                    MDLabel:
                        id: takip_zaman_label
                        text: ""
                        halign: 'right'
                        theme_text_color: 'Secondary'
                        size_hint_x: 0.3

            # Otobüs listesi
            ScrollView:
                MDList:
                    id: otobus_listesi


# ===== HARİTA SAYFA =====
<HaritaSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "Harita"
            md_bg_color: app.theme_cls.primaryColor
            left_action_items: [["arrow-left", lambda x: app.sayfa_git('takip')]]

        MapView:
            id: harita
            lat: 41.0082
            lon: 28.9784
            zoom: 12


# ===== AYARLAR SAYFA =====
<AyarlarSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "Ayarlar"
            md_bg_color: app.theme_cls.primaryColor
            left_action_items: [["arrow-left", lambda x: app.sayfa_git('ana')]]

        ScrollView:
            MDBoxLayout:
                orientation: 'vertical'
                padding: dp(16)
                spacing: dp(12)
                adaptive_height: True

                MDCard:
                    orientation: 'vertical'
                    padding: dp(16)
                    spacing: dp(10)
                    adaptive_height: True
                    md_bg_color: app.theme_cls.surfaceContainerColor

                    MDLabel:
                        text: "Takip Ayarları"
                        font_style: 'Title'
                        role: 'medium'
                        adaptive_height: True

                    MDTextField:
                        id: ayar_uyari
                        mode: "outlined"
                        text: "3"
                        MDTextFieldHintText:
                            text: "Kaç durak kala uyarı"

                    MDTextField:
                        id: ayar_aralik
                        mode: "outlined"
                        text: "30"
                        MDTextFieldHintText:
                            text: "Kontrol aralığı (saniye)"

                MDCard:
                    orientation: 'vertical'
                    padding: dp(16)
                    spacing: dp(10)
                    adaptive_height: True
                    md_bg_color: app.theme_cls.surfaceContainerColor

                    MDLabel:
                        text: "Bildirim Ayarları"
                        font_style: 'Title'
                        role: 'medium'
                        adaptive_height: True

                    MDBoxLayout:
                        adaptive_height: True
                        MDLabel:
                            text: "Sesli bildirim"
                            adaptive_height: True
                        MDSwitch:
                            id: ayar_ses
                            active: True

                    MDBoxLayout:
                        adaptive_height: True
                        MDLabel:
                            text: "Titreşim"
                            adaptive_height: True
                        MDSwitch:
                            id: ayar_titresim
                            active: True

                MDCard:
                    orientation: 'vertical'
                    padding: dp(16)
                    spacing: dp(10)
                    adaptive_height: True
                    md_bg_color: app.theme_cls.surfaceContainerColor

                    MDLabel:
                        text: "Telegram Bildirimi"
                        font_style: 'Title'
                        role: 'medium'
                        adaptive_height: True

                    MDTextField:
                        id: ayar_telegram_token
                        mode: "outlined"
                        MDTextFieldHintText:
                            text: "Bot Token"

                    MDTextField:
                        id: ayar_telegram_chat
                        mode: "outlined"
                        MDTextFieldHintText:
                            text: "Chat ID"

                MDRaisedButton:
                    text: "Kaydet"
                    size_hint_x: 1
                    on_release: app.ayarlari_kaydet()


# ===== FAVORİLER SAYFA =====
<FavorilerSayfa>:
    MDBoxLayout:
        orientation: 'vertical'

        MDTopAppBar:
            title: "Favorilerim"
            md_bg_color: app.theme_cls.primaryColor
            left_action_items: [["arrow-left", lambda x: app.sayfa_git('ana')]]

        ScrollView:
            MDList:
                id: favori_listesi

        MDLabel:
            id: favori_bos_label
            text: "Henüz favori eklenmemiş.\\nTakip sırasında yıldız ikonuna basarak ekleyebilirsiniz."
            halign: 'center'
            theme_text_color: 'Secondary'
"""


# ==================== SCREEN CLASSES ====================

class AnaSayfa(MDScreen):
    pass

class HatSecSayfa(MDScreen):
    pass

class DurakSecSayfa(MDScreen):
    pass

class TakipSayfa(MDScreen):
    pass

class HaritaSayfa(MDScreen):
    pass

class AyarlarSayfa(MDScreen):
    pass

class FavorilerSayfa(MDScreen):
    pass


# ==================== ANA UYGULAMA ====================

class IETTApp(MDApp):
    """İETT Otobüs Takip Android Uygulaması."""

    # Durum
    takip_aktif = BooleanProperty(False)
    secili_hat = StringProperty("")
    secili_durak_kodu = StringProperty("")
    secili_durak_adi = StringProperty("")
    uyari_durak_sayisi = NumericProperty(3)
    kontrol_araligi = NumericProperty(30)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._hat_listesi = []
        self._durak_listesi = []
        self._takip_thread = None
        self._bildirim_cache = {}
        self._bildirim_ttl = 600
        self._harita_markerlar = []
        self._config = {}

    def build(self):
        self.theme_cls.theme_style = "Dark"
        self.theme_cls.primary_palette = "Blue"
        Window.softinput_mode = "below_target"

        self._config_yukle()
        return Builder.load_string(KV)

    def on_start(self):
        """Uygulama başladığında."""
        self._favori_yukle()
        if platform == "android":
            self._android_izinleri()

    def on_stop(self):
        """Uygulama kapanırken."""
        self.takip_aktif = False
        self._config_kaydet()

    # ==================== NAVİGASYON ====================

    def sayfa_git(self, sayfa_adi: str):
        sm = self.root
        if sm.current != sayfa_adi:
            sm.transition = SlideTransition(
                direction='left' if sayfa_adi != 'ana' else 'right'
            )
            sm.current = sayfa_adi

        if sayfa_adi == 'favoriler':
            self._favori_yukle()

    # ==================== CONFIG ====================

    def _config_path(self) -> str:
        if platform == "android":
            from android.storage import app_storage_path
            return os.path.join(app_storage_path(), "config.json")
        return os.path.join(os.path.dirname(__file__), "config.json")

    def _favori_path(self) -> str:
        if platform == "android":
            from android.storage import app_storage_path
            return os.path.join(app_storage_path(), "favoriler.json")
        return os.path.join(os.path.dirname(__file__), "favoriler.json")

    def _config_yukle(self):
        path = self._config_path()
        defaults = {
            "uyari_durak_sayisi": 3,
            "kontrol_araligi": 30,
            "ses": True,
            "titresim": True,
            "telegram_token": "",
            "telegram_chat_id": "",
            "son_hat": "",
        }
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    defaults.update(json.load(f))
            except Exception:
                pass
        self._config = defaults
        self.uyari_durak_sayisi = defaults["uyari_durak_sayisi"]
        self.kontrol_araligi = defaults["kontrol_araligi"]

    def _config_kaydet(self):
        path = self._config_path()
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Config kayıt hatası: %s", e)

    # ==================== ANDROID İZİNLER ====================

    def _android_izinleri(self):
        if platform != "android":
            return
        try:
            from android.permissions import request_permissions, Permission
            request_permissions([
                Permission.INTERNET,
                Permission.ACCESS_NETWORK_STATE,
                Permission.VIBRATE,
                Permission.RECEIVE_BOOT_COMPLETED,
                Permission.FOREGROUND_SERVICE,
                Permission.POST_NOTIFICATIONS,
            ])
        except Exception:
            pass

    # ==================== HAT İŞLEMLERİ ====================

    def hat_sec_ve_basla(self, hat_kodu: str):
        hat_kodu = hat_kodu.strip().upper()
        if not hat_kodu:
            self._snackbar("Hat kodu girin!")
            return

        self.secili_hat = hat_kodu
        self._config["son_hat"] = hat_kodu
        self._durak_yukle(hat_kodu)

    def hatlari_yukle(self):
        self._snackbar("Hat listesi yükleniyor...")
        self.sayfa_git('hat_sec')
        threading.Thread(target=self._hatlari_yukle_thread, daemon=True).start()

    def _hatlari_yukle_thread(self):
        try:
            hatlar = api.tum_hatlari_getir()
            self._hat_listesi = hatlar
            Clock.schedule_once(lambda dt: self._hatlari_goster(hatlar))
        except api.IETTApiError as e:
            Clock.schedule_once(lambda dt: self._snackbar(f"Hata: {e}"))

    @mainthread
    def _hatlari_goster(self, hatlar):
        liste = self.root.get_screen('hat_sec').ids.hat_listesi
        liste.clear_widgets()
        for hat in hatlar[:200]:  # İlk 200 hat
            kod = hat.get("SHESSION", hat.get("SHATNO", ""))
            aciklama = hat.get("TAESSION", hat.get("SHATADI", ""))
            item = TwoLineListItem(
                text=kod,
                secondary_text=aciklama,
                on_release=lambda x, k=kod: self._hat_secildi(k),
            )
            liste.add_widget(item)

    def hatlari_filtrele(self, arama: str):
        if not self._hat_listesi:
            return
        arama = arama.strip().upper()
        filtreli = [
            h for h in self._hat_listesi
            if arama in h.get("SHESSION", "").upper() or
               arama in h.get("TAESSION", "").upper()
        ][:50]
        self._hatlari_goster(filtreli)

    def _hat_secildi(self, hat_kodu: str):
        self.secili_hat = hat_kodu
        self._config["son_hat"] = hat_kodu
        self._durak_yukle(hat_kodu)

    # ==================== DURAK İŞLEMLERİ ====================

    def _durak_yukle(self, hat_kodu: str):
        self.sayfa_git('durak_sec')
        self.root.get_screen('durak_sec').ids.hat_bilgi.text = f"Hat: {hat_kodu}"
        self.root.get_screen('durak_sec').ids.durak_listesi.clear_widgets()
        threading.Thread(
            target=self._durak_yukle_thread, args=(hat_kodu,), daemon=True
        ).start()

    def _durak_yukle_thread(self, hat_kodu: str):
        try:
            duraklar = api.hat_durak_getir(hat_kodu)
            if not duraklar:
                Clock.schedule_once(lambda dt: self._snackbar("Durak bulunamadı!"))
                return
            self._durak_listesi = duraklar
            Clock.schedule_once(lambda dt: self._duraklari_goster(duraklar))
        except api.IETTApiError as e:
            Clock.schedule_once(lambda dt: self._snackbar(f"Hata: {e}"))

    @mainthread
    def _duraklari_goster(self, duraklar):
        liste = self.root.get_screen('durak_sec').ids.durak_listesi
        liste.clear_widgets()
        for i, d in enumerate(duraklar):
            sira = d.get("SIESSION", i + 1)
            ad = d.get("DAESSION", d.get("SDURAKADI", "Bilinmeyen"))
            kod = str(d.get("DUESSION", d.get("DURESSION", d.get("SDURAKKODU", ""))))

            item = TwoLineListItem(
                text=f"{sira}. {ad}",
                secondary_text=f"Durak kodu: {kod}",
                on_release=lambda x, k=kod, a=ad, s=sira: self._durak_secildi(k, a, s),
            )
            liste.add_widget(item)

    def _durak_secildi(self, kod: str, ad: str, sira: int):
        self.secili_durak_kodu = kod
        self.secili_durak_adi = ad
        self.takibi_baslat()

    # ==================== TAKİP ====================

    def takibi_baslat(self):
        self.takip_aktif = True
        self._bildirim_cache.clear()
        self.sayfa_git('takip')

        screen = self.root.get_screen('takip')
        screen.ids.takip_hat_label.text = f"Hat: {self.secili_hat}"
        screen.ids.takip_hedef_label.text = f"Hedef: {self.secili_durak_adi}"
        screen.ids.takip_durum_label.text = "Durum: Bağlanıyor..."
        screen.ids.otobus_listesi.clear_widgets()

        self._takip_thread = threading.Thread(
            target=self._takip_dongusu, daemon=True
        )
        self._takip_thread.start()

    def takibi_durdur_ve_geri(self):
        self.takip_aktif = False
        self.sayfa_git('ana')

    def _takip_dongusu(self):
        """Arka planda çalışan takip döngüsü."""
        # Durak bilgilerini hazırla
        try:
            ham_duraklar = api.hat_durak_getir(self.secili_hat)
        except api.IETTApiError:
            Clock.schedule_once(lambda dt: self._snackbar("Durak bilgisi alınamadı!"))
            return

        duraklar = []
        hedef_sira = -1
        for i, d in enumerate(ham_duraklar):
            try:
                kod = str(d.get("DUESSION", d.get("DURESSION", d.get("SDURAKKODU", ""))))
                sira = int(d.get("SIESSION", i + 1))
                enlem = float(d.get("YKOORD", d.get("ENLEM", 0)))
                boylam = float(d.get("XKOORD", d.get("BOYLAM", 0)))
                ad = d.get("DAESSION", d.get("SDURAKADI", ""))
                duraklar.append({
                    "kod": kod, "ad": ad, "sira": sira,
                    "enlem": enlem, "boylam": boylam,
                })
                if kod == self.secili_durak_kodu:
                    hedef_sira = sira
            except (ValueError, TypeError):
                continue

        duraklar.sort(key=lambda x: x["sira"])

        while self.takip_aktif:
            try:
                ham_otobusler = api.hat_otobusleri_getir(self.secili_hat)
                otobusler = []

                for o in ham_otobusler:
                    try:
                        enlem = float(o.get("Enlem", 0))
                        boylam = float(o.get("Boylam", 0))
                        if enlem == 0 and boylam == 0:
                            continue

                        hiz = float(o.get("Hiz", 0))
                        plaka = str(o.get("Plaka", ""))
                        saat = str(o.get("Saat", ""))

                        # En yakın durak bul
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

                        kalan = hedef_sira - yakin_sira if hedef_sira > 0 else -999

                        # ETA tahmini
                        eta = None
                        if kalan > 0:
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
                                    eta = (mesafe * 1.4) / (hiz * 1000 / 3600)
                            if eta is None:
                                eta = kalan * 120.0

                        otobusler.append({
                            "plaka": plaka, "enlem": enlem, "boylam": boylam,
                            "hiz": hiz, "saat": saat,
                            "yakin_durak": yakin_ad, "yakin_sira": yakin_sira,
                            "kalan": kalan, "eta": eta,
                        })

                        # Bildirim kontrolü
                        if 0 < kalan <= self.uyari_durak_sayisi:
                            bkey = f"{plaka}_{kalan}"
                            now = time.time()
                            if bkey not in self._bildirim_cache or \
                               (now - self._bildirim_cache[bkey]) > self._bildirim_ttl:
                                self._bildirim_cache[bkey] = now
                                eta_str = f" (~{int(eta / 60)} dk)" if eta else ""
                                self._bildirim_gonder(
                                    f"Otobüs {kalan} Durak Kala!",
                                    f"{self.secili_hat} - {plaka}\n"
                                    f"{yakin_ad} -> {self.secili_durak_adi}{eta_str}",
                                    kalan <= 1,
                                )

                        elif kalan == 0:
                            bkey = f"{plaka}_VARILDI"
                            now = time.time()
                            if bkey not in self._bildirim_cache or \
                               (now - self._bildirim_cache[bkey]) > self._bildirim_ttl:
                                self._bildirim_cache[bkey] = now
                                self._bildirim_gonder(
                                    "Otobüs Durağınızda!",
                                    f"{self.secili_hat} - {plaka}\n{self.secili_durak_adi}",
                                    True,
                                )

                    except (ValueError, TypeError):
                        continue

                otobusler.sort(key=lambda x: x["kalan"], reverse=True)
                Clock.schedule_once(
                    lambda dt, obs=otobusler, ds=duraklar: self._takip_guncelle(obs, ds)
                )

            except api.IETTApiError as e:
                Clock.schedule_once(
                    lambda dt, err=str(e): self._takip_hata(err)
                )

            time.sleep(self.kontrol_araligi)

    @mainthread
    def _takip_guncelle(self, otobusler: list, duraklar: list):
        """UI'ı güncelle (main thread)."""
        if not self.takip_aktif:
            return

        screen = self.root.get_screen('takip')
        screen.ids.takip_durum_label.text = f"Durum: {len(otobusler)} otobüs aktif"
        screen.ids.takip_zaman_label.text = time.strftime("%H:%M:%S")

        liste = screen.ids.otobus_listesi
        liste.clear_widgets()

        for bus in otobusler:
            kalan = bus["kalan"]
            if kalan > 0:
                eta_str = ""
                if bus["eta"]:
                    dk = int(bus["eta"] / 60)
                    eta_str = f" (~{dk} dk)"
                durum_str = f"{kalan} durak kala{eta_str}"
                if kalan <= self.uyari_durak_sayisi:
                    renk = [1, 0.6, 0, 1]  # turuncu
                else:
                    renk = [0.6, 0.6, 0.7, 1]  # gri
            elif kalan == 0:
                durum_str = "DURAGINIZDA!"
                renk = [0.2, 0.8, 0.2, 1]  # yeşil
            else:
                durum_str = "Geçti"
                renk = [0.4, 0.4, 0.5, 1]

            item = ThreeLineListItem(
                text=f"[b]{bus['plaka']}[/b]",
                secondary_text=bus["yakin_durak"],
                tertiary_text=durum_str,
            )
            item.ids._lbl_primary.markup = True
            item.ids._lbl_tertiary.color = renk
            liste.add_widget(item)

        # Harita marker'larını güncelle
        self._harita_markerlar_guncelle(otobusler, duraklar)

    def _harita_markerlar_guncelle(self, otobusler: list, duraklar: list):
        """Harita marker'larını günceller."""
        try:
            harita_screen = self.root.get_screen('harita')
            harita = harita_screen.ids.harita

            # Mevcut marker'ları temizle
            for m in self._harita_markerlar:
                try:
                    harita.remove_marker(m)
                except Exception:
                    pass
            self._harita_markerlar.clear()

            from kivy_garden.mapview import MapMarkerPopup

            # Otobüs marker'ları
            for bus in otobusler:
                if bus["enlem"] and bus["boylam"]:
                    marker = MapMarkerPopup(
                        lat=bus["enlem"], lon=bus["boylam"],
                    )
                    label = MDLabel(
                        text=f"{bus['plaka']}\\n{bus['kalan']} durak",
                        halign='center',
                        size_hint=(None, None),
                        size=(dp(120), dp(40)),
                    )
                    marker.add_widget(label)
                    harita.add_marker(marker)
                    self._harita_markerlar.append(marker)

            # Hedef durak marker
            hedef = next(
                (d for d in duraklar if d["kod"] == self.secili_durak_kodu), None
            )
            if hedef and hedef["enlem"] and hedef["boylam"]:
                marker = MapMarkerPopup(
                    lat=hedef["enlem"], lon=hedef["boylam"],
                )
                label = MDLabel(
                    text=f"HEDEF\\n{hedef['ad']}",
                    halign='center',
                    theme_text_color='Custom',
                    text_color=[1, 0, 0, 1],
                    size_hint=(None, None),
                    size=(dp(140), dp(40)),
                )
                marker.add_widget(label)
                harita.add_marker(marker)
                self._harita_markerlar.append(marker)

        except Exception as e:
            logger.warning("Harita güncelleme hatası: %s", e)

    @mainthread
    def _takip_hata(self, mesaj: str):
        if not self.takip_aktif:
            return
        screen = self.root.get_screen('takip')
        screen.ids.takip_durum_label.text = f"Hata: {mesaj}"

    # ==================== BİLDİRİM ====================

    def _bildirim_gonder(self, baslik: str, mesaj: str, acil: bool = False):
        """Platform-specific bildirim."""
        Clock.schedule_once(
            lambda dt: self._snackbar(f"{baslik}: {mesaj}")
        )

        if platform == "android":
            try:
                self._android_bildirim(baslik, mesaj, acil)
            except Exception as e:
                logger.error("Android bildirim hatası: %s", e)
        else:
            # Desktop: plyer
            try:
                from plyer import notification
                notification.notify(
                    title=baslik,
                    message=mesaj,
                    app_name="İETT Takip",
                    timeout=10,
                )
            except Exception:
                pass

        # Telegram
        self._telegram_gonder(baslik, mesaj)

    def _android_bildirim(self, baslik: str, mesaj: str, acil: bool = False):
        """Android native bildirim."""
        if platform != "android":
            return

        from jnius import autoclass

        PythonActivity = autoclass("org.kivy.android.PythonActivity")
        Context = autoclass("android.content.Context")
        NotificationBuilder = autoclass("android.app.Notification$Builder")
        NotificationManager = autoclass("android.app.NotificationManager")
        NotificationChannel = autoclass("android.app.NotificationChannel")

        activity = PythonActivity.mActivity
        manager = activity.getSystemService(Context.NOTIFICATION_SERVICE)

        # Kanal oluştur (Android 8+)
        channel_id = "iett_bildirim"
        importance = 4 if acil else 3  # HIGH veya DEFAULT
        channel = NotificationChannel(
            channel_id, "İETT Otobüs Bildirimleri", importance
        )
        channel.setDescription("Otobüs yaklaşma bildirimleri")
        channel.enableVibration(True)
        manager.createNotificationChannel(channel)

        # Bildirim oluştur
        builder = NotificationBuilder(activity, channel_id)
        builder.setContentTitle(baslik)
        builder.setContentText(mesaj)
        builder.setSmallIcon(activity.getApplicationInfo().icon)
        builder.setAutoCancel(True)

        if acil:
            builder.setPriority(1)  # HIGH
            # Titreşim
            if self._config.get("titresim", True):
                from jnius import cast
                vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE)
                vibrator.vibrate(500)

        notification = builder.build()
        notification_id = int(time.time()) % 100000
        manager.notify(notification_id, notification)

    def _telegram_gonder(self, baslik: str, mesaj: str):
        """Telegram bildirimi gönder."""
        token = self._config.get("telegram_token", "")
        chat_id = self._config.get("telegram_chat_id", "")
        if not token or not chat_id:
            return

        def _send():
            try:
                import requests
                text = f"*{baslik}*\n\n{mesaj}"
                requests.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                    timeout=10,
                )
            except Exception:
                pass

        threading.Thread(target=_send, daemon=True).start()

    # ==================== FAVORİLER ====================

    def _favori_yukle(self):
        """Favorileri dosyadan yükle ve göster."""
        path = self._favori_path()
        favoriler = []
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    favoriler = json.load(f)
            except Exception:
                pass

        try:
            screen = self.root.get_screen('favoriler')
            liste = screen.ids.favori_listesi
            bos_label = screen.ids.favori_bos_label
            liste.clear_widgets()

            if favoriler:
                bos_label.opacity = 0
                for fav in favoriler:
                    item = TwoLineListItem(
                        text=f"Hat {fav['hat_kodu']} → {fav['durak_adi']}",
                        secondary_text=f"{fav.get('uyari', 3)} durak kala uyarı",
                        on_release=lambda x, f=fav: self._favori_baslat(f),
                    )
                    liste.add_widget(item)
            else:
                bos_label.opacity = 1
        except Exception:
            pass

    def _favori_baslat(self, fav: dict):
        """Favoriden takip başlat."""
        self.secili_hat = fav["hat_kodu"]
        self.secili_durak_kodu = fav["durak_kodu"]
        self.secili_durak_adi = fav["durak_adi"]
        self.uyari_durak_sayisi = fav.get("uyari", 3)
        self.takibi_baslat()

    def favori_ekle_dialog(self):
        """Mevcut takibi favorilere ekle."""
        if not self.secili_hat or not self.secili_durak_kodu:
            self._snackbar("Önce bir hat ve durak seçin!")
            return

        path = self._favori_path()
        favoriler = []
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    favoriler = json.load(f)
            except Exception:
                pass

        # Zaten var mı kontrol et
        for f in favoriler:
            if f["hat_kodu"] == self.secili_hat and f["durak_kodu"] == self.secili_durak_kodu:
                self._snackbar("Bu hat/durak zaten favorilerde!")
                return

        favoriler.append({
            "hat_kodu": self.secili_hat,
            "durak_kodu": self.secili_durak_kodu,
            "durak_adi": self.secili_durak_adi,
            "uyari": self.uyari_durak_sayisi,
        })

        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(favoriler, f, ensure_ascii=False, indent=2)
            self._snackbar("Favorilere eklendi!")
        except Exception as e:
            self._snackbar(f"Kayıt hatası: {e}")

    # ==================== AYARLAR ====================

    def ayarlari_kaydet(self):
        screen = self.root.get_screen('ayarlar')
        try:
            self.uyari_durak_sayisi = int(screen.ids.ayar_uyari.text or "3")
            self.kontrol_araligi = int(screen.ids.ayar_aralik.text or "30")
        except ValueError:
            self._snackbar("Geçerli sayılar girin!")
            return

        self._config.update({
            "uyari_durak_sayisi": self.uyari_durak_sayisi,
            "kontrol_araligi": self.kontrol_araligi,
            "ses": screen.ids.ayar_ses.active,
            "titresim": screen.ids.ayar_titresim.active,
            "telegram_token": screen.ids.ayar_telegram_token.text.strip(),
            "telegram_chat_id": screen.ids.ayar_telegram_chat.text.strip(),
        })
        self._config_kaydet()
        self._snackbar("Ayarlar kaydedildi!")

    # ==================== YARDIMCI ====================

    @mainthread
    def _snackbar(self, mesaj: str):
        try:
            MDSnackbar(
                MDSnackbarText(text=mesaj),
                y=dp(24),
                pos_hint={"center_x": 0.5},
                size_hint_x=0.9,
            ).open()
        except Exception:
            print(f"[SNACKBAR] {mesaj}")


# ==================== ENTRY POINT ====================

if __name__ == "__main__":
    IETTApp().run()
