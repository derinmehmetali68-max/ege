"""
Web Dashboard - Flask + Leaflet + Socket.IO

Gerçek zamanlı harita üzerinde otobüs takibi ve bildirim yönetimi.
Tarayıcıdan http://localhost:5000 adresine bağlanarak kullanılır.

Kullanım:
    python web_panel.py
    python web_panel.py --port 8080
"""

import argparse
import json
import logging
import os
import threading
import time

from flask import Flask, render_template_string, jsonify, request
from flask_socketio import SocketIO

from iett_api import IETTApi, IETTApiError
from takipci import OtobusTakipci, Durak
from bildirim import BildirimYoneticisi
from veritabani import Veritabani

logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.urandom(24).hex()
socketio = SocketIO(app, cors_allowed_origins="*")

# Global state
api = IETTApi()
db = Veritabani()
bildirim = BildirimYoneticisi()
aktif_takipciler: dict[str, OtobusTakipci] = {}
takip_threadleri: dict[str, threading.Thread] = {}

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")


def config_yukle() -> dict:
    defaults = {
        "hat_kodu": "", "hedef_durak_kodu": "", "hedef_durak_adi": "",
        "uyari_durak_sayisi": 3, "kontrol_araligi_saniye": 30,
        "bildirim_sesi": True, "telegram_token": "", "telegram_chat_id": "",
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                defaults.update(json.load(f))
        except Exception:
            pass
    return defaults


# ==================== HTML TEMPLATE ====================

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>İETT Otobüs Takip</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }

        .container { display: grid; grid-template-columns: 350px 1fr; grid-template-rows: auto 1fr; height: 100vh; }

        .header { grid-column: 1 / -1; background: #1e293b; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #3b82f6; }
        .header h1 { font-size: 1.2rem; color: #3b82f6; }
        .header .status { font-size: 0.85rem; color: #94a3b8; }
        .header .status.active { color: #22c55e; }

        .sidebar { background: #1e293b; padding: 16px; overflow-y: auto; border-right: 1px solid #334155; }

        .panel { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
        .panel h3 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }

        .form-group { margin-bottom: 10px; }
        .form-group label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 4px; }
        .form-group input, .form-group select { width: 100%; padding: 8px 10px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 0.9rem; }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: #3b82f6; }

        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: all 0.2s; width: 100%; }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #dc2626; }
        .btn-sm { padding: 5px 10px; width: auto; font-size: 0.75rem; }

        .bus-list { list-style: none; }
        .bus-item { background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 10px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
        .bus-item.yakin { border-color: #f59e0b; background: #1c1917; }
        .bus-item.durakta { border-color: #22c55e; background: #052e16; }
        .bus-plaka { font-weight: 700; font-size: 0.9rem; }
        .bus-durak { font-size: 0.75rem; color: #94a3b8; }
        .bus-kalan { font-size: 0.85rem; font-weight: 600; text-align: right; }
        .bus-kalan .eta { font-size: 0.7rem; color: #94a3b8; display: block; }
        .kalan-yakin { color: #f59e0b; }
        .kalan-durakta { color: #22c55e; }
        .kalan-uzak { color: #64748b; }

        .notif-item { background: #1e293b; border-left: 3px solid #3b82f6; padding: 8px 10px; margin-bottom: 6px; border-radius: 0 4px 4px 0; font-size: 0.8rem; }
        .notif-item.acil { border-left-color: #ef4444; }
        .notif-time { color: #64748b; font-size: 0.7rem; }

        .fav-item { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 8px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 0.85rem; cursor: pointer; }
        .fav-item:hover { background: #334155; }

        #map { width: 100%; height: 100%; min-height: 400px; }

        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .stat-box { background: #1e293b; padding: 10px; border-radius: 6px; text-align: center; }
        .stat-num { font-size: 1.5rem; font-weight: 700; color: #3b82f6; }
        .stat-label { font-size: 0.7rem; color: #94a3b8; }

        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; grid-template-rows: auto 300px 1fr; }
            .sidebar { order: 3; border-right: none; border-top: 1px solid #334155; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>İETT Otobus Takip Sistemi</h1>
            <span class="status" id="connectionStatus">Baglaniyor...</span>
        </div>

        <div class="sidebar">
            <!-- Hat Secimi -->
            <div class="panel">
                <h3>Hat Takibi</h3>
                <div class="form-group">
                    <label>Hat Kodu</label>
                    <input type="text" id="hatKodu" placeholder="ornek: 500T, 34BZ" value="">
                </div>
                <div class="form-group">
                    <label>Hedef Durak</label>
                    <select id="durakSecim" disabled>
                        <option value="">Once hat kodu girin</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Kac durak kala uyari</label>
                    <input type="number" id="uyariSayisi" value="3" min="1" max="20">
                </div>
                <button class="btn btn-primary" id="btnBaslat" onclick="takipBaslat()">Takibi Baslat</button>
                <button class="btn btn-danger" id="btnDurdur" onclick="takipDurdur()" style="display:none; margin-top:6px;">Durdur</button>
            </div>

            <!-- Otobusler -->
            <div class="panel">
                <h3>Aktif Otobusler</h3>
                <div class="stats" id="statsArea">
                    <div class="stat-box"><div class="stat-num" id="statOtobus">0</div><div class="stat-label">Otobus</div></div>
                    <div class="stat-box"><div class="stat-num" id="statBildirim">0</div><div class="stat-label">Bildirim</div></div>
                </div>
                <ul class="bus-list" id="otobusList" style="margin-top:10px;"></ul>
            </div>

            <!-- Bildirimler -->
            <div class="panel">
                <h3>Son Bildirimler</h3>
                <div id="bildirimList"></div>
            </div>

            <!-- Favoriler -->
            <div class="panel">
                <h3>Favoriler</h3>
                <div id="favoriList"></div>
                <button class="btn btn-primary btn-sm" onclick="favoriEkle()" style="margin-top:8px;">Mevcut Takibi Favorilere Ekle</button>
            </div>
        </div>

        <div id="map"></div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.4/socket.io.min.js"></script>
    <script>
        // --- Harita ---
        const map = L.map('map').setView([41.0082, 28.9784], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const busIcon = L.divIcon({ className: '', html: '<div style="background:#3b82f6;color:white;padding:3px 6px;border-radius:4px;font-size:11px;font-weight:bold;white-space:nowrap;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">BUS</div>', iconSize: [40, 24], iconAnchor: [20, 12] });
        const busYakinIcon = L.divIcon({ className: '', html: '<div style="background:#f59e0b;color:white;padding:3px 6px;border-radius:4px;font-size:11px;font-weight:bold;white-space:nowrap;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);animation:pulse 1s infinite;">BUS</div>', iconSize: [40, 24], iconAnchor: [20, 12] });
        const stopIcon = L.divIcon({ className: '', html: '<div style="background:#22c55e;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
        const targetIcon = L.divIcon({ className: '', html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

        let busMarkers = {};
        let stopMarkers = [];
        let targetMarker = null;
        let routeLine = null;

        // --- Socket.IO ---
        const socket = io();
        let takipAktif = false;
        let bildirimSayisi = 0;

        socket.on('connect', () => {
            document.getElementById('connectionStatus').textContent = 'Bagli';
            document.getElementById('connectionStatus').className = 'status active';
        });

        socket.on('disconnect', () => {
            document.getElementById('connectionStatus').textContent = 'Baglanti kesildi';
            document.getElementById('connectionStatus').className = 'status';
        });

        socket.on('guncelleme', (data) => {
            guncelleOtobusler(data.otobusler || []);
            document.getElementById('statOtobus').textContent = (data.otobusler || []).length;
            if (data.hata) console.error('API Hatasi:', data.hata);
        });

        socket.on('bildirim', (data) => {
            bildirimSayisi++;
            document.getElementById('statBildirim').textContent = bildirimSayisi;
            bildirimEkle(data);
            if (Notification.permission === 'granted') {
                new Notification(data.baslik, { body: data.mesaj, icon: '/favicon.ico' });
            }
        });

        socket.on('duraklar', (data) => {
            gosterDuraklar(data.duraklar || []);
        });

        // --- Fonksiyonlar ---

        function takipBaslat() {
            const hatKodu = document.getElementById('hatKodu').value.trim().toUpperCase();
            const durakSecim = document.getElementById('durakSecim');
            const durakKodu = durakSecim.value;
            const durakAdi = durakSecim.options[durakSecim.selectedIndex]?.text || '';
            const uyari = parseInt(document.getElementById('uyariSayisi').value) || 3;

            if (!hatKodu) { alert('Hat kodu girin!'); return; }
            if (!durakKodu) { alert('Hedef durak secin!'); return; }

            socket.emit('takip_baslat', {
                hat_kodu: hatKodu,
                durak_kodu: durakKodu,
                durak_adi: durakAdi,
                uyari: uyari
            });

            takipAktif = true;
            document.getElementById('btnBaslat').style.display = 'none';
            document.getElementById('btnDurdur').style.display = 'block';

            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }

        function takipDurdur() {
            socket.emit('takip_durdur');
            takipAktif = false;
            document.getElementById('btnBaslat').style.display = 'block';
            document.getElementById('btnDurdur').style.display = 'none';
            temizle();
        }

        function temizle() {
            Object.values(busMarkers).forEach(m => map.removeLayer(m));
            busMarkers = {};
            stopMarkers.forEach(m => map.removeLayer(m));
            stopMarkers = [];
            if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
            if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
            document.getElementById('otobusList').innerHTML = '';
        }

        function guncelleOtobusler(otobusler) {
            const mevcutPlakalar = new Set();
            const listEl = document.getElementById('otobusList');
            listEl.innerHTML = '';

            const sorted = otobusler.sort((a, b) => b.kalan_durak - a.kalan_durak);

            sorted.forEach(bus => {
                mevcutPlakalar.add(bus.plaka);
                const lat = bus.enlem, lng = bus.boylam;
                const yakin = bus.kalan_durak > 0 && bus.kalan_durak <= 3;
                const durakta = bus.kalan_durak === 0;
                const icon = yakin ? busYakinIcon : busIcon;

                if (busMarkers[bus.plaka]) {
                    busMarkers[bus.plaka].setLatLng([lat, lng]).setIcon(icon);
                } else {
                    busMarkers[bus.plaka] = L.marker([lat, lng], { icon: icon })
                        .addTo(map)
                        .bindPopup(`<b>${bus.plaka}</b><br>${bus.yakin_durak_ad}<br>Hiz: ${bus.hiz} km/s`);
                }

                // Liste
                let kalanClass = 'kalan-uzak';
                let kalanText = bus.kalan_durak > 0 ? `${bus.kalan_durak} durak` : bus.kalan_durak === 0 ? 'DURAKTA' : 'Gecti';
                if (yakin) kalanClass = 'kalan-yakin';
                if (durakta) kalanClass = 'kalan-durakta';

                let etaHtml = '';
                if (bus.tahmini_varis && bus.kalan_durak > 0) {
                    const dk = Math.round(bus.tahmini_varis / 60);
                    etaHtml = `<span class="eta">~${dk} dk</span>`;
                }

                const itemClass = yakin ? 'bus-item yakin' : durakta ? 'bus-item durakta' : 'bus-item';
                listEl.innerHTML += `
                    <li class="${itemClass}" onclick="map.setView([${lat},${lng}], 15)">
                        <div>
                            <div class="bus-plaka">${bus.plaka}</div>
                            <div class="bus-durak">${bus.yakin_durak_ad}</div>
                        </div>
                        <div class="bus-kalan ${kalanClass}">${kalanText}${etaHtml}</div>
                    </li>`;
            });

            // Eski marker'lari temizle
            Object.keys(busMarkers).forEach(plaka => {
                if (!mevcutPlakalar.has(plaka)) {
                    map.removeLayer(busMarkers[plaka]);
                    delete busMarkers[plaka];
                }
            });
        }

        function gosterDuraklar(duraklar) {
            stopMarkers.forEach(m => map.removeLayer(m));
            stopMarkers = [];
            if (targetMarker) map.removeLayer(targetMarker);
            if (routeLine) map.removeLayer(routeLine);

            const latlngs = [];

            duraklar.forEach(d => {
                if (d.enlem && d.boylam) {
                    latlngs.push([d.enlem, d.boylam]);
                    const isTarget = d.hedef;
                    const icon = isTarget ? targetIcon : stopIcon;
                    const m = L.marker([d.enlem, d.boylam], { icon: icon })
                        .addTo(map)
                        .bindPopup(`<b>${d.ad}</b><br>Sira: ${d.sira}<br>Kod: ${d.kod}`);

                    if (isTarget) {
                        targetMarker = m;
                    } else {
                        stopMarkers.push(m);
                    }
                }
            });

            if (latlngs.length > 1) {
                routeLine = L.polyline(latlngs, { color: '#3b82f6', weight: 3, opacity: 0.6 }).addTo(map);
                map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
            }
        }

        function bildirimEkle(data) {
            const el = document.getElementById('bildirimList');
            const cls = data.aciliyet === 'acil' ? 'notif-item acil' : 'notif-item';
            el.innerHTML = `<div class="${cls}"><div class="notif-time">${data.zaman || new Date().toLocaleTimeString()}</div><b>${data.baslik}</b><br>${data.mesaj}</div>` + el.innerHTML;
            // Max 20 bildirim goster
            while (el.children.length > 20) el.removeChild(el.lastChild);
        }

        // --- Hat kodu girildiginde duraklari yukle ---
        let hatYuklemeTimer = null;
        document.getElementById('hatKodu').addEventListener('input', function() {
            clearTimeout(hatYuklemeTimer);
            hatYuklemeTimer = setTimeout(() => {
                const hat = this.value.trim().toUpperCase();
                if (hat.length >= 2) durakYukle(hat);
            }, 500);
        });

        function durakYukle(hatKodu) {
            const sel = document.getElementById('durakSecim');
            sel.disabled = true;
            sel.innerHTML = '<option value="">Yukleniyor...</option>';

            fetch(`/api/duraklar/${hatKodu}`)
                .then(r => r.json())
                .then(data => {
                    sel.innerHTML = '<option value="">Durak secin...</option>';
                    (data.duraklar || []).forEach(d => {
                        sel.innerHTML += `<option value="${d.kod}">${d.sira}. ${d.ad}</option>`;
                    });
                    sel.disabled = false;
                })
                .catch(() => {
                    sel.innerHTML = '<option value="">Hata - tekrar deneyin</option>';
                    sel.disabled = false;
                });
        }

        // --- Favoriler ---
        function favoriEkle() {
            const hat = document.getElementById('hatKodu').value.trim().toUpperCase();
            const sel = document.getElementById('durakSecim');
            const kod = sel.value;
            const ad = sel.options[sel.selectedIndex]?.text || '';
            const uyari = parseInt(document.getElementById('uyariSayisi').value) || 3;
            if (!hat || !kod) { alert('Hat ve durak secimi yapiniz!'); return; }

            fetch('/api/favori', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({hat_kodu: hat, durak_kodu: kod, durak_adi: ad, uyari: uyari})
            }).then(() => favorileriYukle());
        }

        function favorileriYukle() {
            fetch('/api/favoriler')
                .then(r => r.json())
                .then(data => {
                    const el = document.getElementById('favoriList');
                    el.innerHTML = '';
                    (data.favoriler || []).forEach(f => {
                        el.innerHTML += `
                            <div class="fav-item" onclick="favoriSec('${f.hat_kodu}','${f.durak_kodu}')">
                                <span>${f.hat_kodu} > ${f.durak_adi}</span>
                                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); favoriSil('${f.hat_kodu}','${f.durak_kodu}')">Sil</button>
                            </div>`;
                    });
                });
        }

        function favoriSec(hat, durakKodu) {
            document.getElementById('hatKodu').value = hat;
            durakYukle(hat);
            setTimeout(() => { document.getElementById('durakSecim').value = durakKodu; }, 1500);
        }

        function favoriSil(hat, kod) {
            fetch('/api/favori', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({hat_kodu: hat, durak_kodu: kod})
            }).then(() => favorileriYukle());
        }

        // Sayfa yuklendiginde
        favorileriYukle();
    </script>
    <style>
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
    </style>
</body>
</html>
"""


# ==================== ROUTES ====================

@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route("/api/duraklar/<hat_kodu>")
def api_duraklar(hat_kodu):
    """Hat duraklarını JSON olarak döner."""
    try:
        takipci = OtobusTakipci(hat_kodu=hat_kodu)
        duraklar = takipci.duraklari_listele()
        return jsonify({
            "duraklar": [
                {"kod": d.kod, "ad": d.ad, "enlem": d.enlem, "boylam": d.boylam, "sira": d.sira}
                for d in duraklar
            ]
        })
    except IETTApiError as e:
        return jsonify({"hata": str(e), "duraklar": []}), 500


@app.route("/api/favoriler")
def api_favoriler():
    favoriler = db.favorileri_getir()
    return jsonify({
        "favoriler": [
            {"hat_kodu": f.hat_kodu, "durak_kodu": f.durak_kodu,
             "durak_adi": f.durak_adi, "uyari": f.uyari_durak_sayisi}
            for f in favoriler
        ]
    })


@app.route("/api/favori", methods=["POST"])
def api_favori_ekle():
    data = request.get_json()
    db.favori_ekle(
        data["hat_kodu"], data["durak_kodu"],
        data.get("durak_adi", ""), data.get("uyari", 3),
    )
    return jsonify({"ok": True})


@app.route("/api/favori", methods=["DELETE"])
def api_favori_sil():
    data = request.get_json()
    db.favori_sil(data["hat_kodu"], data["durak_kodu"])
    return jsonify({"ok": True})


@app.route("/api/istatistik")
def api_istatistik():
    return jsonify(db.istatistik_getir())


# ==================== SOCKET.IO EVENTS ====================

@socketio.on("takip_baslat")
def handle_takip_baslat(data):
    """Yeni bir hat takibi başlatır."""
    hat_kodu = data.get("hat_kodu", "").upper().strip()
    durak_kodu = data.get("durak_kodu", "")
    uyari = data.get("uyari", 3)

    if hat_kodu in aktif_takipciler:
        aktif_takipciler[hat_kodu].takip_durdur()

    web_bildirim = BildirimYoneticisi(masaustu=True, ses=True)

    takipci = OtobusTakipci(
        hat_kodu=hat_kodu,
        hedef_durak_kodu=durak_kodu,
        uyari_durak_sayisi=uyari,
        kontrol_araligi=30,
        bildirim=web_bildirim,
        veritabani=db,
    )

    try:
        takipci.hat_bilgilerini_yukle()
        takipci.hedef_durak_belirle()
    except IETTApiError as e:
        socketio.emit("hata", {"mesaj": str(e)})
        return

    aktif_takipciler[hat_kodu] = takipci

    # Durak bilgilerini gönder
    durak_data = []
    for d in takipci.hat_duraklari:
        durak_data.append({
            "kod": d.kod, "ad": d.ad, "enlem": d.enlem, "boylam": d.boylam,
            "sira": d.sira, "hedef": d.kod == durak_kodu,
        })
    socketio.emit("duraklar", {"duraklar": durak_data})

    # Takip thread'i başlat
    def _takip_dongusu():
        while hat_kodu in aktif_takipciler and aktif_takipciler[hat_kodu] is takipci:
            try:
                sonuc = takipci.kontrol_et()
                otobus_data = []
                for o in sonuc.otobusler:
                    otobus_data.append({
                        "plaka": o.plaka, "enlem": o.enlem, "boylam": o.boylam,
                        "hiz": o.hiz, "saat": o.saat,
                        "yakin_durak_ad": o.yakin_durak_ad,
                        "kalan_durak": o.kalan_durak,
                        "tahmini_varis": o.tahmini_varis,
                    })
                socketio.emit("guncelleme", {
                    "hat_kodu": hat_kodu,
                    "otobusler": otobus_data,
                    "hata": sonuc.hata,
                })

                for o in sonuc.uyari_verilen:
                    eta_str = ""
                    if o.tahmini_varis:
                        eta_str = f" (~{int(o.tahmini_varis/60)} dk)"
                    socketio.emit("bildirim", {
                        "baslik": f"Otobus {o.kalan_durak} Durak Kala!",
                        "mesaj": f"{hat_kodu} - {o.plaka} | {o.yakin_durak_ad}{eta_str}",
                        "aciliyet": "acil" if o.kalan_durak <= 1 else "normal",
                        "zaman": time.strftime("%H:%M:%S"),
                    })

            except Exception as e:
                logger.error("Takip döngüsü hatası: %s", e)

            time.sleep(takipci.kontrol_araligi)

    t = threading.Thread(target=_takip_dongusu, daemon=True)
    takip_threadleri[hat_kodu] = t
    t.start()


@socketio.on("takip_durdur")
def handle_takip_durdur():
    for key in list(aktif_takipciler.keys()):
        aktif_takipciler[key].takip_durdur()
        del aktif_takipciler[key]


# ==================== MAIN ====================

def main():
    parser = argparse.ArgumentParser(description="İETT Web Dashboard")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    print(f"\n  İETT Otobus Takip - Web Dashboard")
    print(f"  http://localhost:{args.port}")
    print(f"  Ctrl+C ile durdur\n")

    socketio.run(app, host=args.host, port=args.port, debug=args.debug, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
