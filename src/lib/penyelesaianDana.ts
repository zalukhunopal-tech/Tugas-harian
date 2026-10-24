import { Transaksi } from "../types";

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

/** Terhubung ke kegiatan lewat id, atau lewat nama kegiatan yang diisi di kolom kaitan. */
function terhubungKe(t: Transaksi, k: RentangKegiatan): boolean {
  return t.kegiatanId === k.id || (Boolean(namaKecil(t.kaitan)) && namaKecil(t.kaitan) === namaKecil(k.nama));
}

/**
 * Transaksi Dana Kegiatan milik satu kegiatan: semua yang terhubung ke kegiatan itu (tanpa batas tanggal), ditambah
 * penerimaan dana (dana awal) yang belum dikaitkan ke kegiatan mana pun tetapi tanggalnya dalam rentang kegiatan,
 * supaya dana awal terisi otomatis walau pemasukannya dicatat tanpa memilih kegiatan.
 */
export function transaksiKegiatan(
  transaksi: Transaksi[],
  kegiatan: RentangKegiatan,
  semuaKegiatan: RentangKegiatan[] = [kegiatan]
): Transaksi[] {
  return transaksi.filter((t) => {
    if (t.dana !== "Dana Kegiatan") return false;
    if (terhubungKe(t, kegiatan)) return true;
    return (
      t.jenis === "pemasukan" &&
      t.kategori !== KATEGORI_PINDAH_DANA &&
      !semuaKegiatan.some((k) => terhubungKe(t, k)) &&
      t.tanggal >= kegiatan.tanggalMulai &&
      t.tanggal <= kegiatan.tanggalSelesai
    );
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
