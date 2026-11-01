import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";

interface DefinisiStrukDummy {
  berkas: string;
  judul: string;
  lebar: number;
  tinggi: number;
  svgContent: string;
}

const daftarStruk: DefinisiStrukDummy[] = [
  // 1. Alfamart Minimarket
  {
    berkas: "01_alfamart_harian.png",
    judul: "Alfamart Belanja Harian",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#ffffff" />
      <text x="240" y="45" font-family="Courier New, monospace" font-size="20" font-weight="bold" text-anchor="middle">ALFAMART SENGKAWIT</text>
      <text x="240" y="70" font-family="Courier New, monospace" font-size="13" text-anchor="middle">PT SUMBER ALFARIA TRIJAYA TBK</text>
      <text x="240" y="90" font-family="Courier New, monospace" font-size="12" text-anchor="middle">JL. SENGKAWIT NO. 14 BULUNGAN</text>
      <line x1="20" y1="105" x2="460" y2="105" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="125" font-family="Courier New, monospace" font-size="12">BON : 1802-991-1810</text>
      <text x="320" y="125" font-family="Courier New, monospace" font-size="12">KASIR : RINA</text>
      <text x="20" y="145" font-family="Courier New, monospace" font-size="12">TGL : 18-10-2026 10:15</text>
      <line x1="20" y1="155" x2="460" y2="155" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="180" font-family="Courier New, monospace" font-size="13">MINYAK GORENG 2L</text>
      <text x="360" y="180" font-family="Courier New, monospace" font-size="13" text-anchor="end">34.000</text>
      
      <text x="20" y="210" font-family="Courier New, monospace" font-size="13">TELUR AYAM 1KG</text>
      <text x="360" y="210" font-family="Courier New, monospace" font-size="13" text-anchor="end">28.500</text>
      
      <text x="20" y="240" font-family="Courier New, monospace" font-size="13">ROTI TAWAR SARI ROTI</text>
      <text x="360" y="240" font-family="Courier New, monospace" font-size="13" text-anchor="end">16.000</text>
      
      <line x1="20" y1="265" x2="460" y2="265" stroke="#000" stroke-dasharray="2,2" stroke-width="1" />
      <text x="20" y="290" font-family="Courier New, monospace" font-size="13">SUBTOTAL</text>
      <text x="360" y="290" font-family="Courier New, monospace" font-size="13" text-anchor="end">78.500</text>
      
      <text x="20" y="315" font-family="Courier New, monospace" font-size="13">DISKON MEMBER</text>
      <text x="360" y="315" font-family="Courier New, monospace" font-size="13" text-anchor="end">-4.500</text>
      
      <text x="20" y="340" font-family="Courier New, monospace" font-size="13">PPN 11%</text>
      <text x="360" y="340" font-family="Courier New, monospace" font-size="13" text-anchor="end">8.140</text>
      
      <line x1="20" y1="360" x2="460" y2="360" stroke="#000" stroke-width="2" />
      <text x="20" y="390" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL BELANJA</text>
      <text x="460" y="390" font-family="Courier New, monospace" font-size="16" font-weight="bold" text-anchor="end">Rp 82.140</text>
      <line x1="20" y1="405" x2="460" y2="405" stroke="#000" stroke-width="2" />
      
      <text x="20" y="435" font-family="Courier New, monospace" font-size="13">TUNAI</text>
      <text x="460" y="435" font-family="Courier New, monospace" font-size="13" text-anchor="end">100.000</text>
      
      <text x="20" y="460" font-family="Courier New, monospace" font-size="13">KEMBALIAN</text>
      <text x="460" y="460" font-family="Courier New, monospace" font-size="13" text-anchor="end">17.860</text>
      
      <text x="240" y="520" font-family="Courier New, monospace" font-size="12" text-anchor="middle">LAYANAN KONSUMEN SMS 08111099999</text>
      <text x="240" y="545" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">TERIMA KASIH ATAS KUNJUNGAN ANDA</text>
    `
  },

  // 2. Indomaret
  {
    berkas: "02_indomaret_snack.png",
    judul: "Indomaret Snack & Minuman",
    lebar: 480,
    tinggi: 580,
    svgContent: `
      <rect width="480" height="580" fill="#ffffff" />
      <text x="240" y="45" font-family="Courier New, monospace" font-size="22" font-weight="bold" text-anchor="middle">INDOMARET</text>
      <text x="240" y="70" font-family="Courier New, monospace" font-size="13" text-anchor="middle">PT INDOMARCO PRISMATAMA</text>
      <text x="240" y="90" font-family="Courier New, monospace" font-size="12" text-anchor="middle">JL. KOLONEL SOETADJI NO. 88</text>
      <line x1="20" y1="105" x2="460" y2="105" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="130" font-family="Courier New, monospace" font-size="12">19.10.2026 - 14:30</text>
      <text x="320" y="130" font-family="Courier New, monospace" font-size="12">KASIR : ANDI</text>
      <line x1="20" y1="145" x2="460" y2="145" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="175" font-family="Courier New, monospace" font-size="13">KOPI BOTOL NESCAFE 220ML</text>
      <text x="460" y="175" font-family="Courier New, monospace" font-size="13" text-anchor="end">11.500</text>
      
      <text x="20" y="205" font-family="Courier New, monospace" font-size="13">AQUA AIR MINERAL 1500ML (2)</text>
      <text x="460" y="205" font-family="Courier New, monospace" font-size="13" text-anchor="end">14.000</text>
      
      <text x="20" y="235" font-family="Courier New, monospace" font-size="13">BISKUIT OREO 120GR (2)</text>
      <text x="460" y="235" font-family="Courier New, monospace" font-size="13" text-anchor="end">19.000</text>
      
      <text x="20" y="265" font-family="Courier New, monospace" font-size="13">TISU PASEO 250 SHEETS</text>
      <text x="460" y="265" font-family="Courier New, monospace" font-size="13" text-anchor="end">20.000</text>
      
      <line x1="20" y1="290" x2="460" y2="290" stroke="#000" stroke-width="1.5" />
      <text x="20" y="320" font-family="Courier New, monospace" font-size="14">TOTAL ITEM : 4</text>
      <text x="20" y="355" font-family="Courier New, monospace" font-size="17" font-weight="bold">TOTAL BELANJA</text>
      <text x="460" y="355" font-family="Courier New, monospace" font-size="17" font-weight="bold" text-anchor="end">Rp 64.500</text>
      <line x1="20" y1="375" x2="460" y2="375" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="405" font-family="Courier New, monospace" font-size="13">METODE BAYAR : QRIS GOPAY</text>
      <text x="20" y="430" font-family="Courier New, monospace" font-size="13">NMID : ID1020088192831</text>
      <text x="20" y="455" font-family="Courier New, monospace" font-size="13">STATUS : BERHASIL</text>
      
      <text x="240" y="515" font-family="Courier New, monospace" font-size="12" text-anchor="middle">KRITIK &amp; SARAN: 1500280</text>
      <text x="240" y="535" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">TERIMA KASIH - BELANJA PUAS</text>
    `
  },

  // 3. SPBU Pertamina Pertamax
  {
    berkas: "03_spbu_pertamax.png",
    judul: "SPBU Pertamina Pertamax",
    lebar: 480,
    tinggi: 560,
    svgContent: `
      <rect width="480" height="560" fill="#ffffff" />
      <text x="240" y="40" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="middle">SPBU PERTAMINA 64.77102</text>
      <text x="240" y="65" font-family="Courier New, monospace" font-size="13" text-anchor="middle">JL. RAYA TANJUNG SELOR KM. 4</text>
      <text x="240" y="85" font-family="Courier New, monospace" font-size="14" font-weight="bold" text-anchor="middle">PASTI PAS!</text>
      <line x1="20" y1="100" x2="460" y2="100" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="125" font-family="Courier New, monospace" font-size="13">TGL : 20/10/2026</text>
      <text x="300" y="125" font-family="Courier New, monospace" font-size="13">JAM: 08:45</text>
      <text x="20" y="150" font-family="Courier New, monospace" font-size="13">POMPA : 02</text>
      <text x="300" y="150" font-family="Courier New, monospace" font-size="13">NO POL: KU 1234 AB</text>
      <line x1="20" y1="165" x2="460" y2="165" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="200" font-family="Courier New, monospace" font-size="14" font-weight="bold">PRODUK : PERTAMAX</text>
      
      <text x="20" y="235" font-family="Courier New, monospace" font-size="13">HARGA / LITER :</text>
      <text x="460" y="235" font-family="Courier New, monospace" font-size="13" text-anchor="end">Rp 12.950</text>
      
      <text x="20" y="265" font-family="Courier New, monospace" font-size="13">VOLUME (LITER) :</text>
      <text x="460" y="265" font-family="Courier New, monospace" font-size="13" text-anchor="end">25.00 L</text>
      
      <line x1="20" y1="290" x2="460" y2="290" stroke="#000" stroke-width="2" />
      <text x="20" y="325" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL PEMBAYARAN</text>
      <text x="460" y="325" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 323.750</text>
      <line x1="20" y1="345" x2="460" y2="345" stroke="#000" stroke-width="2" />
      
      <text x="20" y="380" font-family="Courier New, monospace" font-size="13">METODE: DEBIT MANDIRI</text>
      <text x="20" y="405" font-family="Courier New, monospace" font-size="13">NO APPROVAL: 849201</text>
      
      <text x="240" y="475" font-family="Courier New, monospace" font-size="12" text-anchor="middle">PERTAMINA CONTACT CENTER: 135</text>
      <text x="240" y="495" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">TERIMA KASIH DAN SELAMAT JALAN</text>
    `
  },

  // 4. SPBU Dexlite
  {
    berkas: "04_spbu_dexlite.png",
    judul: "SPBU Pertamina Dexlite",
    lebar: 480,
    tinggi: 540,
    svgContent: `
      <rect width="480" height="540" fill="#ffffff" />
      <text x="240" y="40" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="middle">SPBU PERTAMINA 64.77201</text>
      <text x="240" y="65" font-family="Courier New, monospace" font-size="13" text-anchor="middle">KABUPATEN NUNUKAN</text>
      <line x1="20" y1="90" x2="460" y2="90" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="Courier New, monospace" font-size="13">TANGGAL : 22/10/2026</text>
      <text x="300" y="115" font-family="Courier New, monospace" font-size="13">WAKTU : 11:10</text>
      <line x1="20" y1="130" x2="460" y2="130" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="165" font-family="Courier New, monospace" font-size="14" font-weight="bold">PRODUK : DEXLITE</text>
      
      <text x="20" y="200" font-family="Courier New, monospace" font-size="13">HARGA / LITER :</text>
      <text x="460" y="200" font-family="Courier New, monospace" font-size="13" text-anchor="end">Rp 14.200</text>
      
      <text x="20" y="230" font-family="Courier New, monospace" font-size="13">JUMLAH LITER :</text>
      <text x="460" y="230" font-family="Courier New, monospace" font-size="13" text-anchor="end">30.00 LTR</text>
      
      <line x1="20" y1="260" x2="460" y2="260" stroke="#000" stroke-width="2" />
      <text x="20" y="295" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL RP</text>
      <text x="460" y="295" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 426.000</text>
      <line x1="20" y1="315" x2="460" y2="315" stroke="#000" stroke-width="2" />
      
      <text x="20" y="350" font-family="Courier New, monospace" font-size="13">BAYAR (TUNAI) : Rp 450.000</text>
      <text x="20" y="375" font-family="Courier New, monospace" font-size="13">KEMBALI : Rp 24.000</text>
      
      <text x="240" y="450" font-family="Courier New, monospace" font-size="12" text-anchor="middle">PASTI PAS - BAHAN BAKAR BERKUALITAS</text>
      <text x="240" y="475" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">TERIMA KASIH</text>
    `
  },

  // 5. Kopi Kenangan
  {
    berkas: "05_kopi_kenangan.png",
    judul: "Kopi Kenangan Tarakan",
    lebar: 480,
    tinggi: 560,
    svgContent: `
      <rect width="480" height="560" fill="#ffffff" />
      <text x="240" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">KOPI KENANGAN</text>
      <text x="240" y="70" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">OUTLET TARAKAN GRAND MALL</text>
      <line x1="20" y1="90" x2="460" y2="90" stroke="#666" stroke-dasharray="3,3" stroke-width="1" />
      
      <text x="20" y="115" font-family="Arial, sans-serif" font-size="12">ORDER: ORD-9921471</text>
      <text x="320" y="115" font-family="Arial, sans-serif" font-size="12">21 Okt 2026 15:20</text>
      <line x1="20" y1="130" x2="460" y2="130" stroke="#666" stroke-dasharray="3,3" stroke-width="1" />
      
      <text x="20" y="160" font-family="Arial, sans-serif" font-size="13" font-weight="bold">2x Kopi Kenangan Mantan (L)</text>
      <text x="460" y="160" font-family="Arial, sans-serif" font-size="13" text-anchor="end">42.000</text>
      <text x="30" y="180" font-family="Arial, sans-serif" font-size="11" fill="#555">- Less Sugar, Normal Ice</text>
      
      <text x="20" y="210" font-family="Arial, sans-serif" font-size="13" font-weight="bold">2x Roti Coklat Klasik</text>
      <text x="460" y="210" font-family="Arial, sans-serif" font-size="13" text-anchor="end">16.000</text>
      
      <line x1="20" y1="240" x2="460" y2="240" stroke="#ccc" stroke-width="1" />
      <text x="20" y="265" font-family="Arial, sans-serif" font-size="13">Subtotal</text>
      <text x="460" y="265" font-family="Arial, sans-serif" font-size="13" text-anchor="end">58.000</text>
      
      <text x="20" y="290" font-family="Arial, sans-serif" font-size="13">PB1 (Pajak 10%)</text>
      <text x="460" y="290" font-family="Arial, sans-serif" font-size="13" text-anchor="end">5.800</text>
      
      <line x1="20" y1="315" x2="460" y2="315" stroke="#000" stroke-width="1.5" />
      <text x="20" y="345" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TOTAL BAYAR</text>
      <text x="460" y="345" font-family="Arial, sans-serif" font-size="17" font-weight="bold" text-anchor="end">Rp 63.800</text>
      <line x1="20" y1="365" x2="460" y2="365" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="400" font-family="Arial, sans-serif" font-size="13">Metode Pembayaran: QRIS ShopeePay</text>
      <text x="20" y="425" font-family="Arial, sans-serif" font-size="13">Status: Pembayaran Berhasil</text>
      
      <text x="240" y="490" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Follow IG: @kopikenangan.id</text>
      <text x="240" y="515" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Terima Kasih Banyak!</text>
    `
  },

  // 6. Mie Gacoan
  {
    berkas: "06_mie_gacoan.png",
    judul: "Mie Gacoan Bulungan",
    lebar: 480,
    tinggi: 580,
    svgContent: `
      <rect width="480" height="580" fill="#ffffff" />
      <text x="240" y="45" font-family="Courier New, monospace" font-size="20" font-weight="bold" text-anchor="middle">MIE GACOAN</text>
      <text x="240" y="70" font-family="Courier New, monospace" font-size="13" text-anchor="middle">CABANG BULUNGAN - SENGKAWIT</text>
      <line x1="20" y1="90" x2="460" y2="90" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="Courier New, monospace" font-size="13">TABLE: 15 (DINE IN)</text>
      <text x="280" y="115" font-family="Courier New, monospace" font-size="13">23/10/2026 19:40</text>
      <line x1="20" y1="130" x2="460" y2="130" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="160" font-family="Courier New, monospace" font-size="13">MIE IBLIS LEVEL 2 (3)</text>
      <text x="460" y="160" font-family="Courier New, monospace" font-size="13" text-anchor="end">36.000</text>
      
      <text x="20" y="190" font-family="Courier New, monospace" font-size="13">DIMSUM UDANG KEJU (2)</text>
      <text x="460" y="190" font-family="Courier New, monospace" font-size="13" text-anchor="end">23.000</text>
      
      <text x="20" y="220" font-family="Courier New, monospace" font-size="13">ES GOBAK SODOR (3)</text>
      <text x="460" y="220" font-family="Courier New, monospace" font-size="13" text-anchor="end">28.000</text>
      
      <line x1="20" y1="250" x2="460" y2="250" stroke="#000" stroke-dasharray="2,2" stroke-width="1" />
      <text x="20" y="280" font-family="Courier New, monospace" font-size="13">SUBTOTAL</text>
      <text x="460" y="280" font-family="Courier New, monospace" font-size="13" text-anchor="end">87.000</text>
      
      <text x="20" y="310" font-family="Courier New, monospace" font-size="13">PAJAK RESTO PB1 10%</text>
      <text x="460" y="310" font-family="Courier New, monospace" font-size="13" text-anchor="end">8.700</text>
      
      <line x1="20" y1="335" x2="460" y2="335" stroke="#000" stroke-width="2" />
      <text x="20" y="370" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL PEMBAYARAN</text>
      <text x="460" y="370" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 95.700</text>
      <line x1="20" y1="390" x2="460" y2="390" stroke="#000" stroke-width="2" />
      
      <text x="20" y="425" font-family="Courier New, monospace" font-size="13">METODE: QRIS BCA</text>
      <text x="20" y="450" font-family="Courier New, monospace" font-size="13">REFF: 99182746102</text>
      
      <text x="240" y="520" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">MATUR NUWUN - PEDASNYA JUARA</text>
    `
  },

  // 7. RM Padang Sederhana
  {
    berkas: "07_rm_padang_sauyo.png",
    judul: "RM Padang Sederhana",
    lebar: 480,
    tinggi: 560,
    svgContent: `
      <rect width="480" height="560" fill="#ffffff" />
      <text x="240" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">RM PADANG SEDERHANA RAYA</text>
      <text x="240" y="70" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">MASAKAN MINANG ASLI</text>
      <text x="240" y="90" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">JL. JENDERAL SUDIRMAN NO. 10</text>
      <line x1="20" y1="105" x2="460" y2="105" stroke="#000" stroke-width="1.5" />
      
      <text x="20" y="130" font-family="Arial, sans-serif" font-size="13">Tanggal: 24-10-2026</text>
      <text x="320" y="130" font-family="Arial, sans-serif" font-size="13">Meja: 08</text>
      <line x1="20" y1="145" x2="460" y2="145" stroke="#000" stroke-dasharray="3,3" stroke-width="1" />
      
      <text x="20" y="175" font-family="Arial, sans-serif" font-size="13">5x Nasi Rendang Daging</text>
      <text x="460" y="175" font-family="Arial, sans-serif" font-size="13" text-anchor="end">130.000</text>
      
      <text x="20" y="205" font-family="Arial, sans-serif" font-size="13">3x Nasi Ayam Pop</text>
      <text x="460" y="205" font-family="Arial, sans-serif" font-size="13" text-anchor="end">69.000</text>
      
      <text x="20" y="235" font-family="Arial, sans-serif" font-size="13">2x Sayur Nangka + Sambal Ijo</text>
      <text x="460" y="235" font-family="Arial, sans-serif" font-size="13" text-anchor="end">14.000</text>
      
      <text x="20" y="265" font-family="Arial, sans-serif" font-size="13">8x Es Jeruk Manis</text>
      <text x="460" y="265" font-family="Arial, sans-serif" font-size="13" text-anchor="end">32.000</text>
      
      <line x1="20" y1="295" x2="460" y2="295" stroke="#000" stroke-width="2" />
      <text x="20" y="330" font-family="Arial, sans-serif" font-size="16" font-weight="bold">JUMLAH TOTAL</text>
      <text x="460" y="330" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="end">Rp 245.000</text>
      <line x1="20" y1="350" x2="460" y2="350" stroke="#000" stroke-width="2" />
      
      <text x="20" y="385" font-family="Arial, sans-serif" font-size="13">PEMBAYARAN: TUNAI</text>
      
      <!-- Stempel LUNAS Ungu Tradisional -->
      <g transform="translate(280, 390) rotate(-10)">
        <rect width="140" height="45" rx="6" fill="none" stroke="#6b21a8" stroke-width="3" stroke-dasharray="8,2" />
        <text x="70" y="30" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#6b21a8" text-anchor="middle">LUNAS</text>
      </g>
      
      <text x="240" y="500" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">TERIMA KASIH - SALAM ONDEH MANDEH</text>
    `
  },

  // 8. Solaria Restoran
  {
    berkas: "08_solaria_restoran.png",
    judul: "Solaria Restoran",
    lebar: 480,
    tinggi: 600,
    svgContent: `
      <rect width="480" height="600" fill="#ffffff" />
      <text x="240" y="45" font-family="Courier New, monospace" font-size="22" font-weight="bold" text-anchor="middle">SOLARIA</text>
      <text x="240" y="70" font-family="Courier New, monospace" font-size="13" text-anchor="middle">BANDARA JUWATA TARAKAN</text>
      <line x1="20" y1="95" x2="460" y2="95" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="125" font-family="Courier New, monospace" font-size="12">CHECK: 009214</text>
      <text x="280" y="125" font-family="Courier New, monospace" font-size="12">25/10/2026 13:10</text>
      <line x1="20" y1="145" x2="460" y2="145" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="180" font-family="Courier New, monospace" font-size="13">NASI GORENG SPESIAL</text>
      <text x="460" y="180" font-family="Courier New, monospace" font-size="13" text-anchor="end">45.000</text>
      
      <text x="20" y="210" font-family="Courier New, monospace" font-size="13">CHICKEN CORDON BLEU</text>
      <text x="460" y="210" font-family="Courier New, monospace" font-size="13" text-anchor="end">52.000</text>
      
      <text x="20" y="240" font-family="Courier New, monospace" font-size="13">ICE LEMON TEA (1)</text>
      <text x="460" y="240" font-family="Courier New, monospace" font-size="13" text-anchor="end">15.000</text>
      
      <line x1="20" y1="270" x2="460" y2="270" stroke="#000" stroke-dasharray="2,2" stroke-width="1" />
      <text x="20" y="300" font-family="Courier New, monospace" font-size="13">SUBTOTAL</text>
      <text x="460" y="300" font-family="Courier New, monospace" font-size="13" text-anchor="end">112.000</text>
      
      <text x="20" y="325" font-family="Courier New, monospace" font-size="13">SERVICE CHARGE (5%)</text>
      <text x="460" y="325" font-family="Courier New, monospace" font-size="13" text-anchor="end">5.600</text>
      
      <text x="20" y="350" font-family="Courier New, monospace" font-size="13">PB1 (10%)</text>
      <text x="460" y="350" font-family="Courier New, monospace" font-size="13" text-anchor="end">11.760</text>
      
      <line x1="20" y1="375" x2="460" y2="375" stroke="#000" stroke-width="2" />
      <text x="20" y="410" font-family="Courier New, monospace" font-size="16" font-weight="bold">GRAND TOTAL</text>
      <text x="460" y="410" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 129.360</text>
      <line x1="20" y1="430" x2="460" y2="430" stroke="#000" stroke-width="2" />
      
      <text x="20" y="465" font-family="Courier New, monospace" font-size="13">CARD: KARTU KREDIT BCA</text>
      <text x="20" y="490" font-family="Courier New, monospace" font-size="13">APPROVAL: 712034</text>
      
      <text x="240" y="555" font-family="Courier New, monospace" font-size="13" font-weight="bold" text-anchor="middle">THANK YOU FOR COMING</text>
    `
  },

  // 9. Kwitansi Rental Mobil Hilux
  {
    berkas: "09_kwitansi_sewa_mobil.png",
    judul: "Kwitansi Rental Mobil Lapangan",
    lebar: 560,
    tinggi: 480,
    svgContent: `
      <rect width="560" height="480" fill="#fefefe" stroke="#000" stroke-width="2" />
      <rect x="10" y="10" width="540" height="460" fill="none" stroke="#2563eb" stroke-width="1.5" />
      
      <text x="280" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#1e3a8a" text-anchor="middle">KUITANSI PEMBAYARAN</text>
      <text x="280" y="75" font-family="Arial, sans-serif" font-size="13" fill="#333" text-anchor="middle">NO: 042/KW-BRC/X/2026</text>
      <line x1="30" y1="90" x2="530" y2="90" stroke="#1e3a8a" stroke-width="2" />
      
      <text x="40" y="130" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Telah Diterima Dari</text>
      <text x="200" y="130" font-family="Arial, sans-serif" font-size="14">: Tim Fasilitasi Kegiatan Lapangan</text>
      
      <text x="40" y="165" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Uang Sejumlah</text>
      <text x="200" y="165" font-family="Arial, sans-serif" font-size="14" font-style="italic">: Empat Juta Lima Ratus Ribu Rupiah</text>
      
      <text x="40" y="200" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Untuk Pembayaran</text>
      <text x="200" y="200" font-family="Arial, sans-serif" font-size="14">: Sewa Mobil Toyota Hilux 4x4 + Driver (3 Hari)</text>
      
      <!-- Kotak Terbilang Nominal -->
      <rect x="40" y="240" width="220" height="50" fill="#e0e7ff" stroke="#3b82f6" stroke-width="2" rx="4" />
      <text x="150" y="272" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e3a8a" text-anchor="middle">Rp 4.500.000,-</text>
      
      <text x="360" y="270" font-family="Arial, sans-serif" font-size="13">Tarakan, 25 Oktober 2026</text>
      <text x="360" y="295" font-family="Arial, sans-serif" font-size="13">Yang Menerima,</text>
      <text x="360" y="380" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-decoration="underline">CV. BORNEO RENT CAR</text>
    `
  },

  // 10. Kwitansi Hotel
  {
    berkas: "10_kwitansi_akomodasi_hotel.png",
    judul: "Kwitansi Hotel Tarakan Plaza",
    lebar: 560,
    tinggi: 480,
    svgContent: `
      <rect width="560" height="480" fill="#ffffff" stroke="#000" stroke-width="1.5" />
      <text x="280" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">HOTEL TARAKAN PLAZA</text>
      <text x="280" y="68" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">JL. YOS SUDARSO NO. 1 TARAKAN</text>
      <line x1="30" y1="85" x2="530" y2="85" stroke="#000" stroke-width="1.5" />
      
      <text x="40" y="120" font-family="Arial, sans-serif" font-size="13" font-weight="bold">BUKTI KUITANSI PEMBAYARAN HOTEL</text>
      <text x="360" y="120" font-family="Arial, sans-serif" font-size="13">No: INV-HTP-2026-881</text>
      
      <text x="40" y="160" font-family="Arial, sans-serif" font-size="13">Diterima dari : Bapak Ahmad (Fasilitator Lapangan)</text>
      <text x="40" y="190" font-family="Arial, sans-serif" font-size="13">Keperluan : Menginap Deluxe Room 2 Malam</text>
      <text x="40" y="215" font-family="Arial, sans-serif" font-size="12" fill="#555">(Check-in: 24/10/2026, Check-out: 26/10/2026)</text>
      
      <rect x="40" y="250" width="240" height="50" fill="#f3f4f6" stroke="#4b5563" stroke-width="1.5" />
      <text x="160" y="282" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">Rp 950.000,-</text>
      
      <text x="360" y="270" font-family="Arial, sans-serif" font-size="13">Tarakan, 26-10-2026</text>
      <text x="360" y="360" font-family="Arial, sans-serif" font-size="14" font-weight="bold">KASIR HOTEL TARAKAN PLAZA</text>
      
      <g transform="translate(180, 330) rotate(-8)">
        <rect width="130" height="40" rx="4" fill="none" stroke="#dc2626" stroke-width="2.5" />
        <text x="65" y="27" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#dc2626" text-anchor="middle">LUNAS</text>
      </g>
    `
  },

  // 11. M-BCA Transfer
  {
    berkas: "11_transfer_m_bca.png",
    judul: "m-Transfer BCA BI-FAST",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#003399" />
      <rect x="15" y="15" width="450" height="590" rx="10" fill="#ffffff" />
      
      <text x="240" y="55" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#003399" text-anchor="middle">m-Transfer</text>
      <text x="240" y="80" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#16a34a" text-anchor="middle">BERHASIL</text>
      <text x="240" y="105" font-family="Arial, sans-serif" font-size="12" fill="#666" text-anchor="middle">26/10/2026 11:20:15 WIB</text>
      <line x1="30" y1="120" x2="450" y2="120" stroke="#e5e7eb" stroke-width="1.5" />
      
      <text x="40" y="150" font-family="Arial, sans-serif" font-size="12" fill="#666">NO. REFERENSI</text>
      <text x="40" y="170" font-family="Arial, sans-serif" font-size="14" font-weight="bold">2026102600881239</text>
      
      <text x="40" y="205" font-family="Arial, sans-serif" font-size="12" fill="#666">DARI REKENING</text>
      <text x="40" y="225" font-family="Arial, sans-serif" font-size="14" font-weight="bold">1234567890 - YULIUS ZALUKHU</text>
      
      <text x="40" y="260" font-family="Arial, sans-serif" font-size="12" fill="#666">REKENING TUJUAN</text>
      <text x="40" y="280" font-family="Arial, sans-serif" font-size="14" font-weight="bold">9876543210 (MANDIRI)</text>
      <text x="40" y="300" font-family="Arial, sans-serif" font-size="14" font-weight="bold">JOKO SUSANTO</text>
      
      <text x="40" y="335" font-family="Arial, sans-serif" font-size="12" fill="#666">JENIS TRANSFER</text>
      <text x="40" y="355" font-family="Arial, sans-serif" font-size="14" font-weight="bold">BI-FAST</text>
      
      <line x1="30" y1="375" x2="450" y2="375" stroke="#e5e7eb" stroke-width="1.5" />
      
      <text x="40" y="405" font-family="Arial, sans-serif" font-size="13">JUMLAH TRANSFER</text>
      <text x="440" y="405" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="end">Rp 750.000</text>
      
      <text x="40" y="435" font-family="Arial, sans-serif" font-size="13">BIAYA ADMIN</text>
      <text x="440" y="435" font-family="Arial, sans-serif" font-size="13" text-anchor="end">Rp 2.500</text>
      
      <line x1="30" y1="455" x2="450" y2="455" stroke="#003399" stroke-width="1.5" />
      <text x="40" y="485" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#003399">TOTAL DEBET</text>
      <text x="440" y="485" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#003399" text-anchor="end">Rp 752.500</text>
      <line x1="30" y1="505" x2="450" y2="505" stroke="#003399" stroke-width="1.5" />
      
      <text x="240" y="560" font-family="Arial, sans-serif" font-size="11" fill="#888" text-anchor="middle">Simpan bukti transaksi ini sebagai bukti pembayaran sah.</text>
    `
  },

  // 12. BRImo Transfer
  {
    berkas: "12_transfer_bri_brimo.png",
    judul: "BRImo Transfer Sesama BRI",
    lebar: 480,
    tinggi: 600,
    svgContent: `
      <rect width="480" height="600" fill="#0284c7" />
      <rect x="15" y="15" width="450" height="570" rx="12" fill="#ffffff" />
      
      <text x="240" y="55" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0284c7" text-anchor="middle">BRImo</text>
      <text x="240" y="80" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#15803d" text-anchor="middle">Transaksi Berhasil</text>
      <text x="240" y="105" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">27 Okt 2026 16:45 WIB</text>
      <line x1="30" y1="120" x2="450" y2="120" stroke="#f1f5f9" stroke-width="2" />
      
      <text x="40" y="150" font-family="Arial, sans-serif" font-size="12" fill="#64748b">PENERIMA</text>
      <text x="40" y="172" font-family="Arial, sans-serif" font-size="15" font-weight="bold">SITI RAHMAWATI</text>
      <text x="40" y="192" font-family="Arial, sans-serif" font-size="13" fill="#334155">BRI 0456-01-112233-53-8</text>
      
      <text x="40" y="230" font-family="Arial, sans-serif" font-size="12" fill="#64748b">NOMINAL TRANSFER</text>
      <text x="40" y="260" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">Rp 1.200.000</text>
      
      <text x="40" y="295" font-family="Arial, sans-serif" font-size="12" fill="#64748b">BIAYA ADMIN : Rp 0</text>
      <text x="40" y="325" font-family="Arial, sans-serif" font-size="14" font-weight="bold">TOTAL TRANSAKSI : Rp 1.200.000</text>
      
      <line x1="30" y1="350" x2="450" y2="350" stroke="#f1f5f9" stroke-width="2" />
      <text x="40" y="380" font-family="Arial, sans-serif" font-size="12" fill="#64748b">NO. REFERENSI : 882910481928</text>
      <text x="40" y="405" font-family="Arial, sans-serif" font-size="12" fill="#64748b">CATATAN : Pembayaran Honorarium Narasumber</text>
      <text x="40" y="430" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Sisa Saldo Rekening : Rp 8.450.000</text>
      
      <text x="240" y="530" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">PT Bank Rakyat Indonesia (Persero) Tbk.</text>
    `
  },

  // 13. Mandiri Livin
  {
    berkas: "13_transfer_mandiri_livin.png",
    judul: "Livin by Mandiri Resi Transfer",
    lebar: 480,
    tinggi: 580,
    svgContent: `
      <rect width="480" height="580" fill="#1e40af" />
      <rect x="15" y="15" width="450" height="550" rx="12" fill="#ffffff" />
      
      <text x="240" y="55" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e40af" text-anchor="middle">Livin' by Mandiri</text>
      <text x="240" y="80" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#15803d" text-anchor="middle">TRANSFER BERHASIL</text>
      <text x="240" y="105" font-family="Arial, sans-serif" font-size="12" fill="#6b7280" text-anchor="middle">27 Okt 2026, 08:30 WIB</text>
      <line x1="30" y1="120" x2="450" y2="120" stroke="#f3f4f6" stroke-width="2" />
      
      <text x="40" y="150" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">NAMA PENERIMA</text>
      <text x="40" y="175" font-family="Arial, sans-serif" font-size="16" font-weight="bold">HERMANTO</text>
      <text x="40" y="195" font-family="Arial, sans-serif" font-size="13">Bank BNI - 1122334455</text>
      
      <text x="40" y="240" font-family="Arial, sans-serif" font-size="13">JUMLAH TRANSFER</text>
      <text x="440" y="240" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="end">Rp 500.000</text>
      
      <text x="40" y="270" font-family="Arial, sans-serif" font-size="13">BIAYA TRANSAKSI</text>
      <text x="440" y="270" font-family="Arial, sans-serif" font-size="13" text-anchor="end">Rp 2.500</text>
      
      <line x1="30" y1="295" x2="450" y2="295" stroke="#1e40af" stroke-width="1.5" />
      <text x="40" y="330" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#1e40af">TOTAL PEMBAYARAN</text>
      <text x="440" y="330" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e40af" text-anchor="end">Rp 502.500</text>
      <line x1="30" y1="350" x2="450" y2="350" stroke="#1e40af" stroke-width="1.5" />
      
      <text x="40" y="390" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">NOMOR REFERENSI : 2026102719284710</text>
      <text x="40" y="415" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">METODE : BI-FAST</text>
      
      <text x="240" y="500" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">Resi resmi transaksi elektronik Bank Mandiri.</text>
    `
  },

  // 14. GoPay GoFood
  {
    berkas: "14_ewallet_gopay_gofood.png",
    judul: "GoFood Ayam Geprek Juara",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#00880f" />
      <rect x="15" y="15" width="450" height="590" rx="12" fill="#ffffff" />
      
      <text x="40" y="50" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#00880f">GoFood</text>
      <text x="40" y="75" font-family="Arial, sans-serif" font-size="17" font-weight="bold">AYAM GEPREK JUARA TANJUNG SELOR</text>
      <text x="40" y="95" font-family="Arial, sans-serif" font-size="12" fill="#666">28 Okt 2026 12:35 • ID: F-18294719283</text>
      <line x1="30" y1="110" x2="450" y2="110" stroke="#e5e7eb" stroke-width="1.5" />
      
      <text x="40" y="140" font-family="Arial, sans-serif" font-size="13">3x Paket Geprek Blenger Pedas</text>
      <text x="440" y="140" font-family="Arial, sans-serif" font-size="13" text-anchor="end">75.000</text>
      
      <text x="40" y="170" font-family="Arial, sans-serif" font-size="13">Ongkos Kirim</text>
      <text x="440" y="170" font-family="Arial, sans-serif" font-size="13" text-anchor="end">12.000</text>
      
      <text x="40" y="200" font-family="Arial, sans-serif" font-size="13">Biaya Layanan &amp; Jasa Aplikasi</text>
      <text x="440" y="200" font-family="Arial, sans-serif" font-size="13" text-anchor="end">3.000</text>
      
      <text x="40" y="230" font-family="Arial, sans-serif" font-size="13" fill="#16a34a">Diskon Promo GoFood</text>
      <text x="440" y="230" font-family="Arial, sans-serif" font-size="13" fill="#16a34a" text-anchor="end">-15.000</text>
      
      <line x1="30" y1="255" x2="450" y2="255" stroke="#e5e7eb" stroke-width="1.5" />
      
      <text x="40" y="290" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TOTAL PEMBAYARAN</text>
      <text x="440" y="290" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="end">Rp 75.000</text>
      
      <text x="40" y="325" font-family="Arial, sans-serif" font-size="13">Metode Pembayaran: GoPay</text>
      <text x="40" y="350" font-family="Arial, sans-serif" font-size="13" fill="#16a34a">Status Transaksi: Selesai</text>
      
      <text x="240" y="520" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">Terima kasih telah memesan lewat GoFood!</text>
    `
  },

  // 15. DANA Dompet Digital
  {
    berkas: "15_ewallet_dana_merchant.png",
    judul: "DANA Pembayaran Warung Kopi Oey",
    lebar: 480,
    tinggi: 580,
    svgContent: `
      <rect width="480" height="580" fill="#118eea" />
      <rect x="15" y="15" width="450" height="550" rx="12" fill="#ffffff" />
      
      <text x="240" y="55" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#118eea" text-anchor="middle">DANA</text>
      <text x="240" y="80" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#16a34a" text-anchor="middle">Pembayaran Berhasil</text>
      <text x="240" y="105" font-family="Arial, sans-serif" font-size="12" fill="#666" text-anchor="middle">28-10-2026 19:15:30</text>
      <line x1="30" y1="120" x2="450" y2="120" stroke="#f3f4f6" stroke-width="2" />
      
      <text x="40" y="150" font-family="Arial, sans-serif" font-size="12" fill="#666">MERCHANT</text>
      <text x="40" y="175" font-family="Arial, sans-serif" font-size="16" font-weight="bold">WARUNG KOPI OEY</text>
      
      <text x="40" y="220" font-family="Arial, sans-serif" font-size="12" fill="#666">TOTAL DIBAYAR</text>
      <text x="40" y="255" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#118eea">Rp 48.000</text>
      
      <text x="40" y="295" font-family="Arial, sans-serif" font-size="13">Metode: Saldo DANA</text>
      <text x="40" y="320" font-family="Arial, sans-serif" font-size="13">No Akun: 085244556677</text>
      <text x="40" y="345" font-family="Arial, sans-serif" font-size="13">ID Transaksi: 2026102812003881023</text>
      
      <text x="240" y="490" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">DANA - Dompet Digital Indonesia Terdaftar BI</text>
    `
  },

  // 16. Token Listrik PLN
  {
    berkas: "16_token_listrik_pln.png",
    judul: "Struk Token Listrik PLN Prepaid",
    lebar: 480,
    tinggi: 620,
    svgContent: `
      <rect width="480" height="620" fill="#ffffff" />
      <text x="240" y="45" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="middle">STRUK PEMBELIAN LISTRIK PRABAYAR</text>
      <text x="240" y="68" font-family="Courier New, monospace" font-size="14" font-weight="bold" text-anchor="middle">PLN PREPAID</text>
      <line x1="20" y1="85" x2="460" y2="85" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="Courier New, monospace" font-size="13">TANGGAL  : 29/10/2026 09:12</text>
      <text x="20" y="140" font-family="Courier New, monospace" font-size="13">NO METER : 14235678901</text>
      <text x="20" y="165" font-family="Courier New, monospace" font-size="13">IDPEL    : 541209876543</text>
      <text x="20" y="190" font-family="Courier New, monospace" font-size="13">NAMA     : AHMAD FAUZI</text>
      <text x="20" y="215" font-family="Courier New, monospace" font-size="13">TARIF/DAYA : R1 / 1300 VA</text>
      
      <line x1="20" y1="235" x2="460" y2="235" stroke="#000" stroke-dasharray="2,2" stroke-width="1" />
      
      <text x="20" y="265" font-family="Courier New, monospace" font-size="13">RP BAYAR   : Rp 100.000</text>
      <text x="20" y="290" font-family="Courier New, monospace" font-size="13">ADMIN BANK : Rp 3.000</text>
      
      <line x1="20" y1="310" x2="460" y2="310" stroke="#000" stroke-width="2" />
      <text x="20" y="340" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL BAYAR : Rp 103.000</text>
      <line x1="20" y1="360" x2="460" y2="360" stroke="#000" stroke-width="2" />
      
      <text x="20" y="395" font-family="Courier New, monospace" font-size="13" font-weight="bold">STROOM / TOKEN :</text>
      <!-- 20 Digit token stroom yang BUKAN uang belanja -->
      <rect x="20" y="410" width="440" height="45" fill="#f3f4f6" stroke="#000" stroke-width="1.5" />
      <text x="240" y="440" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="middle">4829-1048-2849-1029-4710</text>
      
      <text x="20" y="485" font-family="Courier New, monospace" font-size="12">JML KWH : 66.8 kWh</text>
      <text x="240" y="550" font-family="Courier New, monospace" font-size="12" text-anchor="middle">INFORMASI HUBUNGI CONTACT CENTER PLN: 123</text>
    `
  },

  // 17. PDAM Tirta Bulungan
  {
    berkas: "17_tagihan_air_pdam.png",
    judul: "Tagihan Air PDAM Tirta Bulungan",
    lebar: 480,
    tinggi: 560,
    svgContent: `
      <rect width="480" height="560" fill="#ffffff" />
      <text x="240" y="40" font-family="Courier New, monospace" font-size="17" font-weight="bold" text-anchor="middle">PERUMDA AIR MINUM TIRTA BULUNGAN</text>
      <text x="240" y="65" font-family="Courier New, monospace" font-size="13" text-anchor="middle">BUKTI PEMBAYARAN TAGIHAN AIR</text>
      <line x1="20" y1="85" x2="460" y2="85" stroke="#000" stroke-dasharray="4,4" stroke-width="1.5" />
      
      <text x="20" y="115" font-family="Courier New, monospace" font-size="13">NO SAMBUNGAN : 01020304</text>
      <text x="20" y="140" font-family="Courier New, monospace" font-size="13">NAMA         : SEKRETARIAT TIM KEGIATAN</text>
      <text x="20" y="165" font-family="Courier New, monospace" font-size="13">PERIODE      : OKTOBER 2026</text>
      <text x="20" y="190" font-family="Courier New, monospace" font-size="13">PEMAKAIAN    : 28 M3</text>
      <line x1="20" y1="210" x2="460" y2="210" stroke="#000" stroke-dasharray="2,2" stroke-width="1" />
      
      <text x="20" y="240" font-family="Courier New, monospace" font-size="13">TAGIHAN AIR  : Rp 140.000</text>
      <text x="20" y="265" font-family="Courier New, monospace" font-size="13">PEMELIHARAAN : Rp 10.000</text>
      <text x="20" y="290" font-family="Courier New, monospace" font-size="13">RETRIBUSI    : Rp 5.000</text>
      
      <line x1="20" y1="315" x2="460" y2="315" stroke="#000" stroke-width="2" />
      <text x="20" y="350" font-family="Courier New, monospace" font-size="16" font-weight="bold">TOTAL TAGIHAN</text>
      <text x="460" y="350" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 155.000</text>
      <line x1="20" y1="370" x2="460" y2="370" stroke="#000" stroke-width="2" />
      
      <text x="20" y="405" font-family="Courier New, monospace" font-size="13">TGL BAYAR : 29-10-2026</text>
      <text x="20" y="430" font-family="Courier New, monospace" font-size="13">STATUS    : LUNAS</text>
      
      <text x="240" y="500" font-family="Courier New, monospace" font-size="12" text-anchor="middle">HEMAT AIR UNTUK KELANGSUNGAN BERSAMA</text>
    `
  },

  // 18. Toko ATK & Percetakan
  {
    berkas: "18_toko_atk_fotocopy.png",
    judul: "Nota Toko ATK & Percetakan",
    lebar: 520,
    tinggi: 580,
    svgContent: `
      <rect width="520" height="580" fill="#ffffff" stroke="#000" stroke-width="1.5" />
      <text x="260" y="45" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle">CV. SINAR TERANG ATK &amp; PERCETAKAN</text>
      <text x="260" y="68" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">JL. KATAMSO NO. 22 TANJUNG SELOR</text>
      <text x="260" y="88" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">TELP : 0852-1234-5678</text>
      <line x1="20" y1="100" x2="500" y2="100" stroke="#000" stroke-width="1.5" />
      
      <text x="30" y="125" font-family="Arial, sans-serif" font-size="13">NOTA NO : 089/ST/X/2026</text>
      <text x="320" y="125" font-family="Arial, sans-serif" font-size="13">TGL : 30 Oktober 2026</text>
      <line x1="20" y1="140" x2="500" y2="140" stroke="#000" stroke-dasharray="3,3" stroke-width="1" />
      
      <text x="30" y="170" font-family="Arial, sans-serif" font-size="13">Kertas HVS F4 75gr (5 Rim @ Rp 55.000)</text>
      <text x="490" y="170" font-family="Arial, sans-serif" font-size="13" text-anchor="end">275.000</text>
      
      <text x="30" y="205" font-family="Arial, sans-serif" font-size="13">Spidol Whiteboard Snowman (1 Lusin)</text>
      <text x="490" y="205" font-family="Arial, sans-serif" font-size="13" text-anchor="end">95.000</text>
      
      <text x="30" y="240" font-family="Arial, sans-serif" font-size="13">Jilid Spiral Laporan SPJ (10 Buku)</text>
      <text x="490" y="240" font-family="Arial, sans-serif" font-size="13" text-anchor="end">150.000</text>
      
      <text x="30" y="275" font-family="Arial, sans-serif" font-size="13">Materai 10000 (10 Lembar @ Rp 11.000)</text>
      <text x="490" y="275" font-family="Arial, sans-serif" font-size="13" text-anchor="end">110.000</text>
      
      <line x1="20" y1="305" x2="500" y2="305" stroke="#000" stroke-width="2" />
      <text x="30" y="340" font-family="Arial, sans-serif" font-size="16" font-weight="bold">TOTAL HARGA</text>
      <text x="490" y="340" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="end">Rp 630.000</text>
      <line x1="20" y1="360" x2="500" y2="360" stroke="#000" stroke-width="2" />
      
      <text x="30" y="395" font-family="Arial, sans-serif" font-size="13">PEMBAYARAN : TUNAI LUNAS</text>
      
      <text x="360" y="450" font-family="Arial, sans-serif" font-size="13">Hormat Kami,</text>
      <text x="360" y="520" font-family="Arial, sans-serif" font-size="14" font-weight="bold">( CV. SINAR TERANG )</text>
    `
  },

  // 19. Toko Bahan Bangunan
  {
    berkas: "19_toko_bangunan_hardware.png",
    judul: "Nota Toko Bangunan Usaha Mandiri",
    lebar: 520,
    tinggi: 560,
    svgContent: `
      <rect width="520" height="560" fill="#ffffff" stroke="#000" stroke-width="1.5" />
      <text x="260" y="45" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="middle">TB. USAHA MANDIRI JAYA</text>
      <text x="260" y="68" font-family="Courier New, monospace" font-size="13" text-anchor="middle">PENYEDIA BAHAN BANGUNAN &amp; ALAT</text>
      <line x1="20" y1="90" x2="500" y2="90" stroke="#000" stroke-width="1.5" />
      
      <text x="30" y="115" font-family="Courier New, monospace" font-size="13">FAKTUR : FB-99120</text>
      <text x="320" y="115" font-family="Courier New, monospace" font-size="13">TGL : 30/10/2026</text>
      <line x1="20" y1="130" x2="500" y2="130" stroke="#000" stroke-dasharray="4,4" stroke-width="1" />
      
      <text x="30" y="160" font-family="Courier New, monospace" font-size="13">4 LBR TRIPLEK 9MM</text>
      <text x="490" y="160" font-family="Courier New, monospace" font-size="13" text-anchor="end">380.000</text>
      
      <text x="30" y="190" font-family="Courier New, monospace" font-size="13">1 PAIL CAT TEMBOK DULUX 5KG</text>
      <text x="490" y="190" font-family="Courier New, monospace" font-size="13" text-anchor="end">175.000</text>
      
      <text x="30" y="220" font-family="Courier New, monospace" font-size="13">2 KG PAKU CAMPUR</text>
      <text x="490" y="220" font-family="Courier New, monospace" font-size="13" text-anchor="end">40.000</text>
      
      <text x="30" y="250" font-family="Courier New, monospace" font-size="13">2 ZAK SEMEN TONASA 50KG</text>
      <text x="490" y="250" font-family="Courier New, monospace" font-size="13" text-anchor="end">150.000</text>
      
      <line x1="20" y1="280" x2="500" y2="280" stroke="#000" stroke-width="2" />
      <text x="30" y="315" font-family="Courier New, monospace" font-size="16" font-weight="bold">JUMLAH TOTAL</text>
      <text x="490" y="315" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="end">Rp 745.000</text>
      <line x1="20" y1="335" x2="500" y2="335" stroke="#000" stroke-width="2" />
      
      <text x="30" y="375" font-family="Courier New, monospace" font-size="13">METODE : TUNAI</text>
      <text x="320" y="430" font-family="Courier New, monospace" font-size="13">PENERIMA,</text>
      <text x="320" y="490" font-family="Courier New, monospace" font-size="14" font-weight="bold">( TB. USAHA MANDIRI )</text>
    `
  },

  // 20. Tiket Bus / Travel Antar Kota
  {
    berkas: "20_tiket_bus_travel.png",
    judul: "Tiket Bus Travel Antar Kota",
    lebar: 520,
    tinggi: 520,
    svgContent: `
      <rect width="520" height="520" fill="#ffffff" stroke="#000" stroke-width="2" />
      <text x="260" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#047857" text-anchor="middle">PO. BORNEO TRANS EKSEKUTIF</text>
      <text x="260" y="70" font-family="Arial, sans-serif" font-size="13" text-anchor="middle">TIKET PENUMPANG ANGKUTAN DARAT</text>
      <line x1="20" y1="90" x2="500" y2="90" stroke="#047857" stroke-width="2" />
      
      <text x="30" y="125" font-family="Arial, sans-serif" font-size="13">NO TIKET  : BT-2026-X-0994</text>
      <text x="300" y="125" font-family="Arial, sans-serif" font-size="13">TGL : 31-10-2026 08:00</text>
      
      <text x="30" y="160" font-family="Arial, sans-serif" font-size="13">NAMA PENUMPANG : BAMBANG SUPRIYADI</text>
      <text x="30" y="195" font-family="Arial, sans-serif" font-size="14" font-weight="bold">RUTE : TANJUNG SELOR - BERAU</text>
      <text x="300" y="195" font-family="Arial, sans-serif" font-size="14" font-weight="bold">KURSI: 3B</text>
      
      <line x1="20" y1="225" x2="500" y2="225" stroke="#ccc" stroke-dasharray="4,4" stroke-width="1" />
      
      <text x="30" y="260" font-family="Arial, sans-serif" font-size="13">TARIF TIKET</text>
      <text x="490" y="260" font-family="Arial, sans-serif" font-size="13" text-anchor="end">Rp 180.000</text>
      
      <text x="30" y="290" font-family="Arial, sans-serif" font-size="11" fill="#666">Termasuk Asuransi Jasa Raharja</text>
      
      <line x1="20" y1="315" x2="500" y2="315" stroke="#047857" stroke-width="2" />
      <text x="30" y="350" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#047857">TOTAL BAYAR</text>
      <text x="490" y="350" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#047857" text-anchor="end">Rp 180.000</text>
      <line x1="20" y1="370" x2="500" y2="370" stroke="#047857" stroke-width="2" />
      
      <text x="30" y="415" font-family="Arial, sans-serif" font-size="12">STATUS : LUNAS (PEMBAYARAN LOKET)</text>
      <text x="260" y="480" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">SELAMAT MENIKMATI PERJALANAN ANDA</text>
    `
  }
];

async function generateAll() {
  const outputDir = path.resolve(process.cwd(), "public/latihan-ocr");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Membuat 20 berkas gambar struk dummy di: ${outputDir}`);

  const daftarMetadata: any[] = [];

  for (let i = 0; i < daftarStruk.length; i++) {
    const item = daftarStruk[i];
    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${item.lebar}" height="${item.tinggi}">${item.svgContent}</svg>`;
    const resvg = new Resvg(fullSvg, {
      background: "#ffffff",
      fitTo: { mode: "width", value: item.lebar }
    });
    const pngBuffer = resvg.render().asPng();
    const filePath = path.join(outputDir, item.berkas);
    fs.writeFileSync(filePath, pngBuffer);
    console.log(`[${i + 1}/20] Berhasil membuat: ${item.berkas} (${pngBuffer.length} bytes)`);

    daftarMetadata.push({
      nomor: i + 1,
      berkas: item.berkas,
      judul: item.judul,
      url: `/latihan-ocr/${item.berkas}`,
    });
  }

  // Simpan index JSON agar aplikasi dan skrip pengujian dapat membaca daftar latihan
  const indexPath = path.join(outputDir, "daftar_latihan.json");
  fs.writeFileSync(indexPath, JSON.stringify(daftarMetadata, null, 2), "utf8");
  console.log(`✓ Selesai membuat 20 gambar struk dummy dan daftar_latihan.json!`);
}

generateAll().catch(console.error);
