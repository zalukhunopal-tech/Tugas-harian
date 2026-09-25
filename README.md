# Tugas-harian
Memuat kode automasi untuk tugas harian

## Catatan Keuangan Harian

Halaman web sederhana di folder [`pengeluaran/`](pengeluaran/) untuk mencatat pemasukan dan pengeluaran harian.

- Buka `pengeluaran/index.html` langsung di browser (tanpa instalasi).
- Catat transaksi **pemasukan** atau **pengeluaran**: tanggal, keterangan, kategori, jumlah (Rp), metode bayar, dan catatan opsional.
- Setiap transaksi masuk ke salah satu dana: **Dana Pribadi** atau **Dana Kegiatan**. Saldo tiap dana tampil di bagian atas.
- Ubah atau hapus transaksi yang sudah dicatat.
- Lihat daftar per tanggal, bisa disaring per dana, beserta total pemasukan dan pengeluaran.
- Atur anggaran pengeluaran harian: tampil sisa anggaran, atau peringatan jika melebihi batas.
- Ringkasan total per kategori (pengeluaran dan pemasukan) untuk bulan yang dipilih.
- Unduh semua data sebagai CSV.
- Data disimpan di `localStorage` browser, jadi hanya ada di browser/perangkat yang dipakai. Data lama yang dicatat sebelum ada fitur pemasukan dianggap pengeluaran Dana Pribadi.
