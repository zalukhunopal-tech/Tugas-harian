/**
 * Pengujian komprehensif untuk Parser OCR Transaksi Lokal (ocrParser.ts)
 * Menguji 10 format bukti transaksi Indonesia beserta kasus batas (edge cases).
 */

import { uraiTeksOcrTransaksi, uraikanNominalRupiah } from "../src/lib/ocrParser";

let gagal = 0;
function cek(nama: string, kondisi: boolean, info?: unknown) {
  if (kondisi) {
    console.log(`  ok   ${nama}`);
  } else {
    gagal++;
    console.error(`  GAGAL ${nama}`, info !== undefined ? info : "");
  }
}

console.log("== 1. Uji Normalisasi Nominal Rupiah");
cek("uraikan Rp 150.000", uraikanNominalRupiah("Rp 150.000") === 150000);
cek("uraikan Rp. 50.000,00", uraikanNominalRupiah("Rp. 50.000,00") === 50000);
cek("uraikan koreksi huruf O: 15O.OOO", uraikanNominalRupiah("15O.OOO") === 150000);
cek("uraikan IDR 250,000", uraikanNominalRupiah("IDR 250,000") === 250000);
cek("abaikan nomor HP 081234567890", uraikanNominalRupiah("081234567890") === null);

console.log("\n== 2. Struk Minimarket (Indomaret)");
const strukIndomaret = `
INDOMARET
PT INDOMARCO PRISMATAMA
JL. SENGKAWIT NO. 12
25.10.2026 14:20
MINYAK GORENG 2L   34.000
ROTI TAWAR         15.000
AQUA 600ML          3.500
TOTAL BELANJA      52.500
TUNAI             100.000
KEMBALIAN          47.500
TERIMA KASIH
`;
const hIndomaret = uraiTeksOcrTransaksi(strukIndomaret);
cek("Indomaret: sukses", hIndomaret.sukses === true);
cek("Indomaret: nama toko Indomaret", hIndomaret.namaPenjualPenyedia === "Indomaret");
cek("Indomaret: jumlah utama adalah 52.500 (bukan 100.000 tunai atau 47.500 kembalian)", hIndomaret.jumlah === 52500, hIndomaret.jumlah);
cek("Indomaret: tanggal 2026-10-25", hIndomaret.tanggal === "2026-10-25", hIndomaret.tanggal);
cek("Indomaret: jenis bukti struk thermal", hIndomaret.jenisBukti === "Struk thermal (minimarket/SPBU)");
cek("Indomaret: kategori kegiatan Konsumsi", hIndomaret.kategoriDanaKegiatan === "Konsumsi");

console.log("\n== 3. Struk SPBU (Pertamina Pertalite)");
const strukSpbu = `
SPBU 34.12345
JL. RAYA SUDIRMAN KM 5
PERTAMINA PASTI PAS
TGL: 26/10/2026 09:15
PRODUK: PERTALITE
HARGA/LITER: Rp 10.000
VOLUME (L): 15.00 L
TOTAL RP: 150.000
METODE: TUNAI
`;
const hSpbu = uraiTeksOcrTransaksi(strukSpbu);
cek("SPBU: sukses", hSpbu.sukses === true);
cek("SPBU: nama penyedia SPBU Pertamina", hSpbu.namaPenjualPenyedia?.includes("SPBU Pertamina") === true);
cek("SPBU: jumlah 150.000", hSpbu.jumlah === 150000, hSpbu.jumlah);
cek("SPBU: tanggal 2026-10-26", hSpbu.tanggal === "2026-10-26");
cek("SPBU: rincian volume 15 liter", hSpbu.rincian?.banyaknya === 15);
cek("SPBU: rincian harga satuan Rp 10.000", hSpbu.rincian?.hargaSatuan === 10000);
cek("SPBU: kategori kegiatan BBM", hSpbu.kategoriDanaKegiatan === "BBM");

console.log("\n== 4. Nota Rumah Makan (RM Sederhana - Subtotal vs Grand Total)");
const notaResto = `
RM SEDERHANA SAUYO
JL. JENDERAL AHMAD YANI NO. 45
TABLE: 12
DINE IN
AYAM POP (2)        48.000
RENDANG (2)         52.000
NASI PUTIH (4)      40.000
ES TEH MANIS (4)    28.000
SUBTOTAL           168.000
PB1 (PAJAK 10%)     16.800
GRAND TOTAL        184.800
DEBIT BCA
27-10-2026
`;
const hResto = uraiTeksOcrTransaksi(notaResto);
cek("Resto: sukses", hResto.sukses === true);
cek("Resto: nama RM Sederhana", hResto.namaPenjualPenyedia?.includes("RM SEDERHANA") === true);
cek("Resto: jumlah mengutamakan Grand Total 184.800 (bukan Subtotal 168.000)", hResto.jumlah === 184800, hResto.jumlah);
cek("Resto: kandidat memuat Subtotal dan Grand Total", hResto.kandidatJumlah.some((k) => k.nominal === 168000));
cek("Resto: metode Debit", hResto.metode === "Debit");
cek("Resto: kategori kegiatan Konsumsi", hResto.kategoriDanaKegiatan === "Konsumsi");

console.log("\n== 5. Kwitansi (Sewa / Rental Kendaraan)");
const teksKwitansi = `
KUITANSI PEMBAYARAN
NO: 088/KW/X/2026
TELAH DITERIMA DARI: Tim Fasilitasi Wilayah Adat
UANG SEJUMLAH: Satu Juta Lima Ratus Ribu Rupiah
UNTUK PEMBAYARAN: Sewa Mobil Avanza Lapangan 3 Hari
TERBILANG: Rp 1.500.000
Diterima Oleh: CV. RENTAL JAYA ABADI
Tanjung Selor, 20 Oktober 2026
`;
const hKwitansi = uraiTeksOcrTransaksi(teksKwitansi);
cek("Kwitansi: sukses", hKwitansi.sukses === true);
cek("Kwitansi: jenis bukti Kuitansi", hKwitansi.jenisBukti === "Kuitansi");
cek("Kwitansi: jumlah 1.500.000", hKwitansi.jumlah === 1500000, hKwitansi.jumlah);
cek("Kwitansi: kategori kegiatan Rental Kendaraan", hKwitansi.kategoriDanaKegiatan === "Rental Kendaraan");
cek("Kwitansi: nama penyedia CV. RENTAL JAYA ABADI", hKwitansi.namaPenjualPenyedia?.includes("CV. RENTAL JAYA") === true);

console.log("\n== 6. Bukti Transfer Bank (BCA)");
const buktiTransfer = `
M-BCA
TRANSFER BERHASIL
TANGGAL: 22/10/2026 11:45:00
NO. REFERENSI: 2026102211450099
REKENING TUJUAN: 1234567890
NAMA PENERIMA: PAK YOHANES
NOMINAL TRANSFER: Rp 750.000
BIAYA ADMIN: Rp 0
TOTAL TRANSAKSI: Rp 750.000
`;
const hTf = uraiTeksOcrTransaksi(buktiTransfer);
cek("Transfer: sukses", hTf.sukses === true);
cek("Transfer: metode Transfer", hTf.metode === "Transfer");
cek("Transfer: jumlah 750.000", hTf.jumlah === 750000, hTf.jumlah);
cek("Transfer: nama penerima PAK YOHANES", hTf.namaPenjualPenyedia?.includes("PAK YOHANES") === true);
cek("Transfer: jenis bukti Invoice + kuitansi", hTf.jenisBukti === "Invoice + kuitansi");

console.log("\n== 7. Bukti Pembayaran QRIS");
const buktiQris = `
PEMBAYARAN QRIS BERHASIL
MERCHANT: WARUNG KOPI NIKMAT
NMID: ID1020030040050
23/10/2026 19:30
TOTAL PEMBAYARAN: Rp 45.000
STATUS: SUKSES
`;
const hQris = uraiTeksOcrTransaksi(buktiQris);
cek("QRIS: sukses", hQris.sukses === true);
cek("QRIS: metode QRIS", hQris.metode === "QRIS");
cek("QRIS: jumlah 45.000", hQris.jumlah === 45000);
cek("QRIS: merchant Warung Kopi Nikmat", hQris.namaPenjualPenyedia?.includes("WARUNG KOPI") === true);

console.log("\n== 8. Tiket Speedboat / Transportasi");
const tiketSpeedboat = `
TIKET PASSENGER SPEEDBOAT
SB. MENARA NIKLAS EXPRESS
RUTE: TARAKAN - TANJUNG SELOR
TANGGAL: 20/09/2026
NO TIKET: 1042
HARGA TIKET: Rp 165.000
`;
const hTiket = uraiTeksOcrTransaksi(tiketSpeedboat);
cek("Tiket: jenis bukti Tiket", hTiket.jenisBukti === "Tiket");
cek("Tiket: jumlah 165.000", hTiket.jumlah === 165000);
cek("Tiket: kategori kegiatan Transportasi", hTiket.kategoriDanaKegiatan === "Transportasi");

console.log("\n== 9. Struk Tanpa Tanggal (Default Hari Ini + Peringatan)");
const strukTanpaTanggal = `
TOKO ATK BERKAH
JL. SUTOYO
KERTAS A4 70GSM (2 RIM)  110.000
MAP FOLIO (1 PACK)        25.000
TOTAL                    135.000
TUNAI                    150.000
`;
const hTanpaTgl = uraiTeksOcrTransaksi(strukTanpaTanggal);
cek("Tanpa Tanggal: sukses", hTanpaTgl.sukses === true);
cek("Tanpa Tanggal: jumlah 135.000", hTanpaTgl.jumlah === 135000);
const todayIso = new Date().toISOString().slice(0, 10);
cek("Tanpa Tanggal: tanggal disetel ke hari ini", hTanpaTgl.tanggal === todayIso);
cek("Tanpa Tanggal: ada peringatan tanggal tidak tertera", hTanpaTgl.peringatan.some((p) => p.includes("Tanggal transaksi tidak tertera")));

console.log("\n== 10. Struk Buram / Teks Tidak Terbaca");
const teksBuram = "    ..   --   x ";
const hBuram = uraiTeksOcrTransaksi(teksBuram);
cek("Buram: sukses bernilai false", hBuram.sukses === false);
cek("Buram: ada pesan keterangan", typeof hBuram.pesan === "string" && hBuram.pesan.length > 0);

console.log("\n== 11. Struk Banyak Nominal (Diskon, Saldo, Kembalian, Grand Total)");
const strukBanyakNominal = `
SUPERINDO TANJUNG SELOR
TGL: 28-10-2026
SUBTOTAL: Rp 120.000
DISKON MEMBER: Rp 20.000
BIAYA KANTONG: Rp 500
GRAND TOTAL: Rp 100.500
BAYAR TUNAI: Rp 150.000
KEMBALIAN: Rp 49.500
SISA SALDO POIN: 12.000
`;
const hBanyak = uraiTeksOcrTransaksi(strukBanyakNominal);
cek("Banyak Nominal: sukses", hBanyak.sukses === true);
cek("Banyak Nominal: jumlah utama adalah Grand Total 100.500", hBanyak.jumlah === 100500, hBanyak.jumlah);
cek("Banyak Nominal: tidak menganggap kembalian 49.500 sebagai total", hBanyak.jumlah !== 49500);
cek("Banyak Nominal: tidak menganggap sisa saldo 12.000 sebagai total", hBanyak.jumlah !== 12000);
cek("Banyak Nominal: kandidat tersedia untuk pilihan pengguna", hBanyak.kandidatJumlah.length >= 2);

console.log("\n== 12. Invoice Sederhana");
const teksInvoice = `
INVOICE
CV. GRAFIKA DIGITAL
NO. INVOICE: INV-2026-092
KEPADA: TIM LAPANGAN
TANGGAL: 18/10/2026
CETAK BANNER KEGIATAN 3X1 M (2 PCS)  150.000
JILID DOKUMEN LAPORAN (5 BUKU)        75.000
TOTAL TAGIHAN: Rp 225.000
TRANSFER REK BRI 0123-456-789
`;
const hInv = uraiTeksOcrTransaksi(teksInvoice);
cek("Invoice: sukses", hInv.sukses === true);
cek("Invoice: jumlah 225.000", hInv.jumlah === 225000);
cek("Invoice: jenis bukti Invoice + kuitansi", hInv.jenisBukti === "Invoice + kuitansi");
cek("Invoice: kategori kegiatan Pengadaan Barang & Perlengkapan", hInv.kategoriDanaKegiatan === "Pengadaan Barang & Perlengkapan");

console.log("\n== 13. Bukti Transaksi E-Wallet (GoPay)");
const teksEwallet = `
GOPAY
PEMBAYARAN BERHASIL
ORDER ID: GP-887123901
24 OKTOBER 2026 13:10
MERCHANT: KOPI KENANGAN
TOTAL BAYAR: Rp 38.000
METODE PEMBAYARAN: GOPAY
`;
const hGopay = uraiTeksOcrTransaksi(teksEwallet);
cek("GoPay: sukses", hGopay.sukses === true);
cek("GoPay: jumlah 38.000", hGopay.jumlah === 38000);
cek("GoPay: metode QRIS", hGopay.metode === "QRIS");
cek("GoPay: merchant Kopi Kenangan", hGopay.namaPenjualPenyedia?.toUpperCase().includes("KOPI KENANGAN") === true);

console.log("\n== 14. Kasus Nyata: Struk Kafe/Minuman (Momoyo Tj Selor)");
const teksMomoyo = `
© Ng G3)
DeTT SELOR
JI. Duku, Tj. Selor Hilir, Kec. Tj. Selor
Kabupaten Bulungan North Kalimantan :: 
Bawa pulang 54
Nomor Pesanan: 12116027601234890753
Waktu Pesanan: 2026-10-30 12:41:08
= Waktu Print: 2026-10-30 12:41:30
<< © Operator Kasir: Hesti pravitasari .
© Saluran: Toko Fisik
1 BCu aa - ioe = en =
Nama Produk Harga Jumlah Subtotal == 
Milk Tea Boom == aa 
| /Normal Sugar/Normal Ice =
ry 22.000 1 2.00 =
. Ba Gula Aren Milk Tea RAR =
| = L/Normal Sugar/Normal Ice =
: 19.000 1 19.000 En
Total Pesanan: BE
Total Harga: 41.000 E=———
Nominal Pendapatan: 41.000 &==——= ——
“Metode Penbayaran: wR =
oy “ALAN. SERGNSINYA: 41.000
| Le. BEET BT TTT
fd I CF aNl Ingat pent Ing bi 91 kami
`;
const hMomoyo = uraiTeksOcrTransaksi(teksMomoyo);
cek("Momoyo: sukses", hMomoyo.sukses === true);
cek("Momoyo: nama toko Momoyo Tj Selor", hMomoyo.namaPenjualPenyedia === "Momoyo Tj Selor");
cek("Momoyo: jumlah utama adalah 41.000 (bukan sub-item 19.000)", hMomoyo.jumlah === 41000, hMomoyo.jumlah);
cek("Momoyo: metode pembayaran QRIS/QR", hMomoyo.metode === "QRIS", hMomoyo.metode);
cek("Momoyo: tidak ada nomor pesanan 121.160.278 atau tahun 2026 di kandidat", !hMomoyo.kandidatJumlah.some(k => k.nominal > 1000000 || k.nominal === 2026));

console.log("\n== 15. Kasus Nyata: Layar Pembayaran Dinamis QRIS (Mie Gacoan)");
const teksMieGacoan = `
BRIS Ser. 3
Mie Gacoan Bulungan
- Sengkawit
[=] fa [=]
"HE a rte TE
211802160
ah Ed ry A: Si AT 3
Bn HEELORR tm: |
Total Pembayaran
Rp53.500
`;
const hGacoan = uraiTeksOcrTransaksi(teksMieGacoan);
cek("Gacoan: sukses", hGacoan.sukses === true);
cek("Gacoan: nama merchant Mie Gacoan Bulungan - Sengkawit (bukan BRIS Ser. 3)", hGacoan.namaPenjualPenyedia === "Mie Gacoan Bulungan - Sengkawit", hGacoan.namaPenjualPenyedia);
cek("Gacoan: jumlah Rp 53.500 (menolak noise QR 211802160)", hGacoan.jumlah === 53500, hGacoan.jumlah);
cek("Gacoan: kandidat tidak memuat 211802160", !hGacoan.kandidatJumlah.some(k => k.nominal === 211802160));
cek("Gacoan: metode QRIS", hGacoan.metode === "QRIS", hGacoan.metode);

console.log("\n== 16. Parser Standar QRIS EMVCo Nasional (Tag 54 & Tag 59)");
import { uraikanQrisEMVCo } from "../src/lib/ocrParser";
const qrisPayload = "00020101021226590013ID.CO.BNI.WWW011893600009150423557102096123999980303UMI51450015ID.OR.GPNQR.WWW0215ID10254219199090303UMI520458175303360540853500.005802ID5925ESB RESTAURANT TECHNOLOGY6013JAKARTA BARAT61051148062210110S1260CG6GP0703A016304313F";
const hasilQris = uraikanQrisEMVCo(qrisPayload);
cek("QRIS EMVCo: nominal tag 54 tepat 53.500", hasilQris?.amount === 53500, hasilQris?.amount);
cek("QRIS EMVCo: merchant tag 59 ESB RESTAURANT TECHNOLOGY", hasilQris?.merchantName === "ESB RESTAURANT TECHNOLOGY", hasilQris?.merchantName);

console.log("\n== 17. Penolakan Angka Noise / Barcode Tanpa Pemisah");
cek("Abaikan 211802160 (bare 9 digit tanpa Rp)", uraikanNominalRupiah("211802160") === null);
cek("Abaikan 121160278 (bare 9 digit)", uraikanNominalRupiah("121160278") === null);
cek("Abaikan 17348007 (bare 8 digit)", uraikanNominalRupiah("17348007") === null);
cek("Terima Rp 53.500 (format rupiah titik)", uraikanNominalRupiah("Rp 53.500") === 53500);
cek("Terima 41.000 (format titik ribuan)", uraikanNominalRupiah("41.000") === 41000);

if (gagal > 0) {
  console.error(`\nTerdapat ${gagal} pengujian gagal!`);
  process.exit(1);
} else {
  console.log("\nSemua 17 pengujian parser OCR transaksi lolos dengan sempurna!");
}

