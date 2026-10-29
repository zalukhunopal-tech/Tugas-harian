import { Transaksi } from "../types";
import { kegiatanDariKaitan } from "./kegiatanSama";

/**
 * Alur dana operasional kegiatan lapangan (cash advance / advance settlement):
 *
 *   1. Dana awal: kas atau uang muka operasional dari lembaga di awal kegiatan (pemasukan Dana Kegiatan).
 *   2. Selama di lapangan: pengguna memperoleh hak perdiem harian dan membiayai operasional kegiatan dari
 *      dana tersebut. Kebutuhan pribadi di luar operasional dan perdiem tidak ditanggung lembaga, jadi dicatat
 *      di Dana Pribadi dan tidak ikut dihitung di sini.
 *   3. Setelah kegiatan selesai: realisasi pengeluaran kegiatan + total perdiem dibandingkan dengan dana awal.
 *        dana awal > total diakui  -> sisa dana harus dikembalikan ke lembaga;
 *        total diakui > dana awal  -> uang pribadi terpakai, kelebihannya diganti lembaga (reimbursement).
 *
 * Perdiem dicatat sebagai pengeluaran Dana Kegiatan berkategori "Perdiem". "Pindah Dana" (perpindahan antar
 * dana milik sendiri) tidak memengaruhi hitungan karena lembaga hanya melihat dana awal dan biaya yang diakui.
 */

export const KATEGORI_PERDIEM = "Perdiem";
const KATEGORI_PINDAH_DANA = "Pindah Dana";

export type StatusPenyelesaian = "kembalikan" | "reimbursement" | "nihil";

export interface RingkasanPenyelesaian {
  /** Total dana yang diterima dari lembaga (pemasukan Dana Kegiatan, di luar Pindah Dana). */
  danaAwal: number;
  /** Realisasi pengeluaran kegiatan di luar perdiem. */
  realisasiOperasional: number;
  totalPerdiem: number;
  /** realisasiOperasional + totalPerdiem. */
  totalDiakui: number;
  /** danaAwal - totalDiakui: positif = sisa, negatif = kurang. */
  selisih: number;
  status: StatusPenyelesaian;
  /** Nilai mutlak selisih, untuk ditampilkan bersama label status. */
  jumlahStatus: number;
  /** Kalimat status siap tampil. */
  labelStatus: string;
  jumlahTransaksi: number;
}

export const LABEL_STATUS_PENYELESAIAN: Record<StatusPenyelesaian, string> = {
  kembalikan: "Sisa dana yang harus dikembalikan ke lembaga",
  reimbursement: "Kelebihan biaya yang harus diganti oleh lembaga (reimbursement)",
  nihil: "Dana awal sama dengan total pengeluaran yang diakui: tidak ada sisa maupun kelebihan",
};

/** Data kegiatan yang dibutuhkan untuk menentukan transaksi miliknya (DataKegiatan memenuhi bentuk ini). */
export interface RentangKegiatan {
  id: string;
  nama: string;
  tanggalMulai: string; // YYYY-MM-DD
  tanggalSelesai: string; // YYYY-MM-DD
}

const namaKecil = (s: string | undefined) => (s || "").trim().toLowerCase();

/**
 * Terhubung ke kegiatan lewat id, atau lewat judul kegiatan yang diisi di kolom kaitan. Judul dicocokkan longgar (lihat
 * kegiatanSama.ts: tanpa "(Batch N)", beda spasi atau huruf besar, judul terpotong); bila beberapa kegiatan cocok, yang dipilih
 * satu kegiatan saja menurut tanggal transaksi supaya transaksi tidak terhitung di dua kegiatan.
 */
function terhubungKe(t: Transaksi, k: RentangKegiatan, semuaKegiatan: RentangKegiatan[]): boolean {
  if (t.kegiatanId === k.id) return true;
  if (!namaKecil(t.kaitan)) return false;
  const daftar = semuaKegiatan.some((x) => x.id === k.id) ? semuaKegiatan : [...semuaKegiatan, k];
  return kegiatanDariKaitan(daftar, t.kaitan, t.tanggal)?.id === k.id;
}

const dalamRentang = (tanggal: string, k: RentangKegiatan) => tanggal >= k.tanggalMulai && tanggal <= k.tanggalSelesai;

/**
 * Penerimaan dana lembaga umumnya masuk SEBELUM hari pertama timesheet. Penerimaan bertanggal sebelum `kegiatan.tanggalMulai`
 * (yang belum dikaitkan ke kegiatan mana pun) menjadi dana awal kegiatan ini bila kegiatan ini yang paling dulu dimulai sesudah
 * tanggal itu; artinya tanggalnya jatuh setelah kegiatan sebelumnya selesai dan sebelum kegiatan ini selesai. Penerimaan yang
 * tanggalnya sudah berada di dalam rentang kegiatan lain menjadi milik kegiatan lain itu, bukan dana pra-kegiatan.
 */
function praKegiatanMilik(tanggal: string, kegiatan: RentangKegiatan, semuaKegiatan: RentangKegiatan[]): boolean {
  if (tanggal >= kegiatan.tanggalMulai) return false;
  if (semuaKegiatan.some((k) => dalamRentang(tanggal, k))) return false;
  const berikutnya = semuaKegiatan.filter((k) => k.tanggalMulai > tanggal);
  const terdekat = berikutnya.reduce((min, k) => (k.tanggalMulai < min ? k.tanggalMulai : min), kegiatan.tanggalMulai);
  return terdekat === kegiatan.tanggalMulai;
}

/**
 * Transaksi Dana Kegiatan milik satu kegiatan: semua yang terhubung ke kegiatan itu (tanpa batas tanggal), ditambah
 * dua jenis yang belum dikaitkan ke kegiatan mana pun supaya terisi otomatis walau dicatat tanpa memilih kegiatan
 * (kolom kegiatan tidak ikut tersimpan di Google Sheets):
 *   - penerimaan dana (dana awal): dalam rentang kegiatan, atau pra-kegiatan (lihat praKegiatanMilik);
 *   - perdiem, selama tanggalnya hanya jatuh di rentang satu kegiatan (bila dua kegiatan beririsan, tidak ditebak).
 */
export function transaksiKegiatan(
  transaksi: Transaksi[],
  kegiatan: RentangKegiatan,
  semuaKegiatan: RentangKegiatan[] = [kegiatan]
): Transaksi[] {
  return transaksi.filter((t) => {
    if (t.dana !== "Dana Kegiatan") return false;
    if (terhubungKe(t, kegiatan, semuaKegiatan)) return true;
    if (semuaKegiatan.some((k) => terhubungKe(t, k, semuaKegiatan))) return false;
    if (t.jenis === "pemasukan" && t.kategori !== KATEGORI_PINDAH_DANA) {
      return dalamRentang(t.tanggal, kegiatan) || praKegiatanMilik(t.tanggal, kegiatan, semuaKegiatan);
    }
    if (!dalamRentang(t.tanggal, kegiatan)) return false;
    if (t.jenis === "pengeluaran" && t.kategori === KATEGORI_PERDIEM && !t.kegiatanId) {
      return semuaKegiatan.filter((k) => dalamRentang(t.tanggal, k)).length <= 1;
    }
    return false;
  });
}

/** Kegiatan yang rentang tanggalnya beririsan dengan periode laporan. */
export function kegiatanBerjalanDalam<K extends RentangKegiatan>(daftar: K[], mulai: string, selesai: string): K[] {
  return daftar.filter((k) => k.tanggalMulai <= selesai && k.tanggalSelesai >= mulai);
}

/**
 * Transaksi untuk penyelesaian dana pada laporan: transaksi pada periode laporan digabung dengan seluruh transaksi
 * kegiatan yang tercakup (lihat transaksiKegiatan), tanpa duplikat.
 */
export function susunTransaksiPenyelesaian(
  semua: Transaksi[],
  periode: Transaksi[],
  kegiatanTercakup: RentangKegiatan[],
  semuaKegiatan: RentangKegiatan[]
): Transaksi[] {
  const hasil = new Map<string, Transaksi>();
  for (const t of periode) hasil.set(t.id, t);
  for (const k of kegiatanTercakup) {
    for (const t of transaksiKegiatan(semua, k, semuaKegiatan)) hasil.set(t.id, t);
  }
  return [...hasil.values()];
}

/** Hanya transaksi Dana Kegiatan yang dihitung; sisanya diabaikan. */
export function hitungPenyelesaian(daftar: Transaksi[]): RingkasanPenyelesaian {
  let danaAwal = 0;
  let realisasiOperasional = 0;
  let totalPerdiem = 0;
  let jumlahTransaksi = 0;

  for (const t of daftar) {
    if (t.dana !== "Dana Kegiatan" || t.kategori === KATEGORI_PINDAH_DANA) continue;
    jumlahTransaksi++;
    if (t.jenis === "pemasukan") {
      danaAwal += t.jumlah;
    } else if (t.kategori === KATEGORI_PERDIEM) {
      totalPerdiem += t.jumlah;
    } else {
      realisasiOperasional += t.jumlah;
    }
  }

  const totalDiakui = realisasiOperasional + totalPerdiem;
  const selisih = danaAwal - totalDiakui;
  const status: StatusPenyelesaian = selisih > 0 ? "kembalikan" : selisih < 0 ? "reimbursement" : "nihil";

  return {
    danaAwal,
    realisasiOperasional,
    totalPerdiem,
    totalDiakui,
    selisih,
    status,
    jumlahStatus: Math.abs(selisih),
    labelStatus: LABEL_STATUS_PENYELESAIAN[status],
    jumlahTransaksi,
  };
}
