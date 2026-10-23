"""
Uji mode konektor artefak di Chromium dengan Google Drive/Sheets palsu (tiruan-konektor.js).

Pakai:
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8766 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_konektor.py http://127.0.0.1:8766/ [/opt/pw-browsers/chromium]

Dialog bawaan browser sengaja TIDAK diterima otomatis: Playwright menolaknya (confirm() -> false), sama seperti
sandbox artefak. Yang diuji adalah dialog buatan di halaman.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def buka(p, **opsi):
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    ctx = b.new_context(viewport={"width": 420, "height": 900})
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    pg.on(
        "console",
        lambda m: m.type == "error" and "Failed to load resource" not in m.text and galat.append("CONSOLE " + m.text[:300]),
    )
    pg.add_init_script(TIRUAN)
    if opsi.get("denganAset"):
        pg.add_init_script("window.__drive.mulai({denganAset:true})")
    pg.goto(BASE)
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(500)
    return b, pg, galat


def nav(pg, nama):
    if nama == "Tambah":  # tombol tengah berupa ikon "+", tanpa teks
        pg.locator(".navbar button").nth(2).click()
    else:
        pg.locator(".navbar button", has_text=nama).first.click()
    pg.wait_for_timeout(400)


def panggilan(pg, tool=None):
    cs = pg.evaluate("window.__drive.calls")
    return [c for c in cs if tool is None or c["tool"] == tool]


def baris_sheet(pg, id_sheet):
    return pg.evaluate(
        """(id) => window.__drive.sheets.get(id).tabs[0].rows.slice(6).filter(r => r && r.slice(1).some(v => v !== '' && v !== undefined))
            .map(r => [r[1], r[2], r[3], r[4], r[5], r[9], r[10]])""",
        id_sheet,
    )


def file_di_folder(pg, nama):
    return pg.evaluate(
        """(nama) => [...window.__drive.files.values()].filter(f => f.title === nama && f.parentId === 'F1')
            .map(f => ({id: f.id, trashed: window.__drive.trashed.has(f.id), isi: f.bytes ? new TextDecoder().decode(f.bytes) : null}))""",
        nama,
    )


def tambah_transaksi(pg, uraian, jumlah):
    nav(pg, "Tambah")
    pg.get_by_text("Isi Formulir Manual").click()
    pg.wait_for_timeout(400)
    pg.locator("input[type=radio]").nth(0).check(force=True)
    pg.select_option("#dana", "Dana Pribadi")
    pg.fill("#deskripsi", uraian)
    pg.select_option("#kategori", "Makan & Minum")
    pg.fill("#jumlah", str(jumlah))
    pg.get_by_role("button", name="Simpan", exact=True).click()
    pg.wait_for_timeout(600)


def setujui_dialog(pg):
    dlg = pg.locator(".dlg-artefak")
    dlg.wait_for(state="visible", timeout=5000)
    pg.locator(".dlg-artefak button.utama").click()
    pg.wait_for_timeout(300)


def tunggu_sinkron(pg, sebelum=0, detik=30):
    """Kirim manual selesai bila isi folder dibaca ulang (langkah terakhir handleKirimKeDrive)."""
    pg.wait_for_function(
        """(n) => { const c = window.__drive.calls; return c.length > n && c[c.length - 1].tool === 'search_files'
                    && /parentId/.test(c[c.length - 1].input.query); }""",
        arg=sebelum,
        timeout=detik * 1000,
    )
    pg.wait_for_timeout(400)


def tunggu_tarik(pg, jumlah_baca=2, detik=30):
    """Tarik data selesai bila sheet Pribadi dan Kegiatan sudah dibaca (B7:L), lalu beri waktu state diperbarui."""
    pg.wait_for_function(
        """(n) => window.__drive.calls.filter(c => c.tool === 'get_values' && /B7:L$/.test(c.input.range)).length >= n""",
        arg=jumlah_baca,
        timeout=detik * 1000,
    )
    pg.wait_for_timeout(900)


def hubungkan(pg, tunggu=True):
    nav(pg, "Saya")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.get_by_text("Konektor Google Drive aktif").first.wait_for(timeout=10000)
    if tunggu:
        tunggu_tarik(pg)  # sambungan pertama menarik data otomatis, seperti login Firebase di aplikasi


with sync_playwright() as p:
    print("1. Hubungkan, tarik data dari Drive tiruan")
    b, pg, galat = buka(p)
    hubungkan(pg)
    cek(pg.get_by_text("Folder Keuangan di Google Drive").count() > 0, "bagian Folder Keuangan tampil")
    cek("Login Google gagal" not in pg.content(), "tidak ada pesan 'Login Google gagal'")
    cek(len(panggilan(pg, "get_values")) >= 2, "sambungan pertama langsung menarik data (tanpa klik Tarik)")
    nav(pg, "Saya")
    pg.get_by_role("button", name="Tarik Data dari Folder Keuangan").click()
    pg.wait_for_timeout(2500)
    nav(pg, "Riwayat")
    teks = pg.inner_text("body")
    for u in ["Uji makan siang", "Uji gaji", "Uji dana awal"]:
        cek(u in teks, f"transaksi '{u}' dari sheet muncul di Riwayat")
    cek(len(panggilan(pg, "create_file")) == 0, "tarik data tidak menulis apa pun ke Drive")
    cek(len(panggilan(pg, "update_values")) == 0 and len(panggilan(pg, "batch_clear_values")) == 0, "tarik data tidak menulis ke Sheets")
    cek(not galat, f"tanpa galat JS ({galat})")

    print("2. Hapus transaksi lewat dialog buatan (confirm bawaan ditolak sandbox)")
    pg.locator(".expense-item", has_text="Uji makan siang").locator("button.btn-delete").click()
    pg.wait_for_timeout(300)
    cek(pg.locator(".dlg-artefak").count() == 1, "dialog konfirmasi tampil di halaman")
    cek("Uji makan siang" in pg.locator(".dlg-artefak").inner_text(), "dialog memuat pesan konfirmasi")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    cek("Uji makan siang" in pg.inner_text("body"), "Batal/Esc: transaksi tetap ada")
    pg.locator(".expense-item", has_text="Uji makan siang").locator("button.btn-delete").click()
    setujui_dialog(pg)
    cek("Uji makan siang" not in pg.inner_text("body"), "Lanjutkan: transaksi terhapus")
    cek("Uji gaji" in pg.inner_text("body"), "transaksi lain tidak ikut terhapus")

    print("2b. Persetujuan hanya berlaku untuk satu klik (pesan konfirmasi yang sama, item berbeda)")
    pg.evaluate(
        """() => {
          window.__hitung = { a: 0, b: 0 };
          for (const k of ['a', 'b']) {
            const t = document.createElement('button');
            t.id = 'uji-' + k; t.textContent = 'uji ' + k;
            t.style.cssText = 'position:fixed;top:' + (k === 'a' ? 4 : 44) + 'px;left:4px;z-index:5';
            t.onclick = () => { if (confirm('Hapus catatan ini?')) window.__hitung[k]++; };
            document.body.appendChild(t);
          }
        }"""
    )
    pg.locator("#uji-a").click()
    setujui_dialog(pg)
    cek(pg.evaluate("window.__hitung.a") == 1, "klik A + Lanjutkan: aksi A berjalan sekali")
    pg.locator("#uji-b").click()
    pg.wait_for_timeout(200)
    cek(pg.locator(".dlg-artefak").count() == 1, "klik B dengan pesan sama: dialog muncul lagi")
    cek(pg.evaluate("window.__hitung.b") == 0, "aksi B belum berjalan")
    pg.locator(".dlg-artefak button", has_text="Batal").click()
    pg.locator("#uji-a").click()
    pg.wait_for_timeout(200)
    cek(pg.locator(".dlg-artefak").count() == 1, "klik A lagi: dialog muncul lagi (persetujuan lama sudah hangus)")
    pg.keyboard.press("Escape")
    pg.evaluate("document.getElementById('uji-a').remove(); document.getElementById('uji-b').remove()")

    print("3. Kirim manual: sheet ditulis ulang, file keadaan dibuat")
    nav(pg, "Saya")
    n0 = len(panggilan(pg))
    pg.get_by_role("button", name="Kirim Data Lokal ke Folder Keuangan").click()
    setujui_dialog(pg)
    tunggu_sinkron(pg, n0)
    cek(pg.get_by_text("Berhasil disimpan ke Google Drive").count() > 0, "pesan sukses tampil")
    pribadi = baris_sheet(pg, "SP")
    kegiatan = baris_sheet(pg, "SK")
    cek(len(pribadi) == 1 and pribadi[0][1] == "Uji gaji", f"sheet Pribadi: 1 baris (yang terhapus hilang) {pribadi}")
    cek(len(kegiatan) == 1 and kegiatan[0][1] == "Uji dana awal", f"sheet Kegiatan utuh {kegiatan}")
    for nama in ["Aset.json", "Sinkron.json", "Pengaturan.json", "Laporan Kegiatan.json"]:
        fs = file_di_folder(pg, nama)
        ok = len(fs) == 1 and fs[0]["isi"] is not None
        if ok:
            json.loads(fs[0]["isi"])
        cek(ok, f"{nama} dibuat sekali dan berisi JSON sah")
    sinkron = json.loads(file_di_folder(pg, "Sinkron.json")[0]["isi"])
    cek(any(True for _ in sinkron["terhapus"]), f"Sinkron.json mencatat transaksi terhapus {sinkron['terhapus']}")
    cek(len(panggilan(pg, "trash_file")) == 0, "belum ada file yang dipindahkan ke Sampah")

    print("4. Kirim lagi tanpa perubahan: file keadaan tidak diganti")
    sebelum = len(panggilan(pg, "create_file"))
    n0 = len(panggilan(pg))
    pg.get_by_role("button", name="Kirim Data Lokal ke Folder Keuangan").click()
    setujui_dialog(pg)
    tunggu_sinkron(pg, n0)
    cek(len(panggilan(pg, "create_file")) == sebelum, "tidak ada create_file baru")
    cek(len(panggilan(pg, "trash_file")) == 0, "tidak ada trash_file")

    print("5. Ubah data: file keadaan diganti (file baru, yang lama ke Sampah)")
    tambah_transaksi(pg, "Uji bensin", 50000)
    pg.wait_for_timeout(500)
    # sinkron otomatis berjalan ~5 dtk setelah perubahan
    pg.wait_for_function(
        "window.__drive.calls.filter(c => c.tool === 'trash_file').length > 0", timeout=60000
    )
    pg.wait_for_timeout(1500)
    sinkron_fs = file_di_folder(pg, "Sinkron.json")
    aktif = [f for f in sinkron_fs if not f["trashed"]]
    cek(len(aktif) == 1, f"tepat satu Sinkron.json aktif ({len(aktif)} aktif dari {len(sinkron_fs)})")
    cek(any(f["trashed"] for f in sinkron_fs), "Sinkron.json lama ada di Sampah")
    cek(any(r[1] == "Uji bensin" for r in baris_sheet(pg, "SP")), f"transaksi baru ada di sheet {baris_sheet(pg, 'SP')}")
    cek(len(file_di_folder(pg, "Aset.json")) == 1, "Aset.json tetap satu (isi tidak berubah, dilewati)")

    print("6. Keluar lalu pulihkan sambungan setelah muat ulang")
    pg.reload()
    pg.wait_for_selector(".navbar")
    pg.wait_for_timeout(1500)
    nav(pg, "Saya")
    cek(pg.get_by_text("Konektor Google Drive aktif").count() > 0, "sambungan pulih otomatis (izin sudah 'granted')")
    cek(not [e for e in galat if "Gagal" in e], f"tanpa galat JS ({galat})")
    b.close()

    print("7. Tanpa akses konektor (use('mcp') -> null)")
    b, pg, galat = buka(p)
    pg.evaluate("window.__drive.tanpaMcp = true")
    nav(pg, "Saya")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.wait_for_timeout(1200)
    teks = pg.inner_text("body")
    cek("tidak diberi akses konektor" in teks, "pesan jelas muncul (bukan layar kosong)")
    cek(pg.get_by_text("Konektor Google Drive aktif").count() == 0, "tidak dianggap terhubung")
    b.close()

    print("8. Izin ditolak / konektor Sheets belum tersambung")
    b, pg, galat = buka(p)
    pg.evaluate("window.__drive.izinMinta = 'denied'")
    nav(pg, "Saya")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.wait_for_timeout(1000)
    cek("Izin konektor ditolak" in pg.inner_text("body"), "penolakan izin dijelaskan")
    pg.evaluate("window.__drive.izinMinta = 'granted'; window.__drive.tanpaSheets = true")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.wait_for_timeout(1000)
    cek("Google Sheets belum tersambung" in pg.inner_text("body"), "konektor Sheets yang hilang dijelaskan")
    b.close()

    print("9. Tanpa izin tersimpan, membuka halaman tidak memicu panggilan konektor")
    b, pg, galat = buka(p)
    pg.wait_for_timeout(800)
    cek(len(panggilan(pg)) == 0, "nol panggilan konektor saat halaman dibuka")
    b.close()

    print("10. Indeks pencarian Drive lambat: file yang baru dibuat tidak boleh dibuat kembar")
    b, pg, galat = buka(p)
    pg.evaluate("window.__drive.indeksLambat = true")
    hubungkan(pg)
    nav(pg, "Saya")
    for _ in range(2):
        n0 = len(panggilan(pg))
        pg.get_by_role("button", name="Kirim Data Lokal ke Folder Keuangan").click()
        setujui_dialog(pg)
        tunggu_sinkron(pg, n0)
    for nama in ["Aset.json", "Sinkron.json", "Pengaturan.json", "Laporan Kegiatan.json"]:
        cek(len(file_di_folder(pg, nama)) == 1, f"{nama}: tetap satu file setelah dua kali kirim")
    b.close()

    print("11. create_file menjawab tanpa id: id dicari lewat nama dan folder")
    b, pg, galat = buka(p)
    pg.evaluate("window.__drive.createTanpaId = true")
    hubungkan(pg)
    nav(pg, "Saya")
    n0 = len(panggilan(pg))
    pg.get_by_role("button", name="Kirim Data Lokal ke Folder Keuangan").click()
    setujui_dialog(pg)
    tunggu_sinkron(pg, n0)
    cek(pg.get_by_text("Berhasil disimpan ke Google Drive").count() > 0, "kirim tetap berhasil")
    cek(len(file_di_folder(pg, "Sinkron.json")) == 1, "Sinkron.json terbuat satu kali")
    b.close()

    print("12. Penjaga tarik-dulu: galat baca membuat kirim ditolak dan tidak menulis apa pun")
    b, pg, galat = buka(p)
    pg.evaluate("window.__drive.gagal.get_values = {code: 'upstream_error', message: 'Google sedang bermasalah'}")
    hubungkan(pg)
    nav(pg, "Saya")
    pg.get_by_role("button", name="Kirim Data Lokal ke Folder Keuangan").click()
    setujui_dialog(pg)
    pg.get_by_text("Tarik data dari folder Keuangan dulu").first.wait_for(timeout=10000)
    cek(True, "pesan 'tarik dulu' tampil")
    tulis = [c["tool"] for c in panggilan(pg) if c["tool"] in ("create_file", "update_values", "batch_clear_values", "trash_file")]
    cek(tulis == [], f"tidak ada panggilan tulis saat ditolak ({tulis})")
    pg.evaluate("window.__drive.gagal = {}")
    pg.get_by_role("button", name="Tarik Data dari Folder Keuangan").click()
    pg.wait_for_timeout(3000)
    n0 = len(panggilan(pg))
    pg.get_by_role("button", name="Kirim Data Lokal ke Folder Keuangan").click()
    setujui_dialog(pg)
    tunggu_sinkron(pg, n0)
    cek(len(panggilan(pg, "batch_clear_values")) > 0, "setelah tarik utuh, kirim berjalan")
    cek(len(baris_sheet(pg, "SP")) == 2, f"isi sheet Pribadi tetap utuh {baris_sheet(pg, 'SP')}")
    b.close()

    print("13. Menimpa lewat ID lama tidak membuat file kembar")
    b, pg, galat = buka(p, denganAset=True)
    hasil = pg.evaluate(
        """async () => {
          const url = (id) => `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`;
          const kirim = (id, isi) => fetch(url(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: isi }).then(r => r.status);
          const s1 = await kirim('AS', '[{"v":1}]');
          const s2 = await kirim('AS', '[{"v":2}]'); // ID lama, sudah diganti pada panggilan pertama
          return [s1, s2];
        }"""
    )
    cek(hasil == [200, 200], f"dua penimpaan berhasil {hasil}")
    fs = file_di_folder(pg, "Aset.json")
    aktif = [f for f in fs if not f["trashed"]]
    cek(len(aktif) == 1, f"tepat satu Aset.json aktif ({len(aktif)} aktif dari {len(fs)})")
    cek(aktif and aktif[0]["isi"] == '[{"v":2}]', "isi yang aktif adalah yang terbaru")
    b.close()

print()
if gagal:
    print(f"{len(gagal)} pemeriksaan GAGAL:")
    for g in gagal:
        print(" -", g)
    sys.exit(1)
print("Semua pemeriksaan lolos.")
