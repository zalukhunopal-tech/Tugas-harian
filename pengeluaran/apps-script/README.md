# Sinkronisasi ke Google Sheets

Halaman `pengeluaran/index.html` berjalan sepenuhnya di browser, jadi ia tidak bisa menulis
langsung ke Google Sheets. Perantaranya adalah **Google Apps Script** yang dipasang sekali dari
akun Google pemilik folder Drive *Keuangan*. Setelah terpasang:

- setiap transaksi yang disimpan, diubah, atau dihapus di aplikasi langsung ditulis ke sheet
  **Keuangan Pribadi 2026** atau **Keuangan Kegiatan 2026** (sesuai dananya);
- saat halaman dibuka, seluruh isi kedua sheet ditarik ke aplikasi, jadi baris yang diketik
  manual di sheet ikut tampil (dan bisa diubah dari aplikasi);
- kalau sedang offline, perubahan mengantre di browser dan dikirim otomatis begitu tersambung.

Skrip hanya menulis kolom **B–F, H, I, J**. Kolom **A (No)** dan **G (Saldo)** yang berisi
`ARRAYFORMULA` tidak pernah disentuh. Kolom **J** dipakai untuk ID transaksi (header
"ID Aplikasi" ditambahkan otomatis di J6) supaya baris bisa dikenali saat diubah atau dihapus.

## Pemasangan (sekitar 5 menit)

1. Buka <https://script.google.com> dengan akun Google pemilik folder *Keuangan*, lalu klik
   **Proyek baru** (*New project*).
2. Salin seluruh isi [`Code.gs`](Code.gs). Paling aman lewat tombol **Salin kode Apps Script** di
   folder *Sinkronisasi Google Sheets* di aplikasi (menyalin semuanya sekaligus), atau buka
   [versi mentahnya](https://raw.githubusercontent.com/zalukhunopal-tech/Tugas-harian/main/pengeluaran/apps-script/Code.gs)
   lalu pilih semua. Di editor Apps Script, pilih semua isi `Kode.gs`, hapus, tempel, lalu simpan
   (ikon disket atau `Ctrl+S`). Beri nama proyek, misalnya *Sinkron Keuangan*.

   Periksa sebelum lanjut: editor menunjukkan **272 baris**, baris 1 berisi `/**`, dan baris
   terakhir berisi `}`. Kalau muncul error *Unexpected end of input* (kode terpotong di bawah) atau
   *Illegal return statement* (bagian atas hilang atau tercampur isi lama), ulangi langkah ini.
3. Klik **Deploy → New deployment**. Di *Select type* pilih **Web app**, lalu isi:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
4. Klik **Deploy**. Saat diminta izin, klik **Authorize access**, pilih akun, lalu bila muncul
   peringatan "Google hasn't verified this app" klik **Advanced → Go to … (unsafe)** dan
   **Allow**. Ini normal untuk skrip buatan sendiri.
5. Salin **Web app URL** (berakhiran `/exec`).
6. Buka aplikasi, buka folder **Sinkronisasi Google Sheets**, tempel URL itu, lalu klik
   **Simpan & uji koneksi**. Kalau berhasil, muncul nama kedua sheet dan data sheet langsung
   ditarik.
7. (Opsional) Kalau sudah ada transaksi di browser yang belum ada di sheet, klik
   **Kirim semua data lokal**.

## Mengubah skrip

Kalau `Code.gs` diperbarui, tempel ulang isinya lalu **Deploy → Manage deployments → ✎ →
Version: New version → Deploy**. URL Web App tidak berubah.

## Keamanan

URL Web App berfungsi seperti kunci: siapa pun yang memegangnya bisa menambah dan mengubah baris
di kedua sheet. Jangan bagikan URL itu. Kalau bocor, buka **Manage deployments**, arsipkan
deployment lama, lalu buat deployment baru dan pasang URL barunya di aplikasi.

## Pemetaan kolom

| Aplikasi | Sheet |
|---|---|
| Tanggal | B, sebagai teks `YYYY-MM-DD` |
| Uraian | C |
| Kategori | D — pilihan di aplikasi persis sama dengan panel kategori tiap sheet |
| Jumlah (pemasukan) | E |
| Jumlah (pengeluaran) | F |
| Sumber/Tujuan (Pribadi) atau Kaitan Kegiatan (Kegiatan) | H |
| Metode bayar + Catatan | I, ditulis `Bayar tunai. <catatan>` mengikuti gaya baris yang sudah ada |
| ID transaksi | J |
