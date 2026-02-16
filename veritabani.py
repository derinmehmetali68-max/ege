"""
SQLite Veritabanı Modülü

Otobüs geçmiş verileri, favori hatlar/duraklar ve
ETA tahmini için geçmiş varış süreleri saklar.
"""

import logging
import os
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "iett_takip.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS favoriler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hat_kodu TEXT NOT NULL,
    durak_kodu TEXT NOT NULL,
    durak_adi TEXT NOT NULL,
    uyari_durak_sayisi INTEGER DEFAULT 3,
    ekleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hat_kodu, durak_kodu)
);

CREATE TABLE IF NOT EXISTS otobus_gecmis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hat_kodu TEXT NOT NULL,
    plaka TEXT NOT NULL,
    durak_kodu TEXT NOT NULL,
    durak_adi TEXT NOT NULL,
    durak_sira INTEGER,
    enlem REAL,
    boylam REAL,
    hiz REAL,
    zaman TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bildirim_gecmis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hat_kodu TEXT NOT NULL,
    plaka TEXT NOT NULL,
    hedef_durak TEXT NOT NULL,
    kalan_durak INTEGER,
    mesaj TEXT,
    zaman TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS varis_suresi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hat_kodu TEXT NOT NULL,
    baslangic_durak_sira INTEGER NOT NULL,
    hedef_durak_sira INTEGER NOT NULL,
    sure_saniye REAL NOT NULL,
    gun_tipi TEXT DEFAULT 'hafta_ici',
    saat_dilimi TEXT,
    zaman TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otobus_gecmis_hat ON otobus_gecmis(hat_kodu, plaka);
CREATE INDEX IF NOT EXISTS idx_varis_suresi_hat ON varis_suresi(hat_kodu, baslangic_durak_sira, hedef_durak_sira);
"""


@dataclass
class Favori:
    id: int
    hat_kodu: str
    durak_kodu: str
    durak_adi: str
    uyari_durak_sayisi: int


class Veritabani:
    """SQLite veritabanı yöneticisi."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._baslat()

    def _baslat(self) -> None:
        """Veritabanını oluşturur ve şemayı uygular."""
        with self._baglanti() as conn:
            conn.executescript(SCHEMA)
        logger.debug("Veritabanı hazır: %s", self.db_path)

    @contextmanager
    def _baglanti(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            logger.error("Veritabanı hatası: %s", e)
            raise
        finally:
            conn.close()

    # --- Favoriler ---

    def favori_ekle(self, hat_kodu: str, durak_kodu: str, durak_adi: str,
                    uyari: int = 3) -> None:
        with self._baglanti() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO favoriler (hat_kodu, durak_kodu, durak_adi, uyari_durak_sayisi) "
                "VALUES (?, ?, ?, ?)",
                (hat_kodu, durak_kodu, durak_adi, uyari),
            )
        logger.info("Favori eklendi: %s -> %s", hat_kodu, durak_adi)

    def favori_sil(self, hat_kodu: str, durak_kodu: str) -> None:
        with self._baglanti() as conn:
            conn.execute(
                "DELETE FROM favoriler WHERE hat_kodu = ? AND durak_kodu = ?",
                (hat_kodu, durak_kodu),
            )

    def favorileri_getir(self) -> list[Favori]:
        with self._baglanti() as conn:
            rows = conn.execute("SELECT * FROM favoriler ORDER BY ekleme_tarihi DESC").fetchall()
            return [
                Favori(
                    id=r["id"], hat_kodu=r["hat_kodu"], durak_kodu=r["durak_kodu"],
                    durak_adi=r["durak_adi"], uyari_durak_sayisi=r["uyari_durak_sayisi"],
                )
                for r in rows
            ]

    # --- Otobüs Geçmişi ---

    def otobus_konum_kaydet(self, hat_kodu: str, plaka: str, durak_kodu: str,
                            durak_adi: str, durak_sira: int, enlem: float,
                            boylam: float, hiz: float) -> None:
        with self._baglanti() as conn:
            conn.execute(
                "INSERT INTO otobus_gecmis (hat_kodu, plaka, durak_kodu, durak_adi, "
                "durak_sira, enlem, boylam, hiz) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (hat_kodu, plaka, durak_kodu, durak_adi, durak_sira, enlem, boylam, hiz),
            )

    def bildirim_kaydet(self, hat_kodu: str, plaka: str, hedef_durak: str,
                        kalan: int, mesaj: str) -> None:
        with self._baglanti() as conn:
            conn.execute(
                "INSERT INTO bildirim_gecmis (hat_kodu, plaka, hedef_durak, kalan_durak, mesaj) "
                "VALUES (?, ?, ?, ?, ?)",
                (hat_kodu, plaka, hedef_durak, kalan, mesaj),
            )

    # --- ETA (Tahmini Varış Süresi) ---

    def varis_suresi_kaydet(self, hat_kodu: str, baslangic_sira: int,
                            hedef_sira: int, sure_saniye: float) -> None:
        import datetime
        now = datetime.datetime.now()
        gun_tipi = "hafta_sonu" if now.weekday() >= 5 else "hafta_ici"
        saat_dilimi = f"{now.hour:02d}:00"

        with self._baglanti() as conn:
            conn.execute(
                "INSERT INTO varis_suresi (hat_kodu, baslangic_durak_sira, hedef_durak_sira, "
                "sure_saniye, gun_tipi, saat_dilimi) VALUES (?, ?, ?, ?, ?, ?)",
                (hat_kodu, baslangic_sira, hedef_sira, sure_saniye, gun_tipi, saat_dilimi),
            )

    def ortalama_varis_suresi(self, hat_kodu: str, baslangic_sira: int,
                              hedef_sira: int) -> Optional[float]:
        """
        Geçmiş verilere göre ortalama varış süresini hesaplar.

        Returns:
            Ortalama süre (saniye) veya None (yeterli veri yoksa)
        """
        import datetime
        now = datetime.datetime.now()
        gun_tipi = "hafta_sonu" if now.weekday() >= 5 else "hafta_ici"

        with self._baglanti() as conn:
            # Önce aynı gün tipi ve saat dilimine bak
            row = conn.execute(
                "SELECT AVG(sure_saniye) as ort, COUNT(*) as sayi FROM varis_suresi "
                "WHERE hat_kodu = ? AND baslangic_durak_sira = ? AND hedef_durak_sira = ? "
                "AND gun_tipi = ? AND saat_dilimi = ? "
                "AND zaman > datetime('now', '-30 days')",
                (hat_kodu, baslangic_sira, hedef_sira, gun_tipi, f"{now.hour:02d}:00"),
            ).fetchone()

            if row and row["sayi"] >= 3:
                return row["ort"]

            # Yeterli veri yoksa genel ortalamaya bak
            row = conn.execute(
                "SELECT AVG(sure_saniye) as ort, COUNT(*) as sayi FROM varis_suresi "
                "WHERE hat_kodu = ? AND baslangic_durak_sira = ? AND hedef_durak_sira = ? "
                "AND zaman > datetime('now', '-30 days')",
                (hat_kodu, baslangic_sira, hedef_sira),
            ).fetchone()

            if row and row["sayi"] >= 2:
                return row["ort"]

        return None

    # --- İstatistikler ---

    def istatistik_getir(self, hat_kodu: str = "") -> dict:
        """Genel istatistikleri döndürür."""
        with self._baglanti() as conn:
            filtre = ""
            params: tuple = ()
            if hat_kodu:
                filtre = "WHERE hat_kodu = ?"
                params = (hat_kodu,)

            toplam_kayit = conn.execute(
                f"SELECT COUNT(*) FROM otobus_gecmis {filtre}", params
            ).fetchone()[0]

            toplam_bildirim = conn.execute(
                f"SELECT COUNT(*) FROM bildirim_gecmis {filtre}", params
            ).fetchone()[0]

            toplam_favori = conn.execute(
                "SELECT COUNT(*) FROM favoriler"
            ).fetchone()[0]

            return {
                "toplam_konum_kaydi": toplam_kayit,
                "toplam_bildirim": toplam_bildirim,
                "toplam_favori": toplam_favori,
            }

    def eski_kayitlari_temizle(self, gun: int = 30) -> int:
        """Belirtilen günden eski kayıtları temizler."""
        with self._baglanti() as conn:
            cursor = conn.execute(
                "DELETE FROM otobus_gecmis WHERE zaman < datetime('now', ?)",
                (f"-{gun} days",),
            )
            silinen = cursor.rowcount
            conn.execute(
                "DELETE FROM varis_suresi WHERE zaman < datetime('now', ?)",
                (f"-{gun} days",),
            )
            return silinen
