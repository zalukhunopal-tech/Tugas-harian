"""
Uji delapan poin evaluasi tampilan: titik dekoratif di judul, Ringkasan Tahunan rata tengah (HP dan PC/tablet), Foto Pendukung dan
Lampiran Bukti rapi di HP, Penerimaan Dana sebagai Judul Kegiatan (tanpa Kelengkapan SPJ), ubin Kategori, transaksi berulang hanya
di tab Saya dengan pengingat pintar, Scan Struk rapi di HP, Depresiasi Aset (saringan, tombol, kartu) dan kotak centang
"Masukkan ke Depresiasi Aset" di formulir pengeluaran.

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_evaluasi_ui.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import datetime
import json
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None

gagal = []
hari_ini = datetime.date.today()
bulan_ini = hari_ini.strftime("%Y-%m")
iso = lambda d: d.isoformat()


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def trx(id_, jenis, dana, kategori, deskripsi, jumlah, tanggal):
    return {"id": id_, "jenis": jenis, "dana": dana, "tanggal": tanggal, "deskripsi": deskripsi, "kategori": kategori, "jumlah": jumlah,
            "metode": "Tunai", "kaitan": "", "catatan": ""}


def buka(b, lebar, tinggi=1300, simpanan=None):
    """simpanan: {kunci localStorage: nilai Python} yang ditulis sekali sebelum aplikasi dimuat."""
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:300]))
    pg.on("dialog", lambda d: d.accept())
    isi = "".join(f"localStorage.setItem({k!r}, {json.dumps(json.dumps(v))});" for k, v in (simpanan or {}).items())
    pg.add_init_script("if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');" + isi + "}")
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(600)
    return ctx, pg, galat


def nav(pg, nama):
    pg.locator(".navbar:visible button, .sidebar:visible button", has_text=nama).first.click()
    pg.wait_for_timeout(500)


def buka_form(pg):
    pg.locator(".nav-tambah:visible").first.click()
    pg.wait_for_timeout(400)
    if pg.get_by_text("Isi Formulir Manual").count():
        pg.get_by_text("Isi Formulir Manual").click()
        pg.wait_for_timeout(400)


def tanpa_luapan(pg):
    return not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")


def pusat_x(pg, selektor, induk):
    """Selisih (px) antara titik tengah elemen dan titik tengah induknya."""
    return pg.evaluate(
        """([s, i]) => { const e = document.querySelector(s); const p = document.querySelector(i); if (!e || !p) return null;
            const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); return Math.round((a.left + a.width / 2) - (b.left + b.width / 2)); }""",
        [selektor, induk],
    )


def pengaturan(pg):
    return json.loads(pg.evaluate("localStorage.getItem('keuangan-pengaturan') || '{}'"))


def daftar_trx(pg):
    return json.loads(pg.evaluate("localStorage.getItem('pengeluaran-harian') || '[]'"))


def kegiatan(pg):
    return json.loads(pg.evaluate("localStorage.getItem('keuangan-daftar-kegiatan') || '[]'"))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()

    # ---------------------------------------------------------------- poin 8
    print("== Poin 8: titik dekoratif di judul dihapus (teks tetap)")
    ctx, pg, galat = buka(b, 1280)
    nav(pg, "Grafik")
    pg.get_by_role("tab", name="Ringkasan Tahunan").click()
    pg.wait_for_timeout(500)
    konten = pg.evaluate("""() => [...document.querySelectorAll('.card h2, .card h3')].map(e => getComputedStyle(e, '::before').content)""")
    cek(len(konten) > 0 and all(k in ("none", "normal", '""', "") for k in konten), f"tidak ada penanda ::before di judul kartu ({set(konten)})")
    cek("Ringkasan Keuangan Tahun" in pg.inner_text("#view-grafik"), "teks judul 'Ringkasan Keuangan Tahun' tetap ada")
    ctx.close()

    # ---------------------------------------------------------------- poin 2
    awal = {"pengeluaran-harian": [
        trx("a1", "pemasukan", "Dana Kegiatan", "Penerimaan Dana", "Penerimaan Dana Kegiatan Contoh", 25000000, f"{hari_ini.year}-03-10"),
        trx("a2", "pengeluaran", "Dana Kegiatan", "Konsumsi", "Makan siang tim", 650000, f"{hari_ini.year}-03-12"),
        trx("a3", "pengeluaran", "Dana Pribadi", "Transportasi", "Ojek", 2750000, f"{hari_ini.year}-04-01"),
        trx("a4", "pengeluaran", "Dana Pribadi", "Belanja Harian", "Belanja", 150000, f"{hari_ini.year - 1}-04-01"),
    ]}
    for lebar in (390, 768, 1280):
        print(f"== Poin 2: Ringkasan Tahunan rata tengah dan rapi ({lebar}px)")
        ctx, pg, galat = buka(b, lebar, simpanan=awal)
        nav(pg, "Grafik")
        pg.get_by_role("tab", name="Ringkasan Tahunan").click()
        pg.wait_for_timeout(600)
        for sel, nama in ((".rt-judul__nama", "judul"), (".rt-judul__sub", "keterangan"), (".rt-pemilih", "pemilih tahun"), (".dana-filter-dua-pilihan", "pilihan Kategori Dana")):
            s = pusat_x(pg, sel, ".ringkasan-tahun-header")
            cek(s is not None and abs(s) <= 2, f"kartu judul: {nama} di tengah (selisih {s} px)")
        metrik = pg.evaluate("""() => [...document.querySelectorAll('.rt-metrik')].map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), rata: getComputedStyle(e).textAlign, luap: [...e.querySelectorAll('.rt-metrik__nilai')].some(n => n.scrollWidth > n.clientWidth + 1) }; })""")
        cek(len(metrik) == 3 and all(m["rata"] == "center" for m in metrik), "tiga kartu angka berisi teks rata tengah")
        cek(not any(m["luap"] for m in metrik), "nominal muat di kartu")
        if lebar < 640:
            cek(metrik[0]["y"] == metrik[1]["y"] and metrik[2]["y"] > metrik[0]["y"] and metrik[2]["w"] >= metrik[0]["w"] * 1.8 and metrik[2]["x"] == metrik[0]["x"], f"HP: Pemasukan dan Pengeluaran sebaris, Selisih selebar baris ({[(m['x'], m['y'], m['w']) for m in metrik]})")
        else:
            cek(len({m["y"] for m in metrik}) == 1 and len({m["h"] for m in metrik}) == 1, f"tiga kartu sejajar dan sama tinggi ({[(m['y'], m['h']) for m in metrik]})")
        s_bagian = pg.evaluate("""() => [...document.querySelectorAll('.rt-bagian')].map(k => { const j = k.querySelector('.rt-bagian__judul').getBoundingClientRect(); const c = k.getBoundingClientRect(); return Math.round((j.left + j.width / 2) - (c.left + c.width / 2)); })""")
        cek(len(s_bagian) == 3 and all(abs(x) <= 2 for x in s_bagian), f"judul tiga bagian di tengah kartunya ({s_bagian})")
        seg = pg.evaluate("(() => { const r = document.querySelector('.rt-segmen').getBoundingClientRect(); const k = document.querySelectorAll('.rt-bagian')[1].getBoundingClientRect(); return Math.round((r.left + r.width / 2) - (k.left + k.width / 2)); })()")
        cek(abs(seg) <= 2, f"pilihan Pengeluaran/Pemasukan di tengah ({seg})")
        baris = pg.evaluate("""() => [...document.querySelectorAll('.ringkasan-tahunan-container .kategori-item')].map(e => { const j = e.querySelector('.kategori-jumlah').getBoundingClientRect(); const c = e.getBoundingClientRect(); return j.right <= c.right + 1; })""")
        cek(len(baris) > 0 and all(baris), "jumlah per kategori rata kanan dan tidak keluar baris")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        cek(not galat, f"tanpa galat JS ({galat})")
        ctx.close()

    # ---------------------------------------------------------------- poin 5
    for lebar in (390, 1280):
        print(f"== Poin 5: ubin Kategori ({lebar}px)")
        ctx, pg, galat = buka(b, lebar)
        buka_form(pg)
        n = pg.locator(".kategori-ubin").count()
        cek(n == 9, f"sembilan kategori Dana Pribadi tampil sebagai ubin ({n})")
        ukur = pg.evaluate("""() => { const u = [...document.querySelectorAll('.kategori-ubin')].map(e => e.getBoundingClientRect()); const k = document.querySelector('.kategori-pilih').getBoundingClientRect();
            return { kolom: new Set(u.map(r => Math.round(r.left))).size, tinggi: new Set(u.map(r => Math.round(r.height))).size, lebar: new Set(u.map(r => Math.round(r.width))).size,
                     dalam: u.every(r => r.left >= k.left - 1 && r.right <= k.right + 1), luap: [...document.querySelectorAll('.kategori-ubin__nama')].some(e => e.scrollWidth > e.clientWidth + 1) }; }""")
        cek(ukur["kolom"] == (2 if lebar < 640 else 3), f"{2 if lebar < 640 else 3} kolom ({ukur['kolom']})")
        cek(ukur["lebar"] == 1 and ukur["dalam"] and not ukur["luap"], f"semua ubin sama lebar, di dalam kotak, teks tidak terpotong ({ukur})")
        pg.locator(".kategori-ubin", has_text="Transportasi").click()
        cek(pg.locator(".kategori-ubin[aria-pressed=true]").inner_text().strip() == "Transportasi", "mengetuk ubin memilih kategori")
        cek(pg.input_value("#kategori") == "Transportasi", "daftar pilih bawaan ikut sinkron")
        pg.select_option("#kategori", "Hiburan")
        cek(pg.locator(".kategori-ubin[aria-pressed=true]").inner_text().strip() == "Hiburan", "daftar pilih bawaan (tersembunyi secara visual) tetap berfungsi")
        lebar_pilih = pg.evaluate("document.querySelector('.f-kategori > select').getBoundingClientRect().width")
        cek(lebar_pilih <= 2, f"daftar pilih bawaan tidak tampil dobel ({lebar_pilih} px)")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        ctx.close()

    # ---------------------------------------------------------------- poin 6
    for lebar in (390, 1280):
        print(f"== Poin 6: tanpa pengaturan transaksi berulang di formulir; Scan Struk rapi ({lebar}px)")
        ctx, pg, galat = buka(b, lebar)
        buka_form(pg)
        teks = pg.inner_text("body")
        cek("Transaksi Berulang (Jadwal Rutin)" not in teks and "Kelola Jadwal" not in teks and "Isi cepat formulir dari jadwal rutin" not in teks, "kartu transaksi berulang tidak ada lagi di halaman transaksi")
        info = pg.evaluate("""() => { const a = document.querySelector('.struk-scanner-actions'); const t = [...a.querySelectorAll('button')].map(e => e.getBoundingClientRect()); const k = document.querySelector('.card-struk-scanner').getBoundingClientRect();
            return { tampil: getComputedStyle(a).display, kolom: new Set(t.map(r => Math.round(r.left))).size, lebar: new Set(t.map(r => Math.round(r.width))).size, tinggi: new Set(t.map(r => Math.round(r.height))).size,
                     dalam: t.every(r => r.left >= k.left - 1 && r.right <= k.right + 1) }; }""")
        if lebar < 640:
            cek(info["tampil"] == "grid" and info["kolom"] == 2 and info["lebar"] == 1 and info["tinggi"] == 1, f"HP: dua tombol Scan Struk sama ukuran sebaris ({info})")
        else:
            cek(info["tampil"] == "flex", f"PC/tablet: tata letak tombol Scan Struk seperti semula ({info['tampil']})")
        cek(info["dalam"] and tanpa_luapan(pg), "tombol di dalam kartu, tanpa luapan horizontal")
        ctx.close()

    print("== Poin 6: pengingat transaksi rutin hanya bila belum tercatat; konfirmasi mengisi sesuai jadwal")
    rutin = [
        {"id": "r1", "nama": "Sewa kos", "jenis": "pengeluaran", "dana": "Dana Pribadi", "jumlah": 1000000, "kategori": "Tagihan & Sewa", "metode": "Tunai", "kaitan": "", "catatan": "",
         "frekuensi": "bulanan", "tanggalMulai": f"{hari_ini.year - 1}-01-01", "hariDalamBulan": 1, "aktif": True},
        {"id": "r2", "nama": "Internet WiFi", "jenis": "pengeluaran", "dana": "Dana Pribadi", "jumlah": 300000, "kategori": "Pulsa & Internet", "metode": "Tunai", "kaitan": "", "catatan": "",
         "frekuensi": "bulanan", "tanggalMulai": f"{hari_ini.year - 1}-01-01", "hariDalamBulan": 1, "aktif": True},
    ]
    sudah_ada = [trx("t1", "pengeluaran", "Dana Pribadi", "Pulsa & Internet", "internet wifi", 310000, iso(hari_ini))]
    ctx, pg, galat = buka(b, 1280, simpanan={"keuangan-transaksi-berulang": rutin, "pengeluaran-harian": sudah_ada})
    nav(pg, "Riwayat")
    banner = pg.locator("[data-testid=banner-rutin]")
    cek(banner.count() == 1 and "1 transaksi rutin" in banner.inner_text() and "Sewa kos" in banner.inner_text() and "WiFi" not in banner.inner_text(), f"hanya jadwal yang belum tercatat diingatkan (WiFi sudah ada) ({banner.inner_text()[:90]!r})" if banner.count() else "banner pengingat tampil")
    cek("Kelola" not in banner.inner_text(), "banner tidak lagi menjadi pintu pengelolaan jadwal")
    banner.get_by_role("button", name="Catat sekarang").click()
    pg.wait_for_timeout(600)
    baru = [t for t in daftar_trx(pg) if t["deskripsi"] == "Sewa kos"]
    cek(len(baru) == 1 and baru[0]["jumlah"] == 1000000 and baru[0]["kategori"] == "Tagihan & Sewa" and baru[0]["tanggal"] == f"{bulan_ini}-01", f"transaksi dicatat sesuai jadwal (tanggal 1, Rp1.000.000) ({baru})")
    cek(pg.locator("[data-testid=banner-rutin]").count() == 0, "banner hilang setelah dicatat")
    cek(len([t for t in daftar_trx(pg) if "wifi" in t["deskripsi"].lower()]) == 1, "WiFi tidak digandakan")
    pg.reload()
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for()
    pg.wait_for_timeout(500)
    cek(pg.locator("[data-testid=banner-rutin]").count() == 0 and len([t for t in daftar_trx(pg) if t["deskripsi"] == "Sewa kos"]) == 1, "setelah dimuat ulang: tidak ada pengingat dan tidak ada transaksi ganda")
    nav(pg, "Saya")
    pg.locator("[data-app=rutin]").click()
    pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Buka & Kelola Transaksi Berulang").click()
    pg.wait_for_timeout(400)
    cek("Sewa kos" in pg.inner_text("body") and pg.get_by_text("Sudah jatuh tempo untuk dicatat").count() == 0, "pengelolaan jadwal dipusatkan di tab Saya; jadwal yang sudah tercatat tidak ditandai jatuh tempo")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    # ---------------------------------------------------------------- poin 4
    for lebar in (390, 1280):
        print(f"== Poin 4: Penerimaan Dana = Judul Kegiatan ({lebar}px)")
        ctx, pg, galat = buka(b, lebar)
        buka_form(pg)
        pg.locator(".f-jenis label", has_text="Pemasukan").click()
        pg.select_option("#dana", "Dana Kegiatan")
        pg.wait_for_timeout(400)
        teks = pg.inner_text("body")
        cek("Kelengkapan SPJ" not in teks and "Baca Ketentuan SPJ" not in teks, "bagian 'Kelengkapan SPJ' tidak tampil")
        cek(pg.locator("#judul-kegiatan").count() == 1 and pg.locator("#deskripsi").count() == 0 and pg.locator(".f-kategori").count() == 0, "form berisi Judul Kegiatan; tanpa Uraian dan Kategori")
        cek(pg.locator("#pilih-kegiatan-id").count() == 0 and pg.locator(".foto-pendukung").count() == 0, "tanpa pilihan kegiatan lama, jenis bukti, dan foto pendukung")
        pg.fill("#jumlah", "10000000")
        pg.locator("#btn-simpan").click()
        pg.wait_for_timeout(400)
        cek(daftar_trx(pg) == [], "judul kosong: tidak tersimpan")
        pg.fill("#judul-kegiatan", "Kegiatan Pemetaan Krayan Batch 4")
        pg.wait_for_timeout(200)
        cek(pg.locator("[data-testid=judul-baru]").count() == 1, "judul baru: keterangan 'dibuat otomatis'")
        ukur = pg.evaluate("(() => { const r = document.querySelector('.lampiran-bukti__tombol'); const t = [...r.querySelectorAll('button')].map(e => e.getBoundingClientRect()); return { tampil: getComputedStyle(r).display, kolom: new Set(t.map(x => Math.round(x.left))).size, lebar: new Set(t.map(x => Math.round(x.width))).size }; })()")
        if lebar < 640:
            cek(ukur["tampil"] == "grid" and ukur["kolom"] == 2 and ukur["lebar"] == 1, f"HP: dua tombol lampiran bukti sama lebar sebaris ({ukur})")
        else:
            cek(ukur["tampil"] == "flex", f"PC/tablet: lampiran bukti tidak diubah ({ukur['tampil']})")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        pg.locator("#btn-simpan").click()
        pg.wait_for_timeout(600)
        t = daftar_trx(pg)
        kg = kegiatan(pg)
        cek(len(t) == 1 and t[0]["jenis"] == "pemasukan" and t[0]["dana"] == "Dana Kegiatan" and t[0]["jumlah"] == 10000000, "penerimaan dana tersimpan")
        cek(len(kg) == 1 and kg[0]["nama"] == "Kegiatan Pemetaan Krayan Batch 4", f"kegiatan dibuat otomatis dengan judul itu ({[k['nama'] for k in kg]})")
        cek(t and t[0]["kaitan"] == "Kegiatan Pemetaan Krayan Batch 4" and t[0].get("kegiatanId") == kg[0]["id"] and t[0]["deskripsi"] == "Penerimaan Dana Kegiatan" and not t[0].get("detailKegiatan"), "transaksi terhubung ke kegiatan; uraian bersih tanpa mengulang judul; tanpa rincian SPJ")
        buka_form(pg)
        pg.locator(".f-jenis label", has_text="Pemasukan").click()
        pg.select_option("#dana", "Dana Kegiatan")
        pg.fill("#judul-kegiatan", "kegiatan pemetaan krayan batch 4")
        pg.fill("#jumlah", "5000000")
        pg.wait_for_timeout(200)
        cek(pg.locator("[data-testid=judul-ada]").count() == 1, "judul yang sama (huruf kecil) dikenali sebagai kegiatan yang sudah ada")
        pg.locator("#btn-simpan").click()
        pg.wait_for_timeout(600)
        cek(len(kegiatan(pg)) == 1 and len(daftar_trx(pg)) == 2 and all(x["kegiatanId"] == kg[0]["id"] for x in daftar_trx(pg)), "penerimaan kedua memakai kegiatan yang sama, tidak membuat kegiatan kembar")
        cek(not galat, f"tanpa galat JS ({galat})")
        ctx.close()

    # ---------------------------------------------------------------- poin 3 (HP) + PC tidak berubah
    print("== Poin 3: Foto Pendukung rapi di HP, PC tidak berubah")
    kg_awal = {"keuangan-daftar-kegiatan": [{"id": "kg1", "nama": "Survei Hulu Contoh", "lokasi": "Kota Contoh", "tanggalMulai": "2026-09-20", "tanggalSelesai": "2026-12-23"}]}
    ctx, pg, galat = buka(b, 390, 1700, simpanan=kg_awal)
    buka_form(pg)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    pg.locator(".bertahap-kegiatan__item").first.click()
    pg.wait_for_timeout(250)
    pg.locator('.bertahap-ubin__item[data-kategori="Pengadaan Barang & Perlengkapan"]').click()
    pg.wait_for_timeout(300)
    pg.locator("#btn-lanjut-langkah").click()
    pg.wait_for_timeout(300)
    pg.fill("#deskripsi", "Tenda lapangan")
    pg.fill("#jumlah", "900000")
    pg.locator("#btn-lanjut-langkah").click()
    pg.wait_for_timeout(300)
    ukur = pg.evaluate("""() => { const w = document.querySelector('.foto-pendukung'); const k = w.getBoundingClientRect(); const t = [...w.querySelectorAll('.foto-pendukung__pilih')].map(e => e.getBoundingClientRect());
        return { n: t.length, kolom: new Set(t.map(r => Math.round(r.left))).size, baris: new Set(t.map(r => Math.round(r.top))).size, lebar: new Set(t.map(r => Math.round(r.width))).size, tinggi: new Set(t.map(r => Math.round(r.height))).size,
                 dalam: t.every(r => r.left >= k.left - 1 && r.right <= k.right + 1), luap: [...w.querySelectorAll('.foto-pendukung__pilih span')].some(e => e.scrollWidth > e.clientWidth + 1) }; }""")
    cek(ukur["n"] == 3 and ukur["kolom"] == 3 and ukur["baris"] == 1 and ukur["lebar"] == 1 and ukur["tinggi"] == 1, f"HP: tiga tombol foto sebaris, sama ukuran ({ukur})")
    cek(ukur["dalam"] and not ukur["luap"], "tombol di dalam kotak dan teksnya tidak terpotong")
    lamp = pg.evaluate("(() => { const r = document.querySelector('.lampiran-bukti__tombol'); const t = [...r.querySelectorAll('button')].map(e => e.getBoundingClientRect()); return { kolom: new Set(t.map(x => Math.round(x.left))).size, lebar: new Set(t.map(x => Math.round(x.width))).size }; })()")
    cek(lamp["kolom"] == 2 and lamp["lebar"] == 1, f"HP: tombol Lampiran Bukti sama lebar sebaris ({lamp})")
    cek(tanpa_luapan(pg), "tanpa luapan horizontal")
    ctx.close()
    ctx, pg, galat = buka(b, 1280, simpanan=kg_awal)
    buka_form(pg)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(400)
    pg.locator(".kategori-ubin", has_text="Pengadaan").click()
    pg.wait_for_timeout(300)
    pc = pg.evaluate("(() => { const r = document.querySelector('.foto-pendukung__tombol'); return { tampil: getComputedStyle(r).display, baris: new Set([...r.children].map(e => Math.round(e.getBoundingClientRect().top))).size }; })()")
    cek(pc["tampil"] == "flex" and pc["baris"] == 1, f"PC: tombol foto tetap berderet seperti semula ({pc})")
    ctx.close()

    # ---------------------------------------------------------------- poin 7
    def contoh_pantauan():
        kini = datetime.datetime.utcnow().isoformat() + "Z"
        return [
            {"id": "p1", "nama": "Oli Mesin Motor", "jenisBarang": "habis-pakai", "presetId": "oli-mesin-motor", "basis": "pemakaian", "metode": "garis-lurus", "harga": 65000, "nilaiResidu": 0,
             "umurTotal": 2000, "satuanPemakaian": "km", "batasWaktuBulan": 2, "tanggalMulai": iso(hari_ini - datetime.timedelta(days=10)), "pemakaianAwal": 45000, "pemakaianSekarang": 46500, "dibuat": kini},
            {"id": "p2", "nama": "Aki Motor", "jenisBarang": "habis-pakai", "presetId": "aki-motor", "basis": "waktu", "metode": "garis-lurus", "harga": 350000, "nilaiResidu": 0, "umurTotal": 24,
             "satuanWaktu": "bulan", "tanggalMulai": iso(hari_ini - datetime.timedelta(days=609)), "dibuat": kini},
            {"id": "p3", "nama": "Laptop Kantor", "jenisBarang": "aset", "presetId": "laptop", "basis": "waktu", "metode": "saldo-menurun-ganda", "harga": 9000000, "nilaiResidu": 0, "umurTotal": 4,
             "satuanWaktu": "tahun", "tanggalMulai": iso(hari_ini - datetime.timedelta(days=30)), "dibuat": kini},
        ]

    for lebar in (390, 768, 1280):
        print(f"== Poin 7: layar Depresiasi Aset rapi ({lebar}px)")
        pengaturan_awal = {"anggaranHarian": 0, "anggaranKategori": {"Dana Pribadi": {}, "Dana Kegiatan": {}}, "penyusutan": contoh_pantauan()}
        ctx, pg, galat = buka(b, lebar, simpanan={"keuangan-pengaturan": pengaturan_awal})
        nav(pg, "Saya")
        pg.locator("[data-app=depresiasi]").click()
        pg.wait_for_timeout(500)
        bar = pg.evaluate("""() => { const f = [...document.querySelectorAll('.dep-saringan button')].map(e => e.getBoundingClientRect()); const t = document.querySelector('.dep-tambah').getBoundingClientRect(); const w = document.querySelector('.dep-bar').getBoundingClientRect();
            return { n: f.length, barisSaringan: new Set(f.map(r => Math.round(r.top))).size, lebarSama: new Set(f.map(r => Math.round(r.width))).size, tinggiSama: new Set(f.map(r => Math.round(r.height))).size,
                     tombolDiBawah: t.top > f[0].bottom, tombolSelebar: Math.abs(t.width - w.width) <= 2, sebaris: Math.abs((t.top + t.height / 2) - (f[0].top + f[0].height / 2)) <= 6, tombolKanan: Math.abs(t.right - w.right) <= 2 }; }""")
        cek(bar["n"] == 4 and bar["barisSaringan"] == 1, f"empat tombol saringan dalam satu baris ({bar})")
        if lebar < 640:
            cek(bar["lebarSama"] == 1 and bar["tinggiSama"] == 1, "HP: keempat tombol saringan sama lebar dan tinggi")
            cek(bar["tombolDiBawah"] and bar["tombolSelebar"], "HP: tombol 'Tambah aset' di baris sendiri, selebar daftar")
        else:
            cek(bar["sebaris"] and bar["tombolKanan"], "tablet/PC: 'Tambah aset' sebaris dengan saringan, rata kanan")
        cek(pg.evaluate("[...document.querySelectorAll('.dep-saringan button')].every(e => e.scrollWidth <= e.clientWidth + 1)"), "teks tombol saringan tidak terpotong")
        kartu = pg.evaluate("""() => [...document.querySelectorAll('[data-testid=kartu-umur]')].map(c => { const a = c.querySelector('.umur-kartu__tombol'); const g = a.querySelector('[data-aksi=ganti]').getBoundingClientRect(); const k = c.getBoundingClientRect();
            const u = a.querySelector('[data-aksi=ubah]').getBoundingClientRect(); const h = a.querySelector('[data-aksi=hapus]').getBoundingClientRect();
            return { penuh: Math.abs(g.width - (a.getBoundingClientRect().width)) <= 2, tautanSebaris: Math.abs(u.top - h.top) <= 4, dalam: g.right <= k.right && h.right <= k.right + 1 }; })""")
        cek(all(k["penuh"] and k["tautanSebaris"] and k["dalam"] for k in kartu), f"'Sudah diganti' selebar kartu, 'Ubah data' dan 'Hapus pantauan' sebaris di bawahnya ({kartu[0]})")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal")
        ctx.close()

    print("== Poin 7: kotak centang 'Masukkan ke Depresiasi Aset' di formulir pengeluaran")
    for lebar in (390, 1280):
        ctx, pg, galat = buka(b, lebar)
        buka_form(pg)
        cek(pg.locator("[data-testid=kotak-depresiasi]").count() == 1 and pg.locator("#masuk-depresiasi").is_visible(), f"{lebar}px: kotak centang tersedia di formulir pengeluaran")
        pg.locator(".kategori-ubin", has_text="Transportasi").click()
        pg.fill("#deskripsi", "Ganti oli mesin")
        pg.fill("#jumlah", "65000")
        pg.wait_for_timeout(200)
        cek("Disarankan" in pg.locator("[data-testid=kotak-depresiasi]").inner_text(), "barang dikenali: kotak memberi saran")
        pg.locator("#masuk-depresiasi").check()
        pg.wait_for_timeout(300)
        ringkas = pg.locator("[data-testid=ringkas-depresiasi]").inner_text()
        cek("2.000 km atau 2 bulan" in ringkas and "Ganti oli mesin" in ringkas, f"dicentang: umur terisi otomatis dari basis data ({ringkas!r})")
        cek(tanpa_luapan(pg), "tanpa luapan horizontal setelah dicentang")
        pg.locator("#btn-simpan").click()
        pg.wait_for_timeout(600)
        data = pengaturan(pg).get("penyusutan", [])
        t = daftar_trx(pg)
        cek(pg.locator("[data-testid=dialog-depresiasi]").count() == 0, "sudah dicentang: tidak ada tawaran lagi setelah simpan")
        cek(len(data) == 1 and data[0]["presetId"] == "oli-mesin-motor" and data[0]["harga"] == 65000 and data[0]["batasWaktuBulan"] == 2 and t and data[0]["transaksiId"] == t[0]["id"], f"masuk Depresiasi Aset tanpa input ulang ({data[0]['nama'] if data else None})")
        if lebar == 1280:
            nav(pg, "Riwayat")
            pg.locator("#view-riwayat li", has_text="Ganti oli mesin").first.hover()
            pg.locator("#view-riwayat li", has_text="Ganti oli mesin").first.locator("button[title='Ubah transaksi']").click()
            pg.wait_for_timeout(500)
            cek(pg.locator("#masuk-depresiasi").is_checked() and "Ganti oli mesin" in pg.locator("[data-testid=ringkas-depresiasi]").inner_text(), "ubah transaksi: kotak tercentang dan ringkasan terbuka dari pantauan")
            pg.fill("#jumlah", "70000")
            pg.locator("#btn-simpan").click()
            pg.wait_for_timeout(600)
            data = pengaturan(pg).get("penyusutan", [])
            cek(len(data) == 1 and data[0]["harga"] == 70000, "harga pantauan mengikuti perubahan jumlah (tanpa menggandakan)")
            pg.locator("#view-riwayat li", has_text="Ganti oli mesin").first.hover()
            pg.locator("#view-riwayat li", has_text="Ganti oli mesin").first.locator("button[title='Ubah transaksi']").click()
            pg.wait_for_timeout(500)
            pg.locator("#masuk-depresiasi").uncheck()
            pg.locator("#btn-simpan").click()
            pg.wait_for_timeout(600)
            cek(pengaturan(pg).get("penyusutan", []) == [], "melepas centang pada transaksi yang diubah: pantauan dilepas")
        cek(not galat, f"tanpa galat JS ({galat})")
        ctx.close()

    ctx, pg, galat = buka(b, 1280)
    buka_form(pg)
    pg.fill("#deskripsi", "Beli barang misterius")
    pg.fill("#jumlah", "100000")
    pg.locator("#masuk-depresiasi").check()
    pg.wait_for_timeout(300)
    cek("belum dikenali" in pg.locator("[data-testid=ringkas-depresiasi]").inner_text() and pg.locator("[data-testid=penyusutan-form]").is_visible(), "barang tak dikenali: isian detail terbuka untuk memilih dari daftar umur standar")
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(500)
    cek("Depresiasi Aset" in pg.locator("#galat-form").inner_text() and daftar_trx(pg) == [], "centang tanpa umur: simpan ditahan dengan pesan")
    pg.locator("[data-preset=perabot-kayu]").click()
    pg.wait_for_timeout(200)
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(600)
    cek(len(pengaturan(pg).get("penyusutan", [])) == 1 and pengaturan(pg)["penyusutan"][0]["presetId"] == "perabot-kayu", "setelah memilih dari daftar umur standar: tersimpan")
    buka_form(pg)
    pg.fill("#deskripsi", "Ganti oli mesin")
    pg.fill("#jumlah", "65000")
    pg.locator("#masuk-depresiasi").check()
    pg.locator("#masuk-depresiasi").uncheck()
    pg.locator("#btn-simpan").click()
    pg.wait_for_timeout(500)
    cek(pg.locator("[data-testid=dialog-depresiasi]").count() == 0, "dicentang lalu dilepas (sudah memutuskan): tidak ditawari lagi")
    ctx.close()

    b.close()

print()
if gagal:
    print(f"{len(gagal)} pemeriksaan gagal:")
    for g in gagal:
        print("  -", g)
    sys.exit(1)
print("Semua pemeriksaan lolos")
