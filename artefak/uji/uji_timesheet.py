"""
Uji fitur timesheet perdiem di build artefak dengan Google Drive/Sheets palsu (tiruan-konektor.js).

Pakai:
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8767 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_timesheet.py http://127.0.0.1:8767/ [/opt/pw-browsers/chromium]

Data uji meniru file nyata "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4 (SEPTEMBER - OKTOBER 2026)": 34 hari (20 Sep - 23 Okt),
tab "Timesheet Batch 4", tanggal 1-12 Oktober yang tampil "10/1/2026" (tanggal sungguhan berformat hari/bulan di aslinya).
"""
import json
import pathlib
import re
import sys
import zipfile
import tempfile

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8767/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


JUDUL = "Kegiatan Fasilitasi Penyelesaian Klaim Wilayah Adat dan Koordinasi Multipihak di Kalimantan Utara (Batch 4)"
NAMA_TS4 = "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4 (SEPTEMBER - OKTOBER 2026)"


def hari(i):
    """Hari ke-i (0 = 20 Sep 2026) sebagai (ISO, tampilan M/D/YYYY)."""
    import datetime

    d = datetime.date(2026, 9, 20) + datetime.timedelta(days=i)
    return d.isoformat(), f"{d.month}/{d.day}/{d.year}"


def baris_timesheet():
    rows = [[], ["", "", "Detail Keuangan"], ["", "", "Perdiem Kegiatan Lapangan"], [],
            ["Proyek", ": Kayan-Mentarang"], ["Judul Kegiatan", ": " + JUDUL], ["Nama", ": Adrila Nopal Prastian Zalukhu"],
            ["Bulan", ": September - Oktober 2026"], [], ["No", "Tanggal", "Keterangan", "Lokasi", "Jumlah (Rp.)"]]
    for i in range(34):
        iso, tampil = hari(i)
        rows.append([str(i + 1), tampil, f"Kegiatan lapangan hari ke-{i + 1}, bersama warga", f"Desa Contoh {i % 5 + 1}", "200.000"])
    rows.append(["", "", "Total", "", "6.800.000"])
    rows.append([])
    rows.append(["", "Dilaporkan Oleh :", "", "Disetujui Oleh :"])
    rows += [[], [], []]
    rows.append(["", "Adrila Nopal Prastian Zalukhu", "", "Alvina Nur Lailia"])
    return rows


def transaksi_seed():
    t = [{"id": "dana1", "jenis": "pemasukan", "dana": "Dana Kegiatan", "tanggal": "2026-09-19", "deskripsi": "Penerimaan Dana Awal Kegiatan",
          "kategori": "Penerimaan Dana", "jumlah": 26370000, "metode": "Transfer", "kaitan": "", "catatan": ""}]
    for i in range(34):
        iso, _ = hari(i)
        t.append({"id": f"pd{i}", "jenis": "pengeluaran", "dana": "Dana Kegiatan", "tanggal": iso, "deskripsi": f"Perdiem Kalimantan · {iso}",
                  "kategori": "Perdiem", "jumlah": 200000, "metode": "Tunai", "kaitan": JUDUL, "catatan": "", "kegiatanId": "kg4"})
    return t


KEGIATAN_SEED = [{"id": "kg4", "nama": JUDUL, "lokasi": "Krayan", "tanggalMulai": "2026-09-20", "tanggalSelesai": "2026-10-23"}]

INIT_DRIVE = """
(() => {
  const D = window.__drive;
  D.mulai();
  const rows = %s;
  D.tambahFile({ id: 'TS4', title: %s, mimeType: 'application/vnd.google-apps.spreadsheet', parentId: 'F1', modifiedTime: '2026-10-24T11:22:44.066Z' });
  D.sheets.set('TS4', { tabs: [{ sheetId: 111, title: 'Timesheet Batch 4', rows }] });
  if (!localStorage.getItem('__s')) {
    localStorage.setItem('__s', '1');
    localStorage.setItem('keuangan-tema', 'jujutsu');
    localStorage.setItem('pengeluaran-harian', JSON.stringify(%s));
    localStorage.setItem('keuangan-daftar-kegiatan', JSON.stringify(%s));
  }
})();
""" % (json.dumps(baris_timesheet()), json.dumps(NAMA_TS4), json.dumps(transaksi_seed()), json.dumps(KEGIATAN_SEED))


def buka(p, lebar=420):
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    ctx = b.new_context(viewport={"width": lebar, "height": 900}, service_workers="block", accept_downloads=True, is_mobile=lebar < 640, has_touch=lebar < 640)
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and galat.append("CONSOLE " + m.text[:300]))
    pg.add_init_script(TIRUAN)
    pg.add_init_script(INIT_DRIVE)
    pg.goto(BASE)
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(500)
    return b, pg, galat


def nav(pg, nama):
    if nama == "Tambah":
        pg.locator(".navbar button").nth(2).click()
    else:
        pg.locator(".navbar button", has_text=nama).first.click()
    pg.wait_for_timeout(400)


def panggilan(pg, tool=None, sheet=None):
    cs = pg.evaluate("window.__drive.calls")
    return [c for c in cs if (tool is None or c["tool"] == tool) and (sheet is None or c["input"].get("spreadsheetId") == sheet)]


def hubungkan(pg):
    nav(pg, "Saya")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.get_by_text("Konektor Google Drive aktif").first.wait_for(timeout=10000)
    pg.wait_for_function("window.__drive.calls.filter(c => c.tool === 'get_values' && /B6:L$/.test(c.input.range)).length >= 2", timeout=30000)
    pg.wait_for_timeout(1500)


def kegiatan_lokal(pg):
    return json.loads(pg.evaluate("localStorage.getItem('keuangan-daftar-kegiatan')") or "[]")


def snapshot_ts4(pg):
    return pg.evaluate("JSON.stringify(window.__drive.sheets.get('TS4').tabs[0].rows)")


def buka_laporan(pg, id_kegiatan="kg4"):
    nav(pg, "Grafik")
    pg.get_by_role("tab", name="Laporan Dana Kegiatan").click()
    pg.wait_for_timeout(500)
    pg.select_option("#lap-kegiatan-select", id_kegiatan)
    pg.wait_for_timeout(500)


with sync_playwright() as p:
    print("1. Tarik data: file timesheet dibaca, bukan dianggap sheet Keuangan Kegiatan")
    b, pg, galat = buka(p)
    awal_ts4 = snapshot_ts4(pg)
    hubungkan(pg)
    kg = kegiatan_lokal(pg)[0]
    cek(kg.get("timesheetId") == "TS4", f"kegiatan terhubung ke file timesheet ({kg.get('timesheetId')})")
    cek(kg.get("timesheetNama") == NAMA_TS4, "nama file tersimpan")
    cek(len(kg.get("timesheetBaris", [])) == 34, f"34 hari berisi keterangan tersalin ({len(kg.get('timesheetBaris', []))})")
    tb = {x["tanggal"]: x for x in kg.get("timesheetBaris", [])}
    cek("2026-10-01" in tb and "2026-10-12" in tb and "2026-09-20" in tb, "tanggal 1 Okt dan 12 Okt dibaca sebagai Oktober (bukan Januari)")
    cek(tb.get("2026-09-20", {}).get("lokasi") == "Desa Contoh 1", "lokasi per tanggal terbaca")
    cek(kg.get("batch") == 4, f"batch 4 terbaca dari nama file ({kg.get('batch')})")
    trx = json.loads(pg.evaluate("localStorage.getItem('pengeluaran-harian')"))
    # 35 transaksi awal + 3 baris dari sheet Pribadi/Kegiatan palsu; isi file timesheet tidak boleh ikut jadi transaksi.
    cek(len(trx) == 38 and not any("hari ke-" in (t.get("deskripsi") or "") for t in trx), f"file timesheet tidak dibaca sebagai sheet Keuangan ({len(trx)} transaksi)")
    ts4_dibaca = panggilan(pg, "get_values", "TS4")
    cek(len(ts4_dibaca) == 1 and "A1:G" in ts4_dibaca[0]["input"]["range"], "file timesheet hanya dibaca sekali (A1:G…), bukan B6:L")
    cek(not panggilan(pg, "update_values", "TS4") and not panggilan(pg, "batch_clear_values", "TS4"), "tidak ada tulis ke file timesheet pengguna")
    cek(snapshot_ts4(pg) == awal_ts4, "isi file timesheet pengguna tidak berubah")
    cek(not [c for c in panggilan(pg, "copy_file")], "tidak membuat salinan apa pun saat hanya menarik")

    print("2. Kartu Timesheet dan lembar daftar perdiem di Laporan")
    buka_laporan(pg)
    kartu = pg.locator("[data-testid=kartu-timesheet]")
    cek(kartu.count() == 1, "kartu Timesheet Perdiem tampil")
    ktxt = kartu.inner_text()
    cek("34 dari 34 hari perdiem" in ktxt, "ringkasan: 34 dari 34 hari sudah ada keterangan")
    cek(NAMA_TS4 in ktxt, "nama file terhubung tampil")
    pg.locator("button.btn-small", has_text="Sepanjang Waktu").first.click()
    pg.wait_for_timeout(900)
    lembar = pg.locator("[data-testid=lembar-timesheet]")
    cek(lembar.count() == 1, "ada satu lembar daftar perdiem berformat timesheet")
    teks = re.sub(r"\s+", " ", lembar.inner_text())
    cek("Detail Keuangan" in teks and "Perdiem Kegiatan Lapangan" in teks, "kop 'Detail Keuangan / Perdiem Kegiatan Lapangan'")
    cek(": Kayan-Mentarang" in teks and ": September - Oktober 2026" in teks and "Adrila Nopal Prastian Zalukhu" in teks, "Proyek, Nama, Bulan")
    cek(JUDUL in teks, "Judul Kegiatan")
    cek(pg.locator("[data-testid=lembar-timesheet] .dsc-ts__baris[role=row]").count() == 34 + 2, "34 baris data + kepala + total")
    cek("9/20/2026" in teks and "10/1/2026" in teks and "10/23/2026" in teks, "tanggal bergaya M/D/YYYY seperti file")
    cek("Kegiatan lapangan hari ke-12, bersama warga" in teks and "Desa Contoh 2" in teks, "Keterangan dan Lokasi dari timesheet tampil")
    cek("Total 6.800.000" in teks, "Total 6.800.000")
    cek("Dilaporkan Oleh :" in teks and "Disetujui Oleh :" in teks and "Alvina Nur Lailia" in teks, "kolom tanda tangan")
    lebar_halaman = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    cek(not lebar_halaman, "tanpa overflow horizontal di HP")

    print("3. Word memakai format yang sama")
    with pg.expect_download(timeout=60000) as d:
        pg.get_by_role("button", name="Unduh Laporan Word").click()
    out = pathlib.Path(tempfile.gettempdir()) / "uji-timesheet.docx"
    d.value.save_as(str(out))
    xml = zipfile.ZipFile(out).read("word/document.xml").decode("utf-8")
    tw = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", xml))
    cek("Detail Keuangan" in tw and "Perdiem Kegiatan Lapangan" in tw, "Word: kop timesheet")
    cek("Kegiatan lapangan hari ke-12, bersama warga" in tw and "Desa Contoh 2" in tw, "Word: Keterangan dan Lokasi")
    cek("10/1/2026" in tw and "9/20/2026" in tw, "Word: tanggal bergaya timesheet")
    cek("Alvina Nur Lailia" in tw and "Dilaporkan Oleh :" in tw, "Word: Dilaporkan Oleh / Disetujui Oleh")
    cek(not galat, f"tanpa galat JS ({galat})")
    b.close()

    print("4. Kegiatan baru batch 5 tahun ini: file baru disalin dari file terbaru dan diisi")
    b, pg, galat = buka(p)
    hubungkan(pg)
    awal_ts4 = snapshot_ts4(pg)
    nav(pg, "Tambah")
    pg.get_by_text("Isi Formulir Manual").first.click()
    pg.wait_for_timeout(400)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    pg.click(".bertahap-kegiatan__baru")
    pg.wait_for_timeout(300)
    modal = pg.locator(".modal-backdrop [role=group]")
    modal.locator("input[type=text]").nth(0).fill("Patroli Hutan Desa Contoh")
    modal.locator("input[type=text]").nth(1).fill("Long Contoh")
    modal.locator("input[type=date]").nth(0).fill("2026-11-10")
    modal.locator("input[type=date]").nth(1).fill("2026-11-12")
    pg.wait_for_timeout(200)
    batch_input = modal.locator("input[type=number]")
    cek(batch_input.input_value() == "5", f"saran batch tahun ini = 5 ({batch_input.input_value()})")
    cek("BATCH 5 (NOVEMBER 2026)" in modal.inner_text(), "nama file yang akan dipakai ditampilkan")
    modal.locator("input[type=date]").nth(0).fill("2027-02-02")
    modal.locator("input[type=date]").nth(1).fill("2027-02-04")
    pg.wait_for_timeout(200)
    cek(batch_input.input_value() == "1", f"tahun depan: saran batch = 1 ({batch_input.input_value()})")
    modal.locator("input[type=date]").nth(0).fill("2026-11-10")
    modal.locator("input[type=date]").nth(1).fill("2026-11-12")
    pg.wait_for_timeout(200)
    cek(batch_input.input_value() == "5", "kembali ke tahun ini: saran batch 5 lagi")
    modal.get_by_role("button", name="Simpan & Pilih Kegiatan").click()
    pg.wait_for_timeout(500)
    pg.wait_for_function("window.__drive.calls.some(c => c.tool === 'copy_file')", timeout=30000)
    pg.wait_for_function("window.__drive.calls.filter(c => c.tool === 'update_values' && c.input.spreadsheetId !== 'TS4').some(c => /A1:E/.test(c.input.range))", timeout=30000)
    pg.wait_for_timeout(1500)
    nama5 = "FORM LAPORAN TIMESHEET KEGIATAN BATCH 5 (NOVEMBER 2026)"
    baru = pg.evaluate("[...window.__drive.files.values()].filter(f => f.title === %s).map(f => ({id: f.id, parent: f.parentId}))" % json.dumps(nama5))
    cek(len(baru) == 1 and baru[0]["parent"] == "F1", f"file {nama5} dibuat satu kali di folder Keuangan {baru}")
    id5 = baru[0]["id"] if baru else None
    cop = [c for c in panggilan(pg, "copy_file")]
    cek(len(cop) == 1 and cop[0]["input"]["fileId"] == "TS4", "disalin dari file timesheet terbaru (format sama)")
    rows5 = pg.evaluate("(id) => window.__drive.sheets.get(id).tabs[0].rows", id5)
    cek(rows5[10][0] == 1 and rows5[10][1] == "11/10/2026" and rows5[12][1] == "11/12/2026", f"tanggal 10-12 Nov di baris 11-13 ({[r[:2] for r in rows5[10:13]]})")
    cek(not any(r and len(r) > 1 and r[1] == "9/20/2026" for r in rows5), "sisa data batch 4 pada salinan sudah dikosongkan")
    cek(len([r for r in rows5[13:44] if r and any(v not in ("", None) for v in r)]) == 0, "baris 14-44 kosong")
    cek(rows5[44][2] == "Total" and str(rows5[44][4]).startswith("=SUM(E11:E44)"), f"Total memakai rumus SUM ({rows5[44][2:5]})")
    cek("Patroli Hutan Desa Contoh (Batch 5)" in str(rows5[5][1]), f"judul kegiatan berakhiran (Batch 5) ({rows5[5][1]})")
    cek(": November 2026" in str(rows5[7][1]), "kop Bulan: November 2026")
    cek(rows5[50][1] == "Adrila Nopal Prastian Zalukhu" and rows5[50][3] == "Alvina Nur Lailia", "nama pelapor dan penyetuju di tanda tangan")
    cek(snapshot_ts4(pg) == awal_ts4, "file batch 4 milik pengguna tetap tidak berubah")
    kg5 = [k for k in kegiatan_lokal(pg) if k["nama"].startswith("Patroli")][0]
    cek(kg5.get("batch") == 5 and kg5.get("timesheetId") == id5 and kg5.get("timesheetDibuatApp") is True, "kegiatan menyimpan batch, ID file, penanda buatan aplikasi")
    cek(len(panggilan(pg, "update_values", "TS4")) == 0, "tidak pernah menulis ke file batch 4")
    cek(not galat, f"tanpa galat JS ({galat})")

    print("5. Simpan kegiatan yang sama lagi tidak membuat file kembar; batch 1 tahun depan membuat file sendiri")
    pg.evaluate("window.__drive.calls.length = 0")
    nav(pg, "Riwayat")
    nav(pg, "Tambah")
    if pg.locator("text=Isi Formulir Manual").count():
        pg.get_by_text("Isi Formulir Manual").first.click()
        pg.wait_for_timeout(400)
    pg.select_option("#dana", "Dana Kegiatan")
    pg.wait_for_timeout(300)
    if not pg.locator(".bertahap-kegiatan__baru").count():
        pg.click('.bertahap-langkah button[aria-label^="Langkah 1"]')
        pg.wait_for_timeout(300)
    pg.click(".bertahap-kegiatan__baru")
    pg.wait_for_timeout(300)
    modal = pg.locator(".modal-backdrop [role=group]")
    modal.locator("input[type=text]").nth(0).fill("Survei Awal Tahun")
    modal.locator("input[type=text]").nth(1).fill("Long Contoh")
    modal.locator("input[type=date]").nth(0).fill("2027-02-02")
    modal.locator("input[type=date]").nth(1).fill("2027-02-04")
    pg.wait_for_timeout(200)
    modal.get_by_role("button", name="Simpan & Pilih Kegiatan").click()
    pg.wait_for_function("window.__drive.calls.some(c => c.tool === 'copy_file')", timeout=30000)
    pg.wait_for_timeout(2500)
    nama1 = "FORM LAPORAN TIMESHEET KEGIATAN BATCH 1 (FEBRUARI 2027)"
    n1 = pg.evaluate("[...window.__drive.files.values()].filter(f => f.title === %s).length" % json.dumps(nama1))
    cek(n1 == 1, f"{nama1} dibuat")
    n5 = pg.evaluate("[...window.__drive.files.values()].filter(f => f.title === %s).length" % json.dumps(nama5))
    cek(n5 == 1, "file batch 5 tidak dibuat ulang")
    b.close()

    print("6. Tanpa file contoh: pesan jelas, tidak ada yang rusak")
    b, pg, galat = buka(p)
    pg.evaluate("window.__drive.files.delete('TS4'); window.__drive.sheets.delete('TS4')")
    hubungkan(pg)
    buka_laporan(pg)
    kartu = pg.locator("[data-testid=kartu-timesheet]")
    pg.locator("[data-testid=kartu-timesheet] input[type=number]").fill("5")
    pg.locator("[data-testid=kartu-timesheet] input[type=text]").click()
    pg.wait_for_timeout(300)
    kartu.get_by_role("button", name=re.compile("Buat file timesheet")).click()
    pg.wait_for_timeout(1500)
    cek("Belum ada file timesheet" in kartu.inner_text() and "contoh format" in kartu.inner_text(), f"pesan jelas bila belum ada contoh: {kartu.inner_text()[-200:]!r}")
    cek(not panggilan(pg, "copy_file"), "tidak ada salinan dibuat")
    b.close()

    print("7. Kegiatan lama (sudah lama selesai) tidak memicu pembuatan file saat diubah")
    b, pg, galat = buka(p)
    lama = {"id": "kgLama", "nama": "Kegiatan Lama (Batch 1)", "lokasi": "X", "tanggalMulai": "2026-01-05", "tanggalSelesai": "2026-01-10", "batch": 1}
    pg.evaluate("(k) => { const a = JSON.parse(localStorage.getItem('keuangan-daftar-kegiatan')); a.push(k); localStorage.setItem('keuangan-daftar-kegiatan', JSON.stringify(a)); }", lama)
    pg.reload()
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(600)
    hubungkan(pg)
    buka_laporan(pg, "kgLama")
    pg.locator(".card.no-print input[type=checkbox]").first.click()
    pg.wait_for_timeout(7000)
    cek(not panggilan(pg, "copy_file"), "tidak ada file timesheet baru untuk kegiatan lama")
    cek(not [k for k in kegiatan_lokal(pg) if k["id"] == "kgLama" and k.get("timesheetId")], "kegiatan lama tetap tanpa file timesheet")
    b.close()

    print("8. Sisa pembacaan keliru versi lama dibersihkan; file mirip timesheet tanpa kata 'timesheet' tidak dibaca sebagai transaksi")
    b, pg, galat = buka(p)
    junk = []
    for i in range(3):
        junk.append({"id": f"junkT{i}", "jenis": "pemasukan", "dana": "Dana Kegiatan", "tanggal": "2026-10-24", "deskripsi": "Total", "kategori": "Lain-lain",
                     "jumlah": 6800000, "metode": "Tunai", "kaitan": "", "catatan": ""})
    for i in range(1, 6):
        junk.append({"id": f"junkH{i}", "jenis": "pemasukan", "dana": "Dana Kegiatan", "tanggal": "2026-20-09", "deskripsi": f"Kegiatan lapangan hari ke-{i}, bersama warga",
                     "kategori": f"Desa Contoh {i}", "jumlah": 200000, "metode": "Tunai", "kaitan": "", "catatan": ""})
    pg.evaluate("(j) => { const a = JSON.parse(localStorage.getItem('pengeluaran-harian')); localStorage.setItem('pengeluaran-harian', JSON.stringify(a.concat(j))); }", junk)
    # File mirip timesheet yang namanya tidak memuat "timesheet": harus dilewati karena judul kolomnya bukan sheet keuangan.
    pg.evaluate(
        """(rows) => { window.__drive.tambahFile({ id: 'MIRIP', title: 'Perdiem Batch 3 Kegiatan 2026', mimeType: 'application/vnd.google-apps.spreadsheet', parentId: 'F1' });
                      window.__drive.sheets.set('MIRIP', { tabs: [{ sheetId: 222, title: 'Sheet1', rows }] }); }""",
        baris_timesheet(),
    )
    pg.reload()
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(600)
    pg.evaluate(
        """(rows) => { window.__drive.tambahFile({ id: 'MIRIP', title: 'Perdiem Batch 3 Kegiatan 2026', mimeType: 'application/vnd.google-apps.spreadsheet', parentId: 'F1' });
                      window.__drive.sheets.set('MIRIP', { tabs: [{ sheetId: 222, title: 'Sheet1', rows }] }); }""",
        baris_timesheet(),
    )
    hubungkan(pg)
    pg.wait_for_timeout(2500)
    trx = json.loads(pg.evaluate("localStorage.getItem('pengeluaran-harian')"))
    sisa = [t for t in trx if t["id"].startswith("junk")]
    cek(not sisa, f"8 catatan nyasar dihapus otomatis ({len(sisa)} tersisa)")
    cek(any(t["deskripsi"] == "Penerimaan Dana Awal Kegiatan" for t in trx), "dana awal sungguhan tetap ada")
    cek(len([t for t in trx if t["kategori"] == "Perdiem"]) == 34, "34 perdiem sungguhan tetap ada")
    cek(not [t for t in trx if "hari ke-" in (t.get("deskripsi") or "") or t.get("deskripsi") == "Total"], "tidak ada baris timesheet yang lolos jadi transaksi (termasuk dari file mirip)")
    cek(not [c for c in panggilan(pg, "update_values") if c["input"]["spreadsheetId"] in ("TS4", "MIRIP")], "file timesheet dan file mirip tidak pernah ditulis")
    cek(not galat, f"tanpa galat JS ({galat})")
    b.close()

if gagal:
    print(f"\n{len(gagal)} uji gagal")
    sys.exit(1)
print("\nSemua uji lolos")
