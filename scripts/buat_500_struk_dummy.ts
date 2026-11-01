/**
 * Generator 500 Bukti Transaksi Dummy Indonesia
 * Memperluas korpus latihan dari 250 menjadi 500 item lengkap:
 * - 1-250: 250 Koleksi Tahap 1 (Retail, Kasir, Kwitansi Cursive, Nota Pasar, EDC, Digital Transfer, Utilitas)
 * - 251-330: 80 Kwitansi Resmi SPJ, Lembaga Adat, Yayasan & Proyek (Bruto, PPh 21/23, Netto, 3 Pihak Pengesahan)
 * - 331-390: 60 Nota Kontan Pasar NCR Rangkap & Bon Warung Tradisional Tingkat Lanjut (Rincian Tabel Terkalibrasi)
 * - 391-450: 60 Transaksi Pembayaran & Perbankan Lanjutan (Slip Setoran Tunai Teller, Bilyet Giro/Cek, Petty Cash Voucher, QRIS Multi-Bank, PayLater)
 * - 451-500: 50 Bukti Perjalanan Dinas Lapangan, Speedboat Carter Pedalaman & Tiket Perintis Kalimantan Utara
 */

import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { data250Struk, ItemStruk250 } from "./buat_250_struk_dummy";

export interface ItemStruk500 extends ItemStruk250 {}

export const data500Struk: ItemStruk500[] = [...data250Struk];

// Helper 1: Kwitansi Resmi SPJ / Proyek / Lembaga Adat dengan Pajak (Bruto vs Netto)
function kwitansiSpjResmi(params: {
  nomor: string;
  tahunAnggaran: string;
  mataAnggaran: string;
  sudahTerimaDari: string;
  uangSejumlah: string;
  untukPembayaran: string;
  bruto: string;
  pajakLabel?: string;
  pajakNilai?: string;
  netto: string;
  terbilangNominal: string;
  kotaTgl: string;
  namaPenerima: string;
  namaBendahara: string;
  namaPpk: string;
  metode: string;
  warnaTema?: string;
}): string {
  const {
    nomor,
    tahunAnggaran,
    mataAnggaran,
    sudahTerimaDari,
    uangSejumlah,
    untukPembayaran,
    bruto,
    pajakLabel = "Potongan PPh 21 (5%)",
    pajakNilai,
    netto,
    terbilangNominal,
    kotaTgl,
    namaPenerima,
    namaBendahara,
    namaPpk,
    metode = "LUNAS DIBAYAR TUNAI",
    warnaTema = "#1e3a8a",
  } = params;

  return `
    <rect width="780" height="490" fill="#fcfbf7" rx="8" />
    <rect x="14" y="14" width="752" height="462" fill="none" stroke="${warnaTema}" stroke-width="2.5" rx="6" />
    <rect x="20" y="20" width="740" height="450" fill="none" stroke="${warnaTema}" stroke-width="0.8" stroke-dasharray="6,3" />

    <!-- Header SPJ Formal -->
    <text x="390" y="52" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="${warnaTema}" text-anchor="middle" letter-spacing="2">KUITANSI / BUKTI PENGELUARAN KAS</text>
    <line x1="160" y1="58" x2="620" y2="58" stroke="${warnaTema}" stroke-width="1.5" />

    <text x="40" y="80" font-family="Courier New, monospace" font-size="11" fill="#333">T.A : ${tahunAnggaran}</text>
    <text x="260" y="80" font-family="Courier New, monospace" font-size="11" fill="#333">MAK : ${mataAnggaran}</text>
    <text x="740" y="80" font-family="Courier New, monospace" font-size="12" font-weight="bold" fill="#333" text-anchor="end">No. Bukti: ${nomor}</text>
    <line x1="40" y1="88" x2="740" y2="88" stroke="#ccc" stroke-width="1" />

    <!-- Sudah Terima Dari -->
    <text x="40" y="115" font-family="Arial, sans-serif" font-size="12" fill="#444">Sudah Terima Dari</text>
    <text x="175" y="115" font-family="Arial, sans-serif" font-size="12" fill="#444">:</text>
    <line x1="190" y1="120" x2="735" y2="120" stroke="#aaa" stroke-dasharray="2,2" stroke-width="0.8" />
    <text x="200" y="113" font-family="Segoe Script, Brush Script MT, cursive" font-size="15" font-weight="bold" fill="#0f172a">${sudahTerimaDari}</text>

    <!-- Uang Sejumlah (Terbilang Cursive) -->
    <text x="40" y="152" font-family="Arial, sans-serif" font-size="12" fill="#444">Uang Sejumlah</text>
    <text x="175" y="152" font-family="Arial, sans-serif" font-size="12" fill="#444">:</text>
    <rect x="190" y="132" width="545" height="42" fill="#f4f1ea" rx="4" stroke="#d6cfbe" />
    <text x="200" y="158" font-family="Segoe Script, Brush Script MT, cursive" font-size="15" font-style="italic" font-weight="bold" fill="#1e293b">${uangSejumlah}</text>

    <!-- Untuk Pembayaran -->
    <text x="40" y="200" font-family="Arial, sans-serif" font-size="12" fill="#444">Untuk Pembayaran</text>
    <text x="175" y="200" font-family="Arial, sans-serif" font-size="12" fill="#444">:</text>
    <line x1="190" y1="205" x2="735" y2="205" stroke="#aaa" stroke-dasharray="2,2" stroke-width="0.8" />
    <text x="200" y="198" font-family="Segoe Script, Brush Script MT, cursive" font-size="14" fill="#334155">${untukPembayaran}</text>

    <!-- Rincian Keuangan & Pajak -->
    <rect x="40" y="225" width="310" height="100" fill="#ffffff" stroke="${warnaTema}" stroke-width="1.5" rx="5" />
    <text x="50" y="248" font-family="Courier New, monospace" font-size="11" fill="#444">Jumlah Bruto</text>
    <text x="340" y="248" font-family="Courier New, monospace" font-size="11" font-weight="bold" text-anchor="end">${bruto}</text>

    ${
      pajakNilai
        ? `
      <text x="50" y="270" font-family="Courier New, monospace" font-size="11" fill="#b91c1c">${pajakLabel}</text>
      <text x="340" y="270" font-family="Courier New, monospace" font-size="11" font-weight="bold" fill="#b91c1c" text-anchor="end">- ${pajakNilai}</text>
    `
        : `
      <text x="50" y="270" font-family="Courier New, monospace" font-size="11" fill="#64748b">Potongan Pajak</text>
      <text x="340" y="270" font-family="Courier New, monospace" font-size="11" fill="#64748b" text-anchor="end">Rp 0</text>
    `
    }
    <line x1="50" y1="282" x2="340" y2="282" stroke="#444" stroke-width="1.2" />
    <text x="50" y="308" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Diterima Bersih (Netto)</text>
    <text x="340" y="310" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="${warnaTema}" text-anchor="end">${netto}</text>

    <!-- Terbilang Nominal Angka Bersambung -->
    <rect x="40" y="335" width="310" height="42" fill="#eff6ff" stroke="${warnaTema}" stroke-width="2" rx="4" />
    <text x="195" y="362" font-family="Segoe Script, Brush Script MT, cursive" font-size="18" font-weight="bold" fill="#1e3a8a" text-anchor="middle">${terbilangNominal}</text>

    <!-- Cap Stempel Verifikasi Lunas -->
    <circle cx="395" cy="285" r="40" fill="none" stroke="#dc2626" stroke-width="2.5" opacity="0.85" />
    <circle cx="395" cy="285" r="35" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="3,2" opacity="0.85" />
    <text x="395" y="280" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#dc2626" text-anchor="middle" opacity="0.85">${metode}</text>
    <text x="395" y="296" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle" opacity="0.85">VERIFIKASI ANGGARAN</text>

    <!-- 3 Kolom Tanda Tangan: Setuju Dibayar (PPK), Lunas Dibayar (Bendahara), Yang Menerima -->
    <text x="460" y="235" font-family="Arial, sans-serif" font-size="11" fill="#333" text-anchor="middle">Setuju Dibayar,</text>
    <text x="460" y="248" font-family="Arial, sans-serif" font-size="10" fill="#666" text-anchor="middle">Pejabat Pembuat Komitmen</text>
    <path d="M 425 295 Q 445 270 465 295 T 495 290" fill="none" stroke="#002b5b" stroke-width="1.8" />
    <text x="460" y="325" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">( ${namaPpk} )</text>

    <text x="600" y="235" font-family="Arial, sans-serif" font-size="11" fill="#333" text-anchor="middle">Lunas Dibayar,</text>
    <text x="600" y="248" font-family="Arial, sans-serif" font-size="10" fill="#666" text-anchor="middle">Bendahara Pengeluaran</text>
    <path d="M 570 295 Q 590 270 610 300 T 635 292" fill="none" stroke="#002b5b" stroke-width="1.8" />
    <text x="600" y="325" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">( ${namaBendahara} )</text>

    <text x="660" y="355" font-family="Arial, sans-serif" font-size="11" fill="#333" text-anchor="middle">${kotaTgl}</text>
    <text x="660" y="370" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">Yang Menerima,</text>
    <path d="M 610 420 Q 640 380 670 425 T 710 415" fill="none" stroke="#1d4ed8" stroke-width="2.5" />
    <line x1="580" y1="445" x2="740" y2="445" stroke="#333" stroke-width="1.2" />
    <text x="660" y="465" font-family="Segoe Script, Brush Script MT, cursive" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="middle">( ${namaPenerima} )</text>
  `;
}

// Helper 2: Slip Setoran Tunai Bank Teller (BCA, Mandiri, BRI, Bank Kaltimtara)
function slipSetoranBank(params: {
  bank: string;
  cabang: string;
  tanggal: string;
  nomorRekening: string;
  namaPenerima: string;
  penyetor: string;
  telepon: string;
  berita: string;
  nominalTeks: string;
  terbilang: string;
  tellerValidasi: string;
  warnaTema?: string;
}): string {
  const { bank, cabang, tanggal, nomorRekening, namaPenerima, penyetor, telepon, berita, nominalTeks, terbilang, tellerValidasi, warnaTema = "#004085" } = params;
  return `
    <rect width="640" height="480" fill="#ffffff" rx="6" />
    <rect x="12" y="12" width="616" height="456" fill="none" stroke="${warnaTema}" stroke-width="2" rx="4" />

    <!-- Header Bank Slip -->
    <text x="30" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="${warnaTema}">${bank}</text>
    <text x="610" y="45" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${warnaTema}" text-anchor="end">SLIP SETORAN TUNAI</text>
    <text x="30" y="65" font-family="Arial, sans-serif" font-size="10" fill="#666">KANTOR CABANG: ${cabang}</text>
    <text x="610" y="65" font-family="Arial, sans-serif" font-size="11" fill="#333" text-anchor="end">TGL: ${tanggal}</text>
    <line x1="25" y1="75" x2="615" y2="75" stroke="${warnaTema}" stroke-width="1.8" />

    <text x="30" y="105" font-family="Courier New, monospace" font-size="12">NO REKENING TUJUAN :</text>
    <rect x="210" y="88" width="280" height="26" fill="#f8f9fa" stroke="#6c757d" stroke-width="1" />
    <text x="220" y="106" font-family="Courier New, monospace" font-size="14" font-weight="bold" fill="#000" letter-spacing="2">${nomorRekening}</text>

    <text x="30" y="135" font-family="Courier New, monospace" font-size="12">NAMA PENERIMA      :</text>
    <text x="210" y="135" font-family="Courier New, monospace" font-size="13" font-weight="bold">${namaPenerima}</text>

    <text x="30" y="165" font-family="Courier New, monospace" font-size="12">NAMA PENYETOR      :</text>
    <text x="210" y="165" font-family="Courier New, monospace" font-size="12">${penyetor} (TELP: ${telepon})</text>

    <text x="30" y="195" font-family="Courier New, monospace" font-size="12">BERITA / CATATAN   :</text>
    <text x="210" y="195" font-family="Courier New, monospace" font-size="12">${berita}</text>
    <line x1="25" y1="210" x2="615" y2="210" stroke="#ccc" stroke-dasharray="3,3" />

    <!-- Uang Sejumlah Terbilang -->
    <text x="30" y="240" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#444">TERBILANG :</text>
    <rect x="120" y="222" width="490" height="36" fill="#f1f5f9" rx="3" stroke="#cbd5e1" />
    <text x="130" y="245" font-family="Segoe Script, Brush Script MT, cursive" font-size="13" font-weight="bold" fill="#0f172a">${terbilang}</text>

    <!-- Kotak Jumlah Setoran -->
    <rect x="30" y="275" width="280" height="54" fill="#ffffff" stroke="${warnaTema}" stroke-width="2.2" rx="4" />
    <text x="45" y="295" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">TOTAL SETORAN RP.</text>
    <text x="45" y="320" font-family="Courier New, monospace" font-size="20" font-weight="900" fill="${warnaTema}">${nominalTeks}</text>

    <!-- Validasi Komputer Teller Bank -->
    <rect x="330" y="275" width="280" height="90" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" rx="4" />
    <text x="340" y="295" font-family="Courier New, monospace" font-size="10" font-weight="bold" fill="#15803d">** VALIDASI TELLER BANK **</text>
    <text x="340" y="315" font-family="Courier New, monospace" font-size="10">${tellerValidasi}</text>
    <text x="340" y="332" font-family="Courier New, monospace" font-size="10">TRX ID: TX-${Date.now().toString().slice(-6)} / SUCCESS</text>
    <text x="340" y="350" font-family="Courier New, monospace" font-size="10">STATUS: SETORAN TUNAI DIBUKUKAN</text>

    <!-- Tanda Tangan Penyetor & Teller -->
    <text x="120" y="390" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">Tanda Tangan Penyetor,</text>
    <path d="M 80 430 Q 110 395 130 435 T 165 425" fill="none" stroke="#1d4ed8" stroke-width="2" />
    <text x="120" y="455" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">( ${penyetor} )</text>

    <text x="500" y="390" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">Petugas Teller,</text>
    <path d="M 465 430 Q 490 405 515 435 T 540 425" fill="none" stroke="#003566" stroke-width="2" />
    <text x="500" y="455" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">( TELLER 04 )</text>
  `;
}

// Helper 3: Cek Bank & Bilyet Giro (BG)
function bilyetGiroCek(params: {
  bank: string;
  nomorBg: string;
  tanggalEfektif: string;
  namaPenerima: string;
  terbilang: string;
  nominalTeks: string;
  penarik: string;
  kotaTgl: string;
}): string {
  const { bank, nomorBg, tanggalEfektif, namaPenerima, terbilang, nominalTeks, penarik, kotaTgl } = params;
  return `
    <rect width="720" height="360" fill="#f0fdf4" rx="8" />
    <rect x="10" y="10" width="700" height="340" fill="none" stroke="#15803d" stroke-width="2" rx="6" />

    <text x="35" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#15803d">${bank}</text>
    <text x="680" y="45" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#166534" text-anchor="end">BILYET GIRO / CEK</text>
    <text x="680" y="65" font-family="Courier New, monospace" font-size="12" fill="#333" text-anchor="end">NO: ${nomorBg}</text>
    <line x1="25" y1="75" x2="695" y2="75" stroke="#15803d" stroke-width="1.5" />

    <text x="35" y="105" font-family="Arial, sans-serif" font-size="12">Pada Tanggal Efektif :</text>
    <text x="185" y="105" font-family="Courier New, monospace" font-size="13" font-weight="bold" fill="#111">${tanggalEfektif}</text>

    <text x="35" y="135" font-family="Arial, sans-serif" font-size="12">Serahkan Kepada      :</text>
    <text x="185" y="135" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">${namaPenerima}</text>

    <text x="35" y="170" font-family="Arial, sans-serif" font-size="12">Jumlah Uang          :</text>
    <rect x="185" y="150" width="495" height="34" fill="#ffffff" stroke="#86efac" rx="3" />
    <text x="195" y="172" font-family="Segoe Script, Brush Script MT, cursive" font-size="14" font-weight="bold" fill="#14532d">${terbilang}</text>

    <!-- Nominal Angka Cek -->
    <rect x="35" y="210" width="280" height="50" fill="#ffffff" stroke="#15803d" stroke-width="2.5" rx="5" />
    <text x="50" y="243" font-family="Courier New, monospace" font-size="22" font-weight="900" fill="#14532d">${nominalTeks}</text>

    <!-- Cap & Tanda Tangan Penarik -->
    <text x="550" y="225" font-family="Arial, sans-serif" font-size="11" fill="#333" text-anchor="middle">${kotaTgl}</text>
    <path d="M 500 270 Q 530 235 560 275 T 605 260" fill="none" stroke="#003566" stroke-width="2.5" />
    <circle cx="550" cy="265" r="32" fill="none" stroke="#b91c1c" stroke-width="2" opacity="0.8" />
    <text x="550" y="268" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#b91c1c" text-anchor="middle" opacity="0.8">GIRO VERIFIED</text>
    <line x1="470" y1="305" x2="630" y2="305" stroke="#333" stroke-width="1.2" />
    <text x="550" y="325" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#111" text-anchor="middle">( ${penarik} )</text>
  `;
}

// Helper 4: Petty Cash Voucher (Kas Kecil)
function pettyCashVoucher(params: {
  perusahaan: string;
  nomor: string;
  tanggal: string;
  dibayarkanKepada: string;
  keperluan: string;
  nominalTeks: string;
  terbilang: string;
  disetujui: string;
  penerima: string;
}): string {
  const { perusahaan, nomor, tanggal, dibayarkanKepada, keperluan, nominalTeks, terbilang, disetujui, penerima } = params;
  return `
    <rect width="540" height="420" fill="#fffef7" rx="8" />
    <rect x="12" y="12" width="516" height="396" fill="none" stroke="#78350f" stroke-width="2" rx="6" />

    <text x="270" y="42" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#78350f" text-anchor="middle">${perusahaan}</text>
    <text x="270" y="62" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#92400e" text-anchor="middle">VOUCHER KAS KECIL (PETTY CASH)</text>
    <line x1="25" y1="72" x2="515" y2="72" stroke="#78350f" stroke-width="1.5" />

    <text x="30" y="98" font-family="Courier New, monospace" font-size="12">NO VOUCHER : ${nomor}</text>
    <text x="510" y="98" font-family="Courier New, monospace" font-size="12" text-anchor="end">TGL: ${tanggal}</text>
    <text x="30" y="125" font-family="Courier New, monospace" font-size="12">DIBAYAR KE : ${dibayarkanKepada}</text>
    <line x1="25" y1="138" x2="515" y2="138" stroke="#ddd" stroke-dasharray="3,3" />

    <text x="30" y="165" font-family="Courier New, monospace" font-size="12" font-weight="bold">KEPERLUAN PENGELUARAN :</text>
    <text x="30" y="190" font-family="Courier New, monospace" font-size="12">${keperluan}</text>

    <text x="30" y="222" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#555">TERBILANG :</text>
    <rect x="110" y="206" width="400" height="28" fill="#fef3c7" stroke="#fde68a" />
    <text x="120" y="225" font-family="Segoe Script, Brush Script MT, cursive" font-size="12" font-weight="bold" fill="#78350f">${terbilang}</text>

    <!-- Nominal -->
    <rect x="30" y="248" width="220" height="42" fill="#ffffff" stroke="#78350f" stroke-width="2" rx="4" />
    <text x="40" y="276" font-family="Courier New, monospace" font-size="18" font-weight="bold" fill="#78350f">${nominalTeks}</text>
    <text x="270" y="274" font-family="Courier New, monospace" font-size="12" fill="#15803d">STATUS : LUNAS DIBAYAR KAS</text>

    <!-- Pengesahan -->
    <text x="140" y="325" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">Disetujui Kasir,</text>
    <path d="M 110 355 Q 135 330 155 360 T 180 350" fill="none" stroke="#78350f" stroke-width="2" />
    <text x="140" y="385" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#111" text-anchor="middle">( ${disetujui} )</text>

    <text x="400" y="325" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">Diterima Tunai,</text>
    <path d="M 370 355 Q 395 330 420 360 T 445 350" fill="none" stroke="#003566" stroke-width="2" />
    <text x="400" y="385" font-family="Segoe Script, cursive" font-size="13" font-weight="bold" fill="#111" text-anchor="middle">( ${penerima} )</text>
  `;
}

// Helper 5: Tiket Perintis Kalimantan Utara & Speedboat Carter
function tiketPerintis(params: {
  operator: string;
  nomorTiket: string;
  rute: string;
  penumpang: string;
  tanggal: string;
  jam: string;
  biayaTiket: string;
  bagasiAsuransi: string;
  totalBayar: string;
  metode: string;
  warnaTema?: string;
}): string {
  const { operator, nomorTiket, rute, penumpang, tanggal, jam, biayaTiket, bagasiAsuransi, totalBayar, metode, warnaTema = "#0369a1" } = params;
  return `
    <rect width="620" height="380" fill="#ffffff" rx="8" />
    <rect x="10" y="10" width="600" height="360" fill="none" stroke="${warnaTema}" stroke-width="2" rx="6" />

    <text x="30" y="45" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="${warnaTema}">${operator}</text>
    <text x="590" y="45" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="end">BOARDING PASS &amp; TICKET</text>
    <text x="30" y="65" font-family="Courier New, monospace" font-size="11" fill="#666">NO TIKET: ${nomorTiket}</text>
    <text x="590" y="65" font-family="Courier New, monospace" font-size="11" fill="#333" text-anchor="end">${tanggal} • ${jam}</text>
    <line x1="25" y1="75" x2="595" y2="75" stroke="${warnaTema}" stroke-width="1.8" />

    <text x="30" y="105" font-family="Courier New, monospace" font-size="12">NAMA PENUMPANG : ${penumpang}</text>
    <text x="30" y="130" font-family="Courier New, monospace" font-size="12">RUTE PERJALANAN: ${rute}</text>
    <line x1="25" y1="145" x2="595" y2="145" stroke="#ccc" stroke-dasharray="3,3" />

    <text x="30" y="175" font-family="Courier New, monospace" font-size="12">TARIF TIKET DASAR</text>
    <text x="590" y="175" font-family="Courier New, monospace" font-size="12" text-anchor="end">${biayaTiket}</text>

    <text x="30" y="200" font-family="Courier New, monospace" font-size="12">BAGASI &amp; ASURANSI JASA RAHARJA</text>
    <text x="590" y="200" font-family="Courier New, monospace" font-size="12" text-anchor="end">${bagasiAsuransi}</text>
    <line x1="25" y1="215" x2="595" y2="215" stroke="#333" stroke-width="1.5" />

    <text x="30" y="245" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL PEMBAYARAN</text>
    <text x="590" y="245" font-family="Courier New, monospace" font-size="18" font-weight="bold" fill="${warnaTema}" text-anchor="end">${totalBayar}</text>
    <line x1="25" y1="260" x2="595" y2="260" stroke="#333" stroke-width="1.5" />

    <text x="30" y="290" font-family="Courier New, monospace" font-size="12">METODE BAYAR : ${metode}</text>
    <text x="30" y="312" font-family="Courier New, monospace" font-size="12" fill="#15803d">STATUS       : CONFIRMED / LUNAS TIKET</text>

    <!-- Barcode -->
    <rect x="180" y="325" width="260" height="25" fill="#000" opacity="0.8" />
  `;
}

// ====================================================
// DAFTAR ITEM 251 HINGGA 500 (250 BUKTI TRANSAKSI BARU)
// ====================================================

const data500Baru: ItemStruk500[] = [];

// 1. BAGIAN A: ITEMS 251 - 330 (80 KWITANSI RESMI SPJ, HONORARIUM & LEMBAGA ADAT TINGKAT LANJUT)
const daftarKwitansiSpj: {
  judul: string;
  bruto: number;
  pajakPersen: number;
  terbilangNetto: string;
  keperluan: string;
  penerima: string;
  ppk: string;
  bendahara: string;
}[] = [
  { judul: "Kwitansi SPJ Honorarium Tim Ahli Pemetaan Wilayah Adat", bruto: 12500000, pajakPersen: 5, terbilangNetto: "Sebelas Juta Delapan Ratus Tujuh Puluh Lima Ribu Rupiah", keperluan: "Honorarium 5 Tenaga Ahli Pemetaan Partisipatif Hutan Adat Bulan Oktober 2026", penerima: "Dr. Ir. Hendra Saputra, M.Sc", ppk: "Drs. H. Mulyono, M.Si", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Sewa Kendaraan Lapangan 4x4 Ekspedisi", bruto: 9000000, pajakPersen: 2, terbilangNetto: "Delapan Juta Delapan Ratus Dua Puluh Ribu Rupiah", keperluan: "Sewa 2 Unit Hilux Double Cabin 4x4 Lapangan Selama 6 Hari Ekspedisi", penerima: "CV. BORNEO TRANS JAYA", ppk: "Ir. Markus Lukas", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Konsumsi Prasmanan Musyawarah Besar Adat", bruto: 7500000, pajakPersen: 0, terbilangNetto: "Tujuh Juta Lima Ratus Ribu Rupiah", keperluan: "Penyediaan Makanan Prasmanan 300 Porsi Peserta Musyawarah Adat Dayak Bulungan", penerima: "Katering Berkah Bersama", ppk: "Drs. H. Mulyono, M.Si", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Honor Pengurus Lembaga Adat dan Tokoh", bruto: 6000000, pajakPersen: 5, terbilangNetto: "Lima Juta Tujuh Ratus Ribu Rupiah", keperluan: "Uang Saku dan Tali Asih 12 Tokoh Adat Musyawarah Tapal Batas", penerima: "Kepala Adat Besar Aling Ding", ppk: "Ir. Markus Lukas", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Percetakan Buku Dokumen Naskah Akademik", bruto: 4800000, pajakPersen: 2, terbilangNetto: "Empat Juta Tujuh Ratus Empat Ribu Rupiah", keperluan: "Cetak Hardcover Naskah Akademik Wilayah Adat 40 Eksemplar Berwarna", penerima: "Percetakan Media Grafika", ppk: "Drs. H. Mulyono, M.Si", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Pengadaan Patok Cor Beton Batas Wilayah", bruto: 8500000, pajakPersen: 0, terbilangNetto: "Delapan Juta Lima Ratus Ribu Rupiah", keperluan: "Pembuatan 85 Unit Patok Cor Semen Batas Hutan Adat Bertuliskan Cat Reflektif", penerima: "UD. KARYA BETON BULUNGAN", ppk: "Ir. Markus Lukas", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Honor Tenaga Rintis dan Pemasang Patok", bruto: 5400000, pajakPersen: 5, terbilangNetto: "Lima Juta Seratus Tiga Puluh Ribu Rupiah", keperluan: "Upah Harian 6 Tenaga Rintis Jalur Hutan & Pemasangan Patok Cor 9 Hari", penerima: "Bpk. Martinus Talan", ppk: "Ir. Markus Lukas", bendahara: "Siti Aminah, S.E." },
  { judul: "Kwitansi SPJ Sewa Gedung Serbaguna Rapat Pleno", bruto: 3000000, pajakPersen: 10, terbilangNetto: "Dua Juta Tujuh Ratus Ribu Rupiah", keperluan: "Sewa Gedung Pertemuan Serbaguna Selama 2 Hari Kegiatan Pleno Adat", penerima: "Pengelola Balai Pertemuan Umum", ppk: "Drs. H. Mulyono, M.Si", bendahara: "Siti Aminah, S.E." },
];

for (let a = 0; a < 80; a++) {
  const no = 251 + a;
  const master = daftarKwitansiSpj[a % daftarKwitansiSpj.length];
  const modif = a * 25000;
  const brutoAngka = master.bruto + modif;
  const pajakNilaiAngka = master.pajakPersen > 0 ? (brutoAngka * master.pajakPersen) / 100 : 0;
  const nettoAngka = brutoAngka - pajakNilaiAngka;
  const nettoTeks = `Rp ${nettoAngka.toLocaleString("id-ID")}`;

  data500Baru.push({
    nomor: no,
    berkas: `${no}_kwitansi_spj_${master.penerima.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 18)}.png`,
    judul: `${master.judul} #${no}`,
    tag: "Kwitansi SPJ",
    nominalTeks: nettoTeks,
    lebar: 780,
    tinggi: 490,
    svgContent: kwitansiSpjResmi({
      nomor: `${no}/KW-SPJ/XI/2026`,
      tahunAnggaran: "2026",
      mataAnggaran: `5.2.2.0${(a % 4) + 1}`,
      sudahTerimaDari: "Kuasa Pengguna Anggaran / Bendahara Pengeluaran Program",
      uangSejumlah: `${master.terbilangNetto}`,
      untukPembayaran: `${master.keperluan}`,
      bruto: `Rp ${brutoAngka.toLocaleString("id-ID")}`,
      pajakLabel: master.pajakPersen > 0 ? `Potongan Pajak PPh (${master.pajakPersen}%)` : undefined,
      pajakNilai: master.pajakPersen > 0 ? `Rp ${pajakNilaiAngka.toLocaleString("id-ID")}` : undefined,
      netto: nettoTeks,
      terbilangNominal: `=Rp. ${nettoAngka.toLocaleString("id-ID")},-==`,
      kotaTgl: `Tanjung Selor, ${((a % 28) + 1).toString().padStart(2, "0")} November 2026`,
      namaPenerima: master.penerima,
      namaBendahara: master.bendahara,
      namaPpk: master.ppk,
      metode: a % 2 === 0 ? "LUNAS DIBAYAR KAS" : "LUNAS VIA TRANSFER REK",
    }),
  });
}

// 2. BAGIAN B: ITEMS 331 - 390 (60 NOTA KONTAN PASAR NCR RANGKAP & BON WARUNG)
const daftarNotaLanjutan: { toko: string; bidang: string; alamat: string; items: { bny: string; nama: string; harga: string; jml: number }[] }[] = [
  {
    toko: "TOKO BANGUNAN SUMBER URIP",
    bidang: "Semen, Pasir, Seng Gelombang, Paku & Cat",
    alamat: "Jl. Kolonel Soetadji, Tanjung Selor",
    items: [
      { bny: "4 Sak", nama: "Semen Tonasa 50kg", harga: "85.000", jml: 340000 },
      { bny: "6 Lbr", nama: "Seng Gelombang BJLS 0.20", harga: "75.000", jml: 450000 },
      { bny: "3 Kg", nama: "Paku Seng Payung Asli", harga: "35.000", jml: 105000 },
    ],
  },
  {
    toko: "DEPOT MINANG RUMAH GADANG",
    bidang: "Masakan Padang, Nasi Kotak & Aneka Sambal",
    alamat: "Jl. Sabanar Lama No. 24 Bulungan",
    items: [
      { bny: "15 Bks", nama: "Nasi Ayam Bakar Padang", harga: "25.000", jml: 375000 },
      { bny: "15 Gl", nama: "Es Jeruk Peras Murni", harga: "7.000", jml: 105000 },
    ],
  },
  {
    toko: "APOTEK BULUNGAN SEHAT FARMA",
    bidang: "Obat-obatan, Vitamin & Perlengkapan Medis Lapangan",
    alamat: "Jl. Sengkawit Ruko Sentra Farma",
    items: [
      { bny: "4 Btl", nama: "Betadine Antiseptik 60ml", harga: "32.000", jml: 128000 },
      { bny: "10 Roll", nama: "Perban Kasa Steril 10cm", harga: "6.000", jml: 60000 },
      { bny: "5 Strip", nama: "Paracetamol 500mg Strip", harga: "8.000", jml: 40000 },
      { bny: "3 Btl", nama: "Minyak Kayu Putih 120ml", harga: "45.000", jml: 135000 },
    ],
  },
  {
    toko: "KEDAI KOPI DAYAK BORNEO",
    bidang: "Kopi Robusta Kaltara, Teh Herbal & Snack",
    alamat: "Jl. D.I. Panjaitan No. 12 Tanjung Selor",
    items: [
      { bny: "12 Gl", nama: "Kopi Susu Gula Aren Khas", harga: "15.000", jml: 180000 },
      { bny: "10 Pcs", nama: "Roti Panggang Srikaya", harga: "12.000", jml: 120000 },
      { bny: "4 Pcs", nama: "Air Mineral Botol 600ml", harga: "5.000", jml: 20000 },
    ],
  },
];

for (let b = 0; b < 60; b++) {
  const no = 331 + b;
  const master = daftarNotaLanjutan[b % daftarNotaLanjutan.length];
  const modif = b * 3000;
  let totalJumlah = 0;
  const rows = master.items.map((it, idx) => {
    const jmlBaris = idx === 0 ? it.jml + modif : it.jml;
    totalJumlah += jmlBaris;
    return {
      bny: it.bny,
      nama: it.nama,
      harga: it.harga,
      jmlTeks: jmlBaris.toLocaleString("id-ID"),
    };
  });
  const totalTeks = `Rp ${totalJumlah.toLocaleString("id-ID")}`;

  let rowsHtml = "";
  let y = 145;
  for (const r of rows) {
    rowsHtml += `
      <text x="35" y="${y}" font-family="Arial, sans-serif" font-size="12" fill="#111" text-anchor="middle">${r.bny}</text>
      <text x="75" y="${y}" font-family="Arial, sans-serif" font-size="12" fill="#111">${r.nama}</text>
      <text x="315" y="${y}" font-family="Courier New, monospace" font-size="12" fill="#111" text-anchor="end">${r.harga}</text>
      <text x="445" y="${y}" font-family="Courier New, monospace" font-size="12" font-weight="bold" fill="#111" text-anchor="end">${r.jmlTeks}</text>
      <line x1="20" y1="${y + 6}" x2="460" y2="${y + 6}" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2,2" />
    `;
    y += 26;
  }

  const svg = `
    <rect width="480" height="520" fill="#fefdf9" rx="6" />
    <rect x="8" y="8" width="464" height="504" fill="none" stroke="#dc2626" stroke-width="2" rx="4" />

    <text x="240" y="38" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#dc2626" text-anchor="middle">${master.toko}</text>
    <text x="240" y="55" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">${master.bidang}</text>
    <text x="240" y="68" font-family="Arial, sans-serif" font-size="10" fill="#666" text-anchor="middle">${master.alamat}</text>
    <line x1="20" y1="76" x2="460" y2="76" stroke="#dc2626" stroke-width="2" />

    <text x="25" y="94" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#111">NOTA KONTAN</text>
    <text x="450" y="94" font-family="Arial, sans-serif" font-size="11" fill="#333" text-anchor="end">Tgl: ${((b % 28) + 1).toString().padStart(2, "0")}/11/2026</text>
    <text x="25" y="110" font-family="Arial, sans-serif" font-size="11" fill="#555">Kepada Yth: Tim Lapangan Wilayah Adat</text>

    <!-- Header Tabel -->
    <rect x="20" y="118" width="440" height="22" fill="#fee2e2" stroke="#dc2626" stroke-width="1" />
    <text x="35" y="133" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333" text-anchor="middle">Bny</text>
    <text x="75" y="133" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333">Nama Barang</text>
    <text x="315" y="133" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333" text-anchor="end">Harga</text>
    <text x="445" y="133" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#333" text-anchor="end">Jumlah</text>

    ${rowsHtml}

    <!-- Total Akhir Lebar Memadai -->
    <line x1="20" y1="400" x2="460" y2="400" stroke="#dc2626" stroke-width="2" />
    <text x="220" y="425" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#111">JUMLAH RP.</text>
    <rect x="310" y="406" width="150" height="30" fill="#ffffff" stroke="#dc2626" stroke-width="1.8" rx="3" />
    <text x="450" y="427" font-family="Courier New, monospace" font-size="16" font-weight="900" fill="#0f172a" text-anchor="end">${totalTeks}</text>

    <!-- Cap Stempel Kontan -->
    <rect x="60" y="435" width="130" height="34" fill="none" stroke="#b91c1c" stroke-width="2.5" rx="4" />
    <text x="125" y="457" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#b91c1c" text-anchor="middle">LUNAS KONTAN</text>

    <text x="380" y="465" font-family="Arial, sans-serif" font-size="11" fill="#444" text-anchor="middle">Tanda Terima,</text>
    <path d="M 345 490 Q 370 470 385 495 T 415 488" fill="none" stroke="#1e3a8a" stroke-width="2" />
    <text x="380" y="506" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#111" text-anchor="middle">( Kasir Toko )</text>
  `;

  data500Baru.push({
    nomor: no,
    berkas: `${no}_nota_pasar_ncr_${master.toko.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 16)}.png`,
    judul: `Nota Pasar NCR: ${master.toko} #${no}`,
    tag: "Nota Pasar",
    nominalTeks: totalTeks,
    lebar: 480,
    tinggi: 520,
    svgContent: svg,
  });
}

// 3. BAGIAN C: ITEMS 391 - 450 (60 TRANSAKSI PEMBAYARAN, SLIP BANK TELLER, CEK, VOUCHER KAS KECIL & DIGITAL)
const daftarPerbankan: {
  tipe: "slip" | "cek" | "voucher";
  judul: string;
  nominal: number;
  terbilang: string;
  payload: any;
}[] = [
  {
    tipe: "slip",
    judul: "Slip Setoran Tunai Bank Kaltimtara",
    nominal: 1500000,
    terbilang: "Satu Juta Lima Ratus Ribu Rupiah",
    payload: {
      bank: "BANK KALTIMTARA",
      cabang: "KCP TANJUNG SELOR HILIR",
      nomorRekening: "001-09283-7182",
      namaPenerima: "PANITIA PENGURUS ADAT DAYAK",
      penyetor: "YULIUS ZALUKHU",
      telepon: "0812-3456-7890",
      berita: "Setoran tunai dana operasional tim",
      tellerValidasi: "VALIDASI BPD KALTIMTARA TELLER 02",
      warnaTema: "#0284c7",
    },
  },
  {
    tipe: "slip",
    judul: "Slip Setoran Tunai Bank BCA Teller",
    nominal: 2750000,
    terbilang: "Dua Juta Tujuh Ratus Lima Puluh Ribu Rupiah",
    payload: {
      bank: "BANK CENTRAL ASIA",
      cabang: "KCU TARAKAN",
      nomorRekening: "082-9182-371",
      namaPenerima: "CV. RENTAL MOBIL BORNEO",
      penyetor: "AHMAD SYARIF",
      telepon: "0821-9988-7711",
      berita: "Pelunasan sewa armada lapangan",
      tellerValidasi: "BCA VALIDATION TELLER 05 / OK",
      warnaTema: "#003b7a",
    },
  },
  {
    tipe: "cek",
    judul: "Bilyet Giro Bank Mandiri Resmi",
    nominal: 18000000,
    terbilang: "Delapan Belas Juta Rupiah",
    payload: {
      bank: "BANK MANDIRI",
      nomorBg: "BG-MDR-889102",
      tanggalEfektif: "15 November 2026",
      namaPenerima: "YAYASAN KONSERVASI BORNEO LESTARI",
      penarik: "PT. ENERGI HIJAU NUSANTARA",
      kotaTgl: "Tanjung Selor, 10-11-2026",
    },
  },
  {
    tipe: "voucher",
    judul: "Voucher Kas Kecil Pembelian ATK dan Snack",
    nominal: 285000,
    terbilang: "Dua Ratus Delapan Puluh Lima Ribu Rupiah",
    payload: {
      perusahaan: "SEKRETARIAT BERSAMA FASILITASI ADAT",
      nomor: "PCV-2026-11-042",
      dibayarkanKepada: "Sdr. Rendy Pratama",
      keperluan: "Beli Kertas HVS 2 Rim, Map Folio & Kopi Sachet Posko",
      disetujui: "Ibu Nurul (Kasir)",
      penerima: "Rendy Pratama",
    },
  },
];

function angkaKeTerbilang(n: number): string {
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  n = Math.floor(n);
  if (n === 0) return "Nol";
  if (n < 12) return satuan[n];
  if (n < 20) return satuan[n - 10] + " Belas";
  if (n < 100) return satuan[Math.floor(n / 10)] + " Puluh" + (n % 10 > 0 ? " " + angkaKeTerbilang(n % 10) : "");
  if (n < 200) return "Seratus" + (n - 100 > 0 ? " " + angkaKeTerbilang(n - 100) : "");
  if (n < 1000) return satuan[Math.floor(n / 100)] + " Ratus" + (n % 100 > 0 ? " " + angkaKeTerbilang(n % 100) : "");
  if (n < 2000) return "Seribu" + (n - 1000 > 0 ? " " + angkaKeTerbilang(n - 1000) : "");
  if (n < 1000000) return angkaKeTerbilang(Math.floor(n / 1000)) + " Ribu" + (n % 1000 > 0 ? " " + angkaKeTerbilang(n % 1000) : "");
  if (n < 1000000000) return angkaKeTerbilang(Math.floor(n / 1000000)) + " Juta" + (n % 1000000 > 0 ? " " + angkaKeTerbilang(n % 1000000) : "");
  return angkaKeTerbilang(Math.floor(n / 1000000000)) + " Miliar" + (n % 1000000000 > 0 ? " " + angkaKeTerbilang(n % 1000000000) : "");
}

for (let c = 0; c < 60; c++) {
  const no = 391 + c;
  const item = daftarPerbankan[c % daftarPerbankan.length];
  const modif = c * 10000;
  const nominalAngka = item.nominal + modif;
  const nominalTeks = `Rp ${nominalAngka.toLocaleString("id-ID")}`;
  const terbilangDinamis = `${angkaKeTerbilang(nominalAngka)} Rupiah`;
  const tgl = `${((c % 28) + 1).toString().padStart(2, "0")}/11/2026`;

  let svg = "";
  if (item.tipe === "slip") {
    svg = slipSetoranBank({
      ...item.payload,
      tanggal: tgl,
      nominalTeks,
      terbilang: terbilangDinamis,
    });
  } else if (item.tipe === "cek") {
    svg = bilyetGiroCek({
      ...item.payload,
      nominalTeks,
      terbilang: terbilangDinamis,
    });
  } else {
    svg = pettyCashVoucher({
      ...item.payload,
      tanggal: tgl,
      nominalTeks,
      terbilang: terbilangDinamis,
    });
  }

  data500Baru.push({
    nomor: no,
    berkas: `${no}_perbankan_${item.tipe}_${item.judul.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 16)}.png`,
    judul: `${item.judul} #${no}`,
    tag: item.tipe === "voucher" ? "Kas Kecil" : "Perbankan",
    nominalTeks,
    lebar: item.tipe === "cek" ? 720 : item.tipe === "slip" ? 640 : 540,
    tinggi: item.tipe === "cek" ? 360 : item.tipe === "slip" ? 480 : 420,
    svgContent: svg,
  });
}

// 4. BAGIAN D: ITEMS 451 - 500 (50 BUKTI PERJALANAN DINAS, SPEEDBOAT CARTER & TIKET PERINTIS)
const daftarDinas: {
  operator: string;
  rute: string;
  penumpang: string;
  biaya: number;
  asuransi: number;
  metode: string;
  warnaTema?: string;
}[] = [
  { operator: "SMART AVIATION PERINTIS", rute: "TANJUNG SELOR (TJS) -> LONG AMPUNG (LPU)", penumpang: "MARKUS LUKAS (TIM ADAT)", biaya: 420000, asuransi: 25000, metode: "TRANSFER BANK", warnaTema: "#0284c7" },
  { operator: "SUSI AIR PERINTIS BORNEO", rute: "TARAKAN (TRK) -> BIDAYU / LONG LAYU", penumpang: "DR. IR. HENDRA SAPUTRA", biaya: 475000, asuransi: 25000, metode: "DEBIT GPN", warnaTema: "#b91c1c" },
  { operator: "SB. KAYAN EXPEDITION CARTER", rute: "PELABUHAN KAYAN II -> LONG BIA (PP 1 HARI)", penumpang: "ROMBONGAN TIM SURVEI (6 ORANG)", biaya: 3500000, asuransi: 0, metode: "TUNAI CASH", warnaTema: "#1e3a8a" },
  { operator: "KIOS BBM APUNG SUNGAI KAYAN", rute: "PENGISIAN SOLAR INDUSTRI 5 JERIGEN (100L)", penumpang: "OPERATOR MOTOR KETINTING TIM", biaya: 1250000, asuransi: 0, metode: "TUNAI CASH", warnaTema: "#7c2d12" },
  { operator: "STARLINK INDONESIA RESELLER", rute: "TAGIHAN LANGGANAN INTERNET SATELIT POSKO 1 BLN", penumpang: "POSKO TIM LAPANGAN PEDALAMAN", biaya: 750000, asuransi: 0, metode: "TRANSFER VA MANDIRI", warnaTema: "#0f172a" },
];

for (let d = 0; d < 50; d++) {
  const no = 451 + d;
  const item = daftarDinas[d % daftarDinas.length];
  const modif = d * 5000;
  const biayaTiketAngka = item.biaya + modif;
  const totalAngka = biayaTiketAngka + item.asuransi;
  const totalTeks = `Rp ${totalAngka.toLocaleString("id-ID")}`;
  const tgl = `${((d % 28) + 1).toString().padStart(2, "0")}/11/2026`;

  data500Baru.push({
    nomor: no,
    berkas: `${no}_dinas_${item.operator.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 16)}.png`,
    judul: `${item.operator} - ${item.rute.split("->")[0].trim()} #${no}`,
    tag: "Perjalanan Dinas",
    nominalTeks: totalTeks,
    lebar: 620,
    tinggi: 380,
    svgContent: tiketPerintis({
      operator: item.operator,
      nomorTiket: `TKT-${no}-${Date.now().toString().slice(-6)}`,
      rute: item.rute,
      penumpang: item.penumpang,
      tanggal: tgl,
      jam: `${(8 + (d % 8)).toString().padStart(2, "0")}:30 WIB`,
      biayaTiket: `Rp ${biayaTiketAngka.toLocaleString("id-ID")}`,
      bagasiAsuransi: item.asuransi > 0 ? `Rp ${item.asuransi.toLocaleString("id-ID")}` : "Rp 0",
      totalBayar: totalTeks,
      metode: item.metode,
      warnaTema: item.warnaTema,
    }),
  });
}

// Gabungkan 250 item baru ke data500Struk
for (const it of data500Baru) {
  data500Struk.push(it);
}

// Fungsi utama generate semua 500 berkas PNG dan daftar_latihan.json
export async function buat500Dummy() {
  const outputDir = path.resolve(process.cwd(), "public/latihan-ocr");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Memulai pembuatan ${data500Struk.length} berkas bukti transaksi dummy Indonesia (500 item lengkap)...`);

  const daftarJson = [];

  for (const s of data500Struk) {
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

      if (s.nomor % 50 === 0 || s.nomor >= 495) {
        console.log(`[${s.nomor}/500] Selesai: ${s.berkas} (${s.nominalTeks})`);
      }
    } catch (err) {
      console.error(`Gagal membuat ${s.berkas}:`, err);
    }
  }

  // Simpan daftar_latihan.json
  const jsonPath = path.join(outputDir, "daftar_latihan.json");
  fs.writeFileSync(jsonPath, JSON.stringify(daftarJson, null, 2), "utf8");
  console.log(`✓ Selesai membuat 500 struk dummy! Metadata disimpan di ${jsonPath}`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("buat_500_struk_dummy.ts")) {
  buat500Dummy().catch(console.error);
}
