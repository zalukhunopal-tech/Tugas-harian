"""
Uji fitur Keluarga & Komunitas dan penyiapan folder Keuangan otomatis, di Chromium dengan Drive/Sheets palsu.

Dua "pengguna" dipakai: A (saya@example.org) pemilik data, B (adik@example.org) yang menunjukkan kode QR-nya.
Pindai kode dicoba lewat tiga jalan: kamera palsu Chromium yang memutar gambar QR B, foto kode, dan tempel teks kode.

Pakai:
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_keluarga.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import base64
import json
import pathlib
import sys
import tempfile

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")
TMP = pathlib.Path(tempfile.mkdtemp(prefix="uji-keluarga-"))

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def buka(p, akun=None, awal="", args=None, lebar=420):
    opsi = {"args": args or []}
    if CHROMIUM:
        opsi["executable_path"] = CHROMIUM
    b = p.chromium.launch(**opsi)
    ctx = b.new_context(viewport={"width": lebar, "height": 900}, service_workers="block", permissions=["camera"])
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    pg.on(
        "console",
        lambda m: m.type == "error" and "Failed to load resource" not in m.text and "NotFound" not in m.text
        and "Requested device" not in m.text and galat.append("CONSOLE " + m.text[:300]),
    )
    pg.add_init_script(TIRUAN)
    if akun:
        pg.add_init_script(f"window.__drive.akun = {json.dumps(akun)}")
    if awal:
        pg.add_init_script(awal)
    pg.goto(BASE)
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(500)
    return b, pg, galat


def buka_app(pg, app):
    pg.locator(".navbar button", has_text="Saya").first.click()
    pg.wait_for_timeout(300)
    if pg.locator(".saya-peluncur").count() == 0:
        pg.get_by_role("button", name="Kembali ke daftar aplikasi").click()
        pg.wait_for_timeout(200)
    pg.locator(f"[data-app={app}]").click()
    pg.wait_for_timeout(400)


def hubungkan(pg, tunggu_tarik=True):
    buka_app(pg, "drive")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.get_by_text("Konektor Google Drive aktif").first.wait_for(timeout=10000)
    if tunggu_tarik:
        pg.wait_for_function("window.__drive.calls.filter(c => c.tool === 'get_values').length >= 2", timeout=30000)
    pg.wait_for_timeout(900)


def buka_keluarga(pg):
    buka_app(pg, "keluarga")
    pg.wait_for_function("document.querySelector('#keluarga-dibagikan') && !/Memeriksa/.test(document.querySelector('#keluarga-dibagikan').innerText)", timeout=15000)
    pg.wait_for_timeout(300)


def panggilan(pg, tool):
    return pg.evaluate("(t) => window.__drive.calls.filter(c => c.tool === t)", tool)


def izin_file(pg, id_file):
    return pg.evaluate("(id) => (window.__drive.izinFile.get(id) || []).map(x => [x.emailAddress, x.role])", id_file)


def saklar(pg, kartu, dana):
    return pg.locator(f"{kartu} [role=switch][aria-label='{dana}']")


def kode_teks(nama, email):
    isi = json.dumps({"n": nama, "e": email}, separators=(",", ":")).encode()
    return "CKH1:" + base64.urlsafe_b64encode(isi).decode().rstrip("=")


def tulis_y4m(pg, jalur, sisi=480):
    """Ubah QR di halaman B menjadi video palsu (hitam-putih) untuk kamera palsu Chromium."""
    b64 = pg.evaluate(
        """(sisi) => {
            const asal = document.querySelector('canvas.kode-qr');
            const c = document.createElement('canvas'); c.width = c.height = sisi;
            const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#fff'; x.fillRect(0, 0, sisi, sisi);
            const s = Math.floor(sisi * 0.9); x.drawImage(asal, (sisi - s) / 2, (sisi - s) / 2, s, s);
            const d = x.getImageData(0, 0, sisi, sisi).data; const y = new Uint8Array(sisi * sisi);
            for (let i = 0; i < y.length; i++) y[i] = d[i * 4] > 127 ? 235 : 16;
            let biner = ''; for (let i = 0; i < y.length; i += 8192) biner += String.fromCharCode(...y.subarray(i, i + 8192));
            return btoa(biner);
        }""",
        sisi,
    )
    luma = base64.b64decode(b64)
    chroma = bytes([128]) * (sisi * sisi // 4)
    kepala = f"YUV4MPEG2 W{sisi} H{sisi} F10:1 Ip A1:1 C420jpeg\n".encode()
    with open(jalur, "wb") as f:
        f.write(kepala)
        for _ in range(5):
            f.write(b"FRAME\n" + luma + chroma + chroma)


with sync_playwright() as p:
    print("1. B menunjukkan kode QR-nya")
    bB, pgB, galatB = buka(p, akun="adik@example.org")
    hubungkan(pgB)
    buka_keluarga(pgB)
    cek(pgB.locator("#keluarga-kode-saya canvas.kode-qr").count() == 1, "kode QR tampil")
    posisi_qr = pgB.evaluate("""() => { const c = document.querySelector('#keluarga-kode-saya canvas.kode-qr').getBoundingClientRect();
        const k = document.querySelector('#keluarga-kode-saya').getBoundingClientRect(); const n = document.querySelector('#keluarga-nama').getBoundingClientRect();
        return { selisih: Math.round((c.left + c.width / 2) - (k.left + k.width / 2)), qrAtasNama: c.bottom <= n.top + 1, lebarNama: Math.round(n.width), lebarKartu: Math.round(k.width) }; }""")
    cek(abs(posisi_qr["selisih"]) <= 2, f"HP: kode QR tepat di tengah kartu (selisih {posisi_qr['selisih']} px)")
    cek(posisi_qr["qrAtasNama"] and posisi_qr["lebarNama"] >= posisi_qr["lebarKartu"] - 40, "HP: nama dan email berada di bawah kode QR, selebar kartu")
    cek("adik@example.org" in pgB.locator("#keluarga-kode-saya .keluarga-email").inner_text(), "email diambil dari pemilik berkas (profil artefak tidak punya email)")
    pgB.fill("#keluarga-nama", "Adik Rahayu")
    pgB.wait_for_timeout(400)
    cek(pgB.locator("#keluarga-pindai").is_enabled(), "tombol pindai aktif")
    galatPeta = pgB.evaluate("""() => { const c = document.querySelector('canvas.kode-qr'); const x = c.getContext('2d');
        const d = x.getImageData(0, 0, c.width, c.height).data; let gelap = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) gelap++; return gelap / (d.length / 4); }""")
    cek(0.2 < galatPeta < 0.7, f"QR berisi modul hitam dan putih seimbang ({galatPeta:.2f})")
    foto = TMP / "kode-adik.png"
    foto.write_bytes(base64.b64decode(pgB.evaluate("document.querySelector('canvas.kode-qr').toDataURL('image/png').split(',')[1]")))
    video = TMP / "kode-adik.y4m"
    tulis_y4m(pgB, video)
    cek(not galatB, f"B tanpa galat JS ({galatB})")
    bB.close()

    print("2. A: tanpa folder lain, buka Keluarga")
    bA, pgA, galatA = buka(p, args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={video}"])
    buka_app(pgA, "keluarga")
    cek(pgA.locator("#keluarga-belum-masuk").count() == 1, "belum masuk Google: diminta masuk lewat Drive Keuangan")
    hubungkan(pgA)
    buka_keluarga(pgA)
    cek("saya@example.org" in pgA.locator("#keluarga-kode-saya .keluarga-email").inner_text(), "kode saya memuat email pemilik (saya@example.org)")
    cek(pgA.locator("#keluarga-publik").count() == 0, "tanpa peringatan tautan publik")
    cek("Belum ada anggota" in pgA.locator("#keluarga-terhubung").inner_text(), "belum ada anggota terhubung")
    cek("Belum ada yang membagikan" in pgA.locator("#keluarga-dibagikan").inner_text(), "belum ada yang membagikan kepada saya")
    cek(len(panggilan(pgA, "share_file")) == 0, "membuka layar tidak membagikan apa pun")

    print("3. Pindai lewat kamera (video palsu berisi QR B)")
    pgA.locator("#keluarga-pindai").click()
    pgA.wait_for_selector("#keluarga-konfirmasi", timeout=15000)
    cek(pgA.locator(".pemindai-latar").count() == 0, "jendela pemindai tertutup setelah kode terbaca")
    cek("Adik Rahayu" in pgA.locator("#keluarga-konfirmasi").inner_text() and "adik@example.org" in pgA.locator("#keluarga-konfirmasi").inner_text(), "konfirmasi memuat nama dan email dari QR")
    cek(saklar(pgA, "#keluarga-konfirmasi", "Dana Pribadi").get_attribute("aria-checked") == "false", "Dana Pribadi mati secara bawaan")
    cek(saklar(pgA, "#keluarga-konfirmasi", "Dana Kegiatan").get_attribute("aria-checked") == "true", "Dana Kegiatan hidup secara bawaan")
    cek(len(panggilan(pgA, "share_file")) == 0, "belum ada yang dibagikan sebelum dikonfirmasi")
    pgA.get_by_role("button", name="Batal").click()
    pgA.wait_for_timeout(300)
    cek(pgA.locator("#keluarga-konfirmasi").count() == 0 and len(panggilan(pgA, "share_file")) == 0, "Batal: tidak ada yang dibagikan")

    print("4. Pindai lewat foto, tempel kode, kode salah, kode sendiri")
    # Kamera palsu terus memutar QR B dan akan langsung menutup jendela; matikan agar jalan foto/tempel yang diuji.
    pgA.evaluate("(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('dimatikan uji', 'NotAllowedError')); })()")
    pgA.locator("#keluarga-pindai").click()
    pgA.wait_for_selector(".pemindai-latar")
    blank = TMP / "kosong.png"
    blank.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))
    pgA.set_input_files(".pemindai-foto input[type=file]", str(blank))
    pgA.wait_for_function("/Tidak ada kode QR/.test(document.querySelector('.pemindai-pesan').innerText)", timeout=8000)
    cek(True, "foto tanpa QR: pesan 'Tidak ada kode QR'")
    pgA.fill("#pemindai-tempel-isi", "CKH1:bukan-kode")
    pgA.get_by_role("button", name="Pakai kode ini").click()
    cek("bukan kode anggota" in pgA.locator(".pemindai-pesan").inner_text(), "kode rusak ditolak")
    pgA.fill("#pemindai-tempel-isi", kode_teks("Saya Sendiri", "saya@example.org"))
    pgA.get_by_role("button", name="Pakai kode ini").click()
    pgA.wait_for_timeout(300)
    cek("kode Anda sendiri" in pgA.locator("#keluarga-pesan").inner_text(), "kode sendiri ditolak dengan pesan")
    pgA.locator("#keluarga-pindai").click()
    pgA.wait_for_selector(".pemindai-latar")
    pgA.set_input_files(".pemindai-foto input[type=file]", str(foto))
    pgA.wait_for_selector("#keluarga-konfirmasi", timeout=8000)
    cek("adik@example.org" in pgA.locator("#keluarga-konfirmasi").inner_text(), "foto QR B terbaca")

    print("5. Hubungkan: hanya Dana Kegiatan")
    pgA.get_by_role("button", name="Hubungkan", exact=True).click()
    pgA.wait_for_selector("li.keluarga-anggota[data-email='adik@example.org']", timeout=10000)
    pgA.wait_for_timeout(500)
    cek(izin_file(pgA, "SK") == [["adik@example.org", "reader"]], f"Keuangan Kegiatan dibagikan sebagai pembaca ({izin_file(pgA, 'SK')})")
    cek(izin_file(pgA, "SP") == [], "Keuangan Pribadi tidak dibagikan")
    cek(all(c["input"].get("role") == "reader" for c in panggilan(pgA, "share_file")), "semua izin berperan reader")
    k = "li.keluarga-anggota[data-email='adik@example.org']"
    cek(saklar(pgA, k, "Dana Kegiatan").get_attribute("aria-checked") == "true" and saklar(pgA, k, "Dana Pribadi").get_attribute("aria-checked") == "false", "daftar terhubung: Kegiatan hidup, Pribadi mati")
    cek("Adik Rahayu" in pgA.locator(k).inner_text(), "nama anggota dari QR tampil (Drive hanya memberi 'adik')")

    print("6. Ubah dana lewat saklar")
    saklar(pgA, k, "Dana Pribadi").click()
    pgA.wait_for_function("window.__drive.izinFile.get('SP') && window.__drive.izinFile.get('SP').length === 1", timeout=8000)
    pgA.wait_for_timeout(600)
    cek(izin_file(pgA, "SP") == [["adik@example.org", "reader"]], "Dana Pribadi dibuka untuk Adik")
    cek(saklar(pgA, k, "Dana Pribadi").get_attribute("aria-checked") == "true", "saklar Dana Pribadi menyala setelah dibaca ulang dari Drive")
    sebelum = len(panggilan(pgA, "share_file"))
    saklar(pgA, k, "Dana Kegiatan").click()
    pgA.wait_for_selector("#keluarga-cabut-manual", timeout=8000)
    pgA.wait_for_timeout(500)
    cek(len(panggilan(pgA, "share_file")) == sebelum, "mencabut tidak membagikan lagi")
    cek("adik@example.org" in pgA.locator("#keluarga-cabut-manual").inner_text() and pgA.locator("#keluarga-cabut-manual a").count() >= 1, "artefak tidak bisa mencabut: petunjuk cabut manual + tautan berkas tampil")
    cek(saklar(pgA, k, "Dana Kegiatan").get_attribute("aria-checked") == "true", "saklar tetap menyala karena izin Drive memang belum dicabut (tidak berbohong)")

    print("7. Peringatan tautan publik")
    pgA.evaluate("window.__drive.publik.add('SP'); window.__drive.publik.add('F1')")
    buka_keluarga(pgA)
    pgA.get_by_role("button", name="Kembali ke daftar aplikasi").click()
    buka_keluarga(pgA)
    teks = pgA.locator("#keluarga-publik").inner_text() if pgA.locator("#keluarga-publik").count() else ""
    cek("Keuangan Pribadi 2026" in teks and "folder Keuangan" in teks, "peringatan menyebut berkas dan folder yang bertautan publik")
    cek(pgA.get_by_role("button", name="Batasi sekarang").count() == 0, "tanpa ID izin (artefak) tombol 'Batasi sekarang' tidak ditawarkan")
    pgA.evaluate("window.__drive.publik.clear()")

    print("8. Dibagikan kepada saya: tampilan baca-saja")
    pgA.evaluate("""() => {
        window.__drive.tambahSheet('XB1', [
          ['1', '2026-10-02', 'Beli beras', 'Makan & Minum', '', '150000', '-150000', '', '', 'idx1', 'Tunai', ''],
          ['2', '2026-10-03', 'Uang saku', 'Gaji', '1000000', '', '850000', '', '', 'idx2', 'Transfer', '']]);
        window.__drive.dibagikan.push({id: 'XB1', title: 'Keuangan Pribadi 2026', mimeType: 'application/vnd.google-apps.spreadsheet', owner: 'ibu@example.org', modifiedTime: new Date().toISOString()});
        window.__drive.dibagikan.push({id: 'XB2', title: 'Resep Kue', mimeType: 'application/vnd.google-apps.document', owner: 'ibu@example.org', modifiedTime: new Date().toISOString()});
    }""")
    pgA.get_by_role("button", name="Kembali ke daftar aplikasi").click()
    buka_keluarga(pgA)
    kartu = "li.keluarga-anggota[data-pemilik='ibu@example.org']"
    cek(pgA.locator(kartu).count() == 1, "pemilik yang membagikan tampil (dokumen non-keuangan diabaikan)")
    jumlah_tulis = len(panggilan(pgA, "update_values")) + len(panggilan(pgA, "create_file")) + len(panggilan(pgA, "batch_clear_values"))
    pgA.locator(kartu).get_by_role("button", name="Lihat").click()
    pgA.wait_for_selector(".keluarga-lihat .keluarga-total", timeout=10000)
    teks = pgA.locator(".keluarga-lihat").inner_text()
    cek("Hanya lihat" in teks, "ditandai hanya lihat")
    cek("1.000.000" in teks and "150.000" in teks and "850.000" in teks, "total pemasukan, pengeluaran, dan saldo benar")
    cek("Beli beras" in teks and "Uang saku" in teks, "daftar transaksi tampil")
    cek("Oktober 2026" in teks, "ringkasan per bulan tampil")
    cek(len(panggilan(pgA, "update_values")) + len(panggilan(pgA, "create_file")) + len(panggilan(pgA, "batch_clear_values")) == jumlah_tulis, "melihat tidak menulis apa pun")
    pgA.locator(".navbar button", has_text="Riwayat").first.click()
    pgA.wait_for_timeout(400)
    cek("Beli beras" not in pgA.inner_text("body"), "data orang lain tidak bercampur ke Riwayat saya")
    cek(not galatA, f"A tanpa galat JS ({galatA})")
    bA.close()

    print("9. Kamera tidak tersedia: jalan lain tetap ada")
    bC, pgC, galatC = buka(p)
    hubungkan(pgC)
    buka_keluarga(pgC)
    pgC.locator("#keluarga-pindai").click()
    pgC.wait_for_selector(".pemindai-latar")
    pgC.wait_for_timeout(800)
    cek("Kamera" in pgC.locator(".pemindai-pesan").inner_text() and pgC.locator(".pemindai-video:visible").count() == 0, "pesan kamera tidak bisa dipakai, tanpa kotak video kosong")
    cek(pgC.locator(".pemindai-foto").count() == 1 and pgC.locator("#pemindai-tempel-isi").count() == 1, "pilih foto dan tempel kode tetap tersedia")
    pgC.keyboard.press("Escape")
    pgC.locator(".pemindai-tutup").click()
    cek(pgC.locator(".pemindai-latar").count() == 0, "jendela pemindai bisa ditutup")
    cek(not galatC, f"C tanpa galat JS ({galatC})")
    bC.close()

    print("10. Folder Keuangan dibuat otomatis (Drive masih kosong)")
    kosong = "(() => { const D = window.__drive; for (const k of [...D.files.keys()]) if (k !== 'root1') D.files.delete(k); D.sheets.clear(); })()"
    bD, pgD, galatD = buka(p, awal=kosong)
    hubungkan(pgD, tunggu_tarik=False)
    pgD.wait_for_function("window.__drive.calls.filter(c => c.tool === 'create_file').length >= 3", timeout=20000)
    pgD.wait_for_timeout(1200)
    judul = pgD.evaluate("window.__drive.calls.filter(c => c.tool === 'create_file').map(c => c.input.title)")
    cek(judul.count("Keuangan") == 1, f"folder Keuangan dibuat sekali ({judul})")
    cek("Bukti Transaksi" in judul and "Laporan Kegiatan" in judul, "subfolder Bukti Transaksi dan Laporan Kegiatan dibuat")
    pesan = pgD.locator("#sync-detail").inner_text() if pgD.locator("#sync-detail").count() else ""
    cek("dibuat otomatis" in pesan, f"pesan memberi tahu folder dibuat otomatis ({pesan[:120]})")
    cek("Belum bisa" in pesan, "spreadsheet yang tak bisa dibuat di mode artefak dilaporkan, bukan dilewati diam-diam")
    sebelum = len(judul)
    pgD.get_by_role("button", name="Periksa & siapkan folder Keuangan").count() and pgD.get_by_role("button", name="Periksa & siapkan folder Keuangan").click()
    pgD.wait_for_timeout(2500)
    judul2 = pgD.evaluate("window.__drive.calls.filter(c => c.tool === 'create_file').map(c => c.input.title)")
    cek(judul2.count("Keuangan") == 1, f"dijalankan lagi: tidak membuat folder Keuangan kedua ({judul2})")
    cek(not galatD, f"D tanpa galat JS ({galatD})")
    bD.close()

    print("11. Gangguan sesaat tidak membuat folder kedua")
    gangguan = "window.__drive.gagal.search_files = { code: 'tool_error', message: 'Layanan sibuk' }"
    bE, pgE, galatE = buka(p, awal=gangguan)
    buka_app(pgE, "drive")
    pgE.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pgE.wait_for_timeout(3500)
    cek(len(panggilan(pgE, "create_file")) == 0, "pencarian gagal -> tidak ada file/folder dibuat")
    bE.close()

print()
if gagal:
    print(f"{len(gagal)} uji gagal:")
    for g in gagal:
        print("  -", g)
    sys.exit(1)
print("Semua uji lolos")
