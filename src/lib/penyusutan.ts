import { BasisUmur, ItemPenyusutan, JenisBarang, MetodePenyusutan, SatuanPemakaian, SatuanWaktu } from "../types";
import { PresetBarang, cariPreset } from "./basisDataUmur";

export { PRESET_ASET, PRESET_HABIS_PAKAI, SEMUA_PRESET, cariPreset } from "./basisDataUmur";
export type { PresetBarang } from "./basisDataUmur";

/**
 * Depresiasi aset dan prediksi umur pakai barang (tab Saya > Depresiasi Aset). Data umur standar ada di basisDataUmur.ts.
 *
 * Variabel: C harga beli, S nilai residu, n total estimasi umur pakai, t umur yang sudah berjalan (dalam satuan yang sama dengan n).
 *   Garis lurus (straight-line):     D = (C - S) / n;   BV_t = C - D × t;   P_sisa = BV_t / C × 100%
 *     Dengan basis pemakaian (km atau jam) ini sama dengan metode unit produksi: beban per km = (C - S) / total km.
 *   Saldo menurun ganda (DDB):       R = 2 / n;         BV_t = C × (1 - R)^t, tidak kurang dari S
 *   Jumlah angka tahun (SYD):        A_t = (C - S) × t × (2n - t + 1) / (n × (n + 1));   BV_t = C - A_t
 *   Sisa umur pakai (RUL), waktu:    Sisa Hari = Total Umur (hari) - (hari ini - tanggal beli/ganti)
 *   Sisa umur pakai (RUL), jarak:    Sisa KM   = Batas Umur KM - (KM saat ini - KM saat ganti)
 *   Batas ganda (km ATAU bulan):     P_umur = yang terkecil dari sisa km dan sisa waktu (mana yang tercapai lebih dulu)
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
  "jumlah-angka-tahun": "Jumlah Angka Tahun",
};

/** Hari dalam satu bulan rata-rata, untuk batas waktu kedua (bulan) pada barang berbasis pemakaian. */
const HARI_PER_BULAN = 365.25 / 12;

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
  /** Basis pemakaian dengan batas waktu kedua: sisa hari menurut batas waktu itu. */
  sisaWaktuHari?: number;
  /** Basis pemakaian dengan batas waktu kedua: batas yang lebih dulu tercapai. */
  penentu?: "pemakaian" | "waktu";
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

/** Fraksi nilai buku terpakai menurut metode: akumulasi penyusutan pada umur berjalan t, dalam satuan n. */
function akumulasiPenyusutan(metode: MetodePenyusutan, C: number, S: number, n: number, t: number): number {
  if (metode === "saldo-menurun-ganda") {
    const R = 2 / n;
    const bv = R >= 1 ? (t > 0 ? S : C) : C * Math.pow(1 - R, t);
    return C - Math.max(S, bv);
  }
  if (metode === "jumlah-angka-tahun") {
    const tt = Math.min(t, n);
    return ((C - S) * tt * (2 * n - tt + 1)) / (n * (n + 1));
  }
  return Math.min(C - S, ((C - S) / n) * t);
}

/** Hitung penyusutan dan sisa umur; null bila data belum cukup (umur total atau harga belum diisi). */
export function hitungPenyusutan(item: ItemPenyusutan, hariIni: string): HasilPenyusutan | null {
  const C = Number(item.harga) || 0;
  const n = Number(item.umurTotal) || 0;
  if (!(n > 0) || !(C > 0)) return null;
  const S = batas(Number(item.nilaiResidu) || 0, 0, C);
  const tPakai = umurBerjalan(item, hariIni);

  // Batas waktu kedua (mis. oli 2.000 km atau 2 bulan): umur terpakai mengikuti batas yang lebih dulu tercapai.
  const bulanBatas = item.basis === "pemakaian" ? Number(item.batasWaktuBulan) || 0 : 0;
  const hariBerjalan = Math.max(0, selisihHari(item.tanggalMulai, hariIni));
  const totalHariBatas = bulanBatas * HARI_PER_BULAN;
  const fraksiWaktu = bulanBatas > 0 ? Math.min(1, hariBerjalan / totalHariBatas) : 0;
  const t = bulanBatas > 0 ? Math.max(tPakai, fraksiWaktu * n) : tPakai;

  let bebanPerSatuan: number;
  if (item.metode === "saldo-menurun-ganda") bebanPerSatuan = C * Math.min(2 / n, 1);
  else if (item.metode === "jumlah-angka-tahun") bebanPerSatuan = (2 * (C - S)) / (n + 1);
  else bebanPerSatuan = (C - S) / n;
  const nilaiBuku = Math.max(S, C - akumulasiPenyusutan(item.metode, C, S, n, t));
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
    hasil.sisaUmurHari = Math.max(0, Math.round(totalHari - hariBerjalan));
    hasil.tanggalHabis = tambahHari(item.tanggalMulai, totalHari);
  } else {
    hasil.sisaPemakaian = Math.max(0, n - tPakai);
    if (bulanBatas > 0) {
      hasil.sisaWaktuHari = Math.max(0, Math.round(totalHariBatas - hariBerjalan));
      hasil.tanggalHabis = tambahHari(item.tanggalMulai, totalHariBatas);
      hasil.penentu = tPakai / n >= fraksiWaktu ? "pemakaian" : "waktu";
    }
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
    const pemakaian = `${Math.round(h.sisaPemakaian ?? h.sisaUmur).toLocaleString("id-ID")} ${LABEL_SATUAN_PEMAKAIAN[item.satuanPemakaian ?? "km"]}`;
    return h.sisaWaktuHari === undefined ? pemakaian : `${pemakaian} atau ${teksHari(h.sisaWaktuHari)}`;
  }
  return teksHari(h.sisaUmurHari ?? 0);
}

/** "3 bulan 12 hari", "2 tahun 1 bulan", atau "0 hari". */
export function teksHari(hari: number): string {
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

export function teksUmurTotal(item: Pick<ItemPenyusutan, "basis" | "umurTotal" | "satuanWaktu" | "satuanPemakaian" | "batasWaktuBulan">): string {
  const angka = Number(item.umurTotal).toLocaleString("id-ID");
  if (item.basis !== "pemakaian") return `${angka} ${LABEL_SATUAN_WAKTU[item.satuanWaktu ?? "tahun"]}`;
  const pemakaian = `${angka} ${LABEL_SATUAN_PEMAKAIAN[item.satuanPemakaian ?? "km"]}`;
  return Number(item.batasWaktuBulan) > 0 ? `${pemakaian} atau ${Number(item.batasWaktuBulan)} bulan` : pemakaian;
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
  /** Batas waktu kedua (bulan) untuk basis pemakaian; kosong = hanya km atau jam. */
  batasWaktuBulan: string;
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
  batasWaktuBulan: "",
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
    batasWaktuBulan: preset.batasWaktuBulan ? String(preset.batasWaktuBulan) : "",
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
    batasWaktuBulan: item.batasWaktuBulan ? String(item.batasWaktuBulan) : "",
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
  if (form.basis === "pemakaian" && form.batasWaktuBulan.trim() !== "" && !(Number(form.batasWaktuBulan) > 0)) return "Penyusutan: batas waktu (bulan) harus lebih dari 0 atau dikosongkan.";
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
    // Saldo menurun ganda dan jumlah angka tahun hanya untuk aset; barang habis pakai selalu garis lurus.
    metode: form.jenisBarang === "aset" ? form.metode : "garis-lurus",
    harga: k.harga,
    nilaiResidu: Number(form.nilaiResidu) || 0,
    umurTotal: Number(form.umurTotal),
    satuanWaktu: pakaiPemakaian ? undefined : form.satuanWaktu,
    satuanPemakaian: pakaiPemakaian ? form.satuanPemakaian : undefined,
    batasWaktuBulan: pakaiPemakaian && Number(form.batasWaktuBulan) > 0 ? Number(form.batasWaktuBulan) : undefined,
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
