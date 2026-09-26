# Tugas-harian
Memuat kode automasi untuk tugas harian

## Catatan Keuangan Harian

Halaman web sederhana di folder [`pengeluaran/`](pengeluaran/) untuk mencatat pemasukan dan pengeluaran harian,
tersinkron dengan Google Sheets di folder Drive *Keuangan*.

- Buka di <https://zalukhunopal-tech.github.io/Tugas-harian/pengeluaran/> (GitHub Pages, perlu diaktifkan sekali:
  *Settings → Pages → Deploy from a branch → main / (root)*), atau buka `pengeluaran/index.html` langsung di browser.
- Transaksi **pemasukan** atau **pengeluaran** dicatat ke salah satu dana. Kategorinya persis sama dengan panel
  kategori di sheet *Keuangan Pribadi 2026* / *Keuangan Kegiatan 2026*, ditambah kolom Sumber/Tujuan atau Kaitan Kegiatan.
- **Sinkronisasi Google Sheets**: setiap transaksi otomatis ditulis ke sheet yang sesuai, dan isi sheet ditarik saat
  halaman dibuka. Perantaranya Google Apps Script yang dipasang sekali; panduan di
  [`pengeluaran/apps-script/README.md`](pengeluaran/apps-script/README.md). Di halaman biasa (GitHub Pages / file
  lokal) aplikasi memanggil Web App Apps Script; di halaman artifact Claude aplikasi memakai konektor Google Drive
  dan antrean yang diproses Apps Script setiap menit. Tanpa sinkronisasi, data tetap tersimpan di `localStorage` browser.
- Ubah/hapus transaksi, filter per tanggal dan dana, anggaran pengeluaran harian, ringkasan per kategori, unduh CSV.
- **Aset**: emas (harga Antam dari Logam Mulia), kripto (CoinGecko), saldo JHT BPJS Ketenagakerjaan (proyeksi
  mengikuti skema iuran 5,7% + hasil pengembangan tahunan), dan investasi lain (bunga rata-rata). Total nilai,
  untung/rugi, dan harga pasar yang diperbarui tiap jam oleh Apps Script.
- **Tampilan dashboard**: bilah atas dengan pemilih bulan dan ringkasan Pengeluaran / Pemasukan / Saldo, daftar
  transaksi dikelompokkan per hari, navigasi bawah (Riwayat, Aset, +, Grafik, Saya), font Plus Jakarta Sans.
- **Keamanan**: kunci sinkron untuk Web App, pemindai rahasia di CI, CODEOWNERS; langkah pengamanan akun di
  [SECURITY.md](SECURITY.md).
- **Tema Jujutsu** (bawaan) dengan pilihan karakter — Gojo, Sukuna, Jogo, Nanami — yang mengubah palet warna dan
  lambang, serta efek **Perluasan Domain** (領域展開) lewat tombol di pojok kanan atas. Tema standar tetap tersedia;
  animasi mati otomatis bila perangkat mengaktifkan *reduce motion*.
