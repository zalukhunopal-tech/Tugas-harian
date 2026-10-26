"""
Uji tab Saya sebagai layar aplikasi, Laporan Dana Kegiatan di dalamnya, dan hilangnya animasi Perluasan Domain.

Pakai (build artefak, Drive palsu tidak dipakai di sini):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_saya.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


KEGIATAN = [{"id": "kg1", "nama": "Survei Hulu Contoh", "lokasi": "Kota Tujuan", "tanggalMulai": "2026-09-20", "tanggalSelesai": "2026-10-23"}]
TRANSAKSI = [
    {"id": "p1", "jenis": "pengeluaran", "dana": "Dana Kegiatan", "tanggal": "2026-09-21", "deskripsi": "Perdiem Kalimantan · 21 Sep 2026", "kategori": "Perdiem",
     "jumlah": 200000, "metode": "Tunai", "kaitan": "", "catatan": ""},
]
APLIKASI = ["drive", "laporan", "keluarga", "tema", "rutin", "kunci"]


def buka(p, lebar):
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    ctx = b.new_context(viewport={"width": lebar, "height": 900}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    pg.add_init_script(TIRUAN)
    pg.add_init_script(
        "if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');"
        "localStorage.setItem('keuangan-karakter','megumi');"
        f"localStorage.setItem('pengeluaran-harian', {json.dumps(json.dumps(TRANSAKSI))});"
        f"localStorage.setItem('keuangan-daftar-kegiatan', {json.dumps(json.dumps(KEGIATAN))});}}"
    )
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for(timeout=15000)
    pg.wait_for_timeout(600)
    return b, pg, galat


def nav(pg, nama):
    pg.locator(".navbar:visible button, .sidebar:visible button", has_text=nama).first.click()
    pg.wait_for_timeout(500)


with sync_playwright() as p:
    for lebar, nama in [(360, "HP kecil"), (420, "HP"), (820, "tablet"), (1280, "PC")]:
        print(f"== {nama} ({lebar}px)")
        b, pg, galat = buka(p, lebar)
        nav(pg, "Saya")
        cek(pg.locator(".saya-peluncur .saya-app").count() == 6, "enam aplikasi tampil sebagai ikon (Profil Pelapor menyatu dengan Laporan)")
        cek(pg.locator("details.folder").count() == 0, "tidak ada lagi baris berbentuk folder")
        cek(pg.evaluate("[...document.querySelectorAll('.saya-app-nama')].map(e => e.innerText)") == ["Drive Keuangan", "Laporan Kegiatan", "Keluarga", "Tema & Karakter", "Transaksi Rutin", "Kunci Aplikasi"],
            "nama aplikasi sesuai konteks kerja")
        kolom = pg.evaluate("new Set([...document.querySelectorAll('.saya-app')].map(e => Math.round(e.getBoundingClientRect().x))).size")
        cek(kolom == 4, f"empat kolom ({kolom})")
        cek(not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"), "tanpa luapan horizontal")
        for app in APLIKASI:
            pg.locator(f"[data-app={app}]").click()
            pg.wait_for_timeout(300)
            ada = pg.locator(".laporan-container").count() == 1 if app == "laporan" else pg.locator(f"#panel-{app}").count() == 1
            cek(ada and pg.locator(".saya-peluncur").count() == 0, f"{app}: isi terbuka, daftar ikon tersembunyi")
            pg.get_by_role("button", name="Kembali ke daftar aplikasi").click()
            pg.wait_for_timeout(200)
            cek(pg.locator(".saya-peluncur").count() == 1, f"{app}: tombol kembali menampilkan daftar ikon")
        cek(not galat, f"tanpa galat JS ({galat})")
        b.close()

    print("== Profil Pelapor menyatu di Laporan Kegiatan")
    for lebar in (412, 1280):
        b, pg, galat = buka(p, lebar)
        nav(pg, "Saya")
        cek(pg.locator("[data-app=profil]").count() == 0, f"{lebar}px: tidak ada lagi ikon Profil Pelapor terpisah")
        cek("profil pelapor belum diisi" in pg.locator("[data-app=laporan]").inner_text(), f"{lebar}px: ikon Laporan mengingatkan profil yang belum diisi")
        pg.locator("[data-app=laporan]").click()
        pg.wait_for_timeout(400)
        panel = pg.locator("details#panel-profil")
        cek(panel.count() == 1 and panel.evaluate("e => e.open"), f"{lebar}px: bagian Profil Pelapor terbuka di atas laporan selama belum diisi")
        cek(pg.locator("#panel-profil").evaluate("(e) => e.compareDocumentPosition(document.querySelector('.laporan-container')) & 4") > 0, f"{lebar}px: profil berada di atas parameter laporan")
        pg.fill("#profil-nama", "Budi Santoso")
        pg.fill("#profil-jabatan", "Surveyor")
        pg.fill("#profil-lembaga", "Lembaga Contoh")
        pg.fill("#profil-proyek", "Proyek Contoh")
        pg.get_by_role("button", name="Simpan Profil Pelapor").click()
        pg.wait_for_timeout(400)
        ringkas = pg.locator("#panel-profil summary").inner_text()
        cek("Budi Santoso" in ringkas and "Surveyor" in ringkas, f"{lebar}px: ringkasan memuat nama dan jabatan ({ringkas!r})")
        cek("Budi Santoso" in pg.evaluate("localStorage.getItem('keuangan-profil-pelapor')"), f"{lebar}px: profil tersimpan")
        pg.emulate_media(media="print")
        cek(pg.evaluate("getComputedStyle(document.querySelector('#panel-profil')).display") == "none", f"{lebar}px: formulir profil tidak ikut dicetak")
        pg.emulate_media(media="screen")
        pg.reload()
        pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
        pg.wait_for_timeout(500)
        nav(pg, "Saya")
        pg.locator("[data-app=laporan]").click()
        pg.wait_for_timeout(400)
        cek(not pg.locator("details#panel-profil").evaluate("e => e.open"), f"{lebar}px: setelah diisi, bagian profil terlipat")
        cek(not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"), f"{lebar}px: tanpa luapan horizontal")
        cek(not galat, f"tanpa galat JS ({galat})")
        b.close()

    print("== Laporan Dana Kegiatan pindah ke tab Saya")
    b, pg, galat = buka(p, 420)
    nav(pg, "Grafik")
    teks_tab = pg.evaluate("[...document.querySelectorAll('#view-grafik [role=tab]')].map(e => e.innerText.trim())")
    cek(len(teks_tab) == 2 and not any("Laporan" in t for t in teks_tab), f"Grafik tinggal dua tab ({teks_tab})")
    lebar_chip = pg.evaluate("[...document.querySelectorAll('#view-grafik [role=tab]')].map(e => Math.round(e.getBoundingClientRect().width))")
    cek(abs(lebar_chip[0] - lebar_chip[1]) <= 2, f"dua tab Grafik sama lebar di HP ({lebar_chip})")
    pg.get_by_role("tab", name="Ringkasan Tahunan").click()
    pg.wait_for_timeout(400)
    cek(pg.locator("#view-grafik").count() == 1 and "Ringkasan Keuangan Tahun" in pg.inner_text("body"), "Ringkasan Tahunan tetap berfungsi")
    nav(pg, "Saya")
    pg.locator("[data-app=laporan]").click()
    pg.wait_for_timeout(500)
    cek(pg.locator("#lap-kegiatan-select").count() == 1, "pilihan kegiatan lapangan ada di Laporan (dalam tab Saya)")
    pg.select_option("#lap-kegiatan-select", "kg1")
    pg.wait_for_timeout(500)
    cek(pg.locator("[data-testid=kartu-timesheet]").count() == 1, "kartu Timesheet Perdiem tampil untuk kegiatan terpilih")
    pg.emulate_media(media="print")
    cek(pg.evaluate("getComputedStyle(document.querySelector('.saya-appbar')).display") == "none", "saat dicetak, bilah aplikasi (tombol kembali) disembunyikan")
    cek(pg.evaluate("getComputedStyle(document.querySelector('.navbar')).display") == "none", "saat dicetak, navigasi disembunyikan")
    pg.emulate_media(media="screen")
    cek(not galat, f"tanpa galat JS ({galat})")
    b.close()

    print("== Animasi Perluasan Domain dihapus untuk semua tokoh")
    for tokoh in ["gojo", "sukuna", "jogo", "nanami", "itadori", "megumi", "nobara", "yuta", "toji", "geto", "maki", "mahito"]:
        b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
        ctx = b.new_context(viewport={"width": 420, "height": 900}, service_workers="block")
        pg = ctx.new_page()
        pg.add_init_script(f"localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','{tokoh}');")
        pg.goto(BASE)
        pg.locator(".navbar:visible").first.wait_for(timeout=15000)
        pg.wait_for_timeout(500)
        pg.locator(".topbar .karakter-avatar-wrap").first.click()
        pg.wait_for_timeout(600)
        sisa = pg.evaluate("document.querySelectorAll('.domain-overlay, .domain-teks, body > canvas').length")
        cek(sisa == 0, f"{tokoh}: klik avatar tidak memunculkan efek domain")
        b.close()
    print("== Mengganti karakter di Saya tidak memunculkan animasi")
    b, pg, galat = buka(p, 420)
    nav(pg, "Saya")
    pg.locator("[data-app=tema]").click()
    pg.wait_for_timeout(300)
    pg.locator(".tokoh-kartu[data-karakter=gojo]").click()
    pg.wait_for_timeout(600)
    cek(pg.evaluate("document.querySelectorAll('.domain-overlay, canvas').length") == 0, "ganti karakter: tidak ada lapisan animasi")
    cek(pg.evaluate("document.documentElement.dataset.karakter") == "gojo", "karakter tetap berganti")
    cek(not galat, f"tanpa galat JS ({galat})")
    b.close()

    print("== Pengatur ukuran ikon: satu baris tipis, tombol −/+ dan garis geser")
    for lebar in (360, 1280):
        b, pg, galat = buka(p, lebar)
        nav(pg, "Saya")
        bar = pg.locator(".saya-peluncur-topbar").bounding_box()
        cek(bar["height"] <= 40, f"{lebar}px: judul dan pengatur muat satu baris ({round(bar['height'])}px)")
        cek(not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"), f"{lebar}px: tanpa luapan horizontal")
        jumlah_kolom = "new Set([...document.querySelectorAll('.saya-app')].map(e => Math.round(e.getBoundingClientRect().x))).size"
        perkecil = pg.get_by_role("button", name="Perkecil ikon")
        perbesar = pg.get_by_role("button", name="Perbesar ikon")
        for _ in range(8):
            if perkecil.is_disabled():
                break
            perkecil.click()
        pg.wait_for_timeout(200)
        cek(perkecil.is_disabled() and pg.locator(".saya-peluncur-kolom").inner_text() == "6 kolom", "ukuran terkecil: 6 kolom, tombol perkecil nonaktif")
        cek(pg.evaluate(jumlah_kolom) == 6, "kisi ikon ikut menjadi 6 kolom")
        for _ in range(8):
            if perbesar.is_disabled():
                break
            perbesar.click()
        pg.wait_for_timeout(200)
        cek(perbesar.is_disabled() and pg.locator(".saya-peluncur-kolom").inner_text() == "2 kolom", "ukuran terbesar: 2 kolom, tombol perbesar nonaktif")
        pg.locator(".saya-ukuran-geser").fill("70")
        pg.wait_for_timeout(200)
        cek(pg.locator(".saya-peluncur-kolom").inner_text() == "4 kolom" and pg.evaluate(jumlah_kolom) == 4, "garis geser mengubah ukuran (4 kolom)")
        pg.reload()
        pg.locator(".navbar:visible, .sidebar:visible").first.wait_for(timeout=15000)
        nav(pg, "Saya")
        cek(pg.locator(".saya-ukuran-geser").input_value() == "70", "ukuran tersimpan setelah dimuat ulang")
        cek(not galat, f"tanpa galat JS ({galat})")
        b.close()

if gagal:
    print(f"\n{len(gagal)} uji gagal")
    sys.exit(1)
print("\nSemua uji lolos")
