"""
Uji fitur penyusutan dan umur barang: toggle opsional di formulir pembelian, preset (oli mesin, laptop), hitungan garis lurus dan
saldo menurun ganda, peringatan otomatis pada 30% ke bawah (lencana, banner dashboard, bilah merah), pembaruan pemakaian di tab
Aset, mengganti barang, mengubah/menghapus transaksi, dan tata letak di HP/tablet/PC.

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_penyusutan.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import datetime
import json
import re
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def buka(b, lebar, tinggi=1300):
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:300]))
    pg.add_init_script("if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');}")
    # Dialog konfirmasi bawaan peramban (bila ada) diterima.
    pg.on("dialog", lambda d: d.accept())
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(600)
    return ctx, pg, galat


def buka_form(pg):
    pg.locator(".nav-tambah:visible").first.click()
    pg.wait_for_timeout(400)
    if pg.get_by_text("Isi Formulir Manual").count():
        pg.get_by_text("Isi Formulir Manual").click()
        pg.wait_for_timeout(400)


def pengaturan(pg):
    return json.loads(pg.evaluate("localStorage.getItem('keuangan-pengaturan') || '{}'"))


def item_umur(pg):
    return pengaturan(pg).get("penyusutan", [])


def nav(pg, nama):
    pg.locator(".navbar:visible button, .sidebar:visible button", has_text=nama).first.click()
    pg.wait_for_timeout(500)


def tanpa_luapan(pg):
    return not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")


def isi_dasar(pg, uraian, jumlah, kategori=None, tanggal=None):
    pg.fill("#deskripsi", uraian)
    pg.fill("#jumlah", str(jumlah))
    if kategori:
        pg.locator(".f-kategori button", has_text=kategori).first.click()
    if tanggal:
        pg.fill("#tanggal", tanggal)


def simpan(pg):
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(600)


def aksi_baris(pg, teks, judul):
    """Tombol aksi pada baris transaksi (muncul saat baris disorot)."""
    baris = pg.locator("#view-riwayat li", has_text=teks).first
    baris.hover()
    baris.locator(f"button[title='{judul}']").click()


def terima_dialog(pg):
    """Dialog konfirmasi build artefak (bukan dialog bawaan peramban): tekan tombol utamanya."""
    pg.wait_for_timeout(300)
    if pg.locator(".dlg-artefak__aksi button.utama").count():
        pg.locator(".dlg-artefak__aksi button.utama").click()
        pg.wait_for_timeout(400)


hari_ini = datetime.date.today()
dua_tahun_lalu = (hari_ini - datetime.timedelta(days=730)).isoformat()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()

    print("== Opsional: tanpa mengaktifkan toggle tidak ada hitungan dan tidak ada data")
    ctx, pg, galat = buka(b, 1280)
    buka_form(pg)
    cek(pg.locator("[data-testid=penyusutan-form]").count() == 1, "kartu 'Hitung Penyusutan & Umur Barang' tersedia di formulir pengeluaran")
    cek(pg.locator(".penyusutan-isi").count() == 0, "toggle mati: isian penyusutan tersembunyi")
    isi_dasar(pg, "Beli kabel data", 25000, "Belanja Harian")
    simpan(pg)
    cek(item_umur(pg) == [], "disimpan tanpa penyusutan: tidak ada pantauan")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Oli mesin motor: preset, basis pemakaian (km), garis lurus, peringatan tepat 30%")
    ctx, pg, galat = buka(b, 1280)
    buka_form(pg)
    isi_dasar(pg, "Ganti oli mesin motor", 65000, "Transportasi")
    pg.locator("#penyusutan-aktif").check()
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-testid=penyusutan-belum-lengkap]").count() == 1, "sebelum umur diisi: ada petunjuk untuk memilih preset")
    cek(pg.locator("[data-preset=oli-mesin-motor]").count() == 1 and pg.locator("[data-preset=oli-gardan]").count() == 1 and pg.locator("[data-preset=aki]").count() == 1, "preset oli mesin, oli gardan, aki, dst. tersedia")
    pg.locator("[data-preset=oli-mesin-motor]").click()
    pg.wait_for_timeout(200)
    cek(pg.input_value("#penyusutan-umur") == "2000" and pg.input_value("#penyusutan-nama") == "Oli Mesin Motor", "preset mengisi umur 2000 km dan nama barang")
    cek(pg.locator("[data-basis=pemakaian]").get_attribute("aria-pressed") == "true", "basis pemakaian (km) terpilih oleh preset")
    cek(pg.locator("[data-jenis=habis-pakai]").get_attribute("aria-pressed") == "true" and pg.locator("[data-metode]").count() == 0, "barang habis pakai: garis lurus, tanpa pilihan metode")
    pg.fill("#penyusutan-awal", "45000")
    pg.fill("#penyusutan-kini", "45800")
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-testid=pratinjau-umur]").get_attribute("data-tingkat") == "aman" and pg.locator("[data-testid=peringatan-umur]").count() == 0, "sisa 1.200 km (60%): aman, tanpa peringatan")
    cek("1.200 km" in pg.locator("[data-testid=sisa-umur]").inner_text() and "60%" in pg.locator("[data-testid=sisa-umur]").inner_text(), "sisa km = 2000 - (45800 - 45000) = 1.200 km (60%)")
    warna = pg.evaluate("getComputedStyle(document.querySelector('.umur-bilah > span')).backgroundColor")
    cek(warna == "rgb(34, 197, 94)", f"bilah hijau saat aman ({warna})")
    pg.fill("#penyusutan-kini", "46400")
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-testid=pratinjau-umur]").get_attribute("data-tingkat") == "mendekati" and pg.locator("[data-testid=peringatan-umur]").count() == 1, "sisa 600 km = tepat 30%: peringatan otomatis muncul")
    cek("600 km" in pg.locator("[data-testid=sisa-umur]").inner_text(), "sisa umur 600 km")
    cek("19.500" in pg.locator(".umur-metrik").inner_text(), "nilai buku = 30% × Rp65.000 = Rp19.500")
    warna = pg.evaluate("getComputedStyle(document.querySelector('.umur-bilah > span')).backgroundColor")
    cek(warna == "rgb(239, 68, 68)", f"bilah berubah merah pada 30% ({warna})")
    cek(not tanpa_luapan(pg) is False, "tanpa luapan horizontal")
    simpan(pg)
    data = item_umur(pg)
    cek(len(data) == 1, f"pantauan tersimpan di pengaturan ({len(data)})")
    trx = json.loads(pg.evaluate("localStorage.getItem('pengeluaran-harian') || '[]'"))
    oli = [t for t in trx if t["deskripsi"] == "Ganti oli mesin motor"]
    if data and oli:
        d = data[0]
        cek(d["nama"] == "Oli Mesin Motor" and d["harga"] == 65000 and d["umurTotal"] == 2000 and d["basis"] == "pemakaian" and d["satuanPemakaian"] == "km", "data: nama, harga 65000, umur 2000 km, basis pemakaian")
        cek(d["pemakaianAwal"] == 45000 and d["pemakaianSekarang"] == 46400 and d["metode"] == "garis-lurus" and d["nilaiResidu"] == 0, "data: KM 45000 → 46400, garis lurus, residu 0")
        cek(d["transaksiId"] == oli[0]["id"], "pantauan terhubung ke transaksi pembeliannya")
    print("   -- dashboard Riwayat")
    nav(pg, "Riwayat")
    banner = pg.locator("[data-testid=banner-umur]")
    cek(banner.count() == 1 and "Oli Mesin Motor" in banner.inner_text() and "30%" in banner.inner_text(), f"banner peringatan di dashboard menyebut barang dan 30% ({banner.inner_text()[:90]!r})" if banner.count() else "banner peringatan di dashboard")
    cek(pg.evaluate("getComputedStyle(document.querySelector('[data-testid=banner-umur] .umur-bilah > span')).backgroundColor") == "rgb(239, 68, 68)", "bilah di banner berwarna merah")
    cek(pg.locator("[data-testid=lencana-umur]").count() >= 2, "lencana menyala di banner dan pada transaksi pembelian di daftar")
    cek(pg.locator("section.hari [data-testid=lencana-umur]").count() == 1, "lencana pada baris transaksi oli")
    print("   -- tab Aset: panel, pembaruan KM, penggantian")
    banner.get_by_role("button", name="Lihat semua").click()
    pg.wait_for_timeout(500)
    cek(pg.locator("[data-testid=panel-umur] [data-testid=kartu-umur]").count() == 1, "tab Aset memuat kartu umur barang")
    kartu = pg.locator("[data-testid=kartu-umur]").first
    pg.locator(".umur-kartu__pemakaian input").fill("46800")
    pg.locator(".umur-kartu__pemakaian").get_by_role("button", name="Perbarui").click()
    pg.wait_for_timeout(300)
    cek("10%" in pg.locator("[data-testid=kartu-umur]").first.inner_text() and "Segera ganti" in pg.locator("[data-testid=kartu-umur]").first.inner_text(), "KM 46.800: sisa 10% → lencana 'Segera ganti' (merah)")
    cek(item_umur(pg)[0]["pemakaianSekarang"] == 46800, "pembaruan KM tersimpan")
    pg.reload()
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(600)
    nav(pg, "Riwayat")
    cek(pg.locator("[data-testid=banner-umur]").count() == 1, "banner tetap ada setelah aplikasi dimuat ulang")
    pg.locator("[data-testid=banner-umur]").get_by_role("button", name="Lihat semua").click()
    pg.wait_for_timeout(400)
    pg.locator("[data-testid=kartu-umur] [data-aksi=ganti]").click()
    pg.wait_for_timeout(400)
    cek(pg.locator("[data-testid=banner-umur]").count() == 0, "diganti/diservis: banner hilang")
    baru = item_umur(pg)[0]
    cek(baru["pemakaianAwal"] == 46800 and baru["pemakaianSekarang"] == 46800 and baru["tanggalMulai"] == hari_ini.isoformat(), f"siklus baru dari KM 46.800 hari ini ({baru['pemakaianAwal']}, {baru['tanggalMulai']})")
    cek("100%" in pg.locator("[data-testid=kartu-umur]").first.inner_text(), "kartu kembali 100%")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Laptop: saldo menurun ganda vs garis lurus (P_sisa ATAU P_umur ≤ 30%)")
    ctx, pg, galat = buka(b, 1280)
    buka_form(pg)
    isi_dasar(pg, "Beli laptop kantor", 12000000, "Belanja Harian")
    pg.locator("#penyusutan-aktif").check()
    pg.locator("[data-preset=laptop]").click()
    pg.fill("#penyusutan-tanggal", dua_tahun_lalu)  # tanggal beli barang; transaksinya sendiri dicatat hari ini
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-jenis=aset]").get_attribute("aria-pressed") == "true" and pg.locator("[data-metode=saldo-menurun-ganda]").get_attribute("aria-pressed") == "true", "preset laptop: aset, saldo menurun ganda, 4 tahun")
    cek(pg.input_value("#penyusutan-umur") == "4", "umur 4 tahun")
    pg.wait_for_timeout(200)
    persen_nilai = pg.locator("[data-testid=persen-sisa-nilai]").inner_text()
    sisa_umur = pg.locator("[data-testid=sisa-umur]").inner_text()
    cek(persen_nilai in ("25%", "26%", "24%"), f"DDB 2 tahun: nilai buku ≈ 25% ({persen_nilai})")
    cek("50%" in sisa_umur or "51%" in sisa_umur or "49%" in sisa_umur, f"umur tersisa masih ≈ 50% ({sisa_umur})")
    cek(pg.locator("[data-testid=peringatan-umur]").count() == 1, "nilai buku ≤ 30% memicu peringatan walau umur masih ±50%")
    cek("Penyusutan per tahun" in pg.locator(".umur-metrik").inner_text() and "6.000.000" in pg.locator(".umur-metrik").inner_text(), "beban penyusutan tahun pertama DDB = 2/4 × Rp12.000.000 = Rp6.000.000")
    pg.locator("[data-metode=garis-lurus]").click()
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-testid=peringatan-umur]").count() == 0 and "3.000.000" in pg.locator(".umur-metrik").inner_text(), "garis lurus: susut Rp3.000.000/tahun, sisa ≈ 50%, tanpa peringatan")
    pg.fill("#penyusutan-residu", "999999999")
    simpan(pg)
    cek("tidak boleh" in pg.locator("#galat-form").inner_text() and item_umur(pg) == [], "nilai residu melebihi harga: simpan ditolak dengan pesan")
    pg.fill("#penyusutan-residu", "0")
    pg.locator("[data-metode=saldo-menurun-ganda]").click()
    simpan(pg)
    cek(len(item_umur(pg)) == 1 and item_umur(pg)[0]["metode"] == "saldo-menurun-ganda" and item_umur(pg)[0]["satuanWaktu"] == "tahun", "laptop tersimpan (DDB, 4 tahun)")
    nav(pg, "Riwayat")
    cek(pg.locator("[data-testid=banner-umur]").count() == 1 and "Laptop" in pg.locator("[data-testid=banner-umur]").inner_text(), "banner menyebut laptop")

    print("== Ubah transaksi: isian penyusutan terbawa; mematikan toggle melepas pantauan")
    aksi_baris(pg, "Beli laptop kantor", "Ubah transaksi")
    pg.wait_for_timeout(500)
    cek(pg.locator("#penyusutan-aktif").is_checked() and pg.input_value("#penyusutan-nama") == "Laptop / Komputer", "form ubah: toggle aktif dan nama barang terisi dari pantauan")
    pg.fill("#jumlah", "13000000")
    simpan(pg)
    cek(item_umur(pg)[0]["harga"] == 13000000 and len(item_umur(pg)) == 1, "harga pantauan mengikuti jumlah transaksi yang diubah (tidak menggandakan)")
    aksi_baris(pg, "Beli laptop kantor", "Ubah transaksi")
    pg.wait_for_timeout(500)
    pg.locator("#penyusutan-aktif").uncheck()
    simpan(pg)
    cek(item_umur(pg) == [], "toggle dimatikan: pantauan dilepas")
    cek(pg.locator("[data-testid=banner-umur]").count() == 0, "banner hilang")

    print("== Hapus transaksi: pantauannya ikut terhapus")
    buka_form(pg)
    isi_dasar(pg, "Beli aki motor", 350000, "Transportasi")
    pg.locator("#penyusutan-aktif").check()
    pg.locator("[data-preset=aki]").click()
    pg.fill("#penyusutan-tanggal", (hari_ini - datetime.timedelta(days=600)).isoformat())
    simpan(pg)
    cek(len(item_umur(pg)) == 1, "aki (24 bulan, dibeli 600 hari lalu) tersimpan")
    nav(pg, "Riwayat")
    cek(pg.locator("[data-testid=banner-umur]").count() == 1, "aki 600/730 hari: sisa ±18% → peringatan")
    aksi_baris(pg, "Beli aki motor", "Hapus transaksi")
    terima_dialog(pg)
    pg.wait_for_timeout(300)
    cek(pg.locator("#view-riwayat li", has_text="Beli aki motor").count() == 0 and item_umur(pg) == [], "transaksi dihapus: pantauan ikut hilang")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Pengaturan diganti oleh tarikan Drive lama tidak menghapus pantauan lokal")
    # Pengaturan.json lama tidak memuat 'penyusutan': lihat penjaga di App.handleTarikDariDrive (diuji lewat tipe dan peninjauan kode).

    print("== Validasi: toggle aktif tanpa umur")
    ctx, pg, galat = buka(b, 1280)
    buka_form(pg)
    isi_dasar(pg, "Beli sesuatu", 50000, "Belanja Harian")
    pg.locator("#penyusutan-aktif").check()
    simpan(pg)
    cek("umur pakai" in pg.locator("#galat-form").inner_text() and "Beli sesuatu" not in pg.evaluate("localStorage.getItem('pengeluaran-harian') || ''"), "umur kosong: simpan ditahan dengan pesan, transaksi belum tersimpan")
    ctx.close()

    for lebar in (390, 768, 1280):
        print(f"== Tata letak di {lebar}px")
        ctx, pg, galat = buka(b, lebar)
        buka_form(pg)
        isi_dasar(pg, "Ganti oli gardan", 45000, "Transportasi")
        pg.locator("#penyusutan-aktif").check()
        pg.locator("[data-preset=oli-gardan]").click()
        pg.fill("#penyusutan-awal", "30000")
        pg.fill("#penyusutan-kini", "37000")
        pg.wait_for_timeout(300)
        kartu = pg.locator("[data-testid=penyusutan-form]").bounding_box()
        dalam = pg.evaluate("""() => { const k = document.querySelector('[data-testid=penyusutan-form]').getBoundingClientRect();
            return [...document.querySelectorAll('[data-testid=penyusutan-form] input, [data-testid=penyusutan-form] select, [data-testid=penyusutan-form] button, [data-testid=penyusutan-form] .umur-metrik > div')]
                .filter(e => e.getBoundingClientRect().width > 0).every(e => { const r = e.getBoundingClientRect(); return r.left >= k.left - 1 && r.right <= k.right + 1; }); }""")
        cek(dalam, "semua isian, chip, dan angka berada di dalam kartu")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        cek(pg.locator("[data-testid=peringatan-umur]").count() == 1, "oli gardan 7.000/8.000 km: sisa 12,5% → peringatan tampil")
        if lebar < 640:
            kolom = pg.evaluate("new Set([...document.querySelectorAll('.penyusutan-kisi > .penyusutan-kolom')].map(e => Math.round(e.getBoundingClientRect().left))).size")
            cek(kolom <= 2, f"HP: kisi isian maksimal dua kolom ({kolom})")
        simpan(pg)
        nav(pg, "Riwayat")
        bn = pg.locator("[data-testid=banner-umur]").bounding_box()
        vw = pg.evaluate("document.documentElement.clientWidth")
        cek(bn is not None and bn["x"] >= 0 and bn["x"] + bn["width"] <= vw + 1, "banner dashboard muat di layar")
        cek(tanpa_luapan(pg), "Riwayat tanpa luapan horizontal")
        pg.locator("[data-testid=banner-umur]").get_by_role("button", name="Lihat semua").click()
        pg.wait_for_timeout(500)
        kb = pg.locator("[data-testid=kartu-umur]").first.bounding_box()
        cek(kb is not None and kb["x"] >= 0 and kb["x"] + kb["width"] <= vw + 1, "kartu umur barang di tab Aset muat di layar")
        cek(tanpa_luapan(pg), "Aset tanpa luapan horizontal")
        cek(not galat, f"tanpa galat JS ({galat})")
        ctx.close()

    print("== Dana Kegiatan, pengisian bertahap di HP (390px): penyusutan ada di 'Lainnya (opsional)'")
    ctx = b.new_context(viewport={"width": 390, "height": 1700}, service_workers="block", is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:300]))
    kegiatan = '[{"id":"kg1","nama":"Survei Hulu Contoh","lokasi":"Kota Contoh","tanggalMulai":"2026-09-20","tanggalSelesai":"2026-12-23"}]'
    pg.add_init_script("if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');"
                       f"localStorage.setItem('keuangan-daftar-kegiatan', {kegiatan!r});}}")
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(600)
    buka_form(pg)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    pg.locator(".bertahap-kegiatan__item").first.click()
    pg.wait_for_timeout(250)
    pg.locator('.bertahap-ubin__item[data-kategori="Pengadaan Barang & Perlengkapan"]').click()
    pg.wait_for_timeout(300)
    pg.locator("#btn-lanjut-langkah").click()
    pg.wait_for_timeout(300)
    pg.fill("#deskripsi", "Baterai cadangan GPS")
    pg.fill("#jumlah", "180000")
    pg.locator("#btn-lanjut-langkah").click()
    pg.wait_for_timeout(300)
    pg.locator(".bertahap-lainnya summary").click()
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-testid=penyusutan-form]").count() == 1, "kartu penyusutan tersedia di 'Lainnya (opsional)'")
    pg.locator("#penyusutan-aktif").check()
    pg.locator("[data-preset=baterai]").click()
    pg.fill("#penyusutan-tanggal", (hari_ini - datetime.timedelta(days=600)).isoformat())
    pg.wait_for_timeout(300)
    cek(pg.locator("[data-testid=peringatan-umur]").count() == 1, "baterai 24 bulan, dibeli 600 hari lalu: peringatan tampil")
    cek(tanpa_luapan(pg), "tanpa luapan horizontal")
    pg.locator("#btn-lanjut-langkah").click()  # bukti → periksa
    pg.wait_for_timeout(300)
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(400)
    if pg.locator("#view-tambah").count():
        pg.locator("#btn-simpan").click()
        pg.wait_for_timeout(500)
    cek(len(item_umur(pg)) == 1 and item_umur(pg)[0]["nama"] == "Baterai", f"tersimpan lewat pengisian bertahap ({[i['nama'] for i in item_umur(pg)]})")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    b.close()

if gagal:
    print(f"\n{len(gagal)} uji gagal")
    sys.exit(1)
print("\nSemua uji lolos")
