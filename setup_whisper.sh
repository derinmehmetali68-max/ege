#!/bin/bash
#
# Whisper.cpp kaynak kodlarini indirir ve proje icine yerlestirir.
# Bu script'i proje ana dizininde calistirin: ./setup_whisper.sh
#
# Kullanim:
#   chmod +x setup_whisper.sh
#   ./setup_whisper.sh
#

set -e

WHISPER_CPP_DIR="app/src/main/cpp/whisper.cpp"
WHISPER_CPP_REPO="https://github.com/ggerganov/whisper.cpp.git"
WHISPER_CPP_TAG="v1.7.3"  # Stabil surum

echo "============================================"
echo "  Whisper.cpp Kurulum Script'i"
echo "============================================"
echo ""

# Kontrol: git kurulu mu?
if ! command -v git &> /dev/null; then
    echo "HATA: git kurulu degil. Lutfen git kurun."
    exit 1
fi

# Eski dosyalari temizle
if [ -d "$WHISPER_CPP_DIR" ]; then
    echo "Eski whisper.cpp dizini bulundu, siliniyor..."
    rm -rf "$WHISPER_CPP_DIR"
fi

echo "whisper.cpp indiriliyor (${WHISPER_CPP_TAG})..."
echo ""

# whisper.cpp'yi clone et
git clone --depth 1 --branch "$WHISPER_CPP_TAG" "$WHISPER_CPP_REPO" "$WHISPER_CPP_DIR"

# Gereksiz dosyalari temizle (boyutu kucultmek icin)
echo ""
echo "Gereksiz dosyalar temizleniyor..."
cd "$WHISPER_CPP_DIR"

# Sadece gerekli dosyalari tut
rm -rf .git
rm -rf bindings
rm -rf examples
rm -rf models
rm -rf samples
rm -rf tests
rm -rf scripts
rm -rf .github
rm -f Makefile
rm -f CMakeLists.txt
rm -f README.md
rm -f LICENSE
rm -f .gitignore
rm -f .gitmodules
rm -f *.md

cd - > /dev/null

echo ""
echo "============================================"
echo "  Kurulum tamamlandi!"
echo "============================================"
echo ""
echo "whisper.cpp konumu: $WHISPER_CPP_DIR"
echo ""
echo "Sonraki adimlar:"
echo "  1. Android Studio'da projeyi acin"
echo "  2. Build > Make Project"
echo "  3. Uygulamayi cihaziniza yukleyin"
echo "  4. Ayarlar'dan Whisper modelini indirin"
echo ""
echo "NOT: Uygulama ilk acildiginda Ayarlar'dan"
echo "     Whisper modelini (Tiny/Base/Small) indirin."
echo "     Model cihazda yerel olarak calisir,"
echo "     internet veya API anahtari gerekmez."
echo ""
