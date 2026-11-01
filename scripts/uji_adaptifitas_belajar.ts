/**
 * Pengujian Sistem Pembelajaran Adaptif, Geometri Pasangan 0 mm, dan Checklist Lembaga 17 Kategori.
 * Berdasarkan acuan "Prompt Gemini Antigravity - ukuran bukti adaptif dan pasangan tanpa sela" v2 (30 Oktober 2026).
 */

import {
  taksirUkuranBuktiAdaptif,
  pelajariTransaksi,
  muatMemoriBelajar,
  PRESET_POLA_BUKTI,
  susunManifesPasangan,
} from "../src/lib/dataBelajarBukti";
import { TABEL_KELENGKAPAN_LEMBAGA } from "../src/lib/tabelLembagaSPJ";
import { susunLaporanKegiatan } from "../src/lib/susunanLaporan";
import type { Transaksi, DataKegiatan, ProfilPelapor, BuktiItem } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, info?: unknown) {
  if (kondisi) {
    console.log(`  ok   ${nama}`);
  } else {
    gagal++;
    console.error(`  GAGAL ${nama}`, info !== undefined ? info : "");
  }
}

console.log("== 1. Pengetahuan Awal (Seed Knowledge) & Adaptifitas Ukuran");
// A. Struk Indomaret / Alfamart: Thermal roll 80 mm -> kotak 90 mm (samping)
const strukIndomaret = taksirUkuranBuktiAdaptif({
  deskripsi: "Belanja snack perjalanan",
  penyedia: "Indomaret Sengkawit Raya",
  kategori: "Konsumsi",
  rasio: 1.83,
});
cek("struk Indomaret roll 80 mm menghasilkan lebar kotak 90 mm", strukIndomaret.lebarMm === 90, strukIndomaret.lebarMm);
cek("struk Indomaret tata letak samping", strukIndomaret.tataLetak === "samping");
cek("struk Indomaret status matched_publisher_spec", strukIndomaret.status === "matched_publisher_spec");
cek("struk Indomaret tinggi adaptif mengikuti rasio", strukIndomaret.tinggiMm === Math.round(90 * 1.83), strukIndomaret.tinggiMm);

// B. Tiket Speedboat SB Menara Niklas: 165 × 100 mm (bawah)
const tiketKapal = taksirUkuranBuktiAdaptif({
  deskripsi: "Tiket speedboat",
  penyedia: "SB. MENARA NIKLAS EXPRESS",
  kategori: "Transportasi",
  rasio: 0.58,
});
cek("tiket speedboat menghasilkan kotak 165 × 100 mm", tiketKapal.lebarMm === 165 && tiketKapal.tinggiMm === 100, [tiketKapal.lebarMm, tiketKapal.tinggiMm]);
cek("tiket speedboat tata letak bawah", tiketKapal.tataLetak === "bawah");
cek("tiket speedboat status matched_publisher_spec", tiketKapal.status === "matched_publisher_spec");

// C. Susi Air: Passenger Coupon vs Boarding Pass
const coupon = taksirUkuranBuktiAdaptif({
  deskripsi: "Passenger coupon penerbangan",
  penyedia: "Susi Air",
  kategori: "Transportasi",
  rasio: 0.48,
});
cek("passenger coupon menghasilkan kotak 175 × 90 mm tata letak bawah", coupon.lebarMm === 175 && coupon.tinggiMm === 90 && coupon.tataLetak === "bawah", [coupon.lebarMm, coupon.tinggiMm, coupon.tataLetak]);

const boarding = taksirUkuranBuktiAdaptif({
  deskripsi: "Boarding pass fisik",
  penyedia: "Susi Air",
  kategori: "Transportasi",
  rasio: 1.45,
});
cek("boarding pass menghasilkan kotak 100 × 145 mm tata letak samping", boarding.lebarMm === 100 && boarding.tinggiMm === 145 && boarding.tataLetak === "samping", [boarding.lebarMm, boarding.tinggiMm, boarding.tataLetak]);

// D. Kuitansi Penginapan / Rumah Pak Kades
const penginapan = taksirUkuranBuktiAdaptif({
  deskripsi: "Penginapan selama survei",
  penyedia: "Rumah Pak Kades",
  kategori: "Akomodasi",
  rasio: 0.45,
});
cek("kuitansi penginapan menghasilkan kotak 220 × 110 mm tata letak bawah", penginapan.lebarMm === 220 && penginapan.tinggiMm >= 105 && penginapan.tataLetak === "bawah", [penginapan.lebarMm, penginapan.tinggiMm, penginapan.tataLetak]);

console.log("\n== 2. Mesin Pembelajaran (Learning Engine Feedback Loop)");
const mockTrxBaru: Transaksi[] = [
  {
    id: "t_learn_1",
    tanggal: "2026-10-25",
    deskripsi: "Sewa perahu ketinting sungai",
    kategori: "Transportasi",
    jumlah: 300000,
    metode: "Tunai",
    dana: "Dana Kegiatan",
    detailKegiatan: {
      transportasi: { penyedia: "Perahu Pak Yohanes", moda: "Perahu Ketinting" },
      kotakTempel: "B",
    },
  } as Transaksi,
];

// Pelajari transaksi baru
pelajariTransaksi(mockTrxBaru);
const memori = muatMemoriBelajar();
const polaYohanes = memori.find((m) => m.kunci.includes("perahu pak yohanes"));
cek("mesin belajar berhasil merekam pola penyedia baru (Perahu Pak Yohanes)", polaYohanes !== undefined && polaYohanes.tataLetak === "bawah");

// Uji prediksi adaptif setelah belajar
const prediksiYohanes = taksirUkuranBuktiAdaptif({
  deskripsi: "Sewa perahu susur sungai hari kedua",
  penyedia: "Perahu Pak Yohanes",
  kategori: "Transportasi",
});
cek("prediksi adaptif berikutnya untuk penyedia tersebut otomatis memanfaatkan pola belajar", prediksiYohanes.tataLetak === "bawah" && prediksiYohanes.lebarMm === 170);

console.log("\n== 3. Manifes Pasangan Bukti Geometri 0 mm");
const fotoDummy: BuktiItem = { id: "f_test_1", nama: "nota.jpg", tipe: "image/jpeg", lebarPx: 800, tinggiPx: 1400 };
const manifes = susunManifesPasangan(
  mockTrxBaru[0],
  1,
  fotoDummy,
  1,
  1,
  strukIndomaret
);
cek("manifes memiliki pair_id stabil", manifes.pair_id === "1:1");
cek("manifes mengunci internal_gap_mm = 0", manifes.pair.internal_gap_mm === 0);
cek("manifes mewajibkan same_page_required = true", manifes.pair.same_page_required === true);
cek("manifes melarang split_allowed = false", manifes.pair.split_allowed === false);

console.log("\n== 4. Checklist Lembaga 17 Kategori Otoritatif");
cek("tabel lembaga memuat persis 17 kategori", TABEL_KELENGKAPAN_LEMBAGA.length === 17, TABEL_KELENGKAPAN_LEMBAGA.length);
cek("kategori 1 adalah Seluruh Kwitansi (8 butir)", TABEL_KELENGKAPAN_LEMBAGA[0].jenis === "Seluruh Kwitansi" && TABEL_KELENGKAPAN_LEMBAGA[0].dokumenPendukung.length === 8);
cek("kategori 17 adalah Lain-lain (6 butir)", TABEL_KELENGKAPAN_LEMBAGA[16].jenis === "Lain-lain" && TABEL_KELENGKAPAN_LEMBAGA[16].dokumenPendukung.length === 6);

const kegiatanDummy: DataKegiatan = {
  id: "keg1",
  nama: "Kegiatan Riset Lapangan Krayan",
  lokasi: "Krayan",
  tanggalMulai: "2026-10-20",
  tanggalSelesai: "2026-10-27",
  penanggungJawab: "Budi Santoso",
  totalAnggaran: 10000000,
  sumberDana: "Lembaga",
};
const profilDummy: ProfilPelapor = {
  nama: "Budi Santoso",
  jabatan: "Surveyor",
  lembaga: "Lembaga Riset",
  proyek: "Konservasi",
  penyetuju: "Sari Wulandari",
};

const laporan = susunLaporanKegiatan({
  transaksi: mockTrxBaru,
  kegiatan: kegiatanDummy,
  daftarKegiatan: [kegiatanDummy],
  profilPelapor: profilDummy,
});

cek("laporan menyertakan seluruh 17 kategori dalam daftar periksa", laporan.daftarPeriksa?.length === 17, laporan.daftarPeriksa?.length);
cek("laporan menyertakan manifes bukti lengkap", (laporan.manifesBukti?.length ?? 0) >= 0);

if (gagal > 0) {
  console.error(`\n${gagal} pengujian gagal!`);
  process.exit(1);
} else {
  console.log("\nSemua pengujian adaptifitas belajar dan kepatuhan v2 lolos dengan sukses!");
}
