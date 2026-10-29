/**
 * Uji kelengkapan informasi per kategori pengeluaran (src/lib/kelengkapanKategori.ts): baris "Diklaim untuk", rute, kendaraan,
 * penginapan, penyedia, honorarium, dan seterusnya, serta uraian penerimaan dana yang tidak mengulang judul kegiatan.
 * Jalankan: npx tsx scripts/uji_kelengkapan_kategori.ts
 */
import { Transaksi } from "../src/types";
import { barisDiklaimUntuk, barisKelengkapan, barisKepalaBukti, barisRincianLengkap, namaDiklaim, uraianTampil } from "../src/lib/kelengkapanKategori";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const PELAPOR = "Pelapor Contoh";
let urut = 0;
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: `t${++urut}`,
  jenis: "pengeluaran",
  dana: "Dana Kegiatan",
  tanggal: "2026-09-21",
  deskripsi: "Pengeluaran contoh",
  kategori: "Konsumsi",
  jumlah: 100000,
  metode: "Tunai",
  kaitan: "",
  catatan: "",
  ...o,
});
const semua = (t: Transaksi) => barisKelengkapan(t).join("\n");
const ada = (t: Transaksi, ...potong: Array<string | RegExp>) =>
  potong.every((p) => (typeof p === "string" ? semua(t).includes(p) : p.test(semua(t))));

console.log("Daftar nama yang diklaim");
cek("pelapor saja bila tanpa rekan", barisDiklaimUntuk(trx({ kategori: "Transportasi" }), PELAPOR) === `Diklaim untuk: ${PELAPOR}`);
cek(
  "pelapor lalu rekan numpang klaim",
  barisDiklaimUntuk(trx({ kategori: "Akomodasi", detailKegiatan: { penerimaManfaat: ["Rekan Satu", "Rekan Dua"] } }), PELAPOR) === `Diklaim untuk: ${PELAPOR}, Rekan Satu, Rekan Dua`
);
cek(
  "nama pelapor yang ikut tertulis di daftar rekan tidak ganda (huruf besar/kecil diabaikan)",
  namaDiklaim(trx({ kategori: "Konsumsi", detailKegiatan: { penerimaManfaat: ["pelapor contoh", "Rekan Satu"] } }), PELAPOR).join("|") === `${PELAPOR}|Rekan Satu`
);
cek("tanpa nama pelapor: hanya rekan", barisDiklaimUntuk(trx({ kategori: "Transportasi", detailKegiatan: { penerimaManfaat: ["Rekan Satu"] } }), "") === "Diklaim untuk: Rekan Satu");
cek("tanpa pelapor dan rekan: tidak ada baris", barisDiklaimUntuk(trx({ kategori: "Transportasi" }), "") === null);
cek("uang harian dan honorarium tidak memakai daftar nama", barisDiklaimUntuk(trx({ kategori: "Perdiem" }), PELAPOR) === null && barisDiklaimUntuk(trx({ kategori: "Honorarium & Ganti Hari" }), PELAPOR) === null);
cek("penerimaan dana tidak memakai daftar nama", barisDiklaimUntuk(trx({ jenis: "pemasukan", kategori: "Penerimaan Dana" }), PELAPOR) === null);

console.log("Transportasi");
const tr = trx({
  kategori: "Transportasi",
  detailKegiatan: { transportasi: { dari: "Kota Asal", ke: "Kota Tujuan", moda: "Travel", namaSopir: "Sopir Contoh", noTelpSopir: "0812000111", noPolisi: "KT 1234 AB" } },
});
cek("rute, moda, sopir, telepon, nomor polisi", ada(tr, "Rute: Kota Asal – Kota Tujuan", "Moda: Travel", "Sopir: Sopir Contoh · Telp. 0812000111", "No. polisi: KT 1234 AB"), semua(tr));
cek("kelengkapan travel: tiket dan STNK", ada(tr, "Kelengkapan: tiket dan STNK kendaraan"), semua(tr));
cek(
  "pesawat: e-ticket dan boarding pass",
  ada(trx({ kategori: "Transportasi", detailKegiatan: { transportasi: { dari: "A", ke: "B", moda: "Pesawat" } } }), "Kelengkapan: e-ticket dan boarding pass")
);

console.log("Rental Kendaraan");
const rental = trx({
  kategori: "Rental Kendaraan",
  detailKegiatan: {
    rentalKendaraan: {
      jenisMerk: "Mobil Contoh",
      tahun: 2022,
      noPolisi: "KT 5678 CD",
      namaPemilik: "Pemilik Contoh",
      tarifPerHari: 500000,
      tanggalMulai: "2026-09-20",
      tanggalSelesai: "2026-09-22",
      jumlahHari: 3,
      persenGrossUpPajak: 2,
      pajakGrossUpNominal: 30612,
      timesheet: [
        { id: "a", tanggal: "2026-09-20", lokasiBasecampRute: "X", cakupanAktivitas: "Y", jarakKm: 40 },
        { id: "b", tanggal: "2026-09-21", lokasiBasecampRute: "X", cakupanAktivitas: "Y", jarakKm: 60 },
      ],
    },
  },
});
cek(
  "jenis, tahun, plat, pemilik, durasi dan tanggal, gross-up pajak, timesheet rental, STNK/SIM/KTP",
  ada(rental, "Kendaraan: Mobil Contoh · tahun 2022", "No. polisi: KT 5678 CD", "Pemilik: Pemilik Contoh", "Sewa: 3 hari · 20/09/2026 s.d. 22/09/2026", "Gross-up pajak: 2%", "Timesheet rental: 2 hari, 100 km", "STNK, SIM pengemudi, dan KTP pemilik"),
  semua(rental)
);

console.log("BBM");
const bbm = trx({ kategori: "BBM", detailKegiatan: { bbm: { kmSaatIsi: 12345, jarakTempuh: 80, dari: "Basecamp", ke: "Desa Contoh", noPolisi: "KT 9 ZZ" } } });
cek("KM spidometer, jarak, rute, nomor polisi", ada(bbm, "KM spidometer saat pengisian: 12345 km", "Jarak tempuh: 80 km", "Rute: Basecamp – Desa Contoh", "No. polisi: KT 9 ZZ"), semua(bbm));

console.log("Akomodasi");
const akom = trx({
  kategori: "Akomodasi",
  detailKegiatan: { akomodasi: { lokasi: "Penginapan Contoh", tanggalMasuk: "2026-09-20", tanggalKeluar: "2026-09-22", jumlahMalam: 2, namaPemilik: "Pemilik Penginapan", noTelp: "0813000222" } },
});
cek(
  "nama, check-in/out, malam, pemilik dan telepon, KTP pemilik",
  ada(akom, "Penginapan: Penginapan Contoh", "check-in 20/09/2026", "check-out 22/09/2026", "2 malam", "Pemilik: Pemilik Penginapan · Telp. 0813000222", "KTP pemilik"),
  semua(akom)
);

console.log("Konsumsi");
const kons = trx({ kategori: "Konsumsi", detailKegiatan: { konsumsi: { penyedia: "Warung Contoh", noTelp: "0814000333", lokasi: "Balai Desa", jumlahPeserta: 15 } } });
cek("penyedia, telepon, lokasi, peserta", ada(kons, "Penyedia: Warung Contoh · Telp. 0814000333", "Lokasi: Balai Desa", "Peserta: 15 orang"), semua(kons));
const kudapan = trx({
  kategori: "Konsumsi",
  jumlah: 200000,
  detailKegiatan: { konsumsi: { kudapanPerjalanan: true, penyedia: "Toko Contoh", lokasi: "Pelabuhan - Desa" }, penerimaManfaat: ["Rekan Satu", "Rekan Dua", "Rekan Tiga"] },
});
cek("kudapan: toko, rute, daftar nama @ plafon, plafon per orang", ada(kudapan, "Toko/warung: Toko Contoh", "Rute: Pelabuhan - Desa", /3 orang \(Rekan Satu, Rekan Dua, Rekan Tiga @ Rp66\.667\)/, "Plafon kudapan: Rp"), semua(kudapan));

console.log("Honorarium & Ganti Hari");
const honor = trx({
  kategori: "Honorarium & Ganti Hari",
  detailKegiatan: { honorarium: { namaPenerima: "Warga Contoh", isPNS: false, hasNPWP: true, jumlahOrang: 2, jumlahHari: 3, nomorAbsen: "07", honorBruto: 600000, tarifPajakPersen: 5, pajakDipotong: 30000, honorNetto: 570000 } },
});
cek(
  "nama, status PNS dan NPWP, orang × hari, nomor absen, bruto/PPh 21/netto",
  ada(honor, "Penerima: Warga Contoh", "Status: Non-PNS · NPWP: ada", "Alokasi: 2 orang × 3 hari", "No. absen: 07", /Bruto Rp\s?600\.000 · PPh 21 \(5%\) Rp\s?30\.000 · Netto Rp\s?570\.000/),
  semua(honor)
);

console.log("Pengadaan dan Lain-lain");
const barang = trx({
  kategori: "Pengadaan Barang & Perlengkapan",
  detailKegiatan: { rincian: { banyaknya: 4, satuan: "buah", hargaSatuan: 25000 }, namaPenjualPenyedia: "Toko Bangunan Contoh", perluSuratJustifikasi: true, alasanJustifikasi: "nota hilang" },
});
cek("penjual/toko dan surat justifikasi", ada(barang, "Penjual/toko: Toko Bangunan Contoh", "Surat Justifikasi: diperlukan karena bukti tidak lengkap (nota hilang)"), semua(barang));
cek("rincian jumlah × satuan × harga di baris rincian lengkap", barisRincianLengkap(barang, PELAPOR).some((x) => /^4 buah × Rp\s?25\.000$/.test(x)), barisRincianLengkap(barang, PELAPOR));
cek("Lain-lain juga memuat penjual/toko", ada(trx({ kategori: "Lain-lain", detailKegiatan: { namaPenjualPenyedia: "Kios Contoh" } }), "Penjual/toko: Kios Contoh"));

console.log("Susunan baris");
const lengkap = barisRincianLengkap(tr, PELAPOR);
cek("Diklaim untuk di baris pertama, kelengkapan sesudahnya", lengkap[0] === `Diklaim untuk: ${PELAPOR}` && lengkap.length > 3, lengkap);
const kepala = barisKepalaBukti(tr, PELAPOR);
cek("kepala bukti: Diklaim untuk, lalu satu paragraf kelengkapan", kepala.length === 2 && kepala[0] === `Diklaim untuk: ${PELAPOR}` && kepala[1].includes("Rute: Kota Asal – Kota Tujuan") && kepala[1].includes(" · "), kepala);
cek("pengeluaran tanpa rincian: hanya Diklaim untuk", barisRincianLengkap(trx({ kategori: "BBM" }), PELAPOR).join("|") === `Diklaim untuk: ${PELAPOR}`);
cek("penerimaan dana: tanpa baris kelengkapan", barisRincianLengkap(trx({ jenis: "pemasukan", kategori: "Penerimaan Dana" }), PELAPOR).length === 0);

console.log("Uraian penerimaan dana tanpa judul kegiatan");
const JUDUL = "Kegiatan Pemetaan Partisipatif Contoh Batch 4";
const penerimaan = (deskripsi: string) => trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", deskripsi, kaitan: JUDUL });
cek("uraian lama 'Penerimaan Dana <judul>' dibersihkan", uraianTampil(penerimaan(`Penerimaan Dana ${JUDUL}`)) === "Penerimaan Dana Kegiatan");
cek("judul beda tipis (tanpa Batch, huruf kecil) tetap dikenali", uraianTampil(penerimaan("penerimaan dana kegiatan pemetaan partisipatif contoh")) === "Penerimaan Dana Kegiatan");
cek("uraian bersih dipertahankan", uraianTampil(penerimaan("Penerimaan Dana Kegiatan")) === "Penerimaan Dana Kegiatan");
cek("uraian khusus ketikan pengguna dipertahankan", uraianTampil(penerimaan("Penerimaan Dana tahap kedua")) === "Penerimaan Dana tahap kedua");
cek("judul kegiatan dari kegiatan terpilih (bukan kaitan) juga dibersihkan", uraianTampil({ ...penerimaan(`Penerimaan Dana ${JUDUL}`), kaitan: "" }, JUDUL) === "Penerimaan Dana Kegiatan");
cek("pengeluaran tidak diubah", uraianTampil(trx({ deskripsi: `Penerimaan Dana ${JUDUL}` }), JUDUL) === `Penerimaan Dana ${JUDUL}`);

if (gagal > 0) {
  console.log(`\n${gagal} pemeriksaan GAGAL`);
  process.exit(1);
}
console.log("\nSemua pemeriksaan lulus");
