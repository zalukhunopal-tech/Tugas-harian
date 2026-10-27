"""
Uji formulir Dana Kegiatan: kudapan perjalanan (plafon sepertiga uang harian), penerima manfaat (numpang klaim) untuk kategori
lain, dan pilihan ukuran kotak tempel bukti, di PC (form lengkap) dan HP/tablet (pengisian bertahap).

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_penerima_manfaat.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import json
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None

KEGIATAN = '[{"id":"kg1","nama":"Survei Hulu Contoh","lokasi":"Kota Contoh","tanggalMulai":"2026-09-20","tanggalSelesai":"2026-10-23"}]'

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def buka_form(b, lebar, tinggi=1300):
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:200]))
    pg.add_init_script(
        "if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');"
        "localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');"
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


def transaksi_tersimpan(pg):
    return json.loads(pg.evaluate("localStorage.getItem('pengeluaran-harian') || '[]'"))


def tambah_nama(pg, selektor, *nama):
    for n in nama:
        pg.fill(selektor, n)
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(80)


def jumlah_tag(pg):
    return pg.locator(".penerima-manfaat__tag").count()


def tanpa_luapan(pg):
    return not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()

    print("== PC (1280px, form lengkap): kudapan perjalanan")
    ctx, pg, galat = buka_form(b, 1280)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    pg.select_option("#pilih-kegiatan-id", "kg1")
    pg.locator(".f-kategori button", has_text="Konsumsi").first.click()
    pg.wait_for_timeout(300)
    cek(pg.locator("#penerima-kudapan").count() == 0 and pg.locator("#penerima-manfaat").count() == 1, "sebelum memilih kudapan: hanya kolom Penerima Manfaat biasa (opsional)")
    pg.locator("[data-testid=pilih-kudapan]").click()
    pg.wait_for_timeout(200)
    cek(pg.locator("#penerima-kudapan").count() == 1 and pg.locator("[data-testid=kudapan-plafon]").count() == 1, "kudapan: input penerima dan kotak plafon tampil")
    cek(pg.get_by_text("Jumlah Peserta (Orang)").count() == 0, "kudapan: isian Jumlah Peserta diganti penerima manfaat")
    plafon = pg.locator("[data-testid=kudapan-plafon]").inner_text()
    cek("66.667" in plafon and "200.000" in plafon, f"plafon per orang Rp66.667 (⅓ uang harian Rp200.000) tampil ({plafon[:70]!r})")
    tambah_nama(pg, "#penerima-kudapan", "Nopal", "Budi")
    pg.fill("#penerima-kudapan", "Andi,")
    pg.wait_for_timeout(120)
    cek(jumlah_tag(pg) == 3, f"tiga nama menjadi tiga tag ({jumlah_tag(pg)})")
    cek(pg.input_value("#jumlah") == "200000", f"jumlah otomatis 3 × Rp66.667 = Rp200.000 ({pg.input_value('#jumlah')})")
    tambah_nama(pg, "#penerima-kudapan", "Siti")
    cek(pg.input_value("#jumlah") == "266667", f"4 orang → Rp266.667 ({pg.input_value('#jumlah')})")
    pg.fill("#jumlah", "180000")
    tambah_nama(pg, "#penerima-kudapan", "Joko")
    cek(pg.input_value("#jumlah") == "180000", "nominal yang disesuaikan dengan struk tidak ditimpa saat penerima bertambah")
    cek(pg.locator(".kudapan-info").count() == 1 and pg.locator(".kudapan-peringatan").count() == 0, "lebih kecil dari plafon: hanya keterangan, tanpa peringatan")
    pg.fill("#jumlah", "400000")
    cek(pg.locator(".kudapan-peringatan").count() == 1, "melebihi plafon: peringatan lunak, tidak memblokir")
    pg.get_by_role("button", name="Pakai plafon").click()
    cek(pg.input_value("#jumlah") == "333333", f"tombol 'Pakai plafon' mengisi plafon 5 orang ({pg.input_value('#jumlah')})")
    pg.get_by_role("button", name="Hapus Joko").click()
    pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Hapus Siti").click()
    pg.wait_for_timeout(200)
    cek(jumlah_tag(pg) == 3 and pg.input_value("#jumlah") == "200000", f"menghapus penerima mengembalikan jumlah ke plafon ({pg.input_value('#jumlah')})")
    cek(pg.locator("[data-testid=pilih-kotak-tempel]").count() == 1, "pilihan ukuran kotak tempel tersedia")
    cek("Tipe A" in pg.locator(".kotak-tempel-pilih__ket").inner_text() and "otomatis" in pg.locator(".kotak-tempel-pilih__ket").inner_text(), "kudapan (struk) otomatis memakai kotak Tipe A")
    pg.fill("#deskripsi", "Kudapan perjalanan keberangkatan")
    pg.fill("#tanggal", "2026-09-19")
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(500)
    t = [x for x in transaksi_tersimpan(pg) if x["deskripsi"] == "Kudapan perjalanan keberangkatan"]
    cek(len(t) == 1, "kudapan tersimpan (tanggal 19 Sep, sebelum kegiatan dimulai)")
    if t:
        d = t[0]["detailKegiatan"]
        cek(d["konsumsi"].get("kudapanPerjalanan") is True and d["penerimaManfaat"] == ["Nopal", "Budi", "Andi"], f"data tersimpan: kudapan + penerima ({d.get('penerimaManfaat')})")
        cek(t[0]["jumlah"] == 200000 and t[0]["kategori"] == "Konsumsi", "jumlah 200000, kategori Konsumsi")
    staf = json.loads(pg.evaluate("localStorage.getItem('keuangan-daftar-staf') || '[]'"))
    cek(staf[:3] == ["Nopal", "Budi", "Andi"], f"nama staf diingat sebagai saran ({staf})")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== PC (1280px): penerima manfaat untuk kategori lain, kotak tempel manual")
    ctx, pg, galat = buka_form(b, 1280)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    pg.select_option("#pilih-kegiatan-id", "kg1")
    pg.locator(".f-kategori button", has_text="Akomodasi").first.click()
    pg.wait_for_timeout(300)
    cek(pg.locator("#penerima-manfaat").count() == 1, "Akomodasi: kolom Penerima Manfaat tersedia")
    tambah_nama(pg, "#penerima-manfaat", "Nopal", "Budi")
    cek(jumlah_tag(pg) == 2, "dua penerima manfaat tercatat")
    cek("Tipe B" in pg.locator(".kotak-tempel-pilih__ket").inner_text(), "Akomodasi dengan kuitansi otomatis memakai kotak Tipe B")
    pg.locator(".kotak-tempel-pilih__opsi button", has_text="Tipe C").click()
    cek("Tipe C" in pg.locator(".kotak-tempel-pilih__ket").inner_text() and "otomatis" not in pg.locator(".kotak-tempel-pilih__ket").inner_text(), "ukuran kotak diubah manual ke Tipe C")
    pg.fill("#deskripsi", "Penginapan bersama")
    pg.fill("#jumlah", "450000")
    pg.fill("#tanggal", "2026-09-21")
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(500)
    t = [x for x in transaksi_tersimpan(pg) if x["deskripsi"] == "Penginapan bersama"]
    cek(len(t) == 1 and t[0]["detailKegiatan"].get("penerimaManfaat") == ["Nopal", "Budi"] and t[0]["detailKegiatan"].get("kotakTempel") == "C", f"tersimpan dengan penerima dan kotak C ({t[0]['detailKegiatan'] if t else None})")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()
    ctx, pg, galat = buka_form(b, 1280)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    pg.locator(".f-kategori button", has_text="Uang Harian").first.click()
    pg.wait_for_timeout(300)
    cek(pg.locator("#penerima-manfaat").count() == 0, "Uang Harian: tidak ada penerima manfaat (hak harian pelapor sendiri)")
    cek(pg.locator("[data-testid=pilih-kotak-tempel]").count() == 0, "Uang Harian: tidak ada kotak tempel (tanpa kuitansi)")
    cek(pg.locator(".f-kategori button", has_text="Perdiem").count() == 0, "kategori ditampilkan sebagai 'Uang Harian', bukan 'Perdiem'")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    for lebar in (390, 768):
        print(f"== {lebar}px (pengisian bertahap): kudapan dan penerima manfaat")
        ctx, pg, galat = buka_form(b, lebar, 1700)
        pg.select_option("#dana", "Dana Kegiatan")
        pg.wait_for_timeout(300)
        pg.locator(".bertahap-kegiatan__item").first.click()
        pg.wait_for_timeout(250)
        cek(pg.locator('.bertahap-ubin__item[data-kategori="Perdiem"] strong').inner_text() == "Uang Harian", "ubin jenis menampilkan 'Uang Harian'")
        pg.locator('.bertahap-ubin__item[data-kategori="Konsumsi"]').click()
        pg.wait_for_timeout(300)
        pg.locator("[data-testid=pilih-kudapan]").click()
        pg.wait_for_timeout(200)
        pg.locator("#btn-lanjut-langkah").click()
        pg.wait_for_timeout(200)
        cek("penerima manfaat" in pg.locator("#view-tambah, .bertahap").first.inner_text().lower(), "kudapan tanpa penerima: tidak bisa lanjut, ada pesan")
        tambah_nama(pg, "#penerima-kudapan", "Nopal", "Budi", "Andi")
        cek(pg.input_value("#jumlah") == "200000" if pg.locator("#jumlah").count() else True, "jumlah mengikuti plafon")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        kartu = pg.locator(".kartu-detail").first.bounding_box()
        for sel in (".penerima-manfaat__input input", ".penerima-manfaat__input button", ".kudapan-plafon"):
            kb = pg.locator(sel).first.bounding_box()
            cek(kb is not None and kb["x"] >= kartu["x"] - 1 and kb["x"] + kb["width"] <= kartu["x"] + kartu["width"] + 1, f"{sel} berada di dalam kartu")
        pg.locator("#btn-lanjut-langkah").click()
        pg.wait_for_timeout(300)
        cek(pg.locator("#deskripsi").input_value().startswith("Kudapan/Snack Perjalanan (3 orang)"), f"saran uraian otomatis ({pg.locator('#deskripsi').input_value()!r})")
        cek(not galat, f"tanpa galat JS ({galat})")
        ctx.close()

    b.close()

if gagal:
    print(f"\n{len(gagal)} uji gagal")
    sys.exit(1)
print("\nSemua uji lolos")
