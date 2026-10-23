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
  - Efek animasi Kanvas **Perluasan Domain** (領域展開) penuh layar sesuai karakter.
  - Pilihan beralih ke Tema Standar.
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
