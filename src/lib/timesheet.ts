import { BarisTimesheet, DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import { adalahPerdiemKegiatan } from "./perdiemOtomatis";

/**
 * Timesheet perdiem: satu file Google Sheets per batch kegiatan, berisi satu baris per hari (Tanggal, Keterangan
 * kegiatan di lapangan, Lokasi, Jumlah). File ini milik pengguna dan menjadi sumber kebenaran untuk Keterangan dan
 * Lokasi; aplikasi menariknya, menyimpan salinan di DataKegiatan.timesheetBaris, dan memakainya pada daftar perdiem
 * di dokumen siap cetak dan Word. Aplikasi tidak menulis ke file yang sudah ada, hanya ke file baru hasil salinan.
 *
 * Tata letak file (mengikuti file pengguna "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4"):
 *   B2/C2 "Detail Keuangan", C3 "Perdiem Kegiatan Lapangan"
 *   A5 "Proyek" | B5 ": <proyek>", A6 "Judul Kegiatan", A7 "Nama", A8 "Bulan"
 *   baris 10 judul kolom (No, Tanggal, Keterangan, Lokasi, Jumlah (Rp.)), data mulai baris 11
 *   setelah baris data: "Total", lalu dua baris kosong, "Dilaporkan Oleh :" / "Disetujui Oleh :", tiga baris kosong, nama.
 */

export type { BarisTimesheet };

export interface IsiTimesheet {
  proyek: string;
  judulKegiatan: string;
  nama: string;
  bulan: string;
  baris: BarisTimesheet[];
  total?: number;
  dilaporkanOleh: string;
  disetujuiOleh: string;
}

/** File timesheet memuat kata "timesheet" pada namanya; file keuangan tidak boleh mengira file ini sheet kegiatan. */
export function adalahFileTimesheet(nama: string): boolean {
  return /timesheet/i.test(nama);
}

export const BARIS_DATA_AWAL = 11;
/** Jumlah baris data yang sudah berformat (bergaris) di file pengguna: baris 11-44. */
export const KAPASITAS_BARIS_TEMPLATE = 34;

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/* ---------- tanggal ---------- */

function iso(tahun: number, bulan: number, hari: number): string | null {
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (d.getUTCFullYear() !== tahun || d.getUTCMonth() !== bulan - 1 || d.getUTCDate() !== hari) return null;
  return `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

/** "2026-09-20" -> "9/20/2026", gaya tanggal yang tampil di file timesheet. */
export function formatTanggalTimesheet(tanggal: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal);
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : tanggal;
}

/**
 * Baca tanggal yang tampil di sel timesheet. Tampilannya selalu bulan/hari/tahun ("9/20/2026"), termasuk sel yang
 * sebenarnya tanggal sungguhan berformat hari/bulan (tampil "10/1/2026" untuk 1 Oktober), jadi M/D/YYYY dipakai
 * lebih dulu. Angka pertama di atas 12 pasti hari. Bila rentang kegiatan diberikan dan hanya tafsiran sebaliknya
 * yang jatuh di dalamnya, tafsiran itu yang dipakai.
 */
export function uraikanTanggalTimesheet(teks: string, rentang?: { mulai: string; selesai: string }): string | null {
  // Awalan apostrof penanda teks di Google Sheets kadang ikut terbaca bila konektor menyimpannya apa adanya.
  const s = String(teks ?? "").trim().replace(/^'/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) ? s : null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const tahun = Number(m[3]);
  const bulanHari = a <= 12 ? iso(tahun, a, b) : null;
  const hariBulan = b <= 12 ? iso(tahun, b, a) : null;
  if (bulanHari && hariBulan && bulanHari !== hariBulan && rentang) {
    const dalam = (t: string) => t >= rentang.mulai && t <= rentang.selesai;
    if (!dalam(bulanHari) && dalam(hariBulan)) return hariBulan;
  }
  return bulanHari ?? hariBulan;
}

/** "Rp 200.000" / "200.000" / 200000 -> 200000. Tidak dikenali -> undefined. */
export function uraikanJumlahTimesheet(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? "").replace(/^(rp|idr)\.?\s*/i, "").replace(/\s/g, "");
  if (!s) return undefined;
  const bersih = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
  const n = Number(bersih);
  return Number.isFinite(n) ? n : undefined;
}

/* ---------- penamaan, batch, pencocokan ---------- */

/** "2026-09-20".."2026-10-23" -> "September - Oktober 2026"; satu bulan -> "Oktober 2026"; lintas tahun -> "Desember 2026 - Januari 2027". */
export function labelBulan(mulai: string, selesai: string): string {
  const [ty1, tm1] = [Number(mulai.slice(0, 4)), Number(mulai.slice(5, 7))];
  const [ty2, tm2] = [Number(selesai.slice(0, 4)), Number(selesai.slice(5, 7))];
  const b1 = NAMA_BULAN[tm1 - 1] ?? "";
  const b2 = NAMA_BULAN[tm2 - 1] ?? "";
  if (ty1 === ty2 && tm1 === tm2) return `${b1} ${ty1}`;
  if (ty1 === ty2) return `${b1} - ${b2} ${ty1}`;
  return `${b1} ${ty1} - ${b2} ${ty2}`;
}

/** Nama file baru, mengikuti file pengguna: "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4 (SEPTEMBER - OKTOBER 2026)". */
export function namaFileTimesheet(batch: number, mulai: string, selesai: string): string {
  return `FORM LAPORAN TIMESHEET KEGIATAN BATCH ${batch} (${labelBulan(mulai, selesai).toUpperCase()})`;
}

export function judulTabTimesheet(batch: number): string {
  return `Timesheet Batch ${batch}`;
}

export function batchDariNama(nama: string): number | undefined {
  const m = /batch\s*(\d+)/i.exec(nama);
  return m ? Number(m[1]) : undefined;
}

/** Tahun pertama yang disebut di nama file, yaitu tahun mulai kegiatan (nama lintas tahun: "DESEMBER 2026 - JANUARI 2027"). */
export function tahunDariNama(nama: string): number | undefined {
  const m = /\b(20\d\d)\b/.exec(nama);
  return m ? Number(m[1]) : undefined;
}

/** Judul kegiatan di file pengguna diakhiri "(Batch 4)"; angka itu juga dianggap batch kegiatan. */
export function batchDariJudul(judul: string): number | undefined {
  const m = /\(\s*batch\s*(\d+)\s*\)\s*$/i.exec(judul.trim());
  return m ? Number(m[1]) : undefined;
}

/** Judul kegiatan di timesheet: nama kegiatan, diberi "(Batch N)" di akhir bila belum ada. */
export function judulUntukTimesheet(nama: string, batch?: number): string {
  const n = nama.trim();
  if (!batch || batchDariJudul(n) !== undefined) return n;
  return `${n} (Batch ${batch})`;
}

export function tahunKegiatan(k: Pick<DataKegiatan, "tanggalMulai">): number {
  return Number(k.tanggalMulai.slice(0, 4));
}

/** Batch kegiatan: yang diisi pengguna, atau yang tertulis pada judul/nama file timesheet yang sudah dihubungkan. */
export function batchKegiatan(k: Pick<DataKegiatan, "batch" | "nama" | "timesheetNama">): number | undefined {
  if (k.batch && k.batch > 0) return k.batch;
  return batchDariJudul(k.nama) ?? (k.timesheetNama ? batchDariNama(k.timesheetNama) : undefined);
}

/**
 * Batch berikutnya untuk kegiatan baru yang dimulai pada tahun tertentu: terbesar pada tahun itu ditambah 1, dan 1
 * untuk tahun yang belum punya kegiatan (batch 5 tahun ini, batch 1 tahun depan). `indeksFile` melengkapi
 * kegiatan lama yang tidak mencatat batch dengan batch pada nama file timesheet di Drive.
 */
export function sarankanBatch(
  tahun: number,
  daftar: Array<Pick<DataKegiatan, "batch" | "nama" | "timesheetNama" | "tanggalMulai">>,
  indeksFile: Array<{ nama: string }> = []
): number {
  let terbesar = 0;
  for (const k of daftar) {
    if (tahunKegiatan(k) !== tahun) continue;
    const b = batchKegiatan(k);
    if (b && b > terbesar) terbesar = b;
  }
  for (const f of indeksFile) {
    if (tahunDariNama(f.nama) !== tahun) continue;
    const b = batchDariNama(f.nama);
    if (b && b > terbesar) terbesar = b;
  }
  return terbesar + 1;
}

export interface BerkasTimesheet {
  id: string;
  nama: string;
  modifiedTime?: string;
}

/**
 * Cari file timesheet milik sebuah kegiatan. Urutan: file yang sudah dihubungkan (ID) -> batch dan tahun pada nama
 * file -> bila kegiatan belum punya batch, satu-satunya file yang bulannya (di dalam kurung) beririsan dengan
 * rentang kegiatan. Tidak pernah menebak di antara beberapa kandidat.
 */
export function cocokkanFileTimesheet(
  k: Pick<DataKegiatan, "batch" | "nama" | "timesheetId" | "timesheetNama" | "tanggalMulai" | "tanggalSelesai">,
  berkas: BerkasTimesheet[]
): BerkasTimesheet | undefined {
  const files = berkas.filter((f) => adalahFileTimesheet(f.nama));
  if (k.timesheetId) {
    const ada = files.find((f) => f.id === k.timesheetId);
    if (ada) return ada;
  }
  const batch = batchKegiatan(k);
  const tahun = tahunKegiatan(k);
  if (batch) {
    const cocok = files.filter((f) => batchDariNama(f.nama) === batch && (tahunDariNama(f.nama) ?? tahun) === tahun);
    if (cocok.length >= 1) return urutkanTerbaru(cocok)[0];
    return undefined;
  }
  const beririsan = files.filter((f) => periodeNamaBeririsan(f.nama, k.tanggalMulai, k.tanggalSelesai));
  return beririsan.length === 1 ? beririsan[0] : undefined;
}

function urutkanTerbaru(files: BerkasTimesheet[]): BerkasTimesheet[] {
  return [...files].sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
}

/** Periode di dalam kurung nama file, mis. "(SEPTEMBER - OKTOBER 2026)" -> 2026-09-01 s.d. 2026-10-31. */
function periodeDariNama(nama: string): { dari: string; sampai: string } | null {
  const kurung = /\(([^)]*)\)\s*$/.exec(nama);
  if (!kurung) return null;
  const sisi = kurung[1].split(/\s+-\s+/).map((bagian) => {
    const teks = bagian.toLowerCase();
    const bulan = NAMA_BULAN.findIndex((b) => teks.includes(b.toLowerCase())) + 1;
    const tahun = /\b(20\d\d)\b/.exec(bagian);
    return { bulan, tahun: tahun ? Number(tahun[1]) : undefined };
  });
  const awal = sisi[0];
  const akhir = sisi[sisi.length - 1];
  const tahunAkhir = akhir.tahun ?? awal.tahun;
  const tahunAwal = awal.tahun ?? tahunAkhir;
  if (!awal.bulan || !akhir.bulan || !tahunAwal || !tahunAkhir) return null;
  const dua = (n: number) => String(n).padStart(2, "0");
  return { dari: `${tahunAwal}-${dua(awal.bulan)}-01`, sampai: `${tahunAkhir}-${dua(akhir.bulan)}-31` };
}

/** Periode pada nama file beririsan dengan rentang kegiatan? */
function periodeNamaBeririsan(nama: string, mulai: string, selesai: string): boolean {
  const periode = periodeDariNama(nama);
  return periode !== null && mulai <= periode.sampai && selesai >= periode.dari;
}

/* ---------- baca isi sheet ---------- */

function sel(baris: string[] | undefined, i: number): string {
  return String(baris?.[i] ?? "").trim();
}

function nilaiSetelahTitikDua(teks: string): string {
  return teks.replace(/^\s*:\s*/, "").trim();
}

/**
 * Uraikan sel-sel timesheet (nilai terformat dari baris pertama, kolom A dst.) menjadi isi bertipe. Tidak
 * bergantung pada nomor baris tetap: judul kolom dicari, baris data dibaca sampai baris "Total".
 */
export function uraikanIsiTimesheet(
  nilai: string[][],
  rentang?: { mulai: string; selesai: string }
): IsiTimesheet {
  const isi: IsiTimesheet = { proyek: "", judulKegiatan: "", nama: "", bulan: "", baris: [], dilaporkanOleh: "", disetujuiOleh: "" };
  let indeksJudul = -1;
  for (let i = 0; i < nilai.length; i++) {
    const baris = nilai[i] ?? [];
    const label = sel(baris, 0).toLowerCase();
    if (label === "proyek") isi.proyek = nilaiSetelahTitikDua(sel(baris, 1));
    else if (label === "judul kegiatan") isi.judulKegiatan = nilaiSetelahTitikDua(sel(baris, 1));
    else if (label === "nama") isi.nama = nilaiSetelahTitikDua(sel(baris, 1));
    else if (label === "bulan") isi.bulan = nilaiSetelahTitikDua(sel(baris, 1));
    else if (label === "no" && sel(baris, 1).toLowerCase() === "tanggal") {
      indeksJudul = i;
      break;
    }
  }
  if (indeksJudul < 0) return isi;

  let indeksTotal = nilai.length;
  for (let i = indeksJudul + 1; i < nilai.length; i++) {
    const baris = nilai[i] ?? [];
    if (sel(baris, 2).toLowerCase() === "total") {
      indeksTotal = i;
      isi.total = uraikanJumlahTimesheet(sel(baris, 4));
      break;
    }
    const tanggal = uraikanTanggalTimesheet(sel(baris, 1), rentang);
    if (!tanggal) continue;
    isi.baris.push({
      tanggal,
      keterangan: sel(baris, 2),
      lokasi: sel(baris, 3),
      jumlah: uraikanJumlahTimesheet(sel(baris, 4)),
    });
  }

  for (let i = indeksTotal + 1; i < nilai.length; i++) {
    const baris = nilai[i] ?? [];
    if (/dilaporkan oleh/i.test(sel(baris, 1))) {
      // Nama berada beberapa baris di bawahnya, di kolom yang sama (B untuk pelapor, D untuk penyetuju).
      for (let j = i + 1; j < nilai.length; j++) {
        const b = sel(nilai[j], 1);
        const d = sel(nilai[j], 3);
        if (!isi.dilaporkanOleh && b) isi.dilaporkanOleh = b;
        if (!isi.disetujuiOleh && d) isi.disetujuiOleh = d;
        if (isi.dilaporkanOleh || isi.disetujuiOleh) break;
      }
      break;
    }
  }
  return isi;
}

/** Salinan ringan untuk disimpan di DataKegiatan: hanya yang dipakai dokumen, tanpa baris kosong. */
export function barisUntukSimpan(baris: BarisTimesheet[]): BarisTimesheet[] {
  return baris
    .filter((b) => b.keterangan || b.lokasi)
    .map((b) => ({ tanggal: b.tanggal, keterangan: b.keterangan, lokasi: b.lokasi }));
}

/* ---------- membangun isi untuk file baru ---------- */

export interface OpsiIsiTimesheet {
  proyek: string;
  judulKegiatan: string;
  nama: string;
  mulai: string;
  selesai: string;
  baris: BarisTimesheet[];
  disetujuiOleh: string;
}

/**
 * Isi sel A1 dst. untuk file timesheet baru. Tanggal ditulis sebagai teks (awalan apostrof) supaya Google Sheets
 * tidak menafsirkannya sendiri sebagai tanggal hari/bulan; jumlah berupa angka, total berupa rumus. Bila hari
 * lebih banyak dari kapasitas template, Total dan tanda tangan turun mengikuti jumlah hari.
 */
export function susunIsiTimesheet(o: OpsiIsiTimesheet): { nilai: Array<Array<string | number>>; barisTotal: number } {
  const nilai: Array<Array<string | number>> = [];
  const taruh = (barisKe: number, kolom: number, v: string | number) => {
    while (nilai.length < barisKe) nilai.push([]);
    const baris = nilai[barisKe - 1];
    while (baris.length <= kolom) baris.push("");
    baris[kolom] = v;
  };

  taruh(2, 2, "Detail Keuangan");
  taruh(3, 2, "Perdiem Kegiatan Lapangan");
  taruh(5, 0, "Proyek");
  taruh(5, 1, `: ${o.proyek}`);
  taruh(6, 0, "Judul Kegiatan");
  taruh(6, 1, `: ${o.judulKegiatan}`);
  taruh(7, 0, "Nama");
  taruh(7, 1, `: ${o.nama}`);
  taruh(8, 0, "Bulan");
  taruh(8, 1, `: ${labelBulan(o.mulai, o.selesai)}`);
  ["No", "Tanggal", "Keterangan", "Lokasi", "Jumlah (Rp.)"].forEach((h, i) => taruh(10, i, h));

  const urut = [...o.baris].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  urut.forEach((b, i) => {
    const r = BARIS_DATA_AWAL + i;
    taruh(r, 0, i + 1);
    taruh(r, 1, `'${formatTanggalTimesheet(b.tanggal)}`);
    taruh(r, 2, b.keterangan);
    taruh(r, 3, b.lokasi);
    if (b.jumlah !== undefined) taruh(r, 4, b.jumlah);
  });

  const barisAkhirData = BARIS_DATA_AWAL + Math.max(urut.length, KAPASITAS_BARIS_TEMPLATE) - 1;
  const barisTotal = barisAkhirData + 1;
  taruh(barisTotal, 2, "Total");
  taruh(barisTotal, 4, `=SUM(E${BARIS_DATA_AWAL}:E${barisAkhirData})`);
  taruh(barisTotal + 2, 1, "Dilaporkan Oleh :");
  taruh(barisTotal + 2, 3, "Disetujui Oleh :");
  taruh(barisTotal + 6, 1, o.nama);
  taruh(barisTotal + 6, 3, o.disetujuiOleh);

  for (const baris of nilai) while (baris.length < 5) baris.push("");
  return { nilai, barisTotal };
}

/** Rentang yang dibersihkan sebelum menulis ulang file hasil salinan: seluruh area isi, agar sisa data lama hilang. */
export function rentangBersih(tab: string, barisTerakhirBaru: number): string {
  return `'${tab}'!A1:G${Math.max(80, barisTerakhirBaru + 10)}`;
}

/* ---------- dari transaksi perdiem ke baris timesheet ---------- */

/**
 * Hari-hari perdiem sebuah kegiatan (transaksi Dana Kegiatan milik kegiatan itu, lihat transaksiKegiatan), digabung
 * dengan Keterangan dan Lokasi dari timesheet. Jumlah selalu dari transaksi. Hari yang ada transaksinya tetapi belum
 * diisi di timesheet tetap muncul dengan keterangan kosong.
 */
export function barisPerdiemKegiatan(transaksiKegiatanIni: Transaksi[], timesheetBaris: BarisTimesheet[] = []): BarisTimesheet[] {
  const perTanggal = new Map<string, number>();
  for (const t of transaksiKegiatanIni) {
    if (adalahPerdiemKegiatan(t)) perTanggal.set(t.tanggal, (perTanggal.get(t.tanggal) ?? 0) + t.jumlah);
  }
  const isi = new Map(timesheetBaris.map((b) => [b.tanggal, b]));
  return [...perTanggal.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tanggal, jumlah]) => ({
      tanggal,
      keterangan: isi.get(tanggal)?.keterangan ?? "",
      lokasi: isi.get(tanggal)?.lokasi ?? "",
      jumlah,
    }));
}

/** Tanggal perdiem yang belum punya keterangan di timesheet (untuk peringatan di aplikasi). */
export function tanggalBelumAdaDiTimesheet(baris: BarisTimesheet[]): string[] {
  return baris.filter((b) => !b.keterangan.trim()).map((b) => b.tanggal);
}

/* ---------- daftar perdiem untuk dokumen (tampilan siap cetak dan Word) ---------- */

export interface BarisDaftarPerdiem {
  no: number;
  tanggal: string; // gaya timesheet: 9/20/2026
  keterangan: string;
  lokasi: string;
  jumlah: number;
}

/** Isi lembar "Detail Keuangan - Perdiem Kegiatan Lapangan", sama dengan format file timesheet pengguna. */
export interface DaftarPerdiemDokumen {
  proyek: string;
  judulKegiatan: string;
  nama: string;
  bulan: string;
  baris: BarisDaftarPerdiem[];
  total: number;
  dilaporkanOleh: string;
  disetujuiOleh: string;
  /** Berapa hari yang sudah punya keterangan; 0 berarti timesheet belum ditarik atau belum diisi. */
  hariBerketerangan: number;
}

/**
 * Susun daftar perdiem berformat timesheet dari transaksi perdiem (sudah disaring untuk laporan) dan isi timesheet
 * kegiatan. Jumlah dari transaksi; Keterangan dan Lokasi dari timesheet. Tanpa transaksi perdiem -> null.
 */
export function susunDaftarPerdiem(
  transaksiPerdiem: Transaksi[],
  kegiatan: Pick<DataKegiatan, "nama" | "batch" | "timesheetNama" | "timesheetBaris">,
  profil: Pick<ProfilPelapor, "nama" | "proyek" | "penyetuju">
): DaftarPerdiemDokumen | null {
  const hari = barisPerdiemKegiatan(transaksiPerdiem, kegiatan.timesheetBaris);
  if (hari.length === 0) return null;
  const batch = batchKegiatan(kegiatan);
  return {
    proyek: profil.proyek,
    judulKegiatan: judulUntukTimesheet(kegiatan.nama, batch),
    nama: profil.nama,
    bulan: labelBulan(hari[0].tanggal, hari[hari.length - 1].tanggal),
    baris: hari.map((b, i) => ({
      no: i + 1,
      tanggal: formatTanggalTimesheet(b.tanggal),
      keterangan: b.keterangan,
      lokasi: b.lokasi,
      jumlah: b.jumlah ?? 0,
    })),
    total: hari.reduce((s, b) => s + (b.jumlah ?? 0), 0),
    dilaporkanOleh: profil.nama,
    disetujuiOleh: profil.penyetuju ?? "",
    hariBerketerangan: hari.length - tanggalBelumAdaDiTimesheet(hari).length,
  };
}
