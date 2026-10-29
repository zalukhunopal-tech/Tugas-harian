/**
 * Uji penentuan transaksi penyelesaian dana kegiatan (src/lib/penyelesaianDana.ts), terutama dana awal yang terisi
 * otomatis dari penerimaan dana pada rentang kegiatan. Jalankan: npx tsx scripts/uji_penyelesaian_dana.ts
 */
import { Transaksi } from "../src/types";
import {
  hitungPenyelesaian,
  kegiatanBerjalanDalam,
  RentangKegiatan,
  susunTransaksiPenyelesaian,
  transaksiKegiatan,
} from "../src/lib/penyelesaianDana";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

let urut = 0;
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: `t${++urut}`,
  jenis: "pengeluaran",
  dana: "Dana Kegiatan",
  tanggal: "2026-10-05",
  deskripsi: "x",
  kategori: "Konsumsi",
  jumlah: 100000,
  metode: "Tunai",
  kaitan: "",
  catatan: "",
  ...o,
});

const A: RentangKegiatan = { id: "kA", nama: "Survei Hulu Contoh", tanggalMulai: "2026-09-16", tanggalSelesai: "2026-10-24" };
const B: RentangKegiatan = { id: "kB", nama: "Monev Contoh", tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-10" };
const semua = [A, B];

console.log("Dana awal terisi otomatis");
const danaAwalBebas = trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", tanggal: "2026-09-16", jumlah: 10000000 });
const perdiem = trx({ kategori: "Perdiem", tanggal: "2026-10-05", jumlah: 4800000, kegiatanId: "kA" });
cek("penerimaan dana tanpa kaitan, dalam rentang kegiatan: ikut", transaksiKegiatan([danaAwalBebas, perdiem], A, semua).length === 2);
cek("dana awal terhitung di penyelesaian", hitungPenyelesaian(transaksiKegiatan([danaAwalBebas, perdiem], A, semua)).danaAwal === 10000000);
cek("sesudah kegiatan terakhir selesai: tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", tanggal: "2026-12-01" })], A, semua).length);
cek("tepat di tanggal mulai dan selesai: ikut", transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-09-16" }), trx({ jenis: "pemasukan", tanggal: "2026-10-24" })], A, semua).length === 2);
cek("terhubung id ke kegiatan lain: tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-10-01", kegiatanId: "kB" })], A, semua).length);
cek("kaitan = nama kegiatan lain: tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-10-01", kaitan: "monev contoh" })], A, semua).length);
cek("kaitan teks bebas (bukan nama kegiatan): ikut", transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-10-01", kaitan: "Lembaga" })], A, semua).length === 1);
// Perdiem tanpa kaitan (kolom kegiatan tidak tersimpan di Google Sheets) ikut kegiatan yang rentangnya memuat tanggalnya.
const perdiemBebas = (tanggal: string, o: Partial<Transaksi> = {}) => trx({ kategori: "Perdiem", jumlah: 200000, tanggal, ...o });
cek("perdiem tanpa kaitan dalam rentang satu kegiatan: ikut", transaksiKegiatan([perdiemBebas("2026-10-01")], A, semua).length === 1);
cek("perdiem tanpa kaitan terhitung di penyelesaian", hitungPenyelesaian(transaksiKegiatan([perdiemBebas("2026-10-01"), perdiemBebas("2026-10-02")], A, semua)).totalPerdiem === 400000);
cek("perdiem tanpa kaitan di luar rentang: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-09-10")], A, semua).length);
cek("perdiem terhubung ke kegiatan lain: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-01", { kegiatanId: "kB" })], A, semua).length);
cek("perdiem dengan kaitan nama kegiatan lain: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-01", { kaitan: "monev contoh" })], A, semua).length);
const C: RentangKegiatan = { id: "kC", nama: "Kegiatan Beririsan", tanggalMulai: "2026-10-10", tanggalSelesai: "2026-10-30" };
cek("tanggal perdiem di rentang dua kegiatan: tidak ditebak", !transaksiKegiatan([perdiemBebas("2026-10-12")], A, [A, C]).length && !transaksiKegiatan([perdiemBebas("2026-10-12")], C, [A, C]).length);
cek("tanggal perdiem hanya di rentang satu dari dua kegiatan beririsan: ikut kegiatan itu", transaksiKegiatan([perdiemBebas("2026-10-05")], A, [A, C]).length === 1);
cek("pengeluaran bukan perdiem tanpa kaitan dalam rentang satu kegiatan: ikut", transaksiKegiatan([trx({ tanggal: "2026-10-01" })], A, semua).length === 1);
cek("uang harian hari kepulangan (sehari sesudah selesai) tanpa kaitan: ikut", transaksiKegiatan([perdiemBebas("2026-10-25")], A, semua).length === 1);
cek("hari kepulangan juga untuk biaya lain tanpa kaitan (2 hari sesudah selesai)", transaksiKegiatan([trx({ tanggal: "2026-10-26" })], A, semua).length === 1);
cek("lebih dari 2 hari sesudah selesai: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-27")], A, semua).length);
cek("hari kepulangan tidak masuk kegiatan berikutnya", !transaksiKegiatan([perdiemBebas("2026-10-25")], B, semua).length);
cek("perdiem Dana Pribadi (pemasukan pribadi otomatis): tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-01", { dana: "Dana Pribadi", jenis: "pemasukan" })], A, semua).length);

cek("terhubung ke kegiatan ini: ikut walau di luar rentang", transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-08-01", kegiatanId: "kA" })], A, semua).length === 1);
cek("Pindah Dana tidak dihitung sebagai dana awal", !transaksiKegiatan([trx({ jenis: "pemasukan", kategori: "Pindah Dana", tanggal: "2026-10-01" })], A, semua).length);
cek("Dana Pribadi tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", dana: "Dana Pribadi", tanggal: "2026-10-01" })], A, semua).length);
cek("pengeluaran dengan kaitan teks bebas (bukan judul kegiatan) dalam rentang: ikut", transaksiKegiatan([trx({ tanggal: "2026-09-20", kaitan: "Perjalanan Kota A - Kota B (20 Sep 2026)" })], A, semua).length === 1);
cek("pengeluaran tanpa kaitan di rentang dua kegiatan beririsan: tidak ditebak", !transaksiKegiatan([trx({ tanggal: "2026-10-12" })], A, [A, C]).length);
cek("Pindah Dana keluar tidak dihitung sebagai pengeluaran kegiatan", !transaksiKegiatan([trx({ tanggal: "2026-10-01", kategori: "Pindah Dana" })], A, semua).length);
cek("kaitan kosong tidak cocok dengan nama kegiatan kosong", !transaksiKegiatan([trx({ tanggal: "2027-01-01", kaitan: "" })], { ...A, nama: "" }, semua).length);

console.log("Penerimaan dana pra-kegiatan (sebelum tanggal mulai timesheet)");
const masuk = (tanggal: string, o: Partial<Transaksi> = {}) => trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", tanggal, jumlah: 5000000, ...o });
cek("sebelum kegiatan pertama: ikut kegiatan pertama (dana awal)", transaksiKegiatan([masuk("2026-09-10")], A, semua).length === 1);
cek("dana awal pra-kegiatan terhitung di penyelesaian", hitungPenyelesaian(transaksiKegiatan([masuk("2026-09-10"), perdiem], A, semua)).danaAwal === 5000000);
cek("antara dua kegiatan: ikut kegiatan berikutnya saja", transaksiKegiatan([masuk("2026-10-30")], B, semua).length === 1 && !transaksiKegiatan([masuk("2026-10-30")], A, semua).length);
cek("sehari sebelum kegiatan berikutnya: ikut kegiatan berikutnya", transaksiKegiatan([masuk("2026-11-01")], B, semua).length === 1);
cek("tepat sehari setelah kegiatan sebelumnya selesai: ikut kegiatan berikutnya", transaksiKegiatan([masuk("2026-10-25")], B, semua).length === 1 && !transaksiKegiatan([masuk("2026-10-25")], A, semua).length);
cek("di dalam rentang kegiatan lain: milik kegiatan itu, bukan pra-kegiatan berikutnya", transaksiKegiatan([masuk("2026-10-10")], A, semua).length === 1 && !transaksiKegiatan([masuk("2026-10-10")], B, semua).length);
cek("tiga kegiatan: pra-kegiatan hanya ke yang paling dekat", (() => {
  const D: RentangKegiatan = { id: "kD", nama: "Evaluasi Contoh", tanggalMulai: "2026-12-05", tanggalSelesai: "2026-12-08" };
  const tiga = [A, B, D];
  const t = masuk("2026-11-20");
  return transaksiKegiatan([t], D, tiga).length === 1 && !transaksiKegiatan([t], B, tiga).length && !transaksiKegiatan([t], A, tiga).length;
})());
cek("Pindah Dana pra-kegiatan: tidak ikut", !transaksiKegiatan([masuk("2026-09-10", { kategori: "Pindah Dana" })], A, semua).length);
cek("Dana Pribadi pra-kegiatan: tidak ikut", !transaksiKegiatan([masuk("2026-09-10", { dana: "Dana Pribadi" })], A, semua).length);
cek("pra-kegiatan yang dikaitkan ke kegiatan lain: tidak ikut", !transaksiKegiatan([masuk("2026-09-10", { kegiatanId: "kB" })], A, semua).length);
cek("pengeluaran pra-kegiatan tanpa kaitan tetap tidak ikut", !transaksiKegiatan([trx({ tanggal: "2026-09-10" })], A, semua).length);
cek("tanpa daftar kegiatan lain (bawaan): sebelum mulai ikut", transaksiKegiatan([masuk("2026-09-10")], A).length === 1);
cek("dua kegiatan beririsan: tanggal sebelum keduanya ikut yang mulai lebih dulu saja", (() => {
  const C2: RentangKegiatan = { id: "kC", nama: "Beririsan Contoh", tanggalMulai: "2026-10-05", tanggalSelesai: "2026-10-30" };
  const t = masuk("2026-09-10");
  return transaksiKegiatan([t], A, [A, C2]).length === 1 && !transaksiKegiatan([t], C2, [A, C2]).length;
})());
const praSeluruh = [masuk("2026-09-10"), perdiem, trx({ kategori: "BBM", tanggal: "2026-09-20", jumlah: 300000, kegiatanId: "kA" })];
const praPeriode = praSeluruh.filter((t) => t.tanggal >= "2026-09-16" && t.tanggal <= "2026-10-24");
const praGabung = susunTransaksiPenyelesaian(praSeluruh, praPeriode, kegiatanBerjalanDalam(semua, "2026-09-16", "2026-10-24"), semua);
cek("penyelesaian laporan: dana awal pra-kegiatan ikut walau di luar periode", hitungPenyelesaian(praGabung).danaAwal === 5000000, hitungPenyelesaian(praGabung));

console.log("Periode laporan");
cek("kegiatan yang beririsan dengan periode", kegiatanBerjalanDalam(semua, "2026-10-01", "2026-10-24").map((k) => k.id).join() === "kA");
cek("periode di luar semua kegiatan: kosong", kegiatanBerjalanDalam(semua, "2026-12-01", "2026-12-31").length === 0);
cek("irisan tepat di batas", kegiatanBerjalanDalam(semua, "2026-10-24", "2026-10-30").length === 1 && kegiatanBerjalanDalam(semua, "2026-09-01", "2026-09-15").length === 0);
const seluruh = [danaAwalBebas, perdiem, trx({ kategori: "BBM", tanggal: "2026-09-20", jumlah: 300000, kegiatanId: "kA" })];
const periodeOkt = seluruh.filter((t) => t.tanggal >= "2026-10-01" && t.tanggal <= "2026-10-24");
const gabung = susunTransaksiPenyelesaian(seluruh, periodeOkt, kegiatanBerjalanDalam(semua, "2026-10-01", "2026-10-24"), semua);
const h = hitungPenyelesaian(gabung);
cek("Seluruh Kegiatan: dana awal September ikut", h.danaAwal === 10000000, h);
cek("Seluruh Kegiatan: pengeluaran kegiatan seluruhnya ikut (konsisten dengan dana awal)", h.totalPerdiem === 4800000 && h.realisasiOperasional === 300000, h);
cek("tanpa kegiatan tercakup: hanya transaksi periode", susunTransaksiPenyelesaian(seluruh, periodeOkt, [], semua).length === periodeOkt.length);
cek("tanpa duplikat", new Set(gabung.map((t) => t.id)).size === gabung.length);
cek("sisa dana dihitung benar", h.status === "kembalikan" && h.jumlahStatus === 4900000, h);

if (gagal > 0) {
  console.log(`\n${gagal} pengujian GAGAL`);
  process.exit(1);
}
console.log("\nSemua pengujian lolos");
