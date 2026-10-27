"""
Uji panel Drive Keuangan yang disederhanakan: judul Sinkronisasi Data, lingkaran berlogo Google Drive yang ditahan 3 detik (lepas
sebelum penuh = batal), nama akun, serta pengaturan lain yang dilipat di "Opsi lanjutan". Memakai Drive/Sheets palsu (tiruan-konektor.js).

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_sinkron_tahan.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")

gagal = []
TULIS = ("update_values", "create_file", "batch_clear_values", "copy_file")


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def buka(b, lebar, tinggi=1100):
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and galat.append("CONSOLE " + m.text[:300]))
    pg.add_init_script(TIRUAN)
    pg.add_init_script("localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');")
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(600)
    pg.locator(".navbar:visible button, .sidebar:visible button", has_text="Saya").first.click()
    pg.wait_for_timeout(300)
    pg.locator("[data-app=drive]").click()
    pg.wait_for_timeout(500)
    return ctx, pg, galat


def hubungkan(pg):
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.get_by_text("Konektor Google Drive aktif").first.wait_for(timeout=10000)
    pg.wait_for_function("window.__drive.calls.filter(c => c.tool === 'get_values').length >= 2", timeout=30000)
    pg.wait_for_timeout(1200)


def panggilan(pg):
    return pg.evaluate("window.__drive.calls.map(c => c.tool)")


def tombol(pg):
    return pg.locator("[data-testid=tombol-sinkron]")


def petunjuk(pg):
    return pg.locator("[data-testid=petunjuk-sinkron]").inner_text().strip()


def tahan(pg, ms):
    kotak = tombol(pg).bounding_box()
    pg.mouse.move(kotak["x"] + kotak["width"] / 2, kotak["y"] + kotak["height"] / 2)
    pg.mouse.down()
    pg.wait_for_timeout(ms)


def tanpa_luapan(pg):
    return not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()

    print("== Belum masuk: lingkaran redup, hanya ajakan masuk")
    ctx, pg, galat = buka(b, 420)
    cek(pg.locator(".sinkron-judul").inner_text() == "Sinkronisasi Data", "judul 'Sinkronisasi Data'")
    cek(tombol(pg).is_disabled() and "Masuk dengan Google dulu" in petunjuk(pg), "lingkaran tidak bisa ditekan dan memberi petunjuk masuk dulu")
    cek(pg.locator("[data-testid=opsi-lanjutan]").count() == 0, "belum masuk: tidak ada Opsi lanjutan")
    cek(pg.get_by_role("button", name="Sambungkan konektor Google Drive").count() == 1, "tombol masuk tersedia")
    texts = pg.locator("[data-testid=panel-sinkron]").inner_text()
    cek("Tarik Data" not in texts and "Unduh CSV" not in texts, "tidak ada menu berulang di tampilan awal")
    ctx.close()

    print("== Tersambung: lingkaran, nama akun, opsi lanjutan terlipat")
    ctx, pg, galat = buka(b, 420)
    hubungkan(pg)
    cek(not tombol(pg).is_disabled() and petunjuk(pg) == "Tekan & tahan 3 detik", f"siap ditekan: '{petunjuk(pg)}'")
    akun = pg.locator("[data-testid=akun-aktif]").inner_text()
    cek("Konektor Google Drive" in akun and "Aktif" in akun, f"nama akun dan lencana Aktif tampil ({akun!r})")
    cek(pg.locator("#btn-keluar-drive").is_visible(), "tombol Keluar tetap terlihat di kartu akun")
    cek(pg.locator("#opsi-lanjutan-drive").evaluate("e => !e.open"), "Opsi lanjutan terlipat")
    cek(pg.get_by_role("button", name="Tarik Data dari Folder Keuangan").is_hidden() and pg.get_by_role("button", name="Unduh CSV (", exact=False).is_hidden(), "tombol Tarik, Kirim, dan CSV tersembunyi sampai dibuka")
    pg.locator("#opsi-lanjutan-drive > summary").click()
    pg.wait_for_timeout(200)
    for nama in ("Tarik Data dari Folder Keuangan", "Kirim Data Lokal ke Folder Keuangan", "Tambah / Masuk Akun Google Lain"):
        cek(pg.get_by_role("button", name=nama).is_visible(), f"fungsi tetap ada di Opsi lanjutan: {nama}")
    cek(pg.get_by_role("button", name="Unduh CSV", exact=False).is_visible(), "fungsi tetap ada di Opsi lanjutan: Unduh CSV")
    cek(pg.get_by_text("Keuangan Pribadi").first.is_visible(), "isi folder (berkas) ada di Opsi lanjutan")
    pg.locator("#opsi-lanjutan-drive > summary").click()

    print("== Lepas sebelum penuh: dibatalkan, tidak ada yang tersinkron")
    n0 = len(panggilan(pg))
    tahan(pg, 1300)
    cek(tombol(pg).get_attribute("data-status") == "menahan" and "Terus tahan" in petunjuk(pg), f"saat ditahan: status 'menahan' ({petunjuk(pg)})")
    kemajuan = pg.evaluate("(() => { const c = document.querySelector('.sinkron-isi'); const j = parseFloat(getComputedStyle(c).strokeDashoffset); const k = parseFloat(c.getAttribute('stroke-dasharray')); return j / k; })()")
    cek(0.2 < kemajuan < 0.8, f"cincin terisi sebagian setelah 1,3 detik (sisa {kemajuan:.2f})")
    pg.mouse.up()
    pg.wait_for_timeout(600)
    cek(tombol(pg).get_attribute("data-status") == "diam" and petunjuk(pg) == "Tekan & tahan 3 detik", "dilepas: kembali siap")
    pg.wait_for_timeout(2500)
    cek(len(panggilan(pg)) == n0, f"tidak ada panggilan Drive setelah batal ({len(panggilan(pg)) - n0})")

    print("== Tahan 3 detik: data otomatis tersinkron (tarik lalu kirim), tanpa dialog konfirmasi")
    n0 = len(panggilan(pg))
    tahan(pg, 1000)
    pg.mouse.up()
    pg.wait_for_timeout(300)
    tahan(pg, 3500)
    cek(tombol(pg).get_attribute("data-status") in ("proses", "berhasil"), f"setelah 3 detik: sinkronisasi berjalan ({tombol(pg).get_attribute('data-status')})")
    pg.mouse.up()
    pg.wait_for_selector("[data-testid=tombol-sinkron][data-status=berhasil]", timeout=30000)
    baru = panggilan(pg)[n0:]
    pertama_tarik = next((i for i, t in enumerate(baru) if t == "get_values"), -1)
    pertama_tulis = next((i for i, t in enumerate(baru) if t in TULIS), -1)
    cek(pertama_tarik >= 0 and pertama_tulis > pertama_tarik, f"urutan: tarik dulu ({pertama_tarik}), lalu kirim ({pertama_tulis})")
    cek(pg.locator(".dlg-artefak").count() == 0, "tidak ada dialog konfirmasi (menahan sudah menjadi konfirmasi)")
    cek("Tersinkron pukul" in petunjuk(pg), f"keberhasilan ditampilkan: '{petunjuk(pg)}'")
    cek(pg.locator(".sinkron-centang").count() == 1, "logo berganti centang hijau")
    cek("Berhasil disimpan ke Google Drive" in pg.locator("#sync-detail").inner_text(), "pesan rinci tampil di bawahnya")
    pg.wait_for_selector("[data-testid=tombol-sinkron][data-status=diam]", timeout=12000)
    cek(not tombol(pg).is_disabled(), "setelah beberapa detik kembali siap ditahan lagi")

    print("== Keyboard: tahan Spasi 3 detik")
    n0 = len(panggilan(pg))
    tombol(pg).focus()
    pg.keyboard.down(" ")
    pg.wait_for_timeout(500)
    cek(tombol(pg).get_attribute("data-status") == "menahan", "Spasi ditahan: status 'menahan'")
    pg.keyboard.up(" ")
    pg.wait_for_timeout(400)
    cek(tombol(pg).get_attribute("data-status") == "diam" and len(panggilan(pg)) == n0, "Spasi dilepas dini: batal")
    pg.keyboard.down(" ")
    pg.wait_for_timeout(3500)
    pg.keyboard.up(" ")
    pg.wait_for_selector("[data-testid=tombol-sinkron][data-status=berhasil]", timeout=30000)
    cek(any(t in TULIS for t in panggilan(pg)[n0:]), "Spasi ditahan 3 detik menyinkronkan data")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    for lebar in (390, 768, 1280):
        print(f"== Tata letak ({lebar}px)")
        ctx, pg, galat = buka(b, lebar)
        hubungkan(pg)
        info = pg.evaluate("""() => { const t = document.querySelector('[data-testid=tombol-sinkron]').getBoundingClientRect(); const p = document.querySelector('[data-testid=panel-sinkron]').getBoundingClientRect();
            const a = document.querySelector('[data-testid=akun-aktif]').getBoundingClientRect(); const k = document.querySelector('#btn-keluar-drive').getBoundingClientRect();
            const h = document.querySelector('.sinkron-judul').getBoundingClientRect(); const o = document.querySelector('#opsi-lanjutan-drive').getBoundingClientRect();
            return { tengahTombol: Math.round((t.left + t.width / 2) - (p.left + p.width / 2)), tengahJudul: Math.round((h.left + h.width / 2) - (p.left + p.width / 2)), lebarTombol: Math.round(t.width), tinggiTombol: Math.round(t.height),
                     akunDalam: a.left >= p.left - 1 && a.right <= p.right + 1 && k.right <= a.right + 1, urut: h.bottom < t.top && t.bottom < a.top && a.bottom < o.top, ukuranOK: t.width >= 150 && t.width === t.height }; }""")
        cek(abs(info["tengahTombol"]) <= 2 and abs(info["tengahJudul"]) <= 2, f"judul dan lingkaran tepat di tengah ({info['tengahJudul']}, {info['tengahTombol']} px)")
        cek(info["ukuranOK"], f"lingkaran bulat dan cukup besar untuk ditekan ({info['lebarTombol']}×{info['tinggiTombol']})")
        cek(info["urut"], "urutan atas ke bawah: judul, lingkaran, akun, Opsi lanjutan")
        cek(info["akunDalam"], "kartu akun dan tombol Keluar di dalam panel")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        pg.locator("#opsi-lanjutan-drive > summary").click()
        pg.wait_for_timeout(200)
        cek(tanpa_luapan(pg), "Opsi lanjutan terbuka: tanpa luapan horizontal")
        lebar_tombol = pg.evaluate("[...document.querySelectorAll('.sinkron-tombol-lanjut button')].map(e => Math.round(e.getBoundingClientRect().width))")
        cek(len(set(lebar_tombol)) == 1 or lebar >= 640, f"tombol Opsi lanjutan rapi ({lebar_tombol})")
        cek(not galat, f"tanpa galat JS ({galat})")
        ctx.close()

    b.close()

print()
if gagal:
    print(f"{len(gagal)} pemeriksaan gagal:")
    for g in gagal:
        print("  -", g)
    sys.exit(1)
print("Semua pemeriksaan lolos")
