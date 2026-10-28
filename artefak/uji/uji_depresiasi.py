"""
Uji fitur Depresiasi Aset (tab Saya): tawaran otomatis setelah pembelian barang tahan lama dicatat (hanya yang disetujui masuk daftar),
isian prapengisian dari basis data umur (oli, aki, ban, laptop, dst.), hitungan dan peringatan sisa ≤ 30% (lencana, banner di Riwayat,
titik di menu Saya, bilah merah), pembaruan km, mengganti/mengubah/menghapus barang, tambah manual dan pedoman, serta tata letak di
HP/tablet/PC.

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_depresiasi.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
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


def buka(b, lebar, tinggi=1300, penyusutan=None):
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:300]))
    seed = ""
    if penyusutan is not None:
        pengaturan_awal = json.dumps({"anggaranHarian": 0, "anggaranKategori": {"Dana Pribadi": {}, "Dana Kegiatan": {}}, "penyusutan": penyusutan})
        seed = f"localStorage.setItem('keuangan-pengaturan', {pengaturan_awal!r});"
    pg.add_init_script("if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');" + seed + "}")
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
iso = lambda d: d.isoformat()


def contoh_pantauan():
    """Dua barang yang sudah di bawah 30% (oli 25% menurut km, aki ±17% menurut waktu) dan satu laptop yang masih baru."""
    kini = datetime.datetime.utcnow().isoformat() + "Z"
    return [
        {"id": "p1", "nama": "Oli Mesin Motor", "jenisBarang": "habis-pakai", "presetId": "oli-mesin-motor", "basis": "pemakaian", "metode": "garis-lurus",
         "harga": 65000, "nilaiResidu": 0, "umurTotal": 2000, "satuanPemakaian": "km", "batasWaktuBulan": 2, "tanggalMulai": iso(hari_ini - datetime.timedelta(days=10)),
         "pemakaianAwal": 45000, "pemakaianSekarang": 46500, "dibuat": kini},
        {"id": "p2", "nama": "Aki Motor", "jenisBarang": "habis-pakai", "presetId": "aki-motor", "basis": "waktu", "metode": "garis-lurus",
         "harga": 350000, "nilaiResidu": 0, "umurTotal": 24, "satuanWaktu": "bulan", "tanggalMulai": iso(hari_ini - datetime.timedelta(days=609)), "dibuat": kini},
        {"id": "p3", "nama": "Laptop Kantor", "jenisBarang": "aset", "presetId": "laptop", "basis": "waktu", "metode": "saldo-menurun-ganda",
         "harga": 9000000, "nilaiResidu": 0, "umurTotal": 4, "satuanWaktu": "tahun", "tanggalMulai": iso(hari_ini - datetime.timedelta(days=30)), "dibuat": kini},
    ]


def dialog(pg):
    return pg.locator("[data-testid=dialog-depresiasi]")


def buka_depresiasi(pg):
    nav(pg, "Saya")
    pg.locator("[data-app=depresiasi]").click()
    pg.wait_for_timeout(400)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()

    print("== Tawaran otomatis di PC: barang sekali pakai tidak ditawari, barang tahan lama ditawari")
    ctx, pg, galat = buka(b, 1280)
    cek(pg.locator("[data-testid=penyusutan-form]").count() == 0, "formulir transaksi tidak lagi memuat isian penyusutan")
    buka_form(pg)
    cek(pg.locator("[data-testid=penyusutan-form], #penyusutan-aktif").count() == 0, "formulir pengeluaran bersih dari sakelar penyusutan")
    isi_dasar(pg, "Beli kabel data", 25000, "Belanja Harian")
    simpan(pg)
    cek(dialog(pg).count() == 0, "kabel data Rp25.000: tidak ada tawaran")
    buka_form(pg)
    isi_dasar(pg, "Makan siang", 30000, "Makan & Minum")
    simpan(pg)
    cek(dialog(pg).count() == 0, "makan siang: tidak ada tawaran")

    buka_form(pg)
    isi_dasar(pg, "Ganti oli mesin", 65000, "Transportasi")
    simpan(pg)
    cek(dialog(pg).count() == 1 and pg.locator("[data-testid=tawaran-depresiasi]").count() == 1, "ganti oli mesin: dialog 'Hitung depresiasi barang ini?' muncul otomatis")
    teks = pg.locator("[data-testid=tawaran-depresiasi]").inner_text()
    cek("Ganti oli mesin" in teks and "65.000" in teks and "2.000 km" in teks, f"tawaran menyebut barang, harga, dan umur standar ({teks[:120]!r})")
    pg.locator("[data-aksi=tolak]").click()
    pg.wait_for_timeout(300)
    cek(dialog(pg).count() == 0 and item_umur(pg) == [], "'Tidak perlu': dialog tertutup, barang tidak masuk daftar")

    buka_form(pg)
    isi_dasar(pg, "Beli laptop", 8000000, "Belanja Harian")
    simpan(pg)
    cek(dialog(pg).count() == 1, "beli laptop Rp8 juta: tawaran muncul")
    pg.locator("[data-aksi=setuju]").click()
    pg.wait_for_timeout(300)
    cek(pg.locator("[data-testid=penyusutan-form]").count() == 1 and pg.locator("[data-testid=saran-preset]").count() == 1, "setelah 'Ya': isian depresiasi tampil dengan saran preset dari uraian")
    cek(pg.input_value("#penyusutan-nama") == "Beli laptop" and pg.input_value("#penyusutan-umur") == "4", "terisi otomatis: nama dari uraian, umur 4 tahun")
    cek(pg.locator("[data-metode=saldo-menurun-ganda]").get_attribute("aria-pressed") == "true" and pg.locator("[data-jenis=aset]").get_attribute("aria-pressed") == "true", "laptop: aset dengan saldo menurun ganda")
    cek("Kelompok 1" in pg.locator("[data-testid=catatan-preset]").inner_text() and "PMK" in pg.locator("[data-testid=catatan-preset]").inner_text(), "catatan preset menyebut Kelompok 1 PMK 72/2023 dan sumbernya")
    cek(pg.locator("[data-testid=pratinjau-umur]").count() == 1 and "8.000.000" in pg.locator(".umur-metrik").inner_text(), "pratinjau hitungan langsung tampil")
    cek(pg.locator("#penyusutan-harga").get_attribute("readonly") is not None and pg.input_value("#penyusutan-harga") == "8000000", "harga di dialog tawaran hanya-baca dan mengikuti transaksi")
    cek(tanpa_luapan(pg), "tanpa luapan horizontal saat dialog terbuka")
    pg.locator("[data-aksi=simpan]").click()
    pg.wait_for_timeout(400)
    data = item_umur(pg)
    trx = json.loads(pg.evaluate("localStorage.getItem('pengeluaran-harian') || '[]'"))
    laptop = [t for t in trx if t["deskripsi"] == "Beli laptop"]
    cek(dialog(pg).count() == 0 and len(data) == 1, f"laptop masuk daftar ({len(data)})")
    if data and laptop:
        d = data[0]
        cek(d["harga"] == 8000000 and d["umurTotal"] == 4 and d["metode"] == "saldo-menurun-ganda" and d["jenisBarang"] == "aset" and d["transaksiId"] == laptop[0]["id"], "data: harga, 4 tahun, DDB, terhubung ke transaksinya")

    print("   -- tab Saya > Depresiasi Aset")
    nav(pg, "Saya")
    ubin = pg.locator("[data-app=depresiasi]")
    cek(ubin.count() == 1 and ubin.locator(".saya-app-nama").inner_text() == "Depresiasi" and "1 barang dipantau" in ubin.inner_text(), f"ubin 'Depresiasi' ada di tab Saya ({ubin.inner_text()!r})")
    ubin.click()
    pg.wait_for_timeout(400)
    cek(pg.locator("[data-testid=layar-depresiasi]").count() == 1 and pg.locator(".saya-appbar-judul").inner_text() == "Depresiasi", "layar Depresiasi terbuka dengan judul yang benar")
    cek(pg.locator("[data-testid=dep-jumlah]").inner_text() == "1" and pg.locator("[data-testid=dep-perhatian]").inner_text() == "0", "ringkasan: 1 barang, 0 perlu perhatian")
    cek("Beli laptop" in pg.locator("[data-testid=kartu-umur]").first.inner_text(), "kartu barang tampil")
    cek(pg.locator("[data-testid=pedoman-depresiasi]").count() == 1, "pedoman depresiasi ada di bagian bawah")
    cek(tanpa_luapan(pg), "tanpa luapan horizontal")
    print("   -- ubah harga transaksi: harga pantauan ikut")
    nav(pg, "Riwayat")
    aksi_baris(pg, "Beli laptop", "Ubah transaksi")
    pg.wait_for_timeout(500)
    pg.fill("#jumlah", "8500000")
    simpan(pg)
    cek(dialog(pg).count() == 0, "mengubah transaksi tidak memunculkan tawaran lagi")
    cek(len(item_umur(pg)) == 1 and item_umur(pg)[0]["harga"] == 8500000, "harga pantauan mengikuti jumlah transaksi yang diubah (tanpa menggandakan)")
    print("   -- hapus transaksi: pantauan ikut terhapus")
    aksi_baris(pg, "Beli laptop", "Hapus transaksi")
    terima_dialog(pg)
    pg.wait_for_timeout(300)
    cek(pg.locator("#view-riwayat li", has_text="Beli laptop").count() == 0 and item_umur(pg) == [], "transaksi dihapus: barang ikut hilang dari Depresiasi Aset")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Peringatan ≤ 30%: banner, lencana, titik di menu Saya, saringan, dan aksi kartu (PC)")
    ctx, pg, galat = buka(b, 1280, penyusutan=contoh_pantauan())
    banner = pg.locator("[data-testid=banner-umur]")
    cek(banner.count() == 1 and "Oli Mesin Motor" in banner.inner_text() and "Aki Motor" in banner.inner_text() and "Laptop" not in banner.inner_text(), "banner di Riwayat menyebut oli dan aki, bukan laptop")
    cek("Buka Depresiasi" in banner.inner_text(), "banner punya tombol 'Buka Depresiasi'")
    lencana = pg.locator("[data-testid=lencana-saya]:visible")
    cek(lencana.count() == 1 and lencana.inner_text().strip() == "2", f"lencana merah '2' di menu Saya ({lencana.count()})")
    nav(pg, "Saya")
    ubin = pg.locator("[data-app=depresiasi]")
    cek("2 perlu perhatian" in ubin.inner_text() and ubin.locator(".saya-app-angka").inner_text() == "2" and ubin.locator(".saya-app-titik.perhatian").count() == 1, f"ubin menunjukkan 2 perlu perhatian ({ubin.inner_text()!r})")
    nav(pg, "Riwayat")
    pg.locator("[data-testid=banner-umur]").get_by_role("button", name="Buka Depresiasi").click()
    pg.wait_for_timeout(500)
    cek(pg.locator("[data-testid=layar-depresiasi]").count() == 1, "tombol banner membuka tab Saya > Depresiasi")
    nav(pg, "Riwayat")
    nav(pg, "Saya")
    cek(pg.locator("[data-testid=layar-depresiasi]").count() == 0 and pg.locator("[data-app=depresiasi]").count() == 1, "kembali ke tab Saya: daftar aplikasi (tidak terbuka sendiri)")
    pg.locator("[data-app=depresiasi]").click()
    pg.wait_for_timeout(400)
    cek(pg.locator("[data-testid=dep-jumlah]").inner_text() == "3" and pg.locator("[data-testid=dep-perhatian]").inner_text() == "2", "ringkasan: 3 barang, 2 perlu perhatian")
    cek(pg.locator("[data-testid=layar-depresiasi] [data-testid=banner-umur]").count() == 1, "banner peringatan juga tampil di layar Depresiasi Aset")
    kartu_nama = pg.evaluate("[...document.querySelectorAll('[data-testid=kartu-umur] .umur-kartu__nama')].map(e => e.textContent)")
    cek(kartu_nama[0] in ("Aki Motor", "Oli Mesin Motor") and kartu_nama[-1] == "Laptop Kantor", f"urutan: paling mendesak di atas, laptop terakhir ({kartu_nama})")
    cek(pg.evaluate("getComputedStyle(document.querySelector('[data-testid=kartu-umur] .umur-bilah > span')).backgroundColor") == "rgb(239, 68, 68)", "bilah merah pada barang ≤ 30%")
    pg.locator("[data-saringan=perhatian]").click()
    cek(pg.locator("[data-testid=kartu-umur]").count() == 2, "saringan 'Perlu perhatian': 2 kartu")
    pg.locator("[data-saringan=aset]").click()
    cek(pg.locator("[data-testid=kartu-umur]").count() == 1 and "Laptop" in pg.locator("[data-testid=kartu-umur]").inner_text(), "saringan 'Aset': hanya laptop")
    pg.locator("[data-saringan=habis-pakai]").click()
    cek(pg.locator("[data-testid=kartu-umur]").count() == 2, "saringan 'Habis pakai': oli dan aki")
    pg.locator("[data-saringan=semua]").click()

    oli = pg.locator("[data-testid=kartu-umur][data-id=p1]")
    teks_oli = oli.inner_text()
    cek("2.000 km atau 2 bulan" in teks_oli and "500 km" in teks_oli, f"kartu oli: umur '2.000 km atau 2 bulan', sisa 500 km ({teks_oli[:140]!r})")
    oli.locator(".umur-kartu__pemakaian input").fill("46900")
    oli.locator(".umur-kartu__pemakaian").get_by_role("button", name="Perbarui").click()
    pg.wait_for_timeout(300)
    cek(item_umur(pg)[0]["pemakaianSekarang"] == 46900 and "Segera ganti" in pg.locator("[data-testid=kartu-umur][data-id=p1]").inner_text(), "km 46.900: sisa 5% → 'Segera ganti' dan tersimpan")
    pg.locator("[data-testid=kartu-umur][data-id=p1] [data-aksi=ganti]").click()
    pg.wait_for_timeout(300)
    baru = [x for x in item_umur(pg) if x["id"] == "p1"][0]
    cek(baru["pemakaianAwal"] == 46900 and baru["tanggalMulai"] == iso(hari_ini), "diganti: siklus baru dari km 46.900 hari ini")
    cek(pg.locator("[data-testid=dep-perhatian]").inner_text() == "1" and pg.locator("[data-testid=lencana-saya]:visible").inner_text().strip() == "1", "peringatan tinggal 1 (aki); lencana menyusut jadi 1")

    print("   -- Ubah data")
    pg.locator("[data-testid=kartu-umur][data-id=p2] [data-aksi=ubah]").click()
    pg.wait_for_timeout(300)
    cek(dialog(pg).count() == 1 and pg.input_value("#penyusutan-nama") == "Aki Motor" and pg.input_value("#penyusutan-umur") == "24", "dialog ubah terisi dari data barang")
    cek(pg.input_value("#penyusutan-harga") == "350000", "harga bisa diubah pada barang manual")
    pg.fill("#penyusutan-umur", "36")
    pg.wait_for_timeout(200)
    cek(pg.locator("[data-testid=peringatan-umur]").count() == 0, "umur diubah jadi 36 bulan: pratinjau tidak lagi memperingatkan")
    pg.locator("[data-aksi=simpan]").click()
    pg.wait_for_timeout(300)
    cek([x for x in item_umur(pg) if x["id"] == "p2"][0]["umurTotal"] == 36 and pg.locator("[data-testid=dep-perhatian]").inner_text() == "0", "perubahan tersimpan; tidak ada lagi yang perlu perhatian")
    cek(pg.locator("[data-testid=banner-umur]").count() == 0 and pg.locator("[data-testid=lencana-saya]:visible").count() == 0, "banner dan lencana hilang")

    print("   -- Hapus pantauan")
    pg.locator("[data-testid=kartu-umur][data-id=p3] [data-aksi=hapus]").click()
    pg.locator("[data-testid=kartu-umur][data-id=p3] [data-aksi=hapus-pasti]").click()
    pg.wait_for_timeout(300)
    cek(len(item_umur(pg)) == 2 and pg.locator("[data-testid=kartu-umur][data-id=p3]").count() == 0, "laptop dihapus dari pantauan (transaksi tidak disentuh)")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Tambah manual dan pedoman (PC)")
    ctx, pg, galat = buka(b, 1280)
    # satu pengeluaran lama yang belum dipantau, untuk 'ambil dari pengeluaran yang sudah dicatat'
    buka_form(pg)
    isi_dasar(pg, "Tripod kamera", 450000, "Belanja Harian")
    simpan(pg)
    cek(dialog(pg).count() == 1, "tripod: ditawari")
    pg.locator("[data-aksi=tolak]").click()
    pg.wait_for_timeout(200)
    buka_depresiasi(pg)
    cek(pg.locator("[data-testid=dep-kosong]").count() == 1 and "otomatis menawarkan" in pg.locator("[data-testid=dep-kosong]").inner_text(), "daftar kosong: penjelasan tawaran otomatis")
    pg.locator("[data-aksi=tambah-aset]").click()
    pg.wait_for_timeout(300)
    cek(dialog(pg).count() == 1 and pg.locator("#dep-ambil-transaksi").count() == 1 and pg.locator("#penyusutan-harga").count() == 1, "dialog manual: pilih pengeluaran lama dan kolom harga")
    opsi = pg.locator("#dep-ambil-transaksi option").all_inner_texts()
    cek(any("Tripod kamera" in o for o in opsi), f"pengeluaran lama muncul di pilihan ({len(opsi)} opsi)")
    cek(pg.locator("[data-preset=ban-motor]").count() == 1 and pg.locator("[data-preset=laptop]").count() == 1 and pg.locator("[data-preset=aki-mobil]").count() == 1, "daftar umur standar (motor, mobil, elektronik, aset) tersedia di dialog")
    pg.locator("[data-preset=ban-motor]").click()
    pg.wait_for_timeout(200)
    cek(pg.input_value("#penyusutan-umur") == "40000" and pg.input_value("#penyusutan-batas-waktu") == "48", "preset ban motor: 40.000 km atau 48 bulan")
    cek("Sumber" in pg.locator("[data-testid=catatan-preset]").inner_text(), "catatan menyebut sumber")
    pg.locator("[data-aksi=simpan]").click()
    pg.wait_for_timeout(200)
    cek("harga" in pg.locator("[data-testid=galat-depresiasi]").inner_text().lower() and item_umur(pg) == [], "harga belum diisi: ditolak dengan pesan")
    pg.fill("#penyusutan-harga", "450000")
    pg.fill("#penyusutan-awal", "12000")
    pg.fill("#penyusutan-kini", "30000")
    pg.wait_for_timeout(200)
    cek("22.000 km" in pg.locator("[data-testid=sisa-umur]").inner_text(), "ban dipakai 18.000 dari 40.000 km: sisa 22.000 km")
    pg.locator("[data-aksi=simpan]").click()
    pg.wait_for_timeout(400)
    cek(len(item_umur(pg)) == 1 and item_umur(pg)[0]["batasWaktuBulan"] == 48 and item_umur(pg)[0]["presetId"] == "ban-motor", "barang manual tersimpan dengan batas waktu 48 bulan")
    # pilih dari pengeluaran lama
    pg.locator("[data-aksi=tambah-aset]").click()
    pg.wait_for_timeout(300)
    pg.select_option("#dep-ambil-transaksi", index=1)
    pg.wait_for_timeout(200)
    cek(pg.locator("#penyusutan-harga").get_attribute("readonly") is not None and pg.input_value("#penyusutan-harga") == "450000" and pg.input_value("#penyusutan-nama") == "Tripod kamera", "memilih pengeluaran lama: nama terisi, harga mengikuti transaksi (hanya-baca)")
    pg.locator("[data-preset=peralatan-kerja]").click()
    pg.locator("[data-aksi=simpan]").click()
    pg.wait_for_timeout(300)
    tripod = [x for x in item_umur(pg) if x["nama"] == "Tripod kamera"]
    cek(len(tripod) == 1 and tripod[0]["harga"] == 450000 and tripod[0].get("transaksiId"), "tersimpan dan terhubung ke transaksi lama")
    print("   -- pedoman")
    pedoman = pg.locator("[data-testid=pedoman-depresiasi]")
    pedoman.locator("[data-testid=pedoman-rumus] summary").click()
    teks = pedoman.locator("[data-testid=pedoman-rumus]").inner_text()
    cek("(C − S) / n" in teks and "2 / n" in teks and "n(n + 1) / 2" in teks and "total km" in teks, "rumus garis lurus, saldo menurun ganda, jumlah angka tahun, dan unit produksi tampil")
    pedoman.locator("[data-testid=pedoman-pajak] summary").click()
    cek("4 tahun" in pedoman.locator("[data-testid=pedoman-pajak]").inner_text() and "50%" in pedoman.locator("[data-testid=pedoman-pajak]").inner_text() and "20 tahun" in pedoman.locator("[data-testid=pedoman-pajak]").inner_text(), "tabel kelompok PMK 72/2023 tampil")
    pedoman.locator("[data-testid=pedoman-katalog] summary").click()
    cek(pedoman.locator("[data-preset-baris]").count() >= 25, f"daftar umur standar memuat banyak barang ({pedoman.locator('[data-preset-baris]').count()})")
    cek("perkiraan umum" in pedoman.locator("[data-testid=pedoman-katalog]").inner_text(), "yang belum bersumber tegas ditandai 'perkiraan umum'")
    pedoman.locator("[data-pantau=oli-mesin-mobil]").click()
    pg.wait_for_timeout(300)
    cek(dialog(pg).count() == 1 and pg.input_value("#penyusutan-umur") == "10000" and pg.input_value("#penyusutan-batas-waktu") == "6", "'Pantau' dari daftar umur standar: dialog terisi oli mobil 10.000 km atau 6 bulan")
    pg.locator("[data-aksi=batal]").click()
    pg.wait_for_timeout(200)
    pedoman.locator("[data-testid=pedoman-sumber] summary").click()
    cek(pedoman.locator("[data-testid=pedoman-sumber] a[target=_blank]").count() >= 10, "sumber riset berupa tautan yang terbuka di tab baru")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Dana Kegiatan, pengisian bertahap di HP (390px): tawaran muncul setelah simpan")
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
    cek(pg.locator("#penyusutan-aktif").count() == 0 and "penyusutan" not in pg.locator(".bertahap-lainnya summary").inner_text().lower(), "langkah bukti: 'Lainnya (opsional)' tidak lagi memuat penyusutan")
    pg.locator("#btn-lanjut-langkah").click()  # bukti → periksa
    pg.wait_for_timeout(300)
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(400)
    if pg.locator("#view-tambah").count():
        pg.locator("#btn-simpan").click()  # 'Tetap simpan' bila ada prasyarat belum lengkap
        pg.wait_for_timeout(500)
    cek(dialog(pg).count() == 1, "setelah disimpan, tawaran 'Hitung depresiasi?' muncul di HP")
    kotak = pg.locator(".dep-dialog").bounding_box()
    vw = pg.evaluate("document.documentElement.clientWidth")
    vh = pg.evaluate("window.innerHeight")
    cek(kotak is not None and kotak["x"] >= 0 and kotak["x"] + kotak["width"] <= vw + 1 and kotak["y"] >= 0 and kotak["y"] + kotak["height"] <= vh + 1, f"dialog muat di layar HP ({kotak})")
    cek(pg.locator("[data-aksi=setuju]").is_visible() and pg.locator("[data-aksi=tolak]").is_visible(), "kedua tombol terlihat tanpa menggulir")
    pg.locator("[data-aksi=setuju]").click()
    pg.wait_for_timeout(300)
    cek(pg.input_value("#penyusutan-umur") == "24" and pg.locator("[data-metode]").count() == 0, "baterai: 24 bulan, barang habis pakai tanpa pilihan metode")
    cek(tanpa_luapan(pg), "tanpa luapan horizontal")
    pg.locator("[data-aksi=simpan]").click()
    pg.wait_for_timeout(400)
    cek(len(item_umur(pg)) == 1 and item_umur(pg)[0]["nama"] == "Baterai cadangan GPS", "baterai tersimpan ke Depresiasi Aset")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    for lebar in (390, 768, 1280):
        print(f"== Tata letak Depresiasi Aset di {lebar}px")
        ctx, pg, galat = buka(b, lebar, penyusutan=contoh_pantauan())
        vw = pg.evaluate("document.documentElement.clientWidth")
        lc = pg.locator("[data-testid=lencana-saya]:visible")
        cek(lc.count() == 1 and lc.bounding_box()["x"] >= 0 and lc.bounding_box()["x"] + lc.bounding_box()["width"] <= vw + 1, "lencana menu Saya tidak terpotong")
        buka_depresiasi(pg)
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        kolom = pg.evaluate("new Set([...document.querySelectorAll('.dep-stat')].map(e => Math.round(e.getBoundingClientRect().left))).size")
        cek(kolom == (2 if lebar < 640 else 4), f"ringkasan {2 if lebar < 640 else 4} kolom ({kolom})")
        kolom_kartu = pg.evaluate("new Set([...document.querySelectorAll('[data-testid=kartu-umur]')].map(e => Math.round(e.getBoundingClientRect().left))).size")
        cek(kolom_kartu == (2 if lebar >= 1024 else 1), f"kartu barang {2 if lebar >= 1024 else 1} kolom ({kolom_kartu})")
        tinggi_sama = pg.evaluate("(() => { const k=[...document.querySelectorAll('.dep-stat')].map(e=>Math.round(e.getBoundingClientRect().height)); return Math.max(...k)-Math.min(...k) <= 1; })()")
        cek(tinggi_sama, "kartu ringkasan sama tinggi")
        luar = pg.evaluate("[...document.querySelectorAll('[data-testid=kartu-umur]')].some(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > document.documentElement.clientWidth + 1; })")
        cek(not luar, "semua kartu berada di dalam layar")
        pg.screenshot(path=f"/tmp/depresiasi-{lebar}.png", full_page=False)
        pg.locator("[data-aksi=tambah-aset]").click()
        pg.wait_for_timeout(300)
        pg.locator("[data-preset=laptop]").click()
        pg.wait_for_timeout(200)
        d = pg.locator(".dep-dialog").bounding_box()
        vh = pg.evaluate("window.innerHeight")
        cek(d is not None and d["x"] >= 0 and d["x"] + d["width"] <= vw + 1 and d["y"] >= -1 and d["y"] + d["height"] <= vh + 1, f"dialog muat di layar ({d})")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal saat dialog terbuka")
        dalam = pg.evaluate("""() => { const k = document.querySelector('.dep-dialog__isi').getBoundingClientRect();
            return [...document.querySelectorAll('.dep-dialog__isi input, .dep-dialog__isi select, .dep-dialog__isi button')]
                .filter(e => e.getBoundingClientRect().width > 0).every(e => { const r = e.getBoundingClientRect(); return r.left >= k.left - 1 && r.right <= k.right + 1; }); }""")
        cek(dalam, "semua isian dan tombol di dalam dialog")
        cek(pg.locator("[data-aksi=simpan]").is_visible(), "tombol simpan selalu terlihat (footer tetap)")
        pg.screenshot(path=f"/tmp/depresiasi-dialog-{lebar}.png")
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
