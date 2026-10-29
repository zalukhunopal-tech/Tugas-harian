/**
 * Uji pencocokan dan penyatuan kegiatan kembar (src/lib/kegiatanSama.ts): kegiatan dari Penerimaan Dana dan dari Timesheet
 * yang judulnya berbeda tipis dianggap satu. Jalankan: npx tsx scripts/uji_kegiatan_sama.ts
 */
import { DataKegiatan, Transaksi } from "../src/types";
import {
  batchDiAkhirJudul,
  cariKegiatanSama,
  gabungDaftarKegiatan,
  kegiatanDariKaitan,
  kegiatanSama,
  kunciNamaKegiatan,
  namaKegiatanSama,
  satukanKegiatanKembar,
} from "../src/lib/kegiatanSama";
import { transaksiKegiatan } from "../src/lib/penyelesaianDana";

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
const kg = (o: Partial<DataKegiatan>): DataKegiatan => ({
  id: `k${++urut}`,
  nama: "Kegiatan",
  lokasi: "",
  tanggalMulai: "2026-10-05",
  tanggalSelesai: "2026-10-05",
  ...o,
});

const JUDUL = "Pemetaan Partisipatif Wilayah Kelola Masyarakat Desa Contoh";

console.log("Kunci dan pencocokan judul");
cek("(Batch N) di akhir diabaikan", kunciNamaKegiatan(`${JUDUL} (Batch 4)`) === kunciNamaKegiatan(JUDUL));
cek("'Batch N' tanpa kurung juga diabaikan", kunciNamaKegiatan(`${JUDUL} Batch 4`) === kunciNamaKegiatan(JUDUL));
cek("spasi ganda dan huruf besar/kecil", namaKegiatanSama(`  ${JUDUL.toUpperCase()}  `.replace(/ /g, "  "), JUDUL));
cek("tanda baca berbeda", namaKegiatanSama("Pemetaan - Desa Contoh, Wilayah Hulu", "Pemetaan Desa Contoh Wilayah Hulu"));
cek("judul terpotong (awalan cukup panjang) cocok", namaKegiatanSama(JUDUL.slice(0, 45), `${JUDUL} (Batch 4)`));
cek("terpotong dengan '...' cocok", namaKegiatanSama(`${JUDUL.slice(0, 45)}...`, JUDUL));
cek("awalan pendek TIDAK cocok", !namaKegiatanSama("Pemetaan Desa Contoh", "Pemetaan Desa Contoh Tahap Dua"));
cek("judul kosong tidak cocok", !namaKegiatanSama("", "") && !namaKegiatanSama(undefined, JUDUL));
cek("batchDiAkhirJudul", batchDiAkhirJudul("A (Batch 12)") === 12 && batchDiAkhirJudul("A Batch 3") === 3 && batchDiAkhirJudul("A") === undefined);

console.log("Kegiatan sama atau beda");
const placeholder = kg({ id: "pd", nama: JUDUL, tanggalMulai: "2026-09-01", tanggalSelesai: "2026-09-01" });
const dariTimesheet = kg({
  id: "ts",
  nama: `${JUDUL} (Batch 4)`,
  batch: 4,
  lokasi: "Desa Contoh",
  tanggalMulai: "2026-10-05",
  tanggalSelesai: "2026-10-20",
  timesheetId: "sheet1",
  timesheetBaris: [{ tanggal: "2026-10-05", keterangan: "Mulai", lokasi: "Desa Contoh" }],
});
cek("placeholder Penerimaan Dana (dana masuk jauh sebelum timesheet) sama dengan kegiatan timesheet", kegiatanSama(placeholder, dariTimesheet));
cek("batch berbeda -> kegiatan berbeda", !kegiatanSama(dariTimesheet, { ...dariTimesheet, id: "ts2", nama: `${JUDUL} (Batch 5)`, batch: 5 }));
cek(
  "judul sama, batch sama, tahun sama -> sama walau periode jauh",
  kegiatanSama(dariTimesheet, { ...dariTimesheet, id: "lain", tanggalMulai: "2026-12-20", tanggalSelesai: "2026-12-28" })
);
cek(
  "judul dan batch sama tetapi tahun berbeda (batch dihitung ulang tiap tahun) -> beda",
  !kegiatanSama(dariTimesheet, { ...dariTimesheet, id: "lain", tanggalMulai: "2027-03-01", tanggalSelesai: "2027-03-10" })
);
const bulanLain = kg({ id: "bl", nama: JUDUL, tanggalMulai: "2027-02-01", tanggalSelesai: "2027-02-12", timesheetId: "s9" });
cek("judul sama tanpa batch tegas, periode berjauhan -> beda", !kegiatanSama(dariTimesheet, bulanLain));
cek("judul sama tanpa batch, periode beririsan -> sama", kegiatanSama(bulanLain, { ...bulanLain, id: "bl2", tanggalMulai: "2027-02-05", tanggalSelesai: "2027-02-15" }));
cek("cariKegiatanSama menemukan kegiatan timesheet dari judul ketikan", cariKegiatanSama([bulanLain, dariTimesheet], { ...placeholder, id: "baru" })?.id === "ts");
cek("kegiatan lain tidak tertukar", cariKegiatanSama([dariTimesheet], { ...placeholder, id: "x", nama: "Monev Lain Sama Sekali Berbeda Judulnya Contoh" }) === undefined);

console.log("Kaitan transaksi ke kegiatan");
const b4 = kg({ id: "b4", nama: `${JUDUL} (Batch 4)`, batch: 4, tanggalMulai: "2026-10-05", tanggalSelesai: "2026-10-20", timesheetId: "s4" });
const b5 = kg({ id: "b5", nama: `${JUDUL} (Batch 5)`, batch: 5, tanggalMulai: "2026-12-01", tanggalSelesai: "2026-12-15", timesheetId: "s5" });
cek("kaitan tanpa batch + tanggal di rentang batch 4", kegiatanDariKaitan([b4, b5], JUDUL, "2026-10-10")?.id === "b4");
cek("kaitan tanpa batch + tanggal di rentang batch 5", kegiatanDariKaitan([b4, b5], JUDUL, "2026-12-02")?.id === "b5");
cek("kaitan dengan batch tertulis dihormati", kegiatanDariKaitan([b4, b5], `${JUDUL} (Batch 5)`, "2026-10-10")?.id === "b5");
cek("tanggal di luar kedua rentang -> yang terdekat", kegiatanDariKaitan([b4, b5], JUDUL, "2026-11-25")?.id === "b5");
cek("kaitan tidak dikenal -> tidak ada", kegiatanDariKaitan([b4, b5], "Judul Lain Sama Sekali Tidak Terkait", "2026-10-10") === undefined);

console.log("Transaksi terhubung lewat judul yang beda tipis");
const sewa = trx({ id: "tr1", kaitan: JUDUL, kategori: "Konsumsi", tanggal: "2026-10-08" });
const dana = trx({ id: "tr2", jenis: "pemasukan", kategori: "Penerimaan Dana", kaitan: `${JUDUL} (Batch 4)`, tanggal: "2026-09-01" });
const milik = transaksiKegiatan([sewa, dana], b4, [b4, b5]).map((t) => t.id);
cek("kaitan tanpa batch ikut kegiatan Batch 4", milik.includes("tr1"), milik);
cek("penerimaan dengan '(Batch 4)' ikut kegiatan Batch 4", milik.includes("tr2"), milik);
cek("tidak ikut kegiatan Batch 5", !transaksiKegiatan([sewa, dana], b5, [b4, b5]).some((t) => t.id === "tr1"));

console.log("Penyatuan kegiatan kembar");
const danaPd = trx({ id: "td1", jenis: "pemasukan", kategori: "Penerimaan Dana", kegiatanId: "pd", kaitan: JUDUL, jumlah: 5000000, tanggal: "2026-09-01" });
const belanja = trx({ id: "td2", kaitan: JUDUL, kegiatanId: "pd", tanggal: "2026-10-07" });
const hasil = satukanKegiatanKembar([placeholder, dariTimesheet], [danaPd, belanja]);
cek("tersisa satu kegiatan", hasil.daftar.length === 1, hasil.daftar);
const induk = hasil.daftar[0];
cek("induk = kegiatan timesheet", induk?.id === "ts" && induk.timesheetId === "sheet1");
cek("rentang mengikuti timesheet, tidak melebar ke tanggal terima dana", induk?.tanggalMulai === "2026-10-05" && induk?.tanggalSelesai === "2026-10-20", induk);
cek("lokasi, batch, baris timesheet tidak hilang", induk?.lokasi === "Desa Contoh" && induk?.batch === 4 && induk?.timesheetBaris?.length === 1);
cek("dilebur mencatat pemetaan id", hasil.dilebur["pd"] === "ts");
cek("transaksi dialihkan ke induk", hasil.transaksi.every((t) => t.kegiatanId === "ts"));
cek("kaitan transaksi mengikuti judul induk", hasil.transaksi.every((t) => t.kaitan === induk.nama), hasil.transaksi.map((t) => t.kaitan));
cek("jumlah transaksi tidak berubah", hasil.transaksi.reduce((s, t) => s + t.jumlah, 0) === danaPd.jumlah + belanja.jumlah);
const danaAwalDiInduk = transaksiKegiatan(hasil.transaksi, induk, hasil.daftar).filter((t) => t.jenis === "pemasukan");
cek("penerimaan dana jadi dana awal kegiatan induk", danaAwalDiInduk.length === 1 && danaAwalDiInduk[0].jumlah === 5000000);

const tanpaKembar = satukanKegiatanKembar([dariTimesheet, b5], [sewa]);
cek("tanpa kembar: daftar dan transaksi dikembalikan apa adanya", tanpaKembar.daftar.length === 2 && tanpaKembar.transaksi[0] === sewa && Object.keys(tanpaKembar.dilebur).length === 0);

const tiga = satukanKegiatanKembar(
  [kg({ id: "a", nama: JUDUL.slice(0, 45), tanggalMulai: "2026-08-20", tanggalSelesai: "2026-08-20" }), placeholder, dariTimesheet],
  []
);
cek("tiga catatan (terpotong, placeholder, timesheet) jadi satu", tiga.daftar.length === 1 && tiga.daftar[0].id === "ts", tiga.daftar.map((k) => k.id));
cek("pemetaan dilebur selalu menunjuk induk terakhir (tanpa rantai)", Object.values(tiga.dilebur).every((id) => id === "ts") && Object.keys(tiga.dilebur).length === 2, tiga.dilebur);

const sama2 = satukanKegiatanKembar([placeholder, { ...placeholder, id: "pd2", tanggalMulai: "2026-09-03", tanggalSelesai: "2026-09-03", catatan: "uang muka kedua", urutanTransaksi: ["x"] }], []);
cek("dua placeholder: rentang digabung dan isian dilengkapi", sama2.daftar.length === 1 && sama2.daftar[0].tanggalMulai === "2026-09-01" && sama2.daftar[0].tanggalSelesai === "2026-09-03" && sama2.daftar[0].catatan === "uang muka kedua" && sama2.daftar[0].urutanTransaksi?.[0] === "x", sama2.daftar);

const manual = satukanKegiatanKembar([placeholder, kg({ id: "mn", nama: JUDUL, lokasi: "Hulu", tanggalMulai: "2026-10-05", tanggalSelesai: "2026-10-12" })], []);
cek("placeholder + kegiatan manual berlokasi: rentang dan lokasi kegiatan manual dipakai", manual.daftar.length === 1 && manual.daftar[0].id === "mn" && manual.daftar[0].lokasi === "Hulu" && manual.daftar[0].tanggalMulai === "2026-10-05" && manual.daftar[0].tanggalSelesai === "2026-10-12", manual.daftar);

const duaBatch = satukanKegiatanKembar([placeholder, b4, b5], []);
cek("placeholder dengan dua batch berjudul sama hanya melebur ke batch terdekat", duaBatch.daftar.length === 2 && duaBatch.dilebur["pd"] === "b4", duaBatch.dilebur);

const panjang = satukanKegiatanKembar([kg({ id: "p1", nama: JUDUL.slice(0, 45) }), kg({ id: "p2", nama: JUDUL, docxDriveId: "doc" })], []);
cek("judul terpotong digantikan judul lengkap", panjang.daftar.length === 1 && panjang.daftar[0].nama === JUDUL, panjang.daftar);

console.log("Gabung daftar kegiatan (Drive + perangkat) tanpa kehilangan");
const lokalSaja = kg({ id: "baruLokal", nama: "Kegiatan Hanya Di Perangkat Ini Untuk Uji Gabung", diubah: "2026-10-28T10:00:00Z" });
const jauhSaja = kg({ id: "baruJauh", nama: "Kegiatan Hanya Di Drive Untuk Uji Gabung Daftar", diubah: "2026-10-27T10:00:00Z" });
const sama = kg({ id: "s1", nama: "Kegiatan Bersama", lokasi: "", diubah: "2026-10-01T00:00:00Z" });
const samaJauh = { ...sama, lokasi: "Desa Hulu", catatan: "dari Drive", diubah: "2026-10-02T00:00:00Z" };
const g = gabungDaftarKegiatan([samaJauh, jauhSaja], [sama, lokalSaja]);
cek("kegiatan yang hanya ada di satu sisi tetap ada", g.some((k) => k.id === "baruLokal") && g.some((k) => k.id === "baruJauh") && g.length === 3);
cek("id sama: versi lebih baru dipakai dan tidak menghapus isian", g.find((k) => k.id === "s1")?.lokasi === "Desa Hulu" && g.find((k) => k.id === "s1")?.catatan === "dari Drive");
const lokalBaru = { ...sama, nama: "Kegiatan Bersama (diubah)", diubah: "2026-10-05T00:00:00Z" };
cek("id sama: perubahan lokal yang lebih baru menang, isian kosong dilengkapi dari Drive", (() => {
  const x = gabungDaftarKegiatan([samaJauh], [lokalBaru]).find((k) => k.id === "s1");
  return x?.nama === "Kegiatan Bersama (diubah)" && x?.lokasi === "Desa Hulu";
})());
cek("daftar jauh kosong tidak menghapus daftar lokal", gabungDaftarKegiatan([], [sama, lokalSaja]).length === 2);

if (gagal > 0) {
  console.log(`\n${gagal} pemeriksaan GAGAL`);
  process.exit(1);
}
console.log("\nSemua pemeriksaan lulus");
