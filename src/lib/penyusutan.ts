import { BasisUmur, ItemPenyusutan, JenisBarang, MetodePenyusutan, SatuanPemakaian, SatuanWaktu } from "../types";

/**
 * Penyusutan nilai dan prediksi umur pakai barang (fitur opsional pada pengeluaran pembelian barang).
 *
 * Variabel: C harga beli, S nilai residu, n total estimasi umur pakai, t umur yang sudah berjalan (dalam satuan yang sama dengan n).
 *   Garis lurus (straight-line):  D = (C - S) / n;   BV_t = C - D × t;   P_sisa = BV_t / C × 100%
 *   Saldo menurun ganda (DDB):    R = 2 / n;         BV_t = C × (1 - R)^t, tidak kurang dari S
 *   Sisa umur pakai (RUL), waktu:  Sisa Hari = Total Umur (hari) - (hari ini - tanggal beli/ganti)
 *   Sisa umur pakai (RUL), jarak:  Sisa KM   = Batas Umur KM - (KM saat ini - KM saat ganti)
 *   P_umur = Sisa Umur / Total Estimasi Umur × 100%
 * Peringatan otomatis bila P_sisa ATAU P_umur menyentuh atau berada di bawah 30%.
 */

/** Persentase sisa nilai atau sisa umur pada atau di bawah angka ini memicu peringatan. */
export const AMBANG_PERINGATAN = 30;
/** Pada atau di bawah angka ini peringatan dianggap mendesak (merah menyala). */
export const AMBANG_KRITIS = 10;

export const HARI_PER_SATUAN: Record<SatuanWaktu, number> = { hari: 1, bulan: 365.25 / 12, tahun: 365.25 };
export const LABEL_SATUAN_WAKTU: Record<SatuanWaktu, string> = { hari: "hari", bulan: "bulan", tahun: "tahun" };
export const LABEL_SATUAN_PEMAKAIAN: Record<SatuanPemakaian, string> = { km: "km", jam: "jam" };
export const LABEL_METODE: Record<MetodePenyusutan, string> = {
  "garis-lurus": "Garis Lurus",
  "saldo-menurun-ganda": "Saldo Menurun Ganda",
};

/* ---------- preset barang ---------- */

export interface PresetBarang {
  id: string;
  nama: string;
  jenis: JenisBarang;
  basis: BasisUmur;
  umur: number;
  satuanWaktu?: SatuanWaktu;
  satuanPemakaian?: SatuanPemakaian;
  metode: MetodePenyusutan;
  ikon: string;
  /** Patokan umum; umur sebenarnya bergantung merek dan pemakaian, jadi selalu bisa diubah. */
  catatan?: string;
}

export const PRESET_HABIS_PAKAI: PresetBarang[] = [
  { id: "oli-mesin-motor", nama: "Oli Mesin Motor", jenis: "habis-pakai", basis: "pemakaian", umur: 2000, satuanPemakaian: "km", metode: "garis-lurus", ikon: "🛢️", catatan: "Ganti tiap ±2.000 km" },
  { id: "oli-gardan", nama: "Oli Gardan", jenis: "habis-pakai", basis: "pemakaian", umur: 8000, satuanPemakaian: "km", metode: "garis-lurus", ikon: "⚙️", catatan: "Ganti tiap ±8.000 km" },
  { id: "kampas-rem", nama: "Kampas Rem", jenis: "habis-pakai", basis: "pemakaian", umur: 20000, satuanPemakaian: "km", metode: "garis-lurus", ikon: "🛑", catatan: "Ganti tiap ±20.000 km" },
  { id: "aki", nama: "Aki (Accu)", jenis: "habis-pakai", basis: "waktu", umur: 24, satuanWaktu: "bulan", metode: "garis-lurus", ikon: "🔋", catatan: "Awet ±2 tahun" },
  { id: "ban", nama: "Ban", jenis: "habis-pakai", basis: "pemakaian", umur: 20000, satuanPemakaian: "km", metode: "garis-lurus", ikon: "🛞", catatan: "Ganti tiap ±20.000 km" },
  { id: "baterai", nama: "Baterai", jenis: "habis-pakai", basis: "waktu", umur: 24, satuanWaktu: "bulan", metode: "garis-lurus", ikon: "🪫", catatan: "Awet ±2 tahun" },
  { id: "busi", nama: "Busi", jenis: "habis-pakai", basis: "pemakaian", umur: 10000, satuanPemakaian: "km", metode: "garis-lurus", ikon: "⚡", catatan: "Ganti tiap ±10.000 km" },
  { id: "rantai-gir", nama: "Rantai & Gir", jenis: "habis-pakai", basis: "pemakaian", umur: 20000, satuanPemakaian: "km", metode: "garis-lurus", ikon: "⛓️", catatan: "Ganti tiap ±20.000 km" },
];

export const PRESET_ASET: PresetBarang[] = [
  { id: "laptop", nama: "Laptop / Komputer", jenis: "aset", basis: "waktu", umur: 4, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "💻", catatan: "±4 tahun, susut lebih cepat di awal" },
  { id: "ponsel", nama: "Ponsel / Tablet", jenis: "aset", basis: "waktu", umur: 3, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "📱", catatan: "±3 tahun" },
  { id: "kendaraan", nama: "Kendaraan Bermotor", jenis: "aset", basis: "waktu", umur: 8, satuanWaktu: "tahun", metode: "saldo-menurun-ganda", ikon: "🏍️", catatan: "±8 tahun" },
  { id: "peralatan-kerja", nama: "Peralatan Kerja", jenis: "aset", basis: "waktu", umur: 5, satuanWaktu: "tahun", metode: "garis-lurus", ikon: "🧰", catatan: "±5 tahun" },
  { id: "perabot", nama: "Perabot / Furnitur", jenis: "aset", basis: "waktu", umur: 8, satuanWaktu: "tahun", metode: "garis-lurus", ikon: "🪑", catatan: "±8 tahun" },
];

export const SEMUA_PRESET: PresetBarang[] = [...PRESET_HABIS_PAKAI, ...PRESET_ASET];

export function cariPreset(id: string | undefined): PresetBarang | undefined {
  return SEMUA_PRESET.find((p) => p.id === id);
}

/* ---------- perhitungan ---------- */

export type TingkatUmur = "aman" | "mendekati" | "kritis" | "habis";

export interface HasilPenyusutan {
  /** Umur yang sudah berjalan (t), dalam satuan item. */
  berjalan: number;
  /** Beban penyusutan per satuan (D): garis lurus (C - S) / n; saldo menurun ganda: beban satuan pertama (C × R). */
  bebanPerSatuan: number;
  nilaiBuku: number;
  persenSisaNilai: number;
  /** Sisa umur dalam satuan item (hari/bulan/tahun atau km/jam), tidak negatif. */
  sisaUmur: number;
  /** Sisa umur dalam hari (basis waktu) atau dalam satuan pemakaian (basis pemakaian). */
  sisaUmurHari?: number;
  sisaPemakaian?: number;
  persenSisaUmur: number;
  /** Yang terkecil dari P_sisa dan P_umur: dasar peringatan dan warna bar. */
  persenTerendah: number;
  tingkat: TingkatUmur;
  perluPeringatan: boolean;
  /** Perkiraan tanggal habis (basis waktu). */
  tanggalHabis?: string;
}

const MS_HARI = 24 * 60 * 60 * 1000;

function selisihHari(dariIso: string, keIso: string): number {
  const a = Date.parse(`${dariIso}T00:00:00Z`);
  const b = Date.parse(`${keIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / MS_HARI);
}

function tambahHari(iso: string, hari: number): string {
  const d = new Date(Date.parse(`${iso}T00:00:00Z`) + Math.round(hari) * MS_HARI);
  return d.toISOString().slice(0, 10);
}

const batas = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Umur yang sudah berjalan (t) dalam satuan umur total item. */
export function umurBerjalan(item: ItemPenyusutan, hariIni: string): number {
  if (item.basis === "pemakaian") {
    const awal = Number(item.pemakaianAwal) || 0;
    const kini = item.pemakaianSekarang === undefined ? awal : Number(item.pemakaianSekarang) || 0;
    return Math.max(0, kini - awal);
  }
  const hari = Math.max(0, selisihHari(item.tanggalMulai, hariIni));
  return hari / HARI_PER_SATUAN[item.satuanWaktu ?? "hari"];
}

/** Hitung penyusutan dan sisa umur; null bila data belum cukup (umur total atau harga belum diisi). */
export function hitungPenyusutan(item: ItemPenyusutan, hariIni: string): HasilPenyusutan | null {
  const C = Number(item.harga) || 0;
  const n = Number(item.umurTotal) || 0;
  if (!(n > 0) || !(C > 0)) return null;
  const S = batas(Number(item.nilaiResidu) || 0, 0, C);
  const t = umurBerjalan(item, hariIni);

  let nilaiBuku: number;
  let bebanPerSatuan: number;
  if (item.metode === "saldo-menurun-ganda") {
    const R = 2 / n;
    bebanPerSatuan = C * Math.min(R, 1);
    nilaiBuku = R >= 1 ? (t > 0 ? S : C) : C * Math.pow(1 - R, t);
    nilaiBuku = Math.max(S, nilaiBuku);
  } else {
    bebanPerSatuan = (C - S) / n;
    nilaiBuku = Math.max(S, C - bebanPerSatuan * t);
  }
  const persenSisaNilai = batas((nilaiBuku / C) * 100, 0, 100);

  const sisaUmur = Math.max(0, n - t);
  const persenSisaUmur = batas((sisaUmur / n) * 100, 0, 100);
  const persenTerendah = Math.min(persenSisaNilai, persenSisaUmur);

  const hasil: HasilPenyusutan = {
    berjalan: t,
    bebanPerSatuan,
    nilaiBuku,
    persenSisaNilai,
    sisaUmur,
    persenSisaUmur,
    persenTerendah,
    perluPeringatan: persenTerendah <= AMBANG_PERINGATAN,
    tingkat: persenSisaUmur <= 0 ? "habis" : persenTerendah <= AMBANG_KRITIS ? "kritis" : persenTerendah <= AMBANG_PERINGATAN ? "mendekati" : "aman",
  };
  if (item.basis === "waktu") {
    const totalHari = n * HARI_PER_SATUAN[item.satuanWaktu ?? "hari"];
    const terpakaiHari = Math.max(0, selisihHari(item.tanggalMulai, hariIni));
    hasil.sisaUmurHari = Math.max(0, Math.round(totalHari - terpakaiHari));
    hasil.tanggalHabis = tambahHari(item.tanggalMulai, totalHari);
  } else {
    hasil.sisaPemakaian = sisaUmur;
  }
  return hasil;
}

/** Item yang perlu diperingatkan (≤ 30%), yang paling mendesak lebih dulu. */
export function itemPerluPeringatan(daftar: ItemPenyusutan[], hariIni: string): Array<{ item: ItemPenyusutan; hasil: HasilPenyusutan }> {
  const hasil: Array<{ item: ItemPenyusutan; hasil: HasilPenyusutan }> = [];
  for (const item of daftar) {
    const h = hitungPenyusutan(item, hariIni);
    if (h && h.perluPeringatan) hasil.push({ item, hasil: h });
  }
  return hasil.sort((a, b) => a.hasil.persenTerendah - b.hasil.persenTerendah);
}

/* ---------- teks tampilan ---------- */

export function formatPersen(p: number): string {
  return `${Math.round(p)}%`;
}

/** Beban penyusutan per satuan: Rupiah utuh, tetapi beban kecil (mis. Rp32,50 per km) tidak dibulatkan ke angka bulat. */
export function formatBeban(n: number): string {
  if (n >= 1000) return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  return `Rp ${n.toLocaleString("id-ID", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "3 bulan 12 hari" untuk basis waktu; "1.240 km" untuk basis pemakaian. */
export function teksSisaUmur(item: ItemPenyusutan, h: HasilPenyusutan): string {
  if (item.basis === "pemakaian") {
    return `${Math.round(h.sisaUmur).toLocaleString("id-ID")} ${LABEL_SATUAN_PEMAKAIAN[item.satuanPemakaian ?? "km"]}`;
  }
  const hari = h.sisaUmurHari ?? 0;
  if (hari <= 0) return "0 hari";
  if (hari < 31) return `${hari} hari`;
  if (hari < 365) {
    const bulan = Math.floor(hari / (365.25 / 12));
    const sisaHari = Math.round(hari - bulan * (365.25 / 12));
    return sisaHari > 0 ? `${bulan} bulan ${sisaHari} hari` : `${bulan} bulan`;
  }
  const tahun = Math.floor(hari / 365.25);
  const bulan = Math.round((hari - tahun * 365.25) / (365.25 / 12));
  return bulan > 0 ? `${tahun} tahun ${bulan} bulan` : `${tahun} tahun`;
}

export function teksUmurTotal(item: Pick<ItemPenyusutan, "basis" | "umurTotal" | "satuanWaktu" | "satuanPemakaian">): string {
  const angka = Number(item.umurTotal).toLocaleString("id-ID");
  return item.basis === "pemakaian"
    ? `${angka} ${LABEL_SATUAN_PEMAKAIAN[item.satuanPemakaian ?? "km"]}`
    : `${angka} ${LABEL_SATUAN_WAKTU[item.satuanWaktu ?? "tahun"]}`;
}

export function pesanPeringatan(item: ItemPenyusutan, h: HasilPenyusutan): string {
  const sisa = formatPersen(h.persenTerendah);
  if (h.tingkat === "habis") return `${item.nama} sudah melewati umur pakai. Segera ganti atau servis.`;
  if (h.tingkat === "kritis") return `${item.nama} tinggal ${sisa}: segera ganti atau servis.`;
  return `${item.nama} mendekati batas umur pakai (${sisa} tersisa): siapkan penggantian atau servis.`;
}

/* ---------- isian formulir <-> item tersimpan ---------- */

export interface FormPenyusutan {
  aktif: boolean;
  presetId: string;
  nama: string;
  jenisBarang: JenisBarang;
  basis: BasisUmur;
  umurTotal: string;
  satuanWaktu: SatuanWaktu;
  satuanPemakaian: SatuanPemakaian;
  metode: MetodePenyusutan;
  nilaiResidu: string;
  /** Kosong = mengikuti tanggal transaksi. */
  tanggalMulai: string;
  pemakaianAwal: string;
  pemakaianSekarang: string;
}

export const FORM_PENYUSUTAN_AWAL: FormPenyusutan = {
  aktif: false,
  presetId: "",
  nama: "",
  jenisBarang: "habis-pakai",
  basis: "waktu",
  umurTotal: "",
  satuanWaktu: "bulan",
  satuanPemakaian: "km",
  metode: "garis-lurus",
  nilaiResidu: "0",
  tanggalMulai: "",
  pemakaianAwal: "",
  pemakaianSekarang: "",
};

/** Menerapkan preset: nama (bila masih kosong), jenis, basis, umur, satuan, dan metode terisi; nilai residu 0. */
export function terapkanPreset(form: FormPenyusutan, preset: PresetBarang): FormPenyusutan {
  return {
    ...form,
    presetId: preset.id,
    nama: form.nama.trim() && cariPreset(form.presetId)?.nama !== form.nama ? form.nama : preset.nama,
    jenisBarang: preset.jenis,
    basis: preset.basis,
    umurTotal: String(preset.umur),
    satuanWaktu: preset.satuanWaktu ?? form.satuanWaktu,
    satuanPemakaian: preset.satuanPemakaian ?? form.satuanPemakaian,
    metode: preset.metode,
    nilaiResidu: "0",
  };
}

export function formDariItem(item: ItemPenyusutan): FormPenyusutan {
  return {
    aktif: true,
    presetId: item.presetId ?? "",
    nama: item.nama,
    jenisBarang: item.jenisBarang,
    basis: item.basis,
    umurTotal: String(item.umurTotal),
    satuanWaktu: item.satuanWaktu ?? "bulan",
    satuanPemakaian: item.satuanPemakaian ?? "km",
    metode: item.metode,
    nilaiResidu: String(item.nilaiResidu ?? 0),
    tanggalMulai: item.tanggalMulai,
    pemakaianAwal: item.pemakaianAwal === undefined ? "" : String(item.pemakaianAwal),
    pemakaianSekarang: item.pemakaianSekarang === undefined ? "" : String(item.pemakaianSekarang),
  };
}

export interface KonteksItem {
  id: string;
  transaksiId?: string;
  harga: number;
  tanggalTransaksi: string;
  namaCadangan: string;
  /** Item lama bila transaksi diubah (mempertahankan dibuat dan perbaruan pemakaian). */
  lama?: ItemPenyusutan;
}

/** Galat isian bila penyusutan diaktifkan tetapi datanya belum sah; null bila boleh disimpan. */
export function galatForm(form: FormPenyusutan, harga: number): string | null {
  if (!form.aktif) return null;
  if (!(Number(form.umurTotal) > 0)) return "Penyusutan: isi umur pakai barang lebih dari 0 (atau pilih preset).";
  if (!(harga > 0)) return "Penyusutan: isi jumlah pembelian lebih dari 0.";
  const residu = Number(form.nilaiResidu) || 0;
  if (residu < 0 || residu > harga) return "Penyusutan: nilai residu tidak boleh negatif atau melebihi harga beli.";
  return null;
}

export function itemDariForm(form: FormPenyusutan, k: KonteksItem, sekarangIso: string = new Date().toISOString()): ItemPenyusutan | null {
  if (galatForm(form, k.harga)) return null;
  const awal = form.pemakaianAwal.trim() === "" ? undefined : Number(form.pemakaianAwal) || 0;
  const kini = form.pemakaianSekarang.trim() === "" ? awal : Number(form.pemakaianSekarang) || 0;
  const pakaiPemakaian = form.basis === "pemakaian";
  return {
    id: k.id,
    transaksiId: k.transaksiId,
    nama: form.nama.trim() || k.namaCadangan.trim() || "Barang",
    jenisBarang: form.jenisBarang,
    presetId: form.presetId || undefined,
    basis: form.basis,
    // Saldo menurun ganda hanya untuk aset; barang habis pakai selalu garis lurus.
    metode: form.jenisBarang === "aset" ? form.metode : "garis-lurus",
    harga: k.harga,
    nilaiResidu: Number(form.nilaiResidu) || 0,
    umurTotal: Number(form.umurTotal),
    satuanWaktu: pakaiPemakaian ? undefined : form.satuanWaktu,
    satuanPemakaian: pakaiPemakaian ? form.satuanPemakaian : undefined,
    tanggalMulai: form.tanggalMulai || k.tanggalTransaksi,
    pemakaianAwal: pakaiPemakaian ? awal ?? 0 : undefined,
    pemakaianSekarang: pakaiPemakaian ? kini ?? 0 : undefined,
    pemakaianDiperbarui: pakaiPemakaian ? k.lama?.pemakaianDiperbarui ?? undefined : undefined,
    dibuat: k.lama?.dibuat ?? sekarangIso,
    diubah: sekarangIso,
  };
}

/** Barang diganti atau diservis: siklus baru dimulai hari ini dari angka pemakaian saat ini. */
export function mulaiSiklusBaru(item: ItemPenyusutan, hariIni: string, sekarangIso: string = new Date().toISOString()): ItemPenyusutan {
  const kini = item.basis === "pemakaian" ? item.pemakaianSekarang ?? item.pemakaianAwal ?? 0 : undefined;
  return {
    ...item,
    tanggalMulai: hariIni,
    pemakaianAwal: kini,
    pemakaianSekarang: kini,
    pemakaianDiperbarui: kini === undefined ? undefined : hariIni,
    diubah: sekarangIso,
  };
}

/** Memperbarui angka kilometer/jam saat ini (tidak boleh kurang dari angka saat ganti). */
export function perbaruiPemakaian(item: ItemPenyusutan, nilai: number, hariIni: string, sekarangIso: string = new Date().toISOString()): ItemPenyusutan {
  const awal = Number(item.pemakaianAwal) || 0;
  return { ...item, pemakaianSekarang: Math.max(awal, Number(nilai) || 0), pemakaianDiperbarui: hariIni, diubah: sekarangIso };
}
