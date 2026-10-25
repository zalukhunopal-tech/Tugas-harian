# Keamanan

Dokumen ini menjelaskan apa yang ada di repo ini, apa yang bisa disalahgunakan orang lain, dan langkah
yang perlu dilakukan pemilik supaya akun Google dan GitHub tetap aman.

## Apa yang ada di repo ini

Repo ini berisi aplikasi React + TypeScript + Vite (`src/`), server kecil `server.ts` (untuk fitur Gemini),
dan skrip Apps Script lama (`public/apps-script/Code.gs`, hanya salinan untuk diunduh). Di dalamnya **tidak ada**:

- kata sandi, token, atau cookie akun Google;
- `GEMINI_API_KEY` (dibaca dari lingkungan server, `process.env.GEMINI_API_KEY`; di Google AI Studio
  diisi lewat menu *Secrets*, bukan lewat berkas);
- URL Web App Apps Script atau kunci sinkron.

Ada satu hal yang kelihatan seperti rahasia tetapi **bukan**: `firebase-applet-config.json` memuat
`apiKey` Firebase berawalan `AIza…`. Itu konfigurasi web Firebase yang memang dikirim ke setiap browser;
mengetahuinya tidak memberi akses ke akun atau data siapa pun. Penangkalnya ada di sisi Google, bukan di
penyembunyian kunci (lihat langkah 3 di bawah). Pemindai di `.github/workflows/keamanan.yml` mengecualikan
**hanya berkas itu** dari pola `AIza…`; di berkas lain pola itu tetap ditolak karena kunci Gemini juga
berbentuk sama.

## Apa yang bisa disalahgunakan, dan penangkalnya

| Risiko | Penangkal |
|---|---|
| Seseorang mengubah kode di GitHub sehingga situs memuat kode jahat | Pemindai rahasia (`periksa`), tinjauan pemilik (CODEOWNERS), dan 2FA di akun GitHub. Lihat catatan *branch protection* di bawah. |
| Kredensial tidak sengaja ter-commit (kunci Gemini, token, private key) | Workflow `Keamanan & uji` menolak push yang memuat polanya; workflow `Deploy GitHub Pages` menolak men-deploy hasil build yang memuatnya. Aktifkan juga *Secret scanning* + *Push protection* GitHub. |
| Seseorang memakai kunci web Firebase di situs lain | Batasi kunci dengan *HTTP referrer* dan batasi domain login (langkah 3). |
| Token Google yang tersimpan di browser dicuri (malware, komputer bersama) | Aplikasi menyimpan token akses Google di `localStorage` browser sampai 90 hari dan izinnya luas (Drive + Spreadsheet). Jangan login di perangkat bersama; jika curiga, cabut izin di <https://myaccount.google.com/permissions>. |
| Orang yang memegang ponsel/komputer Anda membuka aplikasi | Aktifkan kunci aplikasi (PIN) di aplikasi. PIN hanya melindungi tampilan aplikasi, bukan data di browser; kunci layar perangkat tetap yang utama. |
| Orang lain memakai server Gemini Anda (kuota) | `server.ts` memakai CORS terbuka. Jika server ini dipasang di alamat publik, batasi `origin` yang diizinkan atau tambahkan autentikasi. Situs GitHub Pages sendiri statis dan tidak menjalankan server ini. |
| Akun GitHub diambil alih | **2FA** wajib (passkey atau aplikasi autentikator), bukan SMS. |
| Akun Google diambil alih | 2FA/passkey di Google, tinjau aplikasi pihak ketiga, jangan pernah memasukkan sandi Google ke halaman selain `accounts.google.com`. |

Keterbatasan yang perlu diketahui: izin Drive yang diminta aplikasi (`.../auth/drive`) mencakup **seluruh
Drive**, bukan hanya folder `Keuangan`, karena aplikasi membaca folder yang sudah ada. Kode aplikasi hanya
menyentuh folder `Keuangan`, tetapi jika akses Google Anda bocor, yang terbuka adalah seluruh Drive.

## Data pribadi dan folder Keuangan

Repo ini publik, jadi **tidak boleh** memuat data pribadi pemakainya:

- Nama, jabatan, lembaga, dan proyek di Profil Pelapor kosong secara bawaan; tiap pemakai mengisinya sendiri
  (tab Saya → Profil Pelapor). Isinya hanya ada di perangkat dan di Drive pemakai.
- Tidak ada ID folder atau berkas Google Drive di kode. Aplikasi mencari folder `Keuangan` lewat nama di Drive akun yang
  sedang masuk, dan mengabaikan folder bernama sama milik orang lain. `public/apps-script/Code.gs` juga mencari lewat nama
  (isi `FOLDER_ID` hanya bila perlu).
- Data contoh di uji memakai nama fiktif dan `@example.org`. `scripts/periksa_data_pribadi.sh` (dijalankan di job
  `periksa`) menolak ID Drive, email nyata, bawaan Profil Pelapor yang terisi, dan arsip `.zip` lama di `public/`.
- Folder `Keuangan` dan spreadsheet di dalamnya **jangan** dibagikan sebagai "siapa saja yang punya tautan". Pilihan dana di
  tab Keluarga tidak berlaku untuk berkas yang bertautan publik; aplikasi menampilkan peringatan bila menemukannya.
- Riwayat Git menyimpan semua yang pernah di-commit. Bila data pribadi pernah masuk, menghapusnya dari berkas tidak cukup:
  batasi akses ke sumbernya (mis. folder Drive-nya) dan, bila perlu, bersihkan riwayat dengan `git filter-repo`.

## Kunci Aplikasi dan Google Authenticator

- PIN disimpan sebagai hash SHA-256 bergaram; konfigurasi kunci ikut tersinkron ke `Pengaturan.json` di Drive pemakai
  sehingga satu PIN berlaku di semua perangkat. PIN 4-6 angka mudah ditebak bila hash-nya terbaca, jadi folder Drive harus
  tetap privat.
- Google Authenticator (TOTP, RFC 6238) adalah langkah kedua setelah PIN atau sidik jari. Rahasianya dibuat di perangkat dan
  **hanya** disimpan di perangkat itu (tidak ikut ke Drive atau GitHub). Kode yang sama tidak bisa dipakai dua kali, dan
  salah lima kali berturut-turut memberi jeda yang makin lama. Menonaktifkannya butuh kode yang sah.
- Batasnya: ini penjaga di aplikasi, bukan enkripsi data. Orang yang menguasai penyimpanan browser perangkat bisa menghapus
  data situs; data di Drive tetap hanya terbuka bagi akun Google pemiliknya.

## Yang perlu dilakukan pemilik (sekali)

### 1. Aktifkan GitHub Pages dari GitHub Actions

<https://github.com/zalukhunopal-tech/Tugas-harian/settings/pages> → **Build and deployment** →
**Source: GitHub Actions**. Tanpa ini workflow *Deploy GitHub Pages* berhenti di langkah deploy.
Alamat situs: <https://zalukhunopal-tech.github.io/Tugas-harian/>.

> `index.html` di root repo adalah sumber Vite, bukan halaman jadi. Itu sebabnya Pages tidak boleh
> menyajikan branch apa adanya; yang disajikan adalah hasil build dari workflow.

### 2. Pemindai rahasia GitHub

<https://github.com/zalukhunopal-tech/Tugas-harian/settings/security_analysis> → aktifkan
**Secret scanning** dan **Push protection** (gratis untuk repo publik).

### 3. Login Google dan kunci Firebase

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains** → tambahkan
   `zalukhunopal-tech.github.io`. Tanpa ini tombol masuk Google gagal di situs GitHub Pages.
2. Google Cloud Console → **APIs & Services** → **Credentials** → kunci API milik proyek Firebase →
   **Application restrictions: Websites** → isi `https://zalukhunopal-tech.github.io/*` (dan alamat
   AI Studio yang Anda pakai). Batasi juga **API restrictions** hanya ke API yang dipakai.
3. Kalau `apiKey` Firebase pernah dipasang tanpa pembatasan, buat kunci baru lalu perbarui
   `firebase-applet-config.json`.

### 4. Perlindungan branch `main` (hati-hati dengan AI Studio)

Google AI Studio menyinkronkan ke GitHub dengan **push langsung** ke `main`. Karena itu jangan
mengaktifkan *Require a pull request before merging* pada `main`: push dari AI Studio akan ditolak dan
sinkronisasi putus. Aturan yang aman bersama AI Studio:

- **Block force pushes** dan **Restrict deletions** pada `main`.
- **Require status checks to pass** → **periksa**, hanya bila AI Studio Anda diatur mendorong ke branch
  lain atau lewat PR. (Pada push langsung, status check tidak menahan apa pun; yang menahan adalah aturan
  PR.)

Jika Anda lebih mengutamakan perlindungan PR daripada sinkron otomatis dari AI Studio, atur AI Studio
untuk mendorong ke branch terpisah lalu merge lewat PR.

### 5. Akun

- GitHub: <https://github.com/settings/security> → **Two-factor authentication**. Tinjau
  <https://github.com/settings/applications> dan hapus aplikasi yang tidak dikenal.
- Google: <https://myaccount.google.com/security> → verifikasi 2 langkah / passkey. Tinjau
  <https://myaccount.google.com/permissions> — yang wajar ada: aplikasi ini (lewat Firebase), Google AI
  Studio, dan Claude (konektor Drive).

### 6. Skrip Apps Script lama (opsional)

Aplikasi versi React tidak lagi memakai Web App Apps Script. Jika dulu Anda men-deploy Web App dari
`Code.gs`, arsipkan deployment-nya (Apps Script → **Deploy** → **Manage deployments** → arsipkan) dan
hapus `KUNCI_SINKRON` dari Script Properties supaya tidak ada pintu yang terbuka tanpa dipakai.

## Kebiasaan yang menjaga semuanya tetap aman

- Jangan tempel URL Web App, kunci API, atau token di issue, PR, chat, atau tangkapan layar. Kalau
  terlanjur, ganti kuncinya.
- Saat diminta login Google, pastikan alamatnya `accounts.google.com`.
- Simpan `GEMINI_API_KEY` hanya di *Secrets* AI Studio atau variabel lingkungan server.
- Kalau ada yang mencurigakan: cabut izin aplikasi di <https://myaccount.google.com/permissions>, ganti
  kunci yang terkait, lalu periksa riwayat revisi sheet (File → Version history).

## Melaporkan masalah keamanan

Buka issue di repo ini **tanpa** menyertakan URL, kunci, atau data pribadi, atau hubungi pemilik langsung.
