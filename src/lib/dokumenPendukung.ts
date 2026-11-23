import type { DataKhususKegiatan, DokumenPendukungItem, JenisDokumenPendukung } from "../types";

/**
 * Spesifikasi dokumen pendukung klaim SPJ (mengacu pada 17 poin Kelengkapan Pelaporan Keuangan).
 * Menentukan ukuran fisik standar (mm), posisi di laporan (bersebelahan space bukti fisik untuk kartu
 * seperti KTP/NPWP/STNK/SIM, atau satu lembar di bawahnya untuk dokumen lebar seperti E-Ticket/Boarding Pass),
 * dan slot upload kontekstual per kategori transaksi.
 */

export interface SpecDokumenPendukung {
  jenis: JenisDokumenPendukung;
  labelBaku: string;
  ikon: string;
  /** "samping": tampil bersebelahan space tempel bukti fisik (kartu/ringkas); "bawah": satu lembar di bawah space bukti fisik */
  posisiLaporan: "samping" | "bawah";
  /** Ukuran fisik cetak acuan dalam milimeter (disesuaikan rasio gambar bila ada) */
  lebarMm: number;
  tinggiMm: number;
  ringkasan: string;
}

export const SPEC_DOKUMEN_PENDUKUNG: Record<JenisDokumenPendukung, SpecDokumenPendukung> = {
  ktp: {
    jenis: "ktp",
    labelBaku: "KTP",
    ikon: "🪪",
    posisiLaporan: "samping",
    lebarMm: 85.6,
    tinggiMm: 54,
    ringkasan: "Ukuran kartu KTP standar (85,6 × 54 mm), dicetak bersebelahan dengan space tempel bukti transaksi.",
  },
  npwp: {
    jenis: "npwp",
    labelBaku: "NPWP",
    ikon: "💳",
    posisiLaporan: "samping",
    lebarMm: 85.6,
    tinggiMm: 54,
    ringkasan: "Kartu NPWP penerima honor/ganti hari (85,6 × 54 mm), dicetak bersebelahan dengan space tempel kuitansi.",
  },
  sim: {
    jenis: "sim",
    labelBaku: "SIM Pengemudi / Penyewa",
    ikon: "🪪",
    posisiLaporan: "samping",
    lebarMm: 85.6,
    tinggiMm: 54,
    ringkasan: "Kartu SIM penyewa/pengemudi (85,6 × 54 mm), satu lembar bersebelahan dengan bukti bayar.",
  },
  stnk: {
    jenis: "stnk",
    labelBaku: "STNK Kendaraan",
    ikon: "📄",
    posisiLaporan: "samping",
    lebarMm: 85,
    tinggiMm: 60,
    ringkasan: "STNK kendaraan rental/travel/ojek, dicetak proporsional satu lembar bersama bukti bayar.",
  },
  karcis_tol_parkir: {
    jenis: "karcis_tol_parkir",
    labelBaku: "Karcis Tol / Parkir",
    ikon: "🛣️",
    posisiLaporan: "samping",
    lebarMm: 78,
    tinggiMm: 55,
    ringkasan: "Karcis tol atau parkir selama perjalanan/sewa.",
  },
  billing_resi: {
    jenis: "billing_resi",
    labelBaku: "Billing Telpon / Tagihan PLN / Resi Kurir",
    ikon: "🧾",
    posisiLaporan: "samping",
    lebarMm: 85,
    tinggiMm: 85,
    ringkasan: "Detail pemakaian telpon, tagihan PLN, atau resi kurir satu lembar bersama bukti bayar.",
  },
  fotokopi_struk_thermal: {
    jenis: "fotokopi_struk_thermal",
    labelBaku: "Fotokopi Struk Thermal",
    ikon: "🧾",
    posisiLaporan: "samping",
    lebarMm: 80,
    tinggiMm: 110,
    ringkasan: "Salinan/fotokopi struk thermal (Alfamart/Indomaret/SPBU) yang mudah pudar.",
  },
  hasil_pcr_antigen: {
    jenis: "hasil_pcr_antigen",
    labelBaku: "Hasil Test PCR / Antigen",
    ikon: "🧪",
    posisiLaporan: "samping",
    lebarMm: 85,
    tinggiMm: 85,
    ringkasan: "Hasil tes PCR/Antigen (cetak/foto/tangkapan layar PeduliLindungi).",
  },
  eticket: {
    jenis: "eticket",
    labelBaku: "E-Ticket / Dokumen Tiket Pesawat",
    ikon: "✈️",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 82,
    ringkasan: "E-ticket penerbangan, satu lembar bersama bukti bayar dan boarding pass.",
  },
  boarding_pass: {
    jenis: "boarding_pass",
    labelBaku: "Boarding Pass Pesawat",
    ikon: "🎫",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 65,
    ringkasan: "Boarding pass penerbangan (scan/foto), satu lembar bersama tiket dan bukti bayar.",
  },
  kontrak_sewa: {
    jenis: "kontrak_sewa",
    labelBaku: "Kontrak Sewa Kendaraan (>7 hari)",
    ikon: "📜",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 105,
    ringkasan: "Scan Surat Perjanjian Sewa Kendaraan Bermotor bertanda tangan (wajib bila sewa > 7 hari).",
  },
  form_peminjaman_r4: {
    jenis: "form_peminjaman_r4",
    labelBaku: "Form Peminjaman Kendaraan Roda 4",
    ikon: "📋",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 95,
    ringkasan: "Formulir peminjaman kendaraan roda 4 sesuai ketentuan lembaga.",
  },
  surat_penunjukan: {
    jenis: "surat_penunjukan",
    labelBaku: "Surat Penunjukan / Kontrak & CV",
    ikon: "📝",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 95,
    ringkasan: "Surat penunjukan narasumber/panitia, kontrak, CV, atau materi/laporan.",
  },
  absensi: {
    jenis: "absensi",
    labelBaku: "Daftar Absensi / Hadir Asli",
    ikon: "📋",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 95,
    ringkasan: "Daftar hadir peserta/penerima ganti hari bertanda tangan konsisten dengan kuitansi.",
  },
  notulensi: {
    jenis: "notulensi",
    labelBaku: "Notulensi / Rangkuman Rapat",
    ikon: "🗒️",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 95,
    ringkasan: "Notulensi atau rangkuman rapat/diskusi/pertemuan untuk klaim konsumsi.",
  },
  persetujuan_adm: {
    jenis: "persetujuan_adm",
    labelBaku: "Persetujuan ADM / Koordinator",
    ikon: "✅",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 90,
    ringkasan: "Persetujuan ADM/Koordinator untuk pengadaan barang oleh staf atau di luar ToR.",
  },
  tanda_terima_barang: {
    jenis: "tanda_terima_barang",
    labelBaku: "Form Tanda Terima Barang / Seminar KIT",
    ikon: "📦",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 90,
    ringkasan: "Form tanda terima penyerahan perlengkapan/barang bertanda tangan.",
  },
  penawaran_3: {
    jenis: "penawaran_3",
    labelBaku: "3 Penawaran Harga / Daftar Pengadaan",
    ikon: "📊",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 95,
    ringkasan: "Kelengkapan 3 penawaran pembanding (wajib untuk transaksi ≥ Rp5.000.000).",
  },
  surat_penjelasan: {
    jenis: "surat_penjelasan",
    labelBaku: "Surat Penjelasan (Over Budget / Selisih Absen)",
    ikon: "📄",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 90,
    ringkasan: "Surat penjelasan bila konsumsi melebihi daftar hadir atau transaksi over budget.",
  },
  lainnya: {
    jenis: "lainnya",
    labelBaku: "Dokumen Pendukung Lainnya",
    ikon: "📎",
    posisiLaporan: "bawah",
    lebarMm: 168,
    tinggiMm: 90,
    ringkasan: "Lampiran dokumen pendukung tambahan untuk klaim keuangan.",
  },
};

export interface SlotDokumenPendukung {
  jenis: JenisDokumenPendukung;
  label: string;
  ikon: string;
  wajib: boolean;
  keterangan: string;
}

export function adalahTiketPesawat(kategori: string, detail?: DataKhususKegiatan): boolean {
  const moda = (detail?.transportasi?.moda || "").toLowerCase();
  const jenis = (detail?.jenisBukti || "").toLowerCase();
  return (kategori === "Transportasi" && moda.includes("pesawat")) || jenis.includes("pesawat") || jenis.includes("e-ticket");
}

export function adalahRentalLebih7Hari(kategori: string, detail?: DataKhususKegiatan): boolean {
  if (kategori !== "Rental Kendaraan") return false;
  const r = detail?.rentalKendaraan;
  return Boolean((r?.jumlahHari ?? 0) > 7 || r?.perluKontrakSewa);
}

export function adalahRentalMotor(detail?: DataKhususKegiatan): boolean {
  const merk = (detail?.rentalKendaraan?.jenisMerk || "").toLowerCase();
  return /motor|honda|yamaha|suzuki|kawasaki|klx|crf|beat|vario|scoopy|nmax|pcx|supra|revo|vixion|cb150|trail/i.test(merk);
}

/**
 * Mengembalikan daftar slot upload dokumen pendukung yang relevan untuk transaksi SPJ ini
 * sesuai aturan 17 poin Kelengkapan Pelaporan Keuangan.
 */
export function daftarSlotDokumenUntukTransaksi(
  kategori: string,
  detail: DataKhususKegiatan | undefined,
  jumlah: number
): SlotDokumenPendukung[] {
  const slot: SlotDokumenPendukung[] = [];
  const tambah = (jenis: JenisDokumenPendukung, label: string, wajib: boolean, keterangan: string) => {
    if (slot.some((s) => s.jenis === jenis)) return;
    slot.push({
      jenis,
      label,
      ikon: SPEC_DOKUMEN_PENDUKUNG[jenis].ikon,
      wajib,
      keterangan,
    });
  };

  if (kategori === "Akomodasi") {
    const rumahWarga = Boolean(
      detail?.akomodasi?.diRumahWarga ||
        /rumah|warga|kades|kepala desa|homestay|singgah/i.test(detail?.akomodasi?.lokasi || "")
    );
    tambah(
      "ktp",
      rumahWarga ? "KTP Pemilik Rumah Warga" : "KTP Pemilik Penginapan / Rumah",
      true,
      "Dicetak bersebelahan dengan space tempel kuitansi akomodasi."
    );
  } else if (kategori === "Rental Kendaraan") {
    tambah("ktp", "KTP Pemilik / Penerima Uang Rental", true, "Dicetak bersebelahan dengan space tempel kuitansi sewa.");
    tambah("stnk", "STNK Kendaraan", true, "Dicetak satu lembar bersama bukti bayar.");
    tambah("sim", "SIM Penyewa / Pengemudi", true, "Dicetak satu lembar bersama bukti bayar.");
    if (!adalahRentalMotor(detail)) {
      tambah("form_peminjaman_r4", "Form Peminjaman Kendaraan Roda 4", false, "Wajib untuk kendaraan roda 4.");
    }
    if (adalahRentalLebih7Hari(kategori, detail)) {
      tambah(
        "kontrak_sewa",
        "Scan Kontrak Sewa Kendaraan (>7 hari)",
        false,
        "Kontrak sewa otomatis dibuatkan di laporan; unggah scan bertanda tangan jika sudah ada."
      );
    }
    tambah("karcis_tol_parkir", "Karcis Tol / Parkir", false, "Bila ada biaya tol atau parkir selama sewa.");
  } else if (kategori === "Honorarium & Ganti Hari") {
    tambah("ktp", "KTP Penerima Honor / Ganti Hari", true, "Wajib untuk perpajakan; dicetak bersebelahan dengan kuitansi.");
    tambah(
      "npwp",
      "NPWP Penerima",
      Boolean(detail?.honorarium?.hasNPWP),
      "Dicetak bersebelahan dengan space tempel kuitansi (tarif PPh 5% bila ada NPWP, 6% tanpa NPWP)."
    );
    tambah("absensi", "Daftar Absensi / Hadir Asli", true, "Tanda tangan absensi harus konsisten dengan kuitansi.");
    tambah("surat_penunjukan", "Surat Penunjukan / Kontrak & CV / Materi", false, "Kelengkapan administrasi narasumber/panitia/staf.");
  } else if (kategori === "Transportasi") {
    if (adalahTiketPesawat(kategori, detail)) {
      tambah("eticket", "Dokumen Tiket / E-Ticket Pesawat", true, "Masuk satu lembar kertas bersama bukti bayar & boarding pass.");
      tambah("boarding_pass", "Boarding Pass Pesawat", true, "Masuk satu lembar kertas bersama e-ticket & bukti bayar.");
    } else {
      const moda = (detail?.transportasi?.moda || "").toLowerCase();
      if (/travel|ojek|mobil|motor/i.test(moda) || Boolean(detail?.transportasi?.namaSopir)) {
        tambah("stnk", "STNK Kendaraan Travel / Ojek", true, "Dicetak bersebelahan / satu lembar dengan bukti transaksi.");
        tambah("ktp", "KTP Sopir / Pemilik (opsional)", false, "Bila diperlukan untuk kuitansi sewa/ojek lapangan.");
      }
      tambah("karcis_tol_parkir", "Karcis Tol / Parkir", false, "Lampirkan karcis tol/parkir bila ada.");
    }
  } else if (kategori === "Konsumsi") {
    if (!detail?.konsumsi?.kudapanPerjalanan) {
      tambah("absensi", "Daftar Absensi Hadir Asli", true, "Wajib untuk konsumsi rapat / pertemuan / bakon.");
      tambah("notulensi", "Notulensi / Rangkuman Rapat", true, "Rangkuman kegiatan diskusi/rapat.");
      tambah("surat_penjelasan", "Surat Penjelasan (bila porsi > absen)", false, "Diperlukan bila jumlah konsumsi melebihi daftar hadir.");
    }
  } else if (kategori === "Pengadaan Barang & Perlengkapan") {
    tambah("persetujuan_adm", "Persetujuan ADM / Koordinator", true, "Wajib bila pembelian dilakukan oleh staf atau di luar ToR.");
    tambah("tanda_terima_barang", "Form Tanda Terima Barang / Seminar KIT", false, "Ditandatangani penerima barang/perlengkapan.");
  } else if (kategori === "Komunikasi, Listrik & Kurir") {
    tambah("billing_resi", "Detail Billing Telpon / Tagihan PLN / Resi Kurir", true, "Dicetak satu lembar bersama kuitansi asli.");
  } else if (kategori === "Lain-lain") {
    tambah("hasil_pcr_antigen", "Hasil Test PCR / Antigen", false, "Bila terkait klaim tes PCR/Antigen.");
    tambah("tanda_terima_barang", "Form Tanda Terima Barang / KIT", false, "Bila terkait penyerahan perlengkapan.");
    tambah("ktp", "KTP Pihak Terkait (opsional)", false, "Bila transaksi membutuhkan lampiran KTP penerima.");
    tambah("surat_penjelasan", "Surat Penjelasan / Over Budget", false, "Penjelasan variansi biaya atau kebutuhan khusus.");
  }

  // Aturan umum lintas kategori dari PDF Kelengkapan Pelaporan Keuangan:
  if (jumlah >= 5_000_000) {
    tambah(
      "penawaran_3",
      "Dokumen 3 Penawaran Harga / Daftar Pengadaan",
      true,
      "Wajib untuk transaksi ≥ Rp5.000.000 (beserta Materai Rp10.000 pada nota asli)."
    );
  }
  if (detail?.jenisBukti === "Struk thermal (minimarket/SPBU)") {
    tambah(
      "fotokopi_struk_thermal",
      "Fotokopi / Scan Struk Thermal",
      false,
      "Struk thermal mudah pudar (Alfamart, Indomaret, SPBU); lampirkan salinan agar tetap terbaca."
    );
  }

  return slot;
}

/**
 * Menghitung ukuran cetak optimal (mm) untuk sebuah dokumen pendukung berdasarkan spesifikasi jenisnya,
 * rasio foto aktual, serta lebar area kertas (A4 potret = 170 mm, A4 lanskap Akomodasi = 257 mm).
 */
export function hitungUkuranCetakDokumenMm(
  doc: DokumenPendukungItem,
  opsi: { lebarMaksMm: number; tinggiMaksMm?: number }
): { lebarMm: number; tinggiMm: number } {
  const spec = SPEC_DOKUMEN_PENDUKUNG[doc.jenis] ?? SPEC_DOKUMEN_PENDUKUNG.lainnya;
  const targetLebar = Math.min(doc.lebarCetakMm || spec.lebarMm, opsi.lebarMaksMm);
  const tinggiMaks = opsi.tinggiMaksMm ?? (spec.posisiLaporan === "samping" ? 115 : 105);

  if (doc.lebarPx && doc.tinggiPx && doc.lebarPx > 0 && doc.tinggiPx > 0) {
    const rasio = doc.tinggiPx / doc.lebarPx;
    let w = targetLebar;
    let h = Math.round(w * rasio);
    if (h > tinggiMaks) {
      h = tinggiMaks;
      w = Math.max(40, Math.round(h / rasio));
    }
    return { lebarMm: Math.min(w, opsi.lebarMaksMm), tinggiMm: Math.max(30, h) };
  }

  return {
    lebarMm: Math.min(targetLebar, opsi.lebarMaksMm),
    tinggiMm: Math.min(doc.tinggiCetakMm || spec.tinggiMm, tinggiMaks),
  };
}

/**
 * Memisahkan dokumen pendukung transaksi menjadi:
 * - `samping`: dokumen berukuran kartu/ringkas (KTP, NPWP, STNK, SIM, karcis, billing, fotokopi struk) -> bersebelahan space bukti bayar
 * - `bawah`: dokumen lebih lebar (E-Ticket, Boarding Pass, Kontrak, Absensi, Notulensi, 3 Penawaran, dll.) -> satu lembar di bawah bukti bayar
 */
export function pisahkanDokumenPendukung(dokumen: DokumenPendukungItem[] = []): {
  samping: DokumenPendukungItem[];
  bawah: DokumenPendukungItem[];
} {
  const samping: DokumenPendukungItem[] = [];
  const bawah: DokumenPendukungItem[] = [];
  for (const d of dokumen) {
    const spec = SPEC_DOKUMEN_PENDUKUNG[d.jenis] ?? SPEC_DOKUMEN_PENDUKUNG.lainnya;
    if (spec.posisiLaporan === "samping") samping.push(d);
    else bawah.push(d);
  }
  return { samping, bawah };
}
