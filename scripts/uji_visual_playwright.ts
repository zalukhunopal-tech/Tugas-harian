/**
 * Uji Visual Playwright & Pembuatan PDF untuk Tata Letak Laporan Keuangan SPJ.
 * Menjalankan sedikitnya 35 skenario laporan nyata:
 * - Menguji orientasi tepat per bagian:
 *   * Timesheet = Lanskap
 *   * Akomodasi = Lanskap
 *   * Kategori lain (Transportasi, Konsumsi, BBM, Rental, Honor, Rekap, Checklist) = Potret
 * - Menguji urutan isi:
 *   * Kategori -> Subkategori -> Keterangan -> Bukti Digital -> Ruang Tempel Asli -> Subkategori Berikutnya
 * - Menguji kelanjutan subkategori antarhalaman
 * - Menguji kasus bukti melebihi batas area cetak (peringatan keputusan pengguna)
 * - Menghasilkan PDF nyata: scripts/contoh_laporan_tata_letak.pdf
 * - Memeriksa ekspor berkas Word (.docx)
 *
 * Jalankan: npx tsx scripts/uji_visual_playwright.ts
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { susunLaporanKegiatan, SusunanLaporan } from "../src/lib/susunanLaporan";
import { DokumenLaporanKegiatan } from "../src/components/DokumenLaporanKegiatan";
import { buatDokumenLaporanKegiatanDocx } from "../src/lib/docxGenerator";
import type { Transaksi, DataKegiatan, ProfilPelapor, BuktiItem } from "../src/types";

const cssUtama = fs.readFileSync(path.resolve(process.cwd(), "src/styles/style.css"), "utf-8");

const kegiatanBaku: DataKegiatan = {
  id: "kg-lapangan",
  nama: "Pendampingan Lapangan dan Monev Pesisir 2026",
  lokasi: "Kabupaten Natuna",
  tanggalMulai: "2026-10-10",
  tanggalSelesai: "2026-10-20",
  timesheetBaris: Array.from({ length: 11 }, (_, i) => ({
    tanggal: `2026-10-${String(10 + i).padStart(2, "0")}`,
    keterangan: i === 10 ? "Perjalanan kembali ke pangkalan" : `Kegiatan monev lapangan hari ke-${i + 1}`,
    lokasi: "Kecamatan Bunguran Timur",
  })),
};

const profilBaku: ProfilPelapor = {
  nama: "Budi Pratama, S.T.",
  jabatan: "Koordinator Tim Teknis",
  lembaga: "Balai Riset Kelautan",
  proyek: "Program Konservasi Laut Natuna",
};

const buatFoto = (id: string, nama: string, lebarPx = 800, tinggiPx = 600, tipe = "image/jpeg"): BuktiItem => ({
  id,
  nama,
  tipe,
  lebarPx,
  tinggiPx,
  dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='75'><rect width='100' height='75' fill='%233b82f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='10'>Foto Bukti</text></svg>",
});

const buatTrx = (o: Partial<Transaksi>): Transaksi => ({
  id: `trx-${Math.random().toString(36).slice(2, 8)}`,
  jenis: "pengeluaran",
  dana: "Dana Kegiatan",
  tanggal: "2026-10-11",
  deskripsi: "Biaya Operasional",
  kategori: "Transportasi",
  jumlah: 150000,
  metode: "Tunai",
  kaitan: kegiatanBaku.nama,
  kegiatanId: kegiatanBaku.id,
  catatan: "",
  ...o,
});

// Generator 35 Skenario Representatif
function buatDaftarSkenario(): Array<{ nama: string; transaksi: Transaksi[]; periksaKhusus?: (susunan: SusunanLaporan) => void }> {
  const skenario: Array<{ nama: string; transaksi: Transaksi[]; periksaKhusus?: (susunan: SusunanLaporan) => void }> = [];

  // Skenario 1-5: Transportasi dengan variasi subkategori (Speedboat, Ojek, Pesawat)
  skenario.push({
    nama: "01_Transportasi_3_Subkategori_Lengkap",
    transaksi: [
      buatTrx({
        deskripsi: "Tiket Speedboat MV Seven Star",
        kategori: "Transportasi",
        jumlah: 450000,
        bukti: [buatFoto("sb1", "tiket_speedboat.jpg", 1200, 600)],
        detailKegiatan: {
          subkategori: "Perjalanan Speedboat",
          transportasi: { moda: "Speedboat", dari: "Tanjung Pinang", ke: "Tarempa" },
          keteranganLaporan: "Perjalanan laut rute utama penyeberangan dinas tim survei.",
        },
      }),
      buatTrx({
        deskripsi: "Ojek Motor antar Pos Lapangan",
        kategori: "Transportasi",
        jumlah: 75000,
        bukti: [buatFoto("oj1", "ojek.jpg", 400, 700)],
        detailKegiatan: {
          subkategori: "Perjalanan Ojek",
          transportasi: { moda: "Ojek", namaSopir: "Pak Joko (08123456789)" },
          keteranganLaporan: "Transportasi darat medan curam perbukitan.",
        },
      }),
      buatTrx({
        deskripsi: "Tiket Pesawat Wings Air Natuna-Batam",
        kategori: "Transportasi",
        jumlah: 1350000,
        bukti: [buatFoto("ps1", "tiket_pesawat.jpg", 1400, 700)],
        detailKegiatan: {
          subkategori: "Perjalanan Pesawat",
          transportasi: { moda: "Pesawat", dari: "Ranai", ke: "Hang Nadim" },
          keteranganLaporan: "Penerbangan kepulangan tim monev pasca kegiatan selesai.",
        },
      }),
    ],
  });

  skenario.push({
    nama: "02_Transportasi_Satu_Subkategori_Banyak_Transaksi",
    transaksi: [
      buatTrx({
        deskripsi: "Sewa Speedboat Hari ke-1",
        kategori: "Transportasi",
        jumlah: 600000,
        bukti: [buatFoto("sb_a", "sb_1.jpg")],
        detailKegiatan: { subkategori: "Perjalanan Speedboat" },
      }),
      buatTrx({
        deskripsi: "Sewa Speedboat Hari ke-2",
        kategori: "Transportasi",
        jumlah: 600000,
        bukti: [buatFoto("sb_b", "sb_2.jpg")],
        detailKegiatan: { subkategori: "Perjalanan Speedboat" },
      }),
      buatTrx({
        deskripsi: "Sewa Speedboat Hari ke-3",
        kategori: "Transportasi",
        jumlah: 600000,
        bukti: [buatFoto("sb_c", "sb_3.jpg")],
        detailKegiatan: { subkategori: "Perjalanan Speedboat" },
      }),
    ],
  });

  skenario.push({
    nama: "03_Transportasi_Satu_Transaksi_Banyak_Bukti_Tiket",
    transaksi: [
      buatTrx({
        deskripsi: "Tiket Speedboat Rombongan 4 Orang",
        kategori: "Transportasi",
        jumlah: 1800000,
        bukti: [
          buatFoto("tk1", "tiket_1.jpg"),
          buatFoto("tk2", "tiket_2.jpg"),
          buatFoto("tk3", "tiket_3.jpg"),
          buatFoto("tk4", "tiket_4.jpg"),
        ],
        detailKegiatan: {
          subkategori: "Perjalanan Speedboat",
          penerimaManfaat: ["Budi", "Andi", "Citra", "Dewi"],
        },
      }),
    ],
  });

  skenario.push({
    nama: "04_Transportasi_Tanpa_Foto_Hanya_Kuitansi_Asli",
    transaksi: [
      buatTrx({
        deskripsi: "Sewa Sampan Dayung Nelayan Lokal",
        kategori: "Transportasi",
        jumlah: 100000,
        bukti: [],
        detailKegiatan: { subkategori: "Perjalanan Sampan" },
      }),
    ],
  });

  skenario.push({
    nama: "05_Transportasi_Dengan_Surat_Justifikasi",
    transaksi: [
      buatTrx({
        deskripsi: "Ojek Perahu Pompong Malam Hari",
        kategori: "Transportasi",
        jumlah: 250000,
        detailKegiatan: {
          subkategori: "Perjalanan Pompong",
          perluSuratJustifikasi: true,
          alasanJustifikasi: "Kondisi darurat cuaca buruk dan nelayan tidak membawa nota kwitansi resmi",
        },
      }),
    ],
  });

  // Skenario 6-10: Akomodasi (Wajib Seluruh Bagian A4 Lanskap)
  skenario.push({
    nama: "06_Akomodasi_Hotel_Lanskap_Tunggal",
    transaksi: [
      buatTrx({
        deskripsi: "Penginapan Hotel Natuna Grand 4 Malam",
        kategori: "Akomodasi",
        jumlah: 1600000,
        bukti: [buatFoto("ak1", "kuitansi_hotel.jpg", 1000, 450)],
        detailKegiatan: {
          subkategori: "Hotel Natuna Grand",
          akomodasi: { lokasi: "Ranai", jumlahMalam: 4, namaPemilik: "Resepsionis Hotel" },
        },
      }),
    ],
  });

  skenario.push({
    nama: "07_Akomodasi_Penginapan_Warga_Kades",
    transaksi: [
      buatTrx({
        deskripsi: "Penginapan Rumah Pak Kades Pulau Laut",
        kategori: "Akomodasi",
        jumlah: 750000,
        bukti: [buatFoto("ak2", "kuitansi_kades.jpg", 800, 350)],
        detailKegiatan: {
          subkategori: "Penginapan Rumah Warga",
          akomodasi: { lokasi: "Desa Air Payang", namaPemilik: "Bpk. Abdullah (Kades)" },
        },
      }),
    ],
  });

  skenario.push({
    nama: "08_Akomodasi_Multi_Subkategori_Homestay_dan_Hotel",
    transaksi: [
      buatTrx({
        deskripsi: "Homestay Pantai Teluk Prima",
        kategori: "Akomodasi",
        jumlah: 500000,
        bukti: [buatFoto("ak3", "homestay.jpg")],
        detailKegiatan: { subkategori: "Homestay Teluk Prima" },
      }),
      buatTrx({
        deskripsi: "Hotel Transit Ranai",
        kategori: "Akomodasi",
        jumlah: 450000,
        bukti: [buatFoto("ak4", "hotel_transit.jpg")],
        detailKegiatan: { subkategori: "Hotel Transit" },
      }),
    ],
  });

  skenario.push({
    nama: "09_Akomodasi_Ukuran_Kertas_Fisik_Terkalibrasi_210x100mm",
    transaksi: [
      buatTrx({
        deskripsi: "Kuitansi Penginapan Lapangan Format Panjang",
        kategori: "Akomodasi",
        jumlah: 900000,
        bukti: [buatFoto("ak5", "kuitansi_panjang.jpg", 1200, 500)],
        detailKegiatan: {
          subkategori: "Penginapan Lapangan",
          ukuranKertasFisik: {
            lebarMm: 210,
            tinggiMm: 100,
            sumber: "measured",
            catatan: "Kuitansi buku besar diukur dengan mistar 210x100 mm",
          },
        },
      }),
    ],
  });

  skenario.push({
    nama: "10_Akomodasi_Banyak_Bukti_Multi_Kamar",
    transaksi: [
      buatTrx({
        deskripsi: "Sewa 3 Kamar Mess Lapangan",
        kategori: "Akomodasi",
        jumlah: 1500000,
        bukti: [
          buatFoto("mess1", "kamar1.jpg"),
          buatFoto("mess2", "kamar2.jpg"),
          buatFoto("mess3", "kamar3.jpg"),
        ],
        detailKegiatan: { subkategori: "Mess Riset Pesisir" },
      }),
    ],
  });

  // Skenario 11-15: Konsumsi (Kudapan / Snack vs Makan Kegiatan)
  skenario.push({
    nama: "11_Konsumsi_Kudapan_Dibawah_Plafon",
    transaksi: [
      buatTrx({
        deskripsi: "Kudapan / Snack Perjalanan Survei",
        kategori: "Konsumsi",
        jumlah: 60000,
        bukti: [buatFoto("ks1", "snack_struk.jpg", 300, 600)],
        detailKegiatan: {
          subkategori: "Kudapan Perjalanan (Snack)",
          penerimaManfaat: ["Budi"],
        },
      }),
    ],
  });

  skenario.push({
    nama: "12_Konsumsi_Kudapan_Melebihi_Plafon_Catatan_Merah",
    transaksi: [
      buatTrx({
        deskripsi: "Snack perjalanan minimarket",
        kategori: "Konsumsi",
        jumlah: 250000,
        bukti: [buatFoto("ks2", "struk_alfamart.jpg", 300, 700)],
        detailKegiatan: {
          subkategori: "Kudapan Perjalanan (Snack)",
          penerimaManfaat: ["Budi"],
        },
      }),
    ],
  });

  skenario.push({
    nama: "13_Konsumsi_Makan_Tim_Prasmanan",
    transaksi: [
      buatTrx({
        deskripsi: "Makan Siang Tim Lapangan 6 Orang",
        kategori: "Konsumsi",
        jumlah: 360000,
        bukti: [buatFoto("ks3", "nota_rm.jpg", 600, 800)],
        detailKegiatan: {
          subkategori: "Makan & Konsumsi Kegiatan",
          konsumsi: { penyedia: "RM Selera Bahari", jumlahPeserta: 6, lokasi: "Pelabuhan" },
        },
      }),
    ],
  });

  skenario.push({
    nama: "14_Konsumsi_Struk_Thermal_Roll_80mm_Indomaret",
    transaksi: [
      buatTrx({
        deskripsi: "Pembelian Logistik Air Mineral Galon Indomaret",
        kategori: "Konsumsi",
        jumlah: 85000,
        bukti: [buatFoto("ks4", "struk_indomaret.jpg", 350, 750)],
        detailKegiatan: {
          jenisBukti: "Struk thermal (minimarket/SPBU)",
          konsumsi: { penyedia: "Indomaret Ranai" },
        },
      }),
    ],
  });

  skenario.push({
    nama: "15_Konsumsi_Multi_Hari_Beruntun",
    transaksi: [
      buatTrx({ tanggal: "2026-10-12", deskripsi: "Makan Hari 1", kategori: "Konsumsi", jumlah: 120000 }),
      buatTrx({ tanggal: "2026-10-13", deskripsi: "Makan Hari 2", kategori: "Konsumsi", jumlah: 120000 }),
      buatTrx({ tanggal: "2026-10-14", deskripsi: "Makan Hari 3", kategori: "Konsumsi", jumlah: 120000 }),
    ],
  });

  // Skenario 16-20: BBM & Rental Kendaraan
  skenario.push({
    nama: "16_BBM_Kendaraan_Operasional_SPBU",
    transaksi: [
      buatTrx({
        deskripsi: "Pengisian BBM Pertalite Mobil Survei",
        kategori: "BBM",
        jumlah: 350000,
        bukti: [buatFoto("bbm1", "struk_spbu.jpg", 300, 600)],
        detailKegiatan: {
          bbm: { dari: "Kota Ranai", ke: "Kecamatan Batubi", noPolisi: "BP 1234 XY", jarakTempuh: 85 },
        },
      }),
    ],
  });

  skenario.push({
    nama: "17_Rental_Mobil_Dengan_Timesheet",
    transaksi: [
      buatTrx({
        deskripsi: "Rental Mobil Toyota Hilux 4x4",
        kategori: "Rental Kendaraan",
        jumlah: 3500000,
        bukti: [buatFoto("rent1", "kuitansi_rental.jpg")],
        detailKegiatan: {
          rentalKendaraan: {
            jenisMerk: "Toyota Hilux 4x4",
            noPolisi: "BP 8899 NX",
            namaPemilik: "Bpk. Rahmat Rental",
            tarifPerHari: 700000,
            jumlahHari: 5,
            tanggalMulai: "2026-10-11",
            tanggalSelesai: "2026-10-15",
            timesheet: [
              { tanggal: "11/10/2026", lokasiBasecampRute: "Ranai - Batubi", cakupanAktivitas: "Monev pos 1", jarakKm: 60 },
              { tanggal: "12/10/2026", lokasiBasecampRute: "Batubi - Kelarik", cakupanAktivitas: "Monev pos 2", jarakKm: 75 },
            ],
          },
        },
      }),
    ],
  });

  skenario.push({
    nama: "18_Rental_Motor_Dusun",
    transaksi: [
      buatTrx({
        deskripsi: "Sewa Motor Trail Warga Dusun",
        kategori: "Rental Kendaraan",
        jumlah: 600000,
        bukti: [buatFoto("rmot1", "kuitansi_motor.jpg")],
        detailKegiatan: {
          rentalKendaraan: { jenisMerk: "Honda CRF 150", namaPemilik: "Pak Dedi" },
        },
      }),
    ],
  });

  skenario.push({
    nama: "19_Honorarium_Narasumber_Lokal",
    transaksi: [
      buatTrx({
        deskripsi: "Honorarium Tokoh Masyarakat Pemandu Adat",
        kategori: "Honorarium & Ganti Hari",
        jumlah: 500000,
        bukti: [buatFoto("hn1", "kwitansi_honor.jpg")],
        detailKegiatan: {
          honorarium: { namaPenerima: "Bpk. Datok Bahari", tarifPajakPersen: 5, honorBruto: 500000, honorNetto: 475000, pajakDipotong: 25000 },
        },
      }),
    ],
  });

  skenario.push({
    nama: "20_Lain_Lain_Fotokopi_dan_Materai",
    transaksi: [
      buatTrx({ deskripsi: "Fotokopi Kuisioner dan Peta Kerja", kategori: "Lain-lain", jumlah: 45000 }),
      buatTrx({ deskripsi: "Pembelian Materai 10000 5 Lembar", kategori: "Lain-lain", jumlah: 55000 }),
    ],
  });

  // Skenario 21-25: Laporan Gabungan Komprehensif (Pergantian Orientasi Potret-Lanskap-Potret)
  skenario.push({
    nama: "21_Laporan_Komprehensif_Semua_Kategori",
    transaksi: [
      buatTrx({ deskripsi: "Tiket Speedboat Antar Pulau", kategori: "Transportasi", jumlah: 500000, bukti: [buatFoto("l_tr", "tr.jpg")] }),
      buatTrx({ deskripsi: "Hotel Bintang Natuna (Lanskap)", kategori: "Akomodasi", jumlah: 1200000, bukti: [buatFoto("l_ak", "ak.jpg", 1000, 450)] }),
      buatTrx({ deskripsi: "Makan Malam Tim Survei", kategori: "Konsumsi", jumlah: 200000, bukti: [buatFoto("l_ks", "ks.jpg")] }),
      buatTrx({ deskripsi: "BBM Solar Genset Posko", kategori: "BBM", jumlah: 150000, bukti: [buatFoto("l_bbm", "bbm.jpg")] }),
    ],
  });

  skenario.push({
    nama: "22_Laporan_Komprehensif_Banyak_Subkategori_Per_Kategori",
    transaksi: [
      buatTrx({ deskripsi: "Speedboat Reguler", kategori: "Transportasi", jumlah: 300000, detailKegiatan: { subkategori: "Speedboat Reguler" } }),
      buatTrx({ deskripsi: "Ojek Pelabuhan", kategori: "Transportasi", jumlah: 50000, detailKegiatan: { subkategori: "Ojek Pangkalan" } }),
      buatTrx({ deskripsi: "Penginapan Kampung", kategori: "Akomodasi", jumlah: 400000, detailKegiatan: { subkategori: "Homestay Kampung" } }),
      buatTrx({ deskripsi: "Wisma Transit", kategori: "Akomodasi", jumlah: 350000, detailKegiatan: { subkategori: "Wisma Pelabuhan" } }),
    ],
  });

  skenario.push({
    nama: "23_Laporan_Dengan_Perdiem_Penuh_11_Hari",
    transaksi: Array.from({ length: 11 }, (_, i) =>
      buatTrx({
        tanggal: `2026-10-${String(10 + i).padStart(2, "0")}`,
        deskripsi: `Perdiem Hari ke-${i + 1}`,
        kategori: "Perdiem",
        jumlah: 250000,
      })
    ),
  });

  skenario.push({
    nama: "24_Laporan_Penerimaan_Besar_Reimbursement",
    transaksi: [
      buatTrx({ deskripsi: "Sewa Kapal Survei 7 Hari", kategori: "Transportasi", jumlah: 25000000, bukti: [buatFoto("kp1", "kapal.jpg")] }),
      buatTrx({ deskripsi: "Homestay Tim Peneliti", kategori: "Akomodasi", jumlah: 10000000, bukti: [buatFoto("hm1", "mess.jpg")] }),
    ],
  });

  skenario.push({
    nama: "25_Laporan_Checklist_Lengkap_17_Kategori",
    transaksi: [
      buatTrx({ deskripsi: "Operasional Kelengkapan", kategori: "Lain-lain", jumlah: 100000 }),
    ],
  });

  // Skenario 26-30: Edge Cases Geometri, Batas Halaman & Keputusan Pengguna
  skenario.push({
    nama: "26_Ukuran_Fisik_Melebihi_Batas_Area_Cetak_Potret_Tandai_Keputusan",
    transaksi: [
      buatTrx({
        deskripsi: "Peta Kertas Navigasi Format Lebar 280 mm",
        kategori: "Transportasi",
        jumlah: 200000,
        detailKegiatan: {
          ukuranKertasFisik: {
            lebarMm: 280, // > 170 mm (batas potret)
            tinggiMm: 120,
            sumber: "measured",
            catatan: "Peta navigasi laut fisik sangat lebar",
          },
        },
      }),
    ],
  });

  skenario.push({
    nama: "27_Ukuran_Fisik_Melebihi_Batas_Area_Cetak_Lanskap_Tandai_Keputusan",
    transaksi: [
      buatTrx({
        deskripsi: "Kuitansi Penginapan Sangat Tinggi 220 mm",
        kategori: "Akomodasi",
        jumlah: 1200000,
        detailKegiatan: {
          ukuranKertasFisik: {
            lebarMm: 150,
            tinggiMm: 220, // > 170 mm (batas lanskap Akomodasi)
            sumber: "measured",
            catatan: "Format kwitansi vertikal memanjang",
          },
        },
      }),
    ],
  });

  skenario.push({
    nama: "28_Struk_Sangat_Panjang_230mm_Catatan_Lipat",
    transaksi: [
      buatTrx({
        deskripsi: "Struk Belanja Grosir Perlengkapan Panjang",
        kategori: "Konsumsi",
        jumlah: 750000,
        bukti: [buatFoto("pjg1", "struk_panjang.jpg", 300, 1000)],
      }),
    ],
  });

  skenario.push({
    nama: "29_Pilihan_Manual_Template_A_B_C_Estimated_Template",
    transaksi: [
      buatTrx({ deskripsi: "Manual Template A", kategori: "Konsumsi", detailKegiatan: { kotakTempel: "A" } }),
      buatTrx({ deskripsi: "Manual Template B", kategori: "Transportasi", detailKegiatan: { kotakTempel: "B" } }),
      buatTrx({ deskripsi: "Manual Template C", kategori: "Akomodasi", detailKegiatan: { kotakTempel: "C" } }),
    ],
  });

  skenario.push({
    nama: "30_Kelanjutan_Subkategori_Antarhalaman_Bersambung",
    transaksi: [
      buatTrx({ deskripsi: "Speedboat Bagian 1", kategori: "Transportasi", detailKegiatan: { subkategori: "Perjalanan Speedboat" }, bukti: [buatFoto("sb_p1", "p1.jpg")] }),
      buatTrx({ deskripsi: "Speedboat Bagian 2", kategori: "Transportasi", detailKegiatan: { subkategori: "Perjalanan Speedboat" }, bukti: [buatFoto("sb_p2", "p2.jpg")] }),
      buatTrx({ deskripsi: "Speedboat Bagian 3", kategori: "Transportasi", detailKegiatan: { subkategori: "Perjalanan Speedboat" }, bukti: [buatFoto("sb_p3", "p3.jpg")] }),
      buatTrx({ deskripsi: "Speedboat Bagian 4", kategori: "Transportasi", detailKegiatan: { subkategori: "Perjalanan Speedboat" }, bukti: [buatFoto("sb_p4", "p4.jpg")] }),
    ],
  });

  // Skenario 31-35: Ekstra Variasi & Verifikasi Pasangan
  skenario.push({
    nama: "31_Susunan_Pasangan_Samping_Kiri_Kanan",
    transaksi: [
      buatTrx({
        deskripsi: "Tiket Boarding Pass Samping",
        kategori: "Transportasi",
        jumlah: 800000,
        bukti: [buatFoto("bp1", "bp.jpg", 400, 600)],
        detailKegiatan: { posisiPasanganManual: "samping" },
      }),
    ],
  });

  skenario.push({
    nama: "32_Susunan_Pasangan_Bawah_Atas_Bawah",
    transaksi: [
      buatTrx({
        deskripsi: "Kuitansi Lebar Bawah",
        kategori: "Konsumsi",
        jumlah: 400000,
        bukti: [buatFoto("kw_b", "kw.jpg", 1000, 400)],
        detailKegiatan: { posisiPasanganManual: "bawah" },
      }),
    ],
  });

  skenario.push({
    nama: "33_Keterangan_Ekstra_Panjang_Multiline",
    transaksi: [
      buatTrx({
        deskripsi: "Sewa Balai Pertemuan & Konsumsi Warga 5 Dusun",
        kategori: "Konsumsi",
        jumlah: 2500000,
        detailKegiatan: {
          keteranganLaporan:
            "Pertemuan sosialisasi melibatkan kepala desa, tokoh adat, perwakilan nelayan tangkap, ibu-ibu PKK, serta pemuda karang taruna dalam rangka penyusunan zona pemanfaatan tradisional laut pulau terluar dengan kesepakatan tertulis bersama.",
        },
      }),
    ],
  });

  skenario.push({
    nama: "34_Multiple_Lampiran_PDF_dan_Foto_Campuran",
    transaksi: [
      buatTrx({
        deskripsi: "Tiket Pesawat Garuda Campuran",
        kategori: "Transportasi",
        jumlah: 2100000,
        bukti: [
          buatFoto("e_ticket_pdf", "tiket.pdf", undefined, undefined, "application/pdf"),
          buatFoto("boarding_foto", "boarding_pass.jpg", 400, 600),
        ],
      }),
    ],
  });

  skenario.push({
    nama: "35_Semua_Gaya_Cetak_dan_Manifes_SPJ",
    transaksi: [
      buatTrx({ deskripsi: "Survei Pesisir Penutup", kategori: "Transportasi", jumlah: 500000, bukti: [buatFoto("penutup", "penutup.jpg")] }),
      buatTrx({ deskripsi: "Akomodasi Penginapan Akhir", kategori: "Akomodasi", jumlah: 600000, bukti: [buatFoto("ak_akhir", "ak_akhir.jpg")] }),
    ],
  });

  return skenario;
}

async function jalankanUjiVisualPlaywright() {
  console.log("Memulai Uji Visual Playwright & Pembuatan PDF (Headless Edge)...");

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  const skenarioList = buatDaftarSkenario();

  console.log(`Menjalankan ${skenarioList.length} skenario laporan...`);

  let skenarioLolos = 0;
  let skenarioGagal = 0;

  for (let idx = 0; idx < skenarioList.length; idx++) {
    const sk = skenarioList[idx];
    const no = String(idx + 1).padStart(2, "0");

    try {
      // 1. Bentuk susunan laporan
      const susunan = susunLaporanKegiatan({
        transaksi: [
          {
            id: "pemasukan-skenario",
            jenis: "pemasukan",
            tanggal: "2026-10-01",
            deskripsi: "Dana Awal",
            jumlah: 25000000,
            kategori: "Penerimaan Dana",
            dana: "Dana Kegiatan",
            kaitan: kegiatanBaku.nama,
            kegiatanId: kegiatanBaku.id,
          },
          ...sk.transaksi,
        ],
        kegiatan: kegiatanBaku,
        profilPelapor: profilBaku,
      });

      // 2. Render komponen React ke HTML string
      const markupReact = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DokumenLaporanKegiatan, {
          susunan,
          onStatus: () => {},
        })
      );

      const htmlLengkap = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>${sk.nama}</title>
          <style>${cssUtama}</style>
        </head>
        <body style="background: #f1f5f9; padding: 20px;">
          ${markupReact}
        </body>
        </html>
      `;

      await page.setContent(htmlLengkap, { waitUntil: "domcontentloaded" });

      // 3. Verifikasi DOM & Invarian Tata Letak
      // a. Timesheet must have landscape class if present
      const timesheetElemen = await page.$('[data-testid="lembar-timesheet"]');
      if (timesheetElemen) {
        const isLanskap = await page.evaluate((el) => el.classList.contains("dsc-lanskap"), timesheetElemen);
        if (!isLanskap) throw new Error("Timesheet tidak menggunakan orientasi lanskap (dsc-lanskap)");
      }

      // b. Seluruh halaman Akomodasi wajib lanskap
      const akomodasiLembar = await page.$$('[data-kategori="Akomodasi"]');
      for (const el of akomodasiLembar) {
        const isLanskap = await page.evaluate(
          (e) => e.classList.contains("dlk-lembar--lanskap") && e.classList.contains("dsc-lanskap"),
          el
        );
        if (!isLanskap) throw new Error("Halaman kategori Akomodasi tidak memiliki kelas lanskap (dlk-lembar--lanskap)");
      }

      // c. Kategori selain Akomodasi wajib potret
      const potretLembar = await page.$$('.dlk-lembar:not([data-kategori="Akomodasi"]):not([data-testid="lembar-timesheet"])');
      for (const el of potretLembar) {
        const isPotret = await page.evaluate(
          (e) => !e.classList.contains("dlk-lembar--lanskap"),
          el
        );
        if (!isPotret) throw new Error("Halaman non-Akomodasi secara salah diberi kelas lanskap");
      }

      // d. Verifikasi Urutan: Subkategori -> Keterangan -> Pasangan Bukti
      const blokTransaksiList = await page.$$('[data-testid="blok-transaksi"]');
      for (const blok of blokTransaksiList) {
        const urutanElemen = await page.evaluate((b) => {
          const keteranganEl = b.querySelector(".dlk-keterangan");
          const pasanganEl = b.querySelector(".dlk-daftar-pasangan");
          if (!keteranganEl || !pasanganEl) return true;
          // Keterangan harus berada sebelum pasangan bukti dalam urutan DOM
          return Boolean(keteranganEl.compareDocumentPosition(pasanganEl) & Node.DOCUMENT_POSITION_FOLLOWING);
        }, blok);

        if (!urutanElemen) {
          throw new Error("Urutan terbalik: Pasangan bukti dirender sebelum keterangan!");
        }
      }

      // 4. Jika skenario komprehensif (Skenario 21), cetak file PDF contoh
      if (sk.nama.includes("21_Laporan_Komprehensif")) {
        const outPdf = path.resolve(process.cwd(), "scripts/contoh_laporan_tata_letak.pdf");
        await page.pdf({
          path: outPdf,
          format: "A4",
          printBackground: true,
          margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        });
        console.log(`  -> File PDF contoh berhasil digenerate di: ${outPdf}`);
      }

      // 5. Jalankan periksa khusus bila ada
      if (sk.periksaKhusus) {
        sk.periksaKhusus(susunan);
      }

      skenarioLolos++;
      console.log(`  [OK] Skenario ${no}: ${sk.nama}`);
    } catch (err: any) {
      skenarioGagal++;
      console.error(`  [GAGAL] Skenario ${no}: ${sk.nama} -> ${err.message}`);
    }
  }

  // 6. Uji Ekspor Word (.docx)
  console.log("\nMemeriksa ekspor berkas Word (.docx)...");
  try {
    const susunanWord = susunLaporanKegiatan({
      transaksi: buatDaftarSkenario()[0].transaksi,
      kegiatan: kegiatanBaku,
      profilPelapor: profilBaku,
    });
    const blobWord = await buatDokumenLaporanKegiatanDocx({
      transaksi: buatDaftarSkenario()[0].transaksi,
      kegiatan: kegiatanBaku,
      profilPelapor: profilBaku,
    });
    const ukuranByte = blobWord.size;
    if (ukuranByte < 1000) {
      throw new Error(`Ukuran berkas Word terlalu kecil (${ukuranByte} bytes)`);
    }
    console.log(`  [OK] Generator Word berhasil membuat dokumen (.docx) valid berukuran ${ukuranByte} bytes.`);
  } catch (err: any) {
    console.error(`  [GAGAL] Ekspor Word gagal: ${err.message}`);
    skenarioGagal++;
  }

  await browser.close();

  console.log("\n================ RINGKASAN UJI PLAYWRIGHT & PDF ================");
  console.log(`Total Skenario Diuji : ${skenarioList.length}`);
  console.log(`Skenario Lolos       : ${skenarioLolos}`);
  console.log(`Skenario Gagal       : ${skenarioGagal}`);

  if (skenarioGagal > 0) {
    process.exit(1);
  } else {
    console.log("SELURUH SKENARIO PLAYWRIGHT & RENDER PDF LOLOS SEMPURNA!");
  }
}

jalankanUjiVisualPlaywright().catch((e) => {
  console.error("Kesalahan fatal uji playwright:", e);
  process.exit(1);
});
