# Catatan Keuangan Harian (React + TypeScript + Vite)

Aplikasi pencatatan keuangan harian pribadi dan kegiatan berbasis React, TypeScript, dan Vite yang tersinkronisasi dengan Google Sheets, dilengkapi dengan pelacakan portofolio aset, anggaran harian, grafik tren pengeluaran, serta tema Jujutsu Kaisen interaktif.

## Fitur Utama

- **Pencatatan Transaksi Harian**:
  - Pemasukan dan pengeluaran untuk **Dana Pribadi** dan **Dana Kegiatan**.
  - Kategori otomatis sesuai pos anggaran.
  - Perekaman metode bayar (Tunai, Transfer, QRIS, E-wallet, Kartu debit/kredit).
  - Kolom sumber/tujuan dana, kaitan kegiatan, dan catatan.
  - **Kategori** pengeluaran berupa ubin sama ukuran (2 kolom di HP, 3 kolom di tablet dan PC).
  - **Penerimaan Dana** (pemasukan Dana Kegiatan) hanya berisi tanggal, **Nama/Judul Kegiatan**, jumlah, metode, dan lampiran bukti.
    Judul yang sama dengan kegiatan yang sudah ada dipakai ulang, judul baru membuat kegiatan baru otomatis; judul itulah patokan
    utama laporan kegiatan. Tidak ada lagi bagian Kelengkapan SPJ di form ini.
  - **Scan Struk Belanja (Gemini AI)** dan lampiran bukti/foto pendukung tersusun rapi di HP (tombol sama lebar sebaris).
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
  - Tab **Saya** berupa layar aplikasi: Sinkron (Drive Keuangan), Laporan (Laporan Kegiatan, termasuk Profil Pelapor), Depresiasi (Depresiasi Aset), Keluarga, Tampilan (tema dan karakter), Rutin (transaksi berulang), dan Keamanan (Kunci Aplikasi dan Authenticator) tampil sebagai ikon dengan judul satu kata; ketuk untuk membuka isinya. Pengatur ukuran ikon mengubah gambar, huruf, jarak baris, bantalan, dan jarak antarpilihan secara sebanding.
  - Pilihan beralih ke Tema Standar.
- **Drive Keuangan** (tab Saya → Sinkron): tampilan utamanya hanya judul **Sinkronisasi Data**, lingkaran berlogo Google Drive,
  dan nama akun. **Tekan dan tahan lingkaran 3 detik**: cincin terisi searah jarum jam (lepas sebelum penuh = batal), lalu aplikasi
  otomatis memastikan akses, menyiapkan folder Keuangan bila belum ada, menarik dan menggabungkan isi Drive, lalu mengirim hasilnya
  (kirim hanya berjalan bila tarik lengkap, jadi isi Drive tidak tertimpa). Bisa juga dengan keyboard: tahan Spasi atau Enter.
  Pengaturan lain tetap ada, dilipat di **Opsi lanjutan**: tarik saja, kirim saja, periksa folder, perbarui akses, unduh CSV, isi
  folder, ganti atau tambah akun, dan rincian sesi.
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
- **Laporan Dana Kegiatan** (tab Saya → Laporan):
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
- **Depresiasi Aset** (tab Saya → Depresiasi): setelah pengeluaran barang yang **bukan sekali pakai** dicatat (laptop, ponsel,
  ban, aki, oli, dan sejenisnya; makan, bensin, pulsa, tiket, sewa, dan servis tidak ditawari), aplikasi menawarkan *Hitung depresiasi?*.
  Selain lewat tawaran itu, formulir pengeluaran punya kotak centang **Masukkan ke Depresiasi Aset**: dicentang, umur dan metode terisi
  otomatis dari uraian barang (tanpa input ulang di menu aset); bila sudah dicentang atau dilepas, tawaran setelah simpan tidak muncul lagi.
  Hanya yang disetujui masuk daftar, dengan isian terisi otomatis dari **basis data umur** (`src/lib/basisDataUmur.ts`: 32 barang motor,
  mobil, elektronik, dan aset, tiap angka memuat rentang dan sumbernya; yang belum bersumber tegas ditandai "perkiraan umum").
  Barang lama bisa ditambahkan lewat *Tambah aset* atau tombol *Pantau* di daftar umur standar. Metode: garis lurus, saldo menurun
  ganda, jumlah angka tahun, dan unit produksi (km atau jam); umur bisa dihitung dengan waktu kalender, pemakaian, atau **batas ganda**
  (mis. oli 2.000 km atau 2 bulan, mana yang lebih dulu). Rumus: `D = (C − S) / n`, `BV = C − D × t`; `R = 2 / n`,
  `BV = C × (1 − R)^t`; SYD `A = (C − S) × t × (2n − t + 1) / (n(n + 1))`; `Sisa Hari = Total Umur − (hari ini − tanggal beli)` atau
  `Sisa KM = Batas − (KM sekarang − KM saat ganti)`. Bila sisa nilai **atau** sisa umur ≤ 30%: lencana menyala, banner di Riwayat dan
  di layar Depresiasi Aset, titik merah berangka di menu Saya, dan bilah merah. Di layar ini: ringkasan nilai buku, saringan, perbarui
  km, "sudah diganti/diservis", ubah data, hapus pantauan, serta **Pedoman Depresiasi** (rumus, kelompok masa manfaat PMK 72/2023, daftar
  umur standar, sumber riset). Salinan lengkap pedoman: [`docs/pedoman-depresiasi-aset.md`](docs/pedoman-depresiasi-aset.md).
  Pantauan disimpan di pengaturan (ikut tersinkron) dan terhapus bersama transaksinya.
- **Transaksi Berulang** dikelola hanya di tab Saya → Rutin. Di Riwayat, banner pengingat hanya muncul bila transaksi serupa
  (jenis, dana, kategori, dan uraian sama) untuk periode berjalan belum ada; tombol **Catat sekarang** mengisi transaksi sesuai jadwal
  (tanggal, jumlah, kategori, dan dana dari jadwal), dan jadwal yang sudah tercatat tidak pernah digandakan.
- **Folder Keuangan Otomatis**: begitu aplikasi dipasang (atau saat masuk Google pertama kali) dan folder `Keuangan` belum
  ada, aplikasi membuatnya beserta `Bukti Transaksi/Pribadi`, `Bukti Transaksi/Kegiatan`, `Laporan Kegiatan`, dan
  spreadsheet Keuangan Pribadi/Kegiatan tahun berjalan. Aman diulang: yang sudah ada dipakai, tidak dibuat kembar, dan
  gangguan jaringan sesaat tidak pernah membuat folder kedua.
- **Kunci Aplikasi + Google Authenticator** (tab Saya → Keamanan): PIN dan sidik jari, ditambah langkah kedua
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
