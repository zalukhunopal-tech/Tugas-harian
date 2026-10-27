import { Transaksi } from "../types";
import { PresetBarang, cariPresetDariTeks, cariPreset, normalkanTeks } from "./basisDataUmur";

/**
 * Mengenali pembelian barang yang bukan sekali pakai (tahan lama atau punya umur pakai pasti) supaya aplikasi menawarkan
 * "Hitung depresiasi?" setelah pengeluaran disimpan. Hanya yang disetujui pengguna masuk daftar Depresiasi Aset.
 */

/** Pengeluaran kategori ini tidak pernah ditawari: habis dipakai atau bukan pembelian barang. */
const KATEGORI_SEKALI_PAKAI = new Set([
  "Perdiem",
  "Honorarium & Ganti Hari",
  "Tabungan",
  "Tagihan & Sewa",
  "Rental Kendaraan",
  "Akomodasi",
  "Konsumsi",
  "Makan & Minum",
  "Hiburan",
  "Keluarga",
]);

/** Kata yang menandakan jasa atau barang sekali pakai; barang tahan lama dengan kata ini tidak ditawari. */
const KATA_SEKALI_PAKAI = ["pulsa", "kuota", "paket data", "token listrik", "tagihan", "sewa", "rental", "tiket", "bensin", "pertalite", "pertamax", "solar", "parkir", "tol", "kudapan", "snack", "makan", "minum", "kopi", "ojek", "bayar"];

/** Kata jasa yang menggugurkan penawaran untuk aset (servis AC bukan membeli AC); barang habis pakai seperti oli tetap boleh. */
const KATA_JASA = ["servis", "service", "perbaikan", "reparasi", "cuci", "isi ulang", "top up", "topup"];

/** Pembelian di bawah angka ini tidak ditawari (terlalu kecil untuk dipantau). */
export const BATAS_MINIMAL_HABIS_PAKAI = 25000;
export const BATAS_MINIMAL_ASET = 300000;
/** Pengadaan barang tanpa kata kunci dikenali ditawari mulai angka ini. */
export const BATAS_PENGADAAN_UMUM = 500000;

export interface HasilTawaran {
  tawar: boolean;
  preset?: PresetBarang;
  /** Alasan singkat yang ditampilkan di dialog. */
  alasan: string;
}

const TIDAK: HasilTawaran = { tawar: false, alasan: "" };

function memuatKata(teksNormal: string, kata: string[]): boolean {
  return kata.some((k) => teksNormal.includes(` ${normalkanTeks(k).trim()} `));
}

/** Menilai satu pengeluaran: perlu ditawari depresiasi atau tidak. */
export function nilaiTawaranDepresiasi(t: Pick<Transaksi, "jenis" | "deskripsi" | "kategori" | "jumlah">): HasilTawaran {
  if (t.jenis !== "pengeluaran") return TIDAK;
  if (KATEGORI_SEKALI_PAKAI.has(t.kategori)) return TIDAK;
  const jumlah = Number(t.jumlah) || 0;
  const teks = normalkanTeks(`${t.deskripsi ?? ""} ${t.kategori ?? ""}`);
  if (memuatKata(teks, KATA_SEKALI_PAKAI)) return TIDAK;

  const cocok = cariPresetDariTeks(t.deskripsi ?? "");
  if (cocok) {
    const preset = cocok.preset;
    if (preset.jenis === "aset" && memuatKata(teks, KATA_JASA)) return TIDAK;
    const batas = preset.jenis === "aset" ? BATAS_MINIMAL_ASET : BATAS_MINIMAL_HABIS_PAKAI;
    if (jumlah < batas) return TIDAK;
    return {
      tawar: true,
      preset,
      alasan: preset.jenis === "aset" ? `${preset.nama} termasuk barang tahan lama.` : `${preset.nama} punya umur pakai tetap (${preset.catatan.toLowerCase()}).`,
    };
  }

  if (t.kategori === "Pengadaan Barang & Perlengkapan" && jumlah >= BATAS_PENGADAAN_UMUM && !memuatKata(teks, KATA_JASA)) {
    return { tawar: true, preset: cariPreset("peralatan-kerja"), alasan: "Pengadaan barang bernilai besar biasanya dipakai berulang kali." };
  }
  return TIDAK;
}
