import { Transaksi } from "../types";
import { KATEGORI_PERDIEM } from "./penyelesaianDana";

/**
 * Perdiem adalah hak uang harian pengguna yang diambil dari dana kegiatan. Karena itu satu perdiem tercatat
 * di dua dana sekaligus:
 *   - Dana Kegiatan: pengeluaran berkategori "Perdiem" (diakui pada penyelesaian akhir dana kegiatan);
 *   - Dana Pribadi : pemasukan berkategori "Perdiem" dengan jumlah, tanggal, dan uraian yang sama.
 *
 * Kedua transaksi dihubungkan lewat id, bukan kolom khusus: id pemasukan pribadi = id transaksi kegiatan +
 * "~pribadi". Id ikut tersimpan di kolom ID spreadsheet, jadi hubungan ini tetap ada setelah sinkron ke Drive
 * (kolom tambahan di data transaksi tidak ikut tersimpan di sana). Transaksi kegiatan adalah sumber
 * kebenarannya: mengubah atau menghapus salah satunya mengubah atau menghapus keduanya.
 *
 * Id yang pernah dihapus tidak boleh dipakai lagi (daftar id terhapus ikut tersinkron dan menjatuhkan transaksi
 * ber-id itu). Jadi bila pemasukan pribadi dibuat ulang setelah pernah dilepas, id-nya "~pribadi2", "~pribadi3", dst.
 */

export const SUFIKS_PEMASUKAN_PRIBADI = "~pribadi";
const POLA_SUFIKS = /~pribadi\d*$/;
const POLA_SUFIKS_PENUH = /^~pribadi\d*$/;
/** Batas hari untuk mengisi perdiem sekaligus, agar salah ketik tahun tidak membuat ribuan transaksi. */
export const BATAS_HARI_RENTANG = 366;

/** Id untuk pemasukan pribadi baru milik transaksi kegiatan ini, melewati id yang pernah dihapus. */
export function idPemasukanPribadi(idKegiatan: string, terhapus?: Set<string>): string {
  let id = idKegiatan + SUFIKS_PEMASUKAN_PRIBADI;
  for (let n = 2; terhapus?.has(id); n++) id = idKegiatan + SUFIKS_PEMASUKAN_PRIBADI + n;
  return id;
}

export function adalahPerdiemKegiatan(t: Pick<Transaksi, "dana" | "jenis" | "kategori">): boolean {
  return t.dana === "Dana Kegiatan" && t.jenis === "pengeluaran" && t.kategori === KATEGORI_PERDIEM;
}

export function adalahPemasukanPerdiemOtomatis(t: Pick<Transaksi, "id" | "dana" | "jenis">): boolean {
  return t.dana === "Dana Pribadi" && t.jenis === "pemasukan" && POLA_SUFIKS.test(t.id);
}

/** Pasangan perdiem dari sebuah transaksi (kegiatan -> pemasukan pribadi atau sebaliknya), bila ada di daftar. */
export function cariPasanganPerdiem(t: Transaksi, daftar: Transaksi[]): Transaksi | undefined {
  if (adalahPemasukanPerdiemOtomatis(t)) {
    const idKegiatan = t.id.replace(POLA_SUFIKS, "");
    return daftar.find((x) => x.id === idKegiatan && adalahPerdiemKegiatan(x));
  }
  if (adalahPerdiemKegiatan(t)) {
    return daftar.find(
      (x) => adalahPemasukanPerdiemOtomatis(x) && x.id.startsWith(t.id) && POLA_SUFIKS_PENUH.test(x.id.slice(t.id.length))
    );
  }
  return undefined;
}

/** Pemasukan Dana Pribadi yang mencerminkan sebuah transaksi perdiem Dana Kegiatan. */
export function buatPemasukanPribadiDariPerdiem(kegiatan: Transaksi, idPasangan?: string): Transaksi {
  const catatan = kegiatan.catatan?.trim();
  return {
    id: idPasangan ?? idPemasukanPribadi(kegiatan.id),
    jenis: "pemasukan",
    dana: "Dana Pribadi",
    tanggal: kegiatan.tanggal,
    deskripsi: kegiatan.deskripsi,
    kategori: KATEGORI_PERDIEM,
    jumlah: kegiatan.jumlah,
    metode: kegiatan.metode,
    kaitan: kegiatan.kaitan,
    catatan: `Otomatis dari uang harian Dana Kegiatan${catatan ? `. ${catatan}` : ""}`,
    diubah: kegiatan.diubah,
    bukti: [],
  };
}

/* ---------- pengisian sekaligus (rentang tanggal) ---------- */

export interface PerdiemRentang {
  aktif: boolean;
  mulai: string; // YYYY-MM-DD
  selesai: string; // YYYY-MM-DD, termasuk
  /** true: satu transaksi per hari; false: satu transaksi gabungan untuk seluruh hari. */
  satuPerHari: boolean;
  /** Tanggal di dalam rentang yang tidak dihitung (mis. hari tanpa perdiem). */
  kecuali: string[];
}

export const PERDIEM_RENTANG_AWAL: PerdiemRentang = {
  aktif: false,
  mulai: "",
  selesai: "",
  satuPerHari: true,
  kecuali: [],
};

const MS_PER_HARI = 86_400_000;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function keMsUtc(iso: string): number | null {
  if (!POLA_TANGGAL.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  // Tolak tanggal yang tidak ada (30 Feb) yang diam-diam digeser Date.UTC.
  return new Date(ms).toISOString().slice(0, 10) === iso ? ms : null;
}

/** Semua tanggal dari `mulai` sampai `selesai` (termasuk), memakai UTC supaya perpindahan jam musim tidak berpengaruh. */
export function daftarTanggalRentang(mulai: string, selesai: string): { tanggal: string[]; galat?: string } {
  const a = keMsUtc(mulai);
  const b = keMsUtc(selesai);
  if (a === null || b === null) return { tanggal: [], galat: "Isi tanggal mulai dan tanggal selesai." };
  if (b < a) return { tanggal: [], galat: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  const jumlah = Math.round((b - a) / MS_PER_HARI) + 1;
  if (jumlah > BATAS_HARI_RENTANG) {
    return { tanggal: [], galat: `Rentang terlalu panjang (${jumlah} hari). Maksimal ${BATAS_HARI_RENTANG} hari.` };
  }
  const hasil: string[] = [];
  for (let i = 0; i < jumlah; i++) hasil.push(new Date(a + i * MS_PER_HARI).toISOString().slice(0, 10));
  return { tanggal: hasil };
}

export interface HitunganRentangPerdiem {
  /** Seluruh tanggal dalam rentang. */
  semua: string[];
  /** Tanggal yang dihitung (rentang dikurangi pengecualian). */
  dipakai: string[];
  hari: number;
  total: number;
  galat?: string;
}

export function hitungRentangPerdiem(rentang: PerdiemRentang, tarifPerHari: number): HitunganRentangPerdiem {
  const { tanggal, galat } = daftarTanggalRentang(rentang.mulai, rentang.selesai);
  const kecuali = new Set(rentang.kecuali);
  const dipakai = tanggal.filter((t) => !kecuali.has(t));
  const tarif = Number.isFinite(tarifPerHari) && tarifPerHari > 0 ? tarifPerHari : 0;
  return { semua: tanggal, dipakai, hari: dipakai.length, total: Math.round(dipakai.length * tarif), galat };
}

/* ---------- label, deteksi tanggal ganda, dan penyusunan transaksi ---------- */

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-09-20" -> "20 Sep 2026". Tanpa Intl supaya hasilnya sama di semua perangkat. */
export function tanggalPendek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${BULAN_PENDEK[m - 1]} ${y}`;
}

const HARI_SINGKAT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Hari dalam sepekan untuk tanggal ISO ("2026-09-20" -> "Min"). Kosong bila tanggal tidak sah. */
export function hariSingkat(iso: string): string {
  const ms = keMsUtc(iso);
  return ms === null ? "" : HARI_SINGKAT[new Date(ms).getUTCDay()];
}

/** "20 Sep 2026 – 28 Okt 2026", ditambah jumlah hari yang dikecualikan bila ada. */
export function labelRentangPerdiem(mulai: string, selesai: string, jumlahDikecualikan = 0): string {
  const dasar = mulai === selesai ? tanggalPendek(mulai) : `${tanggalPendek(mulai)} – ${tanggalPendek(selesai)}`;
  return jumlahDikecualikan > 0 ? `${dasar}, tanpa ${jumlahDikecualikan} hari` : dasar;
}

/**
 * Tanggal di `tanggal` yang sudah punya transaksi perdiem Dana Kegiatan untuk kegiatan yang sama
 * (kegiatan kosong dianggap satu kelompok sendiri). Dipakai agar mengisi ulang rentang tidak menggandakan.
 */
export function tanggalSudahAdaPerdiem(
  daftar: Transaksi[],
  kegiatanId: string | undefined,
  tanggal: string[],
  kecualiId?: string
): Set<string> {
  const dicari = new Set(tanggal);
  const hasil = new Set<string>();
  for (const t of daftar) {
    if (!adalahPerdiemKegiatan(t) || t.id === kecualiId) continue;
    if ((t.kegiatanId || "") !== (kegiatanId || "")) continue;
    if (dicari.has(t.tanggal)) hasil.add(t.tanggal);
  }
  return hasil;
}

export interface UnsurTransaksiPerdiem {
  tanggal: string;
  /** Jumlah hari yang diwakili transaksi ini (1 untuk satu per hari). */
  hari: number;
  jumlah: number;
  /** 0 untuk transaksi pertama: tempat yang cocok untuk menaruh lampiran yang hanya boleh sekali. */
  urutan: number;
  /** Teks rentang yang diwakili transaksi gabungan; kosong untuk satu per hari. */
  labelRentang?: string;
}

export interface RencanaPerdiem {
  /** Transaksi Dana Kegiatan, urut tanggal. */
  kegiatan: Transaksi[];
  /** Semua yang harus disimpan: setiap transaksi Dana Kegiatan disusul pasangannya di Dana Pribadi bila diminta. */
  semua: Transaksi[];
  /** Tanggal yang dilewati karena sudah ada perdiem (hanya mode satu per hari). */
  dilewati: string[];
  hari: number;
  total: number;
  galat?: string;
}

/**
 * Menyusun transaksi untuk pengisian perdiem sekaligus. `buat` membuat satu transaksi Dana Kegiatan dari
 * field form (uraian, kegiatan, metode, dll.), sedangkan di sini hanya diputuskan berapa transaksi dan isinya.
 */
export function rencanakanPerdiemRentang(opsi: {
  rentang: PerdiemRentang;
  tarifPerHari: number;
  catatPribadi: boolean;
  sudahAda?: Set<string>;
  buat: (u: UnsurTransaksiPerdiem) => Transaksi;
}): RencanaPerdiem {
  const { rentang, tarifPerHari, catatPribadi, buat } = opsi;
  const hitung = hitungRentangPerdiem(rentang, tarifPerHari);
  const kosong: RencanaPerdiem = { kegiatan: [], semua: [], dilewati: [], hari: 0, total: 0, galat: hitung.galat };
  if (hitung.galat) return kosong;
  if (!(tarifPerHari > 0)) return { ...kosong, galat: "Isi tarif uang harian per hari." };

  const tarif = Math.round(tarifPerHari);
  const kecuali = rentang.kecuali.filter((t) => hitung.semua.includes(t)).length;
  let kegiatan: Transaksi[] = [];
  let dilewati: string[] = [];

  if (rentang.satuPerHari) {
    const lewat = opsi.sudahAda ?? new Set<string>();
    const dipakai = hitung.dipakai.filter((t) => !lewat.has(t));
    dilewati = hitung.dipakai.filter((t) => lewat.has(t));
    kegiatan = dipakai.map((tanggal, urutan) => buat({ tanggal, hari: 1, jumlah: tarif, urutan }));
  } else if (hitung.dipakai.length > 0) {
    kegiatan = [
      buat({
        tanggal: hitung.dipakai[0],
        hari: hitung.dipakai.length,
        jumlah: tarif * hitung.dipakai.length,
        urutan: 0,
        labelRentang: labelRentangPerdiem(rentang.mulai, rentang.selesai, kecuali),
      }),
    ];
  }

  if (kegiatan.length === 0) {
    return { ...kosong, dilewati, galat: "Tidak ada hari yang bisa dicatat: semua tanggal dikecualikan atau sudah punya uang harian." };
  }

  return {
    kegiatan,
    semua: catatPribadi ? kegiatan.flatMap((k) => [k, buatPemasukanPribadiDariPerdiem(k)]) : kegiatan,
    dilewati,
    hari: rentang.satuPerHari ? kegiatan.length : hitung.dipakai.length,
    total: kegiatan.reduce((n, k) => n + k.jumlah, 0),
  };
}

/**
 * Pesan konfirmasi hapus bila transaksi punya pasangan perdiem di daftar; null bila tidak ada, supaya pemanggil
 * memakai pesan bawaannya.
 */
export function pesanHapusPerdiem(t: Transaksi, daftar: Transaksi[]): string | null {
  const pasangan = cariPasanganPerdiem(t, daftar);
  if (!pasangan) return null;
  const dariKegiatan = adalahPerdiemKegiatan(t);
  return dariKegiatan
    ? `Uang harian "${t.deskripsi}" tercatat juga sebagai pemasukan di Dana Pribadi. Menghapusnya juga akan menghapus pemasukan pribadi itu. Lanjutkan?`
    : `Pemasukan "${t.deskripsi}" dibuat otomatis dari uang harian Dana Kegiatan. Menghapusnya juga akan menghapus uang harian di Dana Kegiatan. Lanjutkan?`;
}
