import { BuktiItem, Transaksi, UkuranKotakTempel } from "../types";
import { formatRupiah, labelKategori } from "./constants";

/**
 * Lampiran Bukti (A4 potret, area cetak bersih 190 × 277 mm): untuk tiap pengeluaran, foto bukti digital dan kotak kosong tempat
 * struk, kuitansi, atau tiket asli ditempel berada di SATU lembar yang sama dan tidak terpisah antarhalaman.
 * Kotak tempel punya tiga ukuran standar, dipilih otomatis menurut jenis bukti dan kategori, dan bisa diubah per pengeluaran.
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

/**
 * Tiga bentuk lampiran untuk satu pengeluaran:
 *   ringkas  hanya kotak tempel (tanpa foto digital): Tipe A berpasangan dua per baris, Tipe B dan C satu baris penuh.
 *   terpadu  foto digital + kotak tempel dalam satu kartu selebar halaman: Tipe A berdampingan kiri-kanan (foto | tempel),
 *            Tipe B dan C atas-bawah (foto di atas, kotak tempel di bawah).
 *   foto     hanya foto digital (kotak tempel dimatikan, atau uang harian/penerimaan yang tidak ditempeli nota): satu lembar penuh.
 */
export type VarianLampiran = "ringkas" | "terpadu" | "foto";

export interface KotakTempel {
  id: string;
  nomor: string;
  ukuran: UkuranKotak;
  varian: VarianLampiran;
  /** Satu baris ringkas untuk kepala kotak: No. | Tanggal | Kategori - Uraian | Penerima Manfaat | Rp. */
  kepala: string;
  /** Foto bukti digital yang menyertai kotak (kosong pada varian ringkas). */
  bukti: BuktiItem[];
}

/** Tinggi area foto digital (mm) pada kartu terpadu; area tempel di kartu yang sama setinggi kotak dikurangi kepala 12 mm. */
export const TINGGI_FOTO_TERPADU: Record<UkuranKotakTempel, number> = { A: 120, B: 130, C: 110 };
export const TINGGI_KEPALA_KOTAK = 12;
export const TINGGI_LEMBAR_FOTO = 268;
const JARAK_ANTAR_PANEL = 2;

/** Tinggi satu baris lampiran dalam mm (Tipe A terpadu berdampingan, jadi tingginya sama dengan kotak biasa). */
export function tinggiBarisLampiran(k: Pick<KotakTempel, "ukuran" | "varian">): number {
  if (k.varian === "foto") return TINGGI_LEMBAR_FOTO;
  if (k.varian === "ringkas" || k.ukuran.kode === "A") return k.ukuran.tinggiMm;
  const areaTempel = k.ukuran.tinggiMm - TINGGI_KEPALA_KOTAK;
  return TINGGI_KEPALA_KOTAK + JARAK_ANTAR_PANEL + TINGGI_FOTO_TERPADU[k.ukuran.kode] + JARAK_ANTAR_PANEL + areaTempel;
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
    `${labelKategori(t.kategori)} - ${t.deskripsi}`,
  ];
  if (penerima.length > 0) bagian.push(`Penerima Manfaat: ${penerima.join(", ")}`);
  bagian.push(formatRupiah(t.jumlah));
  return bagian.join(" | ");
}

export interface OpsiLampiran {
  /** Sertakan kotak tempel untuk bukti fisik asli (pengeluaran Dana Kegiatan). */
  sertakanTempel: boolean;
}

/**
 * Lampiran bukti menurut urutan laporan (urutan susunan kuitansi fisik harus sama dengan urutan input): satu entri untuk tiap
 * transaksi yang punya foto bukti dan/atau perlu kotak tempel.
 */
export function susunKotakTempel(
  urut: Transaksi[],
  nomorDari: (id: string) => string | undefined,
  opsi: OpsiLampiran = { sertakanTempel: true }
): KotakTempel[] {
  const hasil: KotakTempel[] = [];
  for (const t of urut) {
    const bukti = t.bukti ?? [];
    const tempel = opsi.sertakanTempel && perluKotakTempel(t);
    if (bukti.length === 0 && !tempel) continue;
    const nomor = nomorDari(t.id) ?? "";
    hasil.push({
      id: t.id,
      nomor,
      ukuran: UKURAN_KOTAK[pilihUkuranKotak(t)],
      varian: !tempel ? "foto" : bukti.length > 0 ? "terpadu" : "ringkas",
      kepala: teksKepalaKotak(t, nomor),
      bukti,
    });
  }
  return hasil;
}

/** Ringkasan jumlah kotak per ukuran, mis. "3 Tipe A, 2 Tipe B"; lembar yang hanya berisi foto tidak dihitung. */
export function ringkasKotak(kotak: KotakTempel[]): string {
  return DAFTAR_UKURAN_KOTAK.map((u) => ({ u, n: kotak.filter((k) => k.varian !== "foto" && k.ukuran.kode === u.kode).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} Tipe ${x.u.kode}`)
    .join(", ");
}

/** Area cetak bersih A4 potret dengan margin 10 mm. */
export const AREA_TEMPEL = { lebarMm: 190, tinggiMm: 277, jarakBarisMm: 4 } as const;

/**
 * Perkiraan jumlah halaman lampiran bukti. Hanya kotak Tipe A varian ringkas yang berpasangan dua per baris; kartu terpadu,
 * Tipe B/C, dan lembar foto selalu satu baris penuh. Baris ditumpuk dari atas ke bawah tanpa dipecah, persis seperti tata
 * letak cetaknya (mis. 4 Tipe A ringkas, 3 Tipe B ringkas, 2 Tipe A terpadu, atau 1 Tipe B terpadu per halaman).
 */
export function perkirakanHalamanTempel(kotak: Pick<KotakTempel, "ukuran" | "varian">[]): number {
  const baris: number[] = [];
  let sisaKolom = 0;
  for (const k of kotak) {
    if (k.varian === "ringkas" && k.ukuran.kode === "A") {
      if (sisaKolom > 0) sisaKolom--;
      else {
        baris.push(tinggiBarisLampiran(k));
        sisaKolom = 1;
      }
    } else {
      sisaKolom = 0;
      baris.push(tinggiBarisLampiran(k));
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
