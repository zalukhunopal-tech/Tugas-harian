"""
Uji dokumen siap cetak laporan Dana Kegiatan. Bila satu kegiatan dipilih, pratinjau dan hasil cetak sama dengan dokumen Word unduhan
(lib/susunanLaporan.ts): timesheet uang harian lanskap di depan (termasuk hari kepulangan sesudah tanggal selesai), identitas dan
Penerimaan Dana, tiap kelompok pengeluaran di halaman baru (tabel, lalu tiap pengeluaran: kotak tempel bukti asli, SEMUA foto bukti,
keterangan, kotak tambahan), rekapitulasi dengan kartu ringkasan penyelesaian dana, dan daftar periksa; A4 bermargin 20 mm dengan
kepala halaman dan "Halaman X dari Y" seperti Word. Tanpa kegiatan terpilih dokumen umum (tabel per kategori dan Lembar Tempel
Bukti Tipe A/B/C) tetap berlaku. Juga tampilan di HP/tablet/PC. Halaman PDF diperiksa dengan pdfinfo, pdftotext, dan pdfimages.

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_cetak.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import base64
import datetime
import json
import pathlib
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
ADA_PDF_ALAT = bool(shutil.which("pdfinfo") and shutil.which("pdftotext") and shutil.which("pdfimages"))

JUDUL = "Kegiatan Fasilitasi Penyelesaian Klaim Wilayah Contoh dan Koordinasi Multipihak di Provinsi Contoh (Batch 4)"
KID = "kg4"

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def png_data_url(w, h, warna):
    """PNG bergaris tanpa PIL: foto bukti contoh dengan bingkai tebal supaya tepinya terlihat."""
    baris = []
    for y in range(h):
        r = bytearray([0])
        for x in range(w):
            tepi = x < 6 or y < 6 or x >= w - 6 or y >= h - 6
            terang = (y // 24) % 2 == 1
            c = (30, 30, 30) if tepi else tuple(min(255, v + (50 if terang else 0)) for v in warna)
            r += bytes(c)
        baris.append(bytes(r))

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(baris))) + chunk(b"IEND", b"")
    return "data:image/png;base64," + base64.b64encode(png).decode()


def foto(i, w, h, warna):
    return {"id": f"ft{i}", "nama": f"bukti{i}.png", "tipe": "image/png", "dataUrl": png_data_url(w, h, warna)}


def trx(i, tgl, desk, kat, jml, **kw):
    d = {"id": i, "jenis": "pengeluaran", "dana": "Dana Kegiatan", "tanggal": tgl, "deskripsi": desk, "kategori": kat,
         "jumlah": jml, "metode": "Tunai", "kaitan": JUDUL, "catatan": "", "kegiatanId": KID}
    d.update(kw)
    return d


def data_uji():
    t = [{"id": "dana1", "jenis": "pemasukan", "dana": "Dana Kegiatan", "tanggal": "2026-09-19", "deskripsi": f"Penerimaan Dana {JUDUL}",
          "kategori": "Penerimaan Dana", "jumlah": 25000000, "metode": "Transfer", "kaitan": JUDUL, "catatan": "", "kegiatanId": KID}]
    # Pra-kegiatan: bertanggal sebelum tanggal mulai kegiatan (20 Sep)
    t.append(trx("pra1", "2026-09-18", "Tiket pesawat keberangkatan", "Transportasi", 1850000,
                 detailKegiatan={"jenisBukti": "Tiket pesawat/e-ticket", "transportasi": {"dari": "Jakarta", "ke": "Tarakan", "moda": "Pesawat"},
                                 "penerimaManfaat": ["Rudi", "Budi"]}))
    t.append(trx("pra2", "2026-09-19", "Belanja logistik awal", "Pengadaan Barang & Perlengkapan", 620000, detailKegiatan={"jenisBukti": "Invoice + kuitansi"}))
    t.append(trx("kud1", "2026-09-19", "Kudapan perjalanan keberangkatan", "Konsumsi", 200000,
                 detailKegiatan={"jenisBukti": "Struk thermal (minimarket/SPBU)", "konsumsi": {"kudapanPerjalanan": True},
                                 "penerimaManfaat": ["Rudi", "Budi", "Andi"]}))
    t.append(trx("sb1", "2026-09-20", "Transportasi Speedboat", "Transportasi", 900000,
                 detailKegiatan={"jenisBukti": "Tiket", "transportasi": {"dari": "Tarakan", "ke": "Malinau", "moda": "Speedboat / Kapal"},
                                 "penerimaManfaat": ["Rudi", "Budi", "Andi"]}))
    t.append(trx("ak1", "2026-09-21", "Penginapan Pak Kades", "Akomodasi", 450000,
                 detailKegiatan={"jenisBukti": "Kuitansi", "akomodasi": {"lokasi": "Rumah Pak Kades", "jumlahMalam": 1}, "penerimaManfaat": ["Rudi", "Budi"]}))
    t.append(trx("bb1", "2026-09-22", "BBM motor lapangan", "BBM", 150000, detailKegiatan={"jenisBukti": "Struk thermal (minimarket/SPBU)"}))
    # Foto bukti digital: Tipe B (tiket), Tipe C (invoice), Tipe A dengan dua foto (struk), Tipe B (kuitansi penginapan)
    for x in t:
        if x["id"] == "pra1": x["bukti"] = [foto(1, 640, 280, (200, 140, 120))]
        if x["id"] == "pra2": x["bukti"] = [foto(2, 520, 380, (140, 190, 140))]
        if x["id"] == "kud1": x["bukti"] = [foto(3, 300, 520, (190, 170, 110)), foto(4, 300, 520, (150, 120, 190))]
        if x["id"] == "ak1": x["bukti"] = [foto(5, 600, 260, (120, 190, 190))]
    t.append(trx("ks1", "2026-09-22", "Konsumsi rapat koordinasi bersama warga desa", "Konsumsi", 450000,
                 detailKegiatan={"jenisBukti": "Nota", "konsumsi": {"jumlahPeserta": 15}}))
    for k in range(6):
        t.append(trx(f"nt{k}", f"2026-09-2{3 + k % 6}", f"Pembelian perlengkapan lapangan {k + 1}", "Pengadaan Barang & Perlengkapan", 80000 + k * 5000,
                     detailKegiatan={"jenisBukti": "Invoice + kuitansi" if k == 5 else "Nota"}))
    ts = []
    for i in range(35):
        d = datetime.date(2026, 9, 20) + datetime.timedelta(days=i)
        t.append(trx(f"pd{i}", d.isoformat(), f"Perdiem Contoh · {d.isoformat()}", "Perdiem", 200000))
        ts.append({"tanggal": d.isoformat(),
                   "keterangan": f"Pendampingan pemetaan partisipatif dan diskusi kampung bersama warga hari ke-{i + 1} dilanjutkan dengan koordinasi data keruangan",
                   "lokasi": f"Desa Contoh {i % 5 + 1}, Kecamatan Contoh"})
    # Hari kepulangan (sehari sesudah tanggal selesai 24 Okt): uang harian belum dikaitkan ke kegiatan, tetap ikut di timesheet
    t.append(trx("pd35", "2026-10-25", "Perdiem Contoh · 2026-10-25", "Perdiem", 200000, kegiatanId=None, kaitan=""))
    ts.append({"tanggal": "2026-10-25", "keterangan": "Perjalanan pulang dari lokasi kegiatan ke kantor", "lokasi": "Kecamatan Contoh"})
    keg = [{"id": KID, "nama": JUDUL, "lokasi": "Kecamatan Contoh", "tanggalMulai": "2026-09-20", "tanggalSelesai": "2026-10-24", "batch": 4, "timesheetBaris": ts}]
    prof = {"nama": "Budi Santoso", "jabatan": "Surveyor", "lembaga": "Lembaga Contoh", "proyek": "Proyek Contoh", "penyetuju": "Sari Wulandari"}
    return (
        "if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','standar');localStorage.setItem('keuangan-karakter','megumi');"
        f"localStorage.setItem('pengeluaran-harian', {json.dumps(json.dumps(t))});localStorage.setItem('keuangan-daftar-kegiatan', {json.dumps(json.dumps(keg))});"
        f"localStorage.setItem('keuangan-profil-pelapor', {json.dumps(json.dumps(prof))});}}"
    )


def halaman_pdf(path):
    """[(nomor, 'L'|'P', lebar, tinggi)] dari pdfinfo."""
    out = subprocess.run(["pdfinfo", "-f", "1", "-l", "200", str(path)], capture_output=True, text=True).stdout
    hasil = []
    for n, w, h in re.findall(r"Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)", out):
        hasil.append((int(n), "L" if float(w) > float(h) else "P", float(w), float(h)))
    return hasil


def teks_halaman(path, n):
    return subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), "-layout", str(path), "-"], capture_output=True, text=True).stdout


def ujung_bawah(path, n, tinggi):
    """Posisi vertikal (0..1) kata terbawah di halaman n."""
    out = subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), "-bbox", str(path), "-"], capture_output=True, text=True).stdout
    ys = [float(y) for y in re.findall(r'yMax="([\d.]+)"', out)]
    return max(ys) / tinggi if ys else 0


def pdf_kiri(path, n):
    """xMin terkecil (pt) kata di halaman n: tepi kiri isi = margin kiri."""
    out = subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), "-bbox", str(path), "-"], capture_output=True, text=True).stdout
    xs = [float(x) for x in re.findall(r'xMin="([\d.]+)"', out)]
    return min(xs) if xs else 0


def gambar_pdf(path):
    """Jumlah gambar per halaman dari pdfimages -list."""
    out = subprocess.run(["pdfimages", "-list", str(path)], capture_output=True, text=True).stdout
    hasil = {}
    for baris in out.splitlines()[2:]:
        kol = baris.split()
        if len(kol) > 2 and kol[2] == "image":
            hasil[int(kol[0])] = hasil.get(int(kol[0]), 0) + 1
    return hasil


def rapat(teks):
    return re.sub(r"\s+", " ", teks.replace("\u00a0", " "))


def buka(b, lebar, init, tinggi=1000, kegiatan=True):
    ctx = b.new_context(viewport={"width": lebar, "height": tinggi}, service_workers="block", is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)[:300]))
    pg.add_init_script(init)
    # window.print() tidak dipakai di uji: PDF dibuat dari keadaan halaman setelah tombol cetak ditekan.
    pg.add_init_script("window.print = () => { window.__cetak = (window.__cetak || 0) + 1; };")
    pg.goto(BASE)
    pg.locator(".navbar:visible, .sidebar:visible").first.wait_for(timeout=15000)
    pg.wait_for_timeout(500)
    pg.locator(".navbar:visible button, .sidebar:visible button", has_text="Saya").first.click()
    pg.wait_for_timeout(300)
    pg.locator("[data-app=laporan]").click()
    pg.wait_for_timeout(400)
    if kegiatan:
        pg.select_option("#lap-kegiatan-select", KID)
    else:
        pg.locator("button.btn-small", has_text="Sepanjang Waktu").first.click()
        pg.wait_for_timeout(300)
        pg.select_option("#lap-kegiatan-select", "")
    pg.wait_for_timeout(900)
    return ctx, pg, galat


def tunggu_foto(pg):
    """Tunggu sampai tombol cetak aktif (semua foto bukti selesai dimuat)."""
    pg.wait_for_function("() => { const b = [...document.querySelectorAll('.dsc-cetak-aksi button')][0]; return b && !b.disabled; }", timeout=15000)
    pg.wait_for_timeout(300)


init = data_uji()
KEPALA = "Laporan Keuangan Kegiatan · Budi Santoso · 20 September 2026 s.d. 24 Oktober 2026"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    folder = pathlib.Path(tempfile.mkdtemp(prefix="uji-cetak-"))

    print("== Pengeluaran pra-kegiatan dan hari kepulangan ikut dalam laporan")
    ctx, pg, galat = buka(b, 1280, init)
    tunggu_foto(pg)
    info = pg.locator("[data-testid=info-pra-kegiatan]")
    cek(info.count() == 1 and "pra-kegiatan" in info.inner_text() and "18 September 2026" in info.inner_text(), f"catatan pra-kegiatan tampil ({info.inner_text()[:90] if info.count() else '-'!r})")
    doc = rapat(pg.locator(".dokumen-siap-cetak").inner_text())
    cek("Tiket pesawat keberangkatan" in doc and "18/09/2026" in doc, "tiket keberangkatan (18 Sep) ada di dokumen")
    cek("Belanja logistik awal" in doc and "Kudapan perjalanan keberangkatan" in doc, "belanja awal dan kudapan keberangkatan (19 Sep) ada di dokumen")
    ts_baris = pg.locator("[data-testid=lembar-timesheet] tbody tr")
    cek(ts_baris.count() == 36, f"timesheet 36 hari: 20 Sep sampai hari kepulangan 25 Okt ({ts_baris.count()})")
    cek("10/25/2026" in ts_baris.last.inner_text() and "Perjalanan pulang" in ts_baris.last.inner_text(), f"baris terakhir: 25 Okt, keterangan dari timesheet ({ts_baris.last.inner_text()[:80]!r})")
    cek("7.200.000" in pg.locator("[data-testid=lembar-timesheet] .dsc-ts__total").inner_text(), "total uang harian Rp7.200.000 (36 × 200.000)")
    pg.locator("button.btn-small", has_text="Sepanjang Waktu").first.click()
    pg.wait_for_timeout(500)
    pg.select_option("#lap-kegiatan-select", KID)
    pg.wait_for_timeout(500)
    kop = pg.locator(".laporan-kop__data").inner_text()
    cek("18 September" in kop and "pra-kegiatan" in kop, "kop laporan menyebut periode sejak pengeluaran pra-kegiatan")

    print("== Susunan sama dengan dokumen Word")
    urutan = pg.evaluate("""[...document.querySelectorAll('.dlk > *')].map(e => e.classList.contains('dsc-lanskap-gulir') ? 'timesheet'
        : e.dataset.testid === 'dlk-kelompok' ? 'kelompok:' + e.dataset.kategori : e.dataset.testid || null).filter(Boolean)""")
    harap = ["timesheet", "dlk-identitas", "kelompok:Transportasi", "kelompok:BBM", "kelompok:Akomodasi", "kelompok:Konsumsi", "kelompok:Pengadaan Barang & Perlengkapan", "dlk-rekap", "dlk-daftar-periksa"]
    cek([x for x in urutan if x != "dlk-kelompok-lanjutan"] == harap, f"urutan: timesheet, identitas, kelompok baku, rekapitulasi, daftar periksa ({urutan})")
    idt = rapat(pg.locator("[data-testid=dlk-identitas]").inner_text())
    cek("LAPORAN KEUANGAN KEGIATAN" in idt and JUDUL.upper()[:40] in idt and "Nama Pelapor : Budi Santoso" in idt and "Periode Kegiatan : 20 September 2026 s.d. 24 Oktober 2026" in idt, "lembar identitas: judul, kegiatan (huruf besar), nama pelapor, periode")
    cek("Penerimaan Dana (Dana Awal Kegiatan)" in idt and "Jumlah Penerimaan Dana 25.000.000" in idt and "Penerimaan Dana Kegiatan" in idt, "tabel Penerimaan Dana dengan uraian bersih dan jumlahnya")
    judul_kel = [rapat(x) for x in pg.locator(".dlk-judul-kelompok").all_inner_texts()]
    cek(judul_kel == ["1. TRANSPORTASI", "2. BBM", "3. AKOMODASI", "4. KONSUMSI", "5. PENGADAAN BARANG & PERLENGKAPAN"], f"judul kelompok bernomor huruf besar ({judul_kel})")
    sub = rapat(pg.locator(".dlk-sub-kelompok").first.inner_text())
    cek(sub == "2 bukti pengeluaran · Subtotal Rp 2.750.000", f"sub judul: jumlah bukti dan subtotal ({sub!r})")
    cek(pg.locator("[data-testid=blok-transaksi]").count() == 13, f"13 blok pengeluaran (uang harian sudah berupa timesheet) ({pg.locator('[data-testid=blok-transaksi]').count()})")
    cek(pg.locator("[data-testid=blok-transaksi]").evaluate_all("bs => bs.every(b => b.querySelector('[data-testid=kotak-tempel]'))"), "tiap pengeluaran punya kotak tempel bukti asli")
    kep = pg.locator(".dlk-kepala-layar").all_inner_texts()
    cek(len(kep) >= 9 and all(k == KEPALA for k in kep), f"kepala halaman di tiap lembar: {kep[0] if kep else '-'!r}")
    cek(pg.locator(".dsc-tempel-pilihan").count() == 0 and pg.locator(".dsc-kotak").count() == 0, "tanpa pilihan dan lembar tempel model lama")
    cek("Rekapitulasi Klaim" not in doc and "Rekapitulasi Penggunaan Dana" in doc, "rekapitulasi bernama Rekapitulasi Penggunaan Dana")

    print("== Semua foto bukti termuat")
    foto = pg.evaluate("[...document.querySelectorAll('.dlk img.dsc-foto')].map(i => [i.complete && i.naturalWidth > 0, i.closest('[data-testid=blok-transaksi]').dataset.nomor])")
    cek(len(foto) == 5 and all(x[0] for x in foto), f"kelima foto bukti tampil dan termuat ({foto})")
    blok_kud = pg.locator("[data-testid=blok-transaksi]", has_text="Kudapan perjalanan keberangkatan")
    cek(blok_kud.locator(".dlk-struk img.dsc-foto").count() == 1 and blok_kud.locator(".dlk-foto-kisi img, .dlk-foto-tunggal img").count() == 1, "struk kudapan: foto pertama di samping kotak struk, foto kedua di bawahnya")
    tk = rapat(blok_kud.inner_text())
    cek("FOTO BUKTI DIGITAL (2 FOTO)" in tk and "Foto bukti 2 dari 2" in tk and "TEMPEL STRUK ASLI DI SINI" in tk and "(Struk Thermal Mudah Pudar)" in tk, "struk: judul tempel, catatan thermal, dan '2 FOTO' / 'Foto bukti 2 dari 2'")
    cek("Kudapan/Snack Perjalanan — Penerima Manfaat: 3 orang (Rudi, Budi, Andi @ Rp66.667)" in tk, "kudapan: penerima manfaat 3 orang dengan bagian tiap orang")
    blok_bbm = rapat(pg.locator("[data-testid=blok-transaksi]", has_text="BBM motor lapangan").inner_text())
    cek("Belum ada foto bukti digital" in blok_bbm, "struk BBM tanpa foto: kolom foto berisi petunjuk tempel fotokopi")
    blok_tiket = rapat(pg.locator("[data-testid=blok-transaksi]", has_text="Tiket pesawat keberangkatan").inner_text())
    cek(blok_tiket.startswith("No. 1 Tiket pesawat keberangkatan Rp 1.850.000"), f"kepala blok: No, uraian, nominal ({blok_tiket[:60]!r})")
    cek("TEMPEL TIKET PESAWAT/E-TICKET ASLI DI SINI" in blok_tiket and "TEMPEL BOARDING PASS ASLI / TIKET TRAVEL ASLI DI SINI" in blok_tiket, "tiket pesawat: kotak tiket dan kotak boarding pass")
    cek("Pelapor: Budi Santoso | Tanggal: 18 September 2026" in blok_tiket and "Diklaim untuk: Budi Santoso, Rudi, Budi" in blok_tiket, "keterangan: pelapor, tanggal, Diklaim untuk")
    cek("TEMPEL FOTOKOPI KTP PEMILIK PENGINAPAN DI SINI" in doc, "akomodasi: kotak KTP pemilik penginapan")

    print("== Kelengkapan per kategori di tabel")
    cek("Rute: Jakarta – Tarakan" in doc and "Moda: Pesawat" in doc and "Kelengkapan: e-ticket dan boarding pass" in doc, "Transportasi: rute, moda, kelengkapan e-ticket dan boarding pass")
    cek("Rute: Tarakan – Malinau" in doc and "Kelengkapan: tiket" in doc, "Transportasi speedboat: rute dan kelengkapan tiket")
    cek("Penginapan: Rumah Pak Kades" in doc and "1 malam" in doc and "KTP pemilik" in doc, "Akomodasi: nama penginapan, malam, KTP pemilik")
    cek("Peserta: 15 orang" in doc, "Konsumsi: jumlah peserta")
    cek("Metode: Tunai" in doc and "Metode: Transfer" in doc, "metode pembayaran tampil di tabel (Tunai, Transfer)")
    cek("Diklaim untuk: Budi Santoso, Rudi, Budi, Andi" in doc and "Penerima Manfaat: Rudi, Budi, Andi" not in doc, "kategori berpenerima memakai 'Diklaim untuk'")
    cek("Uang Harian (Per Diem) Kegiatan Lapangan" in doc and "Perdiem" not in doc, "uang harian tanpa ejaan 'Perdiem' di dokumen")
    isi = pg.locator("#view-saya").inner_text()
    cek(re.search(r"kwitansi|staff", isi, re.I) is None, "tanpa 'kwitansi' atau 'staff'")

    print("== Rekapitulasi dan ringkasan penyelesaian dana")
    rk = rapat(pg.locator("[data-testid=dlk-rekap]").inner_text())
    cek("Total Pengeluaran 49 bukti 12.375.000" in rk and "Uang Harian 36 bukti 7.200.000" in rk, f"rekap: total 49 bukti Rp12.375.000, uang harian 36 bukti ({rk[-160:]!r})")
    rs = pg.locator("[data-testid=ringkasan-penyelesaian]")
    trs = rapat(rs.inner_text())
    cek(rs.get_attribute("data-status") == "kembalikan" and "RINGKASAN PENYELESAIAN DANA KEGIATAN" in trs and "Total pengeluaran yang diakui Rp 12.375.000" in trs, "kartu ringkasan: judul, total diakui")
    cek("SISA DANA YANG HARUS DIKEMBALIKAN KE LEMBAGA" in trs.upper() and "Rp 12.625.000" in trs and "Dana awal Rp 25.000.000 − total pengeluaran yang diakui Rp 12.375.000 = Rp 12.625.000" in trs, "pita status: sisa dikembalikan Rp12.625.000 dengan rumusnya")
    gaya = rs.evaluate("""t => { const h = getComputedStyle(t.querySelector('thead th')); const st = t.querySelector('.dlk-ringkasan__status td'); const s = getComputedStyle(st);
        const n = getComputedStyle(t.querySelector('.dlk-ringkasan__nominal')); return [h.backgroundColor, h.color, s.backgroundColor, s.boxShadow, n.color, parseFloat(n.fontSize) / parseFloat(getComputedStyle(t).fontSize)]; }""")
    cek(gaya[0] == "rgb(31, 41, 55)" and gaya[1] == "rgb(255, 255, 255)", f"pita judul gelap, teks putih ({gaya[:2]})")
    cek(gaya[2] == "rgb(231, 246, 236)" and "rgb(13, 101, 45)" in gaya[3] and gaya[4] == "rgb(13, 101, 45)" and gaya[5] > 1.6, f"pita status hijau, aksen kiri, nominal besar ({gaya[2:]})")
    cek(not re.search(r"\.{6,}", rk), "ringkasan tanpa garis titik-titik")
    cek("DAFTAR PERIKSA KELENGKAPAN SPJ" in doc and "Ketentuan Khusus: Transportasi" in doc, "daftar periksa SPJ di akhir")

    print("== Bilah dokumen: satu tombol cetak dan tombol Word")
    cek(pg.get_by_role("button", name=re.compile("Simpan PDF")).count() == 1, "satu tombol cetak: Cetak / Simpan PDF")
    cek(pg.locator(".dsc-cetak-aksi").get_by_role("button", name=re.compile("Unduh Laporan Word")).count() == 1 and pg.locator(".dsc-cetak-aksi button").count() == 2, "tombol Unduh Word berada di bilah dokumen yang sama (dua tombol)")
    cek("Susunan sama dengan dokumen Word" in pg.locator(".dsc-toolbar__ket").inner_text(), "keterangan bilah: susunan sama dengan dokumen Word")
    cek(pg.locator("#lap-kaitan").count() == 0 and "Kaitan Kegiatan / Sumber" not in isi, "filter Kaitan Kegiatan / Sumber sudah dihapus")
    catatan = pg.locator("[data-testid=catatan-spj-fisik]")
    cek(catatan.count() == 1 and "SPJ fisik diserahkan maksimal 14 hari" in catatan.inner_text() and "Batas Penyerahan" not in isi, "satu catatan kecil SPJ fisik di aplikasi, tanpa kotak batas penyerahan")

    pg.get_by_role("button", name=re.compile("Simpan PDF")).click()
    pg.wait_for_timeout(300)
    cek(pg.evaluate("document.documentElement.dataset.modeCetak") is None and pg.evaluate("window.__cetak") == 1, "satu klik memanggil window.print() sekali, tanpa mode cetak")
    pg.emulate_media(media="print")
    berkas = folder / "dokumen.pdf"
    pg.pdf(path=str(berkas), prefer_css_page_size=True, print_background=True)
    kop_cetak = pg.evaluate("[...document.querySelectorAll('.laporan-kop, .ringkasan-saldo, .catatan-spj-fisik, .dlk-kepala-layar')].every(e => getComputedStyle(e).display === 'none')")
    mm = 96 / 25.4
    ukur = pg.evaluate("""() => { const t = document.querySelector('[data-testid=blok-transaksi] [data-bentuk=lebar]').getBoundingClientRect();
        const s = document.querySelector('.dlk-struk').getBoundingClientRect(); const l = getComputedStyle(document.querySelector('.dlk-lembar'));
        return [t.height, s.height, l.page, l.paddingLeft, l.fontSize, getComputedStyle(document.querySelector('.dlk-kotak')).borderTopStyle]; }""")
    pg.emulate_media(media="screen")
    cek(kop_cetak, "kop layar, kartu saldo, catatan SPJ fisik, dan kepala layar tidak ikut tercetak (kepala dicetak di margin)")
    cek(abs(ukur[0] - 65 * mm) < 3 and abs(ukur[1] - 120 * mm) < 3, f"kotak tempel tiket 65 mm, kotak struk 120 mm saat dicetak ({ukur[0] / mm:.0f}, {ukur[1] / mm:.0f} mm)")
    cek(ukur[2] == "laporan-kegiatan" and ukur[3] == "0px" and ukur[4] == "14px" and ukur[5] == "dashed", f"lembar memakai halaman bernama laporan-kegiatan, huruf 10,5 pt, kotak bergaris putus-putus ({ukur[2:]})")
    cek(not galat, f"tanpa galat JS ({galat})")

    if ADA_PDF_ALAT:
        print("== PDF: orientasi, margin 2 cm, kepala dan nomor halaman")
        halaman = halaman_pdf(berkas)
        ori = "".join(x[1] for x in halaman)
        cek(re.fullmatch(r"L+P+", ori) is not None, f"lanskap (timesheet) di depan, lalu semua halaman potret ({ori})")
        lanskap = [x for x in halaman if x[1] == "L"]
        potret = [x for x in halaman if x[1] == "P"]
        teks = {x[0]: teks_halaman(berkas, x[0]) for x in halaman}
        teks_r = {n: rapat(t) for n, t in teks.items()}
        total = len(halaman)
        cek(all(KEPALA in teks_r[n] for n in teks_r), "kepala halaman (Laporan Keuangan Kegiatan · nama · periode) di setiap halaman")
        cek(all(f"Halaman {n} dari {total}" in teks_r[n] for n in teks_r), f"nomor 'Halaman X dari {total}' di setiap halaman")
        kiri = {x[0]: pdf_kiri(berkas, x[0]) for x in halaman}
        cek(all(k > 54 for k in kiri.values()) and 54 < min(kiri[x[0]] for x in potret) < 60 and 54 < min(kiri[x[0]] for x in lanskap) < 60,
            f"margin kiri 20 mm (≈56,7 pt) di halaman potret dan lanskap, tidak ada isi di luar margin ({sorted(set(round(k, 1) for k in kiri.values()))})")
        teks_l = "\n".join(teks_r[x[0]] for x in lanskap)
        cek(3 <= len(lanskap) <= 5 and "Uang Harian (Per Diem) Kegiatan Lapangan" in teks_l and "Perjalanan pulang dari lokasi kegiatan" in teks_l, f"timesheet 36 hari di {len(lanskap)} halaman lanskap, sampai hari kepulangan")
        cek(teks_l.count("Dilaporkan Oleh") == 1 and "7.200.000" in teks_r[lanskap[-1][0]], "tanda tangan dan total sekali di halaman lanskap terakhir")
        cek("LAPORAN KEUANGAN KEGIATAN" in teks_r[potret[0][0]] and "Penerimaan Dana (Dana Awal Kegiatan)" in teks_r[potret[0][0]], "halaman potret pertama: judul, identitas, Penerimaan Dana")

        print("== PDF: tiap kelompok di halaman baru, semua foto tercetak")
        awal_kel = {}
        for label in ("1. TRANSPORTASI", "2. BBM", "3. AKOMODASI", "4. KONSUMSI", "5. PENGADAAN BARANG"):
            hal = [n for n, t in teks.items() if re.search(rf"^\s*{re.escape(label)}", t, re.M)]
            awal_kel[label] = hal[0] if hal else None
        nilai = list(awal_kel.values())
        cek(all(nilai) and nilai == sorted(nilai) and len(set(nilai)) == 5, f"lima kelompok berurutan di halaman berbeda ({awal_kel})")
        cek(all(re.search(r"^\s*\d\. [A-Z]", teks[n].split(KEPALA)[-1].strip().splitlines()[0]) for n in nilai if n), "judul kelompok berada di awal halamannya")
        gbr = gambar_pdf(berkas)
        cek(sum(gbr.values()) == 5, f"kelima foto bukti tercetak di PDF ({gbr})")
        hal_kud = [n for n, t in teks_r.items() if "Kudapan perjalanan keberangkatan Rp" in t]
        cek(bool(hal_kud) and gbr.get(hal_kud[0], 0) >= 1 and "TEMPEL STRUK ASLI DI SINI" in teks_r[hal_kud[0]], f"struk kudapan dan fotonya di halaman yang sama ({hal_kud})")
        hal_rekap = [n for n, t in teks_r.items() if "Rekapitulasi Penggunaan Dana" in t]
        hal_periksa = [n for n, t in teks_r.items() if "DAFTAR PERIKSA KELENGKAPAN SPJ" in t]
        cek(bool(hal_rekap) and "RINGKASAN PENYELESAIAN DANA KEGIATAN" in teks_r[hal_rekap[0]] and "SISA DANA YANG HARUS DIKEMBALIKAN" in teks_r[hal_rekap[0]].upper(), f"rekapitulasi dan kartu ringkasan satu halaman ({hal_rekap})")
        cek(bool(hal_periksa) and hal_rekap[0] < hal_periksa[0] and all("Ketentuan" in teks_r[n] for n in range(hal_periksa[0], total + 1)), f"daftar periksa sesudah rekapitulasi sampai akhir dokumen (mulai halaman {hal_periksa}, total {total})")
    else:
        print("  (pdfinfo/pdftotext/pdfimages tidak ada: pemeriksaan PDF dilewati)")
    ctx.close()

    print("== Tanpa kegiatan terpilih: dokumen umum dengan Lembar Tempel Bukti")
    ctx, pg, galat = buka(b, 1280, init, kegiatan=False)
    tunggu_foto(pg)
    cek(pg.locator(".dlk").count() == 0 and pg.locator(".dsc-tabel").count() >= 5, "tabel per kategori (bukan susunan Word) bila tidak ada kegiatan yang dipilih")
    pilihan = pg.locator(".dsc-tempel-pilihan").inner_text()
    kotak_tempel = int(re.search(r"\((\d+) kotak, lampiran sekitar (\d+) halaman\)", pilihan).group(1))
    cek(kotak_tempel == 13, f"13 pengeluaran berkotak tempel (uang harian tidak) ({kotak_tempel})")
    varian = pg.evaluate("[...document.querySelectorAll('.dsc-kotak')].map(e => e.dataset.varian + ':' + e.dataset.ukuran)")
    cek({"terpadu:A", "terpadu:B", "terpadu:C", "ringkas:A", "ringkas:B", "ringkas:C"} <= set(varian), f"semua varian ada: {sorted(set(varian))}")
    terpadu_semua = pg.evaluate("[...document.querySelectorAll('.dsc-kotak--terpadu')].every(e => e.querySelector('.dsc-kotak__foto img') && e.querySelector('.dsc-kotak__area'))")
    cek(terpadu_semua, "tiap kartu terpadu memuat foto digital DAN area tempel dalam kotak yang sama")
    cek(pg.evaluate("document.querySelectorAll('.dsc-kotak--terpadu.dsc-kotak--A .dsc-kotak__foto img').length") == 2, "Tipe A terpadu: dua foto bukti di panel foto")
    cek(pg.locator("[data-testid=lembar-timesheet]").count() == 0 and pg.locator(".dsc-kop").count() == 1, "dokumen umum: tanpa timesheet, kop sekali")
    pg.locator(".dsc-tempel-pilihan input").uncheck()
    pg.wait_for_timeout(300)
    cek(pg.locator(".dsc-kotak__area").count() == 0 and pg.locator(".dsc-kotak--foto").count() == 4, f"kotak tempel dimatikan: hanya empat lembar foto ({pg.locator('.dsc-kotak--foto').count()})")
    cek(not galat, f"tanpa galat JS ({galat})")
    ctx.close()

    print("== Ukuran kotak tempel dokumen umum saat dicetak (milimeter sebenarnya)")
    ctx, pg, galat = buka(b, 794, init, kegiatan=False)
    pg.emulate_media(media="print")
    ukur = pg.evaluate("""() => Object.fromEntries(['ringkas','terpadu'].flatMap(v => ['A','B','C'].map(k => { const e = document.querySelector('.dsc-kotak--' + v + '.dsc-kotak--' + k); const r = e.getBoundingClientRect(); return [v + k, [r.width, r.height]]; })))""")
    for kunci_u, (w_mm, h_mm) in {"ringkasA": (92, 132), "ringkasB": (190, 88), "ringkasC": (190, 132), "terpaduA": (190, 132), "terpaduB": (190, 222), "terpaduC": (190, 246)}.items():
        w, h = ukur[kunci_u]
        cek(abs(w - w_mm * mm) < 3 and abs(h - h_mm * mm) < 3, f"{kunci_u}: {w / mm:.1f} × {h / mm:.1f} mm (target {w_mm} × {h_mm})")
    cek(pg.evaluate("[...document.querySelectorAll('.dsc-kotak')].every(e => getComputedStyle(e).breakInside === 'avoid')"), "setiap kotak tidak boleh terbelah antarhalaman")
    cek(pg.evaluate("getComputedStyle(document.querySelector('.dsc-tempel')).page") == "tempel", "lembar tempel memakai halaman bernama 'tempel' (A4 potret, margin 10 mm)")
    ctx.close()

    print("== Kartu ringkasan saldo: 4 kolom sebaris di PC, 2 × 2 di tablet, nominal sejajar")
    for lebar, kolom_target, baris_target in ((1280, 4, 1), (1024, 4, 1), (768, 2, 2)):
        ctx, pg, galat = buka(b, lebar, init)
        pg.locator("button.btn-small", has_text="Sepanjang Waktu").first.click()
        pg.wait_for_timeout(500)
        info = pg.evaluate("""() => { const g = document.querySelector('[data-testid=ringkasan-saldo]'); const k = [...g.children].map(c => c.getBoundingClientRect());
            const n = [...g.querySelectorAll('.ringkasan-saldo__nilai')]; const l = [...g.querySelectorAll('.ringkasan-saldo__label')];
            return { kolom: new Set(k.map(r => Math.round(r.x))).size, baris: new Set(k.map(r => Math.round(r.y))).size, tinggi: k.map(r => Math.round(r.height)),
                     nilaiBawah: n.map(e => Math.round(e.getBoundingClientRect().bottom)), labelAtas: l.map(e => Math.round(e.getBoundingClientRect().top)),
                     luap: n.some(e => e.scrollWidth > e.clientWidth + 1), baris1: n.every(e => e.getBoundingClientRect().height < parseFloat(getComputedStyle(e).fontSize) * 2),
                     kartuTinggi: k.map(r => Math.round(r.top)) }; }""")
        cek(info["kolom"] == kolom_target and info["baris"] == baris_target, f"{lebar}px: {info['kolom']} kolom × {info['baris']} baris (target {kolom_target} × {baris_target})")
        cek(max(info["tinggi"][:kolom_target]) - min(info["tinggi"][:kolom_target]) <= 3, f"{lebar}px: kartu sebaris sama tinggi ({info['tinggi']})")
        cek(not info["luap"] and info["baris1"], f"{lebar}px: nominal Rupiah tidak terpotong atau turun baris")
        for awal in range(0, 4, kolom_target):
            grup = info["nilaiBawah"][awal:awal + kolom_target]
            cek(max(grup) - min(grup) <= 3, f"{lebar}px: nominal sebaris sejajar di bagian bawah kartu ({grup})")
        cek(not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"), f"{lebar}px: tanpa luapan horizontal")
        ctx.close()

    for lebar in (390, 768, 1280):
        print(f"== Pratinjau dan bilah cetak di {lebar}px")
        ctx, pg, galat = buka(b, lebar, init, 1200)
        tunggu_foto(pg)
        luap = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        cek(not luap, "tanpa luapan horizontal")
        tb = pg.locator(".dsc-cetak-aksi").bounding_box()
        btn = [pg.locator(".dsc-cetak-aksi button").nth(i).bounding_box() for i in range(2)]
        cek(all(x["x"] >= tb["x"] - 1 and x["x"] + x["width"] <= tb["x"] + tb["width"] + 1 for x in btn), "tombol cetak berada di dalam bilah")
        if lebar < 640:
            cek(all(x["width"] > tb["width"] * 0.95 for x in btn), "HP: tombol cetak selebar layar, ditumpuk")
            cek(all(x["height"] >= 40 for x in btn), "HP: tinggi tombol cukup untuk jari")
        else:
            cek(btn[0]["y"] == btn[1]["y"] or abs(btn[0]["y"] - btn[1]["y"]) < 4, f"tablet/PC: tombol berjajar ({lebar}px)")
        skala = pg.evaluate("""() => [...document.querySelectorAll('.dlk-lembar')].map(l => { const r = l.getBoundingClientRect(); const c = getComputedStyle(l);
            const isi = [...l.querySelectorAll('.dlk-kotak, .dlk-tabel, .dlk-ringkasan, img')].map(e => e.getBoundingClientRect());
            return [r.width, r.height / r.width, parseFloat(c.paddingLeft) / r.width, isi.every(e => e.left >= r.left - 1 && e.right <= r.right + 1)]; })""")
        cek(all(x[1] >= 297 / 210 - 0.01 for x in skala), "tiap lembar pratinjau minimal setinggi A4 (rasio 297:210)")
        cek(all(abs(x[2] - 20 / 210) < 0.005 for x in skala), f"margin pratinjau 20 mm sesuai skala kertas ({skala[0][2] * 210:.1f} mm)")
        cek(all(x[3] for x in skala), "kotak, tabel, ringkasan, dan foto berada di dalam kertas pratinjau")
        cek(not [g for g in galat], f"tanpa galat JS ({galat})")
        ctx.close()

    b.close()
shutil.rmtree(folder, ignore_errors=True)

if gagal:
    print(f"\n{len(gagal)} uji gagal")
    sys.exit(1)
print("\nSemua uji lolos")
