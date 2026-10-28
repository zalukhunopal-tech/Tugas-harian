"""
Uji "data tidak boleh menempel": keluar dari sinkron Drive membersihkan perangkat, catatan penghapusan tidak hilang, dan
catatan ganda bisa dirapikan. Chromium dengan Drive/Sheets palsu (artefak/uji/tiruan-konektor.js).

Pakai (build artefak):
  npx vite build --config artefak/vite.config.ts
  python3 -m http.server 8768 --bind 127.0.0.1 --directory dist-artefak &
  python3 artefak/uji/uji_bersih.py http://127.0.0.1:8768/ [/opt/pw-browsers/chromium]
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8768/"
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else None
TIRUAN = (pathlib.Path(__file__).parent / "tiruan-konektor.js").read_text(encoding="utf-8")

gagal = []


def cek(kondisi, pesan):
    print(("  ok   " if kondisi else "  GAGAL ") + pesan)
    if not kondisi:
        gagal.append(pesan)


def buka_opsi(pg):
    """Pengaturan Drive selain lingkaran sinkronisasi dilipat di 'Opsi lanjutan': buka bila masih tertutup."""
    d = pg.locator("#opsi-lanjutan-drive")
    if d.count() and not d.evaluate("e => e.open"):
        d.locator("summary").click()
        pg.wait_for_timeout(150)


def klik_opsi(pg, nama):
    buka_opsi(pg)
    pg.get_by_role("button", name=nama).click()


PREFERENSI = ["keuangan-tema", "keuangan-karakter", "keuangan-isi-bertahap", "app-layout"]
# Potret isi Drive palsu direkam hanya selama `window.__rekam` menyala (sesudah muat ulang bendera itu hilang), jadi potret
# terakhir adalah keadaan Drive tepat sebelum halaman dimuat ulang.
SIMPAN_POTRET = """
  window.addEventListener('pagehide', () => window.__rekam && window.catatPotret(window.__drive.potret()));
  setInterval(() => window.__rekam && window.catatPotret(window.__drive.potret()), 40);
"""


def buka(p, awal="", potret=None, tema=True):
    """Halaman baru dengan Drive palsu. `awal` = JS tambahan setelah tiruan; `potret` memulihkan isi Drive sebelumnya."""
    b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
    ctx = b.new_context(viewport={"width": 420, "height": 900}, service_workers="block")
    pg = ctx.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append("PAGEERROR " + str(e)[:300]))
    simpan = {"potret": potret}
    pg.expose_function("catatPotret", lambda s: simpan.__setitem__("potret", s))
    pg.add_init_script(TIRUAN)
    if potret:
        pg.add_init_script("window.__drive.pulihkan(" + json.dumps(potret) + ");")
    if awal:
        pg.add_init_script(awal)
    pg.add_init_script(SIMPAN_POTRET)
    if tema:
        pg.add_init_script("if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');localStorage.setItem('keuangan-tema','jujutsu');localStorage.setItem('keuangan-karakter','megumi');}")
    pg.goto(BASE)
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(500)
    return b, pg, galat, simpan


def kunci_data(pg):
    return pg.evaluate(
        "(pref) => Object.keys(localStorage).filter(k => /^(keuangan|pengeluaran-harian)/.test(k) && !pref.includes(k) && localStorage.getItem(k) !== '[]' && localStorage.getItem(k) !== '{}')",
        PREFERENSI,
    )


def buka_app_saya(pg, app):
    pg.locator(".navbar button", has_text="Saya").first.click()
    pg.wait_for_timeout(300)
    if pg.locator(".saya-peluncur").count() == 0:
        pg.get_by_role("button", name="Kembali ke daftar aplikasi").click()
        pg.wait_for_timeout(200)
    pg.locator(f"[data-app={app}]").click()
    pg.wait_for_timeout(400)


def tunggu_tarik(pg, jumlah_baca=2, detik=30):
    pg.wait_for_function(
        """(n) => window.__drive.calls.filter(c => c.tool === 'get_values' && /B6:L$/.test(c.input.range)).length >= n""",
        arg=jumlah_baca,
        timeout=detik * 1000,
    )
    pg.wait_for_timeout(900)


def hubungkan(pg):
    buka_app_saya(pg, "drive")
    pg.get_by_role("button", name="Sambungkan konektor Google Drive").click()
    pg.get_by_text("Konektor Google Drive aktif").first.wait_for(timeout=10000)
    tunggu_tarik(pg)


def tunggu_muat_ulang(pg):
    pg.wait_for_function("window.__sebelumMuatUlang === undefined", timeout=20000)
    pg.wait_for_selector(".navbar", timeout=15000)
    pg.wait_for_timeout(700)


def tandai(pg):
    pg.evaluate("window.__sebelumMuatUlang = 1; window.__rekam = 1")


def baris_sheet(pg, id_sheet):
    return pg.evaluate(
        """(id) => window.__drive.sheets.get(id).tabs[0].rows.slice(6).filter(r => r && r.slice(1).some(v => v !== '' && v !== undefined))
            .map(r => [r[1], r[2], r[3], r[4], r[5], r[9], r[10]])""",
        id_sheet,
    )


def isi_sinkron(pg):
    """Isi Sinkron.json yang aktif (tidak di Sampah) di folder Keuangan palsu."""
    teks = pg.evaluate(
        """() => { const D = window.__drive; const f = [...D.files.values()].filter(f => f.title === 'Sinkron.json' && f.parentId === 'F1' && !D.trashed.has(f.id))
              .sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)))[0];
              return f && f.bytes ? new TextDecoder().decode(f.bytes) : null; }"""
    )
    return json.loads(teks) if teks else None


def teks_riwayat(pg):
    pg.locator(".navbar button", has_text="Riwayat").first.click()
    pg.wait_for_timeout(500)
    return pg.inner_text("body")


with sync_playwright() as p:
    print("1. Instalasi bersih: tidak ada data siapa pun yang terbawa")
    b, pg, galat, _ = buka(p)
    cek(kunci_data(pg) == [], f"tidak ada kunci data di penyimpanan baru ({kunci_data(pg)})")
    cek(pg.evaluate("JSON.parse(localStorage.getItem('pengeluaran-harian') || '[]').length") == 0, "tidak ada transaksi")
    buka_app_saya(pg, "laporan")
    cek(pg.input_value("#profil-nama") == "", "profil pelapor kosong")
    buka_app_saya(pg, "drive")
    cek(pg.locator("#btn-hapus-data-perangkat").count() == 0, "tanpa data, tautan hapus-dari-perangkat tidak muncul")
    cek(not galat, f"tanpa galat JS ({galat})")
    b.close()

    print("2. Keluar dan hapus: data dikirim ke Drive dulu, perangkat bersih, Drive utuh")
    b, pg, galat, simpan = buka(p)
    hubungkan(pg)
    cek(len(kunci_data(pg)) > 0, f"setelah tarik, perangkat menyimpan salinan ({len(kunci_data(pg))} kunci)")
    # Catatan lokal baru yang belum sempat terkirim (pengiriman otomatis menunggu 5 detik).
    pg.evaluate(
        """() => { const t = JSON.parse(localStorage.getItem('pengeluaran-harian') || '[]');
                   t.unshift({id:'lokal1',jenis:'pengeluaran',dana:'Dana Pribadi',tanggal:window.__drive.hariIni,deskripsi:'Uji belum terkirim',kategori:'Makan & Minum',jumlah:12000,metode:'Tunai',kaitan:'',catatan:'',diubah:new Date().toISOString(),bukti:[]});
                   localStorage.setItem('pengeluaran-harian', JSON.stringify(t)); }"""
    )
    pg.reload()
    pg.wait_for_selector(".navbar", timeout=15000)
    tunggu_tarik(pg)
    buka_app_saya(pg, "drive")
    pg.locator("#btn-keluar-drive").click()
    modal = pg.locator("[data-testid=keluar-drive-modal]")
    modal.wait_for(timeout=5000)
    cek(pg.locator("#keluar-hapus").is_checked(), "pilihan bawaan: hapus data dari perangkat")
    cek("Kirim lalu keluar dan hapus data" in modal.inner_text(), "tombol menyebut kirim dulu")
    cek(pg.locator("#keluar-setuju").count() == 0, "tanpa persetujuan tambahan selama pengiriman belum gagal")
    kunci_sebelum = pg.evaluate("localStorage.getItem('keuangan-tema')")
    tandai(pg)
    pg.locator("#keluar-lanjut").click()
    tunggu_muat_ulang(pg)
    cek(kunci_data(pg) == [], f"perangkat bersih setelah muat ulang ({kunci_data(pg)})")
    cek(pg.evaluate("localStorage.getItem('keuangan-tema')") == kunci_sebelum == "jujutsu", "tema dan karakter dipertahankan")
    cek(pg.evaluate("JSON.parse(localStorage.getItem('pengeluaran-harian') || '[]').length") == 0, "tidak ada transaksi di perangkat")
    cek(pg.get_by_text("Uji belum terkirim").count() == 0, "catatan tidak tampil lagi")
    # Isi Drive palsu dipulihkan dari potret terakhir sebelum halaman dimuat ulang.
    pg.evaluate("(s) => window.__drive.pulihkan(s)", simpan["potret"])
    cek(pg.evaluate("window.__drive.sheets.get('SP').tabs[0].rows.some(r => r[2] === 'Uji belum terkirim')"), "catatan lokal terkirim ke Drive sebelum dihapus dari perangkat")
    cek(any(r[1] == "Uji gaji" for r in baris_sheet(pg, "SP")), "isi Drive lain tetap utuh")
    buka_app_saya(pg, "drive")
    cek(pg.get_by_role("button", name="Sambungkan konektor Google Drive").count() == 1, "sambungan terputus setelah keluar")
    cek(not [e for e in galat if "Gagal" in e], f"tanpa galat JS ({galat})")
    b.close()

    print("3. Keluar saja: data tetap di perangkat; lalu dihapus lewat 'Hapus dari perangkat ini'")
    b, pg, galat, simpan = buka(p)
    hubungkan(pg)
    pg.locator("#btn-keluar-drive").click()
    pg.locator("#keluar-simpan").check()
    cek("Keluar, simpan data di perangkat" in pg.locator("[data-testid=keluar-drive-modal]").inner_text(), "tombol berubah mengikuti pilihan")
    pg.locator("#keluar-lanjut").click()
    pg.wait_for_selector("[data-testid=keluar-drive-modal]", state="detached", timeout=5000)
    pg.wait_for_timeout(500)
    cek(len(kunci_data(pg)) > 0, "data masih ada di perangkat setelah keluar saja")
    cek(pg.locator("#btn-hapus-data-perangkat").count() == 1, "tautan Hapus dari perangkat ini muncul karena data masih tersimpan")
    pg.locator("#btn-hapus-data-perangkat").click()
    pg.locator("[data-testid=keluar-drive-modal]").wait_for()
    cek(pg.locator("#keluar-hapus").count() == 0, "tanpa sambungan tidak ada pilihan simpan/hapus")
    cek(pg.locator("#keluar-lanjut").is_disabled(), "tombol hapus menunggu persetujuan (tidak ada tempat mengirim)")
    pg.locator("#keluar-setuju").check()
    tandai(pg)
    pg.locator("#keluar-lanjut").click()
    tunggu_muat_ulang(pg)
    cek(kunci_data(pg) == [], "perangkat bersih")
    buka_app_saya(pg, "drive")
    cek(pg.locator("#btn-hapus-data-perangkat").count() == 0, "tautan hilang karena tidak ada data lagi")
    b.close()

    print("4. Pengiriman gagal: penghapusan butuh persetujuan, Batal menyimpan data")
    b, pg, galat, simpan = buka(p)
    hubungkan(pg)
    pg.evaluate("window.__drive.gagal = { search_files: { code: 'tool_error', message: 'Drive sibuk' } }")
    pg.locator("#btn-keluar-drive").click()
    pg.locator("#keluar-lanjut").click()
    pg.locator("#keluar-galat").wait_for(timeout=10000)
    cek("belum terkirim akan hilang" in pg.locator("#keluar-galat").inner_text(), "peringatan data belum terkirim")
    cek(pg.locator("#keluar-lanjut").is_disabled(), "tombol hapus terkunci sampai disetujui")
    cek("Hapus tanpa terkirim" in pg.locator("[data-testid=keluar-drive-modal]").inner_text(), "tombol berubah menjadi Hapus tanpa terkirim")
    pg.locator("#keluar-batal").click()
    pg.wait_for_selector("[data-testid=keluar-drive-modal]", state="detached", timeout=5000)
    cek(len(kunci_data(pg)) > 0, "Batal: data tetap di perangkat")
    pg.locator("#btn-keluar-drive").click()
    pg.locator("#keluar-lanjut").click()
    pg.locator("#keluar-galat").wait_for(timeout=10000)
    pg.locator("#keluar-setuju").check()
    tandai(pg)
    pg.locator("#keluar-lanjut").click()
    tunggu_muat_ulang(pg)
    cek(kunci_data(pg) == [], "setelah persetujuan eksplisit perangkat bersih")
    b.close()

    print("5. Catatan penghapusan di salinan Sinkron.json lama (di Sampah) tidak hilang")
    seed = """
      const D = window.__drive; D.sampahTerlihat = true;
      const enc = new TextEncoder();
      D.tambahFile({ id: 'SN-LAMA', title: 'Sinkron.json', mimeType: 'application/json', parentId: 'F1',
        bytes: enc.encode(JSON.stringify({ terhapus: ['idp2'], diubah: {}, terakhirSinkron: '2026-10-23T14:37:35.000Z' })), modifiedTime: '2026-10-23T14:37:37.000Z' });
      D.trashed.add('SN-LAMA');
      // Perangkat ini belum tahu idp2 sudah dihapus: salinan lokalnya masih memuat baris itu.
      if (!localStorage.getItem('__seed5')) {
        localStorage.setItem('__seed5', '1');
        localStorage.setItem('pengeluaran-harian', JSON.stringify([{ id: 'idp2', jenis: 'pemasukan', dana: 'Dana Pribadi', tanggal: D.hariIni, deskripsi: 'Uji gaji', kategori: 'Gaji', jumlah: 5000000, metode: 'Transfer', kaitan: '', catatan: '', diubah: '2026-10-01T00:00:00.000Z', bukti: [] }]));
      }
      D.tambahFile({ id: 'SN-BARU', title: 'Sinkron.json', mimeType: 'application/json', parentId: 'F1',
        bytes: enc.encode(JSON.stringify({ terhapus: [], diubah: {}, terakhirSinkron: '2026-10-25T10:50:42.000Z' })), modifiedTime: '2026-10-25T10:50:43.000Z' });
    """
    b, pg, galat, simpan = buka(p, awal=seed)
    hubungkan(pg)
    teks = teks_riwayat(pg)
    cek("Uji gaji" not in teks and "Uji makan siang" in teks, "baris yang pernah dihapus tidak hidup lagi, yang lain tampil")
    buka_app_saya(pg, "drive")
    n0 = len(pg.evaluate("window.__drive.calls"))
    klik_opsi(pg, "Kirim Data Lokal ke Folder Keuangan")
    dlg = pg.locator(".dlg-artefak")
    dlg.wait_for(state="visible", timeout=5000)
    pg.locator(".dlg-artefak button.utama").click()
    pg.wait_for_function(
        """(n) => { const c = window.__drive.calls; return c.length > n && c[c.length - 1].tool === 'search_files' && /parentId/.test(c[c.length - 1].input.query); }""",
        arg=n0,
        timeout=30000,
    )
    pg.wait_for_timeout(500)
    cek(not any(r[1] == "Uji gaji" for r in baris_sheet(pg, "SP")), f"sheet Pribadi tidak memuat 'Uji gaji' ({[r[1] for r in baris_sheet(pg, 'SP')]})")
    sink = isi_sinkron(pg)
    cek(sink is not None and "idp2" in sink["terhapus"], f"Sinkron.json terbaru memuat idp2 ({sink and sink['terhapus']})")
    cek(not [e for e in galat if "Gagal" in e], f"tanpa galat JS ({galat})")
    b.close()

    print("6. Catatan ganda: kartu peringatan, jendela periksa, hapus, dan tercatat terhapus")
    seed = """
      const D = window.__drive; const h = D.hariIni;
      D.tambahSheet('SP', [
        ['1', h, 'Gemini AI Pro', 'Tagihan & Sewa', '', '77000', '', '', '', 'mvk6pobicrvjrm', 'Kartu debit/kredit', ''],
        ['2', h, 'Gemini Ai Pro', 'Tagihan & Sewa', '', '77000', '', '', '', 'muwsggn6vvjoi7', 'Tunai', ''],
        ['3', h, 'Kopi pagi', 'Makan & Minum', '', '20000', '', '', '', 'idk-1', 'Tunai', ''],
        ['4', h, 'Kopi pagi', 'Makan & Minum', '', '25000', '', '', '', 'idk-2', 'Tunai', ''],
      ]);
    """
    b, pg, galat, simpan = buka(p, awal=seed)
    hubungkan(pg)
    teks_riwayat(pg)
    kartu = pg.locator("[data-testid=kartu-data-ganda]")
    cek(kartu.count() == 1, "kartu peringatan data ganda tampil di Riwayat")
    cek("1 catatan kemungkinan tercatat dua kali" in kartu.inner_text(), f"menyebut satu catatan lebih ({kartu.inner_text()[:60]!r})")
    pg.locator("#ganda-periksa").click()
    modal = pg.locator("[data-testid=data-ganda-modal]")
    modal.wait_for()
    cek(pg.locator("[data-testid=kelompok-ganda]").count() == 1, "hanya Gemini yang dianggap ganda (Kopi beda jumlah)")
    kotak = pg.locator(".ganda-hapus")
    cek(kotak.count() == 2 and sum(1 for i in range(2) if kotak.nth(i).is_checked()) == 1, "satu dicentang untuk dihapus, satu dipertahankan")
    # Mencentang keduanya ditolak: satu catatan tiap kelompok selalu tersisa.
    sisa = [i for i in range(2) if not kotak.nth(i).is_checked()][0]
    cek(kotak.nth(sisa).is_disabled(), "catatan terakhir yang tersisa tidak bisa dicentang")
    cek(pg.locator(".ganda-hapus[data-id=mvk6pobicrvjrm]").is_checked() is False, "yang lebih baru dicatat (mvk...) dipertahankan")
    pg.locator("#ganda-hapus").click()
    cek("tidak bisa dibatalkan" in modal.inner_text(), "ada konfirmasi sebelum menghapus")
    pg.locator("#ganda-yakin").click()
    pg.wait_for_selector("[data-testid=data-ganda-modal]", state="detached", timeout=5000)
    cek(pg.locator("[data-testid=kartu-data-ganda]").count() == 0, "kartu hilang setelah dirapikan")
    cek(pg.evaluate("JSON.parse(localStorage.getItem('keuangan_terhapus_ids') || '[]')").count("muwsggn6vvjoi7") == 1, "ID yang dihapus tercatat sebagai terhapus")
    # Sinkron otomatis (5 detik) menuliskan perubahan ke Drive.
    pg.wait_for_function(
        "() => window.__drive.sheets.get('SP').tabs[0].rows.filter(r => r[2] === 'Gemini Ai Pro' || r[2] === 'Gemini AI Pro').length === 1",
        timeout=40000,
    )
    sink = None
    for _ in range(30):
        sink = isi_sinkron(pg)
        if sink and "muwsggn6vvjoi7" in sink["terhapus"]:
            break
        pg.wait_for_timeout(500)
    cek(sink is not None and "muwsggn6vvjoi7" in sink["terhapus"], "Sinkron.json di Drive memuat ID yang dihapus")
    cek([r[1] for r in baris_sheet(pg, "SP")].count("Kopi pagi") == 2, "Kopi pagi (beda jumlah) tetap dua")
    cek(not [e for e in galat if "Gagal" in e], f"tanpa galat JS ({galat})")
    b.close()

print()
if gagal:
    print(f"{len(gagal)} pemeriksaan GAGAL")
    sys.exit(1)
print("Semua uji lolos")
