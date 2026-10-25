"""
Uji Google Authenticator sebagai langkah kedua Kunci Aplikasi, di Chromium dengan Drive/Sheets palsu.

Kode 6 angka dihitung di sini dengan hmac/hashlib Python (bukan kode aplikasi), jadi kecocokannya membuktikan aplikasi
memakai TOTP standar yang juga dipahami Google Authenticator.

Pakai:
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_totp.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import base64
import hashlib
import hmac
import json
import pathlib
import struct
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def kode_totp(rahasia, selisih_langkah=0, waktu=None):
    bersih = rahasia.replace(" ", "").upper()
    kunci = base64.b32decode(bersih + "=" * (-len(bersih) % 8))
    langkah = int((waktu if waktu is not None else time.time()) // 30) + selisih_langkah
    h = hmac.new(kunci, struct.pack(">Q", langkah), hashlib.sha1).digest()
    o = h[-1] & 15
    return f"{(struct.unpack('>I', h[o:o + 4])[0] & 0x7FFFFFFF) % 10**6:06d}"


def buka(p):
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    ctx = b.new_context(viewport={"width": 420, "height": 900}, service_workers="block")
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    pg.add_init_script(TIRUAN)
    pg.goto(BASE)
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(500)
    return b, pg, galat


def buka_app(pg, app):
    pg.locator(".navbar button", has_text="Saya").first.click()
    pg.wait_for_timeout(300)
    if pg.locator(".saya-peluncur").count() == 0:
        pg.get_by_role("button", name="Kembali ke daftar aplikasi").click()
        pg.wait_for_timeout(200)
    pg.locator(f"[data-app={app}]").click()
    pg.wait_for_timeout(400)


def hubungkan(pg):
    buka_app(pg, "drive")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.get_by_text("Konektor Google Drive aktif").first.wait_for(timeout=10000)
    pg.wait_for_function("window.__drive.calls.filter(c => c.tool === 'get_values').length >= 2", timeout=30000)
    pg.wait_for_timeout(900)


def simpanan(pg):
    return json.loads(pg.evaluate("localStorage.getItem('keuangan-totp') || 'null'"))


def isi_pin(pg, pin="1234"):
    pg.keyboard.type(pin)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(500)


def terkunci(pg):
    return pg.locator(".app-lock-overlay").count() == 1


with sync_playwright() as p:
    print("1. Tanpa Kunci Aplikasi, Authenticator belum bisa diaktifkan")
    b, pg, galat = buka(p)
    hubungkan(pg)
    buka_app(pg, "kunci")
    cek(pg.locator("#btn-totp").is_disabled(), "tombol Authenticator nonaktif selama PIN belum aktif")
    cek("Aktifkan Kunci Aplikasi" in pg.locator("#kartu-totp").inner_text(), "kartu menjelaskan perlu PIN dulu")

    print("2. Aktifkan PIN, lalu siapkan Google Authenticator")
    pg.get_by_role("button", name="Aktifkan Kunci Aplikasi").click()
    pg.fill("#input-pin-baru", "1234")
    pg.fill("#input-pin-konfirmasi", "1234")
    pg.get_by_role("button", name="Aktifkan Kunci", exact=True).click()
    pg.wait_for_timeout(600)
    cek(not pg.locator("#btn-totp").is_disabled(), "tombol Authenticator aktif setelah PIN dibuat")
    pg.locator("#btn-totp").click()
    pg.wait_for_selector("#totp-kunci")
    pg.wait_for_selector("#totp-email", timeout=10000)
    cek(pg.locator("#totp-email").inner_text() == "saya@example.org", "akun tertaut = email pemilik Drive (saya@example.org)")
    rahasia = pg.locator("#totp-kunci").inner_text().replace(" ", "")
    cek(len(rahasia) == 32 and rahasia.isalnum(), f"kunci penyiapan 32 huruf base32 ({len(rahasia)})")
    cek(pg.locator("#totp-modal canvas.kode-qr").count() == 1, "kode QR tampil")
    cek(simpanan(pg) is None, "belum aktif sebelum kode terbukti benar")
    cek(pg.locator("#totp-aktifkan").is_disabled(), "tombol Aktifkan nonaktif sebelum 6 angka diisi")
    pg.fill("#totp-kode", "000000")
    pg.locator("#totp-aktifkan").click()
    pg.wait_for_selector("#totp-pesan")
    cek(simpanan(pg) is None, "kode salah: tidak aktif")
    pg.fill("#totp-kode", kode_totp(rahasia))
    pg.locator("#totp-aktifkan").click()
    pg.wait_for_selector("#totp-status", timeout=5000)
    s = simpanan(pg)
    cek(s is not None and s["rahasia"] == rahasia and s["email"] == "saya@example.org", "kode benar: aktif, rahasia dan email tersimpan di perangkat")
    cek("Saya@Example.org".lower() in pg.locator("#totp-status").inner_text().lower(), "status menampilkan akun tertaut")

    print("3. Rahasia tidak ikut ke Google Drive")
    pg.keyboard.press("Escape")
    pg.locator("button[aria-label=Tutup]").first.click()
    pg.wait_for_timeout(400)
    pg.wait_for_function("window.__drive.calls.some(c => c.tool === 'create_file' && /Pengaturan/.test(c.input.title || ''))", timeout=60000)
    pg.wait_for_timeout(1500)
    di_drive = pg.evaluate(
        """(r) => {
          const D = window.__drive;
          const isi = [...D.files.values()].map(f => f.bytes ? new TextDecoder().decode(f.bytes) : '').join('\\n');
          return { drive: isi.includes(r), panggilan: JSON.stringify(D.calls).includes(r), pengaturan: isi.includes('pinHash') };
        }""",
        rahasia,
    )
    cek(di_drive["pengaturan"], "Pengaturan.json ikut tersinkron (berisi konfigurasi PIN)")
    cek(not di_drive["drive"] and not di_drive["panggilan"], "rahasia Authenticator tidak ada di berkas Drive maupun panggilan konektor")

    print("4. Dalam masa percaya (8 jam) PIN saja cukup")
    pg.reload()
    pg.wait_for_selector(".app-lock-overlay", timeout=15000)
    cek(pg.locator("#lock-totp").count() == 0, "layar kunci meminta PIN")
    isi_pin(pg)
    cek(not terkunci(pg), "PIN benar langsung membuka (belum perlu kode)")

    print("5. Interval 'setiap kali': langkah kedua muncul sesudah PIN")
    buka_app(pg, "kunci")
    pg.locator("#btn-totp").click()
    pg.wait_for_selector("#totp-interval")
    pg.select_option("#totp-interval", "selalu")
    pg.wait_for_timeout(300)
    cek(simpanan(pg)["interval"] == "selalu", "interval tersimpan")
    pg.get_by_role("button", name="Tutup", exact=True).first.click()
    pg.get_by_role("button", name="Kelola Kunci / PIN").click()
    cek(pg.locator("#kunci-butuh-totp-mati").count() == 1 and pg.get_by_role("button", name="Nonaktifkan Kunci").count() == 0, "kunci tidak bisa dimatikan selama Authenticator aktif")
    pg.locator("button.btn-ikon", has_text="✕").first.click()
    pg.reload()
    pg.wait_for_selector(".app-lock-overlay", timeout=15000)
    pg.keyboard.type("0000")
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(400)
    cek(pg.locator("#lock-totp").count() == 0 and terkunci(pg), "PIN salah: tetap di langkah PIN, tanpa melihat langkah kedua")
    isi_pin(pg)
    pg.wait_for_selector("#lock-kode-totp", timeout=5000)
    cek(terkunci(pg), "PIN benar tetapi masih terkunci: diminta kode Authenticator")
    cek("saya@example.org" in pg.locator("#lock-totp").inner_text(), "langkah kedua menyebut akun tertaut")

    print("6. Kode salah, pembatasan percobaan, lalu kode benar")
    pg.fill("#lock-kode-totp", "123456")
    pg.wait_for_selector("#lock-totp-galat")
    cek(terkunci(pg) and pg.locator("#lock-totp-jeda").count() == 0, "salah pertama: ditolak tanpa jeda")
    for _ in range(4):
        pg.fill("#lock-kode-totp", "")
        pg.fill("#lock-kode-totp", "654321")
        pg.wait_for_timeout(250)
    pg.wait_for_selector("#lock-totp-jeda", timeout=5000)
    cek("detik" in pg.locator("#lock-totp-jeda").inner_text(), "salah kelima: dikunci sementara dengan hitung mundur")
    cek(simpanan(pg)["percobaanGagal"] == 5, "jumlah percobaan gagal tercatat di perangkat")
    pg.fill("#lock-kode-totp", kode_totp(rahasia))
    pg.wait_for_timeout(500)
    cek(terkunci(pg), "selama dikunci, kode yang benar pun tidak membuka")
    pg.reload()
    pg.wait_for_selector(".app-lock-overlay", timeout=15000)
    isi_pin(pg)
    pg.wait_for_selector("#lock-kode-totp")
    cek(pg.locator("#lock-totp-jeda").count() == 1, "memuat ulang tidak menghapus jeda (disimpan di penyimpanan)")
    # Waktu berlalu: jeda habis dan kode aktivasi (langkah 30 detik yang sama) sudah lewat, jadi langkah terakhir dilonggarkan.
    pg.evaluate("(() => { const t = JSON.parse(localStorage.getItem('keuangan-totp')); t.terkunciSampai = 0; t.langkahTerakhir = -1; localStorage.setItem('keuangan-totp', JSON.stringify(t)); })()")
    pg.reload()
    pg.wait_for_selector(".app-lock-overlay", timeout=15000)
    isi_pin(pg)
    pg.wait_for_selector("#lock-kode-totp")
    kode = kode_totp(rahasia)
    pg.fill("#lock-kode-totp", kode)
    pg.wait_for_timeout(700)
    cek(not terkunci(pg), "kode yang benar membuka kunci")
    cek(simpanan(pg)["percobaanGagal"] == 0, "hitungan gagal di-nol-kan")

    print("7. Kode yang sudah dipakai tidak bisa dipakai lagi")
    pg.reload()
    pg.wait_for_selector(".app-lock-overlay", timeout=15000)
    isi_pin(pg)
    pg.wait_for_selector("#lock-kode-totp")
    pg.fill("#lock-kode-totp", kode)
    pg.wait_for_selector("#lock-totp-galat")
    cek(terkunci(pg), "kode yang sama ditolak (pencegahan pemakaian ulang)")
    pg.fill("#lock-kode-totp", "")
    pg.fill("#lock-kode-totp", kode_totp(rahasia, 1))
    pg.wait_for_timeout(700)
    cek(not terkunci(pg), "kode langkah berikutnya (selisih jam ponsel 30 detik) diterima")

    print("8. Nonaktifkan butuh kode yang sah")
    pg.evaluate("(() => { const t = JSON.parse(localStorage.getItem('keuangan-totp')); t.langkahTerakhir = -1; localStorage.setItem('keuangan-totp', JSON.stringify(t)); })()")
    buka_app(pg, "kunci")
    pg.locator("#btn-totp").click()
    pg.wait_for_selector("#totp-nonaktifkan")
    pg.fill("#totp-kode-nonaktif", "000000")
    pg.locator("#totp-nonaktifkan").click()
    pg.wait_for_selector("#totp-pesan")
    cek(simpanan(pg) is not None, "kode salah: tetap aktif")
    pg.fill("#totp-kode-nonaktif", kode_totp(rahasia))
    pg.locator("#totp-nonaktifkan").click()
    pg.wait_for_selector("#totp-aktifkan", timeout=5000)
    cek(simpanan(pg) is None, "kode benar: nonaktif dan rahasia dihapus dari perangkat")
    pg.locator("button[aria-label=Tutup]").first.click()
    cek("Google Authenticator" in pg.locator("#kartu-totp").inner_text() and "Aktif" not in pg.locator("#kartu-totp").inner_text().split("\n")[0], "kartu kembali ke keadaan belum aktif")
    pg.reload()
    pg.wait_for_selector(".app-lock-overlay", timeout=15000)
    isi_pin(pg)
    cek(not terkunci(pg) and pg.locator("#lock-totp").count() == 0, "setelah dinonaktifkan PIN saja kembali cukup")
    cek(not galat, f"tanpa galat JS ({galat})")
    b.close()

print()
if gagal:
    print(f"{len(gagal)} pemeriksaan GAGAL:")
    for g in gagal:
        print(" -", g)
    sys.exit(1)
print("Semua uji lolos")
