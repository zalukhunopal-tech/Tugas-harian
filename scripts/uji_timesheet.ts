/**
 * Uji pustaka timesheet (src/lib/timesheet.ts). Jalankan: npx tsx scripts/uji_timesheet.ts
 * Data uji meniru file nyata "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4 (SEPTEMBER - OKTOBER 2026)", termasuk
 * tanggal 1-12 Oktober yang di Google Sheets berupa tanggal sungguhan berformat hari/bulan (tampil "10/1/2026").
 */
import { Transaksi } from "../src/types";
import {
  adalahFileTimesheet,
  barisPerdiemKegiatan,
  barisUntukSimpan,
  batchDariJudul,
  batchDariNama,
  cariCatatanMencurigakan,
  cariTransaksiNyasarTimesheet,
  adalahTimesheetCadangan,
  cocokkanFileTimesheet,
  rapikanSelTerpecah,
  formatTanggalTimesheet,
  judulUntukTimesheet,
  labelBulan,
  namaFileTimesheet,
  rentangMengikutiTimesheet,
  sarankanBatch,
  susunDaftarPerdiem,
  susunIsiTimesheet,
  tahunDariNama,
  uraikanIsiTimesheet,
  uraikanJumlahTimesheet,
  uraikanTanggalTimesheet,
} from "../src/lib/timesheet";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const NAMA_BATCH4 = "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4 (SEPTEMBER - OKTOBER 2026)";
const JUDUL = "Kegiatan Fasilitasi Penyelesaian Klaim Wilayah Contoh, Asesmen Kader Lokal, Penggalian Data Keruangan, dan Koordinasi Multipihak Tata Kelola Hutan di Provinsi Contoh (Batch 4)";

console.log("Nama file dan batch");
cek("file timesheet dikenali", adalahFileTimesheet(NAMA_BATCH4) && !adalahFileTimesheet("Keuangan Kegiatan 2026"));
cek("batch dari nama", batchDariNama(NAMA_BATCH4) === 4 && batchDariNama("Keuangan Kegiatan 2026") === undefined);
cek("tahun dari nama (tahun pertama = tahun mulai)", tahunDariNama(NAMA_BATCH4) === 2026 && tahunDariNama("TIMESHEET BATCH 2 (DESEMBER 2026 - JANUARI 2027)") === 2026);
cek("batch dari judul kegiatan", batchDariJudul(JUDUL) === 4 && batchDariJudul("Kegiatan tanpa batch") === undefined);
cek("label bulan lintas bulan", labelBulan("2026-09-20", "2026-10-23") === "September - Oktober 2026");
cek("label bulan satu bulan", labelBulan("2026-10-05", "2026-10-23") === "Oktober 2026");
cek("label bulan lintas tahun", labelBulan("2026-12-20", "2027-01-10") === "Desember 2026 - Januari 2027");
cek("nama file baru meniru file pengguna", namaFileTimesheet(4, "2026-09-20", "2026-10-23") === NAMA_BATCH4);
cek("nama file batch 1 tahun depan", namaFileTimesheet(1, "2027-02-02", "2027-02-20") === "FORM LAPORAN TIMESHEET KEGIATAN BATCH 1 (FEBRUARI 2027)");
cek("judul diberi (Batch N) bila belum ada", judulUntukTimesheet("Kegiatan A", 5) === "Kegiatan A (Batch 5)" && judulUntukTimesheet(JUDUL, 4) === JUDUL);

console.log("Saran batch");
const kg = (batch: number | undefined, mulai: string, nama = "K") => ({ batch, nama, timesheetNama: undefined, tanggalMulai: mulai });
cek("batch 4 ada tahun ini -> saran 5", sarankanBatch(2026, [kg(4, "2026-09-20")]) === 5);
cek("tahun depan -> saran 1", sarankanBatch(2027, [kg(4, "2026-09-20")]) === 1);
cek("tanpa kegiatan -> 1", sarankanBatch(2026, []) === 1);
cek("kegiatan lama tanpa batch dibaca dari judul", sarankanBatch(2026, [kg(undefined, "2026-03-01", "Judul (Batch 2)")]) === 3);
cek("melengkapi dari nama file di Drive", sarankanBatch(2026, [], [{ nama: NAMA_BATCH4 }, { nama: "FORM LAPORAN TIMESHEET KEGIATAN BATCH 3 (JUNI 2026)" }]) === 5);
const fileBatch4 = [{ nama: NAMA_BATCH4 }];
const rentang4 = { mulai: "2026-09-20", selesai: "2026-10-23" };
cek("kegiatan yang periodenya sudah punya file: batch file itu (4), bukan 1 atau 5", sarankanBatch(2026, [], fileBatch4, rentang4) === 4);
cek("batch file itu sudah dipakai kegiatan lain: batch berikutnya", sarankanBatch(2026, [kg(4, "2026-09-01")], fileBatch4, rentang4) === 5);
cek("periode lain (November): batch berikutnya", sarankanBatch(2026, [], fileBatch4, { mulai: "2026-11-10", selesai: "2026-11-12" }) === 5);
cek("tanpa rentang: perilaku lama", sarankanBatch(2026, [], fileBatch4) === 5);
cek("file tahun lain tidak dihitung", sarankanBatch(2027, [], [{ nama: NAMA_BATCH4 }]) === 1);

console.log("Pencocokan file");
const berkas = [
  { id: "a", nama: NAMA_BATCH4, modifiedTime: "2026-10-24T11:00:00Z" },
  { id: "b", nama: "FORM LAPORAN TIMESHEET KEGIATAN BATCH 3 (JUNI - JULI 2026)" },
  { id: "c", nama: "FORM LAPORAN TIMESHEET KEGIATAN BATCH 1 (FEBRUARI 2027)" },
  { id: "d", nama: "Keuangan Kegiatan 2026" },
];
const k4 = { batch: 4, nama: JUDUL, timesheetId: undefined, timesheetNama: undefined, tanggalMulai: "2026-09-20", tanggalSelesai: "2026-10-23" };
cek("cocok lewat batch dan tahun", cocokkanFileTimesheet(k4, berkas)?.id === "a");
cek("ID yang sudah dihubungkan diutamakan", cocokkanFileTimesheet({ ...k4, batch: 3, timesheetId: "a" }, berkas)?.id === "a");
cek("batch 1 tahun depan tidak tertukar dengan batch 1 tahun ini", cocokkanFileTimesheet({ ...k4, batch: 1, tanggalMulai: "2027-02-02", tanggalSelesai: "2027-02-20" }, berkas)?.id === "c");
cek("batch 5 belum punya file -> kosong", cocokkanFileTimesheet({ ...k4, batch: 5, tanggalMulai: "2026-11-10", tanggalSelesai: "2026-11-20" }, berkas) === undefined);
cek("tanpa batch: dari irisan periode bila unik", cocokkanFileTimesheet({ ...k4, batch: undefined, nama: "Kegiatan tanpa batch" }, berkas)?.id === "a");
cek("batch dibaca dari judul kegiatan", cocokkanFileTimesheet({ ...k4, batch: undefined }, berkas)?.id === "a");
const lintasTahun = [{ id: "z", nama: "FORM LAPORAN TIMESHEET KEGIATAN BATCH 6 (DESEMBER 2026 - JANUARI 2027)" }];
const kLintas = { ...k4, batch: 6, tanggalMulai: "2026-12-20", tanggalSelesai: "2027-01-10" };
cek("kegiatan lintas tahun cocok lewat batch dan tahun mulai", cocokkanFileTimesheet(kLintas, lintasTahun)?.id === "z");
cek("lintas tahun tanpa batch: cocok lewat irisan periode", cocokkanFileTimesheet({ ...kLintas, batch: undefined, nama: "Tanpa batch" }, lintasTahun)?.id === "z");
cek("periode lain tidak beririsan", cocokkanFileTimesheet({ ...kLintas, batch: undefined, nama: "Tanpa batch", tanggalMulai: "2027-03-01", tanggalSelesai: "2027-03-10" }, lintasTahun) === undefined);
cek("sheet keuangan tidak pernah dipilih", cocokkanFileTimesheet({ ...k4, batch: undefined, nama: "x", tanggalMulai: "2026-01-01", tanggalSelesai: "2026-01-05" }, [berkas[3]]) === undefined);

console.log("File cadangan dan unggahan Excel");
const NAMA_UTAMA = NAMA_BATCH4;
const dgnCadangan = [
  { id: "lama", nama: `${NAMA_UTAMA}_backup`, modifiedTime: "2026-10-29T01:35:27Z" },
  { id: "baru", nama: NAMA_UTAMA, modifiedTime: "2026-10-29T01:34:40Z" },
  { id: "xl", nama: `${NAMA_UTAMA}.xlsx`, modifiedTime: "2026-10-29T02:00:00Z" },
];
cek("nama cadangan dikenali", adalahTimesheetCadangan(`${NAMA_UTAMA}_backup`) && adalahTimesheetCadangan("Salinan dari FORM TIMESHEET") && adalahTimesheetCadangan("Copy of FORM TIMESHEET") && adalahTimesheetCadangan("x.xlsx") && !adalahTimesheetCadangan(NAMA_UTAMA));
cek("file utama didahulukan walau cadangan lebih baru diubah", cocokkanFileTimesheet(k4, dgnCadangan)?.id === "baru");
cek("file yang dihubungkan lalu diganti nama menjadi _backup: pindah ke file utama baru", cocokkanFileTimesheet({ ...k4, timesheetId: "lama" }, dgnCadangan)?.id === "baru");
cek("hanya ada cadangan: tetap dipakai", cocokkanFileTimesheet(k4, [dgnCadangan[0]])?.id === "lama" && cocokkanFileTimesheet({ ...k4, timesheetId: "lama" }, [dgnCadangan[0]])?.id === "lama");
cek("tanpa batch: cadangan tidak membuat irisan periode jadi ganda", cocokkanFileTimesheet({ ...k4, batch: undefined, nama: "Kegiatan tanpa batch" }, dgnCadangan)?.id === "baru");

console.log("Baris yang terpecah koma (ditulis alat lain lewat CSV)");
const pecah = rapikanSelTerpecah(["Perjalanan pulang menggunakan pesawat udara perintis\\", "mobil\\", "dan speedboat", "Tanjung Selor+200.000"]);
cek("keterangan disatukan kembali", pecah[0] === "Perjalanan pulang menggunakan pesawat udara perintis, mobil, dan speedboat", pecah);
cek("lokasi dan jumlah dipisah kembali", pecah[1] === "Tanjung Selor" && pecah[2] === "200.000", pecah);
cek("baris normal tidak berubah", rapikanSelTerpecah(["Survei batas", "Desa Contoh", "200.000", ""]).join("|") === "Survei batas|Desa Contoh|200.000");
cek("lokasi bertanda + tanpa angka tidak dipotong", rapikanSelTerpecah(["Rapat", "Desa A + Desa B", "200.000"]).join("|") === "Rapat|Desa A + Desa B|200.000");
const isiPecah = uraikanIsiTimesheet([
  ["No", "Tanggal", "Keterangan", "Lokasi", "Jumlah (Rp.)"],
  ["37", "10/26/2026", "Pengolahan data", "Desa Contoh", "200.000"],
  ["38", "10/27/2026", "Perjalanan kepulangan pesawat\\", "mobil\\", "dan speedboat", "Kota Contoh+200.000"],
  ["", "", "Total", "", "400.000"],
]);
cek("baris tanggal 27 yang terpecah tetap terbaca utuh", isiPecah.baris.length === 2 && isiPecah.baris[1].tanggal === "2026-10-27" && isiPecah.baris[1].keterangan === "Perjalanan kepulangan pesawat, mobil, dan speedboat" && isiPecah.baris[1].lokasi === "Kota Contoh" && isiPecah.baris[1].jumlah === 200000, isiPecah.baris[1]);

console.log("Tanggal dan jumlah");
cek("M/D/YYYY", uraikanTanggalTimesheet("9/20/2026") === "2026-09-20");
cek("tanggal oktober yang tampil 10/1/2026 dibaca 1 Oktober", uraikanTanggalTimesheet("10/1/2026") === "2026-10-01");
cek("angka pertama >12 berarti hari", uraikanTanggalTimesheet("20/9/2026") === "2026-09-20");
cek("rentang kegiatan memilih tafsiran yang masuk akal", uraikanTanggalTimesheet("10/5/2026", { mulai: "2026-05-01", selesai: "2026-05-30" }) === "2026-05-10" && uraikanTanggalTimesheet("10/5/2026") === "2026-10-05");
cek("tanggal tak sah -> null", uraikanTanggalTimesheet("13/13/2026") === null && uraikanTanggalTimesheet("") === null && uraikanTanggalTimesheet("Total") === null);
cek("format tampil", formatTanggalTimesheet("2026-10-01") === "10/1/2026" && formatTanggalTimesheet("2026-09-20") === "9/20/2026");
cek("jumlah titik ribuan", uraikanJumlahTimesheet("200.000") === 200000 && uraikanJumlahTimesheet("6.800.000") === 6800000);
cek("jumlah dengan Rp dan angka murni", uraikanJumlahTimesheet("Rp 200.000") === 200000 && uraikanJumlahTimesheet(200000) === 200000 && uraikanJumlahTimesheet("") === undefined);

console.log("Baca isi file pengguna");
const hari = (i: number) => {
  const d = new Date(Date.UTC(2026, 8, 20 + i));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
};
const baris34: string[][] = Array.from({ length: 34 }, (_, i) => [String(i + 1), hari(i), `Kegiatan hari ke-${i + 1}, bersama warga`, i === 0 ? "Kabupaten Contoh" : "Desa Contoh Satu", "200.000"]);
const nilaiNyata: string[][] = [
  [],
  ["", "", "Detail Keuangan"],
  ["", "", "Perdiem Kegiatan Lapangan"],
  [],
  ["Proyek", ": Proyek Contoh"],
  ["Judul Kegiatan", ": " + JUDUL],
  ["Nama", ": Budi Santoso"],
  ["Bulan", ": September - Oktober 2026"],
  [],
  ["No", "Tanggal", "Keterangan", "Lokasi", "Jumlah (Rp.)"],
  ...baris34,
  ["", "", "Total", "", "6.800.000"],
  [],
  ["", "Dilaporkan Oleh :", "", "Disetujui Oleh :"],
  [],
  [],
  [],
  ["", "Budi Santoso", "", "Sari Wulandari"],
];
// Baris nyata dari file pengguna (tanda baca, apostrof lengkung, dan tanggal 1 Oktober yang tampil "10/1/2026").
nilaiNyata[10 + 2] = ["3", "9/22/2026", "Analisis dokumen sejarah lokasi Dusun Contoh di Desa Contoh Satu dilanjutkan dengan diskusi batas desa Alfa, Beta, dan Pa’ Gamma di Desa Contoh Tiga dan Desa Contoh Satu", "Desa Contoh Satu", "200.000"];
nilaiNyata[10 + 11] = ["12", "10/1/2026", "Pengambilan titik koordinat referensi bentang alam, persawahan, batas wilayah, dan situs budaya di Desa Contoh Dua dan Desa Contoh Empat bersama aparat desa dan tetua adat", "Desa Contoh Dua", "200.000"];
const isi = uraikanIsiTimesheet(nilaiNyata, { mulai: "2026-09-20", selesai: "2026-10-23" });
cek("proyek, judul, nama, bulan", isi.proyek === "Proyek Contoh" && isi.judulKegiatan === JUDUL && isi.nama === "Budi Santoso" && isi.bulan === "September - Oktober 2026", isi);
cek("34 baris", isi.baris.length === 34, isi.baris.length);
cek("tanggal berurutan 20 Sep - 23 Okt 2026", isi.baris[0].tanggal === "2026-09-20" && isi.baris[11].tanggal === "2026-10-01" && isi.baris[33].tanggal === "2026-10-23", [isi.baris[0], isi.baris[11], isi.baris[33]]);
cek("keterangan dan lokasi terbaca", isi.baris[0].lokasi === "Kabupaten Contoh" && isi.baris[1].keterangan.startsWith("Kegiatan hari ke-2"));
cek("baris nyata: koma dan apostrof lengkung utuh, 10/1/2026 = 1 Oktober", isi.baris[2].keterangan.includes("Alfa, Beta, dan Pa’ Gamma") && isi.baris[2].lokasi === "Desa Contoh Satu" && isi.baris[11].tanggal === "2026-10-01" && isi.baris[11].lokasi === "Desa Contoh Dua");
cek("jumlah dan total", isi.baris.every((b) => b.jumlah === 200000) && isi.total === 6800000);
cek("tanda tangan", isi.dilaporkanOleh === "Budi Santoso" && isi.disetujuiOleh === "Sari Wulandari", isi);
cek("salinan simpan tanpa jumlah", barisUntukSimpan(isi.baris).every((b) => b.jumlah === undefined && b.keterangan !== ""));
cek("sheet kosong tidak membuat galat", uraikanIsiTimesheet([]).baris.length === 0 && uraikanIsiTimesheet([["acak"]]).baris.length === 0);

console.log("Bangun isi file baru");
const baru = susunIsiTimesheet({
  proyek: "Proyek Contoh",
  judulKegiatan: "Kegiatan Baru (Batch 5)",
  nama: "Budi Santoso",
  mulai: "2026-11-10",
  selesai: "2026-11-12",
  baris: [
    { tanggal: "2026-11-11", keterangan: "Hari kedua", lokasi: "Desa B", jumlah: 200000 },
    { tanggal: "2026-11-10", keterangan: "Hari pertama", lokasi: "Desa A", jumlah: 200000 },
    { tanggal: "2026-11-12", keterangan: "", lokasi: "", jumlah: 200000 },
  ],
  disetujuiOleh: "Sari Wulandari",
});
cek("data mulai baris 11, urut tanggal", baru.nilai[10][0] === 1 && baru.nilai[10][2] === "Hari pertama" && baru.nilai[11][2] === "Hari kedua");
cek("tanggal ditulis sebagai teks dengan apostrof", baru.nilai[10][1] === "'11/10/2026", baru.nilai[10]);
cek("total di baris 45 dengan rumus", baru.barisTotal === 45 && baru.nilai[44][4] === "=SUM(E11:E44)" && baru.nilai[44][2] === "Total", baru.nilai[44]);
cek("tanda tangan di bawah total", baru.nilai[46][1] === "Dilaporkan Oleh :" && baru.nilai[46][3] === "Disetujui Oleh :" && baru.nilai[50][1] === "Budi Santoso" && baru.nilai[50][3] === "Sari Wulandari", baru.nilai[50]);
cek("bulan pada kop", baru.nilai[7][1] === ": November 2026");
cek("dibaca balik sama", (() => {
  const balik = uraikanIsiTimesheet(baru.nilai.map((b) => b.map((v) => String(v).replace(/^'/, "").replace(/^=.*/, ""))), { mulai: "2026-11-10", selesai: "2026-11-12" });
  return balik.baris.length === 3 && balik.baris[0].tanggal === "2026-11-10" && balik.baris[0].keterangan === "Hari pertama" && balik.disetujuiOleh === "Sari Wulandari";
})());
const banyak = susunIsiTimesheet({
  proyek: "P", judulKegiatan: "J", nama: "N", mulai: "2026-01-01", selesai: "2026-02-15",
  baris: Array.from({ length: 40 }, (_, i) => ({ tanggal: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), keterangan: "x", lokasi: "y", jumlah: 1 })),
  disetujuiOleh: "",
});
cek("lebih dari 34 hari: total turun, rumus mencakup semua baris", banyak.barisTotal === 51 && banyak.nilai[50][4] === "=SUM(E11:E50)", banyak.nilai[50]);

console.log("Baris perdiem dengan keterangan");
let n = 0;
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: `t${++n}`, jenis: "pengeluaran", dana: "Dana Kegiatan", tanggal: "2026-09-20", deskripsi: "Perdiem", kategori: "Perdiem",
  jumlah: 200000, metode: "Tunai", kaitan: "", catatan: "", ...o,
});
const tsBaris = [
  { tanggal: "2026-09-20", keterangan: "Perjalanan ke Kota Tujuan", lokasi: "Kabupaten Contoh" },
  { tanggal: "2026-09-22", keterangan: "Analisis dokumen", lokasi: "Desa Contoh Satu" },
];
const perdiem = barisPerdiemKegiatan(
  [trx({}), trx({ tanggal: "2026-09-21" }), trx({ tanggal: "2026-09-22" }), trx({ kategori: "Konsumsi", tanggal: "2026-09-23" }), trx({ jenis: "pemasukan", tanggal: "2026-09-24" })],
  tsBaris
);
cek("hanya perdiem Dana Kegiatan", perdiem.length === 3 && perdiem.map((b) => b.tanggal).join() === "2026-09-20,2026-09-21,2026-09-22", perdiem);
cek("keterangan dan lokasi dari timesheet, jumlah dari transaksi", perdiem[0].keterangan === "Perjalanan ke Kota Tujuan" && perdiem[0].jumlah === 200000 && perdiem[2].lokasi === "Desa Contoh Satu");
cek("hari tanpa baris di timesheet tetap muncul dengan keterangan kosong", perdiem[1].keterangan === "" && perdiem[1].jumlah === 200000);

console.log("Timesheet sebagai sumber kebenaran tanggal, keterangan, dan lokasi");
const hariTs = (tanggal: string, keterangan: string, lokasi = "Desa Contoh") => ({ tanggal, keterangan, lokasi });
const timesheetLima = [
  hariTs("2026-09-20", "Hari satu"),
  hariTs("2026-09-21", "Hari dua"),
  hariTs("2026-09-22", "Hari tiga"),
  hariTs("2026-09-23", "Hari empat"),
  hariTs("2026-09-24", "Hari lima"),
];
const hanyaDua = barisPerdiemKegiatan([trx({}), trx({ tanggal: "2026-09-22" })], timesheetLima);
cek("hari timesheet tanpa transaksi perdiem tetap muncul", hanyaDua.map((b) => b.tanggal).join() === "2026-09-20,2026-09-21,2026-09-22,2026-09-23,2026-09-24", hanyaDua.map((b) => b.tanggal));
cek("hari tanpa transaksi: keterangan dan lokasi dari timesheet, jumlah 0", hanyaDua[3].keterangan === "Hari empat" && hanyaDua[3].lokasi === "Desa Contoh" && hanyaDua[3].jumlah === 0, hanyaDua[3]);
cek("total tetap sama dengan perdiem tercatat (nominal tidak hilang)", hanyaDua.reduce((s, b) => s + (b.jumlah ?? 0), 0) === 400000);
cek("tanpa transaksi sama sekali: seluruh hari timesheet muncul", barisPerdiemKegiatan([], timesheetLima).length === 5);

const gabungan = trx({ tanggal: "2026-09-20", jumlah: 1000000, detailKegiatan: { perdiem: { jumlahHari: 5, tarifPerHari: 200000 } } });
const dariGabungan = barisPerdiemKegiatan([gabungan], timesheetLima);
cek("perdiem gabungan dibagi ke lima hari timesheet", dariGabungan.length === 5 && dariGabungan.every((b) => b.jumlah === 200000), dariGabungan.map((b) => b.jumlah));
cek("keterangan tiap hari ikut tampil", dariGabungan[2].keterangan === "Hari tiga");
cek("total perdiem gabungan tidak berubah", dariGabungan.reduce((s, b) => s + (b.jumlah ?? 0), 0) === 1000000);
const timesheetKurang = timesheetLima.slice(0, 3);
const gabunganKurang = barisPerdiemKegiatan([gabungan], timesheetKurang);
cek("timesheet kurang dari jumlah hari: nominal tetap utuh satu baris, tidak ditebak", gabunganKurang.length === 3 && gabunganKurang[0].jumlah === 1000000 && gabunganKurang[1].jumlah === 0, gabunganKurang.map((b) => b.jumlah));
const gabunganSebagian = barisPerdiemKegiatan([trx({ tanggal: "2026-09-22", jumlah: 400000, detailKegiatan: { perdiem: { jumlahHari: 2, tarifPerHari: 200000 } } })], timesheetLima);
cek("perdiem gabungan mulai di tengah: dibagi mulai tanggalnya", gabunganSebagian.map((b) => b.jumlah).join() === "0,0,200000,200000,0", gabunganSebagian.map((b) => b.jumlah));
cek("gabungan tanpa timesheet: tetap satu baris", barisPerdiemKegiatan([gabungan], []).length === 1);

cek("daftar dokumen: hari timesheet tanpa transaksi ikut, total dari transaksi", (() => {
  const d = susunDaftarPerdiem([trx({}), trx({ tanggal: "2026-09-21" })], { nama: "K", batch: 1, timesheetNama: undefined, timesheetBaris: timesheetLima }, { nama: "N", proyek: "P" });
  return d?.baris.length === 5 && d.total === 400000 && d.baris[4].keterangan === "Hari lima" && d.baris[4].jumlah === 0 && d.hariBerketerangan === 5;
})());
cek("tanpa transaksi perdiem sama sekali, lembar tidak dibuat walau timesheet ada", susunDaftarPerdiem([trx({ kategori: "Konsumsi" })], { nama: "K", batch: 1, timesheetNama: undefined, timesheetBaris: timesheetLima }, { nama: "N", proyek: "P" }) === null);

const rentangAwal = { tanggalMulai: "2026-09-20", tanggalSelesai: "2026-10-24" };
cek("rentang melebar bila timesheet memuat hari sesudah tanggal selesai", rentangMengikutiTimesheet(rentangAwal, [hariTs("2026-10-25", "x"), hariTs("2026-10-26", "y")]).tanggalSelesai === "2026-10-26");
cek("rentang melebar bila timesheet memuat hari sebelum tanggal mulai", rentangMengikutiTimesheet(rentangAwal, [hariTs("2026-09-18", "x")]).tanggalMulai === "2026-09-18");
cek("rentang tidak pernah menyempit", (() => { const r = rentangMengikutiTimesheet(rentangAwal, [hariTs("2026-10-01", "x")]); return r.tanggalMulai === "2026-09-20" && r.tanggalSelesai === "2026-10-24"; })());
cek("tanggal salah ketik (tahun jauh) diabaikan", (() => { const r = rentangMengikutiTimesheet(rentangAwal, [hariTs("2062-10-25", "x"), hariTs("2025-10-25", "y")]); return r.tanggalMulai === "2026-09-20" && r.tanggalSelesai === "2026-10-24"; })());
cek("tanpa baris: rentang sama", rentangMengikutiTimesheet(rentangAwal, []).tanggalSelesai === "2026-10-24");

console.log("Daftar perdiem untuk dokumen");
const daftar = susunDaftarPerdiem(
  [trx({}), trx({ tanggal: "2026-09-21" }), trx({ tanggal: "2026-10-01" })],
  { nama: JUDUL, batch: undefined, timesheetNama: NAMA_BATCH4, timesheetBaris: [{ tanggal: "2026-10-01", keterangan: "Pengambilan titik koordinat", lokasi: "Desa Contoh Dua" }] },
  { nama: "Budi Santoso", proyek: "Proyek Contoh", penyetuju: "Sari Wulandari" }
);
cek("kop sama dengan file timesheet", daftar?.proyek === "Proyek Contoh" && daftar.judulKegiatan === JUDUL && daftar.bulan === "September - Oktober 2026" && daftar.nama === "Budi Santoso", daftar);
cek("tanggal gaya timesheet, nomor urut, total", daftar?.baris.map((b) => b.tanggal).join() === "9/20/2026,9/21/2026,10/1/2026" && daftar.baris[2].no === 3 && daftar.total === 600000, daftar?.baris);
cek("keterangan dan lokasi dari timesheet", daftar?.baris[2].keterangan === "Pengambilan titik koordinat" && daftar.baris[2].lokasi === "Desa Contoh Dua" && daftar.baris[0].keterangan === "");
cek("hari berketerangan dan penyetuju", daftar?.hariBerketerangan === 1 && daftar.disetujuiOleh === "Sari Wulandari" && daftar.dilaporkanOleh === "Budi Santoso");
cek("tanpa perdiem -> null", susunDaftarPerdiem([trx({ kategori: "Konsumsi" })], { nama: "K", batch: 1, timesheetNama: undefined, timesheetBaris: [] }, { nama: "N", proyek: "P" }) === null);

console.log("Pembersihan transaksi nyasar dari file timesheet");
const nyasar = (o: Partial<Transaksi>) => trx({ jenis: "pemasukan", kategori: "Lain-lain", ...o });
const daftarTs = [{ timesheetBaris: [{ tanggal: "2026-09-20", keterangan: "Perjalanan dari Kota Asal menuju Kabupaten Contoh melalui jalur darat", lokasi: "Kabupaten Contoh" }] }];
const semuaTrx = [
  nyasar({ id: "j1", deskripsi: "Total", jumlah: 6800000 }),
  nyasar({ id: "j2", deskripsi: "Total", jumlah: 6800000 }),
  nyasar({ id: "j3", deskripsi: "Perjalanan dari Kota Asal menuju Kabupaten Contoh melalui jalur darat", jumlah: 200000, kategori: "Kabupaten Contoh" }),
  nyasar({ id: "s1", deskripsi: "Penerimaan Dana Awal Kegiatan", kategori: "Penerimaan Dana", jumlah: 25000000 }),
  nyasar({ id: "s2", deskripsi: "Total", kegiatanId: "kg4" }),
  nyasar({ id: "s3", deskripsi: "Total", catatan: "dicatat sendiri" }),
  trx({ id: "s4", deskripsi: "Total", dana: "Dana Pribadi", jenis: "pemasukan" }),
  trx({ id: "s5", deskripsi: "Total", jenis: "pengeluaran" }),
  trx({ id: "s6", deskripsi: "Perdiem Kalimantan · 20 Sep 2026" }),
];
const dibuang = cariTransaksiNyasarTimesheet(semuaTrx, daftarTs).map((t) => t.id).join();
cek("baris Total dan baris hari dari timesheet dikenali", dibuang === "j1,j2,j3", dibuang);
cek("transaksi sungguhan tidak tersentuh (dana awal, ada kegiatan/catatan, pribadi, pengeluaran, perdiem)", !/s\d/.test(dibuang));
cek("tanpa timesheet tersalin, hanya baris Total yang dikenali", cariTransaksiNyasarTimesheet(semuaTrx, []).map((t) => t.id).join() === "j1,j2");
cek(
  "keterangan dari file timesheet di Drive juga dikenali (kegiatan belum dicocokkan)",
  cariTransaksiNyasarTimesheet(semuaTrx, [], ["Perjalanan dari Kota Asal menuju Kabupaten Contoh melalui jalur darat"]).map((t) => t.id).join() === "j1,j2,j3"
);

console.log("Catatan mencurigakan (konfirmasi pengguna)");
const mencurigakan = cariCatatanMencurigakan([
  nyasar({ id: "m1", deskripsi: "Teks tak dikenal", kategori: "Desa Ba' Liku", jumlah: 200000 }),
  nyasar({ id: "m2", deskripsi: "Total", jumlah: 6800000 }),
  nyasar({ id: "ok1", deskripsi: "Penerimaan Dana Awal Kegiatan", kategori: "Penerimaan Dana", jumlah: 25000000 }),
  nyasar({ id: "ok2", deskripsi: "Pindah", kategori: "Pindah Dana" }),
  nyasar({ id: "ok3", deskripsi: "Ada kegiatan", kategori: "Desa X", kegiatanId: "kg4" }),
  nyasar({ id: "ok4", deskripsi: "Ada catatan", kategori: "Desa X", catatan: "dicatat sendiri" }),
  trx({ id: "ok5", deskripsi: "Pengeluaran biasa", kategori: "Konsumsi" }),
  trx({ id: "ok6", deskripsi: "Pribadi", dana: "Dana Pribadi", jenis: "pemasukan", kategori: "Pemasukan Gaji" }),
]).map((t) => t.id).join();
cek("hanya pemasukan Dana Kegiatan polos berkategori tidak resmi yang ditandai", mencurigakan === "m1,m2", mencurigakan);

if (gagal) {
  console.log(`\n${gagal} uji gagal`);
  process.exit(1);
}
console.log("\nSemua uji lolos");
