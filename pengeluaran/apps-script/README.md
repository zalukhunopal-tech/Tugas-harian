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

Selain kedua sheet, skrip memelihara dua file di folder *Keuangan*:

- **`Aset.json`** — daftar aset dari tab *Aset* di aplikasi (emas, kripto, JHT/JMO, investasi).
- **`Harga Pasar.json`** — harga emas Antam 1 gr (dari halaman Logam Mulia) dan harga kripto (CoinGecko),
  diperbarui **tiap jam** oleh pemicu `perbaruiHargaTerjadwal`, atau saat aplikasi meminta dengan
  `?action=harga&segar=1`. Bila sumber tidak terbaca, nilai sebelumnya dipertahankan dan alasannya dicatat
  di field `catatan`. Struktur halaman Logam Mulia bisa berubah; kalau harga emas berhenti terbaca,
  isi manual di aplikasi (*Aset → Harga pasar & sumber*) sampai pembacanya diperbarui.

## Pemasangan (sekitar 5 menit)

1. Buka <https://script.google.com> dengan akun Google pemilik folder *Keuangan*, lalu klik
   **Proyek baru** (*New project*).
2. Salin seluruh isi [`Code.gs`](Code.gs). Paling aman lewat tombol **Salin kode Apps Script** di
   folder *Sinkronisasi Google Sheets* di aplikasi (menyalin semuanya sekaligus), atau buka
   [versi mentahnya](https://raw.githubusercontent.com/zalukhunopal-tech/Tugas-harian/main/pengeluaran/apps-script/Code.gs)
   lalu pilih semua. Di editor Apps Script, pilih semua isi `Kode.gs`, hapus, tempel, lalu simpan
   (ikon disket atau `Ctrl+S`). Beri nama proyek, misalnya *Sinkron Keuangan*.

   Periksa sebelum lanjut: editor menunjukkan **549 baris**, baris 1 berisi `/**`, dan baris
   terakhir berisi `}`. Kalau muncul error *Unexpected end of input* (kode terpotong di bawah) atau
   *Illegal return statement* (bagian atas hilang atau tercampur isi lama), ulangi langkah ini.
3. Klik **Deploy → New deployment**. Di *Select type* pilih **Web app**, lalu isi:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
4. Klik **Deploy**. Saat diminta izin, klik **Authorize access**, pilih akun, lalu bila muncul
   peringatan "Google hasn't verified this app" klik **Advanced → Go to … (unsafe)** dan
   **Allow**. Ini normal untuk skrip buatan sendiri.
5. Salin **Web app URL** (berakhiran `/exec`).
   **Dianjurkan:** pasang kunci sinkron supaya URL saja tidak cukup untuk menulis ke sheet —
   ⚙ *Project Settings → Script Properties → Add script property*: nama `KUNCI_SINKRON`, nilai kalimat
   acak yang panjang. Kunci yang sama diisi di aplikasi (langkah 6). Rincian di [SECURITY.md](../../SECURITY.md).
6. Buka aplikasi **dari GitHub Pages**
   (<https://zalukhunopal-tech.github.io/Tugas-harian/pengeluaran/>, lihat bagian di bawah) atau dari
   file `index.html` di komputer — **bukan** dari halaman artifact Claude, yang dilarang menghubungi
   situs luar. Buka tab **Saya → Sinkronisasi Google Sheets**, tempel URL itu (dan kunci sinkron bila
   dipasang), lalu klik **Simpan & uji koneksi**. Kalau berhasil, muncul nama kedua sheet dan data sheet langsung
   ditarik.
7. (Opsional) Kalau sudah ada transaksi di browser yang belum ada di sheet, klik
   **Kirim semua data lokal**.

## Sinkron dari halaman artifact Claude

Halaman artifact Claude tidak boleh menghubungi Web App di atas, jadi di sana aplikasi memakai
**konektor Google Drive** akun Claude Anda:

- **Membaca**: kedua sheet dibaca langsung lewat konektor (izinkan Google Drive saat diminta).
- **Menulis**: setiap simpan/ubah/hapus menjadi satu file kecil `op-….json` di subfolder
  **Antrean Sinkron** di folder *Keuangan*. Fungsi `prosesAntreanDrive` di skrip ini memasukkan
  file-file itu ke sheet **setiap menit**, lalu membuangnya ke sampah. File yang gagal diproses
  diganti namanya menjadi `GAGAL - …` beserta alasannya dan tidak diulang.
- Baris yang diketik langsung di sheet diberi ID otomatis dalam ±1 menit, supaya bisa diubah dan
  dihapus dari halaman artifact (sebelum itu tombolnya nonaktif).

Pasang sekali:

1. Tempel kode `Code.gs` versi terbaru (549 baris) seperti langkah 2 di atas, lalu simpan.
2. Di bilah atas editor, pilih fungsi **`pasangPemicu`**, lalu klik **▶ Jalankan**. Setujui izin
   yang diminta (Drive, Sheets, "terhubung ke layanan eksternal" untuk mengambil harga, dan
   "menjalankan saat Anda tidak ada" untuk pemicu terjadwal).
3. Log menampilkan "Pemicu terpasang…"; subfolder **Antrean Sinkron** dan file **Harga Pasar.json**
   muncul di folder *Keuangan*. Menjalankannya ulang aman; pemicu lama diganti. Fungsi ini juga
   memasang pemicu harga per jam, jadi jalankan meski Anda hanya memakai GitHub Pages.

Karena lewat antrean, perubahan dari artifact baru terlihat di sheet setelah ±1 menit. Selama
menunggu, aplikasi tetap menampilkannya dan label status menunjukkan "… menunggu dimasukkan Apps
Script ke sheet". Pemicu per menit hanya membuka sheet bila ada antrean atau sheet berubah,
sehingga kuota harian Apps Script tetap longgar.

## Membuka aplikasi lewat GitHub Pages (sekali saja)

1. Buka <https://github.com/zalukhunopal-tech/Tugas-harian/settings/pages>.
2. Di *Build and deployment* → *Source* pilih **Deploy from a branch**; *Branch* pilih **main** dan
   folder **/ (root)**, lalu **Save**.
3. Tunggu 1–2 menit, lalu buka <https://zalukhunopal-tech.github.io/Tugas-harian/pengeluaran/>.
   Simpan ke layar utama HP supaya mudah dibuka.

Data transaksi dan URL Web App tersimpan per browser, jadi URL Web App perlu ditempel sekali di
setiap browser/perangkat yang dipakai; datanya sendiri akan ditarik dari sheet.

## Kalau koneksi gagal

- **"halaman artifact Claude tidak diizinkan menghubungi Google"**: buka aplikasi dari GitHub Pages.
- **"browser tidak bisa menghubungi Apps Script"**: buka `URL-Web-App?action=ping` di tab baru.
  - Muncul `{"ok":true,...}` → skrip sehat; periksa koneksi lalu coba lagi.
  - Muncul halaman login Google → *Who has access* belum **Anyone**. Buka **Deploy → Manage
    deployments → ✎**, ubah ke **Anyone**, lalu **Deploy**.
  - Muncul `{"ok":false,"error":...}` → kirim pesan error-nya untuk diperbaiki.
- Pastikan URL berakhiran `/exec`, bukan `/dev`.

## Mengubah skrip

Kalau `Code.gs` diperbarui, tempel ulang isinya lalu **Deploy → Manage deployments → ✎ →
Version: New version → Deploy**. URL Web App tidak berubah. Pemicu `prosesAntreanDrive` otomatis
memakai kode terbaru; `pasangPemicu` tidak perlu dijalankan ulang.

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

## Aset dan harga pasar

| Jenis | Sumber nilai |
|---|---|
| Emas | gram × harga jual Antam 1 gr (Logam Mulia, tiap jam). Buyback ditampilkan sebagai info. Bisa diisi manual. |
| Kripto | jumlah koin × harga IDR CoinGecko (`/simple/price`), lewat Apps Script atau langsung dari browser. |
| JMO / JHT | tidak ada API publik. Saldo terakhir di JMO + iuran 5,7% upah per bulan (3,7% pemberi kerja + 2% pekerja) + hasil pengembangan tahunan (isi sesuai pengumuman BPJS Ketenagakerjaan, dibagi rata per bulan). |
| Investasi lain | modal tumbuh sesuai bunga rata-rata: majemuk bulanan, majemuk tahunan, atau sederhana. |

Nilai JMO dan investasi adalah **proyeksi**, bukan saldo resmi: cocokkan berkala dengan aplikasi JMO
atau laporan banknya, lalu perbarui saldo/tanggal di aplikasi.
