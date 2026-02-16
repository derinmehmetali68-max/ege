#!/bin/bash
# ===================================================
# İETT Otobüs Takip - Android APK Derleme Scripti
# ===================================================
#
# Bu script, Kivy uygulamasını Android APK'ya derler.
#
# Gereksinimler:
#   - Python 3.10+
#   - Java JDK 17
#   - Android SDK & NDK (Buildozer otomatik indirir)
#   - Linux veya WSL2 (macOS kısmen desteklenir)
#
# Kullanım:
#   chmod +x build_apk.sh
#   ./build_apk.sh          # Debug APK
#   ./build_apk.sh release  # Release APK
#

set -e

echo "=========================================="
echo "  İETT Otobüs Takip - APK Builder"
echo "=========================================="
echo ""

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Sistem bağımlılıklarını kontrol et
echo -e "${YELLOW}[1/6] Sistem bağımlılıkları kontrol ediliyor...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}  HATA: '$1' bulunamadı. Lütfen kurun:${NC}"
        echo "    $2"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} $1 mevcut"
}

check_command python3 "sudo apt install python3"
check_command pip3 "sudo apt install python3-pip"
check_command java "sudo apt install openjdk-17-jdk"

# 2. Python bağımlılıkları
echo ""
echo -e "${YELLOW}[2/6] Python bağımlılıkları kuruluyor...${NC}"

pip3 install --upgrade buildozer cython kivy kivymd pillow requests 2>/dev/null || {
    echo -e "${RED}  pip kurulumu başarısız. Virtual environment deneyin:${NC}"
    echo "    python3 -m venv venv && source venv/bin/activate"
    exit 1
}

# Linux build bağımlılıkları
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo ""
    echo -e "${YELLOW}[3/6] Linux build araçları kontrol ediliyor...${NC}"
    sudo apt-get update -qq 2>/dev/null
    sudo apt-get install -y -qq \
        build-essential \
        git \
        zip \
        unzip \
        openjdk-17-jdk \
        autoconf \
        libtool \
        pkg-config \
        zlib1g-dev \
        libncurses5-dev \
        libncursesw5-dev \
        libtinfo5 \
        cmake \
        libffi-dev \
        libssl-dev \
        2>/dev/null
    echo -e "  ${GREEN}✓${NC} Build araçları hazır"
else
    echo -e "${YELLOW}[3/6] Linux dışı platform - build araçları atlanıyor${NC}"
fi

# 3. İkon ve görselleri oluştur
echo ""
echo -e "${YELLOW}[4/6] Uygulama görselleri oluşturuluyor...${NC}"
python3 create_icons.py

# 4. Buildozer ile derle
echo ""
echo -e "${YELLOW}[5/6] APK derleniyor (bu 15-30 dakika sürebilir)...${NC}"
echo ""

BUILD_TYPE="${1:-debug}"

if [ "$BUILD_TYPE" == "release" ]; then
    echo "Release build başlatılıyor..."
    buildozer android release
    APK_PATH=$(find ./bin -name "*.apk" -not -name "*debug*" | head -1)
else
    echo "Debug build başlatılıyor..."
    buildozer android debug
    APK_PATH=$(find ./bin -name "*debug*.apk" | head -1)
fi

# 5. Sonuç
echo ""
echo "=========================================="
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo -e "${GREEN}  APK başarıyla oluşturuldu!${NC}"
    echo ""
    echo "  Dosya: $APK_PATH"
    echo "  Boyut: $APK_SIZE"
    echo ""
    echo "  Telefona yüklemek için:"
    echo "    adb install $APK_PATH"
    echo ""
    echo "  veya APK dosyasını telefona transfer edin"
    echo "  ve 'Bilinmeyen kaynaklar'dan yükleme izni verin."
else
    echo -e "${RED}  APK oluşturulamadı!${NC}"
    echo "  Logları kontrol edin: buildozer android debug 2>&1 | tee build.log"
fi
echo "=========================================="
