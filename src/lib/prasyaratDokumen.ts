import { DataKhususKegiatan } from "../types";
import { KATEGORI } from "./constants";
import { KETENTUAN_DANA_KEGIATAN } from "./ketentuanKegiatan";

/**
 * Pengisian pengeluaran Dana Kegiatan secara bertahap: satu pertanyaan per langkah, lalu daftar prasyarat
 * dokumen keuangan (SPJ) yang menunjukkan apa yang sudah dan belum lengkap. Aturan diambil dari
 * ketentuanKegiatan.ts; berkas ini hanya memutuskan langkah, isian wajib, dan saran.
 */

export type LangkahBertahap = "kegiatan" | "jenis" | "rincian" | "nominal" | "bukti" | "periksa";

export const URUTAN_LANGKAH: Array<{ kunci: LangkahBertahap; label: string }> = [
  { kunci: "kegiatan", label: "Kegiatan" },
  { kunci: "jenis", label: "Jenis" },
  { kunci: "rincian", label: "Rincian" },
  { kunci: "nominal", label: "Nominal" },
  { kunci: "bukti", label: "Bukti" },
  { kunci: "periksa", label: "Periksa" },
];

export function indeksLangkah(langkah: LangkahBertahap): number {
  return URUTAN_LANGKAH.findIndex((l) => l.kunci === langkah);
}

export function judulLangkah(langkah: LangkahBertahap, kategori: string): string {
  switch (langkah) {
    case "kegiatan":
      return "Untuk kegiatan apa?";
    case "jenis":
      return "Jenis pengeluarannya apa?";
    case "rincian":
      return `Rincian ${kategori || "pengeluaran"}`;
    case "nominal":
      return "Tanggal, uraian, dan jumlah";
    case "bukti":
      return "Bukti transaksi";
    case "periksa":
      return "Periksa kelengkapan lalu simpan";
  }
}

/* ---------- Transportasi: pilihan moda dan data sopir ---------- */

export const PILIHAN_MODA = ["Speedboat / Kapal", "Ojek", "Travel / Mobil sewa", "Bus / Angkutan umum", "Pesawat"];

/** Moda sewaan (travel, ojek, mobil, motor) wajib mencantumkan sopir dan nomor polisi; sama dengan cekKetentuanTransaksi. */
export function modaPerluDataSopir(moda?: string): boolean {
  return Boolean(moda && /travel|ojek|motor|mobil/i.test(moda));
}

/** Jenis bukti yang paling cocok untuk kategori ini, untuk diberi tanda "Disarankan". */
export function saranJenisBukti(kategori: string, detail: DataKhususKegiatan): string {
  if (kategori === "BBM") return "Struk thermal (minimarket/SPBU)";
  if (kategori === "Transportasi") {
    const moda = detail.transportasi?.moda || "";
    if (/pesawat/i.test(moda)) return "Tiket pesawat/e-ticket";
    if (/speedboat|kapal|bus|angkutan/i.test(moda)) return "Tiket";
  }
  return "Kuitansi";
}

/* ---------- Isian dan pemeriksaannya ---------- */

export interface IsianBertahap {
  kegiatanId: string;
  kategori: string;
  tanggal: string;
  deskripsi: string;
  jumlah: number;
  detail: DataKhususKegiatan;
  jumlahBukti: number;
  /** Kategori tiap foto pendukung ("barang" | "kendaraan" | "kegiatan" | undefined). */
  kategoriFotoPendukung: Array<string | undefined>;
  /** Pengisian perdiem sekaligus: null bila tidak dipakai. */
  perdiemRentang: { hari: number; galat?: string } | null;
}

/** Galat yang menahan tombol "Lanjut" di sebuah langkah; null bila boleh lanjut. */
export function galatLangkah(langkah: LangkahBertahap, isian: IsianBertahap): string | null {
  const d = isian.detail;
  switch (langkah) {
    case "jenis":
      return KATEGORI["Dana Kegiatan"].pengeluaran.includes(isian.kategori) ? null : "Pilih jenis pengeluaran.";
    case "rincian": {
      if (isian.kategori === "Konsumsi" && d.konsumsi?.kudapanPerjalanan && !(d.penerimaManfaat?.length ?? 0)) {
        return "Catat minimal satu staf penerima manfaat kudapan.";
      }
      if (isian.kategori !== "Perdiem") return null;
      const tarif = Number(d.perdiem?.tarifPerHari) || 0;
      if (tarif <= 0) return "Isi tarif uang harian per hari.";
      if (isian.perdiemRentang) {
        if (isian.perdiemRentang.galat) return isian.perdiemRentang.galat;
        return isian.perdiemRentang.hari > 0 ? null : "Tidak ada hari yang dihitung dalam rentang ini.";
      }
      return Number(d.perdiem?.jumlahHari) > 0 ? null : "Isi jumlah hari uang harian.";
    }
    case "nominal": {
      const kurang: string[] = [];
      if (!isian.perdiemRentang && !isian.tanggal) kurang.push("tanggal");
      if (!isian.deskripsi.trim()) kurang.push("uraian");
      if (!(isian.jumlah > 0)) kurang.push("jumlah");
      return kurang.length ? `Lengkapi ${kurang.join(", ")}.` : null;
    }
    case "bukti":
      return d.jenisBukti === "Bukti tidak lengkap" && !d.alasanJustifikasi?.trim()
        ? "Bukti tidak lengkap wajib disertai alasan surat justifikasi."
        : null;
    default:
      return null;
  }
}

export interface Prasyarat {
  kunci: string;
  teks: string;
  terpenuhi: boolean;
  tingkat: "wajib" | "dianjurkan";
  /** Langkah tempat prasyarat ini dilengkapi. */
  langkah: LangkahBertahap;
}

const terisi = (v: unknown) => (typeof v === "number" ? Number.isFinite(v) && v > 0 : Boolean(String(v ?? "").trim()));

/** Prasyarat dokumen keuangan untuk isian ini, urut langkah. */
export function daftarPrasyarat(isian: IsianBertahap): Prasyarat[] {
  const { kategori, detail: d } = isian;
  const hasil: Prasyarat[] = [];
  const tambah = (kunci: string, teks: string, terpenuhi: boolean, tingkat: Prasyarat["tingkat"], langkah: LangkahBertahap) =>
    hasil.push({ kunci, teks, terpenuhi, tingkat, langkah });
  const fotoKategori = (k: string) => isian.kategoriFotoPendukung.includes(k);

  tambah("kegiatan", "Kegiatan lapangan dipilih", terisi(isian.kegiatanId), "wajib", "kegiatan");

  switch (kategori) {
    case "Transportasi": {
      const t = d.transportasi || {};
      tambah("rute", "Rute (dari – ke) dan moda", terisi(t.dari) && terisi(t.ke) && terisi(t.moda), "wajib", "rincian");
      if (modaPerluDataSopir(t.moda)) {
        tambah("sopir", "Nama sopir, no. telp, dan no. polisi kendaraan", terisi(t.namaSopir) && terisi(t.noTelpSopir) && terisi(t.noPolisi), "wajib", "rincian");
      }
      break;
    }
    case "Rental Kendaraan": {
      const r = d.rentalKendaraan || {};
      tambah("kendaraan", "No. polisi dan nama pemilik kendaraan", terisi(r.noPolisi) && terisi(r.namaPemilik), "wajib", "rincian");
      tambah("tgl-sewa", "Tanggal mulai dan selesai sewa", terisi(r.tanggalMulai) && terisi(r.tanggalSelesai), "wajib", "rincian");
      tambah("timesheet", "Timesheet harian (minimal 1 baris)", (r.timesheet || []).length > 0, "wajib", "rincian");
      break;
    }
    case "BBM": {
      const b = d.bbm || {};
      tambah("km", "KM spidometer saat isi dan jarak tempuh", terisi(b.kmSaatIsi) && terisi(b.jarakTempuh), "wajib", "rincian");
      tambah("rute-bbm", "Rute perjalanan (dari – ke)", terisi(b.dari) && terisi(b.ke), "wajib", "rincian");
      tambah("nopol-bbm", "No. polisi kendaraan", terisi(b.noPolisi), "wajib", "rincian");
      break;
    }
    case "Akomodasi": {
      const a = d.akomodasi || {};
      tambah("penginapan", "Nama penginapan dan nama pemilik", terisi(a.lokasi) && terisi(a.namaPemilik), "wajib", "rincian");
      tambah("tgl-inap", "Tanggal masuk dan keluar", terisi(a.tanggalMasuk) && terisi(a.tanggalKeluar), "wajib", "rincian");
      tambah("telp-inap", "No. telp pemilik", terisi(a.noTelp), "dianjurkan", "rincian");
      break;
    }
    case "Konsumsi": {
      const k = d.konsumsi || {};
      if (k.kudapanPerjalanan) {
        tambah("penerima-kudapan", "Penerima manfaat kudapan perjalanan (minimal 1 staf)", (d.penerimaManfaat?.length ?? 0) > 0, "wajib", "rincian");
      } else {
        tambah("peserta", "Jumlah peserta (sesuai daftar hadir)", terisi(k.jumlahPeserta), "wajib", "rincian");
      }
      tambah("penyedia", "Penyedia dan lokasi konsumsi", terisi(k.penyedia) && terisi(k.lokasi), "dianjurkan", "rincian");
      break;
    }
    case "Honorarium & Ganti Hari": {
      const h = d.honorarium || {};
      tambah("penerima", "Nama penerima honor", terisi(h.namaPenerima), "wajib", "rincian");
      tambah("absen", "Nomor urut absen", terisi(h.nomorAbsen), "wajib", "rincian");
      break;
    }
    case "Perdiem": {
      const p = d.perdiem || {};
      const hari = isian.perdiemRentang ? isian.perdiemRentang.hari : Number(p.jumlahHari) || 0;
      tambah("perdiem", "Tarif per hari dan jumlah hari uang harian", terisi(p.tarifPerHari) && hari > 0, "wajib", "rincian");
      break;
    }
    case "Pengadaan Barang & Perlengkapan":
      tambah("rincian-barang", "Rincian barang (banyaknya × harga satuan)", (d.rincian?.total ?? 0) > 0, "wajib", "rincian");
      break;
  }

  tambah(
    "inti",
    "Tanggal, uraian, dan jumlah",
    (Boolean(isian.perdiemRentang) || terisi(isian.tanggal)) && terisi(isian.deskripsi) && isian.jumlah > 0,
    "wajib",
    "nominal"
  );
  tambah("keterangan", "Keterangan untuk laporan SPJ", terisi(d.keteranganLaporan), "dianjurkan", "nominal");

  if (kategori !== "Perdiem") {
    if (d.jenisBukti === "Bukti tidak lengkap") {
      tambah("justifikasi", "Alasan surat justifikasi (bukti tidak lengkap)", terisi(d.alasanJustifikasi), "wajib", "bukti");
    }
    if (kategori !== "Honorarium & Ganti Hari") {
      tambah("penjual", "Nama penjual / penyedia di bukti", terisi(d.namaPenjualPenyedia), "dianjurkan", "bukti");
    }
    tambah("foto-bukti", "Foto nota / kuitansi dilampirkan", isian.jumlahBukti > 0, "dianjurkan", "bukti");
    if (kategori === "Konsumsi") tambah("foto-kegiatan", "Foto dokumentasi kegiatan", fotoKategori("kegiatan"), "dianjurkan", "bukti");
    if (kategori === "Pengadaan Barang & Perlengkapan") tambah("foto-barang", "Foto barang", fotoKategori("barang"), "dianjurkan", "bukti");
    if (kategori === "Rental Kendaraan") tambah("foto-kendaraan", "Foto kendaraan", fotoKategori("kendaraan"), "dianjurkan", "bukti");
  }

  return hasil;
}

/** Dokumen fisik SPJ yang perlu disiapkan untuk kategori ini (dari ketentuan lembaga). */
export function dokumenFisik(kategori: string): string[] {
  return KETENTUAN_DANA_KEGIATAN[kategori]?.butir ?? [];
}

/** Saran uraian dari rincian yang sudah diisi; kosong bila tidak ada yang bisa disusun. */
export function saranUraian(kategori: string, d: DataKhususKegiatan): string {
  const gabung = (...bagian: Array<string | undefined>) => bagian.filter((x) => x && x.trim()).join(" ").trim();
  const rute = (dari?: string, ke?: string) => (dari && ke ? `${dari} – ${ke}` : dari || ke || "");
  switch (kategori) {
    case "Transportasi": {
      const t = d.transportasi || {};
      const r = rute(t.dari, t.ke);
      return r || t.moda ? gabung("Transportasi", r, t.moda ? `(${t.moda})` : "") : "Transportasi";
    }
    case "Rental Kendaraan": {
      const r = d.rentalKendaraan || {};
      return gabung("Sewa", r.jenisMerk || "kendaraan", r.noPolisi);
    }
    case "BBM": {
      const b = d.bbm || {};
      return gabung("BBM", rute(b.dari, b.ke));
    }
    case "Akomodasi":
      return gabung("Penginapan", d.akomodasi?.lokasi);
    case "Konsumsi": {
      const k = d.konsumsi || {};
      if (k.kudapanPerjalanan) {
        const n = d.penerimaManfaat?.length ?? 0;
        return gabung("Kudapan/Snack Perjalanan", n ? `(${n} orang)` : "");
      }
      return gabung("Konsumsi", k.lokasi, k.jumlahPeserta ? `(${k.jumlahPeserta} orang)` : "");
    }
    case "Honorarium & Ganti Hari":
      return gabung("Honorarium", d.honorarium?.namaPenerima);
    case "Perdiem":
      return gabung("Uang harian", d.perdiem?.keterangan || "lapangan");
    default:
      return "";
  }
}
