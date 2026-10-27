import { Transaksi, UkuranKotakTempel } from "../types";
import { formatRupiah } from "./constants";

/**
 * Lembar Tempel Bukti / Nota Asli (A4 potret, area cetak bersih 190 × 277 mm): kotak kosong tempat struk, kuitansi, atau tiket asli
 * ditempel. Tiga ukuran standar, dipilih otomatis menurut jenis bukti dan kategori, dan bisa diubah per pengeluaran.
 */

export interface UkuranKotak {
  kode: UkuranKotakTempel;
  nama: string;
  /** Contoh bukti yang cocok, untuk pilihan di formulir. */
  contoh: string;
  lebarMm: number;
  tinggiMm: number;
}

export const UKURAN_KOTAK: Record<UkuranKotakTempel, UkuranKotak> = {
  A: {
    kode: "A",
    nama: "Tipe A – Struk Ritel / Vertikal",
    contoh: "Struk Indomaret/Alfamart, EDC, tiket thermal, nota kontan kecil",
    lebarMm: 92,
    tinggiMm: 132,
  },
  B: {
    kode: "B",
    nama: "Tipe B – Kuitansi & Tiket Lebar",
    contoh: "Kuitansi sedang/kecil, tiket pesawat, tiket speedboat",
    lebarMm: 190,
    tinggiMm: 88,
  },
  C: {
    kode: "C",
    nama: "Tipe C – Kuitansi Besar / Faktur Setengah Halaman",
    contoh: "Kuitansi besar, faktur atau nota toko ukuran setengah halaman",
    lebarMm: 190,
    tinggiMm: 132,
  },
};

export const DAFTAR_UKURAN_KOTAK: UkuranKotak[] = [UKURAN_KOTAK.A, UKURAN_KOTAK.B, UKURAN_KOTAK.C];

/** Ukuran bawaan menurut kategori bila jenis bukti hanya "Kuitansi" (pilihan awal formulir, jadi tidak menunjukkan bentuk buktinya). */
const UKURAN_MENURUT_KATEGORI: Record<string, UkuranKotakTempel> = {
  Transportasi: "B",
  "Rental Kendaraan": "B",
  Akomodasi: "B",
  Konsumsi: "A",
  BBM: "A",
  "Pengadaan Barang & Perlengkapan": "C",
  "Komunikasi, Listrik & Kurir": "B",
  "Lain-lain": "A",
};

/** Kotak tempel yang dipakai untuk satu pengeluaran: pilihan manual bila ada, selain itu otomatis. */
export function pilihUkuranKotak(t: Pick<Transaksi, "kategori" | "detailKegiatan">): UkuranKotakTempel {
  const manual = t.detailKegiatan?.kotakTempel;
  if (manual && UKURAN_KOTAK[manual]) return manual;
  const jenis = t.detailKegiatan?.jenisBukti;
  if (jenis === "Struk thermal (minimarket/SPBU)" || jenis === "Nota" || jenis === "Bukti tidak lengkap") return "A";
  if (jenis === "Tiket" || jenis === "Tiket pesawat/e-ticket") return "B";
  if (jenis === "Invoice + kuitansi") return "C";
  // Moda ojek biasanya hanya memberi nota kecil.
  if (t.kategori === "Transportasi" && /ojek/i.test(t.detailKegiatan?.transportasi?.moda ?? "")) return "A";
  return UKURAN_MENURUT_KATEGORI[t.kategori] ?? "A";
}

/** Pengeluaran yang membutuhkan bukti fisik: bukan uang harian (tanpa kuitansi) dan bukan perpindahan antar dana. */
export function perluKotakTempel(t: Pick<Transaksi, "jenis" | "kategori">): boolean {
  return t.jenis === "pengeluaran" && t.kategori !== "Perdiem" && t.kategori !== "Pindah Dana";
}

export interface KotakTempel {
  id: string;
  nomor: string;
  ukuran: UkuranKotak;
  /** Satu baris ringkas untuk kepala kotak: No. | Tanggal | Kategori - Uraian | Penerima Manfaat | Rp. */
  kepala: string;
}

function tanggalSingkat(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Uraian singkat untuk kepala kotak; penerima manfaat dipisah karena tampil sebagai bagiannya sendiri. */
export function teksKepalaKotak(t: Transaksi, nomor: string): string {
  const penerima = (t.detailKegiatan?.penerimaManfaat ?? []).filter(Boolean);
  const bagian = [
    `No. ${nomor}`,
    tanggalSingkat(t.tanggal),
    `${t.kategori} - ${t.deskripsi}`,
  ];
  if (penerima.length > 0) bagian.push(`Penerima Manfaat: ${penerima.join(", ")}`);
  bagian.push(formatRupiah(t.jumlah));
  return bagian.join(" | ");
}

/** Kotak tempel dalam urutan yang sama dengan laporan (urutan susunan kuitansi fisik harus sama dengan urutan input). */
export function susunKotakTempel(urut: Transaksi[], nomorDari: (id: string) => string | undefined): KotakTempel[] {
  const hasil: KotakTempel[] = [];
  for (const t of urut) {
    if (!perluKotakTempel(t)) continue;
    const nomor = nomorDari(t.id) ?? "";
    hasil.push({ id: t.id, nomor, ukuran: UKURAN_KOTAK[pilihUkuranKotak(t)], kepala: teksKepalaKotak(t, nomor) });
  }
  return hasil;
}

/** Ringkasan jumlah kotak per ukuran, mis. "3 Tipe A, 2 Tipe B". */
export function ringkasKotak(kotak: KotakTempel[]): string {
  return DAFTAR_UKURAN_KOTAK.map((u) => ({ u, n: kotak.filter((k) => k.ukuran.kode === u.kode).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} Tipe ${x.u.kode}`)
    .join(", ");
}

/** Area cetak bersih A4 potret dengan margin 10 mm. */
export const AREA_TEMPEL = { lebarMm: 190, tinggiMm: 277, jarakBarisMm: 4 } as const;

/**
 * Perkiraan jumlah halaman lembar tempel: struk (Tipe A) berpasangan dua per baris, Tipe B dan C satu baris penuh; baris
 * ditumpuk dari atas ke bawah tanpa dipecah, persis seperti tata letak cetaknya (4 Tipe A, 3 Tipe B, atau 2 Tipe C per halaman).
 */
export function perkirakanHalamanTempel(kotak: Pick<KotakTempel, "ukuran">[]): number {
  const baris: number[] = [];
  let sisaKolom = 0;
  for (const k of kotak) {
    if (k.ukuran.kode === "A") {
      if (sisaKolom > 0) sisaKolom--;
      else {
        baris.push(k.ukuran.tinggiMm);
        sisaKolom = 1;
      }
    } else {
      sisaKolom = 0;
      baris.push(k.ukuran.tinggiMm);
    }
  }
  if (baris.length === 0) return 0;
  let halaman = 1;
  let terpakai = 0;
  for (const tinggi of baris) {
    const butuh = terpakai === 0 ? tinggi : terpakai + AREA_TEMPEL.jarakBarisMm + tinggi;
    if (butuh <= AREA_TEMPEL.tinggiMm) terpakai = butuh;
    else {
      halaman++;
      terpakai = tinggi;
    }
  }
  return halaman;
}
