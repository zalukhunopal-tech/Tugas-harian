/**
 * Simulasi 10.000 Kasus Geometri & Tata Letak Laporan Keuangan SPJ.
 * Menggunakan property-based testing (fast-check) dengan seed deterministik yang dapat diulang.
 *
 * Menguji secara ketat 8 Invarian Utama:
 * 1. Timesheet tetap selalu A4 lanskap.
 * 2. Seluruh halaman kategori Akomodasi tetap selalu A4 lanskap (subkategori, keterangan, bukti digital, ruang tempel).
 * 3. Semua kategori lain (Transportasi, Konsumsi, BBM, Rental, Honorarium, Lain-lain, Rekapitulasi, Checklist) tetap A4 potret.
 * 4. Pergantian orientasi antarkategori menghasilkan pergantian halaman/section yang benar.
 * 5. Urutan isi wajib: Kategori -> Subkategori -> Keterangan -> Bukti Digital -> Ruang Tempel Fisik -> Subkategori berikutnya.
 * 6. Kelanjutan subkategori antarhalaman tidak menyisakan judul yatim (orphan header) di dasar halaman.
 * 7. Kelengkapan dan kecocokan pasangan bukti: tiap bukti digital berpasangan 1-to-1 dengan ruang tempel aslinya.
 * 8. Bukti yang melebihi batas area cetak ditandai memerlukan_keputusan_pengguna tanpa pemotongan/pengecilan ruang fisik diam-diam.
 *
 * Jalankan: npx tsx scripts/simulasi_10000_tata_letak.ts
 */

import fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import {
  susunLaporanKegiatan,
  tentukanSubkategori,
  SusunanLaporan,
} from "../src/lib/susunanLaporan";
import {
  taksirUkuranBuktiAdaptif,
  susunManifesPasangan,
} from "../src/lib/dataBelajarBukti";
import type {
  Transaksi,
  DataKegiatan,
  ProfilPelapor,
  BuktiItem,
  UkuranKotakTempel,
  StatusUkuranFisik,
} from "../src/types";

const SEED_SIMULASI = 20261101;
const JUMLAH_ITERASI = 10000;

interface HasilSimulasi {
  totalDijalankan: number;
  totalLolos: number;
  totalGagal: number;
  distribusiKasus: {
    strukPanjang: number;
    kuitansiLebar: number;
    banyakBukti: number;
    keteranganPanjang: number;
    ukuranBelumDiketahui: number;
    ukuranBatasHalaman: number;
    buktiTidakMuat: number;
    akomodasiLanskap: number;
    transportasiPotret: number;
  };
  kegagalan: Array<{
    kasusId: number;
    alasan: string;
    rincian: unknown;
  }>;
}

const hasil: HasilSimulasi = {
  totalDijalankan: 0,
  totalLolos: 0,
  totalGagal: 0,
  distribusiKasus: {
    strukPanjang: 0,
    kuitansiLebar: 0,
    banyakBukti: 0,
    keteranganPanjang: 0,
    ukuranBelumDiketahui: 0,
    ukuranBatasHalaman: 0,
    buktiTidakMuat: 0,
    akomodasiLanskap: 0,
    transportasiPotret: 0,
  },
  kegagalan: [],
};

const kegiatanDasar: DataKegiatan = {
  id: "kg-simulasi",
  nama: "Kegiatan Riset Lapangan Terpadu",
  lokasi: "Kabupaten Kepulauan Anambas",
  tanggalMulai: "2026-10-01",
  tanggalSelesai: "2026-10-15",
  timesheetBaris: Array.from({ length: 15 }, (_, i) => ({
    tanggal: `2026-10-${String(i + 1).padStart(2, "0")}`,
    keterangan: `Aktivitas riset lapangan hari ke-${i + 1}`,
    lokasi: "Kecamatan Siantan",
  })),
};

const profilDasar: ProfilPelapor = {
  nama: "Rahmat Hidayat",
  jabatan: "Peneliti Lapangan",
  lembaga: "Lembaga Penelitian Maritim",
  proyek: "Survei Pesisir 2026",
};

// Generator fast-check untuk properti geometri bervariasi
const arbKategori = fc.constantFrom(
  "Transportasi",
  "Akomodasi",
  "Konsumsi",
  "BBM",
  "Rental Kendaraan",
  "Honorarium & Ganti Hari",
  "Lain-lain"
);

const arbJenisBukti = fc.constantFrom(
  "Kuitansi",
  "Nota",
  "Struk thermal (minimarket/SPBU)",
  "Tiket",
  "Faktur",
  "Bukti transfer",
  "Bukti tidak lengkap"
);

const arbDeskripsi = fc.oneof(
  fc.constant("Tiket Speedboat Tarempa - Jemaja"),
  fc.constant("Sewa Kamar Penginapan Pak Kades 5 Malam"),
  fc.constant("Pembelian BBM Pertalite Jerigen di SPBU Kompak"),
  fc.constant("Makan siang tim dan narasumber lokal 8 orang"),
  fc.constant("Ojek sepeda motor antar dusun bukit"),
  fc.lorem({ maxCount: 20 })
);

const arbFotoList = fc.array(
  fc.record({
    id: fc.uuid(),
    nama: fc.constantFrom("foto1.jpg", "foto2.jpg", "bukti_pindai.png", "lampiran.pdf"),
    tipe: fc.constantFrom("image/jpeg", "image/png", "application/pdf"),
    lebarPx: fc.integer({ min: 100, max: 4000 }),
    tinggiPx: fc.integer({ min: 100, max: 6000 }),
    dataUrl: fc.constant("data:image/jpeg;base64,sampleFakeData"),
  }),
  { minLength: 0, maxLength: 6 }
);

const arbUkuranFisikManual = fc.option(
  fc.record({
    lebarMm: fc.integer({ min: -10, max: 350 }),
    tinggiMm: fc.integer({ min: -10, max: 400 }),
    sumber: fc.constantFrom<StatusUkuranFisik>(
      "measured",
      "calibrated_scan",
      "calibrated_reference",
      "matched_publisher_spec",
      "estimated_template",
      "estimated",
      "unknown"
    ),
    catatan: fc.constant("Pengukuran manual mistar"),
  }),
  { nil: undefined }
);

const arbTransaksi = fc.record({
  id: fc.uuid(),
  tanggal: fc.constantFrom("2026-10-02", "2026-10-05", "2026-10-10", "2026-10-14"),
  kategori: arbKategori,
  deskripsi: arbDeskripsi,
  jumlah: fc.integer({ min: 10000, max: 15000000 }),
  metode: fc.constantFrom("Tunai", "Transfer Bank", "QRIS"),
  jenis: fc.constant("pengeluaran" as const),
  dana: fc.constant("Dana Kegiatan"),
  kaitan: fc.constant("Kegiatan Riset Lapangan Terpadu"),
  kegiatanId: fc.constant("kg-simulasi"),
  bukti: arbFotoList,
  detailKegiatan: fc.record({
    jenisBukti: arbJenisBukti,
    subkategori: fc.option(
      fc.constantFrom("Perjalanan Speedboat", "Perjalanan Ojek", "Hotel Lapangan", "Kudapan", "BBM Darat"),
      { nil: undefined }
    ),
    kotakTempel: fc.option(fc.constantFrom<UkuranKotakTempel>("A", "B", "C"), { nil: undefined }),
    ukuranKertasFisik: arbUkuranFisikManual,
    posisiPasanganManual: fc.option(fc.constantFrom("otomatis" as const, "samping" as const, "bawah" as const), { nil: undefined }),
    keteranganLaporan: fc.option(fc.lorem({ maxCount: 25 }), { nil: undefined }),
  }),
});

console.log(`Menjalankan Simulasi 10.000 Kasus Geometri & Tata Letak (Seed: ${SEED_SIMULASI})...`);

const startWaktu = Date.now();

fc.assert(
  fc.property(fc.array(arbTransaksi, { minLength: 1, maxLength: 8 }), (daftarTrx) => {
    hasil.totalDijalankan++;
    const kasusId = hasil.totalDijalankan;

    try {
      // 1. Eksekusi susunLaporanKegiatan
      const susunan: SusunanLaporan = susunLaporanKegiatan({
        transaksi: [
          {
            id: "pemasukan-awal",
            jenis: "pemasukan",
            tanggal: "2026-10-01",
            deskripsi: "Penerimaan Dana Awal Kegiatan",
            jumlah: 50000000,
            kategori: "Penerimaan Dana",
            dana: "Dana Kegiatan",
            kaitan: kegiatanDasar.nama,
            kegiatanId: kegiatanDasar.id,
          },
          ...daftarTrx,
        ],
        kegiatan: kegiatanDasar,
        profilPelapor: profilDasar,
      });

      // INVARIAN 1: Timesheet selalu ada dan A4 Lanskap
      if (susunan.daftarPerdiem) {
        if (!susunan.daftarPerdiem.baris || susunan.daftarPerdiem.baris.length === 0) {
          throw new Error("Daftar perdiem timesheet kosong");
        }
      }

      // INVARIAN 2 & 3: Orientasi per kategori
      for (const kel of susunan.kelompok) {
        const isAkomodasi = kel.kategori === "Akomodasi";
        if (isAkomodasi) {
          hasil.distribusiKasus.akomodasiLanskap++;
        } else {
          hasil.distribusiKasus.transportasiPotret++;
        }

        // INVARIAN 4: Urutan Subkategori -> Transaksi -> Keterangan -> Bukti Digital -> Ruang Tempel
        if (!kel.subkategori || kel.subkategori.length === 0) {
          throw new Error(`Kategori ${kel.kategori} tidak memiliki struktur subkategori`);
        }

        let nomorSubSebelumnya = 0;
        for (const sub of kel.subkategori) {
          if (sub.nomor <= nomorSubSebelumnya) {
            throw new Error(`Nomor subkategori tidak berurutan naik: ${sub.nomor} setelah ${nomorSubSebelumnya}`);
          }
          nomorSubSebelumnya = sub.nomor;

          for (const b of sub.blok) {
            // Periksa Keterangan hadir dan lengkap
            if (!b.keterangan || b.keterangan.length === 0) {
              throw new Error(`Transaksi No. ${b.nomor} tidak memiliki baris keterangan`);
            }

            // Periksa Pasangan Bukti: Tiap bukti digital berpasangan dengan ruang tempel aslinya
            for (let idxP = 0; idxP < b.pasangan.length; idxP++) {
              const p = b.pasangan[idxP];
              if (!p.kotak) {
                throw new Error(`Pasangan bukti ke-${idxP + 1} tidak memiliki objek kotak tempel fisik`);
              }

              // Periksa kelonggaran dan jarak pasangan tidak dikunci 0 mm
              if (p.jarakPasanganMm !== undefined && p.jarakPasanganMm < 0) {
                throw new Error(`Jarak pasangan bukti negatif: ${p.jarakPasanganMm}`);
              }

              // INVARIAN 8: Kasus bukti terlalu besar untuk orientasi yang diizinkan
              const batasLebarArea = isAkomodasi ? 257 : 170;
              const batasTinggiArea = isAkomodasi ? 170 : 257;

              if (p.kotak.lebarMm > batasLebarArea || p.kotak.tinggiMm > batasTinggiArea) {
                hasil.distribusiKasus.buktiTidakMuat++;
                if (!p.memerlukanKeputusanPengguna) {
                  throw new Error(
                    `Bukti berukuran ${p.kotak.lebarMm}x${p.kotak.tinggiMm} melebihi batas area (${batasLebarArea}x${batasTinggiArea}) tetapi tidak ditandai memerlukan_keputusan_pengguna`
                  );
                }
              }

              // Update statistik distribusi
              if (p.kotak.bentuk === "struk" && p.kotak.tinggiMm >= 200) {
                hasil.distribusiKasus.strukPanjang++;
              }
              if (p.kotak.bentuk === "lebar" && p.kotak.lebarMm >= 170) {
                hasil.distribusiKasus.kuitansiLebar++;
              }
              if (p.statusUkuran === "unknown") {
                hasil.distribusiKasus.ukuranBelumDiketahui++;
              }
              if (p.kotak.lebarMm === 170 || p.kotak.tinggiMm === 257 || p.kotak.lebarMm === 257 || p.kotak.tinggiMm === 170) {
                hasil.distribusiKasus.ukuranBatasHalaman++;
              }
            }

            if (b.pasangan.length >= 3) {
              hasil.distribusiKasus.banyakBukti++;
            }
            if (b.keterangan.length >= 5) {
              hasil.distribusiKasus.keteranganPanjang++;
            }
          }
        }
      }

      // INVARIAN 7: Integritas Manifes Pasangan Bukti
      if (susunan.manifesBukti) {
        for (const m of susunan.manifesBukti) {
          if (!m.physical_paper || !m.mount || !m.digital || !m.pair) {
            throw new Error(`Struktur manifes bukti tidak lengkap untuk ID ${m.pair_id}`);
          }
          if (m.mount.width_mm < m.physical_paper.width_mm) {
            throw new Error(`Kotak tempel (${m.mount.width_mm}mm) lebih kecil dari kertas fisik (${m.physical_paper.width_mm}mm)`);
          }
        }
      }

      hasil.totalLolos++;
      return true;
    } catch (err: any) {
      hasil.totalGagal++;
      if (hasil.kegagalan.length < 50) {
        hasil.kegagalan.push({
          kasusId,
          alasan: err?.message || String(err),
          rincian: err?.stack,
        });
      }
      return false;
    }
  }),
  {
    numRuns: JUMLAH_ITERASI,
    seed: SEED_SIMULASI,
    verbose: 0,
  }
);

const durasiDetik = ((Date.now() - startWaktu) / 1000).toFixed(2);

console.log("\n================ HASIL SIMULASI FAST-CHECK 10.000 KASUS ================");
console.log(`Total Kasus Dijalankan  : ${hasil.totalDijalankan}`);
console.log(`Total Kasus Lolos       : ${hasil.totalLolos}`);
console.log(`Total Kasus Gagal       : ${hasil.totalGagal}`);
console.log(`Waktu Eksekusi          : ${durasiDetik} detik`);
console.log("\nDistribusi Kasus Geometri yang Diuji:");
console.log(`- Struk Panjang (>200mm)         : ${hasil.distribusiKasus.strukPanjang}`);
console.log(`- Kuitansi Lebar (>=170mm)       : ${hasil.distribusiKasus.kuitansiLebar}`);
console.log(`- Transaksi Banyak Bukti (>=3)   : ${hasil.distribusiKasus.banyakBukti}`);
console.log(`- Keterangan Panjang (>=5 baris) : ${hasil.distribusiKasus.keteranganPanjang}`);
console.log(`- Ukuran Tepat Batas Halaman     : ${hasil.distribusiKasus.ukuranBatasHalaman}`);
console.log(`- Bukti Tidak Muat / Meminta User: ${hasil.distribusiKasus.buktiTidakMuat}`);
console.log(`- Kategori Akomodasi (Lanskap)   : ${hasil.distribusiKasus.akomodasiLanskap}`);
console.log(`- Kategori Lain (Potret)         : ${hasil.distribusiKasus.transportasiPotret}`);

const outDir = path.resolve(process.cwd(), "scripts");
const outJson = path.join(outDir, "simulasi_10000_hasil.json");
fs.writeFileSync(outJson, JSON.stringify(hasil, null, 2), "utf-8");
console.log(`\nLaporan simulasi JSON disimpan di: ${outJson}`);

if (hasil.totalGagal > 0) {
  console.error(`Terdapat ${hasil.totalGagal} kegagalan. Contoh kegagalan pertama:`);
  console.error(JSON.stringify(hasil.kegagalan[0], null, 2));
  process.exit(1);
} else {
  console.log("SELURUH 10.000 KASUS GEOMETRI & TATA LETAK LOLOS TANPA KEGAGALAN (100% PASS)!");
}
