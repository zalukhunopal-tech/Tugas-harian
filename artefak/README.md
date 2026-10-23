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
| `confirm()` / `alert()` | Dialog di halaman (sandbox membuat `confirm()` selalu false, jadi tombol Hapus dan Kirim manual diam saja) | `dialog.ts` |
| PWA / service worker | Dimatikan | `vite.config.ts` |

`vite.config.ts` memasang semuanya lewat alias dan satu plugin HTML; tidak ada berkas di `src/` yang diedit.
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
      { "server": "Google Drive", "tools": ["search_files", "get_file_metadata", "download_file_content", "create_file", "copy_file", "trash_file"] },
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
npx vite build --config artefak/vite.config.ts
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist-artefak &
python3 artefak/uji/uji_konektor.py http://127.0.0.1:8766/ [/path/ke/chromium]
```

`uji_konektor.py` (Playwright) menguji: hubungkan dan tarik data, dialog konfirmasi, kirim manual dan otomatis,
file keadaan tidak ditimpa bila tak berubah, pemulihan sambungan, konektor/izin tidak ada, indeks pencarian
lambat, jawaban tulis tanpa `id`, penjaga tarik-dulu, dan penimpaan lewat ID lama.
