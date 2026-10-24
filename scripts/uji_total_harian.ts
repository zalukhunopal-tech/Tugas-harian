/**
 * Uji total bersih per hari di Riwayat (src/lib/totalHarian.ts). Jalankan: npx tsx scripts/uji_total_harian.ts
 */
import { Transaksi } from "../src/types";
import { hitungTotalHarian } from "../src/lib/totalHarian";

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
  dana: "Dana Pribadi",
  tanggal: "2026-10-28",
  deskripsi: "x",
  kategori: "Makan & Minum",
  jumlah: 100000,
  metode: "Tunai",
  kaitan: "",
  catatan: "",
  ...o,
});
const perdiemKegiatan = (jumlah: number) => trx({ id: "p1", dana: "Dana Kegiatan", kategori: "Perdiem", jumlah });
const perdiemPribadi = (jumlah: number) => trx({ id: "p1~pribadi", jenis: "pemasukan", dana: "Dana Pribadi", kategori: "Perdiem", jumlah });

console.log("Total bersih per hari");
cek("hari perdiem saja: +200.000 (perdiem bukan pengeluaran)", JSON.stringify(hitungTotalHarian([perdiemKegiatan(200000), perdiemPribadi(200000)])) === JSON.stringify({ masuk: 200000, keluar: 0, bersih: 200000 }));
cek("pemasukan lebih besar: positif", hitungTotalHarian([trx({ jenis: "pemasukan", jumlah: 500000 }), trx({ jumlah: 300000 })]).bersih === 200000);
cek("pengeluaran lebih besar: negatif", hitungTotalHarian([trx({ jenis: "pemasukan", jumlah: 100000 }), trx({ jumlah: 250000 })]).bersih === -150000);
cek("sama besar: nol", hitungTotalHarian([trx({ jenis: "pemasukan", jumlah: 100000 }), trx({ jumlah: 100000 })]).bersih === 0);
cek("perdiem + pengeluaran lain: hanya yang lain dihitung", hitungTotalHarian([perdiemKegiatan(200000), perdiemPribadi(200000), trx({ jumlah: 50000 })]).bersih === 150000);
cek("Pindah Dana tidak dihitung", hitungTotalHarian([trx({ kategori: "Pindah Dana", jumlah: 900000 }), trx({ jenis: "pemasukan", kategori: "Pindah Dana", jumlah: 900000 })]).bersih === 0);
cek("pengeluaran kategori Perdiem di Dana Pribadi (bukan perdiem kegiatan) tetap dihitung", hitungTotalHarian([trx({ kategori: "Perdiem", dana: "Dana Pribadi", jumlah: 70000 })]).keluar === 70000);
cek("hanya perdiem kegiatan (saringan Dana Kegiatan): tidak ada total", (() => { const h = hitungTotalHarian([perdiemKegiatan(200000)]); return h.masuk === 0 && h.keluar === 0; })());
cek("hari kosong", hitungTotalHarian([]).bersih === 0);

if (gagal > 0) {
  console.log(`\n${gagal} pengujian GAGAL`);
  process.exit(1);
}
console.log("\nSemua pengujian lolos");
