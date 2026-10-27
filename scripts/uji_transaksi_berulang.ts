/**
 * Uji pengingat transaksi berulang yang "pintar": jadwal yang transaksinya untuk periode berjalan sudah ada tidak dianggap
 * jatuh tempo, dan tanggal catat mengikuti jadwal. Jalankan: npx tsx scripts/uji_transaksi_berulang.ts
 */
import { apakahJatuhTempo, sudahAdaTransaksiPeriode, tanggalJadwalSaatIni } from "../src/lib/transaksiBerulang";
import type { Transaksi, TransaksiBerulang } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const acuan = new Date(2026, 9, 27); // 27 Oktober 2026 (Selasa)
const jadwal = (o: Partial<TransaksiBerulang>): TransaksiBerulang => ({
  id: "r1", nama: "Sewa kos", jenis: "pengeluaran", dana: "Dana Pribadi", jumlah: 1000000, kategori: "Tagihan & Sewa", metode: "Tunai", kaitan: "", catatan: "",
  frekuensi: "bulanan", tanggalMulai: "2026-01-01", hariDalamBulan: 1, aktif: true, ...o,
});
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: "t", jenis: "pengeluaran", dana: "Dana Pribadi", tanggal: "2026-10-01", deskripsi: "Sewa kos", kategori: "Tagihan & Sewa", jumlah: 1000000, metode: "Tunai", kaitan: "", catatan: "", ...o,
});

console.log("Periode bulanan");
{
  const j = jadwal({});
  cek("tanpa transaksi: sudah ada = tidak", !sudahAdaTransaksiPeriode(j, [], acuan));
  cek("transaksi serupa bulan ini: sudah ada", sudahAdaTransaksiPeriode(j, [trx({})], acuan));
  cek("huruf besar/kecil dan spasi ganda diabaikan", sudahAdaTransaksiPeriode(j, [trx({ deskripsi: "  SEWA   kos " })], acuan));
  cek("jumlah boleh berbeda (tagihan berubah)", sudahAdaTransaksiPeriode(j, [trx({ jumlah: 1250000 })], acuan));
  cek("bulan lalu tidak dihitung", !sudahAdaTransaksiPeriode(j, [trx({ tanggal: "2026-09-27" })], acuan));
  cek("uraian lain, kategori lain, dana lain, atau jenis lain tidak dihitung", !sudahAdaTransaksiPeriode(j, [trx({ deskripsi: "Sewa mobil" }), trx({ kategori: "Lain-lain" }), trx({ dana: "Dana Kegiatan" }), trx({ jenis: "pemasukan" })], acuan));
}

console.log("Jatuh tempo menurut daftar transaksi");
{
  const j = jadwal({});
  const sekarang = new Date();
  const bulanIni = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
  cek("tanpa daftar transaksi: perilaku lama (hanya menurut jadwal)", apakahJatuhTempo(j) === true);
  cek("dengan transaksi serupa bulan ini: tidak jatuh tempo", apakahJatuhTempo(j, [trx({ tanggal: `${bulanIni}-01` })]) === false);
  cek("dengan transaksi serupa bulan lalu: tetap jatuh tempo", apakahJatuhTempo(j, [trx({ tanggal: "2020-01-01" })]) === true);
  cek("jadwal nonaktif: tidak pernah jatuh tempo", apakahJatuhTempo(jadwal({ aktif: false }), []) === false);
  cek("sudah diterapkan bulan ini menurut jadwal: tidak jatuh tempo", apakahJatuhTempo(jadwal({ terakhirDiterapkan: `${bulanIni}-01` }), []) === false);
}

console.log("Periode lain");
{
  const mingguan = jadwal({ frekuensi: "mingguan" });
  cek("mingguan: transaksi 3 hari lalu dihitung", sudahAdaTransaksiPeriode(mingguan, [trx({ tanggal: "2026-10-24" })], acuan));
  cek("mingguan: transaksi 8 hari lalu tidak dihitung", !sudahAdaTransaksiPeriode(mingguan, [trx({ tanggal: "2026-10-19" })], acuan));
  const harian = jadwal({ frekuensi: "harian" });
  cek("harian: hanya hari ini", sudahAdaTransaksiPeriode(harian, [trx({ tanggal: "2026-10-27" })], acuan) && !sudahAdaTransaksiPeriode(harian, [trx({ tanggal: "2026-10-26" })], acuan));
  const tahunan = jadwal({ frekuensi: "tahunan", tanggalMulai: "2025-03-15" });
  cek("tahunan: transaksi tahun ini dihitung, tahun lalu tidak", sudahAdaTransaksiPeriode(tahunan, [trx({ tanggal: "2026-03-15" })], acuan) && !sudahAdaTransaksiPeriode(tahunan, [trx({ tanggal: "2025-03-15" })], acuan));
}

console.log("Tanggal catat menurut jadwal");
{
  cek("bulanan tanggal 1 → 1 bulan ini", tanggalJadwalSaatIni(jadwal({ hariDalamBulan: 1 }), acuan) === "2026-10-01");
  cek("bulanan tanggal 25 → 25 bulan ini", tanggalJadwalSaatIni(jadwal({ hariDalamBulan: 25 }), acuan) === "2026-10-25");
  cek("tanggal jadwal belum tiba tidak melewati hari ini", tanggalJadwalSaatIni(jadwal({ hariDalamBulan: 30 }), acuan) === "2026-10-27");
  cek("tanggal 31 di bulan 30 hari dipotong ke akhir bulan", tanggalJadwalSaatIni(jadwal({ hariDalamBulan: 31 }), new Date(2026, 8, 30)) === "2026-09-30");
  cek("harian dan mingguan → hari ini", tanggalJadwalSaatIni(jadwal({ frekuensi: "harian" }), acuan) === "2026-10-27" && tanggalJadwalSaatIni(jadwal({ frekuensi: "mingguan" }), acuan) === "2026-10-27");
  cek("tahunan → ulang tahun jadwal di tahun ini (tidak melewati hari ini)", tanggalJadwalSaatIni(jadwal({ frekuensi: "tahunan", tanggalMulai: "2025-03-15" }), acuan) === "2026-03-15");
}

if (gagal) {
  console.log(`\n${gagal} uji gagal`);
  process.exit(1);
}
console.log("\nSemua uji lolos");
