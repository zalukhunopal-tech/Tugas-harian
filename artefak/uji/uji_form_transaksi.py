"""
Uji tata letak formulir transaksi (tablet/PC) dan tombol kembali aplikasi tab Saya.

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_form_transaksi.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]

Yang dijaga:
  - tablet/PC: Dana | Tanggal dan Jumlah | Metode sebaris, tiga pilihan Jenis satu baris, blok lebar tidak terjepit,
    mode bertahap Dana Kegiatan selebar baris, navbar di bawah dialog PC;
  - HP (< 640 px): semua blok formulir satu kolom (tata letak tidak berubah);
  - tombol kembali aplikasi Saya berlatar opak di semua karakter.
"""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None

KEGIATAN = '[{"id":"kg1","nama":"Survei Hulu Contoh","lokasi":"Kota Contoh","tanggalMulai":"2026-09-20","tanggalSelesai":"2026-10-23"}]'
KARAKTER = ["gojo", "itadori", "megumi", "nanami", "sukuna", "yuta"]

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def kotak(pg, selektor):
    return pg.locator(selektor).first.bounding_box()


def sebaris(a, b):
    return a is not None and b is not None and abs(a["y"] - b["y"]) < 6 and a["x"] + a["width"] <= b["x"] + 2


def buka_form(b, lebar, tinggi=1100, karakter="megumi"):
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:200]))
    pg.add_init_script(
        "if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');"
        f"localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','{karakter}');"
        f"localStorage.setItem('keuangan-daftar-kegiatan', {KEGIATAN!r});}}"
    )
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(600)
    pg.locator(".nav-tambah:visible").first.click()
    pg.wait_for_timeout(400)
    if pg.get_by_text("Isi Formulir Manual").count():
        pg.get_by_text("Isi Formulir Manual").click()
        pg.wait_for_timeout(400)
    return ctx, pg, galat


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()

    for lebar in (768, 1024, 1280):
        print(f"== Formulir {lebar}px")
        ctx, pg, galat = buka_form(b, lebar)
        cek(sebaris(kotak(pg, ".f-dana"), kotak(pg, ".f-tanggal")), "Dana | Tanggal sebaris")
        cek(sebaris(kotak(pg, ".f-jumlah"), kotak(pg, ".f-metode")), "Jumlah | Metode sebaris")
        label = pg.locator(".f-jenis .segmented-options label")
        ys = [label.nth(i).bounding_box()["y"] for i in range(label.count())]
        cek(len(ys) == 3 and max(ys) - min(ys) < 6, "tiga pilihan Jenis dalam satu baris")
        uraian, kategori = kotak(pg, ".f-uraian"), kotak(pg, ".f-kategori")
        form = kotak(pg, "#form-transaksi")
        cek(uraian["width"] > form["width"] * 0.9, "Uraian selebar baris")
        cek(kategori["width"] > form["width"] * 0.9, "Kategori selebar baris")
        cek(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "tidak ada gulir horizontal")
        if lebar >= 1024:
            kotak_dialog = kotak(pg, ".tambah-dialog-box")
            cek(kotak_dialog["width"] >= 700, f"dialog PC melebar ({round(kotak_dialog['width'])}px)")
            z_nav = pg.evaluate("getComputedStyle(document.querySelector('.navbar')).zIndex")
            cek(z_nav == "0", f"navbar di bawah dialog saat terbuka (z-index {z_nav})")
        pg.locator("input[value=pindah_dana]").check(force=True)
        pg.wait_for_timeout(300)
        cek(sebaris(kotak(pg, ".f-tanggal"), kotak(pg, ".f-uraian")), "Pindah Dana: Tanggal | Uraian sebaris")
        cek(not galat, "tanpa galat halaman")
        ctx.close()

    for lebar in (640, 768):
        print(f"== Dana Kegiatan bertahap {lebar}px")
        ctx, pg, galat = buka_form(b, lebar, 1500)
        pg.select_option("#dana", "Dana Kegiatan")
        pg.wait_for_timeout(400)
        form = kotak(pg, "#form-transaksi")
        langkah = kotak(pg, "#form-transaksi > .bertahap")
        cek(langkah is not None and langkah["width"] > form["width"] * 0.9, "stepper selebar baris")
        cek(not galat, "tanpa galat halaman")
        ctx.close()

    for lebar in (360, 420, 600, 639):
        print(f"== Formulir HP {lebar}px: satu kolom")
        ctx, pg, galat = buka_form(b, lebar)
        form = kotak(pg, "#form-transaksi")
        for kelas in (".f-dana", ".f-tanggal", ".f-jumlah", ".f-metode", ".f-uraian"):
            k = kotak(pg, kelas)
            cek(k is not None and k["width"] > form["width"] * 0.9, f"{kelas} selebar formulir")
        cek(not galat, "tanpa galat halaman")
        ctx.close()

    print("== Tombol kembali opak di semua karakter")
    for k in KARAKTER:
        ctx = b.new_context(viewport={"width": 420, "height": 700}, service_workers="block", is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.add_init_script(f"if(!localStorage.getItem('__s')){{localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','{k}');}}")
        pg.goto(BASE)
        pg.locator(".navbar:visible").first.wait_for()
        pg.wait_for_timeout(500)
        pg.locator(".navbar:visible button", has_text="Saya").first.click()
        pg.wait_for_timeout(300)
        pg.locator("[data-app=drive]").click()
        pg.wait_for_timeout(400)
        tombol = pg.locator(".saya-kembali")
        warna = tombol.evaluate("e => { const s = getComputedStyle(e); return [s.backgroundColor, s.backgroundImage].join(' | ') }")
        bg = tombol.evaluate("e => getComputedStyle(e).backgroundColor")
        # Opak: rgb(...) tanpa kanal alfa, atau rgba(..., 1).
        opak = bg.startswith("rgb(") or bg.endswith(", 1)")
        cek(opak, f"{k}: latar tombol kembali opak ({bg})")
        ukuran = tombol.bounding_box()
        cek(ukuran["width"] >= 44 and ukuran["height"] >= 44, f"{k}: area sentuh >= 44px")
        ctx.close()

    b.close()

print()
if gagal:
    print(f"{len(gagal)} pemeriksaan GAGAL")
    sys.exit(1)
print("Semua uji lolos")
