"""
Uygulama ikonu ve marker görsellerini oluşturur.
Pillow ile basit görseller üretir.

Kullanım: python create_icons.py
"""

from PIL import Image, ImageDraw, ImageFont


def create_bus_marker(path="bus_marker.png", size=48):
    """Harita üzerinde otobüs marker ikonu."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Mavi daire
    margin = 4
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=(59, 130, 246, 255),
        outline=(255, 255, 255, 255),
        width=3,
    )

    # "B" harfi
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), "B", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - 2),
        "B", fill=(255, 255, 255, 255), font=font,
    )

    img.save(path)
    print(f"Bus marker: {path}")


def create_app_icon(path="data/icon.png", size=512):
    """Uygulama ikonu."""
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Arka plan - yuvarlak köşeli kare
    draw.rounded_rectangle(
        [0, 0, size, size],
        radius=size // 5,
        fill=(30, 41, 59, 255),
    )

    # İç daire
    m = size // 6
    draw.ellipse(
        [m, m, size - m, size - m],
        fill=(59, 130, 246, 255),
    )

    # Otobüs sembolü
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size // 3)
    except OSError:
        font = ImageFont.load_default()

    text = "BUS"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2),
        text, fill=(255, 255, 255, 255), font=font,
    )

    img.save(path)
    print(f"App icon: {path}")


def create_presplash(path="data/presplash.png", size=(480, 800)):
    """Splash screen."""
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)

    img = Image.new("RGB", size, (15, 23, 42))
    draw = ImageDraw.Draw(img)

    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        sub_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()

    # Mavi daire
    cx, cy = size[0] // 2, size[1] // 2 - 60
    r = 60
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(59, 130, 246))

    # Başlık
    title = "İETT Otobüs Takip"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    draw.text(
        ((size[0] - tw) / 2, cy + r + 30),
        title, fill=(226, 232, 240), font=title_font,
    )

    # Alt yazı
    sub = "Anlık Otobüs Takip Sistemi"
    bbox = draw.textbbox((0, 0), sub, font=sub_font)
    tw = bbox[2] - bbox[0]
    draw.text(
        ((size[0] - tw) / 2, cy + r + 80),
        sub, fill=(148, 163, 184), font=sub_font,
    )

    img.save(path)
    print(f"Presplash: {path}")


if __name__ == "__main__":
    create_bus_marker()
    create_app_icon()
    create_presplash()
    print("\nTüm görseller oluşturuldu!")
