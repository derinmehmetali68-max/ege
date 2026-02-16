#!/bin/bash
# Docker ile APK derleme
# Kullanim: ./docker_build.sh
#
# Docker kurulu olmasi gerekir.
# APK dosyasi ./output/ klasorune kopyalanir.

set -e

echo "=========================================="
echo "  IETT Otobus Takip - Docker APK Builder"
echo "=========================================="

mkdir -p output

echo "[1/3] Docker image olusturuluyor..."
docker build -t iett-apk-builder .

echo "[2/3] APK derleniyor (bu 20-30 dakika surebilir)..."
docker run --rm -v "$(pwd)/output:/output" iett-apk-builder

echo "[3/3] Kontrol ediliyor..."
APK=$(find output -name "*.apk" | head -1)

if [ -f "$APK" ]; then
    SIZE=$(du -h "$APK" | cut -f1)
    echo ""
    echo "=========================================="
    echo "  APK basariyla olusturuldu!"
    echo "  Dosya: $APK"
    echo "  Boyut: $SIZE"
    echo "=========================================="
else
    echo "APK olusturulamadi. Loglari kontrol edin."
    exit 1
fi
