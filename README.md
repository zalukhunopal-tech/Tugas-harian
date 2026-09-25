# Tugas-harian
Memuat kode automasi untuk tugas harian

## Catatan Keuangan Harian

Halaman web sederhana di folder [`pengeluaran/`](pengeluaran/) untuk mencatat pemasukan dan pengeluaran harian,
tersinkron dengan Google Sheets di folder Drive *Keuangan*.

- Buka di <https://zalukhunopal-tech.github.io/Tugas-harian/pengeluaran/> (GitHub Pages, perlu diaktifkan sekali:
  *Settings → Pages → Deploy from a branch → main / (root)*), atau buka `pengeluaran/index.html` langsung di browser.
- **Tampilan depan** hanya memuat saldo **Dana Pribadi** dan **Dana Kegiatan** serta form tambah transaksi.
  Bagian lain (daftar transaksi, ringkasan kategori, sinkronisasi, tema) dilipat seperti folder dan terbuka saat diklik.
- Transaksi **pemasukan** atau **pengeluaran** dicatat ke salah satu dana. Kategorinya persis sama dengan panel
  kategori di sheet *Keuangan Pribadi 2026* / *Keuangan Kegiatan 2026*, ditambah kolom Sumber/Tujuan atau Kaitan Kegiatan.
- **Sinkronisasi Google Sheets**: setiap transaksi otomatis ditulis ke sheet yang sesuai, dan isi sheet ditarik saat
  halaman dibuka. Perantaranya Google Apps Script yang dipasang sekali; panduan di
  [`pengeluaran/apps-script/README.md`](pengeluaran/apps-script/README.md). Tanpa itu, data tetap tersimpan di
  `localStorage` browser.
- Ubah/hapus transaksi, filter per tanggal dan dana, anggaran pengeluaran harian, ringkasan per kategori, unduh CSV.
- **Tema Jujutsu** (bawaan) dengan pilihan karakter — Gojo, Sukuna, Jogo, Nanami — yang mengubah palet warna dan
  lambang, serta efek **Perluasan Domain** (領域展開) lewat tombol di pojok kanan atas. Tema standar tetap tersedia;
  animasi mati otomatis bila perangkat mengaktifkan *reduce motion*.
