# Catatan Keuangan Harian (React + TypeScript + Vite)

Aplikasi pencatatan keuangan harian pribadi dan kegiatan berbasis React, TypeScript, dan Vite yang tersinkronisasi dengan Google Sheets, dilengkapi dengan pelacakan portofolio aset, anggaran harian, grafik tren pengeluaran, serta tema Jujutsu Kaisen interaktif.

## Fitur Utama

- **Pencatatan Transaksi Harian**:
  - Pemasukan dan pengeluaran untuk **Dana Pribadi** dan **Dana Kegiatan**.
  - Kategori otomatis sesuai pos anggaran.
  - Perekaman metode bayar (Tunai, Transfer, QRIS, E-wallet, Kartu debit/kredit).
  - Kolom sumber/tujuan dana, kaitan kegiatan, dan catatan.
- **Ringkasan & Anggaran Harian**:
  - Saldo kumulatif per dana serta arus kas bulan berjalan.
  - Meter anggaran pengeluaran harian dengan indikator persentase dan peringatan limit.
  - Pengelompokan riwayat transaksi per hari dengan subtotal.
  - Filter cepat per jenis dana (Semua Dana, Dana Pribadi, Dana Kegiatan).
- **Pelacakan Aset**:
  - **Emas Antam**: Perhitungan nilai berdasarkan gram dan harga pasar emas (serta buyback).
  - **Kripto**: Pelacakan koin (BTC, ETH, SOL, BNB, dll.) dengan harga pasar real-time dari CoinGecko dalam IDR.
  - **JMO / BPJS Ketenagakerjaan JHT**: Proyeksi pertumbuhan saldo berdasarkan iuran bulanan 5,7% upah dan suku bunga tahunan majemuk bulanan.
  - **Investasi**: Modal tumbuh dengan skema bunga sederhana, majemuk tahunan, atau majemuk bulanan.
  - Perhitungan untung/rugi total dan per aset (nominal Rp & persentase).
- **Grafik & Analisis**:
  - Grafik batang tren pemasukan dan pengeluaran 6 bulan terakhir.
  - Tabel rekapitulasi 6 bulan (Pemasukan, Pengeluaran, Selisih/Saldo).
  - Rekapitulasi pengeluaran dan pemasukan per kategori bulan berjalan.
- **Sinkronisasi Google Sheets**:
  - Kompatibel dengan Google Apps Script Web App untuk membaca (`GET`) dan menyimpan (`POST`) transaksi secara dua arah.
  - Penyalinan dan pengunduhan kode `Code.gs` langsung dari aplikasi.
- **Tema & Visual Jujutsu Kaisen**:
  - Pilihan karakter: **Gojo Satoru**, **Ryomen Sukuna**, **Jogo**, dan **Nanami Kento**.
  - Palet warna dinamis, lambang hanko (無, 宿, 火, 七), dan partikel energi kutukan.
  - Tab **Saya** berupa layar aplikasi: Drive Keuangan, Laporan Kegiatan (termasuk Profil Pelapor), Keluarga, Tema & Karakter, Transaksi Rutin, dan Kunci Aplikasi tampil sebagai ikon; ketuk untuk membuka isinya.
  - Pilihan beralih ke Tema Standar.
- **Keluarga & Komunitas** (tab Saya → Keluarga):
  - Terhubung lewat **kode QR**: anggota menampilkan *Kode saya* (nama dan email Google), pemilik data memindainya dengan
    kamera, foto kode, atau menempel teks kodenya.
  - Pemilik memilih dana yang boleh dilihat: **Dana Pribadi** dan/atau **Dana Kegiatan** (bawaan: Kegiatan saja), dan bisa
    mengubahnya kapan saja lewat saklar. Tanpa server perantara: aplikasi memberi izin *baca* pada spreadsheet Keuangan
    Pribadi/Kegiatan di Google Drive pemilik, sehingga dana yang tidak dipilih memang ditolak oleh Google.
  - Daftar "Terhubung dengan saya" dibaca dari izin Drive yang sebenarnya; "Dibagikan kepada saya" menampilkan data orang
    lain secara baca-saja (ringkasan per bulan dan transaksi terbaru), tidak digabung dengan data sendiri.
  - Peringatan bila folder atau berkas keuangan bertautan publik ("siapa saja yang punya tautan"), karena itu melemahkan
    pilihan dana. Timesheet tidak pernah ikut dibagikan.
- **Folder Keuangan Otomatis**: begitu aplikasi dipasang (atau saat masuk Google pertama kali) dan folder `Keuangan` belum
  ada, aplikasi membuatnya beserta `Bukti Transaksi/Pribadi`, `Bukti Transaksi/Kegiatan`, `Laporan Kegiatan`, dan
  spreadsheet Keuangan Pribadi/Kegiatan tahun berjalan. Aman diulang: yang sudah ada dipakai, tidak dibuat kembar, dan
  gangguan jaringan sesaat tidak pernah membuat folder kedua.
- **Kunci Aplikasi + Google Authenticator** (tab Saya → Kunci Aplikasi): PIN dan sidik jari, ditambah langkah kedua
  berupa kode 6 angka dari Google Authenticator (TOTP standar RFC 6238). Entri di Authenticator diberi nama akun email
  Google Drive yang tertaut. Rahasianya hanya di perangkat (tidak ke Drive), kode tidak bisa dipakai ulang, salah berulang
  memberi jeda, dan menonaktifkannya butuh kode yang sah. Kode diminta tiap kunci dibuka, atau sekali per 8/24 jam.
- **Aman dipasang ulang**: setelah aplikasi dipasang ulang (penyimpanan lokal kosong) data ditarik dari Drive lebih dulu;
  kirim ke Drive ditahan sampai tarik selesai tanpa galat, folder dan berkas dicari sebelum dibuat (galat pencarian tidak
  pernah membuat folder kembar), dan baris spreadsheet tanpa ID mendapat ID tetap sehingga tidak berganda.
- **Tanpa data pribadi bawaan**: Profil Pelapor kosong sampai pemakai mengisinya, dan tidak ada ID folder Drive di kode.
- **Ekspor Data**:
  - Unduh seluruh riwayat transaksi dalam format CSV ber-BOM UTF-8.

## Menjalankan Aplikasi

```bash
# Instalasi dependensi
npm install

# Menjalankan dev server pada port 3000
npm run dev

# Membangun versi produksi
npm run build
```

## Situs (GitHub Pages)

Situs dibangun dengan `vite build` oleh workflow `.github/workflows/pages.yml` setiap ada push ke `main`,
lalu disajikan di <https://zalukhunopal-tech.github.io/Tugas-harian/>. Sekali saja, di GitHub:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Situs ini statis, jadi fitur yang butuh `server.ts` (baca struk dan surat justifikasi dengan Gemini) hanya
jalan saat aplikasi dijalankan dengan `npm run dev` / di Google AI Studio. Login Google di situs ini butuh
domain `zalukhunopal-tech.github.io` terdaftar di Firebase → Authentication → Authorized domains
(detail di [SECURITY.md](SECURITY.md)).

## Alur kerja: Google AI Studio ↔ GitHub ↔ Claude

Repo ini disinkronkan dua arah dengan Google AI Studio, dan Claude juga mengubah kode di sini. Supaya
perubahan tidak saling menimpa:

1. **Ambil dulu sebelum mengedit.** Sebelum mulai mengedit di AI Studio, ambil/impor versi terbaru dari
   GitHub. Jika tidak, AI Studio bisa mendorong kembali versi lamanya dan menimpa perbaikan dari Claude
   (misalnya tipe di `LaporanView.tsx` atau berkas di `.github/workflows/`).
2. **Satu sisi dalam satu waktu.** Selesaikan dan sinkronkan satu sisi (AI Studio atau Claude) sebelum
   mulai di sisi lain.
3. **Berkas yang dikelola AI Studio** (`package.json`, `vite.config.ts`, `server.ts`,
   `firebase-applet-config.json`, `metadata.json`) sengaja tidak diubah oleh perbaikan dari Claude kecuali
   perlu.
4. **Jangan aktifkan "Require a pull request" pada `main`** bila AI Studio mendorong langsung ke `main`
   (lihat [SECURITY.md](SECURITY.md)).
5. Setelah merge ke `main`, workflow *Deploy GitHub Pages* memperbarui situs otomatis, dan *Keamanan & uji*
   memeriksa rahasia serta tipe TypeScript (`npx tsc --noEmit`).
6. **Artefak Claude** dibangun terpisah dari folder `artefak/` (lihat [artefak/README.md](artefak/README.md)); build biasa dan GitHub Pages tidak memakainya, dan AI Studio tidak perlu mengubahnya.
