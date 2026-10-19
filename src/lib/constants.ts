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
    tagline: "無下限呪術 · Tanpa Batas. Saldo tak terhingga? Sayangnya tidak.",
    teknik: "Tanpa Batas · Enam Mata",
    domain: "領域展開: 無量空処 — Muryōkūsho",
  },
  sukuna: {
    id: "sukuna",
    nama: "Ryomen Sukuna",
    lambang: "宿",
    tagline: "呪いの王 · Raja Kutukan. Setiap pengeluaran adalah tebasan.",
    teknik: "Raja Kutukan · Tebasan",
    domain: "領域展開: 伏魔御廚子 — Fukuma Mizushi",
  },
  jogo: {
    id: "jogo",
    nama: "Jogo",
    lambang: "火",
    tagline: "蓋棺鉄囲山 · Jangan biarkan anggaran meletus.",
    teknik: "Kutukan Gunung Berapi",
    domain: "領域展開: 蓋棺鉄囲山 — Gaikan Tetsuisen",
  },
  nanami: {
    id: "nanami",
    nama: "Nanami Kento",
    lambang: "七",
    tagline: "十劃呪法 · Rasio 7:3. Kerja lembur tidak dibayar.",
    teknik: "Teknik Rasio 7:3",
    domain: "Lembur berakhir. Titik lemah 7:3.",
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
