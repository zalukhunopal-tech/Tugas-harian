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
export const LAPORAN_AGENDA_KEY = "keuangan-laporan-agenda";

export const KATEGORI: Record<NamaDana, { pemasukan: string[]; pengeluaran: string[] }> = {
  "Dana Pribadi": {
    pemasukan: ["Pemasukan Gaji", "Pemasukan Lain", "Perdiem"],
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
      "Transportasi",
      "Rental Kendaraan",
      "BBM",
      "Akomodasi",
      "Konsumsi",
      "Honorarium & Ganti Hari",
      "Pengadaan Barang & Perlengkapan",
      "Komunikasi, Listrik & Kurir",
      "Perdiem",
      "Lain-lain",
    ],
  },
};

export const KELOMPOK_DANA_KEGIATAN = KATEGORI["Dana Kegiatan"].pengeluaran;

export const PEMETAAN_KATEGORI_LAMA_KEGIATAN: Record<string, string> = {
  "Transportasi & BBM": "Transportasi",
  "Honor & Upah Lokal": "Honorarium & Ganti Hari",
  "Logistik & Perlengkapan": "Pengadaan Barang & Perlengkapan",
  "ATK & Cetak": "Pengadaan Barang & Perlengkapan",
  "Komunikasi & Pulsa": "Komunikasi, Listrik & Kurir",
  "Perizinan & Administrasi": "Lain-lain",
};

export function petakanKategoriLama(kategori: string, dana: NamaDana): string {
  if (dana === "Dana Kegiatan" && PEMETAAN_KATEGORI_LAMA_KEGIATAN[kategori]) {
    return PEMETAAN_KATEGORI_LAMA_KEGIATAN[kategori];
  }
  return kategori;
}

export const LAPORAN_KEGIATAN_KEY = "keuangan-laporan-kegiatan";
export const PROFIL_PELAPOR_KEY = "keuangan-profil-pelapor";
export const DAFTAR_KEGIATAN_KEY = "keuangan-daftar-kegiatan";

/** Sengaja kosong: aplikasi ini dipakai banyak orang, jadi tidak ada nama atau lembaga yang ikut terpasang. Diisi di tab Saya → Laporan Kegiatan (bagian Profil Pelapor). */
export const PROFIL_PELAPOR_DEFAULT = {
  nama: "",
  jabatan: "",
  lembaga: "",
  proyek: "",
  penyetuju: "",
};

export const DAFTAR_JENIS_BUKTI = [
  "Kwitansi",
  "Nota",
  "Struk thermal (minimarket/SPBU)",
  "Tiket",
  "Tiket pesawat/e-ticket",
  "Invoice + kwitansi",
  "Bukti tidak lengkap",
] as const;

export const DANA_DEFAULT: NamaDana = "Dana Pribadi";

export const KAITAN: Record<NamaDana, { label: string; placeholder: string }> = {
  "Dana Pribadi": { label: "Sumber / Tujuan", placeholder: "Contoh: Warung Bu Sri - Kota A" },
  "Dana Kegiatan": { label: "Kaitan Kegiatan", placeholder: "Contoh: Perjalanan Kota A - Kota B" },
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
}

export const KARAKTER: Record<KarakterId, KarakterMeta> = {
  gojo: {
    id: "gojo",
    nama: "Gojo Satoru",
    lambang: "無",
    tagline: "Penyihir Terkuat · Saldo selalu terjaga aman",
    teknik: "Tanpa Batas (Mukagen)",
  },
  sukuna: {
    id: "sukuna",
    nama: "Ryomen Sukuna",
    lambang: "宿",
    tagline: "Raja Kutukan · Setiap pengeluaran terhitung tajam",
    teknik: "Tebasan Pembelah",
  },
  jogo: {
    id: "jogo",
    nama: "Jogo",
    lambang: "火",
    tagline: "Roh Kutukan Api · Jaga anggaran jangan meletus",
    teknik: "Api Gunung Berapi",
  },
  nanami: {
    id: "nanami",
    nama: "Nanami Kento",
    lambang: "七",
    tagline: "Penyihir Tingkat 1 · Disiplin keuangan tepat waktu",
    teknik: "Teknik Rasio 7:3",
  },
  itadori: {
    id: "itadori",
    nama: "Yuji Itadori",
    lambang: "虎",
    tagline: "Wadah Sukuna · Pukulan pengeluaran tepat sasaran",
    teknik: "Kilatan Hitam (Kokusen)",
  },
  megumi: {
    id: "megumi",
    nama: "Megumi Fushiguro",
    lambang: "影",
    tagline: "Sepuluh Bayangan · Aset terlindungi dalam bayang",
    teknik: "Teknik Sepuluh Bayangan",
  },
  nobara: {
    id: "nobara",
    nama: "Nobara Kugisaki",
    lambang: "釘",
    tagline: "Penyihir Jujutsu · Pengeluaran tertancap presisi",
    teknik: "Boneka Jerami (Resonansi)",
  },
  yuta: {
    id: "yuta",
    nama: "Yuta Okkotsu",
    lambang: "愛",
    tagline: "Penyihir Khusus · Energi tak terbatas masa depan",
    teknik: "Rika & Salin Teknik (Copy)",
  },
  toji: {
    id: "toji",
    nama: "Toji Fushiguro",
    lambang: "天",
    tagline: "Pembantai Penyihir · Bebas dari takdir dan ikatan kutukan",
    teknik: "Batasan Surgawi Fisik Murni",
  },
  geto: {
    id: "geto",
    nama: "Suguru Geto",
    lambang: "呪",
    tagline: "Manipulasi Kutukan · Menghimpun ribuan kekuatan",
    teknik: "Manipulasi Roh Kutukan (Juryoku Sōsa)",
  },
  maki: {
    id: "maki",
    nama: "Maki Zen'in",
    lambang: "真",
    tagline: "Pejuang Tanpa Kutukan · Membelah segalanya dengan baja",
    teknik: "Batasan Surgawi & Pedang Jiwa",
  },
  mahito: {
    id: "mahito",
    nama: "Mahito",
    lambang: "魂",
    tagline: "Roh Kutukan Jiwa · Bentuk sejati dari kehendak jiwa",
    teknik: "Mutasi Jiwa (Mui Tenpen)",
  },
};

export const KATA_BIJAK_KEUANGAN: Record<KarakterId, string[]> = {
  gojo: [
    "Kekayaan sejati adalah kendali tanpa batas atas nafsu pengeluaran.",
    "Batas anggaranmu harus kokoh bagaikan dinding Infinity.",
    "Harta yang terjaga memberi ketenangan hidup tanpa batas.",
  ],
  sukuna: [
    "Kuasai setiap keping hartamu sebelum nafsu memperbudakmu.",
    "Tebas habis pengeluaran impulsif tanpa ampun.",
    "Raja sejati berkuasa karena cermat menghitung tiap sumber daya.",
  ],
  jogo: [
    "Jangan biarkan emosi sesaat membakar ludes tabungan masa depan.",
    "Dinginkan keinginan belanja sebelum api pemborosan meletus.",
    "Tabungan yang aman adalah benteng dari kobaran krisis.",
  ],
  nanami: [
    "Disiplin keuangan adalah kedewasaan sejati: catat tepat waktu, alokasikan 7:3.",
    "Bekerja keraslah dengan rencana, jangan lembur demi menambal utang.",
    "Uang bukan segalanya, tapi kebebasan finansial memberi martabat.",
  ],
  itadori: [
    "Kebaikan terbaik bagi diri sendiri adalah merawat keuangan hari ini.",
    "Sedikit demi sedikit, pukulan tabungan rutin akan menjadi bukit.",
    "Hidup sederhana membuat hati tenang dan langkah semakin ringan.",
  ],
  megumi: [
    "Siapkan dana darurat dalam bayangan sebelum badai tak terduga tiba.",
    "Aset terbaik adalah yang tersembunyi aman dan terus bertumbuh.",
    "Pikirkan langkah finansial tiga langkah ke depan sebelum bertindak.",
  ],
  nobara: [
    "Tampil percaya diri dan bergaya tanpa harus menusuk tabungan sendiri.",
    "Cantik dan mandiri dimulai dari kantong yang selalu terisi.",
    "Ketahui nilai dirimu dan hargai setiap rupiah hasil keringatmu.",
  ],
  yuta: [
    "Energi finansial terbaik dialirkan untuk melindungi orang yang dicintai.",
    "Cinta sejati berlandaskan tanggung jawab dan masa depan yang mapan.",
    "Kendalikan kekuatan uangmu untuk kebaikan dan masa depan berkah.",
  ],
  toji: [
    "Bebas dari jeratan utang adalah kemerdekaan hidup yang sesungguhnya.",
    "Fokus pada nilai dan kegunaan nyata, bukan gengsi semu.",
    "Harta sejati adalah keterampilan dan kemandirian tanpa beban.",
  ],
  geto: [
    "Himpun dan kelola setiap aliran dana demi visi besar masa depan.",
    "Kekuatan finansial lahir dari konsistensi menyatukan hal-hal kecil.",
    "Kelola setiap rupiah dengan bijak demi cita-cita yang luhur.",
  ],
  maki: [
    "Dengan tekad baja dan hidup hemat, semua rintangan finansial runtuh.",
    "Tak butuh keistimewaan untuk kaya, cukup disiplin dan kerja keras.",
    "Pangkas pengeluaran tak perlu seperti bilah pedang yang tajam.",
  ],
  mahito: [
    "Bentuk masa depanmu diukir oleh tiap keputusan uangmu hari ini.",
    "Ubah kebiasaan buruk finansial menjadi kekuatan hidup yang baru.",
    "Setiap rupiah adalah benih yang akan membentuk kemakmuran esok.",
  ],
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

const namaBulanSaja = new Intl.DateTimeFormat("id-ID", { month: "long" });

function pecahTanggal(iso: string): { th: number; bl: number; tg: number } | null {
  const [th, bl, tg] = (iso || "").split("-").map(Number);
  return th && bl && tg ? { th, bl, tg } : null;
}

/** "2026-10-23" -> "23 Oktober 2026" (tanpa nama hari). */
export function formatTanggalPanjang(iso: string): string {
  const p = pecahTanggal(iso);
  return p ? `${p.tg} ${namaBulanSaja.format(new Date(p.th, p.bl - 1, p.tg))} ${p.th}` : "";
}

/**
 * Rentang tanggal ringkas tanpa nama hari: "23 Oktober 2026", "1 – 23 Oktober 2026",
 * "1 Oktober – 3 November 2026", atau "20 Desember 2026 – 3 Januari 2027".
 */
export function formatRentangTanggal(mulai: string, selesai: string): string {
  const a = pecahTanggal(mulai);
  const b = pecahTanggal(selesai);
  if (!a || !b) return formatTanggalPanjang(mulai || selesai);
  if (mulai === selesai) return formatTanggalPanjang(mulai);
  if (a.th === b.th && a.bl === b.bl) return `${a.tg} – ${formatTanggalPanjang(selesai)}`;
  if (a.th === b.th) {
    return `${a.tg} ${namaBulanSaja.format(new Date(a.th, a.bl - 1, a.tg))} – ${formatTanggalPanjang(selesai)}`;
  }
  return `${formatTanggalPanjang(mulai)} – ${formatTanggalPanjang(selesai)}`;
}

export function formatTanggalLengkap(iso: string): string {
  if (!iso) return "";
  const [th, bl, tg] = iso.split("-").map(Number);
  const d = new Date(th, bl - 1, tg);
  return `${namaHari.format(d)}, ${tg} ${namaBulan.format(d)}`;
}
