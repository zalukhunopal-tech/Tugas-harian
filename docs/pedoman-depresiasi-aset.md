# Pedoman Depresiasi Aset

Pegangan perhitungan fitur **Depresiasi Aset** (tab Saya). Isinya inti sari dari riset rumus depresiasi dan umur pakai barang;
kodenya ada di `src/lib/penyusutan.ts` (rumus), `src/lib/basisDataUmur.ts` (database umur), `src/lib/tawaranDepresiasi.ts` (pengenalan
barang tahan lama), dan `src/lib/pedomanDepresiasi.ts` (teks pedoman di layar). Bila angka di sini diubah, ubah juga berkas tersebut,
lalu jalankan `npx tsx scripts/uji_penyusutan.ts`.

> Angka umur berasal dari artikel otomotif dan perawatan yang tidak selalu sepakat. Yang dipakai adalah nilai tengah yang aman,
> dengan rentang aslinya dicatat. **Buku manual kendaraan atau perangkat selalu didahulukan**, dan setiap angka bisa diubah di formulir.
> Tanda *perkiraan umum* berarti belum ditemukan sumber yang tegas.

## 1. Rumus

Variabel: **C** harga beli, **S** nilai residu (sisa), **n** total umur pakai, **t** umur yang sudah berjalan (satuan sama dengan n),
**D** beban penyusutan per periode.

| Metode | Rumus | Cocok untuk |
|---|---|---|
| Garis lurus | `D = (C − S) / n`; `BV = C − D × t`; `Sisa nilai % = BV / C × 100` | perabot, peralatan kerja, baterai, aki, wiper |
| Saldo menurun ganda (DDB) | `R = 2 / n`; `BV = C × (1 − R)^t`, tidak kurang dari S | laptop, ponsel, kamera, kendaraan (cepat turun di awal) |
| Jumlah angka tahun (SYD) | `jumlah angka = n(n + 1) / 2`; susut tahun ke-k = `(C − S) × (n − k + 1) / jumlah angka`; akumulasi `A = (C − S) × t × (2n − t + 1) / (n(n + 1))` | jalan tengah antara dua metode di atas |
| Unit produksi (km atau jam) | `beban per km = (C − S) / total km`; `BV = C − beban per km × km terpakai` | oli, ban, kampas rem, busi, v-belt, minyak rem |

Urutan nilai buku setelah satu tahun untuk umur yang sama: saldo menurun ganda < jumlah angka tahun < garis lurus.

### Sisa umur pakai (Remaining Useful Life)

- Waktu: `Sisa hari = Total umur (hari) − (hari ini − tanggal beli atau ganti)`; perkiraan tanggal habis = tanggal beli + total umur.
- Jarak: `Sisa km = Batas km − (km saat ini − km saat ganti)`.
- **Batas ganda** (mis. oli motor 2.000 km **atau** 2 bulan): umur terpakai mengikuti batas yang lebih dulu tercapai.
- `Sisa umur % = sisa umur / total umur × 100`.

### Peringatan

Peringatan menyala bila **yang terkecil** dari *sisa nilai %* dan *sisa umur %* sudah **30% atau kurang** (kuning menyala); **10% atau
kurang** atau melewati umur: merah menyala. Peringatan tampil sebagai lencana di kartu barang, banner di Riwayat dan di layar
Depresiasi Aset, titik merah berangka di menu Saya, dan bilah berwarna merah. Aplikasi tidak mengirim notifikasi di luar aplikasi.

## 2. Kelompok masa manfaat (PMK 72 Tahun 2023)

PMK 72/2023 menggantikan PMK 96/PMK.03/2009. Harta berwujud bukan bangunan dibagi empat kelompok; tarif saldo menurun = 2 × tarif
garis lurus. Jenis harta yang tidak tercantum memakai Kelompok 3.

| Kelompok | Masa manfaat | Garis lurus | Saldo menurun | Contoh umum |
|---|---|---|---|---|
| 1 | 4 tahun | 25% | 50% | laptop dan komputer, mesin kantor, mebel kayu atau rotan, sepeda motor |
| 2 | 8 tahun | 12,5% | 25% | mebel logam, pendingin ruangan, mobil dan truk ringan (perkiraan kelompok) |
| 3 | 16 tahun | 6,25% | 12,5% | mesin industri dan alat berat ringan |
| 4 | 20 tahun | 5% | 10% | kapal, lokomotif, konstruksi berat |

Kelompok pajak dipakai hanya sebagai patokan umur ekonomis. Perhitungan di aplikasi ini untuk memantau nilai barang pribadi, bukan
untuk laporan pajak. Bangunan (tidak dibahas di aplikasi): permanen 20 tahun, tidak permanen 10 tahun.

## 3. Memilih metode

- Habis pakai dengan umur km: **unit produksi** (garis lurus per km), tambahkan batas waktu bila ada (oli, ban, minyak rem).
- Habis pakai dengan umur kalender (aki, baterai, wiper): **garis lurus** berbasis waktu.
- Elektronik dan kendaraan: **saldo menurun ganda** (nilainya jatuh cepat di awal).
- Perabot dan peralatan kerja: **garis lurus**.

## 4. Kapan aplikasi menawarkan depresiasi

Setelah pengeluaran baru disimpan (bukan saat mengubah), aplikasi menawarkan *Hitung depresiasi?* bila uraiannya cocok dengan satu
barang di database (kata utuh, mis. "ban" tidak cocok dengan "bangun"), atau kategorinya Pengadaan Barang dan jumlahnya ≥ Rp500.000.

Tidak ditawarkan: pemasukan; kategori Perdiem, Honorarium & Ganti Hari, Tabungan, Tagihan & Sewa, Rental Kendaraan, Akomodasi,
Konsumsi, Makan & Minum, Hiburan, Keluarga; uraian bermuatan pulsa, kuota, tiket, bensin, sewa, makan, parkir, dan sejenisnya; servis
atau perbaikan aset (servis AC bukan membeli AC); barang habis pakai di bawah Rp25.000 dan aset di bawah Rp300.000.

Barang yang disetujui disimpan di `pengaturan.penyusutan` (ikut sinkron ke `Pengaturan.json` di Drive) dan ikut terhapus bersama
transaksinya. Harga barang mengikuti jumlah transaksi bila transaksinya diubah.

## 5. Database umur barang

### Motor

| Barang | Umur dipakai | Rentang di sumber | Metode | Sumber |
|---|---|---|---|---|
| 🛢️ Oli Mesin Motor | 2.000 km atau 2 bulan | 2.000–3.000 km atau 2–3 bulan (semi sintetis 2.500–3.000 km, full sintetis 3.500–4.000 km) | unit produksi (garis lurus per km) | Carmudi, CNN Indonesia, JBA |
| ⚙️ Oli Gardan (Matic) | 8.000 km | 8.000 km (anjuran pabrikan motor matic) | unit produksi (garis lurus per km) | Astra iBid, Carmudi |
| 🛑 Kampas Rem Motor | 15.000 km | 10.000–15.000 km depan dan belakang; cek tanda batas aus dan bunyi decit | unit produksi (garis lurus per km) | Astra iBid |
| ⚡ Busi Motor (Standar) | 10.000 km | 8.000–12.000 km untuk busi standar (perkiraan umum) | unit produksi (garis lurus per km) | _perkiraan umum_ (Patokan umum bengkel) |
| ✨ Busi Iridium | 20.000 km | 20.000–25.000 km (NGK); sebagian sumber menyebut hingga 50.000 km | unit produksi (garis lurus per km) | NGK, Gridoto, detikOto |
| 🔧 V-Belt & Roller CVT | 25.000 km | 20.000–25.000 km (Yamaha); periksa selip dan retak | unit produksi (garis lurus per km) | Yamaha via Astra iBid, Gridoto |
| ⛓️ Rantai & Gir (Set) | 20.000 km | 20.000–30.000 km dengan pelumasan dan penyetelan rutin (perkiraan umum) | unit produksi (garis lurus per km) | _perkiraan umum_ (Patokan umum bengkel) |
| 🛞 Ban Motor | 40.000 km atau 48 bulan | 40.000 km atau 3–4 tahun; di atas 5 tahun sebaiknya diganti walau tapak masih tebal | unit produksi (garis lurus per km) | detikOto, Gridoto |
| 💧 Minyak Rem | 25.000 km atau 24 bulan | 25.000 km atau 2 tahun (Yamaha); bengkel tertentu menyarankan tiap 6 bulan | unit produksi (garis lurus per km) | detikOto, Gridoto |
| 🔋 Aki Motor | 24 bulan | 1–2 tahun (aki basah kadang 2–3 tahun, aki kering/MF 1,5–2 tahun); lebih singkat bila beban berat | garis lurus | Astra iBid, Otodriver, Massiv |
| 🏍️ Sepeda Motor | 4 tahun | 4 tahun (saldo menurun 50%); umur pakai fisik jauh lebih panjang | saldo menurun ganda | PMK 72/2023 |

### Mobil

| Barang | Umur dipakai | Rentang di sumber | Metode | Sumber |
|---|---|---|---|---|
| 🛢️ Oli Mesin Mobil (Sintetis) | 10.000 km atau 6 bulan | 10.000 km atau 6 bulan untuk pemakaian normal; 7.000 km bila sering macet | unit produksi (garis lurus per km) | Autofun, Gridoto, RMOL |
| 🛢️ Oli Mesin Mobil (Mineral/Semi) | 5.000 km atau 6 bulan | 5.000 km untuk oli mineral atau jalur macet | unit produksi (garis lurus per km) | Autofun, RMOL |
| ⚙️ Oli Transmisi / Gardan Mobil | 40.000 km atau 24 bulan | 40.000–60.000 km (matic) atau 40.000–80.000 km (manual); tidak ditemukan sumber tegas | unit produksi (garis lurus per km) | _perkiraan umum_ (Patokan umum bengkel) |
| 🔋 Aki Mobil | 30 bulan | 1,5–3 tahun, bisa sampai 5 tahun bila pemakaian ringan | garis lurus | Auto2000, Cermati, Otodriver |
| 🛞 Ban Mobil | 40.000 km atau 48 bulan | 40.000–50.000 km atau 3 tahun; pakar menyebut usia ban 5 tahun sebagai batas, cek kedalaman alur | unit produksi (garis lurus per km) | Gridoto, detikOto, Auto2000 |
| 🛑 Kampas Rem Mobil | 40.000 km | 30.000–40.000 km; transmisi manual 60.000–70.000 km, matic 35.000–40.000 km | unit produksi (garis lurus per km) | Kia Indonesia, Popmama |
| ⚡ Busi Mobil (Standar) | 30.000 km | 20.000–40.000 km (busi nikel/standar) | unit produksi (garis lurus per km) | Kia Indonesia |
| ✨ Busi Mobil Iridium | 60.000 km | 60.000 km; bengkel resmi tertentu menyebut hingga 100.000 km | unit produksi (garis lurus per km) | detikOto, Gridoto |
| 🌬️ Filter Udara Mobil | 15.000 km | 10.000–20.000 km | unit produksi (garis lurus per km) | Kia Indonesia |
| 🧽 Karet Wiper | 12 bulan | 12 bulan | garis lurus | Kia Indonesia |
| 🌡️ Coolant / Air Radiator | 40.000 km atau 24 bulan | 40.000 km atau 2 tahun (perkiraan umum; ikuti buku servis) | unit produksi (garis lurus per km) | _perkiraan umum_ (Patokan umum bengkel) |
| 🔩 Timing Belt | 80.000 km atau 60 bulan | 60.000–100.000 km tergantung mesin (perkiraan umum) | unit produksi (garis lurus per km) | _perkiraan umum_ (Patokan umum bengkel) |
| 🚗 Mobil | 8 tahun | 8 tahun (saldo menurun 25%, garis lurus 12,5%); umur pakai fisik lebih panjang | saldo menurun ganda | _perkiraan umum_ (PMK 72/2023 (perkiraan kelompok)) |

### Elektronik

| Barang | Umur dipakai | Rentang di sumber | Metode | Sumber |
|---|---|---|---|---|
| 🪫 Baterai Ponsel / Tablet | 24 bulan | 500 siklus pengisian ≈ 80% kapasitas (sekitar 1–3 tahun) | garis lurus | Apple via ANTARA |
| 🔌 Baterai Laptop | 24 bulan | 300–500 siklus; kapasitas turun ±20% per tahun bila sering diisi penuh | garis lurus | ASUS |
| 💻 Laptop / Komputer | 4 tahun | 4 tahun (tarif saldo menurun 50%, garis lurus 25%) | saldo menurun ganda | PMK 72/2023 |
| 📱 Ponsel / Tablet | 4 tahun | 3–4 tahun (umur ekonomis populer 3 tahun; kelompok pajak diperkirakan Kelompok 1) | saldo menurun ganda | _perkiraan umum_ (PMK 72/2023 (perkiraan), praktik umum) |
| 📷 Kamera, Printer & Elektronik Kantor | 4 tahun | 4 tahun (mesin kantor dan perlengkapan elektronik) | saldo menurun ganda | PMK 72/2023 |

### Aset & Perabot

| Barang | Umur dipakai | Rentang di sumber | Metode | Sumber |
|---|---|---|---|---|
| 🪑 Mebel & Perabot Kayu | 4 tahun | 4 tahun untuk mebel dan peralatan dari kayu atau rotan | garis lurus | PMK 72/2023 |
| ❄️ Mebel Logam, AC & Peralatan Besar | 8 tahun | 8 tahun untuk mebel logam, pendingin ruangan, dan sejenisnya (perkiraan kelompok) | garis lurus | _perkiraan umum_ (PMK 72/2023 (perkiraan kelompok)) |
| 🧰 Peralatan & Perlengkapan Lain | 5 tahun | 4–8 tahun tergantung jenis; dipakai bila barang tidak ada di daftar | garis lurus | _perkiraan umum_ (Praktik umum) |

## 6. Sumber riset

- [PMK 72 Tahun 2023 (pokok aturan penyusutan)](https://www.pajak.go.id/index.php/id/siaran-pers/pmk-72-tahun-2023-terbit-berikut-pokok-aturannya)
- [Lampiran PMK 72 Tahun 2023](https://pajak.go.id/sites/default/files/Lampiran%20PMK72TAHUN2023.pdf)
- [Carmudi: servis motor berapa bulan sekali](https://www.carmudi.co.id/journal/servis-motor-berapa-bulan-sekali/)
- [Astra iBid: komponen motor matic yang rutin diganti](https://blog.ibid.astra.co.id/otomotif/komponen-motor-matic-yang-rutin-diganti)
- [detikOto: usia ideal ban motor](https://oto.detik.com/tips-and-tricks-motor/d-7954761/jangan-tunggu-botak-segini-usia-ideal-ban-motor)
- [detikOto: kapan minyak rem motor diganti](https://oto.detik.com/tips-and-tricks-motor/d-6480342/kapan-sebaiknya-minyak-rem-motor-diganti/amp)
- [Autofun: interval ganti oli mobil](https://www.autofun.co.id/berita/serba-serbi-ganti-oli-mobil-mulai-dari-berapa-interval-yang-tepat-sampai-biayanya-78970)
- [Kia Indonesia: jadwal ganti suku cadang mobil](https://www.kia.com/id/id/util/article/panduan-jadwal-ganti-sparepart-mobil-fast-moving-rutin.html)
- [Otodriver: aki kering vs aki basah](https://otodriver.com/komparasi/2019/aki-kering-vs-aki-basah-mana-yang-lebih-awet-akibifefwet)
- [Auto2000: suku cadang mobil yang rutin diganti](https://auto2000.co.id/berita-dan-tips/suku-cadang-mobil-yang-wajib-diganti-secara-rutin)
- [Gridoto: usia ban mobil 5 tahun](https://www.gridoto.com/read/224028368/ban-mobil-usia-5-tahun-sudah-tidak-bisa-dipakai-begini-kata-ahli)
- [ASUS: baterai laptop dan siklus pengisian](https://www.asus.com/id/support/FAQ/1038475)
- [ANTARA: kesehatan baterai iPhone](https://m.antaranews.com/amp/berita/4200219/persentase-battery-health-iphone-yang-sehat)
