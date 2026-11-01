/**
 * Parser deterministik TypeScript untuk mentranslasikan teks hasil OCR lokal (Tesseract.js)
 * menjadi struktur data transaksi yang kompatibel penuh dengan aplikasi dan laporan SPJ.
 * 
 * Aturan Utama:
 * 1. Bebas halusinasi: Jangan pernah mengarang nama toko, tanggal fiktif, harga satuan fiktif, atau nominal palsu.
 * 2. Bedakan secara ketat GRAND TOTAL vs SUBTOTAL, DISKON, KEMBALIAN, SALDO, BIAYA ADMIN, NO. REF, NOMOR PESANAN.
 * 3. Menyediakan daftar kandidat nominal jika terdeteksi beberapa angka yang masuk akal.
 * 4. Mendukung 10 jenis dokumen bukti transaksi Indonesia: Minimarket, Restoran/Kafe/Minuman, SPBU,
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
  nominalQrisTerverifikasi?: number;
  merchantQrisTerverifikasi?: string;
}

/**
 * Parsing payload QRIS EMVCo (Standar QRIS Nasional Bank Indonesia)
 * Membaca tag 54 (Transaction Amount) dan tag 59 (Merchant Name) secara presisi.
 */
export function uraikanQrisEMVCo(qrText: string): { amount?: number; merchantName?: string } | null {
  if (!qrText || typeof qrText !== "string") return null;
  if (!qrText.startsWith("000201")) return null;

  let i = 0;
  let amount: number | undefined;
  let merchantName: string | undefined;

  while (i + 4 <= qrText.length) {
    const tag = qrText.substring(i, i + 2);
    const lenStr = qrText.substring(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (isNaN(len) || len < 0 || i + 4 + len > qrText.length) break;
    const val = qrText.substring(i + 4, i + 4 + len);
    i += 4 + len;

    // Tag 54: Nilai transaksi (Transaction Amount)
    if (tag === "54") {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        amount = Math.round(num);
      }
    }
    // Tag 59: Nama merchant / toko penyedia
    if (tag === "59" && val.trim()) {
      merchantName = val.trim();
    }
  }

  return { amount, merchantName };
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

  // Tolak jika angka diapit atau diakhiri satuan non-mata uang (GB, MB, KB, L, Ltr, Pcs, dsb.)
  if (/(?:gb|mb|kb|kwh|va|watt|liter|ltr|pcs|kg|gr)\b/i.test(teks)) {
    return null;
  }

  // Deteksi apakah teks asli mengandung prefiks mata uang Rp / IDR
  const adaPrefiksMataUang = /^(?:RP|IDR|\$)/i.test(bersih);

  // Deteksi apakah teks asli mengandung pemisah ribuan (. atau ,)
  const adaPemisahRibuan = /[0-9]{1,3}[.,][0-9]{3}/.test(bersih);

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

  // Kasus Khusus Tiket/Struk Indonesia: Format desimal 2 digit dengan prefiks Rp (mis. "Rp. 280.01" atau "Rp. 280.00" atau "Rp. 145.00")
  // Pada tiket speedboat/transportasi fisik, angka ribuan sering terpotong atau digit terakhir pudar (.00 / .01).
  // Dalam Rupiah Indonesia tidak ada pecahan sen untuk transaksi fisik transportasi/retail.
  if (adaPrefiksMataUang && /^\d{2,3}[\.,]0[0-9]$/.test(bersih)) {
    const bagianUtama = parseInt(bersih.replace(/[\.,].*$/, ""), 10);
    if (!isNaN(bagianUtama) && bagianUtama >= 20 && bagianUtama <= 999) {
      return bagianUtama * 1000;
    }
  }

  // Pola desimal Indonesia: 150.000,00 -> buang ,00
  if (/,\d{2}$/.test(bersih)) {
    bersih = bersih.replace(/,\d{2}$/, "");
  } else if (/\.\d{2}$/.test(bersih) && (bersih.match(/\./g) || []).length === 1 && !bersih.includes(",")) {
    // Pola desimal standar: jika ada prefiks Rp dan 2 digit akhir
    const bagian = bersih.split(".");
    if (bagian[0].length <= 3) {
      const bagian0Num = parseInt(bagian[0], 10);
      if (adaPrefiksMataUang && bagian0Num >= 20 && bagian0Num <= 999 && bagian[1] === "00") {
        return bagian0Num * 1000;
      }
      bersih = bagian[0];
    }
  }

  // Buang semua titik pemisah ribuan dan karakter non-digit
  const hanyaDigit = bersih.replace(/[^0-9]/g, "");
  if (!hanyaDigit) return null;

  // Batas kewajaran:
  // 1. Nomor HP (0812...) dan kode/nomor awalan 0
  if (hanyaDigit.startsWith("08") && hanyaDigit.length >= 10) return null;
  if (/^0\d{3,}/.test(hanyaDigit)) return null;

  // 2. Angka berurutan 8 digit atau lebih tanpa pemisah ribuan dan tanpa Rp:
  //    Contoh: 211802160, 121160278, 17348007 -> Ini nomor pesanan, barcode, nomor referensi, atau noise QR!
  if (hanyaDigit.length >= 8 && !adaPemisahRibuan && !adaPrefiksMataUang) {
    return null;
  }

  // 3. Nomor pesanan/rekening/barcode panjang >= 10 digit
  if (hanyaDigit.length >= 10 && !adaPemisahRibuan) return null;

  const nilai = parseInt(hanyaDigit, 10);
  if (isNaN(nilai) || nilai <= 0) return null;

  // 3b. Angka 4 digit tanpa pemisah ribuan dan tanpa prefiks Rp / IDR:
  // - Tahun masehi (2020-2035)
  // - Waktu jam:menit tanpa titik (misal 1027 dari 10:27 AM, 0925 dari 09:25 AM)
  if (!adaPrefiksMataUang && !adaPemisahRibuan && hanyaDigit.length === 4) {
    if (nilai >= 2020 && nilai <= 2035) return null; // Tahun
    if (nilai >= 100 && nilai <= 2359) return null; // Pola jam digital status bar
  }

  // 4. Jika nilai >= 5.000.000 tapi tidak ada pemisah ribuan dan tidak ada prefiks Rp
  if (nilai >= 5_000_000 && !adaPemisahRibuan && !adaPrefiksMataUang) {
    return null;
  }

  // 5. Nominal tak wajar > 500 Juta untuk struk belanja harian
  if (nilai > 500_000_000) return null;

  return nilai;
}

/**
 * Mencari semua kandidat nominal dari baris-baris teks struk.
 */
export function ekstrakKandidatNominal(
  barisDaftar: string[],
  nominalQrisTerverifikasi?: number
): {
  utama: number | null;
  kandidat: KandidatNominal[];
} {
  const hasilKandidat: KandidatNominal[] = [];

  // Jika ada nominal QRIS terverifikasi dari dekode kode QR, jadikan prioritas tertinggi mutlak
  if (nominalQrisTerverifikasi && nominalQrisTerverifikasi > 0) {
    hasilKandidat.push({
      nominal: nominalQrisTerverifikasi,
      label: "Total Pembayaran QRIS (Terverifikasi)",
      baris: `QRIS Tag 54: Rp ${nominalQrisTerverifikasi.toLocaleString("id-ID")}`,
      bobot: 300,
    });
  }

  // Kata kunci pengecualian ketat (bukan nominal belanja utama)
  const polaAbaikan = /\b(KEMBALI|KEMBALIAN|CHANGE|DISKON|POTONGAN|HEMAT|SALDO|SISA\s*SALDO|SALDO\s*AKHIR|BIAYA\s*ADMIN|ADMIN\s*FEE|BIAYA\s*TRANSFER|NO\.?\s*REF|REF\s*NO|NOMOR|NO\.?\s*PESANAN|ORDER\s*(?:NO|ID|#)?|ID\s*TRANSAKSI|TRANSACTION\s*ID|ORDER\s*ID|NO\.?\s*TRANSAKSI|NOMOR\s*IM3|TOTAL\s*PESANAN|JUMLAH\s*PESANAN|TOTAL\s*ITEM|JUMLAH\s*ITEM|TOTAL\s*QTY|STAN|APPROVAL|TRACE|BATCH|OPERATOR|KASIR|CASHIER|SALURAN|TELP|TELEPON|HP|PHONE|NPWP|NMID|KODE\s*POS|JAM|WAKTU|TIME|PRINT|TGL|TANGGAL|DATE|HUBUNGI|KRITIK|SARAN|CS|HOTLINE|KEMITRAAN|PARTNERSHIP)\b/i;

  // Kata kunci prioritas tinggi (Grand Total, Total Akhir, Pembayaran Sebenarnya)
  const polaTotalUtama = /\b(GRAND\s*TOTAL|TOTAL\s*BAYAR|TOTAL\s*PEMBAYARAN|TOTAL\s*HARGA|PEMBAYARAN\s*SEBENARNYA|PEMBAYARAN\s*SEBENAR|NOMINAL\s*PENDAPATAN|JUMLAH\s*DIBAYAR|NOMINAL\s*TRANSFER|TOTAL\s*TRANSAKSI|TOTAL\s*AKHIR|JUMLAH\s*TOTAL|TAGIHAN\s*TOTAL|BILL\s*TOTAL|TOTAL\s*TAGIHAN|TOTAL\s*NETTO|NET\s*TOTAL|TOTAL\s*ALL|SEBENARNYA|SERGNSINYA)\b/i;

  // Kata kunci prioritas menengah (Total, Jumlah yang bukan total pesanan/item)
  const polaTotalBiasa = /\b(TOTAL(?!\s*PESANAN|\s*ITEM|\s*QTY)|JUMLAH(?!\s*PESANAN|\s*ITEM|\s*QTY)|HARGA\s*TOTAL|TOTAL\s*RP)\b/i;

  // Kata kunci subtotal
  const polaSubtotal = /\b(SUBTOTAL|SUB\s*TOTAL|TOTAL\s*SEBELUM)\b/i;

  // Kata kunci tunai / uang yang diserahkan konsumen
  const polaTunaiBayar = /\b(TUNAI|CASH|BAYAR|DITERIMA)\b/i;

  // Ekstrak tiap baris
  for (let idx = 0; idx < barisDaftar.length; idx++) {
    const baris = barisDaftar[idx].trim();
    if (!baris) continue;

    const barisAtas = baris.toUpperCase();

    // Periksa baris sebelumnya (konteks multi-baris)
    const barisSebelum = idx > 0 ? barisDaftar[idx - 1].trim().toUpperCase() : "";
    const barisDuaSebelum = idx > 1 ? barisDaftar[idx - 2].trim().toUpperCase() : "";

    // Abaikan jika baris atau baris sebelumnya mengindikasikan nomor pesanan, telepon, barcode, atau info CS
    if (
      polaAbaikan.test(barisAtas) ||
      /^(?:ID\s*TRANSAKSI|TRANSACTION\s*ID|ORDER\s*ID|NOMOR\s*IM3|NO\.?\s*HP|REKENING\s*TUJUAN)/i.test(baris) ||
      (barisSebelum && /\b(NOMOR\s*PESANAN|NO\.?\s*PESANAN|ORDER\s*(?:NO|ID|#)|NO\.?\s*REF|REF\s*NO|NMID|TELP|HP|PHONE|HUBUNGI)\b/i.test(barisSebelum))
    ) {
      continue;
    }

    // Abaikan jika baris atau baris sebelumnya berkaitan dengan KTP / identitas kependudukan / tanggal lahir
    if (
      /\b(NIK|N\.I\.K|KTP|KABUPATEN|PROVINSI|KECAMATAN|KELURAHAN|DESA|RTRW|RT\/RW|LAHIR|AGAMA|KAWIN|GOL\.?\s*DARAH|KEWARGANEGARAAN|PEKERJAAN|BERLAKU\s*HINGGA)\b/i.test(barisAtas) ||
      (barisSebelum && /\b(NIK|N\.I\.K|KTP|TEMPAT|LAHIR|RTRW|KECAMATAN|KEWARGANEGARAAN)\b/i.test(barisSebelum))
    ) {
      continue;
    }

    // Abaikan baris bilah status ponsel (jam, sinyal 4G/5G, LTE, WiFi, baterai, dsb.)
    if (
      (idx <= 2 && /^\d{1,4}\b.*(?:4G|5G|LTE|WIFI|\bED\b|\bAM\b|\bPM\b|N\d+|[\.:]\s*[A-Z])/i.test(baris)) ||
      (idx <= 2 && /^(?:[01]?[0-9]|2[0-3])[\.:][0-5][0-9]\b/i.test(baris))
    ) {
      continue;
    }

    // Jika baris memuat nomor telepon format Indonesia (08...)
    if (/08\d{2}[-\s]?\d{4}[-\s]?\d{3,5}/.test(baris)) {
      continue;
    }

    // Jika baris memuat rangkaian digit panjang >= 8 tanpa titik dan tanpa Rp
    if (/\b\d{8,}\b/.test(baris) && !/Rp|IDR/i.test(baris)) {
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
    // Mendukung ribuan standar (mis. 50.000 / 125.000), 4-7 digit murni (mis. 50000),
    // serta pola khusus tiket fisik/dot-matrix (mis. "Rp. 280.01" atau "Rp. 280.00" atau "Rp 145.00")
    const matches = baris.match(/(?:Rp\.?|IDR)?\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+(?:[.,][0-9]{2})?|[0-9]{4,7})|(?:Rp\.?|IDR)\s*[0-9]{2,3}[.,][0-9]{2}\b/gi);
    if (!matches) continue;

    for (const rawCocok of matches) {
      const nominal = uraikanNominalRupiah(rawCocok);
      if (!nominal) continue;

      // Filter tahun masehi (mis. 2020 s.d. 2035)
      if (nominal >= 2020 && nominal <= 2035) {
        if (/[-\/:]/.test(baris) || /WAKTU|TGL|TANGGAL|DATE|JAM|PRINT|PESANAN|TAHUN/i.test(baris) || !/Rp|IDR/i.test(rawCocok)) {
          continue;
        }
      }

      // Filter angka terlalu kecil yang biasanya adalah kuantitas barang, nomor antrean, atau nomor meja
      if (nominal < 500 && !/Rp|IDR/i.test(rawCocok)) {
        continue;
      }

      // Filter angka 4 digit di bawah 10.000 (mis. 1027, 3710) yang tidak memiliki prefiks Rp,
      // tidak memiliki pemisah ribuan, dan baris tidak memuat kata kunci total/harga/bayar
      if (
        nominal < 10000 &&
        !/Rp|IDR/i.test(rawCocok) &&
        !/Rp|IDR/i.test(baris) &&
        !polaTotalUtama.test(barisAtas) &&
        !polaTotalBiasa.test(barisAtas) &&
        !/HARGA|TARIF|BIAYA/i.test(barisAtas)
      ) {
        continue;
      }

      // Filter angka > 5 Juta yang tidak memiliki format pemisah ribuan dan tanpa kata kunci Total
      if (nominal > 5_000_000 && !/[.,]/.test(rawCocok) && !polaTotalUtama.test(barisAtas) && !polaTotalUtama.test(barisSebelum)) {
        continue;
      }

      let bobot = 10; // Nilai dasar
      let label = "Nominal";

      // 1. Dukungan multi-baris: hanya berlaku jika baris sebelumnya murni teks label tanpa angka
      const barisSebelumMurniLabel = Boolean(barisSebelum && !/\d/.test(barisSebelum));
      const barisDuaSebelumMurniLabel = Boolean(barisDuaSebelum && !/\d/.test(barisDuaSebelum));

      const adalahTunai = polaTunaiBayar.test(barisAtas);

      const adalahTotalUtama =
        !adalahTunai &&
        (polaTotalUtama.test(barisAtas) ||
          (barisSebelumMurniLabel && polaTotalUtama.test(barisSebelum)) ||
          (barisDuaSebelumMurniLabel && polaTotalUtama.test(barisDuaSebelum)));

      const adalahTotalBiasa =
        !adalahTunai &&
        (polaTotalBiasa.test(barisAtas) ||
          (barisSebelumMurniLabel && polaTotalBiasa.test(barisSebelum)));

      if (adalahTotalUtama) {
        bobot = 160;
        label = "Total Akhir (Grand Total)";
      } else if (adalahTotalBiasa) {
        bobot = 100;
        label = "Total Belanja";
      } else if (polaSubtotal.test(barisAtas) || (barisSebelumMurniLabel && polaSubtotal.test(barisSebelum))) {
        bobot = 50;
        label = "Subtotal";
      } else if (adalahTunai) {
        bobot = 30;
        label = "Uang Diserahkan";
      } else if (/Rp|IDR/i.test(rawCocok) || /Rp|IDR/i.test(baris)) {
        bobot = 55;
        label = "Rupiah Tertera";
      }

      // Bonus jika nominal memiliki awalan mata uang eksplisit Rp/IDR
      if (/Rp|IDR/i.test(rawCocok)) {
        bobot += 20;
      }

      // Bonus jika nominal memiliki format ribuan standar (titik)
      if (/[0-9]{1,3}\.[0-9]{3}/.test(rawCocok)) {
        bobot += 15;
      }

      // Bonus posisi: struk belanja biasanya menaruh Total di bagian tengah ke bawah (> 40% baris)
      if (idx > barisDaftar.length * 0.4) {
        bobot += 10;
      }
      if (idx > barisDaftar.length * 0.7) {
        bobot += 10;
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

  // 1. Deteksi QRIS & QR Code & Dompet Digital
  // Mengakomodasi kesalahan OCR umum: "BRIS", "GRIS", "ORIS", "Q-RIS", "wR" untuk "QR"
  if (
    /\b(?:Q|O|G|B)R[I1l]S\b/i.test(teks) ||
    /\b(QRIS|GRIS|BRIS|ORIS|Q-RIS)\b/i.test(teks) ||
    /METODE\s*P[EO]NB?AYARAN[^\r\n]*(?:QR|WR|QRIS|ORIS|GRIS|BRIS)/i.test(teks) ||
    /\bQR\b/.test(t) ||
    t.includes("STANDAR PEMBAYARAN") ||
    t.includes("GPN") ||
    t.includes("NMID") ||
    t.includes("GOPAY") ||
    t.includes("GO-PAY") ||
    t.includes("OVO") ||
    t.includes("DANA") ||
    t.includes("SHOPEEPAY") ||
    t.includes("SHOPEE PAY") ||
    t.includes("LINKAJA") ||
    t.includes("ASTRAPAY") ||
    t.includes("ISAKU")
  ) {
    return "QRIS";
  }

  // 2. Deteksi Transfer Bank
  if (
    t.includes("TRANSFER") ||
    t.includes("BI-FAST") ||
    t.includes("BI FAST") ||
    t.includes("M-BCA") ||
    t.includes("MBCA") ||
    t.includes("LIVIN") ||
    t.includes("BRIMO") ||
    t.includes("OCTO") ||
    t.includes("BSI MOBILE") ||
    t.includes("NEOBANK") ||
    t.includes("SEABANK") ||
    t.includes("JENIUS") ||
    t.includes("VIRTUAL ACCOUNT") ||
    /\bVA\b/.test(t)
  ) {
    return "Transfer";
  }

  // 3. Deteksi Kartu Debit
  if (t.includes("DEBIT") || t.includes("EDC DEBIT") || t.includes("KARTU DEBIT") || /\bEDC\b/.test(t)) {
    return "Debit";
  }

  // 4. Deteksi Kartu Kredit & Paylater
  if (
    t.includes("KREDIT") ||
    t.includes("CREDIT") ||
    t.includes("VISA") ||
    t.includes("MASTERCARD") ||
    t.includes("JCB") ||
    t.includes("PAYLATER") ||
    t.includes("SPAYLATER")
  ) {
    return "Kredit";
  }

  // 5. Deteksi Tunai
  if (t.includes("TUNAI") || t.includes("CASH")) {
    return "Tunai";
  }

  return "Tunai";
}

/**
 * Ekstraksi rincian bahan bakar BBM (Liter & Harga per liter) jika bukti berasal dari SPBU.
 */
export function ekstrakRincianBbm(teks: string, totalNominal?: number): RincianBarangJasa | undefined {
  const polaVolume = /(?:VOL(?:UME)?|QTY|JUMLAH)?[:\s]*([0-9]{1,3}[.,][0-9]{1,3})\s*(?:L|LTR|LITER)\b/i;
  const mVol = teks.match(polaVolume);
  if (!mVol) return undefined;

  const rawVol = mVol[1].replace(",", ".");
  const liter = parseFloat(rawVol);
  if (isNaN(liter) || liter <= 0 || liter > 500) return undefined;

  const polaHargaLiter = /(?:HARGA(?:\s*\/\s*LITER|\s*PER\s*LITER)?|TARIF|@)\s*[:\s]*(?:Rp\.?|IDR)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+)/i;
  const mHarga = teks.match(polaHargaLiter);
  let hargaLiter = 0;
  if (mHarga) {
    const n = uraikanNominalRupiah(mHarga[1]);
    if (n && n >= 5000 && n <= 50000) {
      hargaLiter = n;
    }
  }

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
 * Memeriksa apakah suatu baris teks merupakan 'sampah' OCR atau label non-toko.
 */
function apakahBarisSampah(b: string): boolean {
  if (!b || b.length < 3) return true;

  // Baris yang hanya simbol / karakter non-huruf
  const huruf = b.replace(/[^a-zA-Z]/g, "");
  if (huruf.length < 3) return true;

  // Rasio karakter sampah tinggi (> 40%)
  const rasioSampah = (b.length - huruf.length) / b.length;
  if (rasioSampah > 0.5) return true;

  // Baris header/logo/noise QRIS
  if (/^(?:[BGMQ]?RIS|QR\s*CODE|STANDAR\s*PEMBAYARAN|PEMBAYARAN\s*NASIONAL|GPN|BANK\s*INDONESIA|ASPI|NMID)/i.test(b)) {
    return true;
  }

  // Label transaksi / header struk umum
  if (/\b(?:STRUK|NOTA|BUKTI|SELAMAT\s*DATANG|THANK\s*YOU|TERIMA\s*KASIH|INVOICE|FAKTUR|TAGIHAN|RECEIPT|BILL|DETAIL\s*TRANSAKSI|RINCIAN\s*TRANSAKSI|PACKAGE\s*PURCHASE|STATUS|INFORMASI|BERHASIL|SUCCESS|SELESAI|ID\s*TRANSAKSI)\b/i.test(b)) {
    return true;
  }

  // Header identitas KTP
  if (/\b(?:PROVINSI|KABUPATEN|KOTA|KECAMATAN|KELURAHAN|DESA|RTRW|KARTU\s*TANDA\s*PENDUDUK|REPUBLIK\s*INDONESIA|NIK|GOL\.?\s*DARAH|JENIS\s*KELAMIN|TEMPAT|TGL\s*LAHIR|AGAMA|STATUS\s*PERKAWINAN|PEKERJAAN|KEWARGANEGARAAN|BERLAKU\s*HINGGA)\b/i.test(b)) {
    return true;
  }

  // Status pesanan / antrean
  if (/^(?:BAWA\s*PULANG|TAKE\s*AWAY|DINE\s*IN|MAKAN\s*DI\s*TEMPAT|DELIVERY|ANTREAN|NOMOR\s*ANTRIAN|ORDER\s*TYPE)/i.test(b)) {
    return true;
  }

  // Baris data teknis struk
  if (/^(?:NOMOR|NO\.?|WAKTU|TANGGAL|TGL|OPERATOR|KASIR|SALURAN|NAMA\s*PRODUK|HARGA|JUMLAH|SUBTOTAL|TOTAL|METODE)/i.test(b)) {
    return true;
  }

  // Baris footer / customer service
  if (/(?:PENDAPAT\s*ANDA|KRITIK|SARAN|HUBUNGI|LAYANAN|KEMITRAAN|PARTNERSHIP)/i.test(b)) {
    return true;
  }

  // Alamat panjang
  if (/^(?:JL\.|JALAN|KEC\.|KABUPATEN|KOTA|PROVINSI)/i.test(b)) {
    return true;
  }

  return false;
}

/**
 * Membersihkan nama toko dari karakter artefak OCR.
 */
function bersihkanNamaToko(nama: string): string {
  return nama
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[^a-zA-Z0-9\.\-]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Deteksi KTP / Identitas kependudukan untuk pelaporan SPJ administrasi honorarium/perdiem.
 */
export function deteksiDokumenKtp(teksMentah: string, barisDaftar: string[]): {
  isKtp: boolean;
  namaLengkap?: string;
  nik?: string;
  kabupatenKota?: string;
  kecamatan?: string;
} {
  const t = teksMentah.toUpperCase();

  const adaNik =
    /\b(?:N[\.\s]*I[\.\s]*K|KTP|TANDA\s*PENDUDUK)\b/i.test(t) ||
    /\b[0-9]{15,16}\b/.test(t) ||
    /[A-Z0-9]{2}[0-9]{14}/.test(t);

  const kataKunci = [
    /\bPROVINSI\b/,
    /\b(?:KABUPATEN|KOTA)\b/,
    /\bKECAMATAN\b/,
    /\b(?:KEL\/DESA|KELURAHAN|DESA)\b/,
    /\b(?:TEMPAT|TGL\s*LAHIR|LAHIR)\b/,
    /\b(?:JENIS\s*KELAMIN|PEREMPUAN|LAKI-LAKI)\b/,
    /\b(?:GOL\.?\s*DARAH|DARAH)\b/,
    /\b(?:AGAMA|KRISTEN|ISLAM|KATOLIK|HINDU|BUDDHA)\b/,
    /\b(?:STATUS\s*PERKAWINAN|KAWIN|BELUM\s*KAWIN)\b/,
    /\b(?:PEKERJAAN|RUMAH\s*TANGGA|PELAJAR|WIRASWASTA|PETANI|PEGAWAI)\b/,
    /\b(?:KEWARGANEGARAAN|WNI)\b/,
    /\b(?:BERLAKU\s*HINGGA|SEUMUR\s*HIDUP)\b/,
    /\bRT[\s\/\.]*RW\b/,
  ];

  let skor = 0;
  for (const p of kataKunci) {
    if (p.test(t)) skor++;
  }

  const isKtp = (adaNik && skor >= 2) || skor >= 4;
  if (!isKtp) return { isKtp: false };

  // 1. Ekstrak Nama Warga / Kader
  let namaLengkap: string | undefined;
  const mNama = teksMentah.match(/(?:Nama|NAMA)\s*[:\s]*([^\r\n]{2,35})/i);
  if (mNama && mNama[1].trim()) {
    const barisPertamaNama = mNama[1].split(/[\r\n]/)[0].replace(/[\d\(\)]+/g, "").trim();
    if (barisPertamaNama.length >= 2) {
      namaLengkap = barisPertamaNama;
    }
  }

  // Jika pola Nama belum dapat, cari baris tepat setelah NIK
  if (!namaLengkap) {
    const idxNik = barisDaftar.findIndex((b) => /\b(NIK|N\.I\.K)\b/i.test(b));
    if (idxNik >= 0 && idxNik + 1 < barisDaftar.length) {
      for (let j = idxNik + 1; j <= Math.min(idxNik + 3, barisDaftar.length - 1); j++) {
        const kandidat = barisDaftar[j].replace(/^[-=:\s]+/, "").trim();
        if (
          kandidat.length >= 3 &&
          !/^(?:TEMPAT|TGL|JENIS|PEREMPUAN|LAKI|ALAMAT|RT|KEL|KEC|AGAMA|STATUS|PEKERJAAN|NIK)/i.test(kandidat)
        ) {
          namaLengkap = kandidat.replace(/[\d\(\)]+/g, "").trim();
          break;
        }
      }
    }
  }

  // 2. Ekstrak NIK jika tertera
  let nik: string | undefined;
  const mNik = teksMentah.match(/(?:NIK|N\.I\.K)?\s*[:\s]*([A-Za-z0-9]{15,18})/i);
  if (mNik) {
    nik = mNik[1].replace(/[^0-9]/g, "");
  }

  // 3. Ekstrak Kecamatan / Kabupaten
  let kecamatan: string | undefined;
  const mKec = teksMentah.match(/Kecamatan\s*[:\s]*([A-Za-z\s]{3,25})/i);
  if (mKec) kecamatan = mKec[1].trim();

  let kabupatenKota: string | undefined;
  const mKab = teksMentah.match(/(?:KABUPATEN|KOTA)\s*([A-Za-z\s]{3,25})/i);
  if (mKab) kabupatenKota = mKab[1].trim();

  return {
    isKtp: true,
    namaLengkap: namaLengkap || "Warga / Kader",
    nik,
    kabupatenKota,
    kecamatan,
  };
}

/**
 * Deteksi Tiket Speedboat / Angkutan Air (Kalimantan Utara & Nasional).
 */
export function deteksiTiketTransportAir(teksMentah: string, barisDaftar: string[]): {
  isTiketAir: boolean;
  armada?: string;
  rute?: string;
  nominalTarif?: number;
} {
  const t = teksMentah.toUpperCase();

  const polaArmada = /\b(RA\s*NIKLAS|NIKLAS\s*EXPRESS|MENARA\s*AS|MENARA\s*NIKLAS|MENARA\s*STHOL|SB\.?\s*MENARA|MERANA|TRISNA\s*EXPRESS|GULA-GULA|MALINAU\s*EXPRESS|SADADEWA|INDAH\s*JAYA|KALTARA\s*EXPRESS|NONI\s*EXPRESS|HARAPAN\s*BARU|TRI\s*PUTRI|SPEEDBOAT|SPEED\s*BOAT)\b/i;
  const polaRute = /\b(TARAKAN|TANJUNG\s*SELOR|TG\.?\s*SELOR|NUNUKAN|MALINAU|SEBATIK|BUNYU|SUNGAI\s*NYAMUK|TIDENG\s*PALE)\b/i;
  const polaTiket = /\b(PENUMPANG\s*LOKET|PASSENGER\s*TICKET|HARGA\s*TIKET|HARGATIKET|TIKET\s*SUDAH|JASA\s*RAHARJA|CARTERAN|KEBERANGKATAN|KEDATANGAN|KEDATA|ARRIVA|ARRIVAL|DEPARTURE|DERMAGA|PELABUHAN)\b/i;
  const polaPrefixSb = /^\s*\(?[Ss][Bb]\.\s*/;

  const adaPrefixSb = barisDaftar.some((b) => polaPrefixSb.test(b));
  const adaArmada = polaArmada.test(t);
  const adaRute = polaRute.test(t);
  const adaTiket = polaTiket.test(t);

  const isTiketAir = adaArmada || (adaPrefixSb && (adaRute || adaTiket)) || (adaRute && adaTiket) || (/KEBERANGKATAN|KEDATANGAN|KEDATA/i.test(t) && /MERANA|MENARA|DERMAGA/i.test(t));
  if (!isTiketAir) return { isTiketAir: false };

  // Identifikasi Armada
  let armada: string | undefined;
  if (/RA\s*NIKLAS/i.test(t)) {
    armada = "RA NIKLAS EXPRESS";
  } else if (/MENARA\s*AS/i.test(t)) {
    armada = "SB. MENARA AS EXPRESS";
  } else if (/MENARA\s*NIKLAS|MENARA\s*STHOL/i.test(t)) {
    armada = "SB. MENARA NIKLAS";
  } else if (/MERANA/i.test(t)) {
    armada = "SB. MENARA EXPRESS";
  } else if (/TRISNA/i.test(t)) {
    armada = "SB. TRISNA EXPRESS";
  } else if (/MALINAU\s*EXPRESS/i.test(t)) {
    armada = "SB. MALINAU EXPRESS";
  } else if (/GULA-GULA/i.test(t)) {
    armada = "SB. GULA-GULA";
  } else if (adaPrefixSb) {
    const bSb = barisDaftar.find((b) => polaPrefixSb.test(b));
    if (bSb) armada = bersihkanNamaToko(bSb);
  } else {
    for (let i = 0; i < Math.min(3, barisDaftar.length); i++) {
      if (!apakahBarisSampah(barisDaftar[i])) {
        armada = bersihkanNamaToko(barisDaftar[i]);
        break;
      }
    }
  }

  // Identifikasi Rute
  let rute: string | undefined;
  const mTujuan = teksMentah.match(/(?:TUJUAN|RUTE|DARI|KE)[:\s]*([^\r\n]{4,35})/i);
  if (mTujuan && mTujuan[1].trim()) {
    rute = bersihkanNamaToko(mTujuan[1]);
  } else {
    // Cari kota asal - tujuan
    const kota = ["TARAKAN", "TANJUNG SELOR", "TG. SELOR", "NUNUKAN", "MALINAU", "SEBATIK"];
    const kotaDitemukan = kota.filter((k) => t.includes(k));
    if (kotaDitemukan.length >= 2) {
      rute = `${kotaDitemukan[0]} - ${kotaDitemukan[1]}`;
    } else if (kotaDitemukan.length === 1) {
      rute = kotaDitemukan[0];
    }
  }

  return {
    isTiketAir: true,
    armada: armada || "Speedboat Express",
    rute,
  };
}

/**
 * Deteksi Tiket Pesawat / Boarding Pass (Penerbangan Perintis / Komersial).
 */
export function deteksiTiketPesawat(teksMentah: string, barisDaftar: string[]): {
  isPesawat: boolean;
  maskapai?: string;
  penumpang?: string;
} {
  const t = teksMentah.toUpperCase();

  const polaBoarding = /\b(BOARDING\s*PASS|BOARDING\s*P-|BOARDING|PASSENGER\s*TICKET|E-TICKET)\b/i;
  const polaWaktuFlight = /\b(?:DEPART\s*TIME|ARRIVE\s*TIME|FLIGHT\s*NO|FLIGHT|SEAT|GATE)\b/i;
  const polaMaskapai = /\b(SUSI\s*AIR|SMART\s*AVIATION|SAM\s*AIR|LION\s*AIR|BATIK\s*AIR|WINGS\s*AIR|GARUDA|CITILINK|SUPER\s*AIR\s*JET|PELITA\s*AIR)\b/i;

  const isPesawat = polaBoarding.test(t) || (polaWaktuFlight.test(t) && /AIR|FLIGHT|BANDARA|AIRPORT/i.test(t)) || polaMaskapai.test(t);
  if (!isPesawat) return { isPesawat: false };

  // Identifikasi Maskapai
  let maskapai: string | undefined;
  if (/SUSI\s*AIR/i.test(t)) maskapai = "Susi Air";
  else if (/SMART\s*AVIATION/i.test(t)) maskapai = "Smart Aviation";
  else if (/SAM\s*AIR/i.test(t)) maskapai = "SAM Air";
  else if (/WINGS\s*AIR/i.test(t)) maskapai = "Wings Air";
  else if (/BATIK\s*AIR/i.test(t)) maskapai = "Batik Air";
  else if (/LION\s*AIR/i.test(t)) maskapai = "Lion Air";
  else if (/GARUDA/i.test(t)) maskapai = "Garuda Indonesia";
  else if (/CITILINK/i.test(t)) maskapai = "Citilink";
  else if (/SUPER\s*AIR\s*JET/i.test(t)) maskapai = "Super Air Jet";

  // Identifikasi Penumpang
  let penumpang: string | undefined;
  const mName = teksMentah.match(/(?:Name|Passenger\s*Name|Nama)[:\s\d]*([^\r\n]{3,30})/i);
  if (mName && mName[1].trim()) {
    const rawName = mName[1].split(/[\r\n]/)[0].trim();
    if (!/^(?:DEPART|ARRIVE|FLIGHT|DATE|TIME|BOARDING|ATI\b|M\/F)/i.test(rawName)) {
      penumpang = bersihkanNamaToko(rawName);
    }
  }

  return {
    isPesawat: true,
    maskapai: maskapai || "Penerbangan",
    penumpang,
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

  // Deteksi dokumen khusus lapangan
  const ktp = deteksiDokumenKtp(teksMentah, baris);
  const tiketAir = !ktp.isKtp ? deteksiTiketTransportAir(teksMentah, baris) : { isTiketAir: false };
  const tiketPesawat = !ktp.isKtp && !tiketAir.isTiketAir ? deteksiTiketPesawat(teksMentah, baris) : { isPesawat: false };

  // KASUS 0: Dokumen KTP / Identitas Warga (Lampiran SPJ Honorarium/Perdiem/Fasilitasi)
  if (ktp.isKtp) {
    jenisBukti = "Bukti tidak lengkap";
    kategoriPribadi = "Lain-lain";
    kategoriKegiatan = "Honorarium & Ganti Hari";
    namaPenjualPenyedia = ktp.namaLengkap || "Warga / Kader";
    kataKunciDeskripsi = "Identitas Penerima";
    deskripsiKustom = `KTP - ${ktp.namaLengkap || "Warga/Kader"} (Identitas Penerima)`;
    keteranganLaporanKustom = `Lampiran identitas KTP penerima (${ktp.namaLengkap || "Warga/Kader"}${ktp.kecamatan ? ` - Kec. ${ktp.kecamatan}` : ""}) untuk kelengkapan administrasi kegiatan.`;
  }
  // KASUS 0B: Tiket Speedboat / Angkutan Air (Kaltara & Nasional)
  else if (tiketAir.isTiketAir) {
    jenisBukti = "Tiket";
    kategoriPribadi = "Transportasi";
    kategoriKegiatan = "Transportasi";
    namaPenjualPenyedia = tiketAir.armada || "Speedboat Express";
    kataKunciDeskripsi = "Tiket Speedboat";
    const ruteTeks = tiketAir.rute ? ` (${tiketAir.rute})` : "";
    deskripsiKustom = `${tiketAir.armada || "Speedboat"} - Tiket Transportasi Air${ruteTeks}`;
    keteranganLaporanKustom = `Biaya transportasi perjalanan speedboat dengan ${tiketAir.armada || "Speedboat"}${tiketAir.rute ? ` rute ${tiketAir.rute}` : ""} untuk operasional kegiatan.`;
  }
  // KASUS 0C: Tiket Pesawat / Boarding Pass
  else if (tiketPesawat.isPesawat) {
    jenisBukti = "Tiket pesawat/e-ticket";
    kategoriPribadi = "Transportasi";
    kategoriKegiatan = "Transportasi";
    namaPenjualPenyedia = tiketPesawat.maskapai || (tiketPesawat.penumpang ? `Penerbangan (${tiketPesawat.penumpang})` : "Maskapai Penerbangan");
    kataKunciDeskripsi = "Tiket Pesawat";
    deskripsiKustom = `Tiket Pesawat / Boarding Pass${tiketPesawat.penumpang ? ` - ${tiketPesawat.penumpang}` : ""}`;
    keteranganLaporanKustom = `Biaya tiket pesawat / boarding pass untuk transportasi dinas kegiatan${tiketPesawat.penumpang ? ` atas nama ${tiketPesawat.penumpang}` : ""}.`;
  }

  // A. Operator Telekomunikasi & Paket Data / Internet / Pulsa
  else if (
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

    if (teksBesar.includes("PERTALITE")) jenisBBM = "Pertalite";
    else if (teksBesar.includes("PERTAMAX TURBO")) jenisBBM = "Pertamax Turbo";
    else if (teksBesar.includes("PERTAMAX")) jenisBBM = "Pertamax";
    else if (teksBesar.includes("DEXLITE")) jenisBBM = "Dexlite";
    else if (teksBesar.includes("PERTAMINA DEX")) jenisBBM = "Pertamina Dex";
    else if (teksBesar.includes("SOLAR") || teksBesar.includes("BIOSOLAR")) jenisBBM = "Solar";
    else if (teksBesar.includes("SHELL SUPER")) jenisBBM = "Shell Super";
    else if (teksBesar.includes("V-POWER")) jenisBBM = "Shell V-Power";

    const mSpbu = teksMentah.match(/(?:SPBU\s*)?([0-9]{2}[\.\-][0-9]{3,5})/i);
    const noSpbu = mSpbu ? ` ${mSpbu[1]}` : "";
    namaPenjualPenyedia = `SPBU Pertamina${noSpbu}`;
    kataKunciDeskripsi = jenisBBM ? `BBM ${jenisBBM}` : "BBM";
  }

  // B. Minimarket (Indomaret, Alfamart, Alfamidi, Superindo)
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

  // C. Brand Makanan / Minuman Populer Indonesia
  else if (teksBesar.includes("MIE GACOAN") || teksBesar.includes("GACOAN")) {
    // Cari cabang spesifik jika ada: mis. "Mie Gacoan Bulungan - Sengkawit"
    const mGacoan = teksMentah.match(/Mie\s*Gacoan[^\r\n]*/i);
    if (mGacoan) {
      let nama = mGacoan[0].trim();
      const idxG = baris.findIndex((b) => b.includes(mGacoan[0]));
      if (idxG >= 0 && idxG + 1 < baris.length && baris[idxG + 1].startsWith("-")) {
        nama += ` ${baris[idxG + 1].trim()}`;
      }
      namaPenjualPenyedia = bersihkanNamaToko(nama);
    } else {
      namaPenjualPenyedia = "Mie Gacoan";
    }
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makanan & Minuman";
  } else if (
    teksBesar.includes("MOMOYO") ||
    (/TJ\.?\s*SELOR/i.test(teksBesar) && (teksBesar.includes("MILK TEA") || teksBesar.includes("SUGAR") || teksBesar.includes("BOOM") || teksBesar.includes("GULA AREN")))
  ) {
    namaPenjualPenyedia = "Momoyo Tj Selor";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Minuman & Es Krim";
  } else if (teksBesar.includes("MIXUE")) {
    namaPenjualPenyedia = "Mixue";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Minuman & Es Krim";
  } else if (teksBesar.includes("KOPI KENANGAN")) {
    namaPenjualPenyedia = "Kopi Kenangan";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Kopi & Minuman";
  } else if (teksBesar.includes("JANJI JIWA")) {
    namaPenjualPenyedia = "Janji Jiwa";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Kopi & Minuman";
  } else if (teksBesar.includes("POINT COFFEE")) {
    namaPenjualPenyedia = "Point Coffee";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Kopi & Minuman";
  } else if (teksBesar.includes("CHATIME")) {
    namaPenjualPenyedia = "Chatime";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Minuman";
  } else if (teksBesar.includes("HAUS!")) {
    namaPenjualPenyedia = "Haus!";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Minuman";
  } else if (teksBesar.includes("FORE COFFEE") || teksBesar.includes("FORE")) {
    namaPenjualPenyedia = "Fore Coffee";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Kopi";
  } else if (teksBesar.includes("KFC") || teksBesar.includes("KENTUCKY FRIED CHICKEN")) {
    namaPenjualPenyedia = "KFC";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makanan";
  } else if (teksBesar.includes("MCDONALD")) {
    namaPenjualPenyedia = "McDonald's";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makanan";
  } else if (teksBesar.includes("RICHEESE")) {
    namaPenjualPenyedia = "Richeese Factory";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makanan";
  } else if (teksBesar.includes("SOLARIA")) {
    namaPenjualPenyedia = "Solaria";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makanan";
  } else if (teksBesar.includes("HOKBEN") || teksBesar.includes("HOKA HOKA BENTO")) {
    namaPenjualPenyedia = "HokBen";
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makanan";
  }

  // D. Restoran / Kafe / Rumah Makan Umum
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
    teksBesar.includes("DINE IN") ||
    teksBesar.includes("TABLE") ||
    teksBesar.includes("MEJA") ||
    teksBesar.includes("MILK TEA") ||
    teksBesar.includes("TEA BOOM")
  ) {
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kategoriPribadi = "Makan & Minum";
    kategoriKegiatan = "Konsumsi";
    kataKunciDeskripsi = "Konsumsi Makan & Minum";

    const mMerch = teksMentah.match(/(?:MERCHANT|NAMA\s*MERCHANT|BAYAR\s*KE)[:\s]*([^\r\n]{3,40})/i);
    if (mMerch && mMerch[1].trim()) {
      namaPenjualPenyedia = bersihkanNamaToko(mMerch[1]);
    } else {
      for (let i = 0; i < Math.min(4, baris.length); i++) {
        const b = baris[i];
        if (!apakahBarisSampah(b)) {
          namaPenjualPenyedia = bersihkanNamaToko(b);
          break;
        }
      }
    }
  }

  // E. Kuitansi
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

    const mPenerima = teksMentah.match(/(?:Diterima\s*Oleh|Tanda\s*Tangan\s*Penerima|Yang\s*Menerima)[:\s]*([A-Za-z\s\.,]{3,35})/i);
    if (mPenerima && mPenerima[1].trim()) {
      namaPenjualPenyedia = bersihkanNamaToko(mPenerima[1]);
    }
  }

  // F. Tiket & Karcis (Pesawat, Speedboat, Kapal, Travel, Parkir)
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
      if (!apakahBarisSampah(baris[i]) && !/BOARDING|PASSENGER|TIKET/i.test(baris[i])) {
        namaPenjualPenyedia = bersihkanNamaToko(baris[i]);
        break;
      }
    }
  }

  // G. Bukti Transfer Bank
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

    const mPen = teksMentah.match(/(?:Nama\s*Penerima|Ke\s*Rekening|Tujuan)[:\s]*([A-Za-z\s\.,]{3,35})/i);
    if (mPen && mPen[1].trim()) {
      namaPenjualPenyedia = bersihkanNamaToko(mPen[1]);
    }
  }

  // H. Bukti Pembayaran QRIS / QR Screen
  else if (
    teksBesar.includes("QRIS") ||
    teksBesar.includes("NMID") ||
    teksBesar.includes("STANDAR PEMBAYARAN") ||
    /^(?:BRIS|GRIS|RIS)\b/i.test(baris[0] || "")
  ) {
    jenisBukti = "Struk thermal (minimarket/SPBU)";
    kataKunciDeskripsi = "Pembayaran QRIS";

    // Cari nama merchant setelah kata 'Merchant' atau baris atas non-banner
    const mMerch = teksMentah.match(/(?:Merchant|Bayar\s*Ke)[:\s]*([^\r\n]{3,40})/i);
    if (mMerch && mMerch[1].trim()) {
      namaPenjualPenyedia = bersihkanNamaToko(mMerch[1]);
    } else {
      // Ambil baris pertama yang bersih dan bukan banner QRIS / GPN
      for (let i = 0; i < baris.length; i++) {
        const b = baris[i];
        if (!apakahBarisSampah(b) && !/TOTAL|RP/i.test(b)) {
          let nama = b;
          if (i + 1 < baris.length && baris[i + 1].startsWith("-")) {
            nama += ` ${baris[i + 1]}`;
          }
          namaPenjualPenyedia = bersihkanNamaToko(nama);
          break;
        }
      }
    }
  }

  // I. Nota Toko / ATK / Bahan Bangunan
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

    if (baris.length > 0 && !apakahBarisSampah(baris[0])) {
      namaPenjualPenyedia = bersihkanNamaToko(baris[0]);
    }
  }

  // J. Invoice / Faktur
  else if (
    teksBesar.includes("INVOICE") ||
    teksBesar.includes("FAKTUR") ||
    teksBesar.includes("TAGIHAN")
  ) {
    jenisBukti = "Invoice + kuitansi";
    kataKunciDeskripsi = "Invoice Tagihan";
    kategoriPribadi = "Tagihan & Sewa";
    kategoriKegiatan = "Pengadaan Barang & Perlengkapan";

    for (let i = 0; i < Math.min(4, baris.length); i++) {
      const b = baris[i];
      if (!apakahBarisSampah(b) && !/^(INVOICE|FAKTUR|TAGIHAN|KEPADA|NO\.?)/i.test(b)) {
        namaPenjualPenyedia = bersihkanNamaToko(b);
        break;
      }
    }
  }

  // Fallback: Jika belum terdeteksi nama penyedia, cari baris bersih di awal dokumen
  if (!namaPenjualPenyedia && baris.length > 0) {
    for (let i = 0; i < Math.min(5, baris.length); i++) {
      const b = baris[i];
      if (!apakahBarisSampah(b)) {
        namaPenjualPenyedia = bersihkanNamaToko(b);
        break;
      }
    }
  }

  // 2. Ekstraksi Nominal
  let nominalUtama: number | null = null;
  let kandidat: KandidatNominal[] = [];

  if (ktp.isKtp) {
    // Pada KTP, angka adalah NIK / tahun / RT RW dan BUKAN nominal transaksi!
    nominalUtama = null;
    kandidat = [];
    peringatan.push(
      `Dokumen terdeteksi sebagai KTP/Identitas kependudukan (${ktp.namaLengkap || "Warga/Kader"}). Nominal transaksi tidak tertera pada KTP, silakan masukkan jumlah pembayaran/honorarium secara manual sesuai kuitansi/tanda terima.`
    );
  } else {
    const hasilNominal = ekstrakKandidatNominal(baris, opsi.nominalQrisTerverifikasi);
    nominalUtama = hasilNominal.utama;
    kandidat = hasilNominal.kandidat;

    if (!nominalUtama) {
      peringatan.push("Nominal transaksi tidak terdeteksi otomatis. Harap isi jumlah pada formulir secara manual.");
    }
  }

  // 3. Ekstraksi Tanggal
  const { tanggal, ditemukan: tanggalDitemukan } = ekstrakTanggalTransaksi(teksMentah);
  const todayIso = new Date().toISOString().slice(0, 10);
  const tanggalFinal = tanggal || todayIso;

  if (!tanggalDitemukan) {
    peringatan.push("Tanggal transaksi tidak tertera jelas pada bukti, otomatis disetel ke tanggal hari ini.");
  }

  // 4. Ekstraksi Metode Pembayaran
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
