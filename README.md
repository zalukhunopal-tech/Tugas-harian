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
  - Tab **Saya** berupa layar aplikasi: Drive Keuangan, Laporan Kegiatan (termasuk Profil Pelapor), Keluarga, Tema & Karakter, Transaksi Rutin, dan Kunci Aplikasi tampil sebagai ikon; ketuk untuk membuka isinya. Pengatur ukuran ikon mengubah gambar, huruf, jarak baris, bantalan, dan jarak antarpilihan secara sebanding.
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
- **Laporan Dana Kegiatan** (tab Saya → Laporan Kegiatan):
  - **Kudapan Perjalanan**: subkategori Konsumsi dengan plafon sepertiga uang harian Kalimantan (Rp200.000 / 3 = Rp66.667 per
    orang). Nama staf penerima dicatat sebagai tag; jumlah mengikuti plafon, tetap bisa disesuaikan dengan struk riil.
  - **Penerima Manfaat** ("numpang klaim") untuk kategori lain (akomodasi, transportasi, konsumsi, perlengkapan, dst.); nama
    tercantum di bawah uraian pada tabel laporan, Word, dan kepala kotak tempel. Daftar nama staf hanya tersimpan di perangkat.
  - **Cetak**: timesheet uang harian dicetak A4 **lanskap**, dokumen lain A4 **potret** (halaman bernama CSS). Tersedia tombol
    *Cetak Semua Dokumen*, *Cetak Khusus Timesheet (Lanskap)*, dan *Cetak Dokumen Klaim & Nota (Potret)* untuk peramban ponsel
    yang mengabaikan halaman bernama (orientasi di jendela cetak Android tetap perlu dicocokkan). Tabel mengalir penuh halaman:
    kepala berulang, Total dan tanda tangan hanya di akhir.
  - **Pra-kegiatan**: pengeluaran bertanggal sebelum tanggal mulai kegiatan (tiket berangkat, belanja awal) ikut masuk laporan.
  - **Lampiran Bukti** (A4 potret, area 190 × 277 mm): foto bukti digital dan kotak kosong tempat nota/struk/tiket asli ditempel
    berada di **satu lembar yang sama** per pengeluaran dan tidak terbelah antarhalaman. Tipe A (struk): foto di kiri, area tempel
    92 × 120 mm di kanan, dua kartu per halaman; Tipe B (kuitansi/tiket, area 190 × 76 mm) dan Tipe C (kuitansi besar/faktur,
    190 × 120 mm): foto di atas, area tempel di bawah, satu kartu per halaman. Pengeluaran tanpa foto mendapat kotak tempel ringkas
    (A 92 × 132 mm berpasangan, B 190 × 88 mm, C 190 × 132 mm). Ukuran dipilih otomatis menurut jenis bukti dan kategori, bisa diubah
    per pengeluaran. Dokumen Word memakai tata letaknya sendiri.
  - Kartu ringkasan saldo di Laporan: empat kartu sebaris di PC (≥ 1024 px), 2 × 2 di tablet, label di atas dan nominal di bawah sejajar.
- **Umur Pakai & Penyusutan Barang** (opsional, di formulir pengeluaran): centang *Hitung Penyusutan & Umur Barang*, pilih preset
  (oli mesin 2.000 km, oli gardan 8.000 km, kampas rem, aki, ban, baterai, busi, rantai & gir; laptop, ponsel, kendaraan, peralatan,
  perabot) atau isi manual, dengan basis **waktu kalender** (hari/bulan/tahun) atau **pemakaian** (km/jam). Rumus: garis lurus
  `D = (C − S) / n`, `BV = C − D × t`, `P_sisa = BV / C × 100%`; saldo menurun ganda `R = 2 / n`, `BV = C × (1 − R)^t` (minimal S);
  sisa umur `Sisa Hari = Total Umur − (hari ini − tanggal beli)` atau `Sisa KM = Batas − (KM sekarang − KM saat ganti)`. Bila sisa nilai
  **atau** sisa umur ≤ 30%: lencana kuning/merah menyala, banner di Riwayat dan Aset, bilah merah. Di tab Aset: perbarui KM, tandai
  "sudah diganti/diservis", atau hapus pantauan. Pantauan disimpan di pengaturan (ikut tersinkron) dan terhapus bersama transaksinya.
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
