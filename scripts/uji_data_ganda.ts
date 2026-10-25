/**
 * Uji pencarian catatan ganda (src/lib/dataGanda.ts). Jalankan: npx tsx scripts/uji_data_ganda.ts
 */
import { cariDataGanda, idDisarankanDihapus, normalisasiUraian, waktuDariId } from "../src/lib/dataGanda";
import type { Transaksi } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const trx = (p: Partial<Transaksi> & { id: string }): Transaksi => ({
  jenis: "pengeluaran",
  dana: "Dana Pribadi",
  tanggal: "2026-10-04",
  deskripsi: "Langganan Contoh",
  kategori: "Tagihan & Sewa",
  jumlah: 77000,
  metode: "Tunai",
  kaitan: "",
  catatan: "",
  diubah: "2026-10-25T10:50:23.756Z",
  ...p,
});

console.log("Normalisasi");
cek("huruf besar/kecil dan tanda baca disamakan", normalisasiUraian("Gemini AI Pro.") === normalisasiUraian("  gemini Ai pro "));
cek("angka dan huruf bukan Latin dipertahankan", normalisasiUraian("Bayar 2x · Café") === "bayar 2x café");
cek("waktu dari ID buatan aplikasi", waktuDariId("mvk6pobicrvjrm") > waktuDariId("muwsggn6vvjoi7") && waktuDariId("muwsggn6vvjoi7") > 0);
cek("ID dari baris sheet tidak punya waktu", waktuDariId("s6812e40e61") === 0 && waktuDariId("sheet-0a1b2c3d") === 0);

console.log("Kelompok ganda");
const semua: Transaksi[] = [
  // Pasangan yang sama selain huruf dan metode bayar: ganda.
  trx({ id: "mvk6pobicrvjrm", deskripsi: "Gemini AI Pro", metode: "Kartu debit/kredit" }),
  trx({ id: "muwsggn6vvjoi7", deskripsi: "Gemini Ai Pro", metode: "Tunai" }),
  // Jumlah atau tanggal beda: bukan ganda.
  trx({ id: "a1", deskripsi: "Kopi", jumlah: 20000 }),
  trx({ id: "a2", deskripsi: "Kopi", jumlah: 25000 }),
  trx({ id: "a3", deskripsi: "Kopi", jumlah: 20000, tanggal: "2026-10-05" }),
  // Dana atau jenis beda: bukan ganda.
  trx({ id: "b1", deskripsi: "Dana awal", jenis: "pemasukan", dana: "Dana Kegiatan", jumlah: 1000000, tanggal: "2026-09-19" }),
  trx({ id: "b2", deskripsi: "Dana awal", jenis: "pemasukan", dana: "Dana Pribadi", jumlah: 1000000, tanggal: "2026-09-19" }),
  trx({ id: "b3", deskripsi: "Dana awal", jenis: "pengeluaran", dana: "Dana Pribadi", jumlah: 1000000, tanggal: "2026-09-19" }),
  // Perdiem dan pasangan (pindah dana) dilewati.
  trx({ id: "p1", deskripsi: "Perdiem Contoh · 4 Okt 2026", kategori: "Perdiem", jumlah: 200000 }),
  trx({ id: "p2", deskripsi: "Perdiem Contoh · 4 Okt 2026", kategori: "Perdiem", jumlah: 200000 }),
  trx({ id: "t1", deskripsi: "Pindah dana", pasanganId: "x", jumlah: 50000 }),
  trx({ id: "t2", deskripsi: "Pindah dana", pasanganId: "x", jumlah: 50000 }),
  // Tanpa uraian: tidak bisa dinilai.
  trx({ id: "k1", deskripsi: "", jumlah: 1000 }),
  trx({ id: "k2", deskripsi: "  ", jumlah: 1000 }),
];
const kel = cariDataGanda(semua);
cek("hanya satu kelompok ganda (Gemini)", kel.length === 1 && kel[0].anggota.length === 2, kel.map((k) => k.anggota.map((t) => t.id)));
cek("tanpa keterangan tambahan, yang lebih baru dipertahankan", kel[0].anggota[0].id === "mvk6pobicrvjrm" && idDisarankanDihapus(kel).join() === "muwsggn6vvjoi7", idDisarankanDihapus(kel));

console.log("Yang berketerangan dipertahankan");
const bukti = { id: "bk", nama: "Struk", tipe: "image/jpeg", driveLink: "https://drive.example.org/x" };
const k2 = cariDataGanda([
  trx({ id: "mvk6pobicrvjrm", deskripsi: "Makan siang", jumlah: 68000 }),
  trx({ id: "muwsggn6vvjoi7", deskripsi: "makan siang", jumlah: 68000, bukti: [bukti] }),
  trx({ id: "s6812e40e61", deskripsi: "Makan Siang", jumlah: 68000, catatan: "Bayar QRIS" }),
]);
cek("satu kelompok berisi tiga catatan", k2.length === 1 && k2[0].anggota.length === 3);
cek("urutan: berbukti, bercatatan, lalu polos", k2[0].anggota.map((t) => t.id).join() === "muwsggn6vvjoi7,s6812e40e61,mvk6pobicrvjrm", k2[0].anggota.map((t) => t.id));
cek("dua yang lain disarankan dihapus", idDisarankanDihapus(k2).length === 2);

console.log("Urutan kelompok");
const k3 = cariDataGanda([
  trx({ id: "u1", deskripsi: "A", tanggal: "2026-09-01" }),
  trx({ id: "u2", deskripsi: "a", tanggal: "2026-09-01" }),
  trx({ id: "u3", deskripsi: "B", tanggal: "2026-10-01" }),
  trx({ id: "u4", deskripsi: "b", tanggal: "2026-10-01" }),
]);
cek("tanggal terbaru dulu", k3.length === 2 && k3[0].anggota[0].tanggal === "2026-10-01");
cek("tanpa ganda -> daftar kosong", cariDataGanda([trx({ id: "z1", deskripsi: "Satu" })]).length === 0);

if (gagal) {
  console.log(`\n${gagal} uji gagal`);
  process.exit(1);
}
console.log("\nSemua uji lolos");
