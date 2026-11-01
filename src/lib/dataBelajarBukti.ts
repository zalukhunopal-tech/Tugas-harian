/**
 * Sistem Pembelajaran Adaptif & Geometri Bukti Transaksi.
 * Mengacu pada dokumen "Prompt Gemini Antigravity - ukuran bukti adaptif dan pasangan tanpa sela" (Versi 2, 30 Oktober 2026).
 *
 * Prinsip Utama:
 * 1. Ukuran bukti tidak tunggal: setiap lembar diukur atau ditaksir mandiri.
 * 2. Pasangan tanpa sela (0 mm): salinan digital dan ruang asli selalu bergandengan di halaman yang sama.
 * 3. Mesin belajar persisten: mempelajari pola vendor/rasio/spesifikasi dari riwayat kegiatan secara kumulatif.
 * 4. Status ukuran jelas: "measured" (terukur fisik), "matched_publisher_spec" (cocok spesifikasi), "estimated" (estimasi).
 */

import { Transaksi, BuktiItem, UkuranKotakTempel } from "../types";

export type JenisMediaBukti =
  | "thermal_receipt"
  | "thermal_wide"
  | "kuitansi_buku"
  | "kuitansi_penginapan"
  | "tiket_kapal"
  | "passenger_coupon"
  | "boarding_pass"
  | "kuitansi_bagasi"
  | "nota_kontan"
  | "dokumen_a4"
  | "ktp_fotokopi"
  | "lainnya";

export type StatusUkuranFisik =
  | "measured"
  | "calibrated_scan"
  | "calibrated_reference"
  | "matched_publisher_spec"
  | "estimated"
  | "unknown";

export interface HasilTaksiranBukti {
  lebarMm: number;
  tinggiMm: number;
  lebarKertasMm: number;
  tinggiKertasMm: number;
  paddingMm: number;
  tataLetak: "samping" | "bawah";
  bentuk: "lebar" | "struk";
  status: StatusUkuranFisik;
  jenisMedia: JenisMediaBukti;
  catatan?: string;
  sumberReferensi?: string;
}

export interface PolaBelajarBukti {
  kunci: string;
  jenisMedia: JenisMediaBukti;
  lebarKertasMm: number;
  tinggiKertasMm: number;
  rasioKhas?: number;
  tataLetak: "samping" | "bawah";
  frekuensi: number;
  terakhirDipakai: string;
}

export interface ManifesPasanganBukti {
  transaction_id: string;
  evidence_id: string;
  pair_id: string;
  category: string;
  media_type: JenisMediaBukti;
  physical_paper: {
    width_mm: number;
    height_mm: number;
    status: StatusUkuranFisik;
    source_reference?: string;
  };
  mount: {
    padding_mm: { left: number; right: number; top: number; bottom: number };
    width_mm: number;
    height_mm: number;
    render_label: boolean;
    render_border: boolean;
    render_fill: boolean;
  };
  digital: {
    width_mm: number;
    height_mm: number;
    effective_ppi?: number;
    quality_status: string;
  };
  pair: {
    same_page_required: true;
    split_allowed: false;
    internal_gap_mm: 0;
    layout: "samping" | "bawah";
  };
  print_internal_checks?: boolean;
}

const KUNCI_STORAGE_BELAJAR = "antigravity_data_belajar_bukti_v2";
const PADDING_DEFAULT_MM = 5;

/**
 * Katalog Pengetahuan Awal (Seed Knowledge) berdasarkan spesifikasi teknis dan analisis ChatGPT v2:
 * - Epson TM-T20III: roll 80 mm (kertas 80 mm, cetak 72 mm) & roll 58 mm (kertas 58 mm, cetak 52.5 mm).
 * - Brother RJ-4250WB: thermal portabel 114 mm (kertas 114 mm, cetak 104 mm).
 * - Kuitansi Paperline: mini 215 × 75, tanggung 285 × 90, besar 320 × 100 mm.
 * - Tiket Speedboat SB Menara Niklas / PT Sadewa: 155 × 90 mm (ruang 165 × 100 mm).
 * - Susi Air: Passenger coupon 165 × 80 mm (ruang 175 × 90 mm); Boarding pass 90 × 135 mm (ruang 100 × 145 mm).
 * - Kuitansi Penginapan Lapangan: 210 × 95-105 mm (ruang konservatif 220 × 105 atau 220 × 115 mm).
 * - Kuitansi Kelebihan Bagasi: 80 × 140 mm (ruang 90 × 150 mm).
 */
export const PRESET_POLA_BUKTI: PolaBelajarBukti[] = [
  {
    kunci: "indomaret",
    jenisMedia: "thermal_receipt",
    lebarKertasMm: 80,
    tinggiKertasMm: 155,
    rasioKhas: 1.94,
    tataLetak: "samping",
    frekuensi: 10,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "alfamart",
    jenisMedia: "thermal_receipt",
    lebarKertasMm: 80,
    tinggiKertasMm: 155,
    rasioKhas: 1.94,
    tataLetak: "samping",
    frekuensi: 8,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "spbu",
    jenisMedia: "thermal_receipt",
    lebarKertasMm: 80,
    tinggiKertasMm: 140,
    rasioKhas: 1.75,
    tataLetak: "samping",
    frekuensi: 8,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "menara niklas",
    jenisMedia: "tiket_kapal",
    lebarKertasMm: 155,
    tinggiKertasMm: 90,
    rasioKhas: 0.58,
    tataLetak: "bawah",
    frekuensi: 6,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "sihol niklas",
    jenisMedia: "tiket_kapal",
    lebarKertasMm: 155,
    tinggiKertasMm: 90,
    rasioKhas: 0.58,
    tataLetak: "bawah",
    frekuensi: 6,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "sadewa surya maritim",
    jenisMedia: "tiket_kapal",
    lebarKertasMm: 155,
    tinggiKertasMm: 90,
    rasioKhas: 0.58,
    tataLetak: "bawah",
    frekuensi: 6,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "susi air passenger",
    jenisMedia: "passenger_coupon",
    lebarKertasMm: 165,
    tinggiKertasMm: 80,
    rasioKhas: 0.48,
    tataLetak: "bawah",
    frekuensi: 6,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "passenger coupon",
    jenisMedia: "passenger_coupon",
    lebarKertasMm: 165,
    tinggiKertasMm: 80,
    rasioKhas: 0.48,
    tataLetak: "bawah",
    frekuensi: 6,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "boarding pass",
    jenisMedia: "boarding_pass",
    lebarKertasMm: 90,
    tinggiKertasMm: 135,
    rasioKhas: 1.5,
    tataLetak: "samping",
    frekuensi: 6,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "bagasi",
    jenisMedia: "kuitansi_bagasi",
    lebarKertasMm: 80,
    tinggiKertasMm: 140,
    rasioKhas: 1.75,
    tataLetak: "samping",
    frekuensi: 4,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "penginapan",
    jenisMedia: "kuitansi_penginapan",
    lebarKertasMm: 210,
    tinggiKertasMm: 100,
    rasioKhas: 0.48,
    tataLetak: "bawah",
    frekuensi: 5,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "rumah pak kades",
    jenisMedia: "kuitansi_penginapan",
    lebarKertasMm: 210,
    tinggiKertasMm: 100,
    rasioKhas: 0.48,
    tataLetak: "bawah",
    frekuensi: 5,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "paperline mini",
    jenisMedia: "kuitansi_buku",
    lebarKertasMm: 215,
    tinggiKertasMm: 75,
    rasioKhas: 0.35,
    tataLetak: "bawah",
    frekuensi: 4,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "paperline tanggung",
    jenisMedia: "kuitansi_buku",
    lebarKertasMm: 285,
    tinggiKertasMm: 90,
    rasioKhas: 0.32,
    tataLetak: "bawah",
    frekuensi: 4,
    terakhirDipakai: "2026-10-30",
  },
  {
    kunci: "paperline besar",
    jenisMedia: "kuitansi_buku",
    lebarKertasMm: 320,
    tinggiKertasMm: 100,
    rasioKhas: 0.31,
    tataLetak: "bawah",
    frekuensi: 4,
    terakhirDipakai: "2026-10-30",
  },
];

/** Cadangan memori in-memory untuk lingkungan tanpa localStorage (seperti server / pengujian node) */
let memoriInProcess: PolaBelajarBukti[] = [...PRESET_POLA_BUKTI];

/** Muat data belajar gabungan (preset + riwayat user) dari localStorage */
export function muatMemoriBelajar(): PolaBelajarBukti[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return memoriInProcess;
  }
  try {
    const raw = window.localStorage.getItem(KUNCI_STORAGE_BELAJAR);
    if (!raw) return [...PRESET_POLA_BUKTI];
    const data: PolaBelajarBukti[] = JSON.parse(raw);
    const peta = new Map<string, PolaBelajarBukti>();
    for (const p of PRESET_POLA_BUKTI) peta.set(p.kunci.toLowerCase(), { ...p });
    for (const d of data) {
      if (d.kunci) peta.set(d.kunci.toLowerCase(), d);
    }
    return Array.from(peta.values());
  } catch {
    return [...PRESET_POLA_BUKTI];
  }
}

/** Simpan memori belajar ke localStorage */
export function simpanMemoriBelajar(daftar: PolaBelajarBukti[]): void {
  memoriInProcess = daftar;
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(KUNCI_STORAGE_BELAJAR, JSON.stringify(daftar.slice(0, 100)));
  } catch {
    // abaikan jika kuota penuh
  }
}

/** Bersihkan dan normalisasi teks pencarian kata kunci */
function normalisasiKunci(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mempelajari transaksi-transaksi kegiatan yang diinputkan pengguna.
 * Dipanggil secara otomatis setiap kali dokumen disusun atau formulir disimpan.
 */
export function pelajariTransaksi(daftarTransaksi: Transaksi[]): void {
  if (!daftarTransaksi || daftarTransaksi.length === 0) return;
  const memori = muatMemoriBelajar();
  const peta = new Map<string, PolaBelajarBukti>();
  for (const m of memori) peta.set(m.kunci, m);

  let adaPembaruan = false;
  const hariIni = new Date().toISOString().slice(0, 10);

  for (const t of daftarTransaksi) {
    const detail = t.detailKegiatan ?? {};
    const penyedia =
      detail.konsumsi?.penyedia ||
      (detail.transportasi as any)?.penyedia ||
      detail.transportasi?.namaSopir ||
      (detail.akomodasi as any)?.penyedia ||
      detail.akomodasi?.namaPemilik ||
      detail.rentalKendaraan?.namaPemilik ||
      detail.transportasi?.moda ||
      "";
    const deskripsi = t.deskripsi || "";
    const gabungan = normalisasiKunci(`${penyedia} ${deskripsi}`);
    if (!gabungan) continue;

    // Periksa apakah ada pola preset yang cocok
    for (const [kunci, data] of peta.entries()) {
      if (gabungan.includes(kunci)) {
        data.frekuensi += 1;
        data.terakhirDipakai = hariIni;
        adaPembaruan = true;
      }
    }

    // Jika pengguna secara spesifik menetapkan kotakTempel manual A/B/C pada penyedia ini
    if (penyedia && detail.kotakTempel) {
      const kunciPenyedia = normalisasiKunci(penyedia);
      if (kunciPenyedia.length >= 3) {
        const ada = peta.get(kunciPenyedia);
        const tataLetak = detail.kotakTempel === "A" ? "samping" : "bawah";
        const lebar = detail.kotakTempel === "A" ? 85 : 170;
        const tinggi = detail.kotakTempel === "A" ? 120 : detail.kotakTempel === "B" ? 65 : 130;
        if (ada) {
          ada.tataLetak = tataLetak;
          ada.lebarKertasMm = lebar - 10;
          ada.tinggiKertasMm = tinggi - 10;
          ada.frekuensi += 2;
          ada.terakhirDipakai = hariIni;
        } else {
          peta.set(kunciPenyedia, {
            kunci: kunciPenyedia,
            jenisMedia: detail.kotakTempel === "A" ? "thermal_receipt" : "kuitansi_buku",
            lebarKertasMm: lebar - 10,
            tinggiKertasMm: tinggi - 10,
            tataLetak,
            frekuensi: 1,
            terakhirDipakai: hariIni,
          });
        }
        adaPembaruan = true;
      }
    }
  }

  if (adaPembaruan) {
    simpanMemoriBelajar(Array.from(peta.values()));
  }
}

/** Parameter input untuk menaksir ukuran dan layout bukti secara adaptif */
export interface ParamTaksirBukti {
  rasio?: number;
  deskripsi?: string;
  kategori?: string;
  penyedia?: string;
  jenisBukti?: string;
  manual?: UkuranKotakTempel;
  paddingMm?: number;
}

/**
 * Menaksir ukuran kotak tempel dan tata letak secara adaptif,
 * mengintegrasikan pengetahuan preset ChatGPT v2, memori belajar historis, dan rasio foto nyata.
 */
export function taksirUkuranBuktiAdaptif(param: ParamTaksirBukti): HasilTaksiranBukti {
  const pad = param.paddingMm ?? PADDING_DEFAULT_MM;
  const paddingDuaSisi = pad * 2;
  const { rasio, deskripsi = "", kategori = "", penyedia = "", jenisBukti = "Kuitansi", manual } = param;

  // 1. Prioritas Utama: Pilihan manual kotakTempel dari pengguna selalu dihormati (status: "measured")
  if (manual === "A") {
    return {
      lebarMm: 85,
      tinggiMm: 120,
      lebarKertasMm: 85 - paddingDuaSisi,
      tinggiKertasMm: 120 - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: "samping",
      bentuk: "struk",
      status: "measured",
      jenisMedia: "thermal_receipt",
      sumberReferensi: "Pilihan manual Tipe A (Struk/Vertikal)",
    };
  }
  if (manual === "B") {
    return {
      lebarMm: 170,
      tinggiMm: 65,
      lebarKertasMm: 170 - paddingDuaSisi,
      tinggiKertasMm: 65 - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: "bawah",
      bentuk: "lebar",
      status: "measured",
      jenisMedia: "kuitansi_buku",
      sumberReferensi: "Pilihan manual Tipe B (Kuitansi/Tiket Lebar)",
    };
  }
  if (manual === "C") {
    return {
      lebarMm: 170,
      tinggiMm: 130,
      lebarKertasMm: 170 - paddingDuaSisi,
      tinggiKertasMm: 130 - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: "bawah",
      bentuk: "lebar",
      status: "measured",
      jenisMedia: "kuitansi_buku",
      sumberReferensi: "Pilihan manual Tipe C (Kuitansi Besar/Faktur)",
    };
  }

  // 2. Pencocokan Memori Belajar & Spesifikasi Vendor (matched_publisher_spec / estimated)
  // Periksa nama penyedia dan deskripsi transaksi (jangan campurkan jenisBukti agar tidak false positive seperti "SPBU")
  const teksGabung = normalisasiKunci(`${penyedia} ${deskripsi}`);
  const memori = muatMemoriBelajar();

  // Cari kecocokan kata kunci terpanjang/terakurat
  let polaCocok: PolaBelajarBukti | undefined;
  for (const p of memori) {
    if (teksGabung.includes(p.kunci)) {
      if (!polaCocok || p.kunci.length > polaCocok.kunci.length) {
        polaCocok = p;
      }
    }
  }

  if (polaCocok) {
    let lebarKotak = polaCocok.lebarKertasMm + paddingDuaSisi;
    let tinggiKotak = polaCocok.tinggiKertasMm + paddingDuaSisi;

    // Jika ada rasio nyata dari foto, sempurnakan tinggi struk secara dinamis (tinggi struk mengikuti isi & potong)
    if (typeof rasio === "number" && Number.isFinite(rasio) && rasio > 0) {
      if (polaCocok.jenisMedia === "thermal_receipt") {
        // Roll 80 mm -> lebar kotak 90 mm; tinggi mengikuti rasio
        const tinggiDinamis = Math.round(lebarKotak * rasio);
        tinggiKotak = Math.min(230, Math.max(90, tinggiDinamis));
      } else if (polaCocok.jenisMedia === "boarding_pass") {
        tinggiKotak = Math.min(180, Math.max(120, Math.round(lebarKotak * rasio)));
      }
    }

    // Pastikan batas aman media
    if (polaCocok.tataLetak === "samping") {
      lebarKotak = Math.min(105, Math.max(70, lebarKotak));
      tinggiKotak = Math.min(230, Math.max(80, tinggiKotak));
    } else {
      lebarKotak = Math.min(330, Math.max(140, lebarKotak));
      tinggiKotak = Math.min(150, Math.max(55, tinggiKotak));
    }

    const catatan =
      tinggiKotak >= 230
        ? "Lipat struk bila lebih panjang dari kotak"
        : "Estimasi - ukur bukti sebelum ditempel";

    return {
      lebarMm: lebarKotak,
      tinggiMm: tinggiKotak,
      lebarKertasMm: lebarKotak - paddingDuaSisi,
      tinggiKertasMm: tinggiKotak - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: polaCocok.tataLetak,
      bentuk: polaCocok.tataLetak === "samping" ? "struk" : "lebar",
      status: "matched_publisher_spec",
      jenisMedia: polaCocok.jenisMedia,
      catatan,
      sumberReferensi: `Cocok spesifikasi/pola belajar: ${polaCocok.kunci}`,
    };
  }

  // 3. Penaksiran Berdasarkan Rasio Foto Nyata (Geometri Foto Kamera)
  if (typeof rasio === "number" && Number.isFinite(rasio) && rasio > 0) {
    // Rasio sangat potret/panjang (struk belanja ritel, tiket thermal kasir)
    if (rasio >= 1.6) {
      const tinggiHitung = Math.round(85 * rasio + 10);
      const tinggiMm = Math.min(230, Math.max(100, tinggiHitung));
      const catatan =
        tinggiHitung > 230
          ? "Lipat struk bila lebih panjang dari kotak"
          : "Estimasi - ukur bukti sebelum ditempel";
      return {
        lebarMm: 85,
        tinggiMm,
        lebarKertasMm: 85 - paddingDuaSisi,
        tinggiKertasMm: tinggiMm - paddingDuaSisi,
        paddingMm: pad,
        tataLetak: "samping",
        bentuk: "struk",
        status: "estimated",
        jenisMedia: "thermal_receipt",
        catatan,
        sumberReferensi: `Geometri foto rasio ${rasio.toFixed(2)} (potret panjang)`,
      };
    }

    // Rasio potret sedang (nota kontan, boarding pass, kuitansi vertikal)
    if (rasio >= 1.15) {
      const tinggiMm = Math.min(200, Math.max(110, Math.round(100 * rasio + 10)));
      return {
        lebarMm: 100,
        tinggiMm,
        lebarKertasMm: 100 - paddingDuaSisi,
        tinggiKertasMm: tinggiMm - paddingDuaSisi,
        paddingMm: pad,
        tataLetak: "samping",
        bentuk: "struk",
        status: "estimated",
        jenisMedia: "nota_kontan",
        catatan: "Estimasi - ukur bukti sebelum ditempel",
        sumberReferensi: `Geometri foto rasio ${rasio.toFixed(2)} (potret sedang)`,
      };
    }

    // Rasio hampir persegi (0.87 s.d. 1.15)
    if (rasio >= 0.87) {
      return {
        lebarMm: 100,
        tinggiMm: 100,
        lebarKertasMm: 100 - paddingDuaSisi,
        tinggiKertasMm: 100 - paddingDuaSisi,
        paddingMm: pad,
        tataLetak: "samping",
        bentuk: "struk",
        status: "estimated",
        jenisMedia: "nota_kontan",
        catatan: "Estimasi - ukur bukti sebelum ditempel",
        sumberReferensi: `Geometri foto rasio ${rasio.toFixed(2)} (persegi)`,
      };
    }

    // Rasio lanskap lebar (< 0.87: tiket pesawat, tiket kapal, kuitansi memanjang)
    const tinggiMm = Math.min(125, Math.max(55, Math.round(170 * rasio + 10)));
    return {
      lebarMm: 170,
      tinggiMm,
      lebarKertasMm: 170 - paddingDuaSisi,
      tinggiKertasMm: tinggiMm - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: "bawah",
      bentuk: "lebar",
      status: "estimated",
      jenisMedia: "kuitansi_buku",
      catatan: "Estimasi - ukur bukti sebelum ditempel",
      sumberReferensi: `Geometri foto rasio ${rasio.toFixed(2)} (lanskap lebar)`,
    };
  }

  // 4. Fallback Default jika Tanpa Foto & Tanpa Spesifikasi Khusus
  if (jenisBukti === "Struk thermal (minimarket/SPBU)") {
    return {
      lebarMm: 85,
      tinggiMm: 120,
      lebarKertasMm: 85 - paddingDuaSisi,
      tinggiKertasMm: 120 - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: "samping",
      bentuk: "struk",
      status: "estimated",
      jenisMedia: "thermal_receipt",
      catatan: "Estimasi - ukur bukti sebelum ditempel",
      sumberReferensi: "Bawaan jenis bukti struk thermal",
    };
  }
  if (jenisBukti === "Nota") {
    return {
      lebarMm: 100,
      tinggiMm: 130,
      lebarKertasMm: 100 - paddingDuaSisi,
      tinggiKertasMm: 130 - paddingDuaSisi,
      paddingMm: pad,
      tataLetak: "samping",
      bentuk: "struk",
      status: "estimated",
      jenisMedia: "nota_kontan",
      catatan: "Estimasi - ukur bukti sebelum ditempel",
      sumberReferensi: "Bawaan jenis bukti nota",
    };
  }

  // Default umum: Kuitansi lebar tata letak bawah
  return {
    lebarMm: 170,
    tinggiMm: 65,
    lebarKertasMm: 170 - paddingDuaSisi,
    tinggiKertasMm: 65 - paddingDuaSisi,
    paddingMm: pad,
    tataLetak: "bawah",
    bentuk: "lebar",
    status: "estimated",
    jenisMedia: "kuitansi_buku",
    catatan: "Estimasi - ukur bukti sebelum ditempel",
    sumberReferensi: "Bawaan default kuitansi",
  };
}

/**
 * Menyusun manifes pasangan bukti transaksi untuk audit geometri 0 mm dan integritas SPJ.
 */
export function susunManifesPasangan(
  transaksi: Transaksi,
  nomor: number,
  bukti: BuktiItem,
  urutanBukti: number,
  totalBukti: number,
  hasil: HasilTaksiranBukti
): ManifesPasanganBukti {
  const pairId = `${nomor}:${urutanBukti}`;
  const pad = hasil.paddingMm;

  return {
    transaction_id: String(nomor),
    evidence_id: String(urutanBukti),
    pair_id: pairId,
    category: transaksi.kategori || "Lain-lain",
    media_type: hasil.jenisMedia,
    physical_paper: {
      width_mm: hasil.lebarKertasMm,
      height_mm: hasil.tinggiKertasMm,
      status: hasil.status,
      source_reference: hasil.sumberReferensi,
    },
    mount: {
      padding_mm: { left: pad, right: pad, top: pad, bottom: pad },
      width_mm: hasil.lebarMm,
      height_mm: hasil.tinggiMm,
      render_label: false,
      render_border: false,
      render_fill: false,
    },
    digital: {
      width_mm: hasil.tataLetak === "samping" ? hasil.lebarMm : hasil.lebarMm,
      height_mm: hasil.tinggiMm,
      effective_ppi: bukti.lebarPx ? Math.round((bukti.lebarPx * 25.4) / hasil.lebarMm) : undefined,
      quality_status: bukti.dataUrl || bukti.driveLink ? "tersedia" : "kosong",
    },
    pair: {
      same_page_required: true,
      split_allowed: false,
      internal_gap_mm: 0,
      layout: hasil.tataLetak,
    },
    print_internal_checks: false,
  };
}
