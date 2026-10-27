import { DataKhususKegiatan, Transaksi } from "../types";
import { formatRupiah } from "./constants";
import { bacaJsonStorage, tulisStorage } from "./storage";

/**
 * Penerima manfaat: staf yang memakai fasilitas atau menikmati pengeluaran yang ditalangi satu orang dan diajukan dalam
 * satu klaim ("numpang klaim"), mis. satu kamar penginapan atau satu sewa speedboat untuk beberapa staf.
 *
 * Kudapan (snack) perjalanan adalah subkategori Konsumsi dengan plafon per orang sepertiga uang harian wilayah Kalimantan.
 */

/** Uang harian per hari untuk wilayah Kalimantan, dasar plafon kudapan perjalanan. */
export const UANG_HARIAN_KALIMANTAN = 200000;

/** Plafon kudapan perjalanan per orang: Rp200.000 / 3 = Rp66.667. */
export const PLAFON_KUDAPAN_PER_ORANG = Math.round(UANG_HARIAN_KALIMANTAN / 3);

/** Plafon kudapan untuk sejumlah orang, dibulatkan sekali di akhir (3 orang = Rp200.000, bukan 3 × 66.667 = 200.001). */
export function plafonKudapan(jumlahOrang: number): number {
  return jumlahOrang > 0 ? Math.round((UANG_HARIAN_KALIMANTAN / 3) * jumlahOrang) : 0;
}

/**
 * Kategori Dana Kegiatan yang tidak memakai penerima manfaat: uang harian melekat pada pelapor sendiri,
 * dan honorarium sudah punya nama penerimanya sendiri.
 */
const KATEGORI_TANPA_PENERIMA = new Set(["Perdiem", "Honorarium & Ganti Hari"]);

export function kategoriBolehPenerima(kategori: string): boolean {
  return Boolean(kategori) && !KATEGORI_TANPA_PENERIMA.has(kategori);
}

export function rapikanNama(nama: string): string {
  return nama.replace(/\s+/g, " ").trim();
}

const kunciNama = (nama: string) => rapikanNama(nama).toLowerCase();

/** Menambah satu atau beberapa nama (dipisah koma, titik koma, atau baris baru) tanpa duplikat, urutan tetap. */
export function tambahPenerima(daftar: string[], masukan: string): string[] {
  const hasil = [...daftar];
  const ada = new Set(hasil.map(kunciNama));
  for (const potong of masukan.split(/[,;\n]+/)) {
    const nama = rapikanNama(potong);
    if (!nama || ada.has(kunciNama(nama))) continue;
    ada.add(kunciNama(nama));
    hasil.push(nama);
  }
  return hasil;
}

export function hapusPenerima(daftar: string[], nama: string): string[] {
  return daftar.filter((n) => kunciNama(n) !== kunciNama(nama));
}

/* ---------- daftar staf yang pernah dicatat (saran pengisian) ---------- */

const KUNCI_DAFTAR_STAF = "keuangan-daftar-staf";
const BATAS_DAFTAR_STAF = 40;

export function muatDaftarStaf(): string[] {
  const data = bacaJsonStorage<unknown>(KUNCI_DAFTAR_STAF, []);
  return Array.isArray(data) ? data.filter((n): n is string => typeof n === "string" && rapikanNama(n) !== "") : [];
}

/** Menaruh nama yang baru dipakai di depan daftar saran; nama tidak ikut Drive, hanya tersimpan di perangkat ini. */
export function ingatStaf(nama: string[]): void {
  if (nama.length === 0) return;
  let daftar = muatDaftarStaf();
  for (const n of [...nama].reverse()) {
    daftar = [rapikanNama(n), ...daftar.filter((x) => kunciNama(x) !== kunciNama(n))];
  }
  tulisStorage(KUNCI_DAFTAR_STAF, JSON.stringify(daftar.slice(0, BATAS_DAFTAR_STAF)));
}

/* ---------- teks untuk laporan ---------- */

export function adalahKudapanPerjalanan(kategori: string, detail?: DataKhususKegiatan): boolean {
  return kategori === "Konsumsi" && Boolean(detail?.konsumsi?.kudapanPerjalanan);
}

/** Rupiah tanpa spasi ("Rp66.667"), seperti penulisan nominal per orang pada uraian klaim. */
const rupiahRapat = (n: number) => formatRupiah(n).replace(/\s/g, "");

/**
 * Baris penerima manfaat untuk tabel laporan, atau null bila tidak ada yang perlu dicantumkan.
 *   Kudapan/Snack Perjalanan — Penerima Manfaat: 3 orang (Nama A, Nama B, Nama C @ Rp66.667)
 *   Transportasi Speedboat — Penerima Manfaat: Nopal, Budi, Andi (di kolom uraian; di sini hanya bagian nama)
 */
export function barisPenerimaManfaat(t: Pick<Transaksi, "kategori" | "jumlah" | "detailKegiatan">): string | null {
  const nama = (t.detailKegiatan?.penerimaManfaat ?? []).map(rapikanNama).filter(Boolean);
  if (adalahKudapanPerjalanan(t.kategori, t.detailKegiatan)) {
    if (nama.length === 0) return "Kudapan/Snack Perjalanan — Penerima Manfaat: belum dicatat";
    const perOrang = t.jumlah > 0 ? Math.round(t.jumlah / nama.length) : PLAFON_KUDAPAN_PER_ORANG;
    return `Kudapan/Snack Perjalanan — Penerima Manfaat: ${nama.length} orang (${nama.join(", ")} @ ${rupiahRapat(perOrang)})`;
  }
  if (nama.length === 0) return null;
  return `Penerima Manfaat: ${nama.join(", ")}`;
}
