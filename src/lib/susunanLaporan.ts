import type { BuktiItem, DataKegiatan, FotoPendukung, ProfilPelapor, Transaksi, UkuranKotakTempel } from "../types";
import { formatAngka, formatRupiah, hariIni, KELOMPOK_DANA_KEGIATAN, labelKategori } from "./constants";
import { KETENTUAN_DANA_KEGIATAN } from "./ketentuanKegiatan";
import { hitungPenyelesaian, KATEGORI_PERDIEM, RingkasanPenyelesaian, transaksiKegiatan } from "./penyelesaianDana";
import { adalahKudapanPerjalanan, barisPenerimaManfaat, plafonKudapan } from "./penerimaManfaat";
import { barisDiklaimUntuk, barisRincianLengkap, uraianTampil } from "./kelengkapanKategori";
import { DaftarPerdiemDokumen, susunDaftarPerdiem } from "./timesheet";
import { profilUntukDokumen } from "./profilPelapor";
import { buktiPdf, kenaliGambar } from "./gambarDokumen";

/**
 * Susunan laporan dana kegiatan: satu sumber isi dan urutan untuk dokumen Word (lib/docxGenerator.ts) dan dokumen siap cetak /
 * pratinjau di aplikasi (components/DokumenSiapCetak.tsx), supaya keduanya sama:
 *   1. Timesheet uang harian (lanskap).
 *   2. Judul, identitas, dan Penerimaan Dana.
 *   3. Tiap kelompok pengeluaran di halaman baru: judul bernomor, tabel, lalu blok tiap pengeluaran (kotak tempel bukti asli,
 *      foto bukti digital, keterangan, kotak tambahan, foto pendukung).
 *   4. Dokumen pendukung (timesheet rental, surat justifikasi).
 *   5. Rekapitulasi penggunaan dana dan ringkasan penyelesaian.
 *   6. Daftar periksa kelengkapan (bisa dimatikan).
 */

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10-27" -> "27 Oktober 2026" tanpa bergantung zona waktu perangkat. */
export function formatTanggalIndo(iso?: string): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const bulan = NAMA_BULAN[Number(m[2]) - 1];
  return bulan ? `${Number(m[3])} ${bulan} ${m[1]}` : iso;
}

/** "2026-10-27" -> "27/10/2026". */
export function tanggalSingkat(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export interface Segmen {
  teks: string;
  tebal?: boolean;
  miring?: boolean;
  warna?: "abu" | "merah";
  /** Huruf sedikit lebih kecil (rincian kategori), seperti di dokumen Word. */
  kecil?: boolean;
}
export type BarisKeterangan = Segmen[];

export interface KotakTempelLaporan {
  judul: string;
  keterangan: string;
  tinggiMm: number;
  lebarMm: number;
  /** "struk": kotak tempel potret (tata letak berdampingan); "lebar": kotak tempel selebar halaman. */
  bentuk: "lebar" | "struk";
  catatan?: string;
}

export interface PasanganBuktiLaporan {
  urutan: number;
  total: number;
  label?: string; // "Bukti 1 dari 3"
  foto?: BuktiItem;
  kotak: KotakTempelLaporan;
  tataLetak: "samping" | "bawah";
}

export interface BlokTransaksiLaporan {
  transaksi: Transaksi;
  nomor: number;
  /** Mulai di halaman baru berdasarkan perkiraan tinggi dalam mm (area isi 257 mm). */
  halamanBaru: boolean;
  pasangan: PasanganBuktiLaporan[];
  /** Turunan dari pasangan (untuk kompatibilitas dengan pemanggil lama): */
  kotakUtama: KotakTempelLaporan;
  fotoDiKotak?: BuktiItem;
  fotoBukti: BuktiItem[];
  lampiranPdf: BuktiItem[];
  keterangan: BarisKeterangan[];
  kotakTambahan: KotakTempelLaporan[];
  fotoPendukung: FotoPendukung[];
  perkiraanTinggiMm: number;
}

export interface BarisTabelLaporan {
  transaksi: Transaksi;
  nomor: string;
  tanggal: string;
  uraian: string;
  rincian: string[];
  metode: string;
  jumlah: number;
}

export interface KelompokLaporan {
  nomor: number;
  kategori: string;
  judul: string;
  transaksi: Transaksi[];
  subtotal: number;
  /** null untuk uang harian yang sudah tampil sebagai timesheet. */
  tabel: BarisTabelLaporan[] | null;
  blok: BlokTransaksiLaporan[];
}

export interface BarisRekapLaporan {
  nomor: number;
  label: string;
  jumlahBukti: number;
  jumlah: number;
}

export interface RentalTimesheetLaporan {
  transaksi: Transaksi;
  judul: string;
  info: string;
  baris: Array<{ no: number; tanggal: string; lokasi: string; aktivitas: string; jarakKm: number }>;
  totalKm: number;
  namaPemilik: string;
  /** Tempat dan tanggal tanda tangan: "Lokasi, 27 Oktober 2026". */
  tanggalTtd: string;
}

export interface ParamNarasiJustifikasi {
  alasanSingkat?: string;
  jenisBukti?: string;
  uraian: string;
  jumlah: number;
  tanggal: string;
  namaKegiatan: string;
  lokasiKegiatan: string;
  namaPelapor: string;
  jabatanPelapor: string;
  lembagaProyek: string;
}

export interface JustifikasiLaporan {
  transaksi: Transaksi;
  nomor: number;
  jenisBukti: string;
  identitas: Array<{ label: string; nilai: string }>;
  /** Data untuk narasi surat (AI bila tersedia, lihat susunNarasiSuratJustifikasi). */
  paramNarasi: ParamNarasiJustifikasi;
  /** Narasi baku tiga paragraf, dipakai bila narasi AI tidak tersedia. */
  narasiBaku: string[];
  /** Tempat dan tanggal tanda tangan: "Lokasi, 27 Oktober 2026". */
  tempatTanggal: string;
}

export interface SusunanLaporan {
  kegiatan: DataKegiatan;
  /** Profil Pelapor dengan isian kosong dilengkapi dari kop timesheet (lihat profilUntukDokumen). */
  profil: ProfilPelapor;
  periode: string;
  /** Teks kepala halaman: "Laporan Keuangan Kegiatan · Nama · Periode". */
  kepalaHalaman: string;
  identitas: Array<{ label: string; nilai: string }>;
  penerimaan: BarisTabelLaporan[];
  totalPenerimaan: number;
  daftarPerdiem: DaftarPerdiemDokumen | null;
  kelompok: KelompokLaporan[];
  rental: RentalTimesheetLaporan[];
  justifikasi: JustifikasiLaporan[];
  rekap: BarisRekapLaporan[];
  totalBukti: number;
  totalPengeluaran: number;
  penyelesaian: RingkasanPenyelesaian;
  daftarPeriksa: Array<{ judul: string; butir: string[] }> | null;
  /** Pengeluaran kegiatan sesuai urutan dokumen dan nomornya (1..N). */
  pengeluaran: Transaksi[];
  nomorUrut: Map<string, number>;
  transaksiKegiatan: Transaksi[];
}

export interface OpsiSusunanLaporan {
  transaksi: Transaksi[];
  kegiatan: DataKegiatan;
  daftarKegiatan?: DataKegiatan[];
  profilPelapor: ProfilPelapor;
  urutanTransaksiIds?: string[];
  sertakanDaftarPeriksa?: boolean;
  ukuranFoto?: Map<string, { lebar: number; tinggi: number }>;
}

const KATEGORI_PINDAH_DANA = "Pindah Dana";

/** Warna ringkasan penyelesaian menurut statusnya: hijau (sisa dikembalikan), merah (kelebihan diganti), biru (nihil). */
export function warnaPenyelesaian(status: RingkasanPenyelesaian["status"]): { latar: string; garis: string; teks: string } {
  if (status === "reimbursement") return { latar: "FDECEC", garis: "B42318", teks: "B42318" };
  if (status === "nihil") return { latar: "E8F0FE", garis: "1D4ED8", teks: "1D4ED8" };
  return { latar: "E7F6EC", garis: "0D652D", teks: "0D652D" };
}

/** Kalimat hitungan penyelesaian: dana awal dikurangi total diakui (atau sebaliknya bila kurang). */
export function rumusPenyelesaian(p: RingkasanPenyelesaian): string {
  if (p.status === "reimbursement") {
    return `Total pengeluaran yang diakui ${formatRupiah(p.totalDiakui)} − dana awal ${formatRupiah(p.danaAwal)} = ${formatRupiah(p.jumlahStatus)}`;
  }
  return `Dana awal ${formatRupiah(p.danaAwal)} − total pengeluaran yang diakui ${formatRupiah(p.totalDiakui)} = ${formatRupiah(p.jumlahStatus)}`;
}

/** Rincian ringkasan penyelesaian (label, nilai), sama di dokumen Word dan dokumen siap cetak. */
export function rincianPenyelesaian(p: RingkasanPenyelesaian): Array<[string, number]> {
  return [
    ["Dana awal kegiatan (uang muka dari lembaga)", p.danaAwal],
    ["Realisasi pengeluaran kegiatan", p.realisasiOperasional],
    ["Total uang harian (per diem)", p.totalPerdiem],
  ];
}

/** Narasi baku surat justifikasi (tiga paragraf). */
export function narasiJustifikasiBaku(params: ParamNarasiJustifikasi): string[] {
  const nominalFmt = formatRupiah(params.jumlah);
  const p1 = `Sehubungan dengan pelaksanaan kegiatan ${params.namaKegiatan || "lapangan"} yang berlokasi di ${params.lokasiKegiatan || "lapangan"}, bersama ini saya menerangkan bahwa pada tanggal ${formatTanggalIndo(params.tanggal)} telah dilakukan transaksi pengeluaran riil sebesar ${nominalFmt} untuk keperluan ${params.uraian || "kegiatan operasional"}.`;
  const p2 = `Adapun mengenai dokumen pertanggungjawaban transaksi tersebut, dokumen yang dapat dilampirkan berstatus ${params.jenisBukti || "bukti tidak lengkap"} dikarenakan ${params.alasanSingkat || "keterbatasan fasilitas administrasi penyedia jasa/penjual di lokasi kegiatan lapangan serta kondisi geografis yang berada di wilayah terpencil"}.`;
  const p3 = `Dengan ini saya menyatakan dengan sesungguhnya bahwa transaksi tersebut di atas adalah benar-benar terlaksana dan mutlak dipergunakan untuk mendukung kelancaran operasional kegiatan kedinasan, tanpa adanya unsur manipulasi atau kepentingan pribadi, serta saya bersedia bertanggung jawab sepenuhnya atas kebenaran keterangan ini.`;
  return [p1, p2, p3];
}

export const KALIMAT_PENUTUP_JUSTIFIKASI =
  "Demikian surat justifikasi ini dibuat dengan sebenarnya dengan penuh tanggung jawab untuk dipergunakan sebagaimana mestinya.";

const cacheNarasi = new Map<string, Promise<string[]>>();

/**
 * Narasi surat justifikasi dari server Gemini AI, atau narasi baku bila server tidak tersedia. Hasilnya disimpan selama sesi,
 * jadi dokumen siap cetak dan dokumen Word memuat narasi yang sama.
 */
export function susunNarasiSuratJustifikasi(params: ParamNarasiJustifikasi): Promise<string[]> {
  const kunci = JSON.stringify(params);
  const ada = cacheNarasi.get(kunci);
  if (ada) return ada;
  const janji = (async () => {
    try {
      const res = await fetch("/api/gemini/susun-surat-justifikasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.paragraf) && data.paragraf.length > 0) return data.paragraf as string[];
      }
    } catch (e) {
      console.warn("Fetch narasi justifikasi AI gagal, memakai template baku:", e);
    }
    return narasiJustifikasiBaku(params);
  })();
  cacheNarasi.set(kunci, janji);
  return janji;
}

function urutkanPengeluaran(daftar: Transaksi[], urutanManual: string[]): Transaksi[] {
  const urutanKelompok = new Map<string, number>();
  KELOMPOK_DANA_KEGIATAN.forEach((k, i) => urutanKelompok.set(k, i));
  const indeksManual = new Map<string, number>();
  urutanManual.forEach((id, i) => indeksManual.set(id, i));
  return [...daftar].sort((a, b) => {
    if (indeksManual.size > 0) {
      const ia = indeksManual.get(a.id) ?? 999999;
      const ib = indeksManual.get(b.id) ?? 999999;
      if (ia !== ib) return ia - ib;
    }
    const ka = urutanKelompok.get(a.kategori) ?? 99;
    const kb = urutanKelompok.get(b.kategori) ?? 99;
    if (ka !== kb) return ka - kb;
    return a.tanggal.localeCompare(b.tanggal);
  });
}

const adaFoto = (t: Transaksi) => (t.bukti?.length ?? 0) > 0 || (t.detailKegiatan?.fotoPendukung?.length ?? 0) > 0;

function barisTabel(t: Transaksi, nomor: string, namaPelapor: string, namaKegiatan: string): BarisTabelLaporan {
  return {
    transaksi: t,
    nomor,
    tanggal: tanggalSingkat(t.tanggal),
    uraian: uraianTampil(t, namaKegiatan),
    rincian: barisRincianLengkap(t, namaPelapor),
    metode: `Metode: ${t.metode || "Tunai"} · ${(t.bukti?.length ?? 0) > 0 ? `Lampiran ${t.bukti!.length}` : t.jenis === "pengeluaran" ? "Tanpa bukti" : "—"}`,
    jumlah: t.jumlah,
  };
}

/** Keterangan di bawah kotak tempel, sama isi dan urutannya dengan dokumen Word. */
function keteranganTransaksi(t: Transaksi, profil: ProfilPelapor): BarisKeterangan[] {
  const d = t.detailKegiatan ?? {};
  const baris: BarisKeterangan[] = [];
  baris.push([
    { teks: `Pelapor: ${profil.nama}`, tebal: true },
    { teks: `  |  Tanggal: ${formatTanggalIndo(t.tanggal)}`, warna: "abu" },
    ...(d.namaPenjualPenyedia ? [{ teks: `  |  Penyedia/Toko: ${d.namaPenjualPenyedia}`, warna: "abu" as const }] : []),
  ]);
  if (d.keteranganLaporan || t.catatan) baris.push([{ teks: "Keterangan: ", tebal: true }, { teks: d.keteranganLaporan || t.catatan || "-" }]);
  if (d.rincian && d.rincian.banyaknya > 0 && d.rincian.hargaSatuan > 0) {
    baris.push([
      { teks: "Rincian: ", tebal: true },
      {
        teks: `${formatAngka(d.rincian.banyaknya)} ${d.rincian.satuan || "unit"} × ${formatRupiah(d.rincian.hargaSatuan)} = ${formatRupiah(d.rincian.total || t.jumlah)}`,
      },
    ]);
  }
  if (t.kategori === "Rental Kendaraan" && d.rentalKendaraan) {
    const rk = d.rentalKendaraan;
    const persen = rk.persenGrossUpPajak ?? 2;
    const grossUp = persen > 0 ? Math.round(t.jumlah / (1 - persen / 100)) : t.jumlah;
    baris.push([{ teks: `Kendaraan: ${rk.jenisMerk || "Mobil/Motor"} (${rk.tahun || "-"}) · Plat: ${rk.noPolisi || "-"} · Pemilik: ${rk.namaPemilik || "-"}`, kecil: true, warna: "abu" }]);
    baris.push([{ teks: `Durasi Sewa: ${rk.jumlahHari || 1} hari (${formatTanggalIndo(rk.tanggalMulai)} s.d. ${formatTanggalIndo(rk.tanggalSelesai)}) @ ${formatRupiah(rk.tarifPerHari || 0)}/hari`, kecil: true }]);
    baris.push([
      { teks: `Nilai gross-up pajak ${persen}%: `, tebal: true },
      { teks: `${formatRupiah(grossUp)} (Pajak PPh 23: ${formatRupiah(grossUp - t.jumlah)}, Netto dibayarkan: ${formatRupiah(t.jumlah)})` },
    ]);
  }
  if (t.kategori === "Honorarium & Ganti Hari" && d.honorarium) {
    const h = d.honorarium;
    baris.push([{ teks: `Penerima: ${h.namaPenerima || "-"} (${h.isPNS ? "PNS" : "Bukan PNS"}, ${h.hasNPWP ? "Memiliki NPWP" : "Tanpa NPWP"})`, kecil: true }]);
    baris.push([{ teks: `Alokasi: ${h.jumlahOrang || 1} orang × ${h.jumlahHari || 1} hari | No. Absen: ${h.nomorAbsen || "-"}`, kecil: true }]);
    baris.push([
      { teks: "Potongan Pajak PPh 21: ", tebal: true },
      {
        teks: `Bruto ${formatRupiah(h.honorBruto || t.jumlah)} · Tarif ${h.tarifPajakPersen || 5}% · Potongan ${formatRupiah(h.pajakDipotong || 0)} · Diterima Bersih (Netto) ${formatRupiah(h.honorNetto || t.jumlah)}`,
      },
    ]);
  }
  if (t.kategori === "BBM" && d.bbm) {
    const b = d.bbm;
    baris.push([
      {
        teks: `Rute BBM: ${b.dari || "-"} → ${b.ke || "-"} | Plat: ${b.noPolisi || "-"} | KM Isi: ${b.kmSaatIsi || "-"} | Jarak Tempuh: ${b.jarakTempuh ? `${b.jarakTempuh} km` : "-"}`,
        kecil: true,
      },
    ]);
  }
  if (t.kategori === "Transportasi" && d.transportasi) {
    const tr = d.transportasi;
    baris.push([
      { teks: `Rute: ${tr.dari || "-"} → ${tr.ke || "-"} | Moda: ${tr.moda || "-"}`, kecil: true },
      ...(tr.namaSopir || tr.noTelpSopir || tr.noPolisi
        ? [{ teks: ` | Sopir/Pengemudi: ${tr.namaSopir || "-"} (Telp: ${tr.noTelpSopir || "-"}, Plat: ${tr.noPolisi || "-"})`, kecil: true }]
        : []),
    ]);
  }
  if (t.kategori === "Akomodasi" && d.akomodasi) {
    const a = d.akomodasi;
    baris.push([
      {
        teks: `Penginapan: ${a.lokasi || "-"} | Check-in: ${formatTanggalIndo(a.tanggalMasuk)} | Check-out: ${formatTanggalIndo(a.tanggalKeluar)} (${a.jumlahMalam || 1} malam) | Pemilik: ${a.namaPemilik || "-"} (Telp: ${a.noTelp || "-"})`,
        kecil: true,
      },
    ]);
  }
  if (t.kategori === "Konsumsi" && d.konsumsi) {
    const k = d.konsumsi;
    baris.push([
      {
        teks: adalahKudapanPerjalanan(t.kategori, d, t.deskripsi)
          ? `Toko/Warung Pembelian: ${k.penyedia || "-"} (Telp: ${k.noTelp || "-"}) | Rute/Lokasi: ${k.lokasi || "-"}`
          : `Penyedia Konsumsi: ${k.penyedia || "-"} (Telp: ${k.noTelp || "-"}) | Lokasi: ${k.lokasi || "-"} | Jumlah Peserta: ${k.jumlahPeserta || "-"} orang`,
        kecil: true,
      },
    ]);
  }
  const kudapan = adalahKudapanPerjalanan(t.kategori, d, t.deskripsi) ? barisPenerimaManfaat(t) : null;
  if (kudapan) baris.push([{ teks: kudapan, tebal: true, kecil: true }]);
  if (adalahKudapanPerjalanan(t.kategori, d, t.deskripsi)) {
    const jmlOrang = d.penerimaManfaat?.length || 1;
    const plafonTotal = plafonKudapan(jmlOrang);
    if (t.jumlah > plafonTotal) {
      const lebih = t.jumlah - plafonTotal;
      baris.push([
        {
          teks: `Catatan Plafon: Yang dapat diklaim sesuai plafon (200.000/3 per orang) sebesar ${formatRupiah(plafonTotal)}. Kelebihannya sebesar ${formatRupiah(lebih)} tidak dapat diklaim.`,
          warna: "merah",
          tebal: true,
          kecil: true,
        },
      ]);
    }
  }
  const diklaim = barisDiklaimUntuk(t, profil.nama);
  if (diklaim) baris.push([{ teks: diklaim, tebal: true, kecil: true }]);
  if (d.perluSuratJustifikasi) {
    baris.push([
      { teks: "Surat Justifikasi: ", tebal: true, warna: "merah" },
      { teks: `Dilampirkan di bagian Dokumen Pendukung (${d.alasanJustifikasi || "Kuitansi asli tidak lengkap"})`, miring: true },
    ]);
  }
  return baris;
}

export const BATAS_RASIO = {
  POTRET_SEMPIT: 1.6,
  POTRET: 1.15,
  HAMPIR_PERSEGI: 0.87,
} as const;

export interface UkuranKotakHasil {
  lebarMm: number;
  tinggiMm: number;
  tataLetak: "samping" | "bawah";
  bentuk: "lebar" | "struk";
  catatan?: string;
}

export function hitungUkuranKotakDanTataLetak(
  rasio: number | undefined,
  jenisBukti = "Kuitansi",
  manual?: UkuranKotakTempel
): UkuranKotakHasil {
  // Pilihan manual kotakTempel A/B/C dihormati
  if (manual === "A") {
    return { lebarMm: 85, tinggiMm: 120, tataLetak: "samping", bentuk: "struk" };
  }
  if (manual === "B") {
    return { lebarMm: 170, tinggiMm: 65, tataLetak: "bawah", bentuk: "lebar" };
  }
  if (manual === "C") {
    return { lebarMm: 170, tinggiMm: 130, tataLetak: "bawah", bentuk: "lebar" };
  }

  // Dari rasio foto bukti:
  if (typeof rasio === "number" && Number.isFinite(rasio) && rasio > 0) {
    if (rasio >= BATAS_RASIO.POTRET_SEMPIT) {
      const tinggiHitung = Math.round(85 * rasio + 10);
      const tinggiMm = Math.min(230, Math.max(100, tinggiHitung));
      const catatan = tinggiHitung > 230 ? "Lipat struk bila lebih panjang dari kotak" : undefined;
      return { lebarMm: 85, tinggiMm, tataLetak: "samping", bentuk: "struk", catatan };
    }
    if (rasio >= BATAS_RASIO.POTRET) {
      const tinggiMm = Math.min(200, Math.max(110, Math.round(100 * rasio + 10)));
      return { lebarMm: 100, tinggiMm, tataLetak: "samping", bentuk: "struk" };
    }
    if (rasio >= BATAS_RASIO.HAMPIR_PERSEGI) {
      return { lebarMm: 100, tinggiMm: 100, tataLetak: "samping", bentuk: "struk" };
    }
    // lanskap < 0.87
    const tinggiMm = Math.min(120, Math.max(55, Math.round(170 * rasio + 10)));
    return { lebarMm: 170, tinggiMm, tataLetak: "bawah", bentuk: "lebar" };
  }

  // Tanpa foto atau ukuran tidak terbaca:
  if (jenisBukti === "Struk thermal (minimarket/SPBU)") {
    return { lebarMm: 85, tinggiMm: 120, tataLetak: "samping", bentuk: "struk", catatan: "(Struk Thermal Mudah Pudar)" };
  }
  if (jenisBukti === "Nota") {
    return { lebarMm: 100, tinggiMm: 130, tataLetak: "samping", bentuk: "struk" };
  }
  return { lebarMm: 170, tinggiMm: 65, tataLetak: "bawah", bentuk: "lebar" };
}

export function rasioFotoBukti(
  b: BuktiItem,
  ukuranFoto?: Map<string, { lebar: number; tinggi: number }>
): number | undefined {
  if (b.lebarPx && b.tinggiPx && b.lebarPx > 0) {
    return b.tinggiPx / b.lebarPx;
  }
  const u = ukuranFoto?.get(b.id);
  if (u && u.lebar > 0 && u.tinggi > 0) {
    return u.tinggi / u.lebar;
  }
  if (b.dataUrl && b.dataUrl.startsWith("data:")) {
    try {
      const idx = b.dataUrl.indexOf(";base64,");
      if (idx >= 0) {
        // Ambil header yang cukup panjang (hingga 32KB) agar penanda SOF0 JPEG yang terletak setelah header EXIF dapat terbaca
        const b64 = b.dataUrl.slice(idx + 8, idx + 8 + 32768);
        const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const info = kenaliGambar(bytes);
        if (info.lebar && info.tinggi) {
          const [effW, effH] =
            info.orientasi && info.orientasi >= 5 && info.orientasi <= 8
              ? [info.tinggi, info.lebar]
              : [info.lebar, info.tinggi];
          return effH / effW;
        }
      }
    } catch {
      // abaikan
    }
  }
  return undefined;
}

function susunPasanganBukti(
  t: Transaksi,
  nomor: number,
  profil: ProfilPelapor,
  ukuranFoto?: Map<string, { lebar: number; tinggi: number }>
): { pasangan: PasanganBuktiLaporan[]; lampiranPdf: BuktiItem[] } {
  const d = t.detailKegiatan ?? {};
  const jenisBukti = d.jenisBukti || "Kuitansi";
  const manual = d.kotakTempel;
  const diklaim = barisDiklaimUntuk(t, profil.nama);
  const judulKotak =
    jenisBukti === "Struk thermal (minimarket/SPBU)"
      ? "TEMPEL STRUK ASLI DI SINI"
      : `TEMPEL ${jenisBukti.toUpperCase()} ASLI DI SINI`;

  const buktiSemua = t.bukti ?? [];
  const lampiranPdf = buktiSemua.filter((b) => buktiPdf(b));
  const foto = buktiSemua.filter((b) => !buktiPdf(b));

  if (foto.length === 0) {
    const ukuran = hitungUkuranKotakDanTataLetak(undefined, jenisBukti, manual);
    const keterangan = `No. ${nomor} · ${t.deskripsi}${diklaim ? ` · ${diklaim}` : ""}`;
    return {
      pasangan: [
        {
          urutan: 1,
          total: 1,
          foto: undefined,
          kotak: {
            judul: judulKotak,
            keterangan,
            tinggiMm: ukuran.tinggiMm,
            lebarMm: ukuran.lebarMm,
            bentuk: ukuran.bentuk,
            catatan: ukuran.catatan,
          },
          tataLetak: ukuran.tataLetak,
        },
      ],
      lampiranPdf,
    };
  }

  const total = foto.length;
  const pasangan: PasanganBuktiLaporan[] = foto.map((f, idx) => {
    const urutan = idx + 1;
    const label = total > 1 ? `Bukti ${urutan} dari ${total}` : undefined;
    const rasio = rasioFotoBukti(f, ukuranFoto);
    const ukuran = hitungUkuranKotakDanTataLetak(rasio, jenisBukti, manual);
    const labelBagian = total > 1 ? `Bukti ${urutan} dari ${total} · ` : "";
    const keterangan = `No. ${nomor} · ${labelBagian}${t.deskripsi}${diklaim ? ` · ${diklaim}` : ""}`;
    return {
      urutan,
      total,
      label,
      foto: f,
      kotak: {
        judul: judulKotak,
        keterangan,
        tinggiMm: ukuran.tinggiMm,
        lebarMm: ukuran.lebarMm,
        bentuk: ukuran.bentuk,
        catatan: ukuran.catatan,
      },
      tataLetak: ukuran.tataLetak,
    };
  });

  return { pasangan, lampiranPdf };
}

function hitungTinggiBlokMm(
  pasangan: PasanganBuktiLaporan[],
  keterangan: BarisKeterangan[],
  kotakTambahan: KotakTempelLaporan[],
  fotoPendukung: FotoPendukung[],
  ukuranFoto?: Map<string, { lebar: number; tinggi: number }>
): number {
  let tinggi = 10; // kepala blok + padding
  for (let i = 0; i < pasangan.length; i++) {
    const p = pasangan[i];
    if (i > 0) tinggi += 4;
    if (p.tataLetak === "samping") {
      tinggi += p.kotak.tinggiMm;
    } else {
      if (p.foto) {
        const rasio = rasioFotoBukti(p.foto, ukuranFoto) ?? 0.45;
        const tinggiFoto = Math.min(70, Math.max(30, Math.round(170 * rasio)));
        tinggi += tinggiFoto + 4 + p.kotak.tinggiMm;
      } else {
        tinggi += p.kotak.tinggiMm;
      }
    }
  }
  tinggi += keterangan.length * 4.5;
  for (const kt of kotakTambahan) {
    tinggi += kt.tinggiMm + 4;
  }
  tinggi += fotoPendukung.length * 60;
  tinggi += 6;
  return tinggi;
}

function kotakTambahan(t: Transaksi, nomor: number, profil: ProfilPelapor): KotakTempelLaporan[] {
  const d = t.detailKegiatan ?? {};
  const jenisBukti = (d.jenisBukti || "Kuitansi").toLowerCase();
  const moda = (d.transportasi?.moda || "").toLowerCase();
  const hasil: KotakTempelLaporan[] = [];
  const lebar = (judul: string, keterangan: string, tinggiMm: number): KotakTempelLaporan => ({
    judul,
    keterangan,
    tinggiMm,
    lebarMm: 170,
    bentuk: "lebar",
  });
  if (moda.includes("pesawat") || jenisBukti.includes("pesawat")) {
    hasil.push(lebar("TEMPEL BOARDING PASS ASLI / TIKET TRAVEL ASLI DI SINI", `No. ${nomor} · Boarding Pass / Tiket Pesawat Asli · ${profil.nama}`, 55));
  }
  if (moda.includes("travel") || moda.includes("ojek") || d.transportasi?.namaSopir) {
    hasil.push(
      lebar(
        "TEMPEL FOTOKOPI STNK KENDARAAN TRAVEL / OJEK DI SINI",
        `No. ${nomor} · STNK ${d.transportasi?.noPolisi || "Kendaraan"} · Sopir: ${d.transportasi?.namaSopir || "-"}`,
        50
      )
    );
  }
  if (t.kategori === "Rental Kendaraan") {
    hasil.push(
      lebar(
        "TEMPEL FOTOKOPI STNK, KTP PEMILIK/PENERIMA UANG, DAN SIM PENYEWA DI SINI",
        `No. ${nomor} · Dokumen Legalitas Rental: STNK Plat ${d.rentalKendaraan?.noPolisi || "-"} · KTP Pemilik: ${d.rentalKendaraan?.namaPemilik || "-"} · SIM Pengemudi`,
        60
      )
    );
  }
  if (t.kategori === "Akomodasi") {
    hasil.push(lebar("TEMPEL FOTOKOPI KTP PEMILIK PENGINAPAN DI SINI", `No. ${nomor} · KTP Pemilik Penginapan: ${d.akomodasi?.namaPemilik || "-"}`, 50));
  }
  if (t.kategori === "Honorarium & Ganti Hari") {
    hasil.push(
      lebar("TEMPEL FOTOKOPI KTP DAN NPWP PENERIMA HONOR / GANTI HARI DI SINI", `No. ${nomor} · Dokumen Pajak Penerima Honor: ${d.honorarium?.namaPenerima || "-"}`, 60)
    );
  }
  return hasil;
}

function blokKelompok(
  daftar: Transaksi[],
  nomorUrut: Map<string, number>,
  profil: ProfilPelapor,
  punyaTabel: boolean,
  jumlahBarisTabel: number,
  ukuranFoto?: Map<string, { lebar: number; tinggi: number }>
): BlokTransaksiLaporan[] {
  const TINGGI_HALAMAN_MM = 257;
  const tinggiHeader = 15 + (punyaTabel ? 22 + jumlahBarisTabel * 7 : 0);
  let sisaHalaman = TINGGI_HALAMAN_MM - tinggiHeader;

  return daftar.map((t) => {
    const nomor = nomorUrut.get(t.id) ?? 1;
    const ket = keteranganTransaksi(t, profil);
    const tambahan = kotakTambahan(t, nomor, profil);
    const pendukung = t.detailKegiatan?.fotoPendukung ?? [];
    const { pasangan, lampiranPdf } = susunPasanganBukti(t, nomor, profil, ukuranFoto);
    const tinggiBlok = hitungTinggiBlokMm(pasangan, ket, tambahan, pendukung, ukuranFoto);

    let halamanBaru = false;
    if (sisaHalaman < tinggiBlok && sisaHalaman < TINGGI_HALAMAN_MM - 20) {
      halamanBaru = true;
      sisaHalaman = TINGGI_HALAMAN_MM - tinggiBlok;
    } else {
      halamanBaru = false;
      sisaHalaman -= tinggiBlok;
    }

    const utama = pasangan[0].kotak;
    const fotoDiKotak = pasangan.find((p) => p.tataLetak === "samping")?.foto;
    const fotoBukti = pasangan.map((p) => p.foto).filter((f): f is BuktiItem => Boolean(f));

    return {
      transaksi: t,
      nomor,
      halamanBaru,
      pasangan,
      kotakUtama: utama,
      fotoDiKotak,
      fotoBukti: fotoDiKotak ? fotoBukti.filter((f) => f.id !== fotoDiKotak.id) : fotoBukti,
      lampiranPdf,
      keterangan: ket,
      kotakTambahan: tambahan,
      fotoPendukung: pendukung,
      perkiraanTinggiMm: tinggiBlok,
    };
  });
}

export function susunLaporanKegiatan(o: OpsiSusunanLaporan): SusunanLaporan {
  const { kegiatan } = o;
  const profil = profilUntukDokumen(o.profilPelapor, kegiatan);
  const trxKegiatan = transaksiKegiatan(o.transaksi, kegiatan, o.daftarKegiatan ?? [kegiatan]);
  const pengeluaran = urutkanPengeluaran(
    trxKegiatan.filter((t) => t.jenis === "pengeluaran" && t.kategori !== KATEGORI_PINDAH_DANA),
    o.urutanTransaksiIds ?? []
  );
  const nomorUrut = new Map<string, number>();
  pengeluaran.forEach((t, i) => nomorUrut.set(t.id, i + 1));
  const periode = `${formatTanggalIndo(kegiatan.tanggalMulai)} s.d. ${formatTanggalIndo(kegiatan.tanggalSelesai)}`;

  const penerimaanTrx = trxKegiatan
    .filter((t) => t.jenis === "pemasukan" && t.kategori !== KATEGORI_PINDAH_DANA)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));
  const penerimaan = penerimaanTrx.map((t, i) => barisTabel(t, `P${i + 1}`, profil.nama, kegiatan.nama));

  const perdiem = pengeluaran.filter((t) => t.kategori === KATEGORI_PERDIEM);
  const daftarPerdiem = perdiem.length > 0 ? susunDaftarPerdiem(perdiem, kegiatan, profil) : null;

  // Kelompok menurut urutan baku, lalu kategori lama yang tidak ada di daftar baku (supaya tidak ada pengeluaran yang hilang).
  const kategoriLain = [...new Set(pengeluaran.map((t) => t.kategori))].filter((k) => !KELOMPOK_DANA_KEGIATAN.includes(k));
  const semuaKategori = [...KELOMPOK_DANA_KEGIATAN, ...kategoriLain];
  const kelompok: KelompokLaporan[] = [];
  for (const kategori of semuaKategori) {
    const daftar = pengeluaran.filter((t) => t.kategori === kategori);
    if (daftar.length === 0) continue;
    const timesheet = kategori === KATEGORI_PERDIEM && daftarPerdiem;
    const untukBlok = timesheet ? daftar.filter(adaFoto) : daftar;
    if (timesheet && untukBlok.length === 0) continue;
    kelompok.push({
      nomor: kelompok.length + 1,
      kategori,
      judul: labelKategori(kategori),
      transaksi: daftar,
      subtotal: daftar.reduce((s, t) => s + t.jumlah, 0),
      tabel: timesheet ? null : daftar.map((t) => barisTabel(t, String(nomorUrut.get(t.id) ?? ""), profil.nama, kegiatan.nama)),
      blok: blokKelompok(untukBlok, nomorUrut, profil, !timesheet, untukBlok.length, o.ukuranFoto),
    });
  }

  const rental: RentalTimesheetLaporan[] = pengeluaran
    .filter((t) => t.kategori === "Rental Kendaraan" && (t.detailKegiatan?.rentalKendaraan?.timesheet?.length ?? 0) > 0)
    .map((t) => {
      const rk = t.detailKegiatan!.rentalKendaraan!;
      const baris = (rk.timesheet ?? []).map((r, i) => ({
        no: i + 1,
        tanggal: r.tanggal,
        lokasi: r.lokasiBasecampRute || "-",
        aktivitas: r.cakupanAktivitas || "-",
        jarakKm: r.jarakKm || 0,
      }));
      return {
        transaksi: t,
        judul: (rk.jenisMerk || "").toLowerCase().includes("motor") ? "TIMESHEET RENTAL MOTOR" : "TIMESHEET RENTAL MOBIL",
        info: `Kendaraan: ${rk.jenisMerk || "-"} · No. Polisi: ${rk.noPolisi || "-"} · Lokasi: ${kegiatan.lokasi} · Periode: ${formatTanggalIndo(rk.tanggalMulai)} s.d. ${formatTanggalIndo(rk.tanggalSelesai)}`,
        baris,
        totalKm: baris.reduce((s, r) => s + r.jarakKm, 0),
        namaPemilik: rk.namaPemilik || "Pengemudi",
        tanggalTtd: `${kegiatan.lokasi || "Lokasi"}, ${formatTanggalIndo(rk.tanggalSelesai || hariIni())}`,
      };
    });

  const justifikasi: JustifikasiLaporan[] = pengeluaran
    .filter((t) => t.detailKegiatan?.perluSuratJustifikasi)
    .map((t) => {
      const paramNarasi: ParamNarasiJustifikasi = {
        alasanSingkat: t.detailKegiatan?.alasanJustifikasi,
        jenisBukti: t.detailKegiatan?.jenisBukti,
        uraian: t.deskripsi,
        jumlah: t.jumlah,
        tanggal: t.tanggal,
        namaKegiatan: kegiatan.nama,
        lokasiKegiatan: kegiatan.lokasi,
        namaPelapor: profil.nama,
        jabatanPelapor: profil.jabatan,
        lembagaProyek: `${profil.lembaga} - ${profil.proyek}`,
      };
      return {
        transaksi: t,
        nomor: nomorUrut.get(t.id) ?? 1,
        jenisBukti: (t.detailKegiatan?.jenisBukti || "Bukti Pengeluaran").toUpperCase(),
        identitas: [
          { label: "Nama", nilai: profil.nama },
          { label: "Jabatan", nilai: profil.jabatan },
          { label: "Lembaga / Proyek", nilai: `${profil.lembaga} / ${profil.proyek}` },
          { label: "Nama Kegiatan", nilai: kegiatan.nama },
          { label: "Nomor Bukti Pengeluaran", nilai: `No. ${nomorUrut.get(t.id) ?? 1} (${t.deskripsi})` },
        ],
        paramNarasi,
        narasiBaku: narasiJustifikasiBaku(paramNarasi),
        tempatTanggal: `${kegiatan.lokasi || "Lokasi"}, ${formatTanggalIndo(t.tanggal || hariIni())}`,
      };
    });

  const rekap: BarisRekapLaporan[] = semuaKategori.map((kategori, i) => {
    const daftar = pengeluaran.filter((t) => t.kategori === kategori);
    return { nomor: i + 1, label: labelKategori(kategori), jumlahBukti: daftar.length, jumlah: daftar.reduce((s, t) => s + t.jumlah, 0) };
  });

  let daftarPeriksa: SusunanLaporan["daftarPeriksa"] = null;
  if (o.sertakanDaftarPeriksa ?? true) {
    daftarPeriksa = [];
    if (KETENTUAN_DANA_KEGIATAN["Umum"]?.butir?.length) daftarPeriksa.push({ judul: "Ketentuan Umum SPJ", butir: KETENTUAN_DANA_KEGIATAN["Umum"].butir });
    const dipakai = new Set(pengeluaran.map((t) => t.kategori));
    for (const kategori of KELOMPOK_DANA_KEGIATAN) {
      const butir = KETENTUAN_DANA_KEGIATAN[kategori]?.butir;
      if (dipakai.has(kategori) && butir && butir.length > 0) daftarPeriksa.push({ judul: `Ketentuan Khusus: ${labelKategori(kategori)}`, butir });
    }
  }

  return {
    kegiatan,
    profil,
    periode,
    kepalaHalaman: ["Laporan Keuangan Kegiatan", profil.nama.trim(), periode].filter(Boolean).join(" · "),
    identitas: [
      { label: "Nama Pelapor", nilai: profil.nama || "-" },
      { label: "Jabatan", nilai: profil.jabatan || "-" },
      { label: "Lembaga / Proyek", nilai: `${profil.lembaga || "-"} / ${profil.proyek || "-"}` },
      { label: "Lokasi Kegiatan", nilai: kegiatan.lokasi || "-" },
      { label: "Periode Kegiatan", nilai: periode },
    ],
    penerimaan,
    totalPenerimaan: penerimaanTrx.reduce((s, t) => s + t.jumlah, 0),
    daftarPerdiem,
    kelompok,
    rental,
    justifikasi,
    rekap,
    totalBukti: pengeluaran.length,
    totalPengeluaran: pengeluaran.reduce((s, t) => s + t.jumlah, 0),
    penyelesaian: hitungPenyelesaian(trxKegiatan),
    daftarPeriksa,
    pengeluaran,
    nomorUrut,
    transaksiKegiatan: trxKegiatan,
  };
}
