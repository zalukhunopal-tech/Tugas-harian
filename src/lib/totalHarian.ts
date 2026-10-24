import { Transaksi } from "../types";
import { adalahPerdiemKegiatan } from "./perdiemOtomatis";

export interface TotalHarian {
  masuk: number;
  keluar: number;
  /** masuk - keluar: positif = pemasukan lebih besar, negatif = pengeluaran lebih besar. */
  bersih: number;
}

/**
 * Total satu hari di kepala hari Riwayat.
 * - "Pindah Dana" tidak dihitung: hanya perpindahan antar dana milik sendiri.
 * - Pengeluaran perdiem Dana Kegiatan tidak dihitung sebagai pengeluaran: ia berpasangan dengan pemasukan perdiem
 *   di Dana Pribadi, jadi bila dihitung keduanya saling meniadakan dan angkanya ambigu. Hanya berlaku di sini;
 *   saldo, ringkasan bulan, grafik, laporan, dan penyelesaian dana tetap menghitung perdiem sebagai pengeluaran.
 */
export function hitungTotalHarian(item: Transaksi[]): TotalHarian {
  let masuk = 0;
  let keluar = 0;
  for (const t of item) {
    if (t.kategori === "Pindah Dana") continue;
    if (t.jenis === "pemasukan") masuk += t.jumlah;
    else if (!adalahPerdiemKegiatan(t)) keluar += t.jumlah;
  }
  return { masuk, keluar, bersih: masuk - keluar };
}
