# Artefak Claude (mode konektor Drive)

Folder ini berisi cara membangun aplikasi ini sebagai **artefak di claude.ai**. Kode aplikasi di `src/` tidak
diubah dan folder ini tidak dipakai build biasa (`npm run build`) maupun GitHub Pages. Google AI Studio tidak
perlu menyentuhnya.

## Kenapa perlu build terpisah

Sandbox artefak memblokir jaringan keluar, popup login, service worker, dan kotak dialog bawaan browser. Karena
itu build artefak berbeda dari build biasa:

| Di aplikasi | Di artefak | Berkas |
|---|---|---|
| Login Google lewat Firebase | "Masuk" = izin memakai konektor Google Drive dan Google Sheets milik akun Claude pemilik halaman | `googleAuth.artefak.ts` |
| `fetch` ke `googleapis.com` dengan token | Diterjemahkan ke panggilan konektor (`claude.mcp.callTool`) | `konektor.ts` |
| Sinkron Drive berjalan paralel | Operasi tulis diantre satu per satu | `antrean.ts`, `gdriveSync.artefak.ts` |
| `confirm()` | Saat build, setiap `confirm(...)` di `src/` diubah menjadi `(await __konfirmasi(...))` dan fungsi pembungkusnya menjadi `async`; dialognya ada di halaman. Sandbox membuat `confirm()` selalu false, jadi tanpa ini tombol Hapus dan Kirim manual diam saja | `ubah-konfirmasi.ts`, `dialog.ts` |
| `alert()` | Dialog di halaman | `dialog.ts` |
| PWA / service worker | Dimatikan | `vite.config.ts` |

`vite.config.ts` memasang semuanya lewat alias dan plugin; tidak ada berkas di `src/` yang diedit (pengubah
`confirm` bekerja pada kode di memori saat build, memakai API compiler TypeScript). Panggilan `confirm` yang tidak
bisa diubah (di luar fungsi, di dalam method/konstruktor) dilaporkan sebagai peringatan build dan tetap
ditangani pengganti sinkron lama di `dialog.ts`, yang bekerja dengan mengklik ulang tombol pemicu dan gagal
bila tombol itu sudah hilang saat `confirm` dipanggil.
Beberapa teks di `SayaView.tsx` ("Masuk dengan Google", "Sesi 3 bulan") diganti saat build; bila teks
sumbernya berubah, penggantian dilewati dengan peringatan build.

## Membangun

```bash
npm install
npx vite build --config artefak/vite.config.ts   # hasil: dist-artefak/
```

## Menerbitkan

Terbitkan `dist-artefak/index.html` beserta `assets/` dan berkas publik lainnya (kecuali
`Catatan-Keuangan-Android.zip`, unduhan tidak jalan di sandbox) dengan deklarasi konektor ini:

```json
{
  "mcp": {
    "servers": [
      { "server": "Google Drive", "tools": ["search_files", "get_file_metadata", "download_file_content", "create_file", "copy_file", "trash_file", "share_file", "get_file_permissions"] },
      { "server": "Google Sheets", "tools": ["get_spreadsheet", "get_values", "update_values", "batch_clear_values"] }
    ]
  }
}
```

Hanya pemilik akun Claude yang punya konektor itu yang bisa memakai sinkron; pemirsa lain tetap bisa memakai
aplikasi dengan data di browser masing-masing.

## Yang didukung dan batasnya

`konektor.ts` hanya menerjemahkan endpoint yang dipakai `src/lib/gdriveSync.ts` dan `docxGenerator.ts`:
cari/baca/unggah file, buat folder, salin file, baca/tulis/kosongkan sel sheet. Permintaan lain dijawab `501`
dengan pesan yang jelas. Bila `gdriveSync.ts` memakai endpoint baru, tambahkan terjemahannya di `tangani()`.

- **Tarik dulu, baru kirim.** Artefak dibuka dengan data lokal kosong, sedangkan "kirim" menulis ulang sheet
  dari data lokal dan mengosongkan sheet tahun yang tidak ada di data lokal. Karena itu sambungan pertama
  langsung menarik data (seperti login Firebase di aplikasi), dan `gdriveSync.artefak.ts` menolak "kirim"
  sampai satu "tarik" selesai tanpa galat baca. Galat baca per spreadsheet ditelan aplikasi, jadi
  kelengkapan tarik dinilai dari hitungan galat di `konektor.ts`.
- **Menimpa isi file** tidak ada di konektor Drive. `Aset/Sinkron/Pengaturan/Laporan Kegiatan.json` dan laporan
  `.docx` ditimpa dengan membuat file baru lalu memindahkan yang lama ke **Sampah** (ID file berubah; ID lama
  tetap diarahkan ke file terbaru supaya tidak muncul file kembar). Isi yang
  sama (selain cap waktu `terakhirSinkron`/`terakhirDiubah`) dilewati supaya Sampah tidak menumpuk. File lain
  ditolak (`403`).
- **Membuat spreadsheet baru** tidak ada di konektor Sheets. Tahun baru dibuat lewat salinan file tahun lalu
  (jalur utama di aplikasi); folder tanpa spreadsheet sama sekali dijawab `501`.
- **Timesheet perdiem** (`src/lib/timesheetDrive.ts`): file di folder Keuangan yang namanya memuat "timesheet" hanya
  dibaca (Keterangan dan Lokasi per tanggal) dan dikeluarkan dari daftar sheet keuangan. File baru untuk batch baru
  dibuat lewat `copy_file` dari file timesheet terbaru, dikosongkan (`batch_clear_values`) lalu diisi
  (`update_values`, tanggal berawalan apostrof agar tetap teks). Nama tab tidak bisa diganti (tidak ada `batchUpdate`)
  dan baris di atas kapasitas 34 hari tidak berformat. File timesheet yang sudah ada tidak pernah ditulis.
- **Keluarga & Komunitas** (`src/lib/berbagi.ts`, `berbagiDrive.ts`, `components/KeluargaView.tsx`): berbagi memakai izin
  Google Drive (`share_file`, peran baca saja) dan membaca izin lewat `get_file_permissions`; "Dibagikan kepada saya"
  memakai `search_files` dengan `sharedWithMe = true`. Batas konektor: **tidak ada pencabutan izin** dan jawaban
  `get_file_permissions` tidak menyertakan ID izin, jadi `DELETE .../permissions/{id}` dijawab `501`. Aplikasi lalu
  menampilkan petunjuk "cabut sendiri di Google Drive" dengan tautan berkas, dan daftar anggota tetap mengikuti izin
  Drive yang sebenarnya (saklar tidak pura-pura mati). Email akun sendiri (untuk Kode saya) diambil dari izin berperan
  `owner` pada berkas keuangan, karena profil konektor tidak memuat email. Pemindai kamera memakai `getUserMedia`, yang
  bisa diblokir sandbox; foto kode dan tempel kode tetap tersedia.
- **Folder Keuangan otomatis** (`src/lib/setupDrive.ts`): folder dan subfolder dibuat lewat `create_file`; spreadsheet tahun
  berjalan hanya bisa dibuat bila ada spreadsheet lain di folder untuk disalin. Pada folder yang benar-benar kosong
  langkah itu dilaporkan sebagai "Belum bisa" (bukan dilewati diam-diam).
- **Tarik dulu berlaku di semua build.** `kirimSemuaKeDrive` di `src/lib/gdriveSync.ts` menolak (GalatBelumTarik) sampai satu
  tarik selesai tanpa galat baca; pembungkus artefak punya penjaga sendiri yang bertumpuk dengan ini. Setelah pasang ulang,
  `App.tsx` menarik dulu sebelum mengirim. `uji_konektor.py` langkah 15 memuat ulang halaman dengan penyimpanan kosong
  (isi Drive palsu dipulihkan dari potret lewat `D.potret/D.pulihkan` di `tiruan-konektor.js`).
- Nilai sel datang sebagai teks terformat (`valueRenderOption` diabaikan); pembaca di aplikasi sudah menanganinya.
- Satu sinkron = puluhan panggilan berurutan, jadi lebih lambat daripada lewat REST. Sinkron otomatis 5 detik
  setelah perubahan tetap berjalan, tetapi tidak pernah dua sekaligus.
- Unduh CSV dan Word tidak jalan di sandbox (unduhan diblokir).
- Baca struk dan surat justifikasi dengan Gemini butuh `server.ts`, tidak tersedia di artefak.

## Pengujian

Tanpa akun Claude: `uji/tiruan-konektor.js` adalah Google Drive + Sheets palsu di memori dengan bentuk jawaban
yang sama dengan konektor asli (search_files, get_file_metadata, download_file_content, get_values,
get_spreadsheet diamati dari panggilan nyata; jawaban tulis ditiru dengan fallback bila bentuknya berbeda).

```bash
npx tsx artefak/uji/uji_antrean.ts                        # antrean tulis, tanpa browser
npx tsx artefak/uji/uji_ubah_konfirmasi.ts                # pengubah confirm -> await, termasuk seluruh src/
npx vite build --config artefak/vite.config.ts
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist-artefak &
python3 artefak/uji/uji_konektor.py http://127.0.0.1:8766/ [/path/ke/chromium]
python3 artefak/uji/uji_timesheet.py http://127.0.0.1:8766/ [/path/ke/chromium]   # timesheet perdiem
python3 artefak/uji/uji_saya.py http://127.0.0.1:8766/ [/path/ke/chromium]         # tab Saya (layar aplikasi), Laporan di Saya
python3 artefak/uji/uji_keluarga.py http://127.0.0.1:8766/ [/path/ke/chromium]      # Keluarga (QR, dana, izin), folder Keuangan otomatis
npx tsx scripts/uji_berbagi.ts                             # logika kode QR dan rencana izin
npx tsx scripts/uji_drive_rest.ts                          # jalur REST (izin dengan ID, pencabutan, penyiapan folder)
npx tsx scripts/uji_pasang_ulang.ts                        # pasang ulang: tarik dulu, tanpa berkas/baris ganda, galat tidak membuat folder
npx tsx scripts/uji_totp.ts                                # Google Authenticator: vektor RFC 4226/6238, jendela, jeda, pemakaian ulang
npx tsx scripts/uji_data_ganda.ts                          # pencarian catatan kembar (huruf besar/kecil, metode bayar), urutan yang dipertahankan
npx tsx scripts/uji_bersih_perangkat.ts                    # kunci data yang dihapus saat keluar; tema tetap
npx tsx scripts/uji_docx_perdiem.ts                        # Word: daftar perdiem di bagian lanskap, bagian lain potret, tanpa halaman kosong
python3 artefak/uji/uji_totp.py http://127.0.0.1:8766/ [/path/ke/chromium]          # Authenticator di layar kunci (kode dihitung di Python)
python3 artefak/uji/uji_form_transaksi.py http://127.0.0.1:8766/ [/path/ke/chromium]   # Formulir transaksi tablet/PC rapi, HP satu kolom, Rincian Dana Kegiatan di HP, tombol kembali opak
python3 artefak/uji/uji_bersih.py http://127.0.0.1:8766/ [/path/ke/chromium]            # Keluar = bersihkan perangkat, catatan terhapus tetap terhapus, data ganda
bash scripts/periksa_data_pribadi.sh                       # tanpa ID Drive, email nyata, bawaan profil, atau .zip di repo
```

`uji_konektor.py` (Playwright) menguji: hubungkan dan tarik data, dialog konfirmasi, kirim manual dan otomatis,
file keadaan tidak ditimpa bila tak berubah, pemulihan sambungan, konektor/izin tidak ada, indeks pencarian
lambat, jawaban tulis tanpa `id`, penjaga tarik-dulu, penimpaan lewat ID lama, dan hapus lewat menu tekan-lama
(menu menutup dirinya sebelum meminta konfirmasi).
