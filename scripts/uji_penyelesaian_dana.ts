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
const B: RentangKegiatan = { id: "kB", nama: "Monev Mentarang", tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-10" };
const semua = [A, B];

console.log("Dana awal terisi otomatis");
const danaAwalBebas = trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", tanggal: "2026-09-16", jumlah: 10000000 });
const perdiem = trx({ kategori: "Perdiem", tanggal: "2026-10-05", jumlah: 4800000, kegiatanId: "kA" });
cek("penerimaan dana tanpa kaitan, dalam rentang kegiatan: ikut", transaksiKegiatan([danaAwalBebas, perdiem], A, semua).length === 2);
cek("dana awal terhitung di penyelesaian", hitungPenyelesaian(transaksiKegiatan([danaAwalBebas, perdiem], A, semua)).danaAwal === 10000000);
cek("di luar rentang kegiatan: tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", tanggal: "2026-09-10" })], A, semua).length);
cek("tepat di tanggal mulai dan selesai: ikut", transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-09-16" }), trx({ jenis: "pemasukan", tanggal: "2026-10-24" })], A, semua).length === 2);
cek("terhubung id ke kegiatan lain: tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-10-01", kegiatanId: "kB" })], A, semua).length);
cek("kaitan = nama kegiatan lain: tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-10-01", kaitan: "monev mentarang" })], A, semua).length);
cek("kaitan teks bebas (bukan nama kegiatan): ikut", transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-10-01", kaitan: "Lembaga" })], A, semua).length === 1);
// Perdiem tanpa kaitan (kolom kegiatan tidak tersimpan di Google Sheets) ikut kegiatan yang rentangnya memuat tanggalnya.
const perdiemBebas = (tanggal: string, o: Partial<Transaksi> = {}) => trx({ kategori: "Perdiem", jumlah: 200000, tanggal, ...o });
cek("perdiem tanpa kaitan dalam rentang satu kegiatan: ikut", transaksiKegiatan([perdiemBebas("2026-10-01")], A, semua).length === 1);
cek("perdiem tanpa kaitan terhitung di penyelesaian", hitungPenyelesaian(transaksiKegiatan([perdiemBebas("2026-10-01"), perdiemBebas("2026-10-02")], A, semua)).totalPerdiem === 400000);
cek("perdiem tanpa kaitan di luar rentang: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-09-10")], A, semua).length);
cek("perdiem terhubung ke kegiatan lain: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-01", { kegiatanId: "kB" })], A, semua).length);
cek("perdiem dengan kaitan nama kegiatan lain: tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-01", { kaitan: "monev mentarang" })], A, semua).length);
const C: RentangKegiatan = { id: "kC", nama: "Kegiatan Beririsan", tanggalMulai: "2026-10-10", tanggalSelesai: "2026-10-30" };
cek("tanggal perdiem di rentang dua kegiatan: tidak ditebak", !transaksiKegiatan([perdiemBebas("2026-10-12")], A, [A, C]).length && !transaksiKegiatan([perdiemBebas("2026-10-12")], C, [A, C]).length);
cek("tanggal perdiem hanya di rentang satu dari dua kegiatan beririsan: ikut kegiatan itu", transaksiKegiatan([perdiemBebas("2026-10-05")], A, [A, C]).length === 1);
cek("pengeluaran bukan perdiem tanpa kaitan: tetap tidak ikut", !transaksiKegiatan([trx({ tanggal: "2026-10-01" })], A, semua).length);
cek("perdiem Dana Pribadi (pemasukan pribadi otomatis): tidak ikut", !transaksiKegiatan([perdiemBebas("2026-10-01", { dana: "Dana Pribadi", jenis: "pemasukan" })], A, semua).length);

cek("terhubung ke kegiatan ini: ikut walau di luar rentang", transaksiKegiatan([trx({ jenis: "pemasukan", tanggal: "2026-08-01", kegiatanId: "kA" })], A, semua).length === 1);
cek("Pindah Dana tidak dihitung sebagai dana awal", !transaksiKegiatan([trx({ jenis: "pemasukan", kategori: "Pindah Dana", tanggal: "2026-10-01" })], A, semua).length);
cek("Dana Pribadi tidak ikut", !transaksiKegiatan([trx({ jenis: "pemasukan", dana: "Dana Pribadi", tanggal: "2026-10-01" })], A, semua).length);
cek("pengeluaran tanpa kaitan tidak ikut (hanya penerimaan yang diisi otomatis)", !transaksiKegiatan([trx({ tanggal: "2026-10-01" })], A, semua).length);
cek("kaitan kosong tidak cocok dengan nama kegiatan kosong", !transaksiKegiatan([trx({ tanggal: "2027-01-01", kaitan: "" })], { ...A, nama: "" }, semua).length);

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
