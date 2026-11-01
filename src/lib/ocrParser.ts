/**
 * Parser deterministik TypeScript untuk mentranslasikan teks hasil OCR lokal (Tesseract.js)
 * menjadi struktur data transaksi yang kompatibel penuh dengan aplikasi dan laporan SPJ.
 * 
 * Aturan Utama:
 * 1. Bebas halusinasi: Jangan pernah mengarang nama toko, tanggal fiktif, harga satuan fiktif, atau nominal palsu.
 * 2. Bedakan secara ketat GRAND TOTAL vs SUBTOTAL, DISKON, KEMBALIAN, SALDO, BIAYA ADMIN, NO. REF.
 * 3. Menyediakan daftar kandidat nominal jika terdeteksi beberapa angka yang masuk akal.
 * 4. Mendukung 10 jenis dokumen bukti transaksi Indonesia: Minimarket, Restoran/Kafe, SPBU,
 *    Nota Toko/ATK, Kwitansi, Tiket/Karcis, Bukti Transfer Bank, Bukti QRIS, E-Wallet, dan Invoice.
 */

import { JenisBukti, RincianBarangJasa, NamaDana, JenisTransaksi } from "../types";
import { KATEGORI } from "./constants";

export interface KandidatNominal {
  nominal: number;
  label: string;
  baris: string;
  bobot: number; // Semakin besar, semakin tinggi prioritas (mis. Grand Total > Subtotal > Tunai)
}

export interface HasilOcrTransaksi {
  sukses: boolean;
  pesan?: string;
  teksMentah: string;
  deskripsi?: string;
  namaPenjualPenyedia?: string;
  jumlah?: number;
  kandidatJumlah: KandidatNominal[];
  tanggal?: string; // YYYY-MM-DD
  kategori?: string; // Kategori Dana Pribadi
  kategoriDanaKegiatan?: string; // Kategori Dana Kegiatan
  jenisBukti: JenisBukti;
  rincian?: RincianBarangJasa;
  keteranganLaporan?: string;
  metode: string; // "Tunai" | "Transfer" | "QRIS" | "Debit" | "Kredit" | "Lainnya"
  catatan?: string;
  ringkasan?: string;
  peringatan: string[];
}

export interface OpsiParserOcr {
  dana?: NamaDana;
  jenisTransaksi?: JenisTransaksi;
}

/**
 * Normalisasi teks angka Rupiah:
 * Mengubah "Rp 150.000,00", "Rp150.000", "150.000", "15O.OOO" (huruf O) menjadi number 150000.
 */
export function uraikanNominalRupiah(teks: string): number | null {
  if (!teks || typeof teks !== "string") return null;

  // Bersihkan teks di sekitarnya
  let bersih = teks.trim();

  // Abaikan format jam-menit digital jika tidak ada imbuhan Rp/IDR: misal 10.27, 09:25, 14.30
  if (/^(?:[01]?[0-9]|2[0-3])[\.:][0-5][0-9]$/.test(bersih) && !/(?:rp|idr)/i.test(teks)) {
    return null;
  }

  // Hapus prefiks Rp, RP, IDR, lambang mata uang
  bersih = bersih.replace(/^(?:RP|IDR|\$)\.?\s*/i, "");

  // Koreksi OCR: jika terdapat angka dan huruf O/o, ganti O/o dengan 0
  if (/\d/.test(bersih) && /^[0-9Oo\.,\s\-]+$/.test(bersih)) {
    bersih = bersih.replace(/[Oo]/g, "0");
  } else {
    bersih = bersih.replace(/([0-9\.,\s])[Oo]([0-9\.,\s]|$)/g, "$10$2");
  }

  // Buang sufiks ,- atau .-
  bersih = bersih.replace(/[,\.]\s*-+$/, "");

  // Pola desimal Indonesia: 150.000,00 -> buang ,00
  if (/,\d{2}$/.test(bersih)) {
    bersih = bersih.replace(/,\d{2}$/, "");
  } else if (/\.\d{2}$/.test(bersih) && (bersih.match(/\./g) || []).length === 1 && !bersih.includes(",")) {
    // Pola desimal standar luar: 150.00 atau 1500.00 (hanya 1 titik dan 2 angka di akhir)
    // Periksa apakah ini desimal atau ribuan: jika <= 999.99 biasanya desimal luar
    const bagian = bersih.split(".");
    if (bagian[0].length <= 3) {
      bersih = bagian[0];
    }
  }

  // Buang semua titik pemisah ribuan dan karakter non-digit
  const hanyaDigit = bersih.replace(/[^0-9]/g, "");
  if (!hanyaDigit) return null;

  const nilai = parseInt(hanyaDigit, 10);
  if (isNaN(nilai) || nilai <= 0) return null;

  // Batas kewajaran: hindari nomor HP (0812...), nomor rekening, tanggal (20261025), atau angka raksasa > 1 milyar
  if (hanyaDigit.startsWith("08") && hanyaDigit.length >= 10) return null; // No HP
  if (/^0\d{3,}/.test(hanyaDigit)) return null; // Kode/Nomor berawalan 0
  if (hanyaDigit.length >= 15) return null; // Nomor kartu/rekening/NMID
  if (nilai > 1_000_000_000) return null; // Nominal tak wajar > 1 Milyar untuk struk harian

  // Jika angka 4 digit berada dalam rentang tahun wajar (2020 - 2035) tanpa tanda nominal Rp/IDR
  if (nilai >= 2020 && nilai <= 2035 && !/(?:rp|idr)/i.test(teks)) {
    return null;
  }

  // Tolak jika angka diapit atau diakhiri satuan kuota atau ukuran non-uang (GB, MB, KB, Liter, Pcs, dsb.)
  if (/(?:gb|mb|kb|kwh|va|watt|liter|ltr|pcs|kg|gr)\b/i.test(teks)) {
    return null;
  }

  return nilai;
}

/**
 * Mencari semua kandidat nominal dari baris-baris teks struk.
 */
export function ekstrakKandidatNominal(barisDaftar: string[]): {
  utama: number | null;
  kandidat: KandidatNominal[];
} {
  const hasilKandidat: KandidatNominal[] = [];

  // Kata kunci pengecualian ketat (bukan nominal belanja utama)
  const polaAbaikan = /\b(KEMBALI|KEMBALIAN|CHANGE|DISKON|POTONGAN|HEMAT|SALDO|SISA\s*SALDO|SALDO\s*AKHIR|BIAYA\s*ADMIN|ADMIN\s*FEE|BIAYA\s*TRANSFER|NO\.?\s*REF|REF\s*NO|STAN|APPROVAL|TRACE|TELP|NPWP|NMID|KODE\s*POS|JAM|TGL|TANGGAL|ID\s*TRANSAKSI|TRANSACTION\s*ID|ORDER\s*ID|NO\.?\s*PESANAN|NOMOR\s*(?:IM3|HP|TELKOMSEL|XL|AXIS|SMARTFREN|TRI|PELANGGAN|METER|REKENING|KARTU)|KODE\s*PEMESANAN)\b/i;

  // Kata kunci prioritas tinggi (Grand Total, Total Akhir)
  const polaTotalUtama = /\b(GRAND\s*TOTAL|TOTAL\s*BAYAR|TOTAL\s*PEMBAYARAN|JUMLAH\s*DIBAYAR|NOMINAL\s*TRANSFER|TOTAL\s*TRANSAKSI|TOTAL\s*AKHIR|JUMLAH\s*TOTAL|TAGIHAN\s*TOTAL|BILL\s*TOTAL)\b/i;

  // Kata kunci prioritas menengah (Total, Jumlah)
  const polaTotalBiasa = /\b(TOTAL|JUMLAH|HARGA\s*TOTAL|TOTAL\s*RP)\b/i;

  // Kata kunci subtotal
  const polaSubtotal = /\b(SUBTOTAL|SUB\s*TOTAL|TOTAL\s*SEBELUM)\b/i;

  // Kata kunci tunai / uang yang diserahkan konsumen
  const polaTunaiBayar = /\b(TUNAI|CASH|BAYAR|DITERIMA)\b/i;

  // Ekstrak tiap baris
  for (let idx = 0; idx < barisDaftar.length; idx++) {
    const baris = barisDaftar[idx].trim();
    if (!baris) continue;

    const barisAtas = baris.toUpperCase();

    // Jika baris memuat kata kunci pengecualian atau ID/Nomor/Jam status bar, jangan jadikan kandidat
    if (
      polaAbaikan.test(barisAtas) ||
      /^(?:ID\s*TRANSAKSI|ORDER\s*ID|TRANSACTION\s*ID|NO\.?\s*PESANAN|NOMOR\s*(?:IM3|HP|PELANGGAN|REKENING)|REKENING\s*TUJUAN)/i.test(baris) ||
      /^\d{1,4}\b.*(?:4G|5G|LTE|WIFI|ED|\bAM\b|\bPM\b)/i.test(baris)
    ) {
      continue;
    }

    // Abaikan baris tanggal & waktu tanpa indikator nominal belanja (misal: "27 Okt 2026 - 09:25 AM")
    const adaIndikatorUang = /(?:Rp|IDR|Total|Bayar|Tagihan|Jumlah|Harga)/i.test(baris);
    const adaPolaBulan = /\b(?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)[a-z]*\b/i.test(baris);
    const adaPolaTanggal = /\b\d{1,2}[\/\.\-]\d{1,2}[\/\.\-](?:20\d\d|\d{2})\b/.test(baris);
    const adaPolaWaktu = /\b\d{1,2}[:\.]\d{2}(?::\d{2})?\s*(?:AM|PM|WIB|WITA|WIT)?\b/i.test(baris);
    if ((adaPolaBulan || adaPolaTanggal || adaPolaWaktu) && !adaIndikatorUang) {
      continue;
    }

    // Cari pola angka uang di dalam baris
    // Cocokkan pola seperti: Rp. 150.000, Rp150.000, 150.000, 1.500.000
    const matches = baris.match(/(?:Rp\.?|IDR)?\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,9})/gi);
    if (!matches) continue;

    for (const rawCocok of matches) {
      const nominal = uraikanNominalRupiah(rawCocok);
      if (!nominal) continue;

      let bobot = 10; // Nilai dasar
      let label = "Nominal";

      if (polaTotalUtama.test(barisAtas)) {
        bobot = 100;
        label = "Total Akhir (Grand Total)";
      } else if (polaTotalBiasa.test(barisAtas)) {
        bobot = 80;
        label = "Total Belanja";
      } else if (polaSubtotal.test(barisAtas)) {
        bobot = 50;
        label = "Subtotal";
      } else if (polaTunaiBayar.test(barisAtas)) {
        bobot = 30;
        label = "Uang Diserahkan";
      } else if (/Rp/i.test(baris)) {
        bobot = 40;
        label = "Rupiah Tertera";
      }

      // Bonus posisi: struk belanja biasanya menaruh Total di bagian bawah (setelah baris 60% teks)
      if (idx > barisDaftar.length * 0.4) {
        bobot += 15;
      }

      // Jangan masukkan duplikasi persis nominal dan label yang sama
      const sudahAda = hasilKandidat.find((k) => k.nominal === nominal && k.label === label);
      if (!sudahAda) {
        hasilKandidat.push({
          nominal,
          label,
          baris,
          bobot,
        });
      }
    }
  }

  // Urutkan kandidat berdasarkan bobot tertinggi
  hasilKandidat.sort((a, b) => b.bobot - a.bobot);

  // Filter kandidat yang unik berdasarkan nominal untuk kemudahan pilihan pengguna di UI
  const kandidatUnik: KandidatNominal[] = [];
  const nominalTerpakai = new Set<number>();
  for (const k of hasilKandidat) {
    if (!nominalTerpakai.has(k.nominal)) {
      nominalTerpakai.add(k.nominal);
      kandidatUnik.push(k);
    }
  }

  const utama = kandidatUnik.length > 0 ? kandidatUnik[0].nominal : null;

  return {
    utama,
    kandidat: kandidatUnik.slice(0, 5), // Ambil maksimal 5 kandidat teratas
  };
}

/**
 * Ekstraksi tanggal transaksi dari teks.
 */
export function ekstrakTanggalTransaksi(teks: string): { tanggal?: string; ditemukan: boolean } {
  const currentYear = new Date().getFullYear();

  // Pola 1: DD/MM/YYYY atau DD-MM-YYYY atau DD.MM.YYYY
  const polaDmy = /\b(0?[1-9]|[12][0-9]|3[01])[\/\.\-](0?[1-9]|1[012])[\/\.\-](20\d\d|\d{2})\b/;
  const m1 = teks.match(polaDmy);
  if (m1) {
    const hari = m1[1].padStart(2, "0");
    const bulan = m1[2].padStart(2, "0");
    let tahun = m1[3];
    if (tahun.length === 2) {
      tahun = `20${tahun}`;
    }
    const tNum = parseInt(tahun, 10);
    if (tNum >= 2020 && tNum <= currentYear + 1) {
      return { tanggal: `${tahun}-${bulan}-${hari}`, ditemukan: true };
    }
  }

  // Pola 2: YYYY-MM-DD
  const polaYmd = /\b(20\d\d)[\/\.\-](0?[1-9]|1[012])[\/\.\-](0?[1-9]|[12][0-9]|3[01])\b/;
  const m2 = teks.match(polaYmd);
  if (m2) {
    const tahun = m2[1];
    const bulan = m2[2].padStart(2, "0");
    const hari = m2[3].padStart(2, "0");
    return { tanggal: `${tahun}-${bulan}-${hari}`, ditemukan: true };
  }

  // Pola 3: DD NamaBulan YYYY (mis. 25 Oktober 2026 atau 25 Okt 26)
  const petaBulan: Record<string, string> = {
    jan: "01", januari: "01", january: "01",
    feb: "02", februari: "02", february: "02",
    mar: "03", maret: "03", march: "03",
    apr: "04", april: "04",
    mei: "05", may: "05",
    jun: "06", juni: "06", june: "06",
    jul: "07", juli: "07", july: "07",
    agu: "08", agustus: "08", ags: "08", august: "08",
    sep: "09", september: "09",
    okt: "10", oktober: "10", oct: "10", october: "10",
    nov: "11", november: "11",
    des: "12", desember: "12", dec: "12", december: "12",
  };

  const polaBulanTeks = /\b(0?[1-9]|[12][0-9]|3[01])\s+([A-Za-z]{3,10})\s+(20\d\d|\d{2})\b/;
  const m3 = teks.match(polaBulanTeks);
  if (m3) {
    const hari = m3[1].padStart(2, "0");
    const namaBulan = m3[2].toLowerCase();
    let tahun = m3[3];
    if (tahun.length === 2) tahun = `20${tahun}`;
    const kodeBulan = petaBulan[namaBulan];
    if (kodeBulan) {
      return { tanggal: `${tahun}-${kodeBulan}-${hari}`, ditemukan: true };
    }
  }

  return { ditemukan: false };
}

/**
 * Ekstraksi metode pembayaran dari teks struk.
 */
export function ekstrakMetodePembayaran(teks: string): string {
  const t = teks.toUpperCase();
  // QRIS: Deteksi logo dan variasi teks OCR (QRIS, ORIS, GRIS, Q-RIS, QR1S, QRI5, atau di baris METODE PEMBAYARAN)
  if (
    /\b(?:Q|O|G)R[I1l]S\b/i.test(teks) ||
    /METODE\s*PEMBAYARAN[^\r\n]*(?:ORIS|QRIS|GRIS|Q-RIS)/i.test(teks) ||
    t.includes("QRIS") ||
    t.includes("ORIS") ||
    t.includes("GOPAY") ||
    t.includes("OVO") ||
    t.includes("DANA") ||
    t.includes("SHOPEEPAY") ||
    t.includes("LINKAJA")
  ) {
    return "QRIS";
  }
  if (t.includes("TRANSFER") || t.includes("BI-FAST") || t.includes("M-BCA") || t.includes("LIVIN") || t.includes("BRIMO") || t.includes("VIRTUAL ACCOUNT")) {
    return "Transfer";
  }
  if (t.includes("DEBIT") || t.includes("EDC DEBIT") || t.includes("KARTU DEBIT")) {
    return "Debit";
  }
  if (t.includes("KREDIT") || t.includes("CREDIT") || t.includes("VISA") || t.includes("MASTERCARD")) {
    return "Kredit";
  }
  if (t.includes("TUNAI") || t.includes("CASH")) {
    return "Tunai";
  }
  return "Tunai"; // Metode baku paling lazim di Indonesia jika tidak tercantum khusus
}

/**
 * Ekstraksi rincian bahan bakar BBM (Liter & Harga per liter) jika bukti berasal dari SPBU.
 */
export function ekstrakRincianBbm(teks: string, totalNominal?: number): RincianBarangJasa | undefined {
  // Pola volume: 15.00 LITER atau 15,00 L atau VOL: 15.00 L
  const polaVolume = /(?:VOL(?:UME)?|QTY|JUMLAH)?[:\s]*([0-9]{1,3}[.,][0-9]{1,3})\s*(?:L|LTR|LITER)\b/i;
  const mVol = teks.match(polaVolume);
  if (!mVol) return undefined;

  const rawVol = mVol[1].replace(",", ".");
  const liter = parseFloat(rawVol);
  if (isNaN(liter) || liter <= 0 || liter > 500) return undefined;

  // Cari harga per liter: mis. HARGA/LITER: Rp 10.000 atau HARGA: Rp 10.000
  const polaHargaLiter = /(?:HARGA(?:\s*\/\s*LITER|\s*PER\s*LITER)?|TARIF|@)\s*[:\s]*(?:Rp\.?|IDR)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+)/i;
  const mHarga = teks.match(polaHargaLiter);
  let hargaLiter = 0;
  if (mHarga) {
    const n = uraikanNominalRupiah(mHarga[1]);
    if (n && n >= 5000 && n <= 50000) {
      hargaLiter = n;
    }
  }

  // Jika harga per liter tidak terbaca tapi total ada, hitung harga satuan aproksimasi
  if (!hargaLiter && totalNominal && totalNominal > 0) {
    hargaLiter = Math.round(totalNominal / liter);
  }

  return {
    banyaknya: liter,
    satuan: "liter",
    hargaSatuan: hargaLiter || 0,
    total: totalNominal || Math.round(liter * hargaLiter),
    keteranganItem: "BBM",
  };
}

/**
 * Parser utama deterministik untuk teks OCR.
 */
export function uraiTeksOcrTransaksi(
  teksMentah: string,
  opsi: OpsiParserOcr = {}
): HasilOcrTransaksi {
  const peringatan: string[] = [];

  const alfanumerik = teksMentah.replace(/[^a-zA-Z0-9]/g, "");
  if (!teksMentah || alfanumerik.length < 10) {
    return {
      sukses: false,
      pesan: "Gambar tidak dapat dikenali sebagai bukti transaksi atau teks terlalu buram.",
      teksMentah: teksMentah || "",
      kandidatJumlah: [],
      jenisBukti: "Bukti tidak lengkap",
      metode: "Tunai",
      peringatan: ["Teks OCR terlalu pendek atau tidak terbaca."],
    };
  }

  const baris = teksMentah
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const teksBesar = teksMentah.toUpperCase();

  // 1. Identifikasi Jenis Dokumen & Merchant
  let namaPenjualPenyedia: string | undefined = undefined;
  let jenisBukti: JenisBukti = "Struk thermal (minimarket/SPBU)";
  let kategoriPribadi = "Belanja Harian";
  let kategoriKegiatan = "Konsumsi";
  let kataKunciDeskripsi = "Belanja";
  let deskripsiKustom: string | undefined = undefined;
  let keteranganLaporanKustom: string | undefined = undefined;
  let spbuTerdeteksi = false;
  let jenisBBM = "";

  // A. Operator Telekomunikasi & Paket Data / Internet / Pulsa
  if (
    teksBesar.includes("PACKAGE PURCHASE") ||
    teksBesar.includes("PAKET DATA") ||
    teksBesar.includes("NAMA PAKET") ||
    teksBesar.includes("INTERNET 100GB") ||
    /INTERNET\s*[0-9]+\s*(?:GB|MB)?/i.test(teksBesar) ||
    teksBesar.includes("NOMOR IM3") ||
    teksBesar.includes("IM3") ||
    teksBesar.includes("INDOSAT") ||
    teksBesar.includes("TELKOMSEL") ||
    teksBesar.includes("MYTELKOMSEL") ||
    teksBesar.includes("BY.U") ||
    teksBesar.includes("XL AXIATA") ||
    teksBesar.includes("MYXL") ||
    teksBesar.includes("AXIS") ||
    teksBesar.includes("SMARTFREN") ||
    teksBesar.includes("BIMA+") ||
    (teksBesar.includes("PULSA") && !teksBesar.includes("KAPAL"))
  ) {
    jenisBukti = "Nota";
    kategoriPribadi = "Pulsa & Internet";
    kategoriKegiatan = "Komunikasi, Listrik & Kurir";

    let operator = "Layanan Internet";
    if (teksBesar.includes("IM3") || teksBesar.includes("INDOSAT")) operator = "IM3 (Indosat)";
    else if (teksBesar.includes("TELKOMSEL") || teksBesar.includes("MYTELKOMSEL") || teksBesar.includes("BY.U")) operator = "Telkomsel";
    else if (teksBesar.includes("XL")) operator = "XL Axiata";
    else if (teksBesar.includes("AXIS")) operator = "AXIS";
    else if (teksBesar.includes("SMARTFREN")) operator = "Smartfren";
    else if (teksBesar.includes("TRI") || teksBesar.includes("BIMA")) operator = "Tri (3)";

    namaPenjualPenyedia = operator;

    // Nama Paket / Layanan
    const mPaket = teksMentah.match(/(?:Nama\s*Paket|Paket|Produk)[:\s]*([^\r\n]{3,40})/i);
    const mKuota = teksMentah.match(/(?:Internet|Kuota|Paket\s*Data)\s*([0-9]+\s*(?:GB|MB)?)/i);
    const namaPaket = mPaket ? mPaket[1].trim() : (mKuota ? mKuota[0].trim() : "Paket Data Internet");

    // Nomor HP / Pelanggan
    const mHp = teksMentah.match(/(?:Nomor\s*(?:IM3|HP|Telepon|Pelanggan)?|No\.?\s*HP)[:\s]*(08[0-9]{8,12})/i);
    const noHp = mHp ? mHp[1] : "";

    kataKunciDeskripsi = namaPaket;
    if (noHp) {
      deskripsiKustom = `${operator} - ${namaPaket} (${noHp})`;
    } else {
      deskripsiKustom = `${operator} - ${namaPaket}`;
    }

    keteranganLaporanKustom = `Pembelian ${namaPaket.toLowerCase()} ${operator}${noHp ? ` nomor ${noHp}` : ""} untuk kebutuhan komunikasi dan koordinasi tim kegiatan.`;
  }

  // B. Listrik PLN / PDAM
  else if (
    teksBesar.includes("TOKEN LISTRIK") ||
    teksBesar.includes("PLN PREPAID") ||
    teksBesar.includes("PLN POSTPAID") ||
    teksBesar.includes("TOKEN PLN") ||
    teksBesar.includes("STROOM/TOKEN") ||
    teksBesar.includes("STROOM") ||
    teksBesar.includes("ID PELANGGAN") ||
    teksBesar.includes("NOMOR METER")
  ) {
    jenisBukti = "Nota";
    kategoriPribadi = "Tagihan & Sewa";
    kategoriKegiatan = "Komunikasi, Listrik & Kurir";
    namaPenjualPenyedia = "PLN";
    kataKunciDeskripsi = "Token Listrik PLN";
    deskripsiKustom = "PLN - Pembelian Token Listrik";
    keteranganLaporanKustom = "Pembelian token listrik PLN untuk operasional kegiatan.";
  }

  // C. SPBU Pertamina / Shell / BP
  else if (teksBesar.includes("SPBU") || teksBesar.includes("PERTAMINA") || teksBesar.includes("PASTI PAS") || teksBesar.includes("SHELL") || teksBesar.includes("BP-AKR")) {
    spbuTerdeteksi = true;
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Transportasi";
    kategoriKegiatan = "BBM";

    // Cari jenis BBM
    if (teksBesar.includes("PERTALITE")) jenisBBM = "Pertalite";
    else if (teksBesar.includes("PERTAMAX TURBO")) jenisBBM = "Pertamax Turbo";
    else if (teksBesar.includes("PERTAMAX")) jenisBBM = "Pertamax";
    else if (teksBesar.includes("DEXLITE")) jenisBBM = "Dexlite";
    else if (teksBesar.includes("PERTAMINA DEX")) jenisBBM = "Pertamina Dex";
    else if (teksBesar.includes("SOLAR") || teksBesar.includes("BIOSOLAR")) jenisBBM = "Solar";
    else if (teksBesar.includes("SHELL SUPER")) jenisBBM = "Shell Super";
    else if (teksBesar.includes("V-POWER")) jenisBBM = "Shell V-Power";

    // Cari nomor SPBU: mis. 34.12345 atau 64.77101
    const mSpbu = teksMentah.match(/(?:SPBU\s*)?([0-9]{2}[\.\-][0-9]{3,5})/i);
    const noSpbu = mSpbu ? ` ${mSpbu[1]}` : "";
    namaPenjualPenyedia = `SPBU Pertamina${noSpbu}`;
    kataKunciDeskripsi = jenisBBM ? `BBM ${jenisBBM}` : "BBM";
  }

  // B. Minimarket (Indomaret, Alfamart, dll)
  else if (teksBesar.includes("INDOMARET") || teksBesar.includes("INDOMARCO")) {
    namaPenjualPenyedia = "Indomaret";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Belanja Harian";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Belanja Snack & Konsumsi";
  } else if (teksBesar.includes("ALFAMART") || teksBesar.includes("SUMBER ALFARIA")) {
    namaPenjualPenyedia = "Alfamart";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Belanja Harian";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Belanja Snack & Konsumsi";
  } else if (teksBesar.includes("ALFAMIDI") || teksBesar.includes("MIDI UTAMA")) {
    namaPenjualPenyedia = "Alfamidi";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Belanja Harian";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Belanja Harian";
  } else if (teksBesar.includes("SUPERINDO") || teksBesar.includes("LION SUPER INDO")) {
    namaPenjualPenyedia = "Super Indo";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Belanja Harian";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Belanja Bahan Konsumsi";
  }

  // C. Restoran / Kafe / Rumah Makan
  else if (
    teksBesar.includes("RESTORAN") ||
    teksBesar.includes("RESTO") ||
    teksBesar.includes("RUMAH MAKAN") ||
    teksBesar.includes("RM ") ||
    teksBesar.includes("CAFE") ||
    teksBesar.includes("KAFE") ||
    teksBesar.includes("COFFEE") ||
    teksBesar.includes("KOPI") ||
    teksBesar.includes("WARUNG") ||
    teksBesar.includes("KFC") ||
    teksBesar.includes("MCDONALD") ||
    teksBesar.includes("SOLARIA") ||
    teksBesar.includes("HOKBEN") ||
    teksBesar.includes("DINE IN") ||
    teksBesar.includes("TABLE") ||
    teksBesar.includes("MEJA")
  ) {
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makan & Minum";

    // Cari nama merchant eksplisit jika ada label MERCHANT / TOKO / BAYAR KE
    const mMerch = teksMentah.match(/(?:MERCHANT|NAMA\s*MERCHANT|BAYAR\s*KE)[:\s]*([^\r\n]{3,40})/i);
    if (mMerch && mMerch[1].trim()) {
      namaPenjualPenyedia = mMerch[1].trim();
    } else {
      // Coba tebak nama resto dari baris pertama yang bukan kata umum
      for (let i = 0; i < Math.min(3, baris.length); i++) {
        const b = baris[i];
        if (!/^(SELAMAT\s*DATANG|STRUK|BILL|INVOICE|ORDER|MEJA|PEMBAYARAN|BUKTI)/i.test(b) && b.length > 3) {
          namaPenjualPenyedia = b;
          break;
        }
      }
    }
  }

  // D. Kuitansi
  else if (
    teksBesar.includes("KUITANSI") ||
    teksBesar.includes("KWITANSI") ||
    teksBesar.includes("TELAH DITERIMA DARI") ||
    teksBesar.includes("SUDAH TERIMA DARI") ||
    teksBesar.includes("UANG SEJUMLAH")
  ) {
    jenisBukti = "Kuitansi";
    kataKunciDeskripsi = "Pembayaran Kuitansi";

    if (teksBesar.includes("SEWA") || teksBesar.includes("RENTAL") || teksBesar.includes("MOBIL") || teksBesar.includes("MOTOR")) {
      kategoriKegiatan = "Rental Kendaraan";
      kategoriPribadi = "Transportasi";
      kataKunciDeskripsi = "Sewa / Rental Kendaraan";
    } else if (teksBesar.includes("HOTEL") || teksBesar.includes("PENGINAPAN") || teksBesar.includes("WISMA") || teksBesar.includes("KAMAR")) {
      kategoriKegiatan = "Akomodasi";
      kategoriPribadi = "Tagihan & Sewa";
      kataKunciDeskripsi = "Akomodasi Penginapan";
    } else if (teksBesar.includes("HONOR") || teksBesar.includes("NARASUMBER") || teksBesar.includes("FASILITATOR") || teksBesar.includes("JASA")) {
      kategoriKegiatan = "Honorarium & Ganti Hari";
      kategoriPribadi = "Lain-lain";
      kataKunciDeskripsi = "Honorarium Kegiatan";
    } else if (teksBesar.includes("PERAHU") || teksBesar.includes("SPEEDBOAT") || teksBesar.includes("TRANSPORT")) {
      kategoriKegiatan = "Transportasi";
      kategoriPribadi = "Transportasi";
      kataKunciDeskripsi = "Transportasi Lapangan";
    } else {
      kategoriKegiatan = "Lain-lain";
      kategoriPribadi = "Lain-lain";
    }

    // Cari nama penerima: baris setelah 'Diterima oleh' atau 'Penerima'
    const mPenerima = teksMentah.match(/(?:Diterima\s*Oleh|Tanda\s*Tangan\s*Penerima|Yang\s*Menerima)[:\s]*([A-Za-z\s\.,]{3,35})/i);
    if (mPenerima && mPenerima[1].trim()) {
      namaPenjualPenyedia = mPenerima[1].trim();
    }
  }

  // E. Tiket & Karcis (Pesawat, Speedboat, Kapal, Travel, Parkir)
  else if (
    teksBesar.includes("TIKET") ||
    teksBesar.includes("BOARDING PASS") ||
    teksBesar.includes("PASSENGER TICKET") ||
    teksBesar.includes("SPEEDBOAT") ||
    teksBesar.includes("E-TICKET") ||
    teksBesar.includes("SUSI AIR") ||
    teksBesar.includes("LION AIR") ||
    teksBesar.includes("GARUDA") ||
    teksBesar.includes("BATIK AIR") ||
    teksBesar.includes("CITILINK") ||
    teksBesar.includes("SUPER AIR JET") ||
    teksBesar.includes("WINGS AIR") ||
    teksBesar.includes("PELNI") ||
    teksBesar.includes("ASDP") ||
    teksBesar.includes("FERRY") ||
    teksBesar.includes("DERMAGA") ||
    teksBesar.includes("PARKIR")
  ) {
    const isPesawat = /AIR|FLIGHT|BANDARA|AIRPORT|BOARDING/i.test(teksBesar);
    jenisBukti = isPesawat ? "Tiket pesawat/e-ticket" : "Tiket";
    kategoriPribadi = "Transportasi";
    kategoriKegiatan = "Transportasi";
    kataKunciDeskripsi = isPesawat ? "Tiket Pesawat" : "Tiket Transportasi";

    for (let i = 0; i < Math.min(3, baris.length); i++) {
      if (baris[i].length > 3 && !/BOARDING|PASSENGER|TIKET/i.test(baris[i])) {
        namaPenjualPenyedia = baris[i];
        break;
      }
    }
  }

  // F. Bukti Transfer Bank
  else if (
    teksBesar.includes("BUKTI TRANSFER") ||
    teksBesar.includes("TRANSFER BERHASIL") ||
    teksBesar.includes("TRANSAKSI BERHASIL") ||
    teksBesar.includes("M-BCA") ||
    teksBesar.includes("LIVIN") ||
    teksBesar.includes("BRIMO") ||
    teksBesar.includes("BI-FAST") ||
    teksBesar.includes("REKENING TUJUAN")
  ) {
    jenisBukti = "Invoice + kuitansi";
    kataKunciDeskripsi = "Transfer Bank";

    // Cari nama penerima: baris setelah 'Nama Penerima' atau 'Penerima'
    const mPen = teksMentah.match(/(?:Nama\s*Penerima|Ke\s*Rekening|Tujuan)[:\s]*([A-Za-z\s\.,]{3,35})/i);
    if (mPen && mPen[1].trim()) {
      namaPenjualPenyedia = mPen[1].trim();
    }
  }

  // G. Bukti Pembayaran QRIS
  else if (teksBesar.includes("QRIS") || teksBesar.includes("NMID")) {
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kataKunciDeskripsi = "Pembayaran QRIS";

    // Cari nama merchant setelah kata 'Merchant' atau baris atas
    const mMerch = teksMentah.match(/(?:Merchant|Bayar\s*Ke)[:\s]*([^\r\n]{3,40})/i);
    if (mMerch && mMerch[1].trim()) {
      namaPenjualPenyedia = mMerch[1].trim();
    }
  }

  // H. Nota Toko / ATK / Bahan Bangunan
  else if (
    teksBesar.includes("NOTA") ||
    teksBesar.includes("TOKO ATK") ||
    teksBesar.includes("FOTOCOPY") ||
    teksBesar.includes("FOTO KOPI") ||
    teksBesar.includes("PERCETAKAN") ||
    teksBesar.includes("TOKO BANGUNAN") ||
    teksBesar.includes("TOKO BESI") ||
    teksBesar.includes("TB.") ||
    teksBesar.includes("UD.")
  ) {
    jenisBukti = "Nota";
    kategoriPribadi = "Belanja Harian";
    kategoriKegiatan = "Pengadaan Barang & Perlengkapan";
    kataKunciDeskripsi = "Pengadaan Barang & Perlengkapan";

    if (baris.length > 0 && baris[0].length > 3) {
      namaPenjualPenyedia = baris[0];
    }
  }

  // I. Invoice / Faktur
  else if (
    teksBesar.includes("INVOICE") ||
    teksBesar.includes("FAKTUR") ||
    teksBesar.includes("TAGIHAN")
  ) {
    jenisBukti = "Invoice + kuitansi";
    kataKunciDeskripsi = "Invoice Tagihan";
    kategoriPribadi = "Tagihan & Sewa";
    kategoriKegiatan = "Pengadaan Barang & Perlengkapan";

    if (baris.length > 0) {
      for (let i = 0; i < Math.min(4, baris.length); i++) {
        const b = baris[i];
        if (!/^(INVOICE|FAKTUR|TAGIHAN|KEPADA|NO\.?)/i.test(b) && b.length > 3) {
          namaPenjualPenyedia = b;
          break;
        }
      }
    }
  }

  // Fallback: Jika belum terdeteksi nama penyedia, ambil baris pertama yang masuk akal
  if (!namaPenjualPenyedia && baris.length > 0) {
    for (let i = 0; i < Math.min(5, baris.length); i++) {
      const b = baris[i].trim();
      const bAtas = b.toUpperCase();
      // Lewati status bar ponsel (jam, 4G, baterai)
      if (/^\d{1,4}\s*(?:\d{1,2}:|[A-Za-z0-9\.\s]*4G|LTE|WIFI|ED|\bAM\b|\bPM\b)/i.test(b)) continue;
      // Lewati judul layar dan label status transaksi
      if (/^(DETAIL|RINCIAN|STATUS|INFORMASI|BUKTI|RIWAYAT|PACKAGE|ORDER|TRANSACTION|STRUK|NOTA|SELAMAT|TANGGAL|TOTAL|SUBTOTAL|METODE|BERHASIL|SUCCESS|SELESAI)/i.test(bAtas)) continue;
      if (b.length >= 3 && b.length <= 40) {
        namaPenjualPenyedia = b;
        break;
      }
    }
  }

  // 2. Ekstraksi Nominal
  const { utama: nominalUtama, kandidat } = ekstrakKandidatNominal(baris);

  if (!nominalUtama) {
    peringatan.push("Nominal transaksi tidak terdeteksi otomatis. Harap isi jumlah pada formulir secara manual.");
  }

  // 3. Ekstraksi Tanggal
  const { tanggal, ditemukan: tanggalDitemukan } = ekstrakTanggalTransaksi(teksMentah);
  const todayIso = new Date().toISOString().slice(0, 10);
  const tanggalFinal = tanggal || todayIso;

  if (!tanggalDitemukan) {
    peringatan.push("Tanggal transaksi tidak tertera jelas pada bukti, otomatis disetel ke tanggal hari ini.");
  }

  // 4. Ekstraksi Metode
  const metode = ekstrakMetodePembayaran(teksMentah);

  // 5. Ekstraksi Rincian BBM bila SPBU
  let rincian: RincianBarangJasa | undefined = undefined;
  if (spbuTerdeteksi) {
    rincian = ekstrakRincianBbm(teksMentah, nominalUtama || undefined);
  }

  // 6. Validasi Kategori terhadap Konstanta Aplikasi Resmi
  const listPribadi = KATEGORI["Dana Pribadi"].pengeluaran;
  const listKegiatan = KATEGORI["Dana Kegiatan"].pengeluaran;

  const finalKategoriPribadi = listPribadi.includes(kategoriPribadi) ? kategoriPribadi : "Lain-lain";
  const finalKategoriKegiatan = listKegiatan.includes(kategoriKegiatan) ? kategoriKegiatan : "Lain-lain";

  // 7. Penyusunan Deskripsi & Narasi Keterangan Laporan Faktual
  const merchantLabel = namaPenjualPenyedia ? namaPenjualPenyedia : "Penyedia";
  const deskripsi = deskripsiKustom || `${merchantLabel} - ${kataKunciDeskripsi}`;

  let keteranganLaporan = "";
  if (keteranganLaporanKustom) {
    keteranganLaporan = keteranganLaporanKustom;
  } else if (kategoriKegiatan === "BBM") {
    const volTeks = rincian?.banyaknya ? ` sebanyak ${rincian.banyaknya} liter` : "";
    const bbmTeks = jenisBBM ? ` jenis ${jenisBBM}` : "";
    keteranganLaporan = `Pembelian bahan bakar minyak${bbmTeks}${volTeks} di ${merchantLabel} untuk operasional kegiatan.`;
  } else if (kategoriKegiatan === "Komunikasi, Listrik & Kurir") {
    keteranganLaporan = `Biaya komunikasi, internet, dan utilitas di ${merchantLabel} untuk operasional kegiatan.`;
  } else if (kategoriKegiatan === "Konsumsi") {
    keteranganLaporan = `Pembayaran konsumsi makanan/minuman di ${merchantLabel} untuk peserta kegiatan.`;
  } else if (kategoriKegiatan === "Pengadaan Barang & Perlengkapan") {
    keteranganLaporan = `Pengadaan perlengkapan dan ATK kegiatan di ${merchantLabel}.`;
  } else if (kategoriKegiatan === "Transportasi") {
    keteranganLaporan = `Biaya transportasi perjalanan di ${merchantLabel}.`;
  } else if (kategoriKegiatan === "Rental Kendaraan") {
    keteranganLaporan = `Biaya sewa / rental kendaraan operasional dari ${merchantLabel}.`;
  } else if (kategoriKegiatan === "Akomodasi") {
    keteranganLaporan = `Biaya akomodasi penginapan di ${merchantLabel}.`;
  } else {
    keteranganLaporan = `Pengeluaran ${kataKunciDeskripsi.toLowerCase()} di ${merchantLabel}.`;
  }

  // Ringkasan singkat faktual
  const nominalFormat = nominalUtama ? `Rp${nominalUtama.toLocaleString("id-ID")}` : "nominal belum terbaca";
  const ringkasan = `${deskripsi} (${nominalFormat}) pada ${tanggalFinal}.`;

  return {
    sukses: true,
    teksMentah,
    deskripsi,
    namaPenjualPenyedia,
    jumlah: nominalUtama || undefined,
    kandidatJumlah: kandidat,
    tanggal: tanggalFinal,
    kategori: finalKategoriPribadi,
    kategoriDanaKegiatan: finalKategoriKegiatan,
    jenisBukti,
    rincian,
    keteranganLaporan,
    metode,
    catatan: baris.slice(0, 15).join(" | "), // Kutipan baris faktual
    ringkasan,
    peringatan,
  };
}
