/**
 * Uji susunan laporan dana kegiatan (src/lib/susunanLaporan.ts), sumber bersama dokumen Word dan dokumen siap cetak di aplikasi:
 * semua foto bukti sebuah pengeluaran ikut (bukan hanya foto pertama), struk berdampingan dengan foto pertamanya, PDF jadi tautan,
 * aturan halaman baru, uang harian hari kepulangan (sehari sesudah tanggal selesai) ikut di timesheet, ringkasan penyelesaian
 * (warna, rincian, rumus), dan surat justifikasi (narasi baku, narasi AI disimpan sekali per sesi).
 * Jalankan: npx tsx scripts/uji_susunan_laporan.ts
 */
import {
  narasiJustifikasiBaku,
  rincianPenyelesaian,
  rumusPenyelesaian,
  susunLaporanKegiatan,
  susunNarasiSuratJustifikasi,
  warnaPenyelesaian,
} from "../src/lib/susunanLaporan";
import type { BuktiItem, DataKegiatan, ProfilPelapor, Transaksi } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const kegiatan: DataKegiatan = {
  id: "kg1",
  nama: "Kegiatan Contoh Pemetaan",
  lokasi: "Kota Contoh",
  tanggalMulai: "2026-10-20",
  tanggalSelesai: "2026-10-26",
  batch: 4,
  timesheetBaris: Array.from({ length: 8 }, (_, i) => ({
    tanggal: `2026-10-${20 + i}`,
    keterangan: i === 7 ? "Perjalanan pulang ke kantor" : `Pendampingan hari ke-${i + 1}`,
    lokasi: "Desa Contoh",
  })),
} as DataKegiatan;
const profil = { nama: "Budi Santoso", jabatan: "Staf", lembaga: "Lembaga Contoh", proyek: "Proyek Contoh", penyetuju: "Sari Wulandari" } as ProfilPelapor;

let urut = 0;
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: `t${++urut}`,
  jenis: "pengeluaran",
  dana: "Dana Kegiatan",
  tanggal: "2026-10-21",
  deskripsi: "Pengeluaran",
  kategori: "Konsumsi",
  jumlah: 100000,
  metode: "Tunai",
  kaitan: kegiatan.nama,
  kegiatanId: kegiatan.id,
  catatan: "",
  ...o,
} as Transaksi);
const foto = (i: number, tipe = "image/jpeg"): BuktiItem => ({ id: `f${i}`, nama: `bukti${i}.${tipe === "application/pdf" ? "pdf" : "jpg"}`, tipe, dataUrl: "data:x" });
// Bukti yang ditarik dari kolom bukti sheet Drive hanya berupa tautan (tanpa driveId).
const tautan = (i: number): BuktiItem => ({ id: `l${i}`, nama: "Bukti Transaksi", tipe: "image/jpeg", driveLink: `https://drive.google.com/file/d/contoh${i}/view` });

const transaksi: Transaksi[] = [
  trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", tanggal: "2026-10-19", deskripsi: "Penerimaan Dana Kegiatan", jumlah: 5000000, metode: "Transfer" }),
  // Tiket speedboat tiga orang: tiga foto tiket
  trx({
    tanggal: "2026-10-20",
    deskripsi: "Tiket speedboat",
    kategori: "Transportasi",
    jumlah: 900000,
    bukti: [foto(1), foto(2), tautan(3)],
    detailKegiatan: { jenisBukti: "Tiket", transportasi: { dari: "Tarakan", ke: "Malinau", moda: "Speedboat / Kapal" }, penerimaManfaat: ["Andi", "Rina"] },
  }),
  // Struk snack: foto pertama di kotak struk, sisanya di kisi foto; PDF jadi tautan
  trx({
    tanggal: "2026-10-21",
    deskripsi: "Snack perjalanan",
    jumlah: 150000,
    bukti: [foto(4), foto(5), foto(6, "application/pdf")],
    detailKegiatan: { jenisBukti: "Struk thermal (minimarket/SPBU)" },
  }),
  trx({ tanggal: "2026-10-22", deskripsi: "Nota fotokopi 1", kategori: "Lain-lain", jumlah: 20000 }),
  trx({ tanggal: "2026-10-22", deskripsi: "Nota fotokopi 2", kategori: "Lain-lain", jumlah: 25000 }),
  trx({ tanggal: "2026-10-23", deskripsi: "Nota fotokopi 3", kategori: "Lain-lain", jumlah: 30000 }),
  trx({
    tanggal: "2026-10-24",
    deskripsi: "Ojek ke dusun",
    kategori: "Transportasi",
    jumlah: 60000,
    detailKegiatan: { jenisBukti: "Bukti tidak lengkap", perluSuratJustifikasi: true, alasanJustifikasi: "pengemudi tidak punya kuitansi" },
  }),
];
// Uang harian 20-26 Oktober ditambah hari kepulangan 27 Oktober yang belum dikaitkan ke kegiatan
for (let d = 20; d <= 27; d++) {
  transaksi.push(
    trx({
      tanggal: `2026-10-${d}`,
      deskripsi: `Perdiem Contoh · 2026-10-${d}`,
      kategori: "Perdiem",
      jumlah: 200000,
      ...(d === 27 ? { kegiatanId: undefined, kaitan: "" } : {}),
    })
  );
}

const s = susunLaporanKegiatan({ transaksi, kegiatan, daftarKegiatan: [kegiatan], profilPelapor: profil });

console.log("== Semua foto bukti ikut");
const blok = s.kelompok.flatMap((k) => k.blok);
const speedboat = blok.find((b) => b.transaksi.deskripsi === "Tiket speedboat")!;
cek("tiket speedboat: kotak tempel lebar, ketiga foto (termasuk foto bertautan Drive) di kisi foto", speedboat.kotakUtama.bentuk === "lebar" && !speedboat.fotoDiKotak && speedboat.fotoBukti.map((b) => b.id).join() === "f1,f2,l3", speedboat.fotoBukti.map((b) => b.id));
cek("kotak tiket menyebut nomor, uraian, nominal, dan Diklaim untuk", /^No\. \d+ · Tiket speedboat · Rp\s?900\.000 · Diklaim untuk: Budi Santoso, Andi, Rina$/.test(speedboat.kotakUtama.keterangan), speedboat.kotakUtama.keterangan);
const snack = blok.find((b) => b.transaksi.deskripsi === "Snack perjalanan")!;
cek("struk snack: foto pertama di kotak struk, foto kedua di kisi, PDF jadi lampiran tautan", snack.kotakUtama.bentuk === "struk" && snack.fotoDiKotak?.id === "f4" && snack.fotoBukti.map((b) => b.id).join() === "f5" && snack.lampiranPdf.map((b) => b.id).join() === "f6");
cek("struk snack: kotak 120 mm bertuliskan TEMPEL STRUK ASLI DI SINI", snack.kotakUtama.tinggiMm === 120 && snack.kotakUtama.judul === "TEMPEL STRUK ASLI DI SINI");

console.log("== Halaman baru seperti di Word");
const lain = s.kelompok.find((k) => k.kategori === "Lain-lain")!;
cek("tiga nota sederhana: dua per halaman, yang ketiga di halaman baru", lain.blok.map((b) => b.halamanBaru).join() === "false,false,true", lain.blok.map((b) => b.halamanBaru));
const trans = s.kelompok.find((k) => k.kategori === "Transportasi")!;
cek("pengeluaran berfoto sesudah pengeluaran lain mulai di halaman baru", trans.blok[0].halamanBaru === false && trans.blok[1].halamanBaru === true, trans.blok.map((b) => b.halamanBaru));

console.log("== Uang harian hari kepulangan ikut");
cek("timesheet memuat 8 hari sampai 27 Oktober", s.daftarPerdiem?.baris.length === 8 && s.daftarPerdiem?.baris[7].tanggal.includes("27"), s.daftarPerdiem?.baris.map((b) => b.tanggal));
cek("keterangan hari kepulangan dari timesheet", s.daftarPerdiem?.baris[7].keterangan === "Perjalanan pulang ke kantor", s.daftarPerdiem?.baris[7]);
cek("total uang harian Rp1.600.000", s.daftarPerdiem?.total === 1600000 && s.penyelesaian.totalPerdiem === 1600000, s.daftarPerdiem?.total);
cek("uang harian tanpa foto tidak dibuat blok (sudah berupa timesheet)", !s.kelompok.some((k) => k.kategori === "Perdiem"));
const rekapUH = s.rekap.find((r) => r.label === "Uang Harian");
cek("rekapitulasi: Uang Harian 8 bukti", rekapUH?.jumlahBukti === 8 && rekapUH?.jumlah === 1600000, rekapUH);

console.log("== Ringkasan penyelesaian");
const p = s.penyelesaian;
cek("total diakui = realisasi + uang harian", p.totalDiakui === p.realisasiOperasional + p.totalPerdiem && p.totalDiakui === s.totalPengeluaran, p);
cek("status sisa dikembalikan: hijau", p.status === "kembalikan" && warnaPenyelesaian(p.status).latar === "E7F6EC");
cek("rincian: dana awal, realisasi, uang harian", rincianPenyelesaian(p).map(([l]) => l.split(" ")[0]).join() === "Dana,Realisasi,Total");
cek("rumus: dana awal − total diakui = sisa", rumusPenyelesaian(p).startsWith("Dana awal Rp") && rumusPenyelesaian(p).includes("= Rp"), rumusPenyelesaian(p));
cek("warna kelebihan (diganti lembaga): merah; nihil: biru", warnaPenyelesaian("reimbursement").garis === "B42318" && warnaPenyelesaian("nihil").garis === "1D4ED8");

console.log("== Surat justifikasi");
const j = s.justifikasi[0];
cek("satu surat untuk ojek tanpa kuitansi", s.justifikasi.length === 1 && j.transaksi.deskripsi === "Ojek ke dusun" && j.jenisBukti === "BUKTI TIDAK LENGKAP");
cek("narasi baku tiga paragraf menyebut alasan", j.narasiBaku.length === 3 && j.narasiBaku[1].includes("pengemudi tidak punya kuitansi"));
cek("tempat dan tanggal tanda tangan", j.tempatTanggal === "Kota Contoh, 24 Oktober 2026", j.tempatTanggal);
cek("narasiJustifikasiBaku sama dengan narasi di susunan", JSON.stringify(narasiJustifikasiBaku(j.paramNarasi)) === JSON.stringify(j.narasiBaku));

let panggil = 0;
(globalThis as any).fetch = async () => {
  panggil++;
  throw new Error("tanpa jaringan");
};
const pesanAsli = console.warn;
console.warn = () => {};
const [n1, n2] = await Promise.all([susunNarasiSuratJustifikasi(j.paramNarasi), susunNarasiSuratJustifikasi(j.paramNarasi)]);
const n3 = await susunNarasiSuratJustifikasi(j.paramNarasi);
console.warn = pesanAsli;
cek("tanpa server AI: narasi baku", JSON.stringify(n1) === JSON.stringify(j.narasiBaku));
cek("narasi diminta sekali per sesi (pratinjau dan Word memakai narasi yang sama)", panggil === 1 && n1 === n2 && n2 === n3, panggil);

console.log("== Kepala halaman dan identitas");
cek("kepala halaman: Laporan Keuangan Kegiatan · nama · periode", s.kepalaHalaman === "Laporan Keuangan Kegiatan · Budi Santoso · 20 Oktober 2026 s.d. 26 Oktober 2026", s.kepalaHalaman);
cek("penerimaan dana P1", s.penerimaan.length === 1 && s.penerimaan[0].nomor === "P1" && s.totalPenerimaan === 5000000);

if (gagal) {
  console.log(`\n${gagal} uji gagal`);
  process.exit(1);
}
console.log("\nSemua uji lolos");
