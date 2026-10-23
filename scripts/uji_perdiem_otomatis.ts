/**
 * Uji logika perdiem otomatis (src/lib/perdiemOtomatis.ts). Jalankan: npx tsx scripts/uji_perdiem_otomatis.ts
 * Keluar dengan kode 1 bila ada yang gagal.
 */
import { Transaksi } from "../src/types";
import {
  adalahPemasukanPerdiemOtomatis,
  adalahPerdiemKegiatan,
  buatPemasukanPribadiDariPerdiem,
  cariPasanganPerdiem,
  daftarTanggalRentang,
  hitungRentangPerdiem,
  idPemasukanPribadi,
  labelRentangPerdiem,
  pesanHapusPerdiem,
  PerdiemRentang,
  rencanakanPerdiemRentang,
  tanggalPendek,
  tanggalSudahAdaPerdiem,
  UnsurTransaksiPerdiem,
} from "../src/lib/perdiemOtomatis";
import { hitungPenyelesaian } from "../src/lib/penyelesaianDana";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) {
    console.log(`  ok   ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

let nomor = 0;
function transaksiKegiatan(u: UnsurTransaksiPerdiem, kegiatanId = "kg1"): Transaksi {
  nomor++;
  return {
    id: `t${nomor}`,
    jenis: "pengeluaran",
    dana: "Dana Kegiatan",
    tanggal: u.tanggal,
    deskripsi: "Perdiem lapangan",
    kategori: "Perdiem",
    jumlah: u.jumlah,
    metode: "Tunai",
    kaitan: "Kegiatan A",
    catatan: "",
    kegiatanId,
    detailKegiatan: { perdiem: { jumlahHari: u.hari, tarifPerHari: u.jumlah / u.hari, keterangan: u.labelRentang } },
    diubah: "2026-10-01T00:00:00.000Z",
    bukti: [],
  };
}

const rentang = (mulai: string, selesai: string, o: Partial<PerdiemRentang> = {}): PerdiemRentang => ({
  aktif: true,
  mulai,
  selesai,
  satuPerHari: true,
  kecuali: [],
  ...o,
});

console.log("Rentang tanggal");
{
  const r = daftarTanggalRentang("2026-09-20", "2026-10-28");
  cek("20 Sep - 28 Okt 2026 = 39 hari", r.tanggal.length === 39, r.tanggal.length);
  cek("awal dan akhir benar", r.tanggal[0] === "2026-09-20" && r.tanggal[38] === "2026-10-28");
  cek("melewati pergantian bulan tanpa celah/ganda", new Set(r.tanggal).size === 39 && r.tanggal[10] === "2026-09-30" && r.tanggal[11] === "2026-10-01");
  cek("satu hari", daftarTanggalRentang("2026-09-20", "2026-09-20").tanggal.length === 1);
  cek("selesai sebelum mulai ditolak", Boolean(daftarTanggalRentang("2026-09-21", "2026-09-20").galat));
  cek("tanggal kosong ditolak", Boolean(daftarTanggalRentang("", "2026-09-20").galat));
  cek("tanggal tidak ada (30 Feb) ditolak", Boolean(daftarTanggalRentang("2026-02-30", "2026-03-05").galat));
  cek("melewati tahun kabisat 2028", daftarTanggalRentang("2028-02-28", "2028-03-01").tanggal.length === 3);
  cek("batas 366 hari", daftarTanggalRentang("2026-01-01", "2026-12-31").tanggal.length === 365);
  cek("lebih dari 366 hari ditolak", Boolean(daftarTanggalRentang("2026-01-01", "2027-12-31").galat));
}

console.log("Hitungan");
{
  const h = hitungRentangPerdiem(rentang("2026-09-20", "2026-10-28"), 250000);
  cek("39 hari x 250.000 = 9.750.000", h.hari === 39 && h.total === 9_750_000, h);
  const k = hitungRentangPerdiem(rentang("2026-09-20", "2026-09-24", { kecuali: ["2026-09-22", "2026-09-23", "2030-01-01"] }), 100000);
  cek("pengecualian dikurangi; tanggal di luar rentang diabaikan", k.hari === 3 && k.total === 300000, k);
  cek("tarif 0 -> total 0", hitungRentangPerdiem(rentang("2026-09-20", "2026-09-24"), 0).total === 0);
}

console.log("Label");
{
  cek("tanggalPendek", tanggalPendek("2026-09-20") === "20 Sep 2026");
  cek("label rentang", labelRentangPerdiem("2026-09-20", "2026-10-28") === "20 Sep 2026 – 28 Okt 2026");
  cek("label satu hari", labelRentangPerdiem("2026-09-20", "2026-09-20") === "20 Sep 2026");
  cek("label dengan pengecualian", labelRentangPerdiem("2026-09-20", "2026-10-28", 3).endsWith("tanpa 3 hari"));
}

console.log("Rencana: satu transaksi per hari + pemasukan pribadi");
{
  const rencana = rencanakanPerdiemRentang({
    rentang: rentang("2026-09-20", "2026-10-28"),
    tarifPerHari: 250000,
    catatPribadi: true,
    buat: (u) => transaksiKegiatan(u),
  });
  cek("tidak ada galat", !rencana.galat, rencana.galat);
  cek("39 transaksi kegiatan", rencana.kegiatan.length === 39, rencana.kegiatan.length);
  cek("78 transaksi seluruhnya (39 pasang)", rencana.semua.length === 78, rencana.semua.length);
  cek("total 9.750.000", rencana.total === 9_750_000 && rencana.hari === 39, rencana);
  const pribadi = rencana.semua.filter((t) => t.dana === "Dana Pribadi");
  cek("semua pasangan = pemasukan Dana Pribadi kategori Perdiem", pribadi.length === 39 && pribadi.every((t) => t.jenis === "pemasukan" && t.kategori === "Perdiem"));
  cek("jumlah pribadi = jumlah kegiatan", pribadi.reduce((n, t) => n + t.jumlah, 0) === 9_750_000);
  cek("id unik", new Set(rencana.semua.map((t) => t.id)).size === 78);
  cek("pasangan lewat id", rencana.kegiatan.every((k) => cariPasanganPerdiem(k, rencana.semua)?.id === idPemasukanPribadi(k.id)));
  cek("pasangan dari sisi pribadi", pribadi.every((p) => cariPasanganPerdiem(p, rencana.semua) && adalahPerdiemKegiatan(cariPasanganPerdiem(p, rencana.semua)!)));
  cek("pribadi tanpa kegiatanId & tanpa lampiran", pribadi.every((p) => !p.kegiatanId && (p.bukti || []).length === 0));
  cek("tanggal pasangan sama", rencana.kegiatan.every((k) => rencana.semua.find((t) => t.id === idPemasukanPribadi(k.id))?.tanggal === k.tanggal));
  cek("pemasukan pribadi dikenali otomatis", pribadi.every(adalahPemasukanPerdiemOtomatis));
  cek("catatan pribadi menandai otomatis", pribadi.every((p) => p.catatan?.startsWith("Otomatis dari perdiem")));
  const ringkas = hitungPenyelesaian(rencana.semua);
  cek("pemasukan pribadi tidak ikut penyelesaian Dana Kegiatan", ringkas.totalPerdiem === 9_750_000 && ringkas.danaAwal === 0 && ringkas.jumlahTransaksi === 39, ringkas);
}

console.log("Rencana: tanpa catat pribadi");
{
  const rencana = rencanakanPerdiemRentang({
    rentang: rentang("2026-09-20", "2026-09-22"),
    tarifPerHari: 100000,
    catatPribadi: false,
    buat: (u) => transaksiKegiatan(u),
  });
  cek("hanya transaksi kegiatan", rencana.semua.length === 3 && rencana.semua.every((t) => t.dana === "Dana Kegiatan"));
}

console.log("Rencana: gabungan");
{
  const rencana = rencanakanPerdiemRentang({
    rentang: rentang("2026-09-20", "2026-10-28", { satuPerHari: false, kecuali: ["2026-09-20"] }),
    tarifPerHari: 250000,
    catatPribadi: true,
    buat: (u) => transaksiKegiatan(u),
  });
  cek("satu transaksi kegiatan + satu pribadi", rencana.kegiatan.length === 1 && rencana.semua.length === 2, rencana.semua.length);
  cek("38 hari (satu dikecualikan) x 250.000", rencana.total === 9_500_000 && rencana.hari === 38, rencana);
  cek("tanggal = hari pertama yang dipakai", rencana.kegiatan[0].tanggal === "2026-09-21");
  cek("rincian perdiem membawa 38 hari", rencana.kegiatan[0].detailKegiatan?.perdiem?.jumlahHari === 38);
  cek("label rentang diteruskan", rencana.kegiatan[0].detailKegiatan?.perdiem?.keterangan === "20 Sep 2026 – 28 Okt 2026, tanpa 1 hari");
}

console.log("Rencana: tanggal sudah ada dilewati");
{
  const ada = [
    transaksiKegiatan({ tanggal: "2026-09-21", hari: 1, jumlah: 100000, urutan: 0 }, "kg1"),
    transaksiKegiatan({ tanggal: "2026-09-22", hari: 1, jumlah: 100000, urutan: 0 }, "kg2"), // kegiatan lain
  ];
  const sudahAda = tanggalSudahAdaPerdiem(ada, "kg1", daftarTanggalRentang("2026-09-20", "2026-09-23").tanggal);
  cek("hanya perdiem kegiatan yang sama dihitung ganda", sudahAda.size === 1 && sudahAda.has("2026-09-21"), [...sudahAda]);
  const rencana = rencanakanPerdiemRentang({
    rentang: rentang("2026-09-20", "2026-09-23"),
    tarifPerHari: 100000,
    catatPribadi: true,
    sudahAda,
    buat: (u) => transaksiKegiatan(u),
  });
  cek("3 dibuat, 1 dilewati", rencana.kegiatan.length === 3 && rencana.dilewati.length === 1 && rencana.dilewati[0] === "2026-09-21");
  cek("perdiem yang sedang diubah tidak dihitung ganda dengan dirinya", tanggalSudahAdaPerdiem(ada, "kg1", ["2026-09-21"], ada[0].id).size === 0);
  const semuaDilewati = rencanakanPerdiemRentang({
    rentang: rentang("2026-09-21", "2026-09-21"),
    tarifPerHari: 100000,
    catatPribadi: true,
    sudahAda: new Set(["2026-09-21"]),
    buat: (u) => transaksiKegiatan(u),
  });
  cek("semua dilewati -> galat yang jelas", Boolean(semuaDilewati.galat) && semuaDilewati.semua.length === 0, semuaDilewati.galat);
}

console.log("Rencana: masukan buruk");
{
  const buat = (u: UnsurTransaksiPerdiem) => transaksiKegiatan(u);
  cek("tarif 0 ditolak", Boolean(rencanakanPerdiemRentang({ rentang: rentang("2026-09-20", "2026-09-22"), tarifPerHari: 0, catatPribadi: true, buat }).galat));
  cek("rentang terbalik ditolak", Boolean(rencanakanPerdiemRentang({ rentang: rentang("2026-09-22", "2026-09-20"), tarifPerHari: 1000, catatPribadi: true, buat }).galat));
  cek("semua hari dikecualikan ditolak", Boolean(rencanakanPerdiemRentang({ rentang: rentang("2026-09-20", "2026-09-21", { kecuali: ["2026-09-20", "2026-09-21"] }), tarifPerHari: 1000, catatPribadi: true, buat }).galat));
  cek("tarif pecahan dibulatkan", rencanakanPerdiemRentang({ rentang: rentang("2026-09-20", "2026-09-21"), tarifPerHari: 1000.6, catatPribadi: false, buat }).total === 2002);
}

console.log("Pasangan dan pesan hapus");
{
  const k = transaksiKegiatan({ tanggal: "2026-09-20", hari: 1, jumlah: 200000, urutan: 0 });
  const p = buatPemasukanPribadiDariPerdiem(k);
  const daftar = [k, p];
  cek("kegiatan -> pribadi", cariPasanganPerdiem(k, daftar)?.id === p.id);
  cek("pribadi -> kegiatan", cariPasanganPerdiem(p, daftar)?.id === k.id);
  cek("tanpa pasangan di daftar -> undefined", cariPasanganPerdiem(k, [k]) === undefined && cariPasanganPerdiem(p, [p]) === undefined);
  cek("pesan hapus dari kegiatan menyebut Dana Pribadi", pesanHapusPerdiem(k, daftar)?.includes("Dana Pribadi") === true);
  cek("pesan hapus dari pribadi menyebut Dana Kegiatan", pesanHapusPerdiem(p, daftar)?.includes("Dana Kegiatan") === true);
  cek("tanpa pasangan -> pesan bawaan (null)", pesanHapusPerdiem(k, [k]) === null);
  const lain: Transaksi = { ...k, id: "x", kategori: "Konsumsi" };
  cek("pengeluaran kegiatan non-perdiem bukan perdiem", !adalahPerdiemKegiatan(lain));
  const pribadiBiasa: Transaksi = { ...p, id: "gaji" };
  cek("pemasukan pribadi biasa bukan otomatis", !adalahPemasukanPerdiemOtomatis(pribadiBiasa));
  const catatanKegiatan = buatPemasukanPribadiDariPerdiem({ ...k, catatan: "Hari lapangan" });
  cek("catatan kegiatan ikut terbawa", catatanKegiatan.catatan === "Otomatis dari perdiem Dana Kegiatan. Hari lapangan");
}

console.log("Id pasangan dan daftar id terhapus");
{
  cek("id dasar", idPemasukanPribadi("abc") === "abc~pribadi");
  cek("id dasar dilewati bila pernah dihapus", idPemasukanPribadi("abc", new Set(["abc~pribadi"])) === "abc~pribadi2");
  cek("dilewati berulang", idPemasukanPribadi("abc", new Set(["abc~pribadi", "abc~pribadi2"])) === "abc~pribadi3");
  cek("id lain yang terhapus tidak memengaruhi", idPemasukanPribadi("abc", new Set(["xyz~pribadi"])) === "abc~pribadi");
  const k = transaksiKegiatan({ tanggal: "2026-09-20", hari: 1, jumlah: 200000, urutan: 0 });
  const baru = buatPemasukanPribadiDariPerdiem(k, idPemasukanPribadi(k.id, new Set([k.id + "~pribadi"])));
  cek("pasangan ber-id ~pribadi2 tetap dikenali dari dua sisi", cariPasanganPerdiem(k, [k, baru])?.id === baru.id && cariPasanganPerdiem(baru, [k, baru])?.id === k.id);
  const mirip: Transaksi = { ...k, id: k.id + "x" };
  cek("id yang hanya berawalan sama bukan pasangan", cariPasanganPerdiem(k, [k, { ...baru, id: mirip.id + "~pribadi" }]) === undefined);
}

if (gagal > 0) {
  console.log(`\n${gagal} pengujian GAGAL`);
  process.exit(1);
}
console.log("\nSemua pengujian lolos");
