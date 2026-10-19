import { KarakterId, NamaDana } from "../types";

export const STORAGE_KEY = "pengeluaran-harian";
export const BUDGET_KEY = "pengeluaran-harian-anggaran";
export const TEMA_KEY = "keuangan-tema";
export const KARAKTER_KEY = "keuangan-karakter";
export const SYNC_URL_KEY = "keuangan-sync-url";
export const SYNC_KUNCI_KEY = "keuangan-sync-kunci";
export const SYNC_QUEUE_KEY = "keuangan-sync-antrean";
export const SYNC_TIME_KEY = "keuangan-sync-terakhir";
export const ASET_KEY = "keuangan-aset";
export const HARGA_KEY = "keuangan-harga";
export const RECURRING_KEY = "keuangan-transaksi-berulang";

export const KATEGORI: Record<NamaDana, { pemasukan: string[]; pengeluaran: string[] }> = {
  "Dana Pribadi": {
    pemasukan: ["Pemasukan Gaji", "Pemasukan Lain"],
    pengeluaran: [
      "Makan & Minum",
      "Transportasi",
      "Belanja Harian",
      "Pulsa & Internet",
      "Tagihan & Sewa",
      "Keluarga",
      "Tabungan",
      "Hiburan",
      "Lain-lain",
    ],
  },
  "Dana Kegiatan": {
    pemasukan: ["Penerimaan Dana"],
    pengeluaran: [
      "Transportasi & BBM",
      "Konsumsi",
      "Akomodasi",
      "Honor & Upah Lokal",
      "Logistik & Perlengkapan",
      "ATK & Cetak",
      "Komunikasi & Pulsa",
      "Perizinan & Administrasi",
      "Lain-lain",
    ],
  },
};

export const DANA_DEFAULT: NamaDana = "Dana Pribadi";

export const KAITAN: Record<NamaDana, { label: string; placeholder: string }> = {
  "Dana Pribadi": { label: "Sumber / Tujuan", placeholder: "Contoh: Warung Bu Sri - Tanjung Selor" },
  "Dana Kegiatan": { label: "Kaitan Kegiatan", placeholder: "Contoh: Perjalanan Tanjung Selor - Malinau" },
};

export const METODE_BAYAR = [
  "Tunai",
  "Transfer",
  "QRIS",
  "E-wallet",
  "Kartu debit/kredit",
  "Tidak dicatat",
];

export interface KarakterMeta {
  id: KarakterId;
  nama: string;
  lambang: string;
  tagline: string;
  teknik: string;
  domain: string;
}

export const KARAKTER: Record<KarakterId, KarakterMeta> = {
  gojo: {
    id: "gojo",
    nama: "Gojo Satoru",
    lambang: "無",
    tagline: "Penyihir Terkuat · Saldo selalu terjaga aman",
    teknik: "Tanpa Batas (Mukagen)",
    domain: "無量空処 (Muryōkūsho)",
  },
  sukuna: {
    id: "sukuna",
    nama: "Ryomen Sukuna",
    lambang: "宿",
    tagline: "Raja Kutukan · Setiap pengeluaran terhitung tajam",
    teknik: "Tebasan Pembelah",
    domain: "伏魔御廚子 (Fukuma Mizushi)",
  },
  jogo: {
    id: "jogo",
    nama: "Jogo",
    lambang: "火",
    tagline: "Roh Kutukan Api · Jaga anggaran jangan meletus",
    teknik: "Api Gunung Berapi",
    domain: "蓋棺鉄囲山 (Gaikan Tetsuisen)",
  },
  nanami: {
    id: "nanami",
    nama: "Nanami Kento",
    lambang: "七",
    tagline: "Penyihir Tingkat 1 · Disiplin keuangan tepat waktu",
    teknik: "Teknik Rasio 7:3",
    domain: "Titik Lemah 7:3",
  },
  itadori: {
    id: "itadori",
    nama: "Yuji Itadori",
    lambang: "虎",
    tagline: "Wadah Sukuna · Pukulan pengeluaran tepat sasaran",
    teknik: "Kilatan Hitam (Kokusen)",
    domain: "Tinju Berpencar (Divergent Fist)",
  },
  megumi: {
    id: "megumi",
    nama: "Megumi Fushiguro",
    lambang: "影",
    tagline: "Sepuluh Bayangan · Aset terlindungi dalam bayang",
    teknik: "Teknik Sepuluh Bayangan",
    domain: "嵌合暗翳庭 (Chimera Shadow Garden)",
  },
  nobara: {
    id: "nobara",
    nama: "Nobara Kugisaki",
    lambang: "釘",
    tagline: "Penyihir Jujutsu · Pengeluaran tertancap presisi",
    teknik: "Boneka Jerami (Resonansi)",
    domain: "Resonansi Paku (Kanzashi)",
  },
  yuta: {
    id: "yuta",
    nama: "Yuta Okkotsu",
    lambang: "愛",
    tagline: "Penyihir Khusus · Energi tak terbatas masa depan",
    teknik: "Rika & Salin Teknik (Copy)",
    domain: "真正相互愛 (Shinsetsu Sōgo Ai)",
  },
  toji: {
    id: "toji",
    nama: "Toji Fushiguro",
    lambang: "天",
    tagline: "Pembantai Penyihir · Bebas dari takdir dan ikatan kutukan",
    teknik: "Batasan Surgawi Fisik Murni",
    domain: "Gudang Senjata Roh Kutukan",
  },
  geto: {
    id: "geto",
    nama: "Suguru Geto",
    lambang: "呪",
    tagline: "Manipulasi Kutukan · Menghimpun ribuan kekuatan",
    teknik: "Manipulasi Roh Kutukan (Juryoku Sōsa)",
    domain: "極ノ番「うずまき」 (Uzumaki)",
  },
  maki: {
    id: "maki",
    nama: "Maki Zen'in",
    lambang: "真",
    tagline: "Pejuang Tanpa Kutukan · Membelah segalanya dengan baja",
    teknik: "Batasan Surgawi & Pedang Jiwa",
    domain: "Pedang Pemotong Jiwa (Shiratama)",
  },
  mahito: {
    id: "mahito",
    nama: "Mahito",
    lambang: "魂",
    tagline: "Roh Kutukan Jiwa · Bentuk sejati dari kehendak jiwa",
    teknik: "Mutasi Jiwa (Mui Tenpen)",
    domain: "自閉円頓裹 (Jihei Endonka)",
  },
};

export const DAFTAR_KOIN = [
  { id: "bitcoin", simbol: "BTC", nama: "Bitcoin" },
  { id: "ethereum", simbol: "ETH", nama: "Ethereum" },
  { id: "solana", simbol: "SOL", nama: "Solana" },
  { id: "binancecoin", simbol: "BNB", nama: "Binance Coin" },
  { id: "ripple", simbol: "XRP", nama: "XRP" },
  { id: "cardano", simbol: "ADA", nama: "Cardano" },
  { id: "dogecoin", simbol: "DOGE", nama: "Dogecoin" },
  { id: "tether", simbol: "USDT", nama: "Tether" },
  { id: "usd-coin", simbol: "USDC", nama: "USD Coin" },
  { id: "the-open-network", simbol: "TON", nama: "Toncoin" },
];

const fmtRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(n: number): string {
  return fmtRupiah.format(Math.round(Number(n) || 0));
}

export function formatAngka(n: number): string {
  return Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function formatGram(g: number): string {
  return Number(g).toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

export function formatKoin(j: number): string {
  return Number(j).toLocaleString("id-ID", { maximumFractionDigits: 8 });
}

export function formatPersen(p: number): string {
  const tanda = p > 0 ? "+" : "";
  return `${tanda}${p.toFixed(2)}%`;
}

export const namaBulan = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
export const namaBulanPendek = new Intl.DateTimeFormat("id-ID", { month: "short" });
export const namaHari = new Intl.DateTimeFormat("id-ID", { weekday: "long" });

export function hariIni(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function formatTanggalLengkap(iso: string): string {
  if (!iso) return "";
  const [th, bl, tg] = iso.split("-").map(Number);
  const d = new Date(th, bl - 1, tg);
  return `${namaHari.format(d)}, ${tg} ${namaBulan.format(d)}`;
}
