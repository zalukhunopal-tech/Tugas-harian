export type JenisTransaksi = "pengeluaran" | "pemasukan";
export type NamaDana = "Dana Pribadi" | "Dana Kegiatan";

export interface BuktiItem {
  id: string;
  nama: string;
  tipe: string;
  dataUrl?: string;
  driveId?: string;
  driveLink?: string;
  waktu?: string;
}

export interface Transaksi {
  id: string;
  jenis: JenisTransaksi;
  dana: NamaDana;
  tanggal: string; // YYYY-MM-DD
  deskripsi: string;
  kategori: string;
  jumlah: number;
  metode: string;
  kaitan: string;
  catatan: string;
  tanpaId?: boolean;
  diubah?: string; // Waktu ISO
  bukti?: BuktiItem[];
  pasanganId?: string; // ID transaksi pasangan untuk Pindah Dana
  isTalangan?: boolean; // Penanda apakah transaksi ini merupakan talangan
  statusTalangan?: "belum_diganti" | "sudah_diganti";
  talanganUntuk?: string;
  targetTabunganId?: string; // Alokasi untuk target tabungan
  kegiatanId?: string; // ID kegiatan yang terhubung
  detailKegiatan?: DataKhususKegiatan; // Rincian khusus Dana Kegiatan
}

export interface CicilanItem {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jumlah: number;
  catatan?: string;
  diubah?: string;
}

export type JenisHutang = "utang" | "piutang";

export interface ItemHutangPiutang {
  id: string;
  jenis: JenisHutang; // "utang" (kita meminjam) atau "piutang" (orang lain meminjam ke kita)
  namaOrang: string;
  jumlah: number;
  jatuhTempo: string; // YYYY-MM-DD
  catatan?: string;
  dana?: NamaDana;
  cicilan: CicilanItem[];
  dibuat: string;
  diubah?: string;
}

export interface TargetTabunganItem {
  id: string;
  nama: string;
  targetJumlah: number;
  tenggat: string; // YYYY-MM-DD
  catatan?: string;
  dibuat: string;
  diubah?: string;
}

export interface AppLockConfig {
  enabled: boolean;
  pinHash: string;
  salt: string;
  webAuthnEnabled: boolean;
  credentialId?: string;
  diubah?: string;
}

export type AnggaranKategoriMap = Record<NamaDana, Record<string, number>>;

/** Penyusutan nilai dan umur pakai barang: lihat lib/penyusutan.ts untuk rumus dan batas peringatan. */
export type BasisUmur = "waktu" | "pemakaian";
export type SatuanWaktu = "hari" | "bulan" | "tahun";
export type SatuanPemakaian = "km" | "jam";
export type MetodePenyusutan = "garis-lurus" | "saldo-menurun-ganda" | "jumlah-angka-tahun";
/** habis-pakai: oli, kampas rem, aki, ban (umur dapat diperkirakan pasti); aset: elektronik, peralatan kerja, kendaraan. */
export type JenisBarang = "habis-pakai" | "aset";

export interface ItemPenyusutan {
  id: string;
  /** Transaksi pembelian asal; item ikut terhapus bila transaksinya dihapus. */
  transaksiId?: string;
  nama: string;
  jenisBarang: JenisBarang;
  presetId?: string;
  basis: BasisUmur;
  metode: MetodePenyusutan;
  /** C: harga beli atau perolehan. */
  harga: number;
  /** S: nilai residu (0 untuk barang habis pakai). */
  nilaiResidu: number;
  /** n: total estimasi umur pakai, dalam satuanWaktu atau satuanPemakaian. */
  umurTotal: number;
  satuanWaktu?: SatuanWaktu;
  satuanPemakaian?: SatuanPemakaian;
  /** Batas waktu kedua (bulan) untuk barang berbasis pemakaian: mana yang tercapai lebih dulu, km atau bulan (mis. oli 2.000 km atau 2 bulan). */
  batasWaktuBulan?: number;
  /** Tanggal beli atau terakhir diganti/diservis (YYYY-MM-DD). */
  tanggalMulai: string;
  /** Angka kilometer atau jam pakai saat beli/ganti dan saat ini (basis pemakaian). */
  pemakaianAwal?: number;
  pemakaianSekarang?: number;
  pemakaianDiperbarui?: string;
  dibuat: string;
  diubah?: string;
}

export interface PengaturanKeuangan {
  anggaranHarian: number;
  anggaranKategori: AnggaranKategoriMap;
  utangPiutang?: ItemHutangPiutang[];
  targetTabungan?: TargetTabunganItem[];
  penyusutan?: ItemPenyusutan[];
  appLock?: AppLockConfig;
  terakhirDiubah?: string;
  diubah?: string;
}

export type JenisAset = "emas" | "crypto" | "jmo" | "investasi";
export type SkemaInvestasi = "majemuk-bulanan" | "majemuk-tahunan" | "sederhana";

export interface AsetItem {
  id: string;
  jenis: JenisAset;
  nama: string;
  catatan?: string;
  dibuat?: string;
  // Emas
  gram?: number;
  hargaBeli?: number;
  // Crypto
  koin?: string;
  simbol?: string;
  jumlah?: number;
  // JMO
  saldoAwal?: number;
  tanggalSaldo?: string;
  gaji?: number;
  iuranPersen?: number;
  hasilPersen?: number;
  iuranTambahan?: number;
  // Investasi
  modal?: number;
  tanggalMulai?: string;
  bungaPersen?: number;
  skema?: SkemaInvestasi;
}

export interface HargaEmas {
  jual: number;
  buyback?: number;
  waktu?: string;
  sumber?: string;
}

export interface HargaKoin {
  idr: number;
  perubahan24?: number | null;
}

export interface DataHarga {
  emas?: HargaEmas;
  crypto?: Record<string, HargaKoin>;
  manual?: {
    emas?: HargaEmas;
  };
  waktu?: string;
}

export interface HasilHitungAset {
  nilai: number;
  modal: number | null;
  untung: number | null;
  persen: number | null;
  tersedia: boolean;
  keterangan: string;
}

export interface RingkasanAset {
  item: Array<{ aset: AsetItem } & HasilHitungAset>;
  total: number;
  modal: number;
  untung: number | null;
  persen: number | null;
  belumTersedia: number;
}

export type KarakterId =
  | "gojo"
  | "sukuna"
  | "jogo"
  | "nanami"
  | "itadori"
  | "megumi"
  | "nobara"
  | "yuta"
  | "toji"
  | "geto"
  | "maki"
  | "mahito";
export type TemaId = "jujutsu" | "standar";
export type ViewTab = "riwayat" | "aset" | "tambah" | "grafik" | "saya";

export interface SyncOp {
  action: "upsert" | "delete" | "aset";
  id?: string;
  transaksi?: Transaksi;
  aset?: AsetItem[];
  dibuat?: string;
}

export type FrekuensiBerulang = "harian" | "mingguan" | "bulanan" | "tahunan";

export interface TransaksiBerulang {
  id: string;
  nama: string;
  jenis: JenisTransaksi;
  dana: NamaDana;
  jumlah: number;
  kategori: string;
  metode: string;
  kaitan: string;
  catatan: string;
  frekuensi: FrekuensiBerulang;
  tanggalMulai: string; // YYYY-MM-DD
  hariDalamBulan?: number; // 1-31 (misal tiap tanggal 25)
  hariDalamMinggu?: number; // 0 (Minggu) - 6 (Sabtu)
  terakhirDiterapkan?: string; // YYYY-MM-DD
  aktif: boolean;
}


// --- Fitur Laporan Dana Kegiatan (Revisi) ---

export type JenisBukti =
  | "Kuitansi"
  | "Nota"
  | "Struk thermal (minimarket/SPBU)"
  | "Tiket"
  | "Tiket pesawat/e-ticket"
  | "Invoice + kuitansi"
  | "Bukti tidak lengkap";

/** Ukuran kotak tempel bukti fisik pada Lembar Tempel Bukti (A4 potret): A = struk (92 × 132 mm), B = kuitansi/tiket lebar (190 × 88 mm), C = kuitansi besar/faktur (190 × 132 mm). */
export type UkuranKotakTempel = "A" | "B" | "C";

export interface ProfilPelapor {
  nama: string;
  jabatan: string;
  lembaga: string;
  proyek: string;
  penyetuju?: string; // nama pada "Disetujui Oleh" di timesheet perdiem
  diubah?: string;
}

/** Satu hari pada file timesheet perdiem. */
export interface BarisTimesheet {
  tanggal: string; // YYYY-MM-DD
  keterangan: string; // kegiatan di lapangan
  lokasi: string;
  jumlah?: number;
}

export interface DataKegiatan {
  id: string;
  nama: string;
  lokasi: string;
  tanggalMulai: string; // YYYY-MM-DD
  tanggalSelesai: string; // YYYY-MM-DD
  catatan?: string;
  urutanTransaksi?: string[]; // Urutan manual ID transaksi untuk WiMIS
  sertakanDaftarPeriksa?: boolean; // Opsi sertakan halaman daftar periksa SPJ
  docxDriveId?: string; // ID file docx di folder Keuangan/Laporan Kegiatan
  batch?: number; // batch kegiatan pada tahun mulainya; menentukan file timesheet yang dipakai
  timesheetId?: string; // ID file timesheet (Google Sheets) di folder Keuangan
  timesheetNama?: string;
  timesheetBaris?: BarisTimesheet[]; // salinan Tanggal/Keterangan/Lokasi dari file timesheet, dipakai dokumen perdiem
  timesheetSinkron?: string; // waktu ISO terakhir isi timesheet ditarik
  timesheetDibuatApp?: boolean; // file dibuat aplikasi (salinan), jadi tanggal dan jumlahnya boleh diperbarui aplikasi
  timesheetKop?: { proyek?: string; nama?: string; penyetuju?: string }; // isian kop file timesheet, cadangan bila Profil Pelapor kosong
  dibuat?: string;
  diubah?: string;
}

export interface RincianBarangJasa {
  banyaknya: number;
  satuan: string;
  hargaSatuan: number;
  total?: number;
  keteranganItem?: string;
}

export interface FotoPendukung {
  id: string;
  nama: string;
  tipe?: string;
  dataUrl?: string;
  driveId?: string;
  driveLink?: string;
  kategoriFoto?: "barang" | "kendaraan" | "kegiatan" | "lainnya";
  keterangan?: string;
  waktu?: string;
}

export interface DetailTransportasi {
  dari?: string;
  ke?: string;
  moda?: string;
  namaSopir?: string;
  noTelpSopir?: string;
  noPolisi?: string;
}

export interface TimesheetRentalItem {
  id: string;
  tanggal: string; // YYYY-MM-DD
  lokasiBasecampRute: string;
  cakupanAktivitas: string;
  jarakKm: number;
}

export interface DetailRentalKendaraan {
  jenisMerk?: string;
  tahun?: string | number;
  noPolisi?: string;
  namaPemilik?: string;
  tarifPerHari?: number;
  tanggalMulai?: string; // YYYY-MM-DD
  tanggalSelesai?: string; // YYYY-MM-DD
  jumlahHari?: number;
  timesheet?: TimesheetRentalItem[];
  persenGrossUpPajak?: number; // default 2, boleh 0
  pajakGrossUpNominal?: number;
}

export interface DetailBBM {
  kmSaatIsi?: number;
  jarakTempuh?: number;
  dari?: string;
  ke?: string;
  noPolisi?: string;
  liter?: number;
  hargaPerLiter?: number;
}

export interface DetailAkomodasi {
  lokasi?: string;
  tanggalMasuk?: string; // YYYY-MM-DD
  tanggalKeluar?: string; // YYYY-MM-DD
  jumlahMalam?: number;
  namaPemilik?: string;
  noTelp?: string;
}

export interface DetailKonsumsi {
  penyedia?: string;
  noTelp?: string;
  lokasi?: string;
  jumlahPeserta?: number;
  /** Kudapan (snack) perjalanan: plafon sepertiga uang harian per penerima manfaat, lihat lib/penerimaManfaat.ts. */
  kudapanPerjalanan?: boolean;
}

export interface DetailHonorarium {
  namaPenerima?: string;
  isPNS?: boolean;
  hasNPWP?: boolean;
  jumlahOrang?: number;
  jumlahHari?: number;
  nomorAbsen?: string;
  honorBruto?: number;
  tarifPajakPersen?: number;
  pajakDipotong?: number;
  honorNetto?: number;
}

export interface DetailPerdiem {
  jumlahHari?: number;
  tarifPerHari?: number;
  keterangan?: string; // mis. wilayah atau rentang tanggal
}

export interface DataKhususKegiatan {
  kegiatanId?: string;
  jenisBukti?: JenisBukti;
  namaPenjualPenyedia?: string;
  rincian?: RincianBarangJasa;
  keteranganLaporan?: string;
  perluSuratJustifikasi?: boolean;
  alasanJustifikasi?: string;
  fotoPendukung?: FotoPendukung[];
  transportasi?: DetailTransportasi;
  rentalKendaraan?: DetailRentalKendaraan;
  bbm?: DetailBBM;
  akomodasi?: DetailAkomodasi;
  konsumsi?: DetailKonsumsi;
  honorarium?: DetailHonorarium;
  perdiem?: DetailPerdiem;
  /** Staf yang memakai fasilitas atau menerima manfaat pengeluaran ini ("numpang klaim"); kosong bila hanya pelapor. */
  penerimaManfaat?: string[];
  /** Ukuran kotak tempel yang dipilih manual; kosong = otomatis menurut kategori dan jenis bukti. */
  kotakTempel?: UkuranKotakTempel;
}

export interface LaporanKegiatanFileContent {
  versi: number;
  terakhirDiubah: string;
  profilPelapor: ProfilPelapor;
  daftarKegiatan: DataKegiatan[];
  rincianTransaksi?: Record<string, DataKhususKegiatan>;
}
