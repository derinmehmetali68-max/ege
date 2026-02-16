FROM python:3.11-slim-bookworm

# Sistem bagimliliklari
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git zip unzip wget \
    openjdk-17-jdk-headless autoconf libtool \
    pkg-config zlib1g-dev libncurses5-dev \
    cmake libffi-dev libssl-dev lbzip2 patch \
    && rm -rf /var/lib/apt/lists/*

# Python bagimliliklari
RUN pip install --no-cache-dir \
    buildozer cython kivy kivymd pillow requests

# Calisma dizini
WORKDIR /app
COPY . /app/

# Ikonlari olustur
RUN python create_icons.py

# APK derle
CMD ["bash", "-c", "yes | buildozer android debug && cp bin/*.apk /output/ 2>/dev/null || echo 'Build failed'"]
