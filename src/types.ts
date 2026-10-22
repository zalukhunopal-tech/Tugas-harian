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
}

export type AnggaranKategoriMap = Record<NamaDana, Record<string, number>>;

export interface PengaturanKeuangan {
  anggaranHarian: number;
  anggaranKategori: AnggaranKategoriMap;
  terakhirDiubah?: string;
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

