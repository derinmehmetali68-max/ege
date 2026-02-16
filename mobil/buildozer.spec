[app]

# Uygulama Bilgileri
title = IETT Otobus Takip
package.name = iett_takip
package.domain = com.iett
version = 1.0.0

# Kaynak
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json

# Gereksinimler - mapview ve kivymd sorun cikarirsa basit sürümle basla
requirements = python3,kivy==2.3.0,kivymd==2.0.1.dev0,pillow,requests,certifi,charset-normalizer,idna,urllib3,kivy_garden.mapview

# Android Ayarlari
android.permissions = INTERNET,ACCESS_NETWORK_STATE,VIBRATE,RECEIVE_BOOT_COMPLETED,FOREGROUND_SERVICE,POST_NOTIFICATIONS,ACCESS_FINE_LOCATION,ACCESS_COARSE_LOCATION,WAKE_LOCK
android.api = 33
android.minapi = 24
android.ndk = 25b
android.archs = arm64-v8a

# Uygulama Stili
orientation = portrait
fullscreen = 0

# Android Servis
services = OtobusTakip:service_takip.py:foreground

# Build ayarlari
android.accept_sdk_license = True
android.skip_update = False

# Log seviyesi
log_level = 2

# P4A
p4a.branch = develop

# Warn on root
[buildozer]
log_level = 2
warn_on_root = 0
