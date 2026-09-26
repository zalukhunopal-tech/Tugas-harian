# Keamanan

Dokumen ini menjelaskan apa yang bisa dan tidak bisa dilakukan orang lain lewat repo ini, dan
langkah yang perlu dilakukan pemilik supaya akun Google dan GitHub tetap aman.

## Apa yang ada di repo ini

Repo ini **hanya berisi kode halaman statis dan skrip Apps Script**. Di dalamnya **tidak ada**:

- kata sandi, token, atau cookie akun Google;
- URL Web App Apps Script (itu tersimpan hanya di browser pemakai);
- kunci sinkron (`KUNCI_SINKRON`, tersimpan di Script Properties Apps Script dan di browser pemakai).

Satu-satunya pengenal Google di kode adalah **id folder Drive `Keuangan`**. Id folder bukan kredensial:
orang yang punya id itu tetap tidak bisa membuka isinya tanpa izin dari akun Anda.

Aplikasi tidak pernah meminta login Google. Di halaman artifact Claude, akses Drive lewat konektor akun
Claude Anda sendiri, dan izinnya bisa dicabut kapan saja dari claude.ai → Settings → Connectors.

## Apa yang bisa disalahgunakan, dan penangkalnya

| Risiko | Penangkal |
|---|---|
| Seseorang mendapat **URL Web App** (mis. dari tangkapan layar) lalu menambah/mengubah baris sheet | Isi **`KUNCI_SINKRON`** (lihat di bawah). Tanpa kunci yang sama, Web App menolak. Kalau bocor: arsipkan deployment, buat yang baru. |
| Seseorang mengubah kode di GitHub sehingga halaman GitHub Pages memuat kode jahat | **Perlindungan branch `main`** + tinjauan pemilik (CODEOWNERS) + workflow pemindai rahasia. Hanya akun Anda yang bisa merge. |
| Kredensial tidak sengaja ter-commit | Workflow `Keamanan & uji` menolak push yang memuat pola URL Web App, API key, token, private key. Aktifkan juga *Secret scanning* + *Push protection* GitHub. |
| Akun GitHub diambil alih | **2FA** wajib (passkey atau aplikasi autentikator), bukan SMS. |
| Akun Google diambil alih | 2FA/passkey di Google, tinjau aplikasi pihak ketiga, jangan pernah memasukkan sandi Google ke halaman selain accounts.google.com. |

Kalau URL atau kunci bocor, kerugian maksimalnya adalah **isi dua sheet keuangan dan file aset bisa
diubah** — bukan akun Google Anda. Skrip berjalan dengan izin akun Anda, tetapi hanya bisa melakukan
yang ada di kodenya (menulis ke folder `Keuangan`).

## Yang perlu dilakukan pemilik (sekali)

### 1. Kunci sinkron di Apps Script

1. Buka proyek Apps Script → ⚙ **Project Settings** → **Script Properties** → **Add script property**.
2. Property: `KUNCI_SINKRON`, Value: kalimat acak yang panjang (mis. 24+ karakter). Simpan.
3. Di aplikasi (GitHub Pages atau file lokal) → tab **Saya** → *Sinkronisasi Google Sheets* → isi
   **Kunci sinkron** dengan nilai yang sama → **Simpan & uji koneksi**.

Sejak itu, permintaan tanpa kunci ditolak dengan pesan "Kunci sinkron salah atau kosong".

### 2. Perlindungan branch `main` di GitHub

Buka <https://github.com/zalukhunopal-tech/Tugas-harian/settings/branches> → **Add branch ruleset**
(atau *Add classic branch protection rule*), nama `main`:

- **Require a pull request before merging** → centang **Require review from Code Owners**.
- **Require status checks to pass** → pilih **periksa** (workflow *Keamanan & uji*).
- **Block force pushes** dan **Restrict deletions**.
- Simpan. Sejak itu tidak ada kode yang masuk `main` tanpa PR yang Anda setujui dan lolos pemindai.

### 3. Pemindai rahasia GitHub

<https://github.com/zalukhunopal-tech/Tugas-harian/settings/security_analysis> → aktifkan
**Secret scanning** dan **Push protection** (gratis untuk repo publik).

### 4. Akun

- GitHub: <https://github.com/settings/security> → **Two-factor authentication** (passkey atau
  aplikasi autentikator). Tinjau <https://github.com/settings/applications> dan hapus aplikasi yang
  tidak dikenal.
- Google: <https://myaccount.google.com/security> → verifikasi 2 langkah / passkey. Tinjau
  <https://myaccount.google.com/permissions> (akses pihak ketiga) — yang wajar ada: Claude (konektor
  Drive) dan proyek Apps Script Anda sendiri.
- GitHub Pages: sumbernya hanya branch `main` (Settings → Pages).

## Kebiasaan yang menjaga semuanya tetap aman

- Jangan tempel URL Web App atau kunci di issue, PR, chat, atau tangkapan layar. Kalau terlanjur,
  ganti keduanya.
- Saat diminta login Google, pastikan alamatnya `accounts.google.com`. Aplikasi ini tidak pernah
  menampilkan form login.
- Kode Apps Script hanya boleh berasal dari repo ini (`pengeluaran/apps-script/Code.gs`); jangan tempel
  skrip dari sumber lain ke proyek yang sama.
- Kalau ada yang mencurigakan: arsipkan deployment Web App, ganti `KUNCI_SINKRON`, cabut konektor Drive
  di claude.ai, lalu periksa riwayat revisi sheet (File → Version history).

## Melaporkan masalah keamanan

Buka issue di repo ini **tanpa** menyertakan URL, kunci, atau data pribadi, atau hubungi pemilik langsung.
