/**
 * Uji dokumen Word laporan kegiatan: daftar perdiem berformat timesheet berada di bagian (section) lanskap, bagian lain
 * tetap potret, dan perpindahan bagian tidak menyisakan halaman kosong. Jalankan: npx tsx scripts/uji_docx_perdiem.ts
 */
import JSZip from "jszip";
import { buatDokumenLaporanKegiatanDocx } from "../src/lib/docxGenerator";
import type { DataKegiatan, ProfilPelapor, Transaksi } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

// Penyimpanan browser tidak ada di Node; generator hanya membacanya secara opsional.
const peta = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => peta.get(k) ?? null,
  setItem: (k: string, v: string) => void peta.set(k, v),
  removeItem: (k: string) => void peta.delete(k),
};

const kegiatan: DataKegiatan = {
  id: "kg1",
  nama: "Kegiatan Contoh",
  lokasi: "Kota Contoh",
  tanggalMulai: "2026-09-20",
  tanggalSelesai: "2026-09-25",
  batch: 2,
} as DataKegiatan;
const profil = { nama: "Budi Santoso", jabatan: "Staf", lembaga: "Lembaga Contoh", proyek: "Proyek Contoh", penyetuju: "Sari Wulandari" } as ProfilPelapor;

let urut = 0;
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: `t${++urut}`,
  jenis: "pengeluaran",
  dana: "Dana Kegiatan",
  tanggal: "2026-09-21",
  deskripsi: "Pengeluaran contoh",
  kategori: "Konsumsi",
  jumlah: 150000,
  metode: "Tunai",
  kaitan: kegiatan.nama,
  catatan: "",
  kegiatanId: kegiatan.id,
  bukti: [],
  ...o,
});
const perdiem = (tanggal: string, o: Partial<Transaksi> = {}) =>
  trx({ kategori: "Perdiem", deskripsi: `Perdiem Contoh · ${tanggal}`, tanggal, jumlah: 200000, ...o });

interface Bagian {
  lanskap: boolean;
  lebar: number;
  tinggi: number;
  teks: string;
  awalPisahHalaman: boolean;
}

/** Pecah document.xml per bagian: tiap w:sectPr menutup bagian yang isinya ada sebelum dia. */
async function bacaBagian(blob: Blob): Promise<Bagian[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  const tubuh = xml.slice(xml.indexOf("<w:body>") + 8, xml.lastIndexOf("</w:body>"));
  const hasil: Bagian[] = [];
  const rx = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/g;
  let awal = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(tubuh))) {
    const isi = tubuh.slice(awal, m.index);
    const ukuran = /<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"[^>]*?(?:w:orient="(\w+)")?/.exec(m[0]);
    const lebar = Number(ukuran?.[1] ?? 0);
    const tinggi = Number(ukuran?.[2] ?? 0);
    const paragrafPertama = /<w:p\b[\s\S]*?<\/w:p>/.exec(isi)?.[0] ?? "";
    hasil.push({
      lanskap: lebar > tinggi,
      lebar,
      tinggi,
      teks: isi.replace(/<[^>]+>/g, " "),
      awalPisahHalaman: /<w:pageBreakBefore\b(?![^>]*w:val="(?:false|0)")/.test(paragrafPertama),
    });
    awal = m.index + m[0].length;
  }
  return hasil;
}

async function main() {
  console.log("Laporan dengan perdiem tanpa bukti");
  const dengan = await bacaBagian(
    await buatDokumenLaporanKegiatanDocx({
      transaksi: [
        trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", deskripsi: "Dana awal", jumlah: 5000000, tanggal: "2026-09-20" }),
        trx({ deskripsi: "Makan siang tim" }),
        perdiem("2026-09-21"),
        perdiem("2026-09-22"),
        perdiem("2026-09-23"),
      ],
      kegiatan,
      profilPelapor: profil,
    })
  );
  cek("tiga bagian: potret, lanskap (perdiem), potret (daftar periksa)", dengan.map((b) => (b.lanskap ? "L" : "P")).join("") === "PLP", dengan.map((b) => [b.lebar, b.tinggi]));
  // 297 mm = 16838 twip, 210 mm = 11906 twip (docx membulatkan ke bawah satu twip).
  const kira = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) <= 2;
  cek("bagian lanskap berukuran A4 lanskap (297 x 210 mm)", kira(dengan[1]?.lebar, 16838) && kira(dengan[1]?.tinggi, 11906), dengan[1] && [dengan[1].lebar, dengan[1].tinggi]);
  cek("bagian potret A4 (210 x 297 mm)", kira(dengan[0]?.lebar, 11906) && kira(dengan[0]?.tinggi, 16838), dengan[0] && [dengan[0].lebar, dengan[0].tinggi]);
  cek("daftar perdiem ada di bagian lanskap", /Uang Harian \(Per Diem\) Kegiatan Lapangan/.test(dengan[1]?.teks ?? "") && !/Uang Harian \(Per Diem\) Kegiatan Lapangan/.test(dengan[0]?.teks ?? ""));
  cek("kelompok lain (Konsumsi) tetap di bagian potret", /KONSUMSI/.test(dengan[0]?.teks ?? "") && !/KONSUMSI/.test(dengan[1]?.teks ?? ""));
  cek("daftar periksa di bagian potret terakhir", /DAFTAR PERIKSA KELENGKAPAN/.test(dengan[2]?.teks ?? ""));
  cek("bagian baru tidak diawali pemisah halaman tambahan (tanpa halaman kosong)", dengan.slice(1).every((b) => !b.awalPisahHalaman), dengan.map((b) => b.awalPisahHalaman));

  console.log("Perdiem yang punya bukti");
  const bukti = { id: "b1", nama: "Bukti", tipe: "application/pdf", driveLink: "https://drive.example.org/b1" };
  const berbukti = await bacaBagian(
    await buatDokumenLaporanKegiatanDocx({
      transaksi: [perdiem("2026-09-21", { bukti: [bukti] }), perdiem("2026-09-22")],
      kegiatan,
      profilPelapor: profil,
      sertakanDaftarPeriksa: false,
    })
  );
  cek("daftar perdiem lanskap, lalu halaman bukti kembali potret", berbukti.map((b) => (b.lanskap ? "L" : "P")).join("") === "PLP", berbukti.map((b) => [b.lebar, b.tinggi]));
  cek("tanpa pemisah halaman tambahan", berbukti.slice(1).every((b) => !b.awalPisahHalaman));

  console.log("Laporan tanpa perdiem");
  const tanpa = await bacaBagian(
    await buatDokumenLaporanKegiatanDocx({ transaksi: [trx({ deskripsi: "Makan siang tim" })], kegiatan, profilPelapor: profil })
  );
  cek("satu bagian potret saja", tanpa.length === 1 && !tanpa[0].lanskap, tanpa.map((b) => [b.lebar, b.tinggi]));

  if (gagal) {
    console.log(`\n${gagal} uji gagal`);
    process.exit(1);
  }
  console.log("\nSemua uji lolos");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
