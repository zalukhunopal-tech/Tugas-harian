import { BasisUmur, JenisBarang, MetodePenyusutan, SatuanPemakaian, SatuanWaktu } from "../types";

/**
 * Basis data umur pakai barang untuk fitur Depresiasi Aset.
 *
 * Isinya dikumpulkan dari artikel otomotif dan perawatan (Carmudi, CNN Indonesia, detikOto, Gridoto, Astra iBid, Auto2000,
 * Kia Indonesia, Otodriver, ASUS, Apple) dan dari PMK 72 Tahun 2023 (pengganti PMK 96/PMK.03/2009) untuk kelompok masa manfaat aset.
 * Angka antarsumber berbeda, jadi yang dipakai adalah nilai tengah yang aman; rentang aslinya ikut dicatat di `rentang`.
 * `keyakinan: "sumber"` berarti angkanya ditemukan di sumber yang disebut; `"umum"` berarti patokan umum yang belum ditemukan
 * sumber tegasnya. Buku manual kendaraan atau perangkat selalu didahulukan, dan umur selalu bisa diubah di formulir.
 */

export type KelompokKatalog = "Motor" | "Mobil" | "Elektronik" | "Aset & Perabot";
export type Keyakinan = "sumber" | "umum";
export type KonteksKendaraan = "motor" | "mobil";

export interface PresetBarang {
  id: string;
  nama: string;
  kelompok: KelompokKatalog;
  jenis: JenisBarang;
  basis: BasisUmur;
  umur: number;
  satuanWaktu?: SatuanWaktu;
  satuanPemakaian?: SatuanPemakaian;
  /** Batas waktu kedua (bulan) untuk barang berbasis pemakaian: km atau bulan, mana yang lebih dulu. */
  batasWaktuBulan?: number;
  metode: MetodePenyusutan;
  ikon: string;
  /** Satu baris ringkas: patokan yang dipakai. */
  catatan: string;
  /** Rentang yang ditemukan di sumber, supaya pengguna tahu seberapa pasti angkanya. */
  rentang: string;
  sumber: string;
  keyakinan: Keyakinan;
  /** Kelompok masa manfaat harta berwujud menurut PMK 72/2023 (hanya aset). */
  kelompokPajak?: 1 | 2 | 3 | 4;
  /** Kata atau frasa (huruf kecil) yang mengenali barang ini dari uraian transaksi. */
  kataKunci: string[];
  konteks?: KonteksKendaraan;
}

const motor = (p: Omit<PresetBarang, "kelompok" | "konteks" | "jenis" | "metode">): PresetBarang => ({ kelompok: "Motor", konteks: "motor", jenis: "habis-pakai", metode: "garis-lurus", ...p });
const mobil = (p: Omit<PresetBarang, "kelompok" | "konteks" | "jenis" | "metode">): PresetBarang => ({ kelompok: "Mobil", konteks: "mobil", jenis: "habis-pakai", metode: "garis-lurus", ...p });

export const PRESET_HABIS_PAKAI: PresetBarang[] = [
  /* ---------- motor ---------- */
  motor({
    id: "oli-mesin-motor", nama: "Oli Mesin Motor", ikon: "🛢️", basis: "pemakaian", umur: 2000, satuanPemakaian: "km", batasWaktuBulan: 2,
    catatan: "Ganti tiap 2.000 km atau 2 bulan, mana yang lebih dulu",
    rentang: "2.000–3.000 km atau 2–3 bulan (semi sintetis 2.500–3.000 km, full sintetis 3.500–4.000 km)",
    sumber: "Carmudi, CNN Indonesia, JBA", keyakinan: "sumber", kataKunci: ["oli", "oli mesin", "ganti oli", "oli motor"],
  }),
  motor({
    id: "oli-gardan", nama: "Oli Gardan (Matic)", ikon: "⚙️", basis: "pemakaian", umur: 8000, satuanPemakaian: "km",
    catatan: "Ganti tiap 8.000 km",
    rentang: "8.000 km (anjuran pabrikan motor matic)",
    sumber: "Astra iBid, Carmudi", keyakinan: "sumber", kataKunci: ["oli gardan", "gardan", "oli transmisi motor", "oli cvt"],
  }),
  motor({
    id: "kampas-rem-motor", nama: "Kampas Rem Motor", ikon: "🛑", basis: "pemakaian", umur: 15000, satuanPemakaian: "km",
    catatan: "Ganti tiap 15.000 km atau saat mencapai tanda batas aus",
    rentang: "10.000–15.000 km depan dan belakang; cek tanda batas aus dan bunyi decit",
    sumber: "Astra iBid", keyakinan: "sumber", kataKunci: ["kampas rem", "brake pad", "kampas rem motor", "kampas tromol"],
  }),
  motor({
    id: "busi-motor", nama: "Busi Motor (Standar)", ikon: "⚡", basis: "pemakaian", umur: 10000, satuanPemakaian: "km",
    catatan: "Ganti tiap 10.000 km",
    rentang: "8.000–12.000 km untuk busi standar (perkiraan umum)",
    sumber: "Patokan umum bengkel", keyakinan: "umum", kataKunci: ["busi", "busi motor", "spark plug"],
  }),
  motor({
    id: "busi-iridium", nama: "Busi Iridium", ikon: "✨", basis: "pemakaian", umur: 20000, satuanPemakaian: "km",
    catatan: "Ganti tiap 20.000 km",
    rentang: "20.000–25.000 km (NGK); sebagian sumber menyebut hingga 50.000 km",
    sumber: "NGK, Gridoto, detikOto", keyakinan: "sumber", kataKunci: ["busi iridium", "iridium"],
  }),
  motor({
    id: "v-belt", nama: "V-Belt & Roller CVT", ikon: "🔧", basis: "pemakaian", umur: 25000, satuanPemakaian: "km",
    catatan: "Ganti tiap 25.000 km, servis tiap 10.000 km",
    rentang: "20.000–25.000 km (Yamaha); periksa selip dan retak",
    sumber: "Yamaha via Astra iBid, Gridoto", keyakinan: "sumber", kataKunci: ["v belt", "vbelt", "cvt", "roller", "belt cvt", "van belt"],
  }),
  motor({
    id: "rantai-gir", nama: "Rantai & Gir (Set)", ikon: "⛓️", basis: "pemakaian", umur: 20000, satuanPemakaian: "km",
    catatan: "Ganti tiap 20.000 km",
    rentang: "20.000–30.000 km dengan pelumasan dan penyetelan rutin (perkiraan umum)",
    sumber: "Patokan umum bengkel", keyakinan: "umum", kataKunci: ["rantai", "gir", "gear set", "rantai gir", "kit rantai"],
  }),
  motor({
    id: "ban-motor", nama: "Ban Motor", ikon: "🛞", basis: "pemakaian", umur: 40000, satuanPemakaian: "km", batasWaktuBulan: 48,
    catatan: "Ganti tiap 40.000 km atau 4 tahun, mana yang lebih dulu",
    rentang: "40.000 km atau 3–4 tahun; di atas 5 tahun sebaiknya diganti walau tapak masih tebal",
    sumber: "detikOto, Gridoto", keyakinan: "sumber", kataKunci: ["ban motor", "ban", "ban luar", "ban tubeless", "ban dalam"],
  }),
  motor({
    id: "minyak-rem", nama: "Minyak Rem", ikon: "💧", basis: "pemakaian", umur: 25000, satuanPemakaian: "km", batasWaktuBulan: 24,
    catatan: "Ganti tiap 25.000 km atau 2 tahun, mana yang lebih dulu",
    rentang: "25.000 km atau 2 tahun (Yamaha); bengkel tertentu menyarankan tiap 6 bulan",
    sumber: "detikOto, Gridoto", keyakinan: "sumber", kataKunci: ["minyak rem", "brake fluid", "dot 3", "dot 4"],
  }),
  motor({
    id: "aki-motor", nama: "Aki Motor", ikon: "🔋", basis: "waktu", umur: 24, satuanWaktu: "bulan",
    catatan: "Awet sekitar 2 tahun",
    rentang: "1–2 tahun (aki basah kadang 2–3 tahun, aki kering/MF 1,5–2 tahun); lebih singkat bila beban berat",
    sumber: "Astra iBid, Otodriver, Massiv", keyakinan: "sumber", kataKunci: ["aki", "accu", "aki motor", "battery motor", "aki kering", "aki mf"],
  }),
  /* ---------- mobil ---------- */
  mobil({
    id: "oli-mesin-mobil", nama: "Oli Mesin Mobil (Sintetis)", ikon: "🛢️", basis: "pemakaian", umur: 10000, satuanPemakaian: "km", batasWaktuBulan: 6,
    catatan: "Ganti tiap 10.000 km atau 6 bulan; sering macet sekitar 7.000 km",
    rentang: "10.000 km atau 6 bulan untuk pemakaian normal; 7.000 km bila sering macet",
    sumber: "Autofun, Gridoto, RMOL", keyakinan: "sumber", kataKunci: ["oli", "oli mobil", "oli mesin mobil", "oli sintetis", "full sintetis", "ganti oli mobil"],
  }),
  mobil({
    id: "oli-mesin-mobil-mineral", nama: "Oli Mesin Mobil (Mineral/Semi)", ikon: "🛢️", basis: "pemakaian", umur: 5000, satuanPemakaian: "km", batasWaktuBulan: 6,
    catatan: "Ganti tiap 5.000 km atau 6 bulan",
    rentang: "5.000 km untuk oli mineral atau jalur macet",
    sumber: "Autofun, RMOL", keyakinan: "sumber", kataKunci: ["oli mineral", "oli semi sintetis", "semi sintetis"],
  }),
  mobil({
    id: "oli-transmisi-mobil", nama: "Oli Transmisi / Gardan Mobil", ikon: "⚙️", basis: "pemakaian", umur: 40000, satuanPemakaian: "km", batasWaktuBulan: 24,
    catatan: "Ganti tiap 40.000 km atau 2 tahun; ikuti buku servis",
    rentang: "40.000–60.000 km (matic) atau 40.000–80.000 km (manual); tidak ditemukan sumber tegas",
    sumber: "Patokan umum bengkel", keyakinan: "umum", kataKunci: ["oli transmisi", "atf", "oli matic", "oli gardan mobil", "oli persneling", "oli perseneling"],
  }),
  mobil({
    id: "aki-mobil", nama: "Aki Mobil", ikon: "🔋", basis: "waktu", umur: 30, satuanWaktu: "bulan",
    catatan: "Awet sekitar 2,5 tahun",
    rentang: "1,5–3 tahun, bisa sampai 5 tahun bila pemakaian ringan",
    sumber: "Auto2000, Cermati, Otodriver", keyakinan: "sumber", kataKunci: ["aki", "accu", "aki mobil", "accu mobil", "battery mobil"],
  }),
  mobil({
    id: "ban-mobil", nama: "Ban Mobil", ikon: "🛞", basis: "pemakaian", umur: 40000, satuanPemakaian: "km", batasWaktuBulan: 48,
    catatan: "Ganti tiap 40.000 km atau 4 tahun",
    rentang: "40.000–50.000 km atau 3 tahun; pakar menyebut usia ban 5 tahun sebagai batas, cek kedalaman alur",
    sumber: "Gridoto, detikOto, Auto2000", keyakinan: "sumber", kataKunci: ["ban", "ban mobil", "ban tubeless mobil", "velg dan ban"],
  }),
  mobil({
    id: "kampas-rem-mobil", nama: "Kampas Rem Mobil", ikon: "🛑", basis: "pemakaian", umur: 40000, satuanPemakaian: "km",
    catatan: "Ganti tiap 40.000 km atau saat tebal tinggal 3 mm (depan)",
    rentang: "30.000–40.000 km; transmisi manual 60.000–70.000 km, matic 35.000–40.000 km",
    sumber: "Kia Indonesia, Popmama", keyakinan: "sumber", kataKunci: ["kampas rem", "kampas rem mobil", "brake pad mobil"],
  }),
  mobil({
    id: "busi-mobil", nama: "Busi Mobil (Standar)", ikon: "⚡", basis: "pemakaian", umur: 30000, satuanPemakaian: "km",
    catatan: "Ganti tiap 30.000 km",
    rentang: "20.000–40.000 km (busi nikel/standar)",
    sumber: "Kia Indonesia", keyakinan: "sumber", kataKunci: ["busi", "busi mobil"],
  }),
  mobil({
    id: "busi-mobil-iridium", nama: "Busi Mobil Iridium", ikon: "✨", basis: "pemakaian", umur: 60000, satuanPemakaian: "km",
    catatan: "Ganti tiap 60.000 km",
    rentang: "60.000 km; bengkel resmi tertentu menyebut hingga 100.000 km",
    sumber: "detikOto, Gridoto", keyakinan: "sumber", kataKunci: ["busi iridium", "iridium", "busi iridium mobil"],
  }),
  mobil({
    id: "filter-udara", nama: "Filter Udara Mobil", ikon: "🌬️", basis: "pemakaian", umur: 15000, satuanPemakaian: "km",
    catatan: "Periksa tiap 10.000 km, ganti sekitar 15.000 km",
    rentang: "10.000–20.000 km",
    sumber: "Kia Indonesia", keyakinan: "sumber", kataKunci: ["filter udara", "filter oli", "filter ac", "filter bensin", "saringan udara"],
  }),
  mobil({
    id: "wiper", nama: "Karet Wiper", ikon: "🧽", basis: "waktu", umur: 12, satuanWaktu: "bulan",
    catatan: "Ganti setahun sekali",
    rentang: "12 bulan",
    sumber: "Kia Indonesia", keyakinan: "sumber", kataKunci: ["wiper", "karet wiper", "penyeka kaca"],
  }),
  mobil({
    id: "air-radiator", nama: "Coolant / Air Radiator", ikon: "🌡️", basis: "pemakaian", umur: 40000, satuanPemakaian: "km", batasWaktuBulan: 24,
    catatan: "Kuras dan ganti tiap 40.000 km atau 2 tahun",
    rentang: "40.000 km atau 2 tahun (perkiraan umum; ikuti buku servis)",
    sumber: "Patokan umum bengkel", keyakinan: "umum", kataKunci: ["coolant", "air radiator", "radiator", "cairan pendingin"],
  }),
  mobil({
    id: "timing-belt", nama: "Timing Belt", ikon: "🔩", basis: "pemakaian", umur: 80000, satuanPemakaian: "km", batasWaktuBulan: 60,
    catatan: "Ganti tiap 80.000 km atau 5 tahun; ikuti buku servis",
    rentang: "60.000–100.000 km tergantung mesin (perkiraan umum)",
    sumber: "Patokan umum bengkel", keyakinan: "umum", kataKunci: ["timing belt", "tali kipas", "fan belt", "belt mobil"],
  }),
  /* ---------- baterai perangkat ---------- */
  {
    id: "baterai-ponsel", nama: "Baterai Ponsel / Tablet", kelompok: "Elektronik", jenis: "habis-pakai", basis: "waktu", umur: 24, satuanWaktu: "bulan", metode: "garis-lurus", ikon: "🪫",
    catatan: "Kapasitas tinggal ±80% setelah 500 siklus, sekitar 2 tahun",
    rentang: "500 siklus pengisian ≈ 80% kapasitas (sekitar 1–3 tahun)",
    sumber: "Apple via ANTARA", keyakinan: "sumber", kataKunci: ["baterai hp", "baterai ponsel", "baterai tablet", "battery hp", "baterai"],
  },
  {
    id: "baterai-laptop", nama: "Baterai Laptop", kelompok: "Elektronik", jenis: "habis-pakai", basis: "waktu", umur: 24, satuanWaktu: "bulan", metode: "garis-lurus", ikon: "🔌",
    catatan: "Awet sekitar 2 tahun (300–500 siklus)",
    rentang: "300–500 siklus; kapasitas turun ±20% per tahun bila sering diisi penuh",
    sumber: "ASUS", keyakinan: "sumber", kataKunci: ["baterai laptop", "battery laptop"],
  },
];

const aset = (p: Omit<PresetBarang, "jenis">): PresetBarang => ({ jenis: "aset", ...p });

export const PRESET_ASET: PresetBarang[] = [
  aset({
    id: "laptop", nama: "Laptop / Komputer", kelompok: "Elektronik", basis: "waktu", umur: 4, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "💻", kelompokPajak: 1,
    catatan: "Kelompok 1: 4 tahun, susut lebih cepat di awal",
    rentang: "4 tahun (tarif saldo menurun 50%, garis lurus 25%)",
    sumber: "PMK 72/2023", keyakinan: "sumber", kataKunci: ["laptop", "notebook", "komputer", "pc", "macbook", "chromebook", "monitor", "keyboard"],
  }),
  aset({
    id: "ponsel", nama: "Ponsel / Tablet", kelompok: "Elektronik", basis: "waktu", umur: 4, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "📱", kelompokPajak: 1,
    catatan: "Kelompok 1: 4 tahun, susut lebih cepat di awal",
    rentang: "3–4 tahun (umur ekonomis populer 3 tahun; kelompok pajak diperkirakan Kelompok 1)",
    sumber: "PMK 72/2023 (perkiraan), praktik umum", keyakinan: "umum", kataKunci: ["hp", "handphone", "ponsel", "smartphone", "tablet", "ipad", "iphone", "android"],
  }),
  aset({
    id: "kamera-elektronik", nama: "Kamera, Printer & Elektronik Kantor", kelompok: "Elektronik", basis: "waktu", umur: 4, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "📷", kelompokPajak: 1,
    catatan: "Kelompok 1: 4 tahun",
    rentang: "4 tahun (mesin kantor dan perlengkapan elektronik)",
    sumber: "PMK 72/2023", keyakinan: "sumber", kataKunci: ["kamera", "printer", "proyektor", "projector", "scanner", "drone", "gps", "speaker", "headset", "powerbank", "mesin hitung", "hard disk", "harddisk", "ssd", "flashdisk"],
  }),
  aset({
    id: "sepeda-motor", nama: "Sepeda Motor", kelompok: "Motor", konteks: "motor", basis: "waktu", umur: 4, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "🏍️", kelompokPajak: 1,
    catatan: "Kelompok 1: 4 tahun, susut lebih cepat di awal",
    rentang: "4 tahun (saldo menurun 50%); umur pakai fisik jauh lebih panjang",
    sumber: "PMK 72/2023", keyakinan: "sumber", kataKunci: ["sepeda motor", "beli motor", "motor baru", "motor bekas", "dp motor", "cicilan motor"],
  }),
  aset({
    id: "mobil-aset", nama: "Mobil", kelompok: "Mobil", konteks: "mobil", basis: "waktu", umur: 8, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "🚗", kelompokPajak: 2,
    catatan: "Kelompok 2: 8 tahun, susut lebih cepat di awal",
    rentang: "8 tahun (saldo menurun 25%, garis lurus 12,5%); umur pakai fisik lebih panjang",
    sumber: "PMK 72/2023 (perkiraan kelompok)", keyakinan: "umum", kataKunci: ["beli mobil", "mobil baru", "mobil bekas", "dp mobil", "cicilan mobil", "truk", "pickup", "pick up"],
  }),
  aset({
    id: "perabot-kayu", nama: "Mebel & Perabot Kayu", kelompok: "Aset & Perabot", basis: "waktu", umur: 4, satuanWaktu: "tahun", metode: "garis-lurus", ikon: "🪑", kelompokPajak: 1,
    catatan: "Kelompok 1: 4 tahun, susut rata tiap tahun",
    rentang: "4 tahun untuk mebel dan peralatan dari kayu atau rotan",
    sumber: "PMK 72/2023", keyakinan: "sumber", kataKunci: ["meja", "kursi", "lemari", "rak", "kasur", "ranjang", "sofa", "mebel", "furnitur", "perabot"],
  }),
  aset({
    id: "perabot-logam", nama: "Mebel Logam, AC & Peralatan Besar", kelompok: "Aset & Perabot", basis: "waktu", umur: 8, satuanWaktu: "tahun", metode: "garis-lurus", ikon: "❄️", kelompokPajak: 2,
    catatan: "Kelompok 2: 8 tahun, susut rata tiap tahun",
    rentang: "8 tahun untuk mebel logam, pendingin ruangan, dan sejenisnya (perkiraan kelompok)",
    sumber: "PMK 72/2023 (perkiraan kelompok)", keyakinan: "umum", kataKunci: ["ac", "air conditioner", "kulkas", "lemari es", "mesin cuci", "tv", "televisi", "genset", "kipas angin", "dispenser", "kompor"],
  }),
  aset({
    id: "peralatan-kerja", nama: "Peralatan & Perlengkapan Lain", kelompok: "Aset & Perabot", basis: "waktu", umur: 5, satuanWaktu: "tahun", metode: "garis-lurus", ikon: "🧰",
    catatan: "Perkiraan 5 tahun, susut rata tiap tahun",
    rentang: "4–8 tahun tergantung jenis; dipakai bila barang tidak ada di daftar",
    sumber: "Praktik umum", keyakinan: "umum", kataKunci: ["peralatan", "perlengkapan", "tenda", "ransel", "tas", "sepatu", "jaket", "bor", "mesin", "pompa", "gergaji", "senter", "tripod"],
  }),
];

export const SEMUA_PRESET: PresetBarang[] = [...PRESET_HABIS_PAKAI, ...PRESET_ASET];

export function cariPreset(id: string | undefined): PresetBarang | undefined {
  return SEMUA_PRESET.find((p) => p.id === id);
}

/** Preset menurut kelompoknya, urut seperti di atas (untuk daftar katalog). */
export function presetPerKelompok(): Array<{ kelompok: KelompokKatalog; daftar: PresetBarang[] }> {
  const urut: KelompokKatalog[] = ["Motor", "Mobil", "Elektronik", "Aset & Perabot"];
  return urut
    .map((kelompok) => ({ kelompok, daftar: SEMUA_PRESET.filter((p) => p.kelompok === kelompok) }))
    .filter((g) => g.daftar.length > 0);
}

/* ---------- mengenali barang dari uraian ---------- */

const KATA_MOTOR = ["motor", "matic", "matik", "vario", "beat", "nmax", "pcx", "scoopy", "mio", "supra", "vixion", "revo", "aerox", "xmax", "vespa", "satria", "cb150", "ninja", "scorpio", "sepeda motor"];
const KATA_MOBIL = ["mobil", "avanza", "xenia", "innova", "brio", "jazz", "agya", "ayla", "fortuner", "pajero", "civic", "kijang", "xpander", "rush", "terios", "sigra", "calya", "hilux", "triton", "carry", "apv", "ertiga", "hrv", "crv", "camry", "yaris"];

/** Teks dinormalkan: huruf kecil, tanda baca menjadi spasi, diapit spasi supaya pencocokan kata utuh mudah. */
export function normalkanTeks(teks: string): string {
  return ` ${teks.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const memuat = (teksNormal: string, frasa: string) => teksNormal.includes(` ${frasa.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `);

export interface KecocokanPreset {
  preset: PresetBarang;
  /** Skor pencocokan; semakin tinggi semakin pasti. */
  skor: number;
}

/**
 * Mencari barang di katalog yang cocok dengan uraian. Frasa yang lebih panjang lebih spesifik (skor lebih tinggi); kata motor
 * atau mobil di uraian memilih antara preset motor dan mobil, dan bila tidak disebut motor yang diutamakan.
 */
export function cariPresetDariTeks(teks: string): KecocokanPreset | null {
  const t = normalkanTeks(teks);
  if (t.trim() === "") return null;
  const sebutMobil = KATA_MOBIL.some((k) => memuat(t, k));
  const sebutMotor = KATA_MOTOR.some((k) => memuat(t, k));
  let terbaik: KecocokanPreset | null = null;
  for (const preset of SEMUA_PRESET) {
    let skor = 0;
    for (const k of preset.kataKunci) {
      if (memuat(t, k)) skor = Math.max(skor, 10 + k.split(" ").length * 5);
    }
    if (skor === 0) continue;
    if (preset.konteks === "mobil") skor += sebutMobil ? 6 : sebutMotor ? -6 : 0;
    if (preset.konteks === "motor") skor += sebutMotor ? 6 : sebutMobil ? -6 : 1;
    if (!terbaik || skor > terbaik.skor) terbaik = { preset, skor };
  }
  return terbaik;
}
