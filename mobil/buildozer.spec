[app]

# Uygulama Bilgileri
title = İETT Otobüs Takip
package.name = iett_takip
package.domain = com.iett
version = 1.0.0

# Kaynak
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json

# Gereksinimler
requirements = python3,kivy==2.3.0,kivymd==2.0.1.dev0,pillow,requests,certifi,charset-normalizer,idna,urllib3,mapview

# Android Ayarları
android.permissions = INTERNET,ACCESS_NETWORK_STATE,VIBRATE,RECEIVE_BOOT_COMPLETED,FOREGROUND_SERVICE,POST_NOTIFICATIONS,ACCESS_FINE_LOCATION,ACCESS_COARSE_LOCATION,WAKE_LOCK
android.api = 34
android.minapi = 24
android.ndk = 25b
android.archs = arm64-v8a,armeabi-v7a

# Uygulama Stili
orientation = portrait
fullscreen = 0

# Android Servis (Arka plan takibi)
services = OtobusTakip:service_takip.py:foreground

# Ikon ve Splash
# presplash.filename = %(source.dir)s/data/presplash.png
# icon.filename = %(source.dir)s/data/icon.png

# Gradle bağımlılıkları
android.gradle_dependencies = androidx.core:core:1.13.1,androidx.work:work-runtime:2.9.0

# Android Manifest eklemeleri
android.manifest_placeholders = [["appAuthRedirectScheme", "com.iett.iett_takip"]]

# Build ayarları
android.accept_sdk_license = True
android.skip_update = False

# Log seviyesi
log_level = 2

# P4A
p4a.branch = develop

[buildozer]
log_level = 2
warn_on_root = 1
