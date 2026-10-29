"""
Uji dokumen siap cetak (satu dokumen terpadu): pengeluaran pra-kegiatan ikut masuk, satu tombol cetak, timesheet lanskap di depan
lalu halaman potret berpasangan (tabel kategori, lalu foto nota dan kotak tempelnya), rekapitulasi di akhir, kop sekali,
kelengkapan "Diklaim untuk" per kategori, tabel yang mengalir penuh halaman (tanpa ruang kosong berlebih), Lembar Tempel Bukti
(kotak Tipe A/B/C), dan tampilan di HP/tablet/PC. Orientasi dan isi tiap halaman diperiksa dari PDF yang dihasilkan peramban
(butuh pdfinfo dan pdftotext).

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
ADA_PDF_ALAT = bool(shutil.which("pdfinfo") and shutil.which("pdftotext"))

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
                                 "penerimaManfaat": ["Nopal", "Budi"]}))
    t.append(trx("pra2", "2026-09-19", "Belanja logistik awal", "Pengadaan Barang & Perlengkapan", 620000, detailKegiatan={"jenisBukti": "Invoice + kuitansi"}))
    t.append(trx("kud1", "2026-09-19", "Kudapan perjalanan keberangkatan", "Konsumsi", 200000,
                 detailKegiatan={"jenisBukti": "Struk thermal (minimarket/SPBU)", "konsumsi": {"kudapanPerjalanan": True},
                                 "penerimaManfaat": ["Nopal", "Budi", "Andi"]}))
    t.append(trx("sb1", "2026-09-20", "Transportasi Speedboat", "Transportasi", 900000,
                 detailKegiatan={"jenisBukti": "Tiket", "transportasi": {"dari": "Tarakan", "ke": "Malinau", "moda": "Speedboat / Kapal"},
                                 "penerimaManfaat": ["Nopal", "Budi", "Andi"]}))
    t.append(trx("ak1", "2026-09-21", "Penginapan Pak Kades", "Akomodasi", 450000,
                 detailKegiatan={"jenisBukti": "Kuitansi", "akomodasi": {"lokasi": "Rumah Pak Kades", "jumlahMalam": 1}, "penerimaManfaat": ["Nopal", "Budi"]}))
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


def buka(b, lebar, init, tinggi=1000):
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
    pg.select_option("#lap-kegiatan-select", KID)
    pg.wait_for_timeout(900)
    return ctx, pg, galat


init = data_uji()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    folder = pathlib.Path(tempfile.mkdtemp(prefix="uji-cetak-"))

    print("== Pengeluaran pra-kegiatan ikut dalam laporan")
    ctx, pg, galat = buka(b, 1280, init)
    info = pg.locator("[data-testid=info-pra-kegiatan]")
    cek(info.count() == 1 and "pra-kegiatan" in info.inner_text() and "18 September 2026" in info.inner_text(), f"catatan pra-kegiatan tampil ({info.inner_text()[:90] if info.count() else '-'!r})")
    doc = pg.locator(".dokumen-siap-cetak").inner_text()
    cek("Tiket pesawat keberangkatan" in doc and "18/09/2026" in doc, "tiket keberangkatan (18 Sep) ada di dokumen")
    cek("Belanja logistik awal" in doc and "Kudapan perjalanan keberangkatan" in doc, "belanja awal dan kudapan keberangkatan (19 Sep) ada di dokumen")
    nomor = pg.evaluate("[...document.querySelectorAll('.dsc-tabel tbody tr')].map(r => r.cells[1].innerText)")
    cek(nomor[:2] == ["19/09/2026", "18/09/2026"] or "18/09/2026" in nomor, "tanggal pra-kegiatan tampil per kategori")
    pg.locator("button.btn-small", has_text="Sepanjang Waktu").first.click()
    pg.wait_for_timeout(500)
    pg.select_option("#lap-kegiatan-select", KID)
    pg.wait_for_timeout(500)
    kop = pg.locator(".laporan-kop__data").inner_text()
    cek("18 September" in kop and "pra-kegiatan" in kop, "kop laporan menyebut periode sejak pengeluaran pra-kegiatan")

    print("== Kata dan istilah baku di pratinjau")
    isi = pg.locator("#view-saya").inner_text()
    cek("Kudapan/Snack Perjalanan — Penerima Manfaat: 3 orang (Nopal, Budi, Andi @ Rp66.667)" in doc, "kudapan: 3 orang (nama @ Rp66.667)")
    cek("Diklaim untuk: Budi Santoso, Nopal, Budi, Andi" in doc, "speedboat: 'Diklaim untuk' pelapor lalu rekan di bawah uraian")
    cek("Diklaim untuk: Budi Santoso" in doc and "Penerima Manfaat: Nopal, Budi, Andi" not in doc, "kategori berpenerima memakai 'Diklaim untuk', bukan 'Penerima Manfaat:'")
    cek("Uang Harian (Per Diem) Kegiatan Lapangan" in doc and "Perdiem" not in doc, "uang harian tanpa ejaan 'Perdiem' di dokumen")
    cek(re.search(r"kwitansi|staff", isi, re.I) is None, "tanpa 'kwitansi' atau 'staff'")
    cek("Dokumen Laporan Siap Cetak" in isi and "Rekapitulasi Klaim" in doc, "Dokumen Laporan Siap Cetak dan Rekapitulasi Klaim")

    print("== Kelengkapan per kategori di tabel dan kepala kotak")
    cek("Rute: Jakarta – Tarakan" in doc and "Moda: Pesawat" in doc and "Kelengkapan: e-ticket dan boarding pass" in doc, "Transportasi: rute, moda, kelengkapan e-ticket dan boarding pass")
    cek("Rute: Tarakan – Malinau" in doc and "Kelengkapan: tiket" in doc, "Transportasi speedboat: rute dan kelengkapan tiket")
    cek("Penginapan: Rumah Pak Kades" in doc and "1 malam" in doc and "KTP pemilik" in doc, "Akomodasi: nama penginapan, malam, KTP pemilik")
    cek("Peserta: 15 orang" in doc, "Konsumsi: jumlah peserta")
    cek("Metode: Tunai" in doc and "Metode: Transfer" in doc, "metode pembayaran tampil di tabel (Tunai, Transfer)")
    cek(doc.count(JUDUL[:40]) <= 3, f"judul kegiatan tidak diulang di tiap baris atau kategori ({doc.count(JUDUL[:40])}x)")
    cek("Penerimaan Dana Kegiatan" in doc and f"Penerimaan Dana {JUDUL[:30]}" not in doc, "penerimaan dana (uraian lama berjudul kegiatan): ditampilkan 'Penerimaan Dana Kegiatan' tanpa judul")

    print("== Lembar tempel: jumlah kotak dan varian")
    pilihan = pg.locator(".dsc-tempel-pilihan").inner_text()
    kotak_tempel = int(re.search(r"\((\d+) kotak, lampiran sekitar (\d+) halaman\)", pilihan).group(1))
    halaman_tempel = int(re.search(r"lampiran sekitar (\d+) halaman", pilihan).group(1))
    cek(kotak_tempel == 13, f"13 pengeluaran berkotak tempel (uang harian tidak) ({kotak_tempel})")
    cek(halaman_tempel >= 7, f"perkiraan lampiran: {halaman_tempel} halaman")
    varian = pg.evaluate("[...document.querySelectorAll('.dsc-kotak')].map(e => e.dataset.varian + ':' + e.dataset.ukuran)")
    cek({"terpadu:A", "terpadu:B", "terpadu:C", "ringkas:A", "ringkas:B", "ringkas:C"} <= set(varian), f"semua varian ada: {sorted(set(varian))}")
    terpadu_semua = pg.evaluate("[...document.querySelectorAll('.dsc-kotak--terpadu')].every(e => e.querySelector('.dsc-kotak__foto img') && e.querySelector('.dsc-kotak__area'))")
    cek(terpadu_semua, "tiap kartu terpadu memuat foto digital DAN area tempel dalam kotak yang sama")
    cek(pg.evaluate("document.querySelectorAll('.dsc-kotak--terpadu.dsc-kotak--A .dsc-kotak__foto img').length") == 2, "Tipe A terpadu: dua foto bukti di panel foto")

    print("== Satu dokumen terpadu: satu tombol cetak, tanpa kop ganda, urutan halaman")
    cek(pg.get_by_role("button", name=re.compile("Simpan PDF")).count() == 1, "satu tombol cetak: Cetak / Simpan PDF")
    cek(pg.get_by_role("button", name=re.compile("Cetak Semua|Cetak Khusus|Cetak Dokumen Klaim")).count() == 0, "tombol cetak terpisah (Semua, Khusus Timesheet, Klaim & Nota) sudah tidak ada")
    cek(pg.locator(".dsc-cetak-aksi").get_by_role("button", name=re.compile("Unduh Laporan Word")).count() == 1 and pg.locator(".dsc-cetak-aksi button").count() == 2, "tombol Unduh Word berada di bilah dokumen yang sama (dua tombol)")
    cek(pg.locator("#lap-kaitan").count() == 0 and "Kaitan Kegiatan / Sumber" not in isi, "filter Kaitan Kegiatan / Sumber sudah dihapus")
    cek(pg.locator(".dsc-kop").count() == 1, f"kop dokumen hanya sekali di pratinjau ({pg.locator('.dsc-kop').count()})")
    catatan = pg.locator("[data-testid=catatan-spj-fisik]")
    cek(catatan.count() == 1 and "SPJ fisik diserahkan maksimal 14 hari" in catatan.inner_text() and "Batas Penyerahan" not in isi, "satu catatan kecil SPJ fisik di aplikasi, tanpa kotak batas penyerahan")
    urutan = pg.evaluate("""[...document.querySelectorAll('.dsc-daftar-lembar > *')].map(e => e.classList.contains('dsc-lanskap-gulir') ? 'timesheet' : e.classList.contains('dsc-penutup') ? 'penutup' : e.classList.contains('dsc-tempel') ? 'bukti' : e.dataset.kelompok ? e.dataset.kelompok : null).filter(Boolean)""")
    cek(urutan[0] == "timesheet" and urutan[-1] == "penutup", f"urutan: timesheet di depan, rekapitulasi di akhir ({urutan})")
    pasangan = all(urutan[i + 1] == "bukti" for i, x in enumerate(urutan) if x.startswith("kategori:") and x != "kategori:Perdiem")
    cek(pasangan and urutan.count("bukti") >= 5, f"tiap kategori langsung diikuti lampiran buktinya ({urutan})")
    cek("pemasukan" in urutan and urutan[urutan.index("pemasukan") + 1].startswith("kategori:"), "penerimaan dana: tabel tanpa lampiran, lalu kategori pertama")
    cek(pg.evaluate("document.querySelector('.dsc-kop').closest('article').dataset.kelompok") == "pemasukan", "kop hanya di tabel pertama (Penerimaan Dana)")
    for kolom_judul in pg.evaluate("[...document.querySelectorAll('.dsc-tabel tbody tr')].map(r => r.cells[2].innerText)"):
        if JUDUL[:40] in kolom_judul:
            cek(False, "baris tabel mengulang judul kegiatan: " + kolom_judul[:60])
            break
    else:
        cek(True, "baris tabel tidak mengulang judul kegiatan (tanpa baris kaitan)")

    pg.get_by_role("button", name=re.compile("Simpan PDF")).click()
    pg.wait_for_timeout(300)
    cek(pg.evaluate("document.documentElement.dataset.modeCetak") is None and pg.evaluate("window.__cetak") == 1, "satu klik memanggil window.print() sekali, tanpa mode cetak")
    pg.emulate_media(media="print")
    berkas = folder / "dokumen.pdf"
    pg.pdf(path=str(berkas), prefer_css_page_size=True, print_background=True)
    kop_cetak = pg.evaluate("[...document.querySelectorAll('.laporan-kop, .ringkasan-saldo, .catatan-spj-fisik')].every(e => getComputedStyle(e).display === 'none')")
    pg.emulate_media(media="screen")
    cek(kop_cetak, "kop layar, kartu saldo, dan catatan SPJ fisik tidak ikut tercetak")
    cek(not galat, f"tanpa galat JS ({galat})")

    if ADA_PDF_ALAT:
        print("== PDF: orientasi halaman dan urutan")
        halaman = halaman_pdf(berkas)
        ori = "".join(x[1] for x in halaman)
        cek(re.fullmatch(r"L+P+", ori) is not None, f"lanskap (timesheet) di depan, lalu semua halaman potret ({ori})")
        lanskap = [x for x in halaman if x[1] == "L"]
        potret = [x for x in halaman if x[1] == "P"]
        teks_l = "\n".join(teks_halaman(berkas, x[0]) for x in lanskap)
        teks_p_per = {x[0]: teks_halaman(berkas, x[0]) for x in potret}
        teks_p = "\n".join(teks_p_per.values())
        cek("Uang Harian (Per Diem) Kegiatan Lapangan" in teks_l and "Pendampingan pemetaan" in teks_l, "halaman lanskap berisi timesheet uang harian")
        cek("LAPORAN PENGGUNAAN DANA" not in teks_l and "Rekapitulasi" not in teks_l and "Area Tempel" not in teks_l and "Detail Keuangan" not in teks_p, "halaman lanskap hanya timesheet; halaman potret tanpa timesheet")
        cek("Dokumen Laporan Pertanggungjawaban" not in teks_p and "Rincian Pengeluaran per Kategori" not in teks_p, "kop dan ringkasan khusus layar tidak tercetak")
        cek(teks_p.count("LAPORAN PENGGUNAAN DANA") == 1, f"kop dokumen (judul laporan) hanya sekali ({teks_p.count('LAPORAN PENGGUNAAN DANA')}x)")
        judul_p = re.sub(r"\s+", " ", JUDUL)[:40]
        dgn_judul = [n for n, t in teks_p_per.items() if judul_p in re.sub(r"\s+", " ", t)]
        cek(1 <= len(dgn_judul) <= 2, f"judul kegiatan hanya di kop dan rekapitulasi, tidak di tiap kategori (halaman {dgn_judul})")

        print("== PDF: timesheet mengisi halaman lanskap, kepala berulang, Total dan tanda tangan sekali di akhir")
        cek(3 <= len(lanskap) <= 4, f"35 hari uang harian memenuhi 3-4 halaman lanskap ({len(lanskap)})")
        for x in lanskap[:-1]:
            bawah = ujung_bawah(berkas, x[0], x[3])
            cek(bawah > 0.82, f"timesheet halaman {x[0]}: baris mengisi sampai dekat tepi bawah kertas ({bawah:.0%})")
        kepala_ts = [("Keterangan" in teks_halaman(berkas, x[0]) and "Lokasi" in teks_halaman(berkas, x[0])) for x in lanskap]
        cek(all(kepala_ts), "kepala tabel (No, Tanggal, Keterangan, Lokasi, Jumlah) berulang di tiap halaman")
        cek(teks_l.count("Dilaporkan Oleh") == 1 and teks_l.count("Disetujui Oleh") == 1, "tanda tangan hanya sekali")
        cek(len(re.findall(r"^\s*Total\b", teks_l, re.M)) == 1 and "Total" not in "".join(teks_halaman(berkas, x[0]) for x in lanskap[:-1]), "baris Total hanya di halaman terakhir")
        cek("7.000.000" in teks_halaman(berkas, lanskap[-1][0]), "total Rp7.000.000 (35 × 200.000) di halaman terakhir")
        akhir = teks_halaman(berkas, lanskap[-1][0])
        cek(akhir.index("Total") < akhir.index("Dilaporkan Oleh"), "tanda tangan tepat di bawah baris Total")
        cek("Penerimaan Dana (Dana Awal Kegiatan)" in teks_halaman(berkas, potret[0][0]), "halaman potret pertama: kop lalu tabel Penerimaan Dana")
        pra = [n for n, t in teks_p_per.items() if "Tiket pesawat keberangkatan" in t]
        cek(bool(pra) and pra[0] <= potret[0][0] + 1, f"tiket pra-kegiatan tercetak di laporan (halaman {pra})")

        print("== PDF: tiap kategori diikuti foto nota dan kotak tempelnya")
        idx_tempel = [n for n, t in teks_p_per.items() if "Area Tempel Bukti" in t]
        idx_rekap = [n for n, t in teks_p_per.items() if "Rekapitulasi Klaim" in t]
        cek(len(idx_tempel) == halaman_tempel, f"lampiran tepat {halaman_tempel} halaman seperti perkiraan ({idx_tempel})")
        cek(bool(idx_rekap) and idx_rekap[0] > idx_tempel[-1], f"rekapitulasi klaim sesudah semua lampiran (halaman {idx_rekap} setelah {idx_tempel[-1] if idx_tempel else None})")
        urut_ok = []
        for label in ("Transportasi", "Akomodasi", "Konsumsi", "Pengadaan Barang & Perlengkapan"):
            tabel = [n for n, t in teks_p_per.items() if f"Jumlah {label}" in t]
            bukti = [n for n, t in teks_p_per.items() if re.search(rf"\| {re.escape(label)} - ", re.sub(r"\s+", " ", t))]
            urut_ok.append((label, tabel[0] if tabel else None, bukti[0] if bukti else None))
        titik = [x for _, a, bk in urut_ok for x in (a, bk)]
        cek(all(x is not None for x in titik) and titik == sorted(titik) and len(set(titik)) == len(titik), f"urutan halaman: tabel kategori lalu bukti kategori itu, berulang ({urut_ok})")
        semua_tempel = "".join(teks_p_per[n] for n in idx_tempel)
        label_foto = [n for n, t in teks_p_per.items() if "Foto bukti digital" in t]
        cek(bool(label_foto) and all("Area Tempel Bukti" in teks_p_per[n] for n in label_foto), f"foto digital dan kotak tempel di halaman yang sama (halaman {label_foto})")
        per_kartu = [re.sub(r"\s+", " ", teks_p_per[n]) for n in label_foto]
        nomor_foto = sorted(set(int(m) for t_ in per_kartu for m in re.findall(r"No\. (\d+) \|", t_)))
        cek({1, 4, 5, 7} <= set(nomor_foto), f"keempat pengeluaran berfoto (No. 1, 4, 5, 7) muncul di halaman berfoto ({nomor_foto})")
        for nomor_kartu, label in ((1, "Foto bukti digital"), (2, None), (7, "Foto bukti digital")):
            halaman_kartu = [n for n in idx_tempel if re.search(rf"No\. {nomor_kartu} \|", re.sub(r"\s+", " ", teks_p_per[n]))]
            teks_k = re.sub(r"\s+", " ", teks_p_per[halaman_kartu[0]]) if halaman_kartu else ""
            cek(bool(halaman_kartu) and "Area Tempel Bukti" in teks_k and (label is None or label in teks_k), f"kartu No. {nomor_kartu}: kepala, {'foto, ' if label else ''}area tempel dalam satu halaman ({halaman_kartu})")
        cek("Tipe A – Struk Ritel / Vertikal" in semua_tempel and "Tipe B – Kuitansi & Tiket Lebar" in semua_tempel and "Tipe C – Kuitansi Besar / Faktur Setengah Halaman" in semua_tempel, "ketiga ukuran kotak muncul dengan namanya")
        ringkas = re.sub(r"\s+", " ", semua_tempel)
        cek("No. 1 | 18/09/2026 | Transportasi - Tiket pesawat keberangkatan | Rp" in ringkas, "kepala kotak: No | Tanggal | Kategori - Uraian | Rp")
        cek("Diklaim untuk: Budi Santoso, Nopal, Budi" in ringkas and "Rute: Jakarta – Tarakan" in ringkas and "Kelengkapan: e-ticket dan boarding pass" in ringkas, "kepala kotak: Diklaim untuk dan kelengkapan kategori (rute, moda, e-ticket)")
    else:
        print("  (pdfinfo/pdftotext tidak ada: pemeriksaan PDF dilewati)")
    ctx.close()

    print("== Ukuran kotak tempel saat dicetak (milimeter sebenarnya)")
    ctx, pg, galat = buka(b, 794, init)
    pg.emulate_media(media="print")
    mm = 96 / 25.4
    ukur = pg.evaluate("""() => Object.fromEntries(['ringkas','terpadu'].flatMap(v => ['A','B','C'].map(k => { const e = document.querySelector('.dsc-kotak--' + v + '.dsc-kotak--' + k); const r = e.getBoundingClientRect(); return [v + k, [r.width, r.height]]; })))""")
    for kunci_u, (w_mm, h_mm) in {"ringkasA": (92, 132), "ringkasB": (190, 88), "ringkasC": (190, 132), "terpaduA": (190, 132), "terpaduB": (190, 222), "terpaduC": (190, 246)}.items():
        w, h = ukur[kunci_u]
        cek(abs(w - w_mm * mm) < 3 and abs(h - h_mm * mm) < 3, f"{kunci_u}: {w / mm:.1f} × {h / mm:.1f} mm (target {w_mm} × {h_mm})")
    panel = pg.evaluate("""() => { const a = document.querySelector('.dsc-kotak--terpadu.dsc-kotak--A'); const f = a.querySelector('.dsc-kotak__foto').getBoundingClientRect(); const t = a.querySelector('.dsc-kotak__area').getBoundingClientRect();
        return [f.width, f.height, t.width, t.height, f.right <= t.left + 1, Math.abs(f.top - t.top) < 2]; }""")
    cek(abs(panel[0] - 92 * mm) < 3 and abs(panel[2] - 92 * mm) < 3 and panel[4] and panel[5], f"Tipe A terpadu: foto (kiri) dan area tempel (kanan) berdampingan, masing-masing 92 mm ({panel[0] / mm:.0f}, {panel[2] / mm:.0f} mm)")
    atasbawah = pg.evaluate("""() => { const a = document.querySelector('.dsc-kotak--terpadu.dsc-kotak--B'); const f = a.querySelector('.dsc-kotak__foto').getBoundingClientRect(); const t = a.querySelector('.dsc-kotak__area').getBoundingClientRect();
        return [f.bottom <= t.top + 1, f.width, t.width]; }""")
    cek(atasbawah[0] and abs(atasbawah[1] - 190 * mm) < 4 and abs(atasbawah[2] - 190 * mm) < 4, "Tipe B terpadu: foto di atas, area tempel di bawah, keduanya selebar kotak")
    kepala = pg.evaluate("(() => { const e = document.querySelector('.dsc-kotak__kepala'); const c = getComputedStyle(e); return [e.getBoundingClientRect().height, c.fontSize, c.lineHeight, c.backgroundColor, c.borderBottomWidth, c.borderBottomColor]; })()")
    cek(12 * mm - 1 <= kepala[0] <= 32 * mm + 1, f"kepala kotak 12-32 mm menurut isinya ({kepala[0] / mm:.1f} mm)")
    cek(abs(float(kepala[1][:-2]) - 3 * mm) < 0.6 and kepala[3] == "rgb(248, 250, 252)" and kepala[4] == "1px", f"kepala kotak: huruf 8,5 pt, latar #f8fafc, garis bawah 1px ({kepala[1]}, {kepala[3]})")
    area = pg.evaluate("(() => { const e = document.querySelector('.dsc-kotak__area'); const c = getComputedStyle(e); const s = getComputedStyle(e.querySelector('span')); return [c.borderTopStyle, c.borderTopWidth, c.borderTopColor, s.fontSize, s.color]; })()")
    cek(area[0] == "dashed" and area[1] == "1px" and area[2] == "rgb(100, 116, 139)", f"area tempel: garis putus-putus 1px #64748b ({area[:3]})")
    cek(abs(float(area[3][:-2]) - 8 * 96 / 72) < 0.6 and area[4] == "rgb(148, 163, 184)", f"teks penanda 8 pt, #94a3b8 ({area[3]}, {area[4]})")
    cek(pg.evaluate("[...document.querySelectorAll('.dsc-kotak')].every(e => getComputedStyle(e).breakInside === 'avoid')"), "setiap kotak tidak boleh terbelah antarhalaman")
    kisi = pg.evaluate("(() => { const c = getComputedStyle(document.querySelector('.dsc-tempel__kisi')); return [c.gridTemplateColumns, c.justifyContent, c.rowGap]; })()")
    cek(kisi[1] == "space-between" and kisi[0].count("px") == 2, f"kisi 2 kolom, space-between ({kisi})")
    cek(pg.evaluate("getComputedStyle(document.querySelector('.dsc-tempel')).page") == "tempel", "lembar tempel memakai halaman bernama 'tempel' (A4 potret, margin 10 mm)")
    ctx.close()

    print("== Kotak tempel dimatikan: hanya lembar foto bukti")
    ctx, pg, galat = buka(b, 1280, init)
    pg.locator(".dsc-tempel-pilihan input").uncheck()
    pg.wait_for_timeout(300)
    cek(pg.locator(".dsc-kotak__area").count() == 0, "area tempel hilang dari pratinjau")
    cek(pg.locator(".dsc-kotak--foto").count() == 4, f"empat pengeluaran berfoto tetap tampil sebagai lembar foto ({pg.locator('.dsc-kotak--foto').count()})")
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
        kisi = pg.evaluate("(() => { const k = document.querySelector('.dsc-tempel__kertas').getBoundingClientRect(); const a = [...document.querySelectorAll('.dsc-kotak')].map(e => e.getBoundingClientRect()); return [k.left, k.right, Math.min(...a.map(r => r.left)), Math.max(...a.map(r => r.right))]; })()")
        cek(kisi[2] >= kisi[0] - 1 and kisi[3] <= kisi[1] + 1, "kotak tempel di dalam kertas pratinjau (skala mengikuti lebar layar)")
        cek(not [g for g in galat], f"tanpa galat JS ({galat})")
        ctx.close()

    b.close()
shutil.rmtree(folder, ignore_errors=True)

if gagal:
    print(f"\n{len(gagal)} uji gagal")
    sys.exit(1)
print("\nSemua uji lolos")
