/**
 * Inti sari pedoman depresiasi aset: rumus, kelompok masa manfaat, dan cara memilih metode. Dipakai layar Depresiasi Aset
 * dan menjadi pegangan perhitungan di lib/penyusutan.ts. Salinan lengkap beserta sumber ada di docs/pedoman-depresiasi-aset.md.
 */

export interface RumusDepresiasi {
  id: string;
  nama: string;
  rumus: string[];
  kapan: string;
}

export const RUMUS_DEPRESIASI: RumusDepresiasi[] = [
  {
    id: "garis-lurus",
    nama: "Garis Lurus",
    rumus: ["D = (C − S) / n", "Nilai buku = C − D × t", "Sisa nilai (%) = nilai buku / C × 100"],
    kapan: "Susut sama besar tiap periode. Cocok untuk perabot, peralatan kerja, dan barang yang dipakai merata.",
  },
  {
    id: "saldo-menurun-ganda",
    nama: "Saldo Menurun Ganda",
    rumus: ["Tarif R = 2 / n", "Nilai buku = C × (1 − R)^t, tidak kurang dari S"],
    kapan: "Susut besar di awal, lalu mengecil. Cocok untuk laptop, ponsel, dan kendaraan yang cepat turun harga.",
  },
  {
    id: "jumlah-angka-tahun",
    nama: "Jumlah Angka Tahun",
    rumus: ["Jumlah angka = n(n + 1) / 2", "Susut tahun ke-k = (C − S) × (n − k + 1) / jumlah angka", "Akumulasi = (C − S) × t × (2n − t + 1) / (n(n + 1))"],
    kapan: "Jalan tengah: susut menurun bertahap tetapi tidak securam saldo menurun ganda.",
  },
  {
    id: "unit-produksi",
    nama: "Unit Produksi (km atau jam)",
    rumus: ["Beban per km = (C − S) / total km", "Nilai buku = C − beban per km × km terpakai"],
    kapan: "Umur ditentukan pemakaian, bukan kalender: oli, kampas rem, ban, v-belt. Dipakai otomatis saat umur dihitung dengan km atau jam.",
  },
  {
    id: "sisa-umur",
    nama: "Sisa Umur Pakai",
    rumus: [
      "Waktu: sisa hari = total umur (hari) − (hari ini − tanggal beli atau ganti)",
      "Jarak: sisa km = batas km − (km saat ini − km saat ganti)",
      "Batas ganda (mis. 2.000 km atau 2 bulan): yang tercapai lebih dulu",
      "Sisa umur (%) = sisa umur / total umur × 100",
    ],
    kapan: "Dasar prediksi kapan barang perlu diganti.",
  },
];

export const KETERANGAN_VARIABEL = "C = harga beli, S = nilai residu (sisa), n = total umur pakai, t = umur yang sudah berjalan, D = beban penyusutan per periode.";

export const ATURAN_PERINGATAN = "Peringatan menyala bila sisa nilai atau sisa umur (yang lebih kecil) sudah 30% atau kurang; merah menyala pada 10% ke bawah atau saat melewati umur.";

export interface KelompokPajak {
  kelompok: number;
  masa: string;
  garisLurus: string;
  saldoMenurun: string;
  contoh: string;
}

/** Harta berwujud bukan bangunan menurut PMK 72/2023 (pengganti PMK 96/PMK.03/2009). Tarif saldo menurun = 2 × tarif garis lurus. */
export const KELOMPOK_PAJAK: KelompokPajak[] = [
  { kelompok: 1, masa: "4 tahun", garisLurus: "25%", saldoMenurun: "50%", contoh: "Laptop dan komputer, mesin kantor, mebel kayu atau rotan, sepeda motor" },
  { kelompok: 2, masa: "8 tahun", garisLurus: "12,5%", saldoMenurun: "25%", contoh: "Mebel logam, pendingin ruangan, mobil dan truk ringan" },
  { kelompok: 3, masa: "16 tahun", garisLurus: "6,25%", saldoMenurun: "12,5%", contoh: "Mesin industri dan alat berat ringan; dipakai bila jenis harta tidak tercantum" },
  { kelompok: 4, masa: "20 tahun", garisLurus: "5%", saldoMenurun: "10%", contoh: "Kapal, lokomotif, konstruksi berat" },
];

export const CATATAN_PAJAK = "Kelompok pajak dipakai sebagai patokan umur ekonomis. Perhitungan di aplikasi ini untuk memantau nilai barang pribadi, bukan untuk laporan pajak.";

export const PANDUAN_PEMILIHAN: Array<{ barang: string; metode: string }> = [
  { barang: "Oli, ban, kampas rem, busi, v-belt, minyak rem", metode: "Unit produksi (km) dengan batas waktu bila ada" },
  { barang: "Aki, baterai, wiper", metode: "Garis lurus berbasis waktu" },
  { barang: "Laptop, ponsel, kamera, kendaraan", metode: "Saldo menurun ganda (cepat turun di awal)" },
  { barang: "Meja, kursi, lemari, peralatan kerja", metode: "Garis lurus" },
];

export interface SumberRiset {
  label: string;
  url: string;
}

export const SUMBER_RISET: SumberRiset[] = [
  { label: "PMK 72 Tahun 2023 (pokok aturan penyusutan)", url: "https://www.pajak.go.id/index.php/id/siaran-pers/pmk-72-tahun-2023-terbit-berikut-pokok-aturannya" },
  { label: "Lampiran PMK 72 Tahun 2023", url: "https://pajak.go.id/sites/default/files/Lampiran%20PMK72TAHUN2023.pdf" },
  { label: "Carmudi: servis motor berapa bulan sekali", url: "https://www.carmudi.co.id/journal/servis-motor-berapa-bulan-sekali/" },
  { label: "Astra iBid: komponen motor matic yang rutin diganti", url: "https://blog.ibid.astra.co.id/otomotif/komponen-motor-matic-yang-rutin-diganti" },
  { label: "detikOto: usia ideal ban motor", url: "https://oto.detik.com/tips-and-tricks-motor/d-7954761/jangan-tunggu-botak-segini-usia-ideal-ban-motor" },
  { label: "detikOto: kapan minyak rem motor diganti", url: "https://oto.detik.com/tips-and-tricks-motor/d-6480342/kapan-sebaiknya-minyak-rem-motor-diganti/amp" },
  { label: "Autofun: interval ganti oli mobil", url: "https://www.autofun.co.id/berita/serba-serbi-ganti-oli-mobil-mulai-dari-berapa-interval-yang-tepat-sampai-biayanya-78970" },
  { label: "Kia Indonesia: jadwal ganti suku cadang mobil", url: "https://www.kia.com/id/id/util/article/panduan-jadwal-ganti-sparepart-mobil-fast-moving-rutin.html" },
  { label: "Otodriver: aki kering vs aki basah", url: "https://otodriver.com/komparasi/2019/aki-kering-vs-aki-basah-mana-yang-lebih-awet-akibifefwet" },
  { label: "Auto2000: suku cadang mobil yang rutin diganti", url: "https://auto2000.co.id/berita-dan-tips/suku-cadang-mobil-yang-wajib-diganti-secara-rutin" },
  { label: "Gridoto: usia ban mobil 5 tahun", url: "https://www.gridoto.com/read/224028368/ban-mobil-usia-5-tahun-sudah-tidak-bisa-dipakai-begini-kata-ahli" },
  { label: "ASUS: baterai laptop dan siklus pengisian", url: "https://www.asus.com/id/support/FAQ/1038475" },
  { label: "ANTARA: kesehatan baterai iPhone", url: "https://m.antaranews.com/amp/berita/4200219/persentase-battery-health-iphone-yang-sehat" },
];
