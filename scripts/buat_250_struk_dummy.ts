/**
 * Generator 250 Bukti Transaksi Dummy Indonesia
 * Termasuk:
 * - 1-100: 100 Struk Kasir & Kwitansi Cetak Beragam
 * - 101-160: 60 Kwitansi & Tanda Terima Tulisan Tegak Bersambung / Cursive
 * - 161-200: 40 Nota Kontan Pasar & Bon Warung Tradisional Bertuliskan Tangan
 * - 201-230: 30 Transaksi Pembayaran Lanjutan (GPN Debit, EDC, BI-FAST, VA, QRIS, PayLater, Tunai)
 * - 231-250: 20 Ekspedisi, Tiket & Tagihan Utilitas (JNE, J&T, SiCepat, Pos, PDAM, BPJS, PBB, Pelni, KAI)
 */

import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { data100Struk, ItemStruk100 } from "./buat_100_struk_dummy";

export interface ItemStruk250 extends ItemStruk100 {}

export const data250Struk: ItemStruk250[] = [...data100Struk];

// Helper: Kwitansi Tulisan Tegak Bersambung (Cursive Handwriting)
function kwitansiTangan(params: {
  nomor: string;
  telahDiterima: string;
  uangSejumlah: string;
  untukPembayaran: string;
  terbilangNominal: string;
  kotaTgl: string;
  penerima: string;
  metodeLabel?: string;
  warnaTema?: string;
  bgWarna?: string;
  fontTangan?: string;
}): string {
  const {
    nomor,
    telahDiterima,
    uangSejumlah,
    untukPembayaran,
    terbilangNominal,
    kotaTgl,
    penerima,
    metodeLabel = "LUNAS CASH",
    warnaTema = "#1b3a4b",
    bgWarna = "#fcfaf2",
    fontTangan = "Segoe Script, Brush Script MT, Comic Sans MS, cursive",
  } = params;

  return `
    <rect width="720" height="430" fill="${bgWarna}" rx="8" />
    <rect x="12" y="12" width="696" height="406" fill="none" stroke="${warnaTema}" stroke-width="2" rx="6" />
    <rect x="18" y="18" width="684" height="394" fill="none" stroke="${warnaTema}" stroke-width="0.8" stroke-dasharray="6,3" />

    <!-- Header Kwitansi -->
    <text x="360" y="55" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="${warnaTema}" text-anchor="middle" letter-spacing="3">KWITANSI TANDA TERIMA</text>
    <text x="40" y="85" font-family="Courier New, monospace" font-size="13" font-weight="bold" fill="#333">No. ${nomor}</text>

    <!-- Baris 1: Telah Diterima Dari -->
    <text x="40" y="125" font-family="Arial, sans-serif" font-size="13" fill="#444">Telah diterima dari</text>
    <text x="180" y="125" font-family="Arial, sans-serif" font-size="13" fill="#444">:</text>
    <line x1="195" y1="130" x2="670" y2="130" stroke="#888" stroke-dasharray="2,2" stroke-width="1" />
    <text x="205" y="123" font-family="${fontTangan}" font-size="17" font-weight="bold" fill="#0d2b45">${telahDiterima}</text>

    <!-- Baris 2: Uang Sejumlah (Terbilang Tulisan Tegak Bersambung) -->
    <text x="40" y="168" font-family="Arial, sans-serif" font-size="13" fill="#444">Uang Sejumlah</text>
    <text x="180" y="168" font-family="Arial, sans-serif" font-size="13" fill="#444">:</text>
    <rect x="195" y="145" width="475" height="48" fill="#f0ede1" rx="4" stroke="#d5cebe" />
    <text x="205" y="174" font-family="${fontTangan}" font-size="16" font-style="italic" font-weight="600" fill="#14213d">${uangSejumlah}</text>

    <!-- Baris 3: Untuk Pembayaran -->
    <text x="40" y="222" font-family="Arial, sans-serif" font-size="13" fill="#444">Untuk Pembayaran</text>
    <text x="180" y="222" font-family="Arial, sans-serif" font-size="13" fill="#444">:</text>
    <line x1="195" y1="227" x2="670" y2="227" stroke="#888" stroke-dasharray="2,2" stroke-width="1" />
    <text x="205" y="220" font-family="${fontTangan}" font-size="15" fill="#1f2937">${untukPembayaran}</text>

    <!-- Kotak Jumlah Nominal Angka Tulis Tangan -->
    <rect x="40" y="275" width="260" height="54" fill="#ffffff" stroke="${warnaTema}" stroke-width="2.5" rx="5" />
    <text x="52" y="312" font-family="${fontTangan}" font-size="24" font-weight="bold" fill="#0b2545">${terbilangNominal}</text>

    <!-- Stempel LUNAS Cap Basah Bulat Merah / Biru -->
    <circle cx="370" cy="315" r="42" fill="none" stroke="#b91c1c" stroke-width="3" opacity="0.85" />
    <circle cx="370" cy="315" r="37" fill="none" stroke="#b91c1c" stroke-width="1" stroke-dasharray="4,2" opacity="0.85" />
    <text x="370" y="312" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="middle" opacity="0.88">${metodeLabel}</text>
    <text x="370" y="328" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#b91c1c" text-anchor="middle" opacity="0.88">LUNAS / VERIFIED</text>

    <!-- Tanggal & Tanda Tangan Penerima -->
    <text x="560" y="272" font-family="Arial, sans-serif" font-size="12" fill="#333" text-anchor="middle">${kotaTgl}</text>
    <text x="560" y="290" font-family="Arial, sans-serif" font-size="11" fill="#666" text-anchor="middle">Yang Menerima,</text>
    <!-- Goresan tanda tangan (signature wave) -->
    <path d="M 500 330 Q 525 295 550 335 T 600 320 T 630 335" fill="none" stroke="#003566" stroke-width="2.5" />
    <line x1="490" y1="365" x2="640" y2="365" stroke="#333" stroke-width="1.2" />
    <text x="565" y="385" font-family="${fontTangan}" font-size="16" font-weight="bold" fill="#000814" text-anchor="middle">( ${penerima} )</text>
  `;
}

// Helper: Nota Kontan Pasar / Bon Warung Tradisional Bertuliskan Tangan
function notaPasarTangan(params: {
  toko: string;
  bidang: string;
  alamat: string;
  tanggal: string;
  tuanToko: string;
  items: { banyaknya: string; nama: string; harga: string; jumlah: string }[];
  totalTeks: string;
  lunasCap?: string;
  warnaKertas?: string;
  warnaGaris?: string;
}): string {
  const {
    toko,
    bidang,
    alamat,
    tanggal,
    tuanToko,
    items,
    totalTeks,
    lunasCap = "LUNAS",
    warnaKertas = "#fffdfa",
    warnaGaris = "#c0392b",
  } = params;

  let y = 145;
  let rowsHtml = "";
  for (const it of items) {
    rowsHtml += `
      <text x="35" y="${y}" font-family="Segoe Script, cursive" font-size="14" fill="#1a365d" text-anchor="middle">${it.banyaknya}</text>
      <text x="75" y="${y}" font-family="Segoe Script, cursive" font-size="14" fill="#1a365d">${it.nama}</text>
      <text x="315" y="${y}" font-family="Segoe Script, cursive" font-size="14" fill="#1a365d" text-anchor="end">${it.harga}</text>
      <text x="445" y="${y}" font-family="Segoe Script, cursive" font-size="14" font-weight="bold" fill="#1a365d" text-anchor="end">${it.jumlah}</text>
      <line x1="20" y1="${y + 6}" x2="460" y2="${y + 6}" stroke="${warnaGaris}" stroke-width="0.7" stroke-dasharray="2,2" />
    `;
    y += 26;
  }

  return `
    <rect width="480" height="540" fill="${warnaKertas}" rx="6" />
    <rect x="8" y="8" width="464" height="524" fill="none" stroke="${warnaGaris}" stroke-width="1.8" rx="4" />

    <!-- Header Toko -->
    <text x="240" y="38" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="${warnaGaris}" text-anchor="middle">${toko}</text>
    <text x="240" y="56" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#333" text-anchor="middle">${bidang}</text>
    <text x="240" y="70" font-family="Arial, sans-serif" font-size="10" fill="#555" text-anchor="middle">${alamat}</text>
    <line x1="20" y1="78" x2="460" y2="78" stroke="${warnaGaris}" stroke-width="2" />

    <!-- Info Nota -->
    <text x="25" y="95" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#333">NOTA KONTAN</text>
    <text x="280" y="95" font-family="Arial, sans-serif" font-size="11" fill="#333">Tgl: ${tanggal}</text>
    <text x="25" y="112" font-family="Arial, sans-serif" font-size="11" fill="#444">Kepada Yth: ${tuanToko}</text>

    <!-- Header Tabel -->
    <rect x="20" y="120" width="440" height="22" fill="#f8d7da" stroke="${warnaGaris}" stroke-width="1" />
    <text x="35" y="135" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333" text-anchor="middle">Bny</text>
    <text x="75" y="135" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333">Nama Barang</text>
    <text x="315" y="135" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333" text-anchor="end">Harga</text>
    <text x="445" y="135" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333" text-anchor="end">Jumlah</text>

    <!-- Baris-baris Barang Tulis Tangan -->
    ${rowsHtml}

    <!-- Kotak Total Akhir -->
    <line x1="20" y1="410" x2="460" y2="410" stroke="${warnaGaris}" stroke-width="1.8" />
    <text x="230" y="435" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#222">JUMLAH RP.</text>
    <rect x="330" y="416" width="125" height="28" fill="#fff" stroke="${warnaGaris}" stroke-width="1.5" />
    <text x="445" y="437" font-family="Segoe Script, cursive" font-size="17" font-weight="bold" fill="#0f172a" text-anchor="end">${totalTeks}</text>

    <!-- Cap Stempel LUNAS Merah / Violet -->
    <rect x="70" y="445" width="120" height="36" fill="none" stroke="#dc2626" stroke-width="2.5" rx="4" />
    <text x="130" y="468" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#dc2626" text-anchor="middle">${lunasCap}</text>

    <text x="380" y="480" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">Tanda Terima,</text>
    <path d="M 340 500 Q 365 480 380 505 T 415 498" fill="none" stroke="#1e3a8a" stroke-width="2" />
    <text x="380" y="520" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">( Kasir / Toko )</text>
  `;
}

// Helper: Struk EDC Mesin Kartu Debit GPN / Chip
function strukEdcDebit(params: {
  bank: string;
  merchant: string;
  mid: string;
  tid: string;
  nomorKartuMasked: string;
  tanggal: string;
  jam: string;
  batch: string;
  trace: string;
  refNo: string;
  apprCode: string;
  nominal: string;
  metode: string;
}): string {
  const { bank, merchant, mid, tid, nomorKartuMasked, tanggal, jam, batch, trace, refNo, apprCode, nominal, metode } = params;
  return `
    <rect width="420" height="600" fill="#ffffff" />
    <text x="210" y="45" font-family="Courier New, monospace" font-size="20" font-weight="bold" text-anchor="middle">${bank}</text>
    <text x="210" y="68" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">EDC TRANSACTION RECORD</text>
    <line x1="20" y1="80" x2="400" y2="80" stroke="#000" stroke-width="1.5" />

    <text x="20" y="105" font-family="Courier New, monospace" font-size="12">MERCHANT : ${merchant}</text>
    <text x="20" y="125" font-family="Courier New, monospace" font-size="12">MID : ${mid}</text>
    <text x="230" y="125" font-family="Courier New, monospace" font-size="12">TID: ${tid}</text>
    <text x="20" y="145" font-family="Courier New, monospace" font-size="12">DATE: ${tanggal}</text>
    <text x="230" y="145" font-family="Courier New, monospace" font-size="12">TIME: ${jam}</text>
    <text x="20" y="165" font-family="Courier New, monospace" font-size="12">BATCH: ${batch}</text>
    <text x="230" y="165" font-family="Courier New, monospace" font-size="12">TRACE: ${trace}</text>
    <text x="20" y="185" font-family="Courier New, monospace" font-size="12">REF NO: ${refNo}</text>
    <text x="230" y="185" font-family="Courier New, monospace" font-size="12">APPR: ${apprCode}</text>
    <line x1="20" y1="200" x2="400" y2="200" stroke="#000" stroke-dasharray="3,3" />

    <text x="20" y="230" font-family="Courier New, monospace" font-size="14" font-weight="bold">CARD: ${nomorKartuMasked}</text>
    <text x="20" y="255" font-family="Courier New, monospace" font-size="14" font-weight="bold">TYPE: ${metode}</text>
    <line x1="20" y1="275" x2="400" y2="275" stroke="#000" stroke-width="2" />

    <text x="20" y="320" font-family="Courier New, monospace" font-size="18" font-weight="bold">TOTAL</text>
    <text x="400" y="320" font-family="Courier New, monospace" font-size="20" font-weight="bold" text-anchor="end">${nominal}</text>
    <line x1="20" y1="340" x2="400" y2="340" stroke="#000" stroke-width="2" />

    <text x="210" y="380" font-family="Courier New, monospace" font-size="14" font-weight="bold" text-anchor="middle">-- TRANSACTION APPROVED --</text>
    <text x="210" y="405" font-family="Courier New, monospace" font-size="11" text-anchor="middle">PIN VERIFIED SUCCESSFULLY</text>
    <text x="210" y="425" font-family="Courier New, monospace" font-size="11" text-anchor="middle">SIGNATURE NOT REQUIRED</text>
    <text x="210" y="470" font-family="Courier New, monospace" font-size="11" text-anchor="middle">CUSTOMER COPY</text>
    <text x="210" y="490" font-family="Courier New, monospace" font-size="11" text-anchor="middle">TERIMA KASIH</text>
  `;
}

// Helper: Resi Digital M-Banking / Dompet Digital (Livin, BCA Mobile, BRImo, Seabank)
function resiDigital(params: {
  aplikasi: string;
  judulResi: string;
  nomorRef: string;
  tanggal: string;
  jam: string;
  sumberDana: string;
  tujuan: string;
  nominal: string;
  biayaAdmin?: string;
  totalBayar: string;
  catatan?: string;
  status?: string;
  warnaApp?: string;
}): string {
  const {
    aplikasi,
    judulResi,
    nomorRef,
    tanggal,
    jam,
    sumberDana,
    tujuan,
    nominal,
    biayaAdmin = "Rp 0",
    totalBayar,
    catatan,
    status = "BERHASIL",
    warnaApp = "#00529b",
  } = params;

  return `
    <rect width="460" height="650" fill="#f8fafc" rx="16" />
    <rect x="0" y="0" width="460" height="90" fill="${warnaApp}" rx="16" />
    <rect x="0" y="70" width="460" height="20" fill="${warnaApp}" />

    <!-- Header App -->
    <text x="230" y="42" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">${aplikasi}</text>
    <text x="230" y="65" font-family="Arial, sans-serif" font-size="12" fill="#e0f2fe" text-anchor="middle">${judulResi}</text>

    <!-- Kartu Status -->
    <circle cx="230" cy="130" r="26" fill="#16a34a" />
    <text x="230" y="138" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">✓</text>
    <text x="230" y="175" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#15803d" text-anchor="middle">TRANSAKSI ${status}</text>
    <text x="230" y="195" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">${tanggal} • ${jam} WIB</text>

    <!-- Kotak Detail -->
    <rect x="25" y="215" width="410" height="340" fill="#ffffff" rx="10" stroke="#e2e8f0" stroke-width="1.5" />

    <text x="45" y="245" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Nomor Referensi</text>
    <text x="415" y="245" font-family="Courier New, monospace" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="end">${nomorRef}</text>
    <line x1="45" y1="260" x2="415" y2="260" stroke="#f1f5f9" stroke-width="1.5" />

    <text x="45" y="285" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Sumber Rekening</text>
    <text x="415" y="285" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="end">${sumberDana}</text>
    <line x1="45" y1="300" x2="415" y2="300" stroke="#f1f5f9" stroke-width="1.5" />

    <text x="45" y="325" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Rekening / Tujuan</text>
    <text x="415" y="325" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="end">${tujuan}</text>
    <line x1="45" y1="340" x2="415" y2="340" stroke="#f1f5f9" stroke-width="1.5" />

    <text x="45" y="365" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Nominal Transfer</text>
    <text x="415" y="365" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="end">${nominal}</text>
    <line x1="45" y1="380" x2="415" y2="380" stroke="#f1f5f9" stroke-width="1.5" />

    <text x="45" y="405" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Biaya Administrasi</text>
    <text x="415" y="405" font-family="Arial, sans-serif" font-size="12" fill="#1e293b" text-anchor="end">${biayaAdmin}</text>
    <line x1="45" y1="420" x2="415" y2="420" stroke="#e2e8f0" stroke-width="1.5" />

    <text x="45" y="455" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">Total Transaksi</text>
    <text x="415" y="455" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="end">${totalBayar}</text>

    ${
      catatan
        ? `
      <line x1="45" y1="475" x2="415" y2="475" stroke="#f1f5f9" stroke-width="1.5" />
      <text x="45" y="500" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Catatan: ${catatan}</text>
    `
        : ""
    }

    <!-- Footer Security Badge -->
    <text x="230" y="590" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Resi ini merupakan bukti sah transaksi perbankan elektronik.</text>
    <text x="230" y="608" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">BI-FAST / GPN Standards Verified</text>
  `;
}

// Helper: Resi Ekspedisi & Tagihan Utilitas (JNE, J&T, PDAM, BPJS)
function resiUtilitas(params: {
  institusi: string;
  jenisDokumen: string;
  nomorBukti: string;
  tanggal: string;
  pelanggan: string;
  uraian: string;
  biaya: string;
  admin: string;
  total: string;
  metode: string;
  warnaTema?: string;
}): string {
  const { institusi, jenisDokumen, nomorBukti, tanggal, pelanggan, uraian, biaya, admin, total, metode, warnaTema = "#b91c1c" } = params;
  return `
    <rect width="480" height="520" fill="#ffffff" rx="8" />
    <rect x="10" y="10" width="460" height="500" fill="none" stroke="${warnaTema}" stroke-width="2" rx="6" />

    <text x="240" y="48" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="${warnaTema}" text-anchor="middle">${institusi}</text>
    <text x="240" y="68" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#333" text-anchor="middle">${jenisDokumen}</text>
    <line x1="25" y1="80" x2="455" y2="80" stroke="${warnaTema}" stroke-width="1.5" />

    <text x="30" y="110" font-family="Courier New, monospace" font-size="12">NO RESI/REF : ${nomorBukti}</text>
    <text x="450" y="110" font-family="Courier New, monospace" font-size="12" text-anchor="end">TGL: ${tanggal}</text>
    <text x="30" y="135" font-family="Courier New, monospace" font-size="12">PELANGGAN   : ${pelanggan}</text>
    <line x1="25" y1="150" x2="455" y2="150" stroke="#ccc" stroke-dasharray="3,3" />

    <text x="30" y="180" font-family="Courier New, monospace" font-size="13" font-weight="bold">URAIAN LAYANAN :</text>
    <text x="30" y="205" font-family="Courier New, monospace" font-size="13">${uraian}</text>
    <line x1="25" y1="225" x2="455" y2="225" stroke="#ccc" stroke-dasharray="3,3" />

    <text x="30" y="255" font-family="Courier New, monospace" font-size="13">TARIF DASAR</text>
    <text x="450" y="255" font-family="Courier New, monospace" font-size="13" text-anchor="end">${biaya}</text>

    <text x="30" y="280" font-family="Courier New, monospace" font-size="13">BIAYA ADMIN / ASURANSI</text>
    <text x="450" y="280" font-family="Courier New, monospace" font-size="13" text-anchor="end">${admin}</text>
    <line x1="25" y1="300" x2="455" y2="300" stroke="#000" stroke-width="2" />

    <text x="30" y="335" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL PEMBAYARAN</text>
    <text x="450" y="335" font-family="Courier New, monospace" font-size="18" font-weight="bold" fill="${warnaTema}" text-anchor="end">${total}</text>
    <line x1="25" y1="350" x2="455" y2="350" stroke="#000" stroke-width="2" />

    <text x="30" y="385" font-family="Courier New, monospace" font-size="13">METODE BAYAR : ${metode}</text>
    <text x="30" y="410" font-family="Courier New, monospace" font-size="12" fill="#555">STATUS       : LUNAS / PAID</text>

    <!-- Barcode dummy -->
    <rect x="140" y="435" width="200" height="30" fill="#000" opacity="0.8" />
    <text x="240" y="480" font-family="Courier New, monospace" font-size="11" text-anchor="middle">*${nomorBukti}*</text>
  `;
}

// ==========================================
// DAFTAR ITEM 101 HINGGA 250
// ==========================================

const dataBaru: ItemStruk250[] = [
  // ----------------------------------------------------
  // BAGIAN 1: ITEM 101 - 160 (60 KWITANSI TULIS TEGAK BERSAMBUNG)
  // ----------------------------------------------------
  {
    nomor: 101,
    berkas: "101_kwitansi_tangan_sewa_sound.png",
    judul: "Kwitansi Sewa Sound System dan Tenda Acara",
    tag: "Sewa Peralatan",
    nominalTeks: "Rp 1.750.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "101/KW-SND/XI/2026",
      telahDiterima: "Panitia Pelaksana Lokakarya Adat",
      uangSejumlah: "Satu Juta Tujuh Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Sewa Sound System 5000W & Tenda Kerucut 2 Unit (3 Hari)",
      terbilangNominal: "=Rp. 1.750.000,-=",
      kotaTgl: "Tanjung Selor, 01 November 2026",
      penerima: "Bpk. Hendra Sound",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#1e3a8a",
    }),
  },
  {
    nomor: 102,
    berkas: "102_kwitansi_tangan_honor_narasumber.png",
    judul: "Kwitansi Honorarium Narasumber Pelatihan Pemetaan",
    tag: "Honorarium",
    nominalTeks: "Rp 2.500.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "102/KW-HN/XI/2026",
      telahDiterima: "Bendahara Program Fasilitasi Lapangan",
      uangSejumlah: "Dua Juta Lima Ratus Ribu Rupiah",
      untukPembayaran: "Honorarium Pemateri Pelatihan GPS & Pemetaan Partisipatif",
      terbilangNominal: "Ry 2.500.000,-",
      kotaTgl: "Tanjung Selor, 02 November 2026",
      penerima: "Dr. Ir. Agus Suryanto",
      metodeLabel: "LUNAS TF",
      warnaTema: "#14532d",
    }),
  },
  {
    nomor: 103,
    berkas: "103_kwitansi_tangan_sewa_perahu.png",
    judul: "Kwitansi Sewa Perahu Ketinting Sungai Kayan",
    tag: "Transportasi",
    nominalTeks: "Rp 850.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "103/KW-TR/XI/2026",
      telahDiterima: "Tim Survei Lapangan",
      uangSejumlah: "Delapan Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Sewa Perahu Ketinting PP Desa Long Bia ke Hulu",
      terbilangNominal: "# 850.000 #",
      kotaTgl: "Long Bia, 03 November 2026",
      penerima: "Pak Martinus Ding",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#7c2d12",
    }),
  },
  {
    nomor: 104,
    berkas: "104_kwitansi_tangan_konsumsi_prasmanan.png",
    judul: "Kwitansi Konsumsi Prasmanan Rapat Warga",
    tag: "Konsumsi",
    nominalTeks: "Rp 1.250.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "104/KW-KONS/XI/2026",
      telahDiterima: "Panitia Musyawarah Adat",
      uangSejumlah: "Satu Juta Dua Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Penyediaan Makanan Prasmanan 50 Porsi Warga",
      terbilangNominal: "Kp 1.250.000,-",
      kotaTgl: "Tanjung Selor, 04 November 2026",
      penerima: "Ibu Nurhayati Catering",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#831843",
    }),
  },
  {
    nomor: 105,
    berkas: "105_kwitansi_tangan_upah_tukang.png",
    judul: "Kwitansi Upah Tukang Pembuatan Papan Informasi",
    tag: "Upah Tenaga",
    nominalTeks: "Rp 600.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "105/KW-TK/XI/2026",
      telahDiterima: "Koordinator Tim Aset",
      uangSejumlah: "Enam Ratus Ribu Rupiah",
      untukPembayaran: "Upah Kerja Pembuatan 4 Unit Papan Batas Wilayah",
      terbilangNominal: "=Rp. 600.000,-=",
      kotaTgl: "Salimbatu, 05 November 2026",
      penerima: "Bpk. Sukirman",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#1e293b",
    }),
  },
  {
    nomor: 106,
    berkas: "106_kwitansi_tangan_sewa_posko.png",
    judul: "Kwitansi Sewa Rumah Singgah / Posko Lapangan",
    tag: "Akomodasi",
    nominalTeks: "Rp 1.500.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "106/KW-SEWA/XI/2026",
      telahDiterima: "Tim Relawan Komunitas Adat",
      uangSejumlah: "Satu Juta Lima Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Rumah Tinggal Posko Kerja Lapangan Selama 1 Bulan",
      terbilangNominal: "Pp 1.500.000,-",
      kotaTgl: "Tanjung Palas, 06 November 2026",
      penerima: "Haji Ridwan Effendi",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#047857",
    }),
  },
  {
    nomor: 107,
    berkas: "107_kwitansi_tangan_jasa_angkut.png",
    judul: "Kwitansi Jasa Angkut Truk Pasir dan Material",
    tag: "Transportasi",
    nominalTeks: "Rp 700.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "107/KW-LOG/XI/2026",
      telahDiterima: "Seksi Pembangunan Fasilitas",
      uangSejumlah: "Tujuh Ratus Ribu Rupiah",
      untukPembayaran: "Ongkos Angkut 2 Dump Truk Pasir Pasang ke Lokasi Posko",
      terbilangNominal: "Bp 700.000,-",
      kotaTgl: "Tanjung Selor, 07 November 2026",
      penerima: "Supir Truk Ahmad Zaini",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#475569",
    }),
  },
  {
    nomor: 108,
    berkas: "108_kwitansi_tangan_snack_kopi.png",
    judul: "Kwitansi Snack Kue Tradisional dan Kopi Musyawarah",
    tag: "Konsumsi",
    nominalTeks: "Rp 350.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "108/KW-SNACK/XI/2026",
      telahDiterima: "Panitia Rapat Koordinasi",
      uangSejumlah: "Tiga Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Kue Basah Tradisional 70 Kotak & Kopi Gula Aren",
      terbilangNominal: "=Rp. 350.000,-=",
      kotaTgl: "Tanjung Selor, 08 November 2026",
      penerima: "Ibu Salmiah Kue",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#b45309",
    }),
  },
  {
    nomor: 109,
    berkas: "109_kwitansi_tangan_beli_bibit.png",
    judul: "Kwitansi Pembelian Bibit Pohon Penghijauan",
    tag: "Pengadaan",
    nominalTeks: "Rp 950.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "109/KW-BIBIT/XI/2026",
      telahDiterima: "Divisi Konservasi Lingkungan",
      uangSejumlah: "Sembilan Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Pembelian 190 Bibit Pohon Ulin dan Gaharu Lokal",
      terbilangNominal: "Ry 950.000,-",
      kotaTgl: "Tanjung Selor, 09 November 2026",
      penerima: "Kelompok Tani Tunas Rimba",
      metodeLabel: "LUNAS TF",
      warnaTema: "#15803d",
    }),
  },
  {
    nomor: 110,
    berkas: "110_kwitansi_tangan_sewa_proyektor.png",
    judul: "Kwitansi Sewa Proyektor dan Layar Presentasi",
    tag: "Sewa Peralatan",
    nominalTeks: "Rp 400.000",
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: "110/KW-PROY/XI/2026",
      telahDiterima: "Sekretariat Panitia Diskusi Publik",
      uangSejumlah: "Empat Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Proyektor Epson 3600 Lumens & Screen 2 Hari",
      terbilangNominal: "=Rp. 400.000,-=",
      kotaTgl: "Tanjung Selor, 10 November 2026",
      penerima: "Rental Media Visual",
      metodeLabel: "LUNAS CASH",
      warnaTema: "#1d4ed8",
    }),
  },
];

// Generate sisa kwitansi tulisan tangan hingga nomor 160 (Items 111 - 160)
const daftarKwitansiTanganLanjutan: { judul: string; tag: string; nominal: number; terbilang: string; untuk: string; penerima: string; nomor: string }[] = [
  { judul: "Kwitansi Honor Pendamping Lapangan 1", tag: "Honorarium", nominal: 1800000, terbilang: "Satu Juta Delapan Ratus Ribu Rupiah", untuk: "Honor Pendamping Lapangan Desa Pimping", penerima: "Bpk. Markus L", nomor: "111/KW-HL/XI/2026" },
  { judul: "Kwitansi Honor Pendamping Lapangan 2", tag: "Honorarium", nominal: 1800000, terbilang: "Satu Juta Delapan Ratus Ribu Rupiah", untuk: "Honor Pendamping Lapangan Desa Silva Rahayu", penerima: "Ibu Kristin", nomor: "112/KW-HL/XI/2026" },
  { judul: "Kwitansi Sewa Genset Penerangan", tag: "Sewa Peralatan", nominal: 550000, terbilang: "Lima Ratus Lima Puluh Ribu Rupiah", untuk: "Sewa Genset 5KVA 2 Malam Kegiatan Lapangan", penerima: "Pak Basir", nomor: "113/KW-GEN/XI/2026" },
  { judul: "Kwitansi Bantuan Konsumsi Gotong Royong", tag: "Konsumsi", nominal: 450000, terbilang: "Empat Ratus Lima Puluh Ribu Rupiah", untuk: "Bantuan Konsumsi Warga Gotong Royong Posko", penerima: "Ibu Fatimah", nomor: "114/KW-GR/XI/2026" },
  { judul: "Kwitansi Pembuatan Plang Peringatan", tag: "Pengadaan", nominal: 800000, terbilang: "Delapan Ratus Ribu Rupiah", untuk: "Pembuatan 8 Unit Plang Peringatan Hutan Adat", penerima: "Percetakan Surya", nomor: "115/KW-PLG/XI/2026" },
  { judul: "Kwitansi Sewa Drone Dokumentasi Udara", tag: "Sewa Peralatan", nominal: 1200000, terbilang: "Satu Juta Dua Ratus Ribu Rupiah", untuk: "Sewa Drone DJI & Operator Foto Udara Wilayah", penerima: "Kaltara Visual", nomor: "116/KW-DRN/XI/2026" },
  { judul: "Kwitansi BBM Solar Perahu Ketinting", tag: "BBM", nominal: 480000, terbilang: "Empat Ratus Delapan Puluh Ribu Rupiah", untuk: "Pembelian Solar 40 Liter untuk Perahu Tim", penerima: "Kios BBM Apung", nomor: "117/KW-BBM/XI/2026" },
  { judul: "Kwitansi Honor Petugas Kebersihan Gedung", tag: "Honorarium", nominal: 300000, terbilang: "Tiga Ratus Ribu Rupiah", untuk: "Upah Bersih Gedung Pasca Acara Pertemuan", penerima: "Bpk. Junaidi", nomor: "118/KW-CL/XI/2026" },
  { judul: "Kwitansi Pembelian Terpal dan Tali", tag: "Perlengkapan", nominal: 275000, terbilang: "Dua Ratus Tujuh Puluh Lima Ribu Rupiah", untuk: "Beli Terpal Biru 6x8 dan Tali Tambang", penerima: "Toko Sinar Terpal", nomor: "119/KW-TRP/XI/2026" },
  { judul: "Kwitansi Konsumsi Nasi Kotak Tamu", tag: "Konsumsi", nominal: 625000, terbilang: "Enam Ratus Dua Puluh Lima Ribu Rupiah", untuk: "Konsumsi 25 Nasi Kotak Ayam Bakar Tamu Adat", penerima: "Warung Berkah", nomor: "120/KW-NS/XI/2026" },
  { judul: "Kwitansi Jasa Penerjemah Bahasa Dayak", tag: "Honorarium", nominal: 750000, terbilang: "Tujuh Ratus Lima Puluh Ribu Rupiah", untuk: "Jasa Translasi Wawancara Tetua Adat ke Bahasa Indonesia", penerima: "Bpk. Daud Aling", nomor: "121/KW-TRN/XI/2026" },
  { judul: "Kwitansi Penggantian Biaya Parkir & Retribusi", tag: "Operasional", nominal: 150000, terbilang: "Satu Ratus Lima Puluh Ribu Rupiah", untuk: "Retribusi Penyeberangan Feri & Parkir Tim", penerima: "Petugas Pelabuhan", nomor: "122/KW-RET/XI/2026" },
  { judul: "Kwitansi Jasa Pembersihan Lahan Percontohan", tag: "Upah Tenaga", nominal: 900000, terbilang: "Sembilan Ratus Ribu Rupiah", untuk: "Upah Rintis dan Babat Rumput Lahan 1 Hektar", penerima: "Kelompok Kerja Bpk. Sitorus", nomor: "123/KW-LHN/XI/2026" },
  { judul: "Kwitansi Beli Perlengkapan P3K Lapangan", tag: "Kesehatan", nominal: 320000, terbilang: "Tiga Ratus Dua Puluh Ribu Rupiah", untuk: "Obat-obatan Lapangan, Perban, Minyak Kayu Putih", penerima: "Apotek Sehat Jaya", nomor: "124/KW-P3K/XI/2026" },
  { judul: "Kwitansi Sewa Kursi Lipat Acara", tag: "Sewa Peralatan", nominal: 250000, terbilang: "Dua Ratus Lima Puluh Ribu Rupiah", untuk: "Sewa 50 Kursi Plastik Chitose 1 Hari", penerima: "Tenda Kurnia", nomor: "125/KW-KRS/XI/2026" },
  { judul: "Kwitansi Pembelian Galon Air Minum & Dispenser", tag: "Konsumsi", nominal: 210000, terbilang: "Dua Ratus Sepuluh Ribu Rupiah", untuk: "Pengadaan 6 Galon Air Mineral dan Pompa", penerima: "Depot Air Tirta", nomor: "126/KW-AIR/XI/2026" },
  { judul: "Kwitansi Honor Notulen dan Dokumentator", tag: "Honorarium", nominal: 500000, terbilang: "Lima Ratus Ribu Rupiah", untuk: "Honor Pencatatan Berita Acara & Foto", penerima: "Sdri. Rina Amelia", nomor: "127/KW-DOC/XI/2026" },
  { judul: "Kwitansi Penginapan Homestay Warga", tag: "Akomodasi", nominal: 700000, terbilang: "Tujuh Ratus Ribu Rupiah", untuk: "Sewa 2 Kamar Homestay Warga 2 Malam", penerima: "Ibu Yohana", nomor: "128/KW-HMS/XI/2026" },
  { judul: "Kwitansi Pembelian Patok Semen Batas", tag: "Pengadaan", nominal: 1100000, terbilang: "Satu Juta Seratus Ribu Rupiah", untuk: "11 Unit Patok Semen Cor Penanda Batas", penerima: "UD. Semen Abadi", nomor: "129/KW-PTK/XI/2026" },
  { judul: "Kwitansi Jasa Guide Penunjuk Jalan Hutan", tag: "Honorarium", nominal: 650000, terbilang: "Enam Ratus Lima Puluh Ribu Rupiah", untuk: "Jasa Pemandu Jalur Trekking Hutan Adat 2 Hari", penerima: "Pak Stepanus", nomor: "130/KW-GD/XI/2026" },
  { judul: "Kwitansi Pembelian ATK Kertas Karton & Spidol", tag: "ATK", nominal: 185000, terbilang: "Satu Ratus Delapan Puluh Lima Ribu Rupiah", untuk: "Beli Kertas Manila, Spidol Warna, Post-It Diskusi", penerima: "Toko Buku Sahabat", nomor: "131/KW-ATK/XI/2026" },
  { judul: "Kwitansi Pengadaan Rompi Tim Lapangan", tag: "Perlengkapan", nominal: 840000, terbilang: "Delapan Ratus Empat Puluh Ribu Rupiah", untuk: "Beli 7 Pcs Rompi Safety Lapangan Bertuliskan Logo", penerima: "Konveksi Borneo", nomor: "132/KW-RMP/XI/2026" },
  { judul: "Kwitansi Jasa Service Ketinting Rusak", tag: "Pemeliharaan", nominal: 375000, terbilang: "Tiga Ratus Tujuh Puluh Lima Ribu Rupiah", untuk: "Perbaikan Busi, Kipas Baling-baling Perahu", penerima: "Bengkel Perahu Kayan", nomor: "133/KW-BGL/XI/2026" },
  { judul: "Kwitansi Beli Buah-buahan Lokal Jamuan", tag: "Konsumsi", nominal: 230000, terbilang: "Dua Ratus Tiga Puluh Ribu Rupiah", untuk: "Pisang, Semangka, dan Buah Elai Lokal Jamuan Tamu", penerima: "Pasar Induk Buah", nomor: "134/KW-BH/XI/2026" },
  { judul: "Kwitansi Sewa Mobil Pick Up Angkut Kayu", tag: "Transportasi", nominal: 500000, terbilang: "Lima Ratus Ribu Rupiah", untuk: "Sewa 1 Hari Mobil Pick Up Pengangkut Kayu Posko", penerima: "Bpk. Mulyadi", nomor: "135/KW-PKP/XI/2026" },
  { judul: "Kwitansi Honor Fasilitator Anak & Remaja", tag: "Honorarium", nominal: 600000, terbilang: "Enam Ratus Ribu Rupiah", untuk: "Fasilitasi Sesi Belajar Budaya Anak Adat", penerima: "Ibu Theresia", nomor: "136/KW-FAS/XI/2026" },
  { judul: "Kwitansi Pembelian Baterai Cadangan GPS", tag: "Perlengkapan", nominal: 160000, terbilang: "Satu Ratus Enam Puluh Ribu Rupiah", untuk: "Baterai Eneloop AA Rechargeable 4 Pcs", penerima: "Toko Elektronik Megah", nomor: "137/KW-BAT/XI/2026" },
  { judul: "Kwitansi Konsumsi Bubur Kacang Ijo Pagi", tag: "Konsumsi", nominal: 175000, terbilang: "Satu Ratus Tujuh Puluh Lima Ribu Rupiah", untuk: "35 Porsi Bubur Kacang Hijau Sarapan Tim", penerima: "Warung Barokah", nomor: "138/KW-BBR/XI/2026" },
  { judul: "Kwitansi Jasa Sablon Kaos Panitia", tag: "Pengadaan", nominal: 960000, terbilang: "Sembilan Ratus Enam Puluh Ribu Rupiah", untuk: "Sablon Kaos Katun 16 Pcs Panitia Adat", penerima: "Sablon Borneo Kreatif", nomor: "139/KW-SBL/XI/2026" },
  { judul: "Kwitansi Beli Jas Hujan & Sepatu Boot Lapangan", tag: "Perlengkapan", nominal: 420000, terbilang: "Empat Ratus Dua Puluh Ribu Rupiah", untuk: "3 Pasang Sepatu Boot Karet dan 3 Jas Hujan", penerima: "Toko Alat Perkebunan", nomor: "140/KW-BOT/XI/2026" },
  { judul: "Kwitansi Pembelian Kopi Bubuk Asli Kaltara", tag: "Konsumsi", nominal: 140000, terbilang: "Satu Ratus Empat Puluh Ribu Rupiah", untuk: "2 Kg Kopi Bubuk Robusta Malinau", penerima: "Kedai Kopi Dayak", nomor: "141/KW-KOP/XI/2026" },
  { judul: "Kwitansi Jasa Desain Peta Wilayah Adat", tag: "Honorarium", nominal: 1500000, terbilang: "Satu Juta Lima Ratus Ribu Rupiah", untuk: "Kartografi & Layout Peta Skala 1:25.000", penerima: "Bpk. Rahmat Kartograf", nomor: "142/KW-DES/XI/2026" },
  { judul: "Kwitansi Sewa Perangkat Mic Wireless", tag: "Sewa Peralatan", nominal: 200000, terbilang: "Dua Ratus Ribu Rupiah", untuk: "Sewa 2 Mic Wireless Shure 1 Hari", penerima: "Audio Rental Kayan", nomor: "143/KW-MIC/XI/2026" },
  { judul: "Kwitansi Biaya Fotocopy Modul Pelatihan", tag: "Percetakan", nominal: 285000, terbilang: "Dua Ratus Delapan Puluh Lima Ribu Rupiah", untuk: "Cetak & Jilid Modul Panduan 30 Eksemplar", penerima: "Percetakan Kaltara", nomor: "144/KW-MOD/XI/2026" },
  { judul: "Kwitansi Pembelian Gembok & Rantai Pengaman", tag: "Perlengkapan", nominal: 135000, terbilang: "Satu Ratus Tiga Puluh Lima Ribu Rupiah", untuk: "2 Set Gembok Kuningan & Rantai Pintu Posko", penerima: "Toko Bangunan Sumber", nomor: "145/KW-GBK/XI/2026" },
  { judul: "Kwitansi Beli Ikan Segar Jamuan Warga", tag: "Konsumsi", nominal: 380000, terbilang: "Tiga Ratus Delapan Puluh Ribu Rupiah", untuk: "8 Kg Ikan Patin Sungai Segar Jamuan Makan", penerima: "Nelayan Sungai Kayan", nomor: "146/KW-IKN/XI/2026" },
  { judul: "Kwitansi Pengadaan Cat Tanda Batas Wilayah", tag: "Perlengkapan", nominal: 260000, terbilang: "Dua Ratus Enam Puluh Ribu Rupiah", untuk: "Cat Besi Merah & Putih 4 Kaleng + Kuas", penerima: "Toko Cat Warna Indah", nomor: "147/KW-CAT/XI/2026" },
  { judul: "Kwitansi Sewa Kamera DSLR Dokumentasi", tag: "Sewa Peralatan", nominal: 350000, terbilang: "Tiga Ratus Lima Puluh Ribu Rupiah", untuk: "Sewa Kamera Canon EOS 80D + Lensa 2 Hari", penerima: "Rental Kamera Selor", nomor: "148/KW-CAM/XI/2026" },
  { judul: "Kwitansi Honor Tetua Adat Pembuka Ritual", tag: "Honorarium", nominal: 1000000, terbilang: "Satu Juta Rupiah", untuk: "Penghormatan & Tali Kasih Tetua Adat Upacara Pembuka", penerima: "Bpk. Kepala Adat Usat", nomor: "149/KW-ADT/XI/2026" },
  { judul: "Kwitansi Pembelian Beras Lokal Krayan", tag: "Konsumsi", nominal: 450000, terbilang: "Empat Ratus Lima Puluh Ribu Rupiah", untuk: "25 Kg Beras Adan Krayan Organik", penerima: "Koperasi Adat Krayan", nomor: "150/KW-BRS/XI/2026" },
  { judul: "Kwitansi Sewa Pengeras Suara Megaphone", tag: "Sewa Peralatan", nominal: 100000, terbilang: "Satu Ratus Ribu Rupiah", untuk: "Sewa Megaphone TOA untuk Pengarah Lapangan", penerima: "TOA Sound Selor", nomor: "151/KW-MGA/XI/2026" },
  { judul: "Kwitansi Beli Parang & Sarung Kerja Lapangan", tag: "Perlengkapan", nominal: 240000, terbilang: "Dua Ratus Empat Puluh Ribu Rupiah", untuk: "2 Bilah Parang Mandau Kerja & Sarung Kulit", penerima: "Pandai Besi Kayan", nomor: "152/KW-PRG/XI/2026" },
  { judul: "Kwitansi Honor Tim Penyusun Laporan Akhir", tag: "Honorarium", nominal: 2000000, terbilang: "Dua Juta Rupiah", untuk: "Penyusunan Naskah Akademik & Dokumen Rekomendasi", penerima: "Sdri. Maya Anggraini", nomor: "153/KW-LAP/XI/2026" },
  { judul: "Kwitansi Pembelian Gula Pasir & Teh Celup", tag: "Konsumsi", nominal: 115000, terbilang: "Satu Ratus Lima Belas Ribu Rupiah", untuk: "5 Kg Gula Pasir & 5 Kotak Teh Celup Sariwangi", penerima: "Toko Sembako Barokah", nomor: "154/KW-TEH/XI/2026" },
  { judul: "Kwitansi Biaya Laminating Peta & Sertifikat", tag: "Percetakan", nominal: 180000, terbilang: "Satu Ratus Delapan Puluh Ribu Rupiah", untuk: "Laminating Hard Cover Peta A3 12 Lembar", penerima: "Selor Print Center", nomor: "155/KW-LAM/XI/2026" },
  { judul: "Kwitansi Sewa Meja Panjang Pertemuan", tag: "Sewa Peralatan", nominal: 200000, terbilang: "Dua Ratus Ribu Rupiah", untuk: "Sewa 5 Meja Kayu Panjang 2 Hari", penerima: "Pak Sabran Sewa", nomor: "156/KW-MEJ/XI/2026" },
  { judul: "Kwitansi Beli Minyak Goreng & Bumbu Dapur", tag: "Konsumsi", nominal: 195000, terbilang: "Satu Ratus Sembilan Puluh Lima Ribu Rupiah", untuk: "Minyak Goreng 5 Liter, Bawang Merah, Bawang Putih", penerima: "Pasar Pagi Bulungan", nomor: "157/KW-BMB/XI/2026" },
  { judul: "Kwitansi Uang Tali Asih Pemangku Wilayah", tag: "Honorarium", nominal: 800000, terbilang: "Delapan Ratus Ribu Rupiah", untuk: "Tali Kasih Apresiasi Perangkat Desa Penyangga", penerima: "Bpk. Sekretaris Desa", nomor: "158/KW-TLI/XI/2026" },
  { judul: "Kwitansi Beli Masker & Hand Sanitizer", tag: "Kesehatan", nominal: 90000, terbilang: "Sembilan Puluh Ribu Rupiah", untuk: "2 Box Masker Medis & 2 Botol Hand Sanitizer", penerima: "Apotek Farmasi Prima", nomor: "159/KW-MSK/XI/2026" },
  { judul: "Kwitansi Honor Tim IT Penginput Data Web", tag: "Honorarium", nominal: 1250000, terbilang: "Satu Juta Dua Ratus Lima Puluh Ribu Rupiah", untuk: "Digitalisasi & Upload Basis Data Spasial ke Geoportal", penerima: "Sdr. Wahyu Pratama", nomor: "160/KW-IT/XI/2026" },
];

for (let i = 0; i < daftarKwitansiTanganLanjutan.length; i++) {
  const item = daftarKwitansiTanganLanjutan[i];
  const no = 111 + i;
  dataBaru.push({
    nomor: no,
    berkas: `${no}_kwitansi_tangan_${item.tag.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`,
    judul: item.judul,
    tag: item.tag,
    nominalTeks: `Rp ${item.nominal.toLocaleString("id-ID")}`,
    lebar: 720,
    tinggi: 430,
    svgContent: kwitansiTangan({
      nomor: item.nomor,
      telahDiterima: "Sekretariat Tim Wilayah Adat",
      uangSejumlah: item.terbilang,
      untukPembayaran: item.untuk,
      terbilangNominal: `=Rp. ${item.nominal.toLocaleString("id-ID")},-==`,
      kotaTgl: `Tanjung Selor, ${((i % 28) + 1).toString().padStart(2, "0")} November 2026`,
      penerima: item.penerima,
      metodeLabel: i % 3 === 0 ? "LUNAS TF" : "LUNAS CASH",
      warnaTema: i % 2 === 0 ? "#1b3a4b" : "#4a154b",
    }),
  });
}

// ----------------------------------------------------
// BAGIAN 2: ITEM 161 - 200 (40 NOTA KONTAN PASAR & BON WARUNG BERTULIS TANGAN)
// ----------------------------------------------------

const daftarNotaPasar: { toko: string; bidang: string; alamat: string; items: { bny: string; nama: string; harga: string; jml: string }[]; total: number }[] = [
  {
    toko: "TOKO BERKAH SEMBAKO",
    bidang: "Menjual Aneka Kebutuhan Pokok & Sembako",
    alamat: "Pasar Induk Tanjung Selor Kaltara",
    items: [
      { bny: "2 Karung", nama: "Beras Pandan Wangi 25kg", harga: "320.000", jml: "640.000" },
      { bny: "4 Pcs", nama: "Minyak Goreng SunCo 2L", harga: "38.000", jml: "152.000" },
      { bny: "5 Kg", nama: "Gula Pasir Gulaku", harga: "18.000", jml: "90.000" },
      { bny: "2 Tray", nama: "Telur Ayam Ras Piring", harga: "55.000", jml: "110.000" },
    ],
    total: 992000,
  },
  {
    toko: "WARUNG SAYUR BU ENI",
    bidang: "Sayur Mayur Segar & Bumbu Pawon",
    alamat: "Jl. Kolonel Soetadji, Tanjung Selor",
    items: [
      { bny: "3 Ikat", nama: "Sayur Bayam Segar", harga: "5.000", jml: "15.000" },
      { bny: "2 Kg", nama: "Tomat Merah Super", harga: "14.000", jml: "28.000" },
      { bny: "1 Kg", nama: "Bawang Merah Brebes", harga: "35.000", jml: "35.000" },
      { bny: "1 Kg", nama: "Bawang Putih Kating", harga: "40.000", jml: "40.000" },
      { bny: "1/2 Kg", nama: "Cabai Rawit Merah", harga: "32.000", jml: "32.000" },
    ],
    total: 150000,
  },
  {
    toko: "DEPOT MASAKAN PADANG MINANG SAUYO",
    bidang: "Sedia Masakan Khas Minang Tradisional",
    alamat: "Jl. Katamso No. 18 Tanjung Selor",
    items: [
      { bny: "10 Bks", nama: "Nasi Rendang Sapi", harga: "28.000", jml: "280.000" },
      { bny: "5 Bks", nama: "Nasi Ayam Gulai Panas", harga: "24.000", jml: "120.000" },
      { bny: "15 Pcs", nama: "Es Teh Manis Segar", harga: "5.000", jml: "75.000" },
    ],
    total: 475000,
  },
  {
    toko: "BENGKEL MOTOR KARYA MANDIRI",
    bidang: "Servis Ringan, Ganti Oli & Sparepart Motor",
    alamat: "Jl. Skip I Tanjung Selor Bulungan",
    items: [
      { bny: "1 Btl", nama: "Oli Mesin AHM MPX2 0.8L", harga: "60.000", jml: "60.000" },
      { bny: "1 Btl", nama: "Oli Gardan Transmisi", harga: "18.000", jml: "18.000" },
      { bny: "1 Set", nama: "Kampas Rem Depan Honda", harga: "45.000", jml: "45.000" },
      { bny: "1 Jasa", nama: "Ongkos Servis & Pasang", harga: "35.000", jml: "35.000" },
    ],
    total: 158000,
  },
  {
    toko: "TB. LANCAR MAKMUR",
    bidang: "Bahan Bangunan, Cat, Seng, Triplek & Paku",
    alamat: "Jl. Jenderal Sudirman Tanjung Selor",
    items: [
      { bny: "5 Sak", nama: "Semen Gresik 40kg", harga: "75.000", jml: "375.000" },
      { bny: "3 Lbr", nama: "Triplek Tebal 9mm", harga: "95.000", jml: "285.000" },
      { bny: "2 Kg", nama: "Paku Campur 5cm & 7cm", harga: "22.000", jml: "44.000" },
    ],
    total: 704000,
  },
  {
    toko: "FOTOCOPY & ATK ANUGERAH",
    bidang: "Fotocopy, Jilid Skripsi, ATK & Kertas",
    alamat: "Jl. Sengkawit (Depan Kampus) Bulungan",
    items: [
      { bny: "1 Rim", nama: "Kertas HVS PaperOne A4 75g", harga: "58.000", jml: "58.000" },
      { bny: "1 Rim", nama: "Kertas HVS PaperOne F4 75g", harga: "65.000", jml: "65.000" },
      { bny: "4 Eks", nama: "Jilid Mika Spiral Kawat", harga: "15.000", jml: "60.000" },
      { bny: "100 Lbr", nama: "Fotocopy Bolak Balik", harga: "300", jml: "30.000" },
    ],
    total: 213000,
  },
  {
    toko: "TOKO ELEKTRONIK JAYA ABADI",
    bidang: "Kabel Listrik, Lampu LED, Stop Kontak & Baterai",
    alamat: "Jl. Jeruk No. 8 Tanjung Selor",
    items: [
      { bny: "1 Roll", nama: "Kabel Listrik Eterna 2x1.5 (50m)", harga: "240.000", jml: "240.000" },
      { bny: "4 Pcs", nama: "Lampu LED Philips 12 Watt", harga: "42.000", jml: "168.000" },
      { bny: "2 Pcs", nama: "Stop Kontak Arde 4 Lubang Uticon", harga: "45.000", jml: "90.000" },
    ],
    total: 498000,
  },
  {
    toko: "WARUNG KOPI & MIE MAK CIK",
    bidang: "Kopi Tradisional, Mie Rebus & Gorengan",
    alamat: "Pelabuhan Kayan II Tanjung Selor",
    items: [
      { bny: "8 Gl", nama: "Kopi Susu Panas Khas Tarakan", harga: "10.000", jml: "80.000" },
      { bny: "6 Porsi", nama: "Mie Goreng Telur Spesial", harga: "16.000", jml: "96.000" },
      { bny: "10 Pcs", nama: "Pisang Goreng Keju Coklat", harga: "3.000", jml: "30.000" },
    ],
    total: 206000,
  },
];

// Replikasi variasi hingga 40 nota pasar (Items 161 - 200)
for (let j = 0; j < 40; j++) {
  const master = daftarNotaPasar[j % daftarNotaPasar.length];
  const no = 161 + j;
  const modifikasi = j * 3500;
  const totalAkhir = master.total + modifikasi;
  const tgl = `${((j % 28) + 1).toString().padStart(2, "0")}/11/2026`;

  dataBaru.push({
    nomor: no,
    berkas: `${no}_nota_pasar_tangan_${master.toko.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 18)}.png`,
    judul: `Nota Pasar Tulis Tangan: ${master.toko}`,
    tag: "Nota Pasar",
    nominalTeks: `Rp ${totalAkhir.toLocaleString("id-ID")}`,
    lebar: 480,
    tinggi: 540,
    svgContent: notaPasarTangan({
      toko: master.toko,
      bidang: master.bidang,
      alamat: master.alamat,
      tanggal: tgl,
      tuanToko: "Tim Lapangan SPJ",
      items: master.items.map((it, idx) => ({
        banyaknya: it.bny,
        nama: it.nama,
        harga: it.harga,
        jumlah: idx === 0 ? (parseInt(it.jml.replace(/[^0-9]/g, ""), 10) + modifikasi).toLocaleString("id-ID") : it.jml,
      })),
      totalTeks: `= ${totalAkhir.toLocaleString("id-ID")} =`,
      lunasCap: j % 2 === 0 ? "LUNAS KONTAN" : "PAID / CASH",
      warnaKertas: j % 3 === 0 ? "#fffdf5" : j % 3 === 1 ? "#f7fcf8" : "#fff8f8",
      warnaGaris: j % 2 === 0 ? "#b91c1c" : "#1d4ed8",
    }),
  });
}

// ----------------------------------------------------
// BAGIAN 3: ITEM 201 - 230 (30 TRANSAKSI PEMBAYARAN LANJUTAN: DEBIT GPN, QRIS, BI-FAST, VA, PAYLATER, TUNAI)
// ----------------------------------------------------

const daftarMetodeLanjutan: {
  judul: string;
  tag: string;
  nominal: number;
  tipe: "edc" | "digital" | "tunai_change";
  payload: any;
}[] = [
  // 1. Kartu Debit GPN EDC BCA
  {
    judul: "Struk EDC BCA Kartu Debit GPN",
    tag: "Debit",
    nominal: 425000,
    tipe: "edc",
    payload: {
      bank: "BANK CENTRAL ASIA",
      merchant: "SUPERMARKET MAJU JAYA",
      mid: "000109283741",
      tid: "BCA09871",
      nomorKartuMasked: "6013-xxxx-xxxx-8821",
      tanggal: "01/11/2026",
      jam: "14:15:33",
      batch: "000124",
      trace: "004512",
      refNo: "772619028371",
      apprCode: "491823",
      nominal: "Rp 425.000",
      metode: "GPN DEBIT CHIP",
    },
  },
  // 2. Kartu Debit Mandiri EDC
  {
    judul: "Struk EDC Bank Mandiri Debit Card",
    tag: "Debit",
    nominal: 310000,
    tipe: "edc",
    payload: {
      bank: "BANK MANDIRI",
      merchant: "TOKO BUKU GRAMEDIA",
      mid: "000203948571",
      tid: "MDR02819",
      nomorKartuMasked: "4000-xxxx-xxxx-1928",
      tanggal: "02/11/2026",
      jam: "11:20:10",
      batch: "000089",
      trace: "001298",
      refNo: "882716390123",
      apprCode: "918273",
      nominal: "Rp 310.000",
      metode: "DEBIT MANDIRI",
    },
  },
  // 3. Kartu Debit BRI EDC
  {
    judul: "Struk EDC Bank BRI Debit GPN",
    tag: "Debit",
    nominal: 185000,
    tipe: "edc",
    payload: {
      bank: "BANK RAKYAT INDONESIA",
      merchant: "APOTEK K-24 BULUNGAN",
      mid: "000392817263",
      tid: "BRI88291",
      nomorKartuMasked: "5221-xxxx-xxxx-3910",
      tanggal: "03/11/2026",
      jam: "20:45:00",
      batch: "000210",
      trace: "006712",
      refNo: "991827364512",
      apprCode: "381920",
      nominal: "Rp 185.000",
      metode: "DEBIT BRI GPN",
    },
  },
  // 4. Livin by Mandiri BI-FAST Resi
  {
    judul: "Resi Transfer BI-FAST Livin by Mandiri",
    tag: "Transfer",
    nominal: 752500,
    tipe: "digital",
    payload: {
      aplikasi: "Livin' by Mandiri",
      judulResi: "Bukti Transfer Antarbank BI-FAST",
      nomorRef: "MDR20261104882731",
      tanggal: "04 Nov 2026",
      jam: "10:35:12",
      sumberDana: "Tabungan Now (148-00-xxxx82-1)",
      tujuan: "BCA 8820192831 a.n TOKO MATERIAL ADAT",
      nominal: "Rp 750.000",
      biayaAdmin: "Rp 2.500",
      totalBayar: "Rp 752.500",
      catatan: "Pembayaran material posko tahap 2",
      status: "BERHASIL",
      warnaApp: "#00529b",
    },
  },
  // 5. BCA Mobile m-Transfer Resi
  {
    judul: "Resi m-Transfer BCA Mobile Antar Rekening",
    tag: "Transfer",
    nominal: 1200000,
    tipe: "digital",
    payload: {
      aplikasi: "BCA mobile",
      judulResi: "m-Transfer Berhasil",
      nomorRef: "BCA261105991827",
      tanggal: "05 Nov 2026",
      jam: "13:22:05",
      sumberDana: "0829182731 - HENDRA",
      tujuan: "0821928371 - CV KARYA BORNEO",
      nominal: "Rp 1.200.000",
      biayaAdmin: "Rp 0",
      totalBayar: "Rp 1.200.000",
      catatan: "Sewa sound system acara",
      status: "BERHASIL",
      warnaApp: "#003b7a",
    },
  },
  // 6. BRImo Resi Transfer BRIVA
  {
    judul: "Resi Pembayaran BRIVA di Aplikasi BRImo",
    tag: "Transfer",
    nominal: 350000,
    tipe: "digital",
    payload: {
      aplikasi: "BRImo",
      judulResi: "Transaksi Pembayaran BRIVA Sukses",
      nomorRef: "BRIVA8819283746",
      tanggal: "06 Nov 2026",
      jam: "08:15:45",
      sumberDana: "BritAma (0119-01-xxxx29-5)",
      tujuan: "BRIVA 12890 0812345678 (Kaltara Fast)",
      nominal: "Rp 350.000",
      biayaAdmin: "Rp 0",
      totalBayar: "Rp 350.000",
      catatan: "Pelunasan tiket perjalanan tim",
      status: "BERHASIL",
      warnaApp: "#0f4c81",
    },
  },
  // 7. BSI Mobile Resi Transfer
  {
    judul: "Resi BSI Mobile Transfer Antar Rekening Syariah",
    tag: "Transfer",
    nominal: 500000,
    tipe: "digital",
    payload: {
      aplikasi: "BSI Mobile",
      judulResi: "Resi Transfer Dana Berhasil",
      nomorRef: "BSI7728192039",
      tanggal: "07 Nov 2026",
      jam: "09:40:11",
      sumberDana: "Easy Wadiah (7182938471)",
      tujuan: "BSI 7091827364 a.n YAYASAN BORNEO HIJAU",
      nominal: "Rp 500.000",
      biayaAdmin: "Rp 0",
      totalBayar: "Rp 500.000",
      catatan: "Infaq dan konsumsi relawan",
      status: "BERHASIL",
      warnaApp: "#00a39d",
    },
  },
  // 8. SeaBank Resi Transfer Bebas Biaya
  {
    judul: "Resi SeaBank Transfer Bebas Biaya Admin",
    tag: "Transfer",
    nominal: 680000,
    tipe: "digital",
    payload: {
      aplikasi: "SeaBank",
      judulResi: "Transfer Berhasil (Bebas Biaya)",
      nomorRef: "SEA202611089912",
      tanggal: "08 Nov 2026",
      jam: "16:50:33",
      sumberDana: "SeaBank Tabungan (9018273615)",
      tujuan: "Mandiri 1480019283712 a.n KATERING IBU SRI",
      nominal: "Rp 680.000",
      biayaAdmin: "Rp 0 (Gratis)",
      totalBayar: "Rp 680.000",
      catatan: "Pelunasan makan malam 40 porsi",
      status: "BERHASIL",
      warnaApp: "#ff5722",
    },
  },
  // 9. Bank Jago Resi Transfer Kantong
  {
    judul: "Resi Bank Jago Transfer dari Kantong Bersama",
    tag: "Transfer",
    nominal: 450000,
    tipe: "digital",
    payload: {
      aplikasi: "Bank Jago",
      judulResi: "Kantong Belanja - Transfer Berhasil",
      nomorRef: "JAGO881928371",
      tanggal: "09 Nov 2026",
      jam: "11:10:25",
      sumberDana: "Kantong Operasional Lapangan (50192837)",
      tujuan: "BCA 7728192831 a.n TOKO PERCETAKAN BORNEO",
      nominal: "Rp 450.000",
      biayaAdmin: "Rp 0",
      totalBayar: "Rp 450.000",
      catatan: "Cetak baliho pengumuman",
      status: "BERHASIL",
      warnaApp: "#4b286d",
    },
  },
  // 10. QRIS Dinamis Warung Kopi
  {
    judul: "Struk QRIS Dinamis Merchant Kopi Kayan",
    tag: "QRIS",
    nominal: 88000,
    tipe: "digital",
    payload: {
      aplikasi: "QRIS Standar Nasional",
      judulResi: "Pembayaran QRIS Dinamis Berhasil",
      nomorRef: "NMID: ID1020091827364",
      tanggal: "10 Nov 2026",
      jam: "19:30:15",
      sumberDana: "GoPay E-Wallet (0812-xxxx-889)",
      tujuan: "KEDAI KOPI KAYAN BULUNGAN",
      nominal: "Rp 88.000",
      biayaAdmin: "Rp 0",
      totalBayar: "Rp 88.000",
      catatan: "3 Kopi Susu Aren & 2 Roti Bakar",
      status: "BERHASIL",
      warnaApp: "#dc2626",
    },
  },
  // 11. SPayLater Cicilan
  {
    judul: "Bukti Transaksi ShopeePay / SPayLater",
    tag: "Kredit",
    nominal: 540000,
    tipe: "digital",
    payload: {
      aplikasi: "ShopeePay / SPayLater",
      judulResi: "Pembayaran SPayLater Cicilan Disetujui",
      nomorRef: "SPL20261111992831",
      tanggal: "11 Nov 2026",
      jam: "15:20:44",
      sumberDana: "SPayLater (Cicilan 3 Bulan)",
      tujuan: "OFFICIAL STORE ALAT OUTDOOR",
      nominal: "Rp 540.000",
      biayaAdmin: "Rp 5.400",
      totalBayar: "Rp 545.400",
      catatan: "Tenda dome 4 orang perlengkapan posko",
      status: "BERHASIL",
      warnaApp: "#ee4d2d",
    },
  },
  // 12. Kredivo PayLater
  {
    judul: "Bukti Pembayaran Kredivo 30 Hari",
    tag: "Kredit",
    nominal: 320000,
    tipe: "digital",
    payload: {
      aplikasi: "Kredivo PayLater",
      judulResi: "Transaksi Kredivo Berhasil",
      nomorRef: "KRD8829102938",
      tanggal: "12 Nov 2026",
      jam: "17:05:19",
      sumberDana: "Kredivo Bayar dalam 30 Hari",
      tujuan: "TOKO ELEKTRONIK MITRA KREDIVO",
      nominal: "Rp 320.000",
      biayaAdmin: "Rp 3.200",
      totalBayar: "Rp 323.200",
      catatan: "Powerbank Anker 20000mAh untuk survei",
      status: "BERHASIL",
      warnaApp: "#ff8c00",
    },
  },
];

// Replikasi hingga 30 item (Items 201 - 230)
for (let k = 0; k < 30; k++) {
  const m = daftarMetodeLanjutan[k % daftarMetodeLanjutan.length];
  const no = 201 + k;
  const modifNominal = k * 5000;
  const nominalAngka = m.nominal + modifNominal;
  const nominalTeks = `Rp ${nominalAngka.toLocaleString("id-ID")}`;

  let svg = "";
  if (m.tipe === "edc") {
    svg = strukEdcDebit({
      ...m.payload,
      refNo: `REF${no}${m.payload.refNo.slice(6)}`,
      nominal: nominalTeks,
    });
  } else {
    svg = resiDigital({
      ...m.payload,
      nomorRef: `${m.payload.nomorRef}${no}`,
      nominal: nominalTeks,
      totalBayar: nominalTeks,
    });
  }

  dataBaru.push({
    nomor: no,
    berkas: `${no}_metode_${m.tag.toLowerCase()}_${m.payload.aplikasi ? m.payload.aplikasi.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "") : "edc"}.png`,
    judul: `${m.judul} #${no}`,
    tag: m.tag,
    nominalTeks: nominalTeks,
    lebar: m.tipe === "edc" ? 420 : 460,
    tinggi: m.tipe === "edc" ? 600 : 650,
    svgContent: svg,
  });
}

// ----------------------------------------------------
// BAGIAN 4: ITEM 231 - 250 (20 EKSPEDISI, TIKET & TAGIHAN UTILITAS: JNE, J&T, SICEPAT, POS, PDAM, BPJS, PBB, PELNI)
// ----------------------------------------------------

const daftarUtilitas: {
  institusi: string;
  jenisDokumen: string;
  pelanggan: string;
  uraian: string;
  biaya: string;
  admin: string;
  total: number;
  metode: string;
  warnaTema?: string;
}[] = [
  { institusi: "JNE EXPRESS", jenisDokumen: "BUKTI PENGIRIMAN PAKET (E-CONNOTE)", pelanggan: "TIM ADAT BULUNGAN", uraian: "KIRIM DOKUMEN LAPORAN ADAT KE JAKARTA (YES 1 HARI)", biaya: "Rp 68.000", admin: "Rp 2.000", total: 70000, metode: "TUNAI", warnaTema: "#dc2626" },
  { institusi: "J&T EXPRESS", jenisDokumen: "OFFICIAL RESI PENGIRIMAN", pelanggan: "SEKRETARIAT LAPANGAN", uraian: "PAKET SAMPEL TANAH & BIJI POHON (EZ REGULER 2KG)", biaya: "Rp 54.000", admin: "Rp 1.000", total: 55000, metode: "TUNAI", warnaTema: "#e11d48" },
  { institusi: "SICEPAT EKSPRES", jenisDokumen: "RESI PENGIRIMAN CARGO", pelanggan: "TIM LOGISTIK KALTARA", uraian: "PENGIRIMAN KOTAK PERLENGKAPAN TIM (GOKIL CARGO 10KG)", biaya: "Rp 145.000", admin: "Rp 5.000", total: 150000, metode: "TRANSFER", warnaTema: "#b91c1c" },
  { institusi: "POS INDONESIA", jenisDokumen: "RESI POS KILAT KHUSUS", pelanggan: "KOORDINATOR WILAYAH", uraian: "SURAT DOKUMEN RESMI REKOMENDASI BUPATI (DOKUMEN)", biaya: "Rp 32.000", admin: "Rp 3.000", total: 35000, metode: "TUNAI", warnaTema: "#ea580c" },
  { institusi: "PERUMDA PDAM DANUM BENUANTA", jenisDokumen: "STRUK PEMBAYARAN REKENING AIR MINUM", pelanggan: "POSKO TIM RELAWAN (ID: 0481928)", uraian: "PEMAKAIAN AIR BULAN OKTOBER 2026 (VOLUME 28 M3)", biaya: "Rp 112.500", admin: "Rp 2.500", total: 115000, metode: "DEBIT", warnaTema: "#0284c7" },
  { institusi: "BPJS KESEHATAN", jenisDokumen: "BUKTI IURAN PESERTA MANDIRI", pelanggan: "BAPAK AGUS RIFAI (NO: 0001928371)", uraian: "IURAN BPJS KELAS 2 PERIODE NOVEMBER 2026", biaya: "Rp 100.000", admin: "Rp 2.500", total: 102500, metode: "TRANSFER VA", warnaTema: "#16a34a" },
  { institusi: "BAPENDA KABUPATEN BULUNGAN", jenisDokumen: "BUKTI PEMBAYARAN PBB-P2", pelanggan: "NOP: 65.01.010.002.005-0128.0", uraian: "PAJAK BUMI DAN BANGUNAN RUMAH SINGGAH TH 2026", biaya: "Rp 185.000", admin: "Rp 3.000", total: 188000, metode: "QRIS", warnaTema: "#4338ca" },
  { institusi: "PT PELAYARAN NASIONAL INDONESIA (PELNI)", jenisDokumen: "TIKET RESMI KAPAL LAUT KM BUKIT SIGUNTANG", pelanggan: "MARKUS LUKAS (DEWASA - EKONOMI)", uraian: "RUTE: TARAKAN -> NUNUKAN -> BALIKPAPAN", biaya: "Rp 275.000", admin: "Rp 10.000", total: 285000, metode: "DEBIT", warnaTema: "#1e3a8a" },
  { institusi: "KAI ACCESS (KERETA API INDONESIA)", jenisDokumen: "BOARDING PASS ELEKTRONIK KAI", pelanggan: "HENDRA WIJAYA (KODE BOOKING: KAI99X)", uraian: "KA AIRLANGGA PASAR SENEN - SURABAYA PASARTURI", biaya: "Rp 104.000", admin: "Rp 0", total: 104000, metode: "QRIS", warnaTema: "#ea580c" },
  { institusi: "PLN PERSERO", jenisDokumen: "STRUK PEMBELIAN TOKEN LISTRIK PRABAYAR", pelanggan: "IDPEL: 541209827361 (M. SYARIF)", uraian: "TOKEN STROOM 20 DIGIT : 4918 2019 4817 2910 4491", biaya: "Rp 200.000", admin: "Rp 2.500", total: 202500, metode: "TUNAI", warnaTema: "#0891b2" },
];

// Buat 20 item utilitas (Items 231 - 250)
for (let u = 0; u < 20; u++) {
  const item = daftarUtilitas[u % daftarUtilitas.length];
  const no = 231 + u;
  const modif = u * 4000;
  const totalAkhir = item.total + modif;
  const totalTeks = `Rp ${totalAkhir.toLocaleString("id-ID")}`;

  dataBaru.push({
    nomor: no,
    berkas: `${no}_utilitas_${item.institusi.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 16)}.png`,
    judul: `${item.institusi} - ${item.jenisDokumen.split(" ")[0]} #${no}`,
    tag: "Tagihan & Utilitas",
    nominalTeks: totalTeks,
    lebar: 480,
    tinggi: 520,
    svgContent: resiUtilitas({
      institusi: item.institusi,
      jenisDokumen: item.jenisDokumen,
      nomorBukti: `REF-${no}-${Date.now().toString().slice(-6)}`,
      tanggal: `${((u % 28) + 1).toString().padStart(2, "0")}/11/2026`,
      pelanggan: item.pelanggan,
      uraian: item.uraian,
      biaya: item.biaya,
      admin: item.admin,
      total: totalTeks,
      metode: item.metode,
      warnaTema: item.warnaTema,
    }),
  });
}

// Gabungkan data baru ke data250Struk
for (const b of dataBaru) {
  data250Struk.push(b);
}

// Fungsi utama generate berkas PNG dan daftar_latihan.json
export async function buat250Dummy() {
  const outputDir = path.resolve(process.cwd(), "public/latihan-ocr");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Memulai pembuatan ${data250Struk.length} berkas struk dummy Indonesia (250 item lengkap)...`);

  const daftarJson = [];

  for (const s of data250Struk) {
    const outPath = path.join(outputDir, s.berkas);
    const safeContent = s.svgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${s.lebar}" height="${s.tinggi}">
        ${safeContent}
      </svg>
    `;

    try {
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: s.lebar } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      fs.writeFileSync(outPath, pngBuffer);

      daftarJson.push({
        nomor: s.nomor,
        berkas: s.berkas,
        judul: s.judul,
        tag: s.tag,
        nominalTeks: s.nominalTeks,
        url: `latihan-ocr/${s.berkas}`,
      });
      if (s.nomor % 25 === 0 || s.nomor >= 240) {
        console.log(`[${s.nomor}/250] Selesai: ${s.berkas} (${s.nominalTeks})`);
      }
    } catch (err) {
      console.error(`Gagal membuat ${s.berkas}:`, err);
    }
  }

  // Simpan daftar_latihan.json
  const jsonPath = path.join(outputDir, "daftar_latihan.json");
  fs.writeFileSync(jsonPath, JSON.stringify(daftarJson, null, 2), "utf8");
  console.log(`✓ Selesai membuat 250 struk dummy! Metadata disimpan di ${jsonPath}`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("buat_250_struk_dummy.ts")) {
  buat250Dummy().catch(console.error);
}
