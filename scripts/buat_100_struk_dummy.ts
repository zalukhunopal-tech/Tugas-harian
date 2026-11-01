import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";

export interface ItemStruk100 {
  nomor: number;
  berkas: string;
  judul: string;
  tag: string;
  nominalTeks: string;
  lebar: number;
  tinggi: number;
  svgContent: string;
}

// Helper untuk membuat struk kasir thermal standar
function thermalReceipt(params: {
  toko: string;
  perusahaan?: string;
  alamat?: string;
  tanggal: string;
  nomorBukti: string;
  items: { nama: string; harga: string }[];
  subtotal?: string;
  pajak?: string;
  totalLabel: string;
  totalNilai: string;
  metode: string;
  tunai?: string;
  kembali?: string;
  footer?: string;
}): string {
  const { toko, perusahaan, alamat, tanggal, nomorBukti, items, subtotal, pajak, totalLabel, totalNilai, metode, tunai, kembali, footer } = params;
  let lines = `
    <rect width="480" height="660" fill="#ffffff" />
    <text x="240" y="45" font-family="Courier New, monospace" font-size="20" font-weight="bold" text-anchor="middle">${toko}</text>
  `;
  let y = 68;
  if (perusahaan) {
    lines += `<text x="240" y="${y}" font-family="Courier New, monospace" font-size="12" text-anchor="middle">${perusahaan}</text>`;
    y += 18;
  }
  if (alamat) {
    lines += `<text x="240" y="${y}" font-family="Courier New, monospace" font-size="11" text-anchor="middle">${alamat}</text>`;
    y += 20;
  }
  lines += `<line x1="20" y1="${y}" x2="460" y2="${y}" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />`;
  y += 20;

  lines += `
    <text x="20" y="${y}" font-family="Courier New, monospace" font-size="12">NO: ${nomorBukti}</text>
    <text x="460" y="${y}" font-family="Courier New, monospace" font-size="12" text-anchor="end">TGL: ${tanggal}</text>
  `;
  y += 15;
  lines += `<line x1="20" y1="${y}" x2="460" y2="${y}" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />`;
  y += 25;

  for (const it of items) {
    lines += `
      <text x="20" y="${y}" font-family="Courier New, monospace" font-size="13">${it.nama}</text>
      <text x="460" y="${y}" font-family="Courier New, monospace" font-size="13" text-anchor="end">${it.harga}</text>
    `;
    y += 24;
  }

  lines += `<line x1="20" y1="${y}" x2="460" y2="${y}" stroke="#000" stroke-dasharray="2,2" stroke-width="1" />`;
  y += 22;

  if (subtotal) {
    lines += `
      <text x="20" y="${y}" font-family="Courier New, monospace" font-size="13">SUBTOTAL</text>
      <text x="460" y="${y}" font-family="Courier New, monospace" font-size="13" text-anchor="end">${subtotal}</text>
    `;
    y += 22;
  }

  if (pajak) {
    lines += `
      <text x="20" y="${y}" font-family="Courier New, monospace" font-size="13">PB1 / PAJAK 10%</text>
      <text x="460" y="${y}" font-family="Courier New, monospace" font-size="13" text-anchor="end">${pajak}</text>
    `;
    y += 22;
  }

  lines += `<line x1="20" y1="${y}" x2="460" y2="${y}" stroke="#000" stroke-width="2" />`;
  y += 28;

  lines += `
    <text x="20" y="${y}" font-family="Courier New, monospace" font-size="16" font-weight="bold">${totalLabel}</text>
    <text x="460" y="${y}" font-family="Courier New, monospace" font-size="16" font-weight="bold" text-anchor="end">${totalNilai}</text>
  `;
  y += 18;
  lines += `<line x1="20" y1="${y}" x2="460" y2="${y}" stroke="#000" stroke-width="2" />`;
  y += 24;

  lines += `
    <text x="20" y="${y}" font-family="Courier New, monospace" font-size="12">METODE : ${metode}</text>
  `;
  y += 20;

  if (tunai) {
    lines += `
      <text x="20" y="${y}" font-family="Courier New, monospace" font-size="12">BAYAR (TUNAI) : ${tunai}</text>
    `;
    y += 18;
  }

  if (kembali) {
    lines += `
      <text x="20" y="${y}" font-family="Courier New, monospace" font-size="12">KEMBALIAN : ${kembali}</text>
    `;
    y += 22;
  }

  lines += `
    <text x="240" y="${Math.max(y + 20, 620)}" font-family="Courier New, monospace" font-size="12" text-anchor="middle">${footer || "TERIMA KASIH ATAS KUNJUNGAN ANDA"}</text>
  `;

  return lines;
}

// Helper untuk Kwitansi Formal Indonesia
function kwitansiFormal(params: {
  nomor: string;
  telahDiterima: string;
  uangSejumlah: string;
  untukPembayaran: string;
  terbilangNominal: string;
  kotaTgl: string;
  penerima: string;
}): string {
  return `
    <rect width="700" height="420" fill="#fffdfa" stroke="#d4c5b9" stroke-width="4" />
    <rect x="15" y="15" width="670" height="390" fill="none" stroke="#2b2b2b" stroke-width="1.5" />
    
    <text x="350" y="55" font-family="'Times New Roman', serif" font-size="24" font-weight="bold" letter-spacing="4" text-anchor="middle">KUITANSI PEMBAYARAN</text>
    <text x="350" y="80" font-family="'Courier New', monospace" font-size="13" text-anchor="middle">NO: ${params.nomor}</text>
    <line x1="40" y1="95" x2="660" y2="95" stroke="#222" stroke-width="1.5" />
    
    <text x="45" y="130" font-family="Arial, sans-serif" font-size="13">Telah Diterima Dari</text>
    <text x="195" y="130" font-family="Arial, sans-serif" font-size="13">:</text>
    <text x="210" y="130" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${params.telahDiterima}</text>
    
    <text x="45" y="165" font-family="Arial, sans-serif" font-size="13">Uang Sejumlah</text>
    <text x="195" y="165" font-family="Arial, sans-serif" font-size="13">:</text>
    <text x="210" y="165" font-family="'Times New Roman', serif" font-size="13" font-style="italic" font-weight="bold">${params.uangSejumlah}</text>
    
    <text x="45" y="200" font-family="Arial, sans-serif" font-size="13">Untuk Pembayaran</text>
    <text x="195" y="200" font-family="Arial, sans-serif" font-size="13">:</text>
    <text x="210" y="200" font-family="Arial, sans-serif" font-size="13">${params.untukPembayaran}</text>
    
    <line x1="40" y1="230" x2="660" y2="230" stroke="#bbb" stroke-width="1" />
    
    <rect x="45" y="255" width="260" height="55" fill="#f1f5f9" stroke="#0f172a" stroke-width="2" rx="4" />
    <text x="60" y="292" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">${params.terbilangNominal}</text>
    
    <text x="540" y="260" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">${params.kotaTgl}</text>
    <text x="540" y="280" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">Yang Menerima,</text>
    <text x="540" y="370" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${params.penerima}</text>
    <line x1="430" y1="375" x2="650" y2="375" stroke="#000" stroke-width="1" />
  `;
}

// Helper untuk Bukti Transfer M-Banking / E-Wallet Mobile App
function resiMobileBank(params: {
  namaApp: string;
  judulStatus: string;
  tanggalWaktu: string;
  nomorRef: string;
  pengirim: string;
  penerima: string;
  bankPenerima: string;
  nominalTransfer: string;
  adminFee: string;
  totalDebet: string;
  catatan?: string;
  bgColor?: string;
}): string {
  const bg = params.bgColor || "#0d1b2a";
  return `
    <rect width="450" height="640" fill="${bg}" rx="16" />
    <circle cx="225" cy="55" r="24" fill="#10b981" />
    <path d="M215 55 L222 62 L235 48" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" />
    
    <text x="225" y="105" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">${params.namaApp}</text>
    <text x="225" y="128" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#34d399" text-anchor="middle">${params.judulStatus}</text>
    <text x="225" y="148" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">${params.tanggalWaktu}</text>
    
    <line x1="25" y1="165" x2="425" y2="165" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    
    <text x="35" y="190" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">NO. REFERENSI</text>
    <text x="415" y="190" font-family="Arial, sans-serif" font-size="11" fill="#f8fafc" font-weight="bold" text-anchor="end">${params.nomorRef}</text>
    
    <text x="35" y="225" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">DARI REKENING</text>
    <text x="415" y="225" font-family="Arial, sans-serif" font-size="12" fill="#f8fafc" font-weight="bold" text-anchor="end">${params.pengirim}</text>
    
    <text x="35" y="260" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">PENERIMA</text>
    <text x="415" y="260" font-family="Arial, sans-serif" font-size="13" fill="#38bdf8" font-weight="bold" text-anchor="end">${params.penerima}</text>
    <text x="415" y="278" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1" text-anchor="end">${params.bankPenerima}</text>
    
    <line x1="25" y1="295" x2="425" y2="295" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    
    <text x="35" y="325" font-family="Arial, sans-serif" font-size="12" fill="#cbd5e1">JUMLAH TRANSFER</text>
    <text x="415" y="325" font-family="Arial, sans-serif" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="end">${params.nominalTransfer}</text>
    
    <text x="35" y="355" font-family="Arial, sans-serif" font-size="12" fill="#cbd5e1">BIAYA ADMIN</text>
    <text x="415" y="355" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="end">${params.adminFee}</text>
    
    <rect x="25" y="380" width="400" height="60" fill="rgba(255,255,255,0.06)" rx="8" />
    <text x="40" y="415" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff">TOTAL TRANSAKSI</text>
    <text x="410" y="417" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#34d399" text-anchor="end">${params.totalDebet}</text>
    
    ${
      params.catatan
        ? `<text x="35" y="475" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">CATATAN :</text>
           <text x="35" y="495" font-family="Arial, sans-serif" font-size="12" fill="#f8fafc" font-weight="bold">${params.catatan}</text>`
        : ""
    }
    
    <text x="225" y="580" font-family="Arial, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Resi transaksi elektronik sah dan terverifikasi oleh sistem perbankan</text>
  `;
}

// Koleksi data 100 struk dummy
export const data100Struk: ItemStruk100[] = [];

// ==========================================
// KELOMPOK 1: Minimarket & Supermarket (1-10)
// ==========================================
data100Struk.push(
  {
    nomor: 1,
    berkas: "01_alfamart_harian.png",
    judul: "Alfamart Belanja Harian",
    tag: "Minimarket",
    nominalTeks: "Rp 82.140",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "ALFAMART SENGKAWIT",
      perusahaan: "PT SUMBER ALFARIA TRIJAYA TBK",
      alamat: "JL. SENGKAWIT NO. 14 BULUNGAN",
      tanggal: "18-10-2026 10:15",
      nomorBukti: "1802-9912-1810",
      items: [
        { nama: "MINYAK GORENG 2L", harga: "34.000" },
        { nama: "TELUR AYAM 1KG", harga: "28.500" },
        { nama: "ROTI TAWAR SARI ROTI", harga: "16.000" },
      ],
      subtotal: "78.500",
      pajak: "8.140",
      totalLabel: "TOTAL BELANJA",
      totalNilai: "Rp 82.140",
      metode: "TUNAI",
      tunai: "100.000",
      kembali: "17.860",
    }),
  },
  {
    nomor: 2,
    berkas: "02_indomaret_snack.png",
    judul: "Indomaret Snack & Minuman",
    tag: "Minimarket",
    nominalTeks: "Rp 64.500",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "INDOMARET",
      perusahaan: "PT INDOMARCO PRISMATAMA",
      alamat: "JL. KOLONEL SOETADJI NO. 88",
      tanggal: "19.10.2026 - 14:30",
      nomorBukti: "IDM-88219-994",
      items: [
        { nama: "KOPI BOTOL NESCAFE 220ML", harga: "11.500" },
        { nama: "AQUA AIR MINERAL 1500ML (2)", harga: "14.000" },
        { nama: "BISKUIT OREO 120GR (2)", harga: "19.000" },
        { nama: "TISU PASEO 250 SHEETS", harga: "20.000" },
      ],
      totalLabel: "TOTAL BELANJA",
      totalNilai: "Rp 64.500",
      metode: "QRIS",
    }),
  },
  {
    nomor: 3,
    berkas: "03_alfamidi_super.png",
    judul: "Alfamidi Super Sembako",
    tag: "Minimarket",
    nominalTeks: "Rp 142.500",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "ALFAMIDI SUPER",
      perusahaan: "PT MIDI UTAMA INDONESIA TBK",
      alamat: "JL. JEND. SUDIRMAN NO. 45",
      tanggal: "20/10/2026 16:40",
      nomorBukti: "MIDI-20261020-0012",
      items: [
        { nama: "BERAS SETRA RAMOS 5KG", harga: "74.500" },
        { nama: "SUSU UHT FULL CREAM 1L (2)", harga: "38.000" },
        { nama: "GULA PASIR GULAKU 1KG (2)", harga: "30.000" },
      ],
      totalLabel: "TOTAL BELANJA",
      totalNilai: "Rp 142.500",
      metode: "DEBIT BCA",
    }),
  },
  {
    nomor: 4,
    berkas: "04_superindo_fresh.png",
    judul: "Super Indo Fresh Buah & Daging",
    tag: "Minimarket",
    nominalTeks: "Rp 187.300",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "SUPER INDO",
      perusahaan: "PT LION SUPER INDO",
      alamat: "MALL BULUNGAN LT. DASAR",
      tanggal: "21-10-2026 11:20",
      nomorBukti: "SI-99201-192",
      items: [
        { nama: "DAGING AYAM FILLET 1KG", harga: "68.500" },
        { nama: "APEL FUJI WANGSHAN 1.2KG", harga: "54.800" },
        { nama: "SAYUR BROKOLI SEGAR 500GR", harga: "24.000" },
        { nama: "MINYAK ZAITUN BORGES 250ML", harga: "40.000" },
      ],
      totalLabel: "TOTAL AKHIR",
      totalNilai: "Rp 187.300",
      metode: "QRIS BSI",
    }),
  },
  {
    nomor: 5,
    berkas: "05_hypermart_paket.png",
    judul: "Hypermart Paket Bulanan",
    tag: "Minimarket",
    nominalTeks: "Rp 315.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "HYPERMART",
      perusahaan: "PT MATAHARI PUTRA PRIMA TBK",
      alamat: "TARAKAN GRAND MALL",
      tanggal: "21/10/2026 19:15",
      nomorBukti: "HYP-TRK-88129",
      items: [
        { nama: "PAKET SEMBAKO MERDEKA", harga: "185.000" },
        { nama: "DETERJEN RINSO MATIC 1.8KG", harga: "58.000" },
        { nama: "SABUN MANDI LIFEBUOY (4)", harga: "42.000" },
        { nama: "PASTA GIGI PEPSODENT (2)", harga: "30.000" },
      ],
      totalLabel: "GRAND TOTAL",
      totalNilai: "Rp 315.000",
      metode: "KARTU KREDIT MANDIRI",
    }),
  },
  {
    nomor: 6,
    berkas: "06_familymart_lunch.png",
    judul: "FamilyMart Coffee & Snack",
    tag: "Minimarket",
    nominalTeks: "Rp 58.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "FAMILYMART",
      alamat: "BANDARA JUWATA TARAKAN",
      tanggal: "22-10-2026 08:30",
      nomorBukti: "FM-JW-0192",
      items: [
        { nama: "KOPI KSK (KOPI SUSU KELUARGA)", harga: "18.000" },
        { nama: "CRISPY CHICKEN SPICY", harga: "22.000" },
        { nama: "ODEN MIX STEAMBOAT", harga: "18.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 58.000",
      metode: "GOPAY",
    }),
  },
  {
    nomor: 7,
    berkas: "07_circlek_drinks.png",
    judul: "Circle K Isotonik & Sandwich",
    tag: "Minimarket",
    nominalTeks: "Rp 37.500",
    lebar: 480,
    tinggi: 560,
    svgContent: thermalReceipt({
      toko: "CIRCLE K",
      alamat: "JL. YOS SUDARSO NO. 12",
      tanggal: "22-10-2026 14:10",
      nomorBukti: "CK-88102-39",
      items: [
        { nama: "POCARI SWEAT 500ML (2)", harga: "17.500" },
        { nama: "CLUB SANDWICH EGG & CHEESE", harga: "20.000" },
      ],
      totalLabel: "TOTAL TRANSAKSI",
      totalNilai: "Rp 37.500",
      metode: "TUNAI",
      tunai: "50.000",
      kembali: "12.500",
    }),
  },
  {
    nomor: 8,
    berkas: "08_lawson_bento.png",
    judul: "Lawson Station Bento & Karaage",
    tag: "Minimarket",
    nominalTeks: "Rp 62.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "LAWSON STATION",
      alamat: "REST AREA KM 18",
      tanggal: "23-10-2026 12:45",
      nomorBukti: "LWS-10291-88",
      items: [
        { nama: "BENTO CHICKEN TERIYAKI", harga: "32.000" },
        { nama: "KARAAGE STICK SPICY", harga: "16.000" },
        { nama: "ICED MATCHA LATTE", harga: "14.000" },
      ],
      totalLabel: "TOTAL HARGA",
      totalNilai: "Rp 62.000",
      metode: "SHOPEEPAY",
    }),
  },
  {
    nomor: 9,
    berkas: "09_transmart_elektronik.png",
    judul: "Transmart Kipas & Baterai",
    tag: "Minimarket",
    nominalTeks: "Rp 239.000",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "TRANSMART",
      perusahaan: "PT TRANS RETAIL INDONESIA",
      alamat: "JL. MULAMEN NO. 99",
      tanggal: "23-10-2026 17:00",
      nomorBukti: "TRN-99120-44",
      items: [
        { nama: "KIPAS ANGIN MEJA USB", harga: "189.000" },
        { nama: "BATERAI ENERGIZER AA 4PCS", harga: "50.000" },
      ],
      totalLabel: "TOTAL AKHIR",
      totalNilai: "Rp 239.000",
      metode: "DEBIT BRI",
    }),
  },
  {
    nomor: 10,
    berkas: "10_indomaret_point_pastry.png",
    judul: "Point Coffee & Pastry",
    tag: "Minimarket",
    nominalTeks: "Rp 45.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "POINT COFFEE INDOMARET",
      alamat: "JL. MANGGA DUA NO. 1",
      tanggal: "24-10-2026 09:10",
      nomorBukti: "IDM-PT-8812",
      items: [
        { nama: "ICED CAFE LATTE POINT", harga: "25.000" },
        { nama: "BUTTER CROISSANT PASTRY", harga: "20.000" },
      ],
      totalLabel: "TOTAL BELANJA",
      totalNilai: "Rp 45.000",
      metode: "ISAKU",
    }),
  }
);

// ==========================================
// KELOMPOK 2: Bahan Bakar & SPBU (11-20)
// ==========================================
function spbuReceipt(params: {
  spbuNo: string;
  alamat: string;
  tanggalWaktu: string;
  produk: string;
  hargaPerLiter: string;
  volumeLiter: string;
  totalBayar: string;
  metode: string;
}): string {
  return `
    <rect width="480" height="580" fill="#ffffff" />
    <text x="240" y="45" font-family="Courier New, monospace" font-size="20" font-weight="bold" text-anchor="middle">SPBU PERTAMINA ${params.spbuNo}</text>
    <text x="240" y="70" font-family="Courier New, monospace" font-size="12" text-anchor="middle">${params.alamat}</text>
    <text x="240" y="90" font-family="Courier New, monospace" font-size="14" font-weight="bold" fill="#0284c7" text-anchor="middle">PASTI PAS!</text>
    <line x1="20" y1="105" x2="460" y2="105" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
    
    <text x="20" y="130" font-family="Courier New, monospace" font-size="12">WAKTU : ${params.tanggalWaktu}</text>
    <text x="20" y="155" font-family="Courier New, monospace" font-size="12">NO POL : KU 8821 AB</text>
    <line x1="20" y1="170" x2="460" y2="170" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
    
    <text x="20" y="200" font-family="Courier New, monospace" font-size="13">PRODUK</text>
    <text x="460" y="200" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="end">${params.produk}</text>
    
    <text x="20" y="235" font-family="Courier New, monospace" font-size="13">HARGA / LITER</text>
    <text x="460" y="235" font-family="Courier New, monospace" font-size="13" text-anchor="end">Rp ${params.hargaPerLiter}</text>
    
    <text x="20" y="270" font-family="Courier New, monospace" font-size="13">VOLUME (LITER)</text>
    <text x="460" y="270" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="end">${params.volumeLiter} L</text>
    
    <line x1="20" y1="295" x2="460" y2="295" stroke="#000" stroke-width="2" />
    <text x="20" y="335" font-family="Courier New, monospace" font-size="17" font-weight="bold">TOTAL PEMBAYARAN</text>
    <text x="460" y="335" font-family="Courier New, monospace" font-size="17" font-weight="bold" text-anchor="end">Rp ${params.totalBayar}</text>
    <line x1="20" y1="355" x2="460" y2="355" stroke="#000" stroke-width="2" />
    
    <text x="20" y="390" font-family="Courier New, monospace" font-size="13">METODE: ${params.metode}</text>
    <text x="240" y="520" font-family="Courier New, monospace" font-size="12" text-anchor="middle">TERIMA KASIH DAN SELAMAT JALAN</text>
  `;
}

data100Struk.push(
  {
    nomor: 11,
    berkas: "11_spbu_pertamax_25l.png",
    judul: "SPBU Pertamina Pertamax 25L",
    tag: "BBM",
    nominalTeks: "Rp 323.750",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "64.77102",
      alamat: "JL. RAYA TANJUNG SELOR KM. 4",
      tanggalWaktu: "20/10/2026 08:45",
      produk: "PERTAMAX",
      hargaPerLiter: "12.950",
      volumeLiter: "25.00",
      totalBayar: "323.750",
      metode: "DEBIT MANDIRI",
    }),
  },
  {
    nomor: 12,
    berkas: "12_spbu_dexlite_30l.png",
    judul: "SPBU Pertamina Dexlite 30L",
    tag: "BBM",
    nominalTeks: "Rp 426.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "64.77201",
      alamat: "KABUPATEN NUNUKAN",
      tanggalWaktu: "22/10/2026 11:10",
      produk: "DEXLITE",
      hargaPerLiter: "14.200",
      volumeLiter: "30.00",
      totalBayar: "426.000",
      metode: "TUNAI",
    }),
  },
  {
    nomor: 13,
    berkas: "13_spbu_pertalite_25l.png",
    judul: "SPBU Pertamina Pertalite 25L",
    tag: "BBM",
    nominalTeks: "Rp 250.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "64.77108",
      alamat: "JL. SABANAR LAMA BULUNGAN",
      tanggalWaktu: "23/10/2026 09:30",
      produk: "PERTALITE",
      hargaPerLiter: "10.000",
      volumeLiter: "25.00",
      totalBayar: "250.000",
      metode: "QRIS LINKAJA",
    }),
  },
  {
    nomor: 14,
    berkas: "14_spbu_pertamina_dex_30l.png",
    judul: "SPBU Pertamina Dex 30L",
    tag: "BBM",
    nominalTeks: "Rp 456.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "64.77305",
      alamat: "KABUPATEN MALINAU",
      tanggalWaktu: "24/10/2026 14:00",
      produk: "PERTAMINA DEX",
      hargaPerLiter: "15.200",
      volumeLiter: "30.00",
      totalBayar: "456.000",
      metode: "DEBIT BNI",
    }),
  },
  {
    nomor: 15,
    berkas: "15_spbu_pertamax_turbo_20l.png",
    judul: "SPBU Pertamina Pertamax Turbo 20L",
    tag: "BBM",
    nominalTeks: "Rp 288.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "64.77401",
      alamat: "KOTA TARAKAN PUSAT",
      tanggalWaktu: "24/10/2026 17:15",
      produk: "PERTAMAX TURBO",
      hargaPerLiter: "14.400",
      volumeLiter: "20.00",
      totalBayar: "288.000",
      metode: "QRIS GOPAY",
    }),
  },
  {
    nomor: 16,
    berkas: "16_spbu_solar_truk_50l.png",
    judul: "SPBU Solar Logistik 50L",
    tag: "BBM",
    nominalTeks: "Rp 340.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "64.77502",
      alamat: "PELABUHAN MALUNDUNG TARAKAN",
      tanggalWaktu: "25/10/2026 10:20",
      produk: "BIOSOLAR",
      hargaPerLiter: "6.800",
      volumeLiter: "50.00",
      totalBayar: "340.000",
      metode: "TUNAI",
    }),
  },
  {
    nomor: 17,
    berkas: "17_shell_super_25l.png",
    judul: "Shell Super SPBU 25L",
    tag: "BBM",
    nominalTeks: "Rp 348.750",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "SHELL GATOT SUBROTO",
      alamat: "JL. GATOT SUBROTO NO. 10",
      tanggalWaktu: "25/10/2026 13:40",
      produk: "SHELL SUPER",
      hargaPerLiter: "13.950",
      volumeLiter: "25.00",
      totalBayar: "348.750",
      metode: "DEBIT BCA",
    }),
  },
  {
    nomor: 18,
    berkas: "18_shell_vpower_25l.png",
    judul: "Shell V-Power Nitro 25L",
    tag: "BBM",
    nominalTeks: "Rp 382.500",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "SHELL MT HARYONO",
      alamat: "JL. MT HARYONO NO. 88",
      tanggalWaktu: "26/10/2026 09:10",
      produk: "V-POWER",
      hargaPerLiter: "15.300",
      volumeLiter: "25.00",
      totalBayar: "382.500",
      metode: "KREDIT VISA",
    }),
  },
  {
    nomor: 19,
    berkas: "19_bp_akr_ultimate_24l.png",
    judul: "BP-AKR Ultimate 95 24L",
    tag: "BBM",
    nominalTeks: "Rp 360.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "BP-AKR SERVICE STATION",
      alamat: "JL. RAYA BOULEVARD TIMUR",
      tanggalWaktu: "26/10/2026 15:30",
      produk: "BP ULTIMATE",
      hargaPerLiter: "15.000",
      volumeLiter: "24.00",
      totalBayar: "360.000",
      metode: "QRIS DANA",
    }),
  },
  {
    nomor: 20,
    berkas: "20_spbu_kompak_pedalaman_50l.png",
    judul: "SPBU Kompak Pedalaman 50L",
    tag: "BBM",
    nominalTeks: "Rp 550.000",
    lebar: 480,
    tinggi: 580,
    svgContent: spbuReceipt({
      spbuNo: "PERTAMINA 3T 64.77901",
      alamat: "KECAMATAN SEI MENGGARIS",
      tanggalWaktu: "27/10/2026 11:00",
      produk: "PERTALITE DRUM",
      hargaPerLiter: "11.000",
      volumeLiter: "50.00",
      totalBayar: "550.000",
      metode: "TUNAI",
    }),
  }
);

// ==========================================
// KELOMPOK 3: Kafe & Minuman Populer (21-30)
// ==========================================
data100Struk.push(
  {
    nomor: 21,
    berkas: "21_kopi_kenangan_mantan.png",
    judul: "Kopi Kenangan Mantan",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 63.800",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "KOPI KENANGAN",
      alamat: "OUTLET TARAKAN GRAND MALL",
      tanggal: "21 Okt 2026 15:20",
      nomorBukti: "ORD-9921471",
      items: [
        { nama: "2x Kopi Kenangan Mantan (L)", harga: "42.000" },
        { nama: "2x Roti Coklat Klasik", harga: "16.000" },
      ],
      subtotal: "58.000",
      pajak: "5.800",
      totalLabel: "TOTAL BAYAR",
      totalNilai: "Rp 63.800",
      metode: "QRIS ShopeePay",
    }),
  },
  {
    nomor: 22,
    berkas: "22_janji_jiwa_toast.png",
    judul: "Janji Jiwa Kopi & Toast",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 52.000",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "JANJI JIWA",
      alamat: "JL. PAHLAWAN NO. 18 TANJUNG SELOR",
      tanggal: "22 Okt 2026 10:15",
      nomorBukti: "JJ-TS-88120",
      items: [
        { nama: "Kopi Susu Senja Large", harga: "24.000" },
        { nama: "Jiwa Toast Crispy Chicken", harga: "28.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 52.000",
      metode: "QRIS DANA",
    }),
  },
  {
    nomor: 23,
    berkas: "23_point_coffee_avocadofee.png",
    judul: "Point Coffee Avocadofee",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 48.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "POINT COFFEE",
      alamat: "INDOMARET SENGKAWIT BULUNGAN",
      tanggal: "22 Okt 2026 16:30",
      nomorBukti: "PT-COF-01924",
      items: [
        { nama: "Avocadofee Iced Frappe", harga: "28.000" },
        { nama: "Cold Brew Black Coffee", harga: "20.000" },
      ],
      totalLabel: "TOTAL BELANJA",
      totalNilai: "Rp 48.000",
      metode: "QRIS",
    }),
  },
  {
    nomor: 24,
    berkas: "24_fore_coffee_latte.png",
    judul: "Fore Coffee Aren Latte",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 59.400",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "FORE COFFEE",
      alamat: "TARAKAN AIRPORT LOUNGE",
      tanggal: "23 Okt 2026 08:20",
      nomorBukti: "FORE-TRK-7712",
      items: [
        { nama: "Fore Aren Latte Regular", harga: "29.000" },
        { nama: "Butter Croissant Pastry", harga: "25.000" },
      ],
      subtotal: "54.000",
      pajak: "5.400",
      totalLabel: "GRAND TOTAL",
      totalNilai: "Rp 59.400",
      metode: "QRIS GOPAY",
    }),
  },
  {
    nomor: 25,
    berkas: "25_chatime_milktea.png",
    judul: "Chatime Roasted Milk Tea",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 44.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "CHATIME",
      alamat: "MALL TARAKAN LT. 2",
      tanggal: "23 Okt 2026 14:40",
      nomorBukti: "CHT-88219-01",
      items: [
        { nama: "Roasted Milk Tea (Large)", harga: "32.000" },
        { nama: "Topping Grass Jelly", harga: "6.000" },
        { nama: "Topping Pearl Boba", harga: "6.000" },
      ],
      totalLabel: "TOTAL BAYAR",
      totalNilai: "Rp 44.000",
      metode: "OVO",
    }),
  },
  {
    nomor: 26,
    berkas: "26_haus_indonesia.png",
    judul: "Haus! Indonesia Choco Boba",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 32.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "HAUS!",
      alamat: "JL. JERUK NO. 5 TANJUNG SELOR",
      tanggal: "24 Okt 2026 16:15",
      nomorBukti: "HAUS-TS-1029",
      items: [
        { nama: "Choco Hazelnut Large", harga: "18.000" },
        { nama: "Boba Brown Sugar Fresh Milk", harga: "14.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 32.000",
      metode: "TUNAI",
      tunai: "50.000",
      kembali: "18.000",
    }),
  },
  {
    nomor: 27,
    berkas: "27_mixue_sundae.png",
    judul: "Mixue Ice Cream & Lemonade",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 28.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "MIXUE",
      alamat: "JL. SENGKAWIT SIMPANG 3",
      tanggal: "24 Okt 2026 19:30",
      nomorBukti: "MIX-8829-019",
      items: [
        { nama: "Fresh Squeezed Lemonade", harga: "12.000" },
        { nama: "Boba Sundae Ice Cream", harga: "16.000" },
      ],
      totalLabel: "TOTAL HARGA",
      totalNilai: "Rp 28.000",
      metode: "QRIS DANA",
    }),
  },
  {
    nomor: 28,
    berkas: "28_momoyo_boba.png",
    judul: "Momoyo Tj Selor Boba Milk Tea",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 41.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "MOMOYO TJ SELOR",
      alamat: "JL. KOLONEL SOETADJI BULUNGAN",
      tanggal: "25 Okt 2026 13:10",
      nomorBukti: "MMY-TS-7712",
      items: [
        { nama: "Brown Sugar Boba Milk Tea Jumbo", harga: "26.000" },
        { nama: "Mango Pomelo Sago", harga: "15.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 41.000",
      metode: "QRIS",
    }),
  },
  {
    nomor: 29,
    berkas: "29_tomoro_coffee.png",
    judul: "Tomoro Coffee Oat Latte",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 46.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "TOMORO COFFEE",
      alamat: "JL. JEND. SUDIRMAN TARAKAN",
      tanggal: "25 Okt 2026 17:45",
      nomorBukti: "TMR-8812-99",
      items: [
        { nama: "Tomoro Oat Latte Regular", harga: "24.000" },
        { nama: "Master Blend Americano", harga: "22.000" },
      ],
      totalLabel: "TOTAL AKHIR",
      totalNilai: "Rp 46.000",
      metode: "DEBIT BCA",
    }),
  },
  {
    nomor: 30,
    berkas: "30_starbucks_macchiato.png",
    judul: "Starbucks Coffee Macchiato",
    tag: "Kafe & Kopi",
    nominalTeks: "Rp 96.800",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "STARBUCKS",
      perusahaan: "PT SARI COFFEE INDONESIA",
      alamat: "BANDARA JUWATA TARAKAN",
      tanggal: "26 Okt 2026 09:40",
      nomorBukti: "SBX-JW-10294",
      items: [
        { nama: "Caramel Macchiato Grande", harga: "62.000" },
        { nama: "Cinnamon Roll Pastry", harga: "26.000" },
      ],
      subtotal: "88.000",
      pajak: "8.800",
      totalLabel: "GRAND TOTAL",
      totalNilai: "Rp 96.800",
      metode: "KARTU KREDIT BCA",
    }),
  }
);

// ==========================================
// KELOMPOK 4: Restoran & Makanan (31-40)
// ==========================================
data100Struk.push(
  {
    nomor: 31,
    berkas: "31_mie_gacoan_bulungan.png",
    judul: "Mie Gacoan Bulungan Sengkawit",
    tag: "Restoran",
    nominalTeks: "Rp 53.500",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "MIE GACOAN BULUNGAN - SENGKAWIT",
      alamat: "JL. SENGKAWIT KAB. BULUNGAN",
      tanggal: "21-10-2026 18:45",
      nomorBukti: "GAC-BUL-882104",
      items: [
        { nama: "2x Mie Hompimpa Lv 2", harga: "22.000" },
        { nama: "1x Udang Keju (3 pcs)", harga: "10.500" },
        { nama: "1x Pangsit Goreng (3 pcs)", harga: "10.500" },
        { nama: "2x Es Gobak Sodor", harga: "10.500" },
      ],
      totalLabel: "TOTAL BAYAR",
      totalNilai: "Rp 53.500",
      metode: "QRIS BCA",
    }),
  },
  {
    nomor: 32,
    berkas: "32_rm_padang_sederhana.png",
    judul: "RM Padang Sederhana",
    tag: "Restoran",
    nominalTeks: "Rp 184.800",
    lebar: 480,
    tinggi: 640,
    svgContent: thermalReceipt({
      toko: "RM PADANG SEDERHANA",
      alamat: "JL. KOLONEL SOETADJI NO. 11",
      tanggal: "22-10-2026 12:30",
      nomorBukti: "RMS-TS-2026-991",
      items: [
        { nama: "RENDANG SAPI (2 PORSI)", harga: "52.000" },
        { nama: "AYAM POP GORENG (2 PORSI)", harga: "48.000" },
        { nama: "GULAI TUNJANG", harga: "28.000" },
        { nama: "NASI PUTIH (4 PIRING)", harga: "40.000" },
      ],
      subtotal: "168.000",
      pajak: "16.800",
      totalLabel: "GRAND TOTAL",
      totalNilai: "Rp 184.800",
      metode: "DEBIT MANDIRI",
    }),
  },
  {
    nomor: 33,
    berkas: "33_solaria_restoran.png",
    judul: "Solaria Restoran Grand Mall",
    tag: "Restoran",
    nominalTeks: "Rp 156.200",
    lebar: 480,
    tinggi: 640,
    svgContent: thermalReceipt({
      toko: "SOLARIA",
      alamat: "TARAKAN GRAND MALL LT. 2",
      tanggal: "22 Okt 2026 19:40",
      nomorBukti: "SOL-TRK-88129",
      items: [
        { nama: "Nasi Goreng Seafood Spesial", harga: "48.000" },
        { nama: "Chicken Cordon Bleu + Fries", harga: "56.000" },
        { nama: "Mie Ayam Katsu Teriyaki", harga: "38.000" },
      ],
      subtotal: "142.000",
      pajak: "14.200",
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 156.200",
      metode: "QRIS LIVIN",
    }),
  },
  {
    nomor: 34,
    berkas: "34_kfc_super_besar.png",
    judul: "KFC Fast Food Super Besar",
    tag: "Restoran",
    nominalTeks: "Rp 102.500",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "KFC",
      perusahaan: "PT FAST FOOD INDONESIA TBK",
      alamat: "JL. YOS SUDARSO NO. 55",
      tanggal: "23/10/2026 13:15",
      nomorBukti: "KFC-TS-9912",
      items: [
        { nama: "2x Paket Super Besar 2 Crispy", harga: "78.000" },
        { nama: "1x KFC Winger Party", harga: "24.500" },
      ],
      totalLabel: "TOTAL AKHIR",
      totalNilai: "Rp 102.500",
      metode: "DEBIT BCA",
    }),
  },
  {
    nomor: 35,
    berkas: "35_mcdonalds_panas.png",
    judul: "McDonald's PaNas Spesial",
    tag: "Restoran",
    nominalTeks: "Rp 89.000",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "MCDONALD'S",
      alamat: "OUTLET DRIVETHRU TARAKAN",
      tanggal: "23-10-2026 20:10",
      nomorBukti: "MCD-TRK-7712",
      items: [
        { nama: "2x PaNas Spesial Ayam Spicy", harga: "68.000" },
        { nama: "1x McFlurry Oreo", harga: "14.000" },
        { nama: "1x Apple Pie", harga: "7.000" },
      ],
      totalLabel: "TOTAL BAYAR",
      totalNilai: "Rp 89.000",
      metode: "QRIS GOPAY",
    }),
  },
  {
    nomor: 36,
    berkas: "36_richeese_fire_chicken.png",
    judul: "Richeese Factory Fire Chicken",
    tag: "Restoran",
    nominalTeks: "Rp 74.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "RICHEESE FACTORY",
      alamat: "JL. PAHLAWAN NO. 88",
      tanggal: "24-10-2026 12:20",
      nomorBukti: "RF-8821-09",
      items: [
        { nama: "Combo 1 Fire Chicken Lv 3", harga: "44.000" },
        { nama: "Fire Wings 3 pcs", harga: "30.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 74.000",
      metode: "SHOPEEPAY",
    }),
  },
  {
    nomor: 37,
    berkas: "37_hokben_bento.png",
    judul: "HokBen Bento Spesial",
    tag: "Restoran",
    nominalTeks: "Rp 118.000",
    lebar: 480,
    tinggi: 600,
    svgContent: thermalReceipt({
      toko: "HOKBEN",
      perusahaan: "PT EKA BOGAINTI",
      alamat: "MALL TARAKAN LT. GF",
      tanggal: "24-10-2026 18:30",
      nomorBukti: "HKB-TRK-8812",
      items: [
        { nama: "Paket Bento Spesial 1", harga: "65.000" },
        { nama: "Tokyo Bowl Chicken Teriyaki", harga: "38.000" },
        { nama: "Ocha Dingin (2)", harga: "15.000" },
      ],
      totalLabel: "TOTAL AKHIR",
      totalNilai: "Rp 118.000",
      metode: "DEBIT MANDIRI",
    }),
  },
  {
    nomor: 38,
    berkas: "38_rm_padang_pagi_sore.png",
    judul: "RM Padang Pagi Sore",
    tag: "Restoran",
    nominalTeks: "Rp 245.000",
    lebar: 480,
    tinggi: 640,
    svgContent: thermalReceipt({
      toko: "RM PADANG PAGI SORE",
      alamat: "JL. JEND. SUDIRMAN NO. 100",
      tanggal: "25-10-2026 13:00",
      nomorBukti: "PS-2026-8812",
      items: [
        { nama: "AYAM GORENG POP SPESIAL (3)", harga: "84.000" },
        { nama: "RENDANG DAGING SAPI (2)", harga: "60.000" },
        { nama: "GULAI KEPALA KAKAP", harga: "65.000" },
        { nama: "NASI & SAMBAL IJO (4)", harga: "36.000" },
      ],
      totalLabel: "TOTAL TAGIHAN",
      totalNilai: "Rp 245.000",
      metode: "QRIS BCA",
    }),
  },
  {
    nomor: 39,
    berkas: "39_bebek_kaleyo.png",
    judul: "Warung Bebek Kaleyo",
    tag: "Restoran",
    nominalTeks: "Rp 87.500",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "BEBEK KALEYO",
      alamat: "JL. VETERAN NO. 22",
      tanggal: "25-10-2026 19:15",
      nomorBukti: "BKL-8821-44",
      items: [
        { nama: "Bebek Goreng Kremes Paha", harga: "38.500" },
        { nama: "Bebek Cabe Ijo Dada", harga: "39.000" },
        { nama: "Es Kelapa Muda", harga: "10.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 87.500",
      metode: "TUNAI",
      tunai: "100.000",
      kembali: "12.500",
    }),
  },
  {
    nomor: 40,
    berkas: "40_dcost_seafood.png",
    judul: "D'Cost Seafood Makan Bersama",
    tag: "Restoran",
    nominalTeks: "Rp 215.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "D'COST SEAFOOD",
      alamat: "DERMAGA WISATA TARAKAN",
      tanggal: "26-10-2026 12:45",
      nomorBukti: "DC-TRK-99120",
      items: [
        { nama: "Ikan Gurame Bakar Kecap", harga: "85.000" },
        { nama: "Udang Saus Padang", harga: "65.000" },
        { nama: "Kangkung Balacan Hotplate", harga: "25.000" },
        { nama: "Nasi Putih & Es Teh (4)", harga: "40.000" },
      ],
      totalLabel: "GRAND TOTAL",
      totalNilai: "Rp 215.000",
      metode: "DEBIT BNI",
    }),
  }
);

// ==========================================
// KELOMPOK 5: Kwitansi Sewa & Mobilisasi (41-50)
// ==========================================
data100Struk.push(
  {
    nomor: 41,
    berkas: "41_kwitansi_sewa_hilux_4x4.png",
    judul: "Kwitansi Sewa Hilux 4x4 Lapangan",
    tag: "Rental Kendaraan",
    nominalTeks: "Rp 4.500.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "042/KW-BRC/X/2026",
      telahDiterima: "Tim Fasilitasi Wilayah Adat",
      uangSejumlah: "Empat Juta Lima Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Mobil Toyota Hilux 4x4 + Driver Lapangan (3 Hari)",
      terbilangNominal: "Rp 4.500.000,-",
      kotaTgl: "Tarakan, 25 Oktober 2026",
      penerima: "CV. BORNEO RENT CAR",
    }),
  },
  {
    nomor: 42,
    berkas: "42_kwitansi_sewa_avanza.png",
    judul: "Kwitansi Sewa Avanza Operasional",
    tag: "Rental Kendaraan",
    nominalTeks: "Rp 1.400.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "088/KW-AVZ/X/2026",
      telahDiterima: "Sekretariat Panitia Workshop",
      uangSejumlah: "Satu Juta Empat Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Toyota Avanza Veloz Operasional Kota (2 Hari)",
      terbilangNominal: "Rp 1.400.000,-",
      kotaTgl: "Tanjung Selor, 26 Oktober 2026",
      penerima: "RENTAL JAYA ABADI",
    }),
  },
  {
    nomor: 43,
    berkas: "43_kwitansi_sewa_innova.png",
    judul: "Kwitansi Sewa Innova Reborn Tamu",
    tag: "Rental Kendaraan",
    nominalTeks: "Rp 2.400.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "112/MR-KW/X/2026",
      telahDiterima: "Bendahara Pengeluaran Kegiatan",
      uangSejumlah: "Dua Juta Empat Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Mobil Toyota Innova Reborn + BBM Tamu Narasumber (2 Hari)",
      terbilangNominal: "Rp 2.400.000,-",
      kotaTgl: "Tanjung Selor, 26 Oktober 2026",
      penerima: "CV. MANDIRI RENTAL KALTARA",
    }),
  },
  {
    nomor: 44,
    berkas: "44_kwitansi_sewa_motor.png",
    judul: "Kwitansi Sewa Motor Beat Lapangan",
    tag: "Rental Kendaraan",
    nominalTeks: "Rp 450.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "019/KW-MTR/X/2026",
      telahDiterima: "Surveyor Pemetaan Lapangan",
      uangSejumlah: "Empat Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Sewa Motor Honda Beat untuk Survei Dusun (5 Hari)",
      terbilangNominal: "Rp 450.000,-",
      kotaTgl: "Malinau, 27 Oktober 2026",
      penerima: "RENTAL MOTOR BORNEO",
    }),
  },
  {
    nomor: 45,
    berkas: "45_kwitansi_sewa_hiace.png",
    judul: "Kwitansi Sewa Hiace 14 Seat",
    tag: "Rental Kendaraan",
    nominalTeks: "Rp 3.200.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "077/KW-HAC/X/2026",
      telahDiterima: "Panitia Pelatihan Pengelolaan Hutan",
      uangSejumlah: "Tiga Juta Dua Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Mobil Toyota Hiace Commuter 14 Seat Antar Jemput Peserta (2 Hari)",
      terbilangNominal: "Rp 3.200.000,-",
      kotaTgl: "Tarakan, 27 Oktober 2026",
      penerima: "PO. TRANS KALTARA RAYA",
    }),
  },
  {
    nomor: 46,
    berkas: "46_kwitansi_ketinting_sungai.png",
    judul: "Kwitansi Carteran Perahu Ketinting",
    tag: "Transportasi",
    nominalTeks: "Rp 850.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "005/KW-KTT/X/2026",
      telahDiterima: "Tim Survei Lapangan",
      uangSejumlah: "Delapan Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Carteran Perahu Ketinting Susur Sungai Kayan 1 Hari Penuh",
      terbilangNominal: "Rp 850.000,-",
      kotaTgl: "Tanjung Selor, 27 Oktober 2026",
      penerima: "MOTORIS SUNGAI KAYAN (PAK USMAN)",
    }),
  },
  {
    nomor: 47,
    berkas: "47_kwitansi_longboat_40pk.png",
    judul: "Kwitansi Longboat Mesin Tempel",
    tag: "Transportasi",
    nominalTeks: "Rp 1.800.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "018/KW-LGB/X/2026",
      telahDiterima: "Koordinator Tim Medis Lapangan",
      uangSejumlah: "Satu Juta Delapan Ratus Ribu Rupiah",
      untukPembayaran: "Carteran Longboat Mesin Tempel 40PK Antar Desa Terpencil",
      terbilangNominal: "Rp 1.800.000,-",
      kotaTgl: "Nunukan, 28 Oktober 2026",
      penerima: "JASA ANGKUTAN AIR SEBATIK",
    }),
  },
  {
    nomor: 48,
    berkas: "48_kwitansi_truk_logistik.png",
    judul: "Kwitansi Truk Angkut Logistik",
    tag: "Transportasi",
    nominalTeks: "Rp 1.250.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "091/TRK-KW/X/2026",
      telahDiterima: "Logistik Kegiatan Bencana",
      uangSejumlah: "Satu Juta Dua Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Jasa Truk Engkel Angkut Bahan Bantuan Posko Lapangan",
      terbilangNominal: "Rp 1.250.000,-",
      kotaTgl: "Tanjung Selor, 28 Oktober 2026",
      penerima: "EKSPEDISI BORNEO JAYA",
    }),
  },
  {
    nomor: 49,
    berkas: "49_kwitansi_sewa_pickup.png",
    judul: "Kwitansi Sewa Gran Max Pick-up",
    tag: "Rental Kendaraan",
    nominalTeks: "Rp 700.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "034/PU-KW/X/2026",
      telahDiterima: "Panitia Pameran UMKM",
      uangSejumlah: "Tujuh Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Pick-up Daihatsu Gran Max Angkut Stand Pameran (1 Hari)",
      terbilangNominal: "Rp 700.000,-",
      kotaTgl: "Tarakan, 28 Oktober 2026",
      penerima: "RENTAL PICKUP JUATA",
    }),
  },
  {
    nomor: 50,
    berkas: "50_kwitansi_speedboat_carter.png",
    judul: "Kwitansi Carteran Speedboat Tim",
    tag: "Transportasi",
    nominalTeks: "Rp 3.500.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "062/SB-KW/X/2026",
      telahDiterima: "Tim Monitoring Provinsi Kaltara",
      uangSejumlah: "Tiga Juta Lima Ratus Ribu Rupiah",
      untukPembayaran: "Carteran Speedboat Khusus Rute Tarakan - Bunyu PP",
      terbilangNominal: "Rp 3.500.000,-",
      kotaTgl: "Tarakan, 29 Oktober 2026",
      penerima: "PENGELOLA SPEEDBOAT DERMAGA TENGKAYU",
    }),
  }
);

// ==========================================
// KELOMPOK 6: Akomodasi Hotel & Wisma (51-60)
// ==========================================
data100Struk.push(
  {
    nomor: 51,
    berkas: "51_hotel_tarakan_plaza.png",
    judul: "Kwitansi Hotel Tarakan Plaza",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 950.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "INV-HTP-2026-881",
      telahDiterima: "Bapak Ahmad (Fasilitator Lapangan)",
      uangSejumlah: "Sembilan Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Menginap Deluxe Room 2 Malam (Checkin: 24/10/2026)",
      terbilangNominal: "Rp 950.000,-",
      kotaTgl: "Tarakan, 26 Oktober 2026",
      penerima: "HOTEL TARAKAN PLAZA",
    }),
  },
  {
    nomor: 52,
    berkas: "52_swiss_belhotel_tarakan.png",
    judul: "Kwitansi Swiss-Belhotel Tarakan",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 820.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "SBH-TRK-99120",
      telahDiterima: "Sekretariat Panitia Workshop",
      uangSejumlah: "Delapan Ratus Dua Puluh Ribu Rupiah",
      untukPembayaran: "Kamar Superior Room 1 Malam Termasuk Sarapan Pagi",
      terbilangNominal: "Rp 820.000,-",
      kotaTgl: "Tarakan, 26 Oktober 2026",
      penerima: "SWISS-BELHOTEL TARAKAN",
    }),
  },
  {
    nomor: 53,
    berkas: "53_hotel_luminor_bulungan.png",
    judul: "Kwitansi Hotel Luminor Tanjung Selor",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 650.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "LMN-TS-8812",
      telahDiterima: "Ibu Nurul (Narasumber Pelatihan)",
      uangSejumlah: "Enam Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Menginap Standard Room 1 Malam",
      terbilangNominal: "Rp 650.000,-",
      kotaTgl: "Tanjung Selor, 27 Oktober 2026",
      penerima: "HOTEL LUMINOR TANJUNG SELOR",
    }),
  },
  {
    nomor: 54,
    berkas: "54_hotel_grand_fortuna_nunukan.png",
    judul: "Kwitansi Hotel Grand Fortuna",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 780.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "GFH-NNK-0192",
      telahDiterima: "Tim Pengawas Lapangan",
      uangSejumlah: "Tujuh Ratus Delapan Puluh Ribu Rupiah",
      untukPembayaran: "Sewa Kamar Bisnis 2 Malam di Nunukan",
      terbilangNominal: "Rp 780.000,-",
      kotaTgl: "Nunukan, 27 Oktober 2026",
      penerima: "HOTEL GRAND FORTUNA",
    }),
  },
  {
    nomor: 55,
    berkas: "55_wisma_pemda_bulungan.png",
    judul: "Kwitansi Wisma Tamu Bulungan",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 600.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "WPB-2026-0044",
      telahDiterima: "Peserta Bimbingan Teknis",
      uangSejumlah: "Enam Ratus Ribu Rupiah",
      untukPembayaran: "Akomodasi Kamar Wisma Tamu Pemda (3 Malam)",
      terbilangNominal: "Rp 600.000,-",
      kotaTgl: "Tanjung Selor, 28 Oktober 2026",
      penerima: "PENGELOLA WISMA PEMDA BULUNGAN",
    }),
  },
  {
    nomor: 56,
    berkas: "56_homestay_asri_malinau.png",
    judul: "Kwitansi Homestay Asri Malinau",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 800.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "HST-MLN-019",
      telahDiterima: "Peneliti Sosial Budaya",
      uangSejumlah: "Delapan Ratus Ribu Rupiah",
      untukPembayaran: "Penginapan Homestay Warga Desa (4 Malam @ Rp 200.000)",
      terbilangNominal: "Rp 800.000,-",
      kotaTgl: "Malinau, 28 Oktober 2026",
      penerima: "HOMESTAY ASRI MALINAU",
    }),
  },
  {
    nomor: 57,
    berkas: "57_guesthouse_borneo_sebatik.png",
    judul: "Kwitansi Guest House Sebatik",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 500.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "GHB-SBT-991",
      telahDiterima: "Tim Pendataan Perbatasan",
      uangSejumlah: "Lima Ratus Ribu Rupiah",
      untukPembayaran: "Sewa Kamar Guest House Ber-AC (2 Malam)",
      terbilangNominal: "Rp 500.000,-",
      kotaTgl: "Sebatik, 28 Oktober 2026",
      penerima: "GUEST HOUSE BORNEO SEBATIK",
    }),
  },
  {
    nomor: 58,
    berkas: "58_hotel_harmoni_tanjung_selor.png",
    judul: "Kwitansi Hotel Harmoni",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 550.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "HRM-TS-2026-11",
      telahDiterima: "Dr. Hendra Wijaya",
      uangSejumlah: "Lima Ratus Lima Puluh Ribu Rupiah",
      untukPembayaran: "Menginap Deluxe King Room 1 Malam",
      terbilangNominal: "Rp 550.000,-",
      kotaTgl: "Tanjung Selor, 29 Oktober 2026",
      penerima: "HOTEL HARMONI",
    }),
  },
  {
    nomor: 59,
    berkas: "59_penginapan_sungai_nyamuk.png",
    judul: "Kwitansi Penginapan Sungai Nyamuk",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 660.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "PSN-SBT-881",
      telahDiterima: "Tim Operasional Logistik",
      uangSejumlah: "Enam Ratus Enam Puluh Ribu Rupiah",
      untukPembayaran: "Sewa Kamar Penginapan 3 Malam di Sebatik Timur",
      terbilangNominal: "Rp 660.000,-",
      kotaTgl: "Sungai Nyamuk, 29 Oktober 2026",
      penerima: "PENGINAPAN SUNGAI NYAMUK",
    }),
  },
  {
    nomor: 60,
    berkas: "60_paket_meeting_wisma_atlet.png",
    judul: "Kwitansi Paket Ruang Rapat & Kamar",
    tag: "Akomodasi Hotel",
    nominalTeks: "Rp 2.100.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "WMA-TRK-771",
      telahDiterima: "Panitia Rapat Koordinasi",
      uangSejumlah: "Dua Juta Seratus Ribu Rupiah",
      untukPembayaran: "Paket Ruang Rapat Halfday + 2 Kamar Istirahat Panitia",
      terbilangNominal: "Rp 2.100.000,-",
      kotaTgl: "Tarakan, 29 Oktober 2026",
      penerima: "PENGELOLA WISMA ATLET TARAKAN",
    }),
  }
);

// ==========================================
// KELOMPOK 7: Tiket Perjalanan & Karcis (61-70)
// ==========================================
function ticketLayout(params: {
  operator: string;
  jenisTiket: string;
  nomorTiket: string;
  tanggalWaktu: string;
  penumpang: string;
  rute: string;
  kursi: string;
  tarif: string;
  totalBayar: string;
}): string {
  return `
    <rect width="520" height="420" fill="#fdfbf7" stroke="#1e293b" stroke-width="2" rx="10" />
    <rect x="0" y="0" width="520" height="70" fill="#0f172a" rx="10" />
    <text x="260" y="35" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">${params.operator}</text>
    <text x="260" y="58" font-family="Arial, sans-serif" font-size="12" fill="#93c5fd" text-anchor="middle">${params.jenisTiket}</text>
    
    <text x="30" y="105" font-family="'Courier New', monospace" font-size="12" fill="#475569">NO TIKET : ${params.nomorTiket}</text>
    <text x="490" y="105" font-family="'Courier New', monospace" font-size="12" fill="#475569" text-anchor="end">${params.tanggalWaktu}</text>
    <line x1="25" y1="120" x2="495" y2="120" stroke="#cbd5e1" stroke-dasharray="4,4" stroke-width="1.5" />
    
    <text x="30" y="150" font-family="Arial, sans-serif" font-size="12" fill="#64748b">NAMA PENUMPANG :</text>
    <text x="30" y="172" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">${params.penumpang}</text>
    
    <text x="30" y="210" font-family="Arial, sans-serif" font-size="12" fill="#64748b">RUTE / JURUSAN :</text>
    <text x="30" y="232" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0284c7">${params.rute}</text>
    
    <text x="380" y="210" font-family="Arial, sans-serif" font-size="12" fill="#64748b">KURSI / SEAT :</text>
    <text x="380" y="235" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">${params.kursi}</text>
    
    <line x1="25" y1="260" x2="495" y2="260" stroke="#cbd5e1" stroke-width="1" />
    
    <text x="30" y="295" font-family="Arial, sans-serif" font-size="13" fill="#475569">TARIF TIKET</text>
    <text x="490" y="295" font-family="Arial, sans-serif" font-size="13" fill="#475569" text-anchor="end">Rp ${params.tarif}</text>
    
    <rect x="25" y="320" width="470" height="50" fill="#f1f5f9" stroke="#94a3b8" rx="6" />
    <text x="45" y="352" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">TOTAL BAYAR</text>
    <text x="475" y="352" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#059669" text-anchor="end">Rp ${params.totalBayar}</text>
    
    <text x="260" y="400" font-family="Arial, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Termasuk asuransi kecelakaan penumpang resmi. Selamat menikmati perjalanan!</text>
  `;
}

data100Struk.push(
  {
    nomor: 61,
    berkas: "61_tiket_bus_borneo_trans.png",
    judul: "Tiket Bus PO Borneo Trans",
    tag: "Tiket Bus",
    nominalTeks: "Rp 180.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "PO. BORNEO TRANS EKSEKUTIF",
      jenisTiket: "TIKET PENUMPANG ANGKUTAN DARAT",
      nomorTiket: "BT-2026-X-0094",
      tanggalWaktu: "31-10-2026 08:00",
      penumpang: "BAMBANG SUPRIYADI",
      rute: "TANJUNG SELOR - BERAU",
      kursi: "3B",
      tarif: "180.000",
      totalBayar: "180.000",
    }),
  },
  {
    nomor: 62,
    berkas: "62_tiket_damri_malinau.png",
    judul: "Tiket Bus DAMRI Perintis",
    tag: "Tiket Bus",
    nominalTeks: "Rp 160.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "PERUM DAMRI ANGKUTAN PERINTIS",
      jenisTiket: "TIKET BUS ANGKUTAN JALAN",
      nomorTiket: "DMR-MLN-8812",
      tanggalWaktu: "28-10-2026 07:30",
      penumpang: "IRWAN SETIAWAN",
      rute: "TANJUNG SELOR - MALINAU",
      kursi: "12",
      tarif: "160.000",
      totalBayar: "160.000",
    }),
  },
  {
    nomor: 63,
    berkas: "63_tiket_speedboat_menara_niklas.png",
    judul: "Tiket Speedboat SB. Menara Niklas",
    tag: "Tiket Transportasi",
    nominalTeks: "Rp 280.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "SB. MENARA NIKLAS EXPRESS",
      jenisTiket: "TIKET PENUMPANG ANGKUTAN AIR",
      nomorTiket: "MN-TRK-7712",
      tanggalWaktu: "29-10-2026 09:15",
      penumpang: "YULIUS ZALUKHU",
      rute: "TANJUNG SELOR - TARAKAN",
      kursi: "15",
      tarif: "280.000",
      totalBayar: "280.000",
    }),
  },
  {
    nomor: 64,
    berkas: "64_tiket_speedboat_trisna.png",
    judul: "Tiket Speedboat SB. Trisna Express",
    tag: "Tiket Transportasi",
    nominalTeks: "Rp 320.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "SB. TRISNA EXPRESS",
      jenisTiket: "TIKET ANGKUTAN LAUT / AIR",
      nomorTiket: "TSN-NNK-0091",
      tanggalWaktu: "29-10-2026 11:30",
      penumpang: "AHMAD FAUZI",
      rute: "TARAKAN - NUNUKAN",
      kursi: "08",
      tarif: "320.000",
      totalBayar: "320.000",
    }),
  },
  {
    nomor: 65,
    berkas: "65_tiket_speedboat_menara_as.png",
    judul: "Tiket Speedboat SB. Menara AS",
    tag: "Tiket Transportasi",
    nominalTeks: "Rp 350.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "SB. MENARA AS EXPRESS",
      jenisTiket: "TIKET SPEEDBOAT ANGKUTAN AIR",
      nomorTiket: "MAS-SBT-8821",
      tanggalWaktu: "30-10-2026 10:00",
      penumpang: "HENDRA SAPUTRA",
      rute: "TARAKAN - SEBATIK",
      kursi: "21",
      tarif: "350.000",
      totalBayar: "350.000",
    }),
  },
  {
    nomor: 66,
    berkas: "66_boarding_pass_susi_air.png",
    judul: "Boarding Pass Susi Air Perintis",
    tag: "Tiket Pesawat",
    nominalTeks: "Rp 450.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "SUSI AIR PENERBANGAN PERINTIS",
      jenisTiket: "BOARDING PASS / PASSENGER TICKET",
      nomorTiket: "SI-LBW-8812",
      tanggalWaktu: "30-10-2026 08:30",
      penumpang: "BAMBANG SURYONO",
      rute: "TARAKAN - LONG BAWAN",
      kursi: "04A",
      tarif: "450.000",
      totalBayar: "450.000",
    }),
  },
  {
    nomor: 67,
    berkas: "67_boarding_pass_wings_air.png",
    judul: "Boarding Pass Wings Air ATR-72",
    tag: "Tiket Pesawat",
    nominalTeks: "Rp 1.450.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "WINGS AIR (LION GROUP)",
      jenisTiket: "BOARDING PASS PENERBANGAN",
      nomorTiket: "IW-1420-TJS",
      tanggalWaktu: "30-10-2026 14:15",
      penumpang: "RATNA DEWI",
      rute: "TANJUNG SELOR - BALIKPAPAN",
      kursi: "11C",
      tarif: "1.450.000",
      totalBayar: "1.450.000",
    }),
  },
  {
    nomor: 68,
    berkas: "68_eticket_garuda_indonesia.png",
    judul: "E-Ticket Garuda Indonesia",
    tag: "Tiket Pesawat",
    nominalTeks: "Rp 2.380.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "GARUDA INDONESIA",
      jenisTiket: "ELECTRONIC TICKET / ITINERARY RECEIPT",
      nomorTiket: "GA-612-TRK",
      tanggalWaktu: "31-10-2026 11:20",
      penumpang: "DR. ARIF BUDIMAN",
      rute: "TARAKAN - JAKARTA (CGK)",
      kursi: "18A",
      tarif: "2.380.000",
      totalBayar: "2.380.000",
    }),
  },
  {
    nomor: 69,
    berkas: "69_tiket_kapal_ferry_asdp.png",
    judul: "Tiket Kapal Ferry ASDP",
    tag: "Tiket Transportasi",
    nominalTeks: "Rp 115.000",
    lebar: 520,
    tinggi: 420,
    svgContent: ticketLayout({
      operator: "ASDP INDONESIA FERRY",
      jenisTiket: "TIKET PENUMPANG & KENDARAAN R2",
      nomorTiket: "ASDP-TRK-991",
      tanggalWaktu: "31-10-2026 15:00",
      penumpang: "SUGIYANTO",
      rute: "TARAKAN - ANACAM",
      kursi: "DEK 2",
      tarif: "115.000",
      totalBayar: "115.000",
    }),
  },
  {
    nomor: 70,
    berkas: "70_karcis_parkir_dermaga.png",
    judul: "Karcis Parkir Inap Dermaga",
    tag: "Karcis Parkir",
    nominalTeks: "Rp 50.000",
    lebar: 480,
    tinggi: 520,
    svgContent: `
      <rect width="480" height="520" fill="#ffffff" stroke="#000000" stroke-width="2" />
      <text x="240" y="45" font-family="'Courier New', monospace" font-size="20" font-weight="bold" text-anchor="middle">KARCIS RETRIBUSI PARKIR</text>
      <text x="240" y="70" font-family="'Courier New', monospace" font-size="13" text-anchor="middle">DERMAGA TENGKAYU I TARAKAN</text>
      <line x1="20" y1="90" x2="460" y2="90" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="125" font-family="'Courier New', monospace" font-size="13">NO TIKET : PRK-20261031-88</text>
      <text x="20" y="155" font-family="'Courier New', monospace" font-size="13">TGL MASUK: 30-10-2026 09:00</text>
      <text x="20" y="185" font-family="'Courier New', monospace" font-size="13">TGL KELUAR: 31-10-2026 17:00</text>
      <text x="20" y="215" font-family="'Courier New', monospace" font-size="13">JENIS: RODA 4 (MOBIL INAP)</text>
      
      <line x1="20" y1="240" x2="460" y2="240" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="20" y="280" font-family="'Courier New', monospace" font-size="16" font-weight="bold">TOTAL TARIF PARKIR</text>
      <text x="460" y="280" font-family="'Courier New', monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 50.000</text>
      <line x1="20" y1="305" x2="460" y2="305" stroke="#000" stroke-width="2" />
      
      <text x="20" y="345" font-family="'Courier New', monospace" font-size="13">STATUS : LUNAS (TUNAI)</text>
      <text x="240" y="460" font-family="'Courier New', monospace" font-size="11" text-anchor="middle">Simpan karcis ini sebagai bukti keluar sah kendaraan.</text>
    `,
  }
);

// ==========================================
// KELOMPOK 8: Transfer Bank & Mobile Banking (71-80)
// ==========================================
data100Struk.push(
  {
    nomor: 71,
    berkas: "71_transfer_m_bca_bifast.png",
    judul: "m-Transfer BCA BI-FAST",
    tag: "Transfer Bank",
    nominalTeks: "Rp 750.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "m-Transfer BCA",
      judulStatus: "TRANSFER BERHASIL",
      tanggalWaktu: "26/10/2026 11:20:15 WIB",
      nomorRef: "2026102600881239",
      pengirim: "1234567890 - YULIUS ZALUKHU",
      penerima: "JOKO SUSANTO",
      bankPenerima: "BANK MANDIRI - 9876543210",
      nominalTransfer: "Rp 750.000",
      adminFee: "Rp 2.500",
      totalDebet: "Rp 752.500",
      catatan: "Pembelian ATK & Konsumsi Tim Lapangan",
    }),
  },
  {
    nomor: 72,
    berkas: "72_transfer_bri_brimo_honor.png",
    judul: "BRImo Honorarium Narasumber",
    tag: "Transfer Bank",
    nominalTeks: "Rp 1.200.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "BRImo BRI",
      judulStatus: "TRANSAKSI BERHASIL",
      tanggalWaktu: "27 Okt 2026 16:45 WIB",
      nomorRef: "882010481928",
      pengirim: "YULIUS ZALUKHU",
      penerima: "SITI RAHMAWATI",
      bankPenerima: "BANK BRI - 0456-01-112233-53-8",
      nominalTransfer: "Rp 1.200.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 1.200.000",
      catatan: "Pembayaran Honorarium Narasumber Pelatihan",
      bgColor: "#002f6c",
    }),
  },
  {
    nomor: 73,
    berkas: "73_transfer_mandiri_livin.png",
    judul: "Livin by Mandiri Resi Transfer",
    tag: "Transfer Bank",
    nominalTeks: "Rp 502.500",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "Livin' by Mandiri",
      judulStatus: "TRANSFER BERHASIL",
      tanggalWaktu: "27 Okt 2026, 08:30 WIB",
      nomorRef: "2026102719284710",
      pengirim: "YULIUS ZALUKHU",
      penerima: "HERMANTO",
      bankPenerima: "BANK BNI - 1122334455",
      nominalTransfer: "Rp 500.000",
      adminFee: "Rp 2.500",
      totalDebet: "Rp 502.500",
      catatan: "Belanja Peralatan Posko",
      bgColor: "#0f2042",
    }),
  },
  {
    nomor: 74,
    berkas: "74_transfer_bni_mobile_perdiem.png",
    judul: "BNI Mobile Uang Saku Perdiem",
    tag: "Transfer Bank",
    nominalTeks: "Rp 800.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "BNI Mobile Banking",
      judulStatus: "TRANSFER BERHASIL",
      tanggalWaktu: "28 Okt 2026 10:15 WIB",
      nomorRef: "BNI-20261028-9901",
      pengirim: "TIM BANTUAN OPERASIONAL",
      penerima: "YOHANES MANIK",
      bankPenerima: "BANK BNI - 0987654321",
      nominalTransfer: "Rp 800.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 800.000",
      catatan: "Uang Harian Perdiem Fasilitasi Lapangan",
      bgColor: "#005e54",
    }),
  },
  {
    nomor: 75,
    berkas: "75_transfer_bsi_mobile.png",
    judul: "BSI Mobile Transfer Ustadz",
    tag: "Transfer Bank",
    nominalTeks: "Rp 500.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "BSI Mobile",
      judulStatus: "TRANSAKSI BERHASIL",
      tanggalWaktu: "28 Okt 2026 14:00 WIB",
      nomorRef: "BSI-8821901-44",
      pengirim: "PANITIA PEMBUKAAN ACARA",
      penerima: "USTADZ RIDWAN",
      bankPenerima: "BSI - 7122334455",
      nominalTransfer: "Rp 500.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 500.000",
      catatan: "Honorarium Pembaca Doa Kegiatan",
      bgColor: "#00a39d",
    }),
  },
  {
    nomor: 76,
    berkas: "76_transfer_cimb_octo.png",
    judul: "CIMB Octo Pembayaran Faktur",
    tag: "Transfer Bank",
    nominalTeks: "Rp 1.850.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "OCTO Mobile CIMB",
      judulStatus: "TRANSFER SUKSES",
      tanggalWaktu: "29 Okt 2026 09:20 WIB",
      nomorRef: "OCTO-9912048-22",
      pengirim: "DIVISI PENGADAAN SPJ",
      penerima: "CV. MAJU LANCAR ABADI",
      bankPenerima: "CIMB NIAGA - 8001294819",
      nominalTransfer: "Rp 1.850.000",
      adminFee: "Rp 2.500",
      totalDebet: "Rp 1.852.500",
      catatan: "Pelunasan Pengadaan Barang Workshop",
      bgColor: "#780016",
    }),
  },
  {
    nomor: 77,
    berkas: "77_transfer_seabank.png",
    judul: "SeaBank Sewa Sound System",
    tag: "Transfer Bank",
    nominalTeks: "Rp 650.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "SeaBank Indonesia",
      judulStatus: "TRANSFER BERHASIL",
      tanggalWaktu: "29 Okt 2026 11:45 WIB",
      nomorRef: "SEA-20261029-7712",
      pengirim: "YULIUS ZALUKHU",
      penerima: "AGUS PRATAMA",
      bankPenerima: "SEABANK - 90123456789",
      nominalTransfer: "Rp 650.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 650.000",
      catatan: "Sewa Sound System & Mic Wireless 1 Hari",
      bgColor: "#ea580c",
    }),
  },
  {
    nomor: 78,
    berkas: "78_transfer_bank_jago.png",
    judul: "Bank Jago Snack Peserta",
    tag: "Transfer Bank",
    nominalTeks: "Rp 420.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "Bank Jago",
      judulStatus: "KIRIM UANG BERHASIL",
      tanggalWaktu: "30 Okt 2026 08:15 WIB",
      nomorRef: "JAGO-881290-01",
      pengirim: "KANTONG OPERASIONAL",
      penerima: "KATERING IBU RAHAYU",
      bankPenerima: "BANK BCA - 5544332211",
      nominalTransfer: "Rp 420.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 420.000",
      catatan: "Pesanan Konsumsi Snack Kotak 35 Pcs",
      bgColor: "#7c3aed",
    }),
  },
  {
    nomor: 79,
    berkas: "79_transfer_flip_koperasi.png",
    judul: "Flip Bebas Admin Koperasi",
    tag: "Transfer Bank",
    nominalTeks: "Rp 900.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "Flip ID",
      judulStatus: "TRANSAKSI SELESAI",
      tanggalWaktu: "30 Okt 2026 14:30 WIB",
      nomorRef: "FLIP-991204-55",
      pengirim: "YULIUS ZALUKHU",
      penerima: "KOPERASI TANI MAKMUR",
      bankPenerima: "BANK BRI - 0123456789012",
      nominalTransfer: "Rp 900.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 900.000",
      catatan: "Pembelian Bibit Tanaman Obat Desa",
      bgColor: "#ea580c",
    }),
  },
  {
    nomor: 80,
    berkas: "80_transfer_jenius_zoom.png",
    judul: "Jenius Langganan Zoom Meeting",
    tag: "Transfer Bank",
    nominalTeks: "Rp 249.000",
    lebar: 450,
    tinggi: 640,
    svgContent: resiMobileBank({
      namaApp: "Jenius BTPN",
      judulStatus: "TRANSAKSI BERHASIL",
      tanggalWaktu: "31 Okt 2026 09:00 WIB",
      nomorRef: "JEN-8810294-01",
      pengirim: "E-CARD KEUANGAN",
      penerima: "ZOOM VIDEO COMM",
      bankPenerima: "KARTU DEBIT VISA INTERNASIONAL",
      nominalTransfer: "Rp 249.000",
      adminFee: "Rp 0",
      totalDebet: "Rp 249.000",
      catatan: "Langganan Zoom Pro 1 Bulan Tim Koordinasi",
      bgColor: "#0284c7",
    }),
  }
);

// ==========================================
// KELOMPOK 9: E-Wallet & Paket Data Pulsa (81-90)
// ==========================================
data100Struk.push(
  {
    nomor: 81,
    berkas: "81_gofood_ayam_geprek.png",
    judul: "GoFood Ayam Geprek Juara",
    tag: "E-Wallet GoPay",
    nominalTeks: "Rp 75.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "AYAM GEPREK JUARA TANJUNG SELOR (GoFood)",
      alamat: "PESANAN ONLINE GOFOOD ID: F-18204719283",
      tanggal: "28 Okt 2026 12:35",
      nomorBukti: "GF-88192-019",
      items: [
        { nama: "3x Paket Geprek Blenger Pedas", harga: "75.000" },
        { nama: "Ongkos Kirim Delivery", harga: "12.000" },
        { nama: "Diskon Promo GoFood", harga: "-12.000" },
      ],
      totalLabel: "TOTAL PEMBAYARAN",
      totalNilai: "Rp 75.000",
      metode: "GOPAY",
    }),
  },
  {
    nomor: 82,
    berkas: "82_grabfood_kfc_paket.png",
    judul: "GrabFood KFC Paket Ayam",
    tag: "E-Wallet OVO",
    nominalTeks: "Rp 92.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "KFC MARTADINATA (GrabFood)",
      alamat: "ORDER ID: GRB-991204-11",
      tanggal: "28 Okt 2026 18:20",
      nomorBukti: "GRB-88219-01",
      items: [
        { nama: "Super Besar 2 Combo", harga: "58.000" },
        { nama: "Crispy Strips & Float", harga: "34.000" },
      ],
      totalLabel: "TOTAL DIBAYAR",
      totalNilai: "Rp 92.000",
      metode: "OVO",
    }),
  },
  {
    nomor: 83,
    berkas: "83_shopeefood_bakso_solo.png",
    judul: "ShopeeFood Bakso Solo Samrat",
    tag: "E-Wallet ShopeePay",
    nominalTeks: "Rp 68.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "BAKSO SOLO SAMRAT (ShopeeFood)",
      alamat: "ORDER NO: SPF-8812904-99",
      tanggal: "29 Okt 2026 13:15",
      nomorBukti: "SPF-1029-44",
      items: [
        { nama: "2x Bakso Urat Jumbo Lengkap", harga: "56.000" },
        { nama: "2x Es Teh Manis Jumbo", harga: "12.000" },
      ],
      totalLabel: "TOTAL BAYAR",
      totalNilai: "Rp 68.000",
      metode: "SHOPEEPAY",
    }),
  },
  {
    nomor: 84,
    berkas: "84_dana_kopi_oey.png",
    judul: "DANA Warung Kopi Oey",
    tag: "E-Wallet DANA",
    nominalTeks: "Rp 48.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "WARUNG KOPI OEY",
      alamat: "PEMBAYARAN DANA QRIS MERCHANT",
      tanggal: "28-10-2026 10:45",
      nomorBukti: "DANA-TRX-20261028-01",
      items: [
        { nama: "Kopi Susu Indochina", harga: "26.000" },
        { nama: "Singkong Sambal Roa", harga: "22.000" },
      ],
      totalLabel: "TOTAL DIBAYAR",
      totalNilai: "Rp 48.000",
      metode: "SALDO DANA",
    }),
  },
  {
    nomor: 85,
    berkas: "85_linkaja_nasgor.png",
    judul: "LinkAja Nasi Goreng Babat",
    tag: "E-Wallet LinkAja",
    nominalTeks: "Rp 55.000",
    lebar: 480,
    tinggi: 580,
    svgContent: thermalReceipt({
      toko: "NASI GORENG BABAT SEMARANG",
      alamat: "PEMBAYARAN QRIS LINKAJA",
      tanggal: "29-10-2026 20:00",
      nomorBukti: "LNK-88219-01",
      items: [
        { nama: "Nasi Goreng Babat Spesial", harga: "35.000" },
        { nama: "Babat Goreng Gongso", harga: "20.000" },
      ],
      totalLabel: "TOTAL HARGA",
      totalNilai: "Rp 55.000",
      metode: "LINKAJA",
    }),
  },
  {
    nomor: 86,
    berkas: "86_myim3_internet_100gb.png",
    judul: "myIM3 Indosat Internet 100GB",
    tag: "Pulsa & Internet",
    nominalTeks: "Rp 125.000",
    lebar: 450,
    tinggi: 620,
    svgContent: `
      <rect width="450" height="620" fill="#ffffff" />
      <text x="225" y="45" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="middle">Detail Transaksi</text>
      <text x="225" y="70" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">PACKAGE PURCHASE</text>
      <text x="225" y="95" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">Internet 100GB</text>
      <text x="225" y="118" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">27 Okt 2026 - 09:25 AM</text>
      <text x="225" y="150" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a" text-anchor="middle">Rp125.000</text>
      
      <rect x="175" y="165" width="100" height="26" fill="#dcfce7" rx="13" />
      <text x="225" y="182" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#15803d" text-anchor="middle">BERHASIL</text>
      
      <line x1="25" y1="210" x2="425" y2="210" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="240" font-family="Arial, sans-serif" font-size="12" fill="#64748b">ID Transaksi</text>
      <text x="415" y="240" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">SUP9157951793067922704301</text>
      
      <text x="35" y="275" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Nomor IM3</text>
      <text x="415" y="275" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">085813999447</text>
      
      <text x="35" y="310" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Metode Pembayaran</text>
      <text x="415" y="310" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">QRIS</text>
      
      <text x="35" y="345" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Nama Paket</text>
      <text x="415" y="345" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">Internet 100GB</text>
      
      <line x1="25" y1="375" x2="425" y2="375" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="415" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">Total</text>
      <text x="415" y="415" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="end">Rp125.000</text>
    `,
  },
  {
    nomor: 87,
    berkas: "87_mytelkomsel_orbit_150gb.png",
    judul: "MyTelkomsel Orbit Max 150GB",
    tag: "Pulsa & Internet",
    nominalTeks: "Rp 250.000",
    lebar: 450,
    tinggi: 620,
    svgContent: `
      <rect width="450" height="620" fill="#ffffff" />
      <text x="225" y="45" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ed1c24" text-anchor="middle">MyTelkomsel</text>
      <text x="225" y="70" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">PEMBELIAN PAKET DATA INTERNET</text>
      <text x="225" y="95" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">Orbit Max 150GB 30 Hari</text>
      <text x="225" y="118" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">28 Okt 2026 - 15:40 WIB</text>
      <text x="225" y="150" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a" text-anchor="middle">Rp 250.000</text>
      
      <line x1="25" y1="180" x2="425" y2="180" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="210" font-family="Arial, sans-serif" font-size="12" fill="#64748b">No. Telepon / Kartu</text>
      <text x="415" y="210" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">081299887766</text>
      
      <text x="35" y="245" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Metode Pembayaran</text>
      <text x="415" y="245" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">TRANSFER BANK MANDIRI</text>
      
      <text x="35" y="280" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Status Transaksi</text>
      <text x="415" y="280" font-family="Arial, sans-serif" font-size="12" fill="#16a34a" font-weight="bold" text-anchor="end">BERHASIL</text>
      
      <line x1="25" y1="310" x2="425" y2="310" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="345" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">TOTAL TAGIHAN</text>
      <text x="415" y="345" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="end">Rp 250.000</text>
    `,
  },
  {
    nomor: 88,
    berkas: "88_myxl_combo_flex_90gb.png",
    judul: "myXL Xtra Combo Flex 90GB",
    tag: "Pulsa & Internet",
    nominalTeks: "Rp 140.000",
    lebar: 450,
    tinggi: 600,
    svgContent: `
      <rect width="450" height="600" fill="#ffffff" />
      <text x="225" y="45" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#002f6c" text-anchor="middle">myXL Axiata</text>
      <text x="225" y="70" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">TRANSAKSI PAKET INTERNET</text>
      <text x="225" y="95" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">Xtra Combo Flex XXL 90GB</text>
      <text x="225" y="118" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">29 Okt 2026 - 11:15</text>
      
      <line x1="25" y1="140" x2="425" y2="140" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="170" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Nomor XL</text>
      <text x="415" y="170" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">087812345678</text>
      
      <text x="35" y="205" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Metode Pembayaran</text>
      <text x="415" y="205" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">DANA</text>
      
      <line x1="25" y1="230" x2="425" y2="230" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="265" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">TOTAL BAYAR</text>
      <text x="415" y="265" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#059669" text-anchor="end">Rp 140.000</text>
    `,
  },
  {
    nomor: 89,
    berkas: "89_smartfren_unlimited.png",
    judul: "Smartfren Unlimited Modem",
    tag: "Pulsa & Internet",
    nominalTeks: "Rp 100.000",
    lebar: 450,
    tinggi: 600,
    svgContent: `
      <rect width="450" height="600" fill="#ffffff" />
      <text x="225" y="45" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ec4899" text-anchor="middle">smartfren.</text>
      <text x="225" y="70" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">BUKTI PENGISIAN PAKET DATA</text>
      <text x="225" y="95" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">Unlimited Nonstop 60GB</text>
      <text x="225" y="118" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">29 Okt 2026 - 16:30</text>
      
      <line x1="25" y1="140" x2="425" y2="140" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="170" font-family="Arial, sans-serif" font-size="12" fill="#64748b">No. Smartfren</text>
      <text x="415" y="170" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">088812349988</text>
      
      <text x="35" y="205" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Metode</text>
      <text x="415" y="205" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">OVO</text>
      
      <line x1="25" y1="230" x2="425" y2="230" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="265" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">TOTAL TRANSAKSI</text>
      <text x="415" y="265" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#059669" text-anchor="end">Rp 100.000</text>
    `,
  },
  {
    nomor: 90,
    berkas: "90_byu_kuota_50gb.png",
    judul: "by.U Kuota 50GB Bulanan",
    tag: "Pulsa & Internet",
    nominalTeks: "Rp 95.000",
    lebar: 450,
    tinggi: 600,
    svgContent: `
      <rect width="450" height="600" fill="#ffffff" />
      <text x="225" y="45" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0284c7" text-anchor="middle">by.U</text>
      <text x="225" y="70" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">TRANSAKSI PEMBELIAN KUOTA</text>
      <text x="225" y="95" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">Kuota Yang Bikin Kumat 50GB</text>
      <text x="225" y="118" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">30 Okt 2026 - 10:00</text>
      
      <line x1="25" y1="140" x2="425" y2="140" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="170" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Nomor by.U</text>
      <text x="415" y="170" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">085155667788</text>
      
      <text x="35" y="205" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Metode Pembayaran</text>
      <text x="415" y="205" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="bold" text-anchor="end">GOPAY</text>
      
      <line x1="25" y1="230" x2="425" y2="230" stroke="#e2e8f0" stroke-width="1" />
      <text x="35" y="265" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">TOTAL TAGIHAN</text>
      <text x="415" y="265" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#059669" text-anchor="end">Rp 95.000</text>
    `,
  }
);

// ==========================================
// KELOMPOK 10: Utilitas, Pengadaan & Honorarium (91-100)
// ==========================================
data100Struk.push(
  {
    nomor: 91,
    berkas: "91_token_listrik_pln.png",
    judul: "Struk Token Listrik PLN Prepaid",
    tag: "Token Listrik",
    nominalTeks: "Rp 103.000",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#ffffff" />
      <text x="240" y="45" font-family="'Courier New', monospace" font-size="18" font-weight="bold" text-anchor="middle">STRUK PEMBELIAN LISTRIK PRABAYAR</text>
      <text x="240" y="70" font-family="'Courier New', monospace" font-size="14" font-weight="bold" fill="#0284c7" text-anchor="middle">PLN PREPAID</text>
      <line x1="20" y1="85" x2="460" y2="85" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="'Courier New', monospace" font-size="12">TANGGAL : 29/10/2026 09:12</text>
      <text x="20" y="140" font-family="'Courier New', monospace" font-size="12">NO METER : 14235678901</text>
      <text x="20" y="165" font-family="'Courier New', monospace" font-size="12">IDPEL    : 541209876543</text>
      <text x="20" y="190" font-family="'Courier New', monospace" font-size="12">NAMA     : AHMAD FAUZI</text>
      <text x="20" y="215" font-family="'Courier New', monospace" font-size="12">TARIF/DAYA : R1 / 1300 VA</text>
      
      <line x1="20" y1="230" x2="460" y2="230" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="20" y="255" font-family="'Courier New', monospace" font-size="13">RP BAYAR    : Rp 100.000</text>
      <text x="20" y="280" font-family="'Courier New', monospace" font-size="13">ADMIN BANK  : Rp 3.000</text>
      <text x="20" y="315" font-family="'Courier New', monospace" font-size="16" font-weight="bold">TOTAL BAYAR : Rp 103.000</text>
      <line x1="20" y1="330" x2="460" y2="330" stroke="#000" stroke-width="2" />
      
      <text x="20" y="365" font-family="'Courier New', monospace" font-size="13" font-weight="bold">STROOM / TOKEN :</text>
      <text x="240" y="405" font-family="'Courier New', monospace" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">4829-1048-2849-1029-4710</text>
      <text x="240" y="435" font-family="'Courier New', monospace" font-size="13" text-anchor="middle">JML KWH : 66.8 kWh</text>
      
      <text x="240" y="520" font-family="'Courier New', monospace" font-size="11" text-anchor="middle">INFORMASI HUBUNGI CONTACT CENTER PLN: 123</text>
    `,
  },
  {
    nomor: 92,
    berkas: "92_pln_pascabayar.png",
    judul: "Tagihan Listrik PLN Pascabayar",
    tag: "Token Listrik",
    nominalTeks: "Rp 385.000",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#ffffff" />
      <text x="240" y="45" font-family="'Courier New', monospace" font-size="18" font-weight="bold" text-anchor="middle">BUKTI PEMBAYARAN TAGIHAN LISTRIK</text>
      <text x="240" y="70" font-family="'Courier New', monospace" font-size="14" font-weight="bold" fill="#0284c7" text-anchor="middle">PLN POSTPAID</text>
      <line x1="20" y1="85" x2="460" y2="85" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="'Courier New', monospace" font-size="12">IDPEL : 541122334455</text>
      <text x="20" y="140" font-family="'Courier New', monospace" font-size="12">NAMA  : SEKRETARIAT TIM KEGIATAN</text>
      <text x="20" y="165" font-family="'Courier New', monospace" font-size="12">TARIF : B1 / 2200 VA</text>
      <text x="20" y="190" font-family="'Courier New', monospace" font-size="12">PERIODE : OKTOBER 2026</text>
      
      <line x1="20" y1="210" x2="460" y2="210" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="20" y="240" font-family="'Courier New', monospace" font-size="13">TAGIHAN LISTRIK : Rp 382.000</text>
      <text x="20" y="265" font-family="'Courier New', monospace" font-size="13">BIAYA ADMIN BANK: Rp 3.000</text>
      <line x1="20" y1="285" x2="460" y2="285" stroke="#000" stroke-width="2" />
      
      <text x="20" y="325" font-family="'Courier New', monospace" font-size="16" font-weight="bold">TOTAL TAGIHAN : Rp 385.000</text>
      <text x="20" y="355" font-family="'Courier New', monospace" font-size="13">STATUS : LUNAS DIBAYAR</text>
      <text x="240" y="520" font-family="'Courier New', monospace" font-size="11" text-anchor="middle">PLN MENYATAKAN STRUK INI ADALAH BUKTI PEMBAYARAN SAH</text>
    `,
  },
  {
    nomor: 93,
    berkas: "93_tagihan_air_pdam.png",
    judul: "Tagihan Air PDAM Tirta Bulungan",
    tag: "Tagihan Air",
    nominalTeks: "Rp 155.000",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#ffffff" />
      <text x="240" y="45" font-family="'Courier New', monospace" font-size="18" font-weight="bold" text-anchor="middle">PERUMDA AIR MINUM TIRTA BULUNGAN</text>
      <text x="240" y="70" font-family="'Courier New', monospace" font-size="13" text-anchor="middle">BUKTI PEMBAYARAN TAGIHAN AIR</text>
      <line x1="20" y1="85" x2="460" y2="85" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="'Courier New', monospace" font-size="12">NO SAMBUNGAN : 01020304</text>
      <text x="20" y="140" font-family="'Courier New', monospace" font-size="12">NAMA : SEKRETARIAT TIM KEGIATAN</text>
      <text x="20" y="165" font-family="'Courier New', monospace" font-size="12">PERIODE : OKTOBER 2026</text>
      <text x="20" y="190" font-family="'Courier New', monospace" font-size="12">PEMAKAIAN : 28 M3</text>
      
      <line x1="20" y1="210" x2="460" y2="210" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="20" y="240" font-family="'Courier New', monospace" font-size="13">TAGIHAN AIR  : Rp 140.000</text>
      <text x="20" y="265" font-family="'Courier New', monospace" font-size="13">PEMELIHARAAN : Rp 10.000</text>
      <text x="20" y="290" font-family="'Courier New', monospace" font-size="13">RETRIBUSI    : Rp 5.000</text>
      <line x1="20" y1="310" x2="460" y2="310" stroke="#000" stroke-width="2" />
      
      <text x="20" y="345" font-family="'Courier New', monospace" font-size="16" font-weight="bold">TOTAL TAGIHAN Rp 155.000</text>
      <text x="20" y="375" font-family="'Courier New', monospace" font-size="12">TGL BAYAR : 29-10-2026 STATUS : LUNAS</text>
      <text x="240" y="520" font-family="'Courier New', monospace" font-size="11" text-anchor="middle">HEMAT AIR UNTUK KELANGSUNGAN BERSAMA</text>
    `,
  },
  {
    nomor: 94,
    berkas: "94_indihome_internet_telkom.png",
    judul: "Tagihan Internet Telkom IndiHome",
    tag: "Pulsa & Internet",
    nominalTeks: "Rp 399.000",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#ffffff" />
      <text x="240" y="45" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ed1c24" text-anchor="middle">IndiHome by Telkomsel</text>
      <text x="240" y="70" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">BUKTI PEMBAYARAN TAGIHAN INTERNET</text>
      <line x1="20" y1="85" x2="460" y2="85" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="Arial, sans-serif" font-size="12">NO INTERNET : 122334455667</text>
      <text x="20" y="140" font-family="Arial, sans-serif" font-size="12">NAMA        : POSKO KEGIATAN KALTARA</text>
      <text x="20" y="165" font-family="Arial, sans-serif" font-size="12">PAKET       : 2P INTERNET + PHONE 50 MBPS</text>
      <text x="20" y="190" font-family="Arial, sans-serif" font-size="12">PERIODE     : OKTOBER 2026</text>
      
      <line x1="20" y1="210" x2="460" y2="210" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="20" y="240" font-family="Arial, sans-serif" font-size="13">BIAYA BERLANGGANAN : Rp 360.000</text>
      <text x="20" y="265" font-family="Arial, sans-serif" font-size="13">PPN 11%            : Rp 39.000</text>
      <line x1="20" y1="285" x2="460" y2="285" stroke="#000" stroke-width="2" />
      
      <text x="20" y="325" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TOTAL PEMBAYARAN : Rp 399.000</text>
      <text x="20" y="355" font-family="Arial, sans-serif" font-size="12" fill="#16a34a" font-weight="bold">STATUS : LUNAS (TRANSFER VA BCA)</text>
      <text x="240" y="520" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Terima kasih atas kepercayaan Anda menggunakan IndiHome</text>
    `,
  },
  {
    nomor: 95,
    berkas: "95_toko_atk_sinar_terang.png",
    judul: "Nota Toko ATK & Percetakan",
    tag: "Pengadaan ATK",
    nominalTeks: "Rp 630.000",
    lebar: 480,
    tinggi: 640,
    svgContent: thermalReceipt({
      toko: "CV. SINAR TERANG ATK & PERCETAKAN",
      alamat: "JL. KATAMSO NO. 22 TANJUNG SELOR",
      tanggal: "30 Oktober 2026",
      nomorBukti: "089/ST/X/2026",
      items: [
        { nama: "Kertas HVS F4 75gr (5 Rim)", harga: "275.000" },
        { nama: "Spidol Whiteboard Snowman (1 Lusin)", harga: "95.000" },
        { nama: "Jilid Spiral Laporan SPJ (10 Buku)", harga: "150.000" },
        { nama: "Materai 10000 (10 Lembar)", harga: "110.000" },
      ],
      totalLabel: "TOTAL HARGA",
      totalNilai: "Rp 630.000",
      metode: "TUNAI LUNAS",
    }),
  },
  {
    nomor: 96,
    berkas: "96_toko_bangunan_usaha_mandiri.png",
    judul: "Nota TB Usaha Mandiri Jaya",
    tag: "Bahan Bangunan",
    nominalTeks: "Rp 745.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "TB. USAHA MANDIRI JAYA",
      alamat: "PENYEDIA BAHAN BANGUNAN & ALAT",
      tanggal: "30/10/2026",
      nomorBukti: "FB-99120",
      items: [
        { nama: "4 LBR TRIPLEK 9MM", harga: "380.000" },
        { nama: "1 PAIL CAT TEMBOK DULUX 5KG", harga: "175.000" },
        { nama: "2 KG PAKU CAMPUR", harga: "40.000" },
        { nama: "2 ZAK SEMEN TONASA 50KG", harga: "150.000" },
      ],
      totalLabel: "JUMLAH TOTAL",
      totalNilai: "Rp 745.000",
      metode: "TUNAI",
    }),
  },
  {
    nomor: 97,
    berkas: "97_apotek_kimia_farma.png",
    judul: "Nota Apotek Kimia Farma P3K",
    tag: "Pengadaan Obat",
    nominalTeks: "Rp 185.000",
    lebar: 480,
    tinggi: 620,
    svgContent: thermalReceipt({
      toko: "KIMIA FARMA",
      perusahaan: "PT KIMIA FARMA APOTEK",
      alamat: "JL. JEND. SUDIRMAN NO. 15",
      tanggal: "31-10-2026 14:20",
      nomorBukti: "KF-TS-01924",
      items: [
        { nama: "Kotak P3K Lengkap Dinding", harga: "95.000" },
        { nama: "Betadine Antiseptic 60ml", harga: "35.000" },
        { nama: "Kassa Steril & Plester Roll", harga: "25.000" },
        { nama: "Paracetamol 500mg (3 Strip)", harga: "30.000" },
      ],
      totalLabel: "TOTAL BELANJA",
      totalNilai: "Rp 185.000",
      metode: "QRIS BCA",
    }),
  },
  {
    nomor: 98,
    berkas: "98_kuitansi_honor_narasumber.png",
    judul: "Kwitansi Honorarium Narasumber Ahli",
    tag: "Honorarium",
    nominalTeks: "Rp 2.500.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "015/HON-NR/X/2026",
      telahDiterima: "Panitia Pelatihan Mitigasi Bencana",
      uangSejumlah: "Dua Juta Lima Ratus Ribu Rupiah",
      untukPembayaran: "Honorarium Narasumber Ahli Kebencanaan (2 Sesi Materi)",
      terbilangNominal: "Rp 2.500.000,-",
      kotaTgl: "Tanjung Selor, 30 Oktober 2026",
      penerima: "DR. ARIS MUNANDAR, M.SI",
    }),
  },
  {
    nomor: 99,
    berkas: "99_kuitansi_perdiem_fasilitator.png",
    judul: "Kwitansi Uang Harian Perdiem Lapangan",
    tag: "Honorarium",
    nominalTeks: "Rp 1.050.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "088/PRD-FAS/X/2026",
      telahDiterima: "Bendahara Proyek Fasilitasi",
      uangSejumlah: "Satu Juta Lima Puluh Ribu Rupiah",
      untukPembayaran: "Uang Harian / Perdiem Fasilitator Lapangan 3 Hari (@ Rp 350.000)",
      terbilangNominal: "Rp 1.050.000,-",
      kotaTgl: "Malinau, 31 Oktober 2026",
      penerima: "BUDI SANTOSO (FASILITATOR)",
    }),
  },
  {
    nomor: 100,
    berkas: "100_kuitansi_jasa_kebersihan.png",
    judul: "Kwitansi Jasa Tenaga Kebersihan",
    tag: "Honorarium",
    nominalTeks: "Rp 600.000",
    lebar: 700,
    tinggi: 420,
    svgContent: kwitansiFormal({
      nomor: "041/KW-JS/X/2026",
      telahDiterima: "Sekretariat Panitia Acara",
      uangSejumlah: "Enam Ratus Ribu Rupiah",
      untukPembayaran: "Upah Jasa Tenaga Kebersihan dan Pengawas Gedung (3 Hari Kegiatan)",
      terbilangNominal: "Rp 600.000,-",
      kotaTgl: "Tanjung Selor, 31 Oktober 2026",
      penerima: "IBU HALIMAH",
    }),
  }
);

// Fungsi utama generate 100 PNG
async function buat100Dummy() {
  const outputDir = path.resolve(process.cwd(), "public/latihan-ocr");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Memulai pembuatan ${data100Struk.length} berkas struk dummy Indonesia...`);

  const daftarJson = [];

  for (const s of data100Struk) {
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
      console.log(`[${s.nomor}/100] Selesai: ${s.berkas} (${s.nominalTeks})`);
    } catch (err) {
      console.error(`Gagal membuat ${s.berkas}:`, err);
    }
  }

  // Simpan daftar_latihan.json
  const jsonPath = path.join(outputDir, "daftar_latihan.json");
  fs.writeFileSync(jsonPath, JSON.stringify(daftarJson, null, 2), "utf8");
  console.log(`✓ Selesai membuat 100 struk dummy! Metadata disimpan di ${jsonPath}`);
}

buat100Dummy().catch(console.error);
