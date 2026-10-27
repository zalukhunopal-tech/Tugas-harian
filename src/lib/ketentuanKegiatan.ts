import { Transaksi, DataKegiatan } from "../types";

export interface KetentuanKelompok {
  kategori: string;
  judul: string;
  ringkasan: string;
  butir: string[];
}

export const KETENTUAN_DANA_KEGIATAN: Record<string, KetentuanKelompok> = {
  Umum: {
    kategori: "Umum",
    judul: "Ketentuan Umum Pertanggungjawaban Fisik SPJ",
    ringkasan: "Kuitansi asli tanpa coretan, kelengkapan administrasi, dan batas waktu 14 hari.",
    butir: [
      "Kuitansi asli wajib bersih tanpa coretan atau tip-ex.",
      "Mencantumkan rincian jumlah barang/jasa, harga satuan, tanggal transaksi, stempel basah/resmi, alamat jelas, nama penerima/toko, dan nomor telepon.",
      "Struk thermal yang mudah pudar (seperti Alfamart, Indomaret, SPBU) wajib segera difotokopi dan dilampirkan bersama struk aslinya.",
      "Invoice atau tagihan resmi wajib tetap disertai tanda terima kuitansi pembayaran.",
      "Tambahan pembelian di luar nota awal harus dibuatkan kuitansi/nota baru terpisah.",
      "Transaksi mulai Rp5.000.000 wajib dibubuhi materai 10.000 dan melampirkan minimal 3 penawaran harga perbandingan.",
      "Tidak diperbolehkan klaim untuk kebutuhan pribadi (termasuk obat-obatan pribadi kecuali obat P3K kegiatan).",
      "Urutan susunan kuitansi fisik harus persis sama dengan urutan input sistem/WiMIS.",
      "Laporan fisik SPJ diserahkan paling lambat 14 hari kalender setelah tanggal kegiatan selesai.",
    ],
  },
  Transportasi: {
    kategori: "Transportasi",
    judul: "Ketentuan Bukti Transportasi",
    ringkasan: "Tiket asli, kelengkapan travel/ojek, tol/parkir, dan boarding pass pesawat.",
    butir: [
      "Tiket perjalanan fisik asli wajib dilampirkan.",
      "Untuk sewa travel atau ojek: sertakan struk/kuitansi dengan nomor polisi kendaraan, nama lengkap dan nomor telepon pengemudi, serta fotokopi STNK.",
      "Karcis retribusi jalan tol dan bukti parkir wajib dilampirkan asli.",
      "Penerbangan pesawat: wajib melampirkan kuitansi agen/travel asli, e-ticket (bila pembelian online), dan seluruh boarding pass fisik asli.",
    ],
  },
  "Rental Kendaraan": {
    kategori: "Rental Kendaraan",
    judul: "Ketentuan Rental Kendaraan",
    ringkasan: "Kuitansi/nota sewa berstempel, fotokopi STNK/SIM/KTP, formulir peminjaman R4, dan timesheet.",
    butir: [
      "Kuitansi/nota sewa kendaraan lengkap dengan alamat, nomor telepon, dan stempel penyedia sewa.",
      "Melampirkan fotokopi STNK kendaraan, SIM pengemudi, dan KTP penerima pembayaran.",
      "Wajib mengisi form peminjaman kendaraan roda 4 dan timesheet harian aktivitas.",
      "Karcis tol dan parkir selama masa sewa dilampirkan.",
      "Pajak sewa gross-up (default 2% atau sesuai ketentuan potongan pph).",
    ],
  },
  BBM: {
    kategori: "BBM",
    judul: "Ketentuan Pembelian BBM",
    ringkasan: "Pencatatan KM spidometer, rute perjalanan, dan struk/kuitansi nomor polisi.",
    butir: [
      "Wajib mencatat angka KM spidometer saat pengisian dan estimasi jarak tempuh perjalanan.",
      "Mencantumkan rute perjalanan (dari - ke).",
      "Struk/kuitansi asli wajib memuat nama SPBU/penjual, lokasi, rincian liter × harga, nomor telepon, dan nomor polisi kendaraan.",
      "Struk SPBU thermal wajib segera difotokopi.",
    ],
  },
  Akomodasi: {
    kategori: "Akomodasi",
    judul: "Ketentuan Akomodasi & Penginapan",
    ringkasan: "Kuitansi penginapan/pemilik rumah, tanggal check-in/out, tanda tangan, dan KTP pemilik.",
    butir: [
      "Kuitansi mencantumkan nama lokasi/penginapan, tanggal masuk dan keluar (lama menginap).",
      "Nama jelas dan tanda tangan pemilik/pengelola penginapan atau pemilik rumah singgah.",
      "Nomor telepon aktif pemilik dan lampiran fotokopi KTP pemilik (terutama penginapan lokal/warga).",
    ],
  },
  Konsumsi: {
    kategori: "Konsumsi",
    judul: "Ketentuan Konsumsi Kegiatan",
    ringkasan: "Kuitansi rincian konsumsi, notulensi rapat, daftar hadir asli, dan dokumentasi foto.",
    butir: [
      "Kuitansi mencantumkan tanggal, nama penyedia/warung, nomor telepon, rincian (jumlah porsi, harga satuan, total), dan lokasi.",
      "Wajib melampirkan notulensi atau rangkuman hasil pertemuan/rapat.",
      "Melampirkan daftar absensi/hadir asli bertanda tangan (bila porsi konsumsi melebihi daftar hadir, wajib buat surat penjelasan).",
      "Melampirkan foto dokumentasi kegiatan/konsumsi.",
      "Tidak diperkenankan klaim minuman penambah energi (energy drinks) dan suplemen/vitamin pribadi.",
    ],
  },
  "Honorarium & Ganti Hari": {
    kategori: "Honorarium & Ganti Hari",
    judul: "Ketentuan Honorarium & Ganti Hari Kerja",
    ringkasan: "Surat penunjukan/kontrak, CV, timesheet, KTP, NPWP, nomor absen, dan potongan pajak.",
    butir: [
      "Melampirkan surat penunjukan/tugas, kontrak perjanjian kerja, CV/biodata singkat penerima, timesheet kerja, dan bukti laporan/materi.",
      "Melampirkan fotokopi KTP dan kartu NPWP penerima honor.",
      "Nomor urut absen harus dicantumkan di kuitansi ganti hari kerja.",
      "Tanda tangan penerima pada daftar absensi/hadir harus identik dengan tanda tangan di kuitansi penerimaan.",
      "Perhitungan pajak: Bukan PNS > Rp450.000 dikenakan (Total ÷ 2) × 5% (NPWP) atau 6% (tanpa NPWP); PNS dikenakan seluruh honor × 5% atau 6%.",
    ],
  },
  "Pengadaan Barang & Perlengkapan": {
    kategori: "Pengadaan Barang & Perlengkapan",
    judul: "Ketentuan Pengadaan Barang & ATK/Perlengkapan",
    ringkasan: "Pembelian via administrasi/staf persetujuan ADM, rincian harga satuan, dan tanda terima barang.",
    butir: [
      "Pembelian diutamakan lewat unit administrasi; bila dibeli staf lapangan, wajib melampirkan persetujuan ADM/koordinator.",
      "Rincian nama barang, spesifikasi, dan harga satuan jelas.",
      "Wajib melampirkan formulir tanda terima penyerahan barang bila barang diserahkan ke penerima manfaat/kantor.",
    ],
  },
  "Komunikasi, Listrik & Kurir": {
    kategori: "Komunikasi, Listrik & Kurir",
    judul: "Ketentuan Komunikasi, Listrik & Jasa Kurir",
    ringkasan: "Tanggal, bukti pemakaian billing pulsa/internet, tagihan token/PLN, dan bukti resi kurir asli.",
    butir: [
      "Mencantumkan tanggal transaksi pembelian pulsa, paket data, voucher listrik, atau pengiriman paket.",
      "Melampirkan bukti billing/pemakaian resmi, struk PLN token/tagihan, atau resi pengiriman kurir fisik asli.",
      "Kuitansi asli dari penyedia jasa.",
    ],
  },
  Perdiem: {
    kategori: "Perdiem",
    judul: "Ketentuan Uang Harian (Per Diem)",
    ringkasan: "Sesuai TOR kegiatan; bila terdapat perubahan wajib dijelaskan di BTOR.",
    butir: [
      "Perhitungan uang harian harus sesuai dengan plafon dan alokasi hari pada TOR (Term of Reference) yang disetujui.",
      "Bila terjadi kelebihan hari atau perbedaan nominal, wajib dijelaskan secara terperinci di dalam dokumen BTOR (Back to Office Report).",
    ],
  },
  "Lain-lain": {
    kategori: "Lain-lain",
    judul: "Ketentuan Biaya Lain-lain / Administrasi",
    ringkasan: "Surat Tugas disetujui sesuai TOR, BTOR dengan foto, dan justifikasi over budget.",
    butir: [
      "Surat Tugas (ST) resmi yang telah disetujui koordinator/pimpinan dan sesuai TOR.",
      "BTOR (Back to Office Report) yang menjawab butir TOR, per tanggal kegiatan, dilengkapi dokumentasi foto.",
      "Bila terjadi pengeluaran melebihi anggaran (over budget), wajib menyertakan surat penjelasan alasan kebutuhan kegiatan lapangan.",
    ],
  },
};

export interface KetentuanPeringatan {
  tipe: "info" | "peringatan" | "perhatian";
  pesan: string;
  rekomendasi?: string;
}

/**
 * Hitung batas waktu penyerahan laporan fisik (tanggal selesai + 14 hari)
 */
export function hitungBatasLaporanFisik(tanggalSelesai: string): {
  tanggalBatas: string;
  formatTeks: string;
  hariTersisa: number;
} {
  try {
    const parts = tanggalSelesai.split("-").map((p) => parseInt(p, 10));
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + 14);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      const tanggalBatas = `${y}-${m}-${dt}`;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      const diffMs = d.getTime() - now.getTime();
      const hariTersisa = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const bulanNama = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ][d.getMonth()];

      const formatTeks = `${d.getDate()} ${bulanNama} ${d.getFullYear()}`;

      return { tanggalBatas, formatTeks, hariTersisa };
    }
  } catch (err) {
    console.error("Gagal hitung batas laporan fisik:", err);
  }

  return { tanggalBatas: "", formatTeks: "-", hariTersisa: 0 };
}

/**
 * Menghasilkan daftar peringatan ramah (bukan larangan) berdasarkan ketentuan SPJ
 */
export function cekKetentuanTransaksi(
  trx: Partial<Transaksi>,
  kegiatan?: DataKegiatan
): KetentuanPeringatan[] {
  const hasil: KetentuanPeringatan[] = [];
  const dana = trx.dana || "Dana Kegiatan";
  if (dana !== "Dana Kegiatan") return hasil;

  const jumlah = Number(trx.jumlah || 0);
  const detail = trx.detailKegiatan;
  const jenisBukti = detail?.jenisBukti;
  const kategori = trx.kategori || "";

  // 1. Cek Bukti Tidak Lengkap
  if (jenisBukti === "Bukti tidak lengkap") {
    if (!detail?.perluSuratJustifikasi || !detail?.alasanJustifikasi?.trim()) {
      hasil.push({
        tipe: "peringatan",
        pesan: "Jenis bukti 'Bukti tidak lengkap' mewajibkan Surat Justifikasi dan alasan singkat.",
        rekomendasi: "Aktifkan opsi 'Perlu surat justifikasi' dan tuliskan alasan singkatnya.",
      });
    }
  }

  // 2. Cek Struk Thermal
  if (jenisBukti === "Struk thermal (minimarket/SPBU)") {
    hasil.push({
      tipe: "info",
      pesan: "Struk thermal mudah memudar dan hilang tulisannya.",
      rekomendasi: "Segera fotokopi struk dan simpan hasil fotokopi bersama struk aslinya untuk SPJ fisik.",
    });
  }

  // 3. Batas Rp5.000.000: Materai 10.000 & 3 Penawaran
  if (jumlah >= 5000000) {
    hasil.push({
      tipe: "perhatian",
      pesan: "Transaksi ≥ Rp5.000.000 wajib membubuhkan Materai 10.000 dan lampiran minimal 3 penawaran harga pembanding.",
      rekomendasi: "Siapkan 3 dokumen penawaran harga pembanding sebelum penyerahan laporan fisik.",
    });
  }

  // 4. Cek Tiket Pesawat
  if (jenisBukti === "Tiket pesawat/e-ticket") {
    hasil.push({
      tipe: "info",
      pesan: "Pertanggungjawaban tiket pesawat wajib melampirkan e-ticket/kuitansi agen DAN seluruh boarding pass fisik asli.",
      rekomendasi: "Pastikan boarding pass tidak dibuang setelah mendarat.",
    });
  }

  // 5. Cek Kategori Spesifik
  if (kategori === "Transportasi") {
    const t = detail?.transportasi;
    if (t?.moda && /travel|ojek|motor|mobil/i.test(t.moda)) {
      if (!t.noPolisi || !t.namaSopir) {
        hasil.push({
          tipe: "peringatan",
          pesan: "Untuk moda sewa travel/ojek, ketentuan SPJ mewajibkan nomor polisi, nama sopir, no. telp, dan fotokopi STNK.",
          rekomendasi: "Lengkapi data nomor polisi dan kontak sopir.",
        });
      }
    }
  }

  if (kategori === "Rental Kendaraan") {
    const r = detail?.rentalKendaraan;
    if (!r?.noPolisi || !r?.namaPemilik) {
      hasil.push({
        tipe: "peringatan",
        pesan: "Rental kendaraan wajib melampirkan nomor polisi, identitas pemilik, fotokopi STNK, SIM & KTP penerima sewa.",
      });
    }
    if (!r?.timesheet || r.timesheet.length === 0) {
      hasil.push({
        tipe: "info",
        pesan: "SPJ rental kendaraan wajib dilengkapi lembar timesheet harian aktivitas & rute lapangan.",
      });
    }
  }

  if (kategori === "BBM") {
    const b = detail?.bbm;
    if (b?.kmSaatIsi === undefined || b?.jarakTempuh === undefined) {
      hasil.push({
        tipe: "peringatan",
        pesan: "Pertanggungjawaban BBM mewajibkan catatan angka KM saat isi, jarak tempuh, rute (dari - ke), dan no. polisi.",
        rekomendasi: "Catat KM spidometer kendaraan dan estimasi jarak perjalanan.",
      });
    }
  }

  if (kategori === "Akomodasi") {
    const a = detail?.akomodasi;
    if (!a?.lokasi || !a?.namaPemilik) {
      hasil.push({
        tipe: "peringatan",
        pesan: "Kuitansi akomodasi/rumah singgah wajib mencantumkan lokasi, tanggal masuk-keluar, nama pemilik & nomor kontak.",
      });
    }
  }

  if (kategori === "Konsumsi") {
    const k = detail?.konsumsi;
    hasil.push({
      tipe: "info",
      pesan: "Konsumsi kegiatan wajib dilampirkan notulensi rapat, daftar hadir bertanda tangan asli, dan foto dokumentasi (bukan minuman energi/vitamin).",
    });
    if (!k?.jumlahPeserta) {
      hasil.push({
        tipe: "peringatan",
        pesan: "Jumlah peserta konsumsi sebaiknya diisi agar sesuai dengan daftar absensi kehadiran.",
      });
    }
  }

  if (kategori === "Honorarium & Ganti Hari") {
    const h = detail?.honorarium;
    hasil.push({
      tipe: "info",
      pesan: "Honorarium/ganti hari wajib melampirkan surat penunjukan/kontrak, CV/biodata singkat, timesheet, fotokopi KTP & NPWP, serta nomor urut absensi.",
    });
    if (h && !h.namaPenerima) {
      hasil.push({
        tipe: "peringatan",
        pesan: "Nama penerima honor belum dicantumkan.",
      });
    }
  }

  // 6. Batas Laporan Fisik bila terhubung ke kegiatan
  if (kegiatan?.tanggalSelesai) {
    const batas = hitungBatasLaporanFisik(kegiatan.tanggalSelesai);
    if (batas.hariTersisa < 0) {
      hasil.push({
        tipe: "perhatian",
        pesan: `Batas penyerahan fisik SPJ (${batas.formatTeks}) telah terlewati ${Math.abs(batas.hariTersisa)} hari yang lalu.`,
        rekomendasi: "Segera selesaikan dan serahkan berkas fisik ke koordinator/administrasi.",
      });
    } else if (batas.hariTersisa <= 3) {
      hasil.push({
        tipe: "peringatan",
        pesan: `Tersisa ${batas.hariTersisa} hari lagi menuju batas penyerahan fisik SPJ (${batas.formatTeks}).`,
      });
    }
  }

  return hasil;
}
