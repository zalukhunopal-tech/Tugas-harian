/**
 * Uji dokumen Word laporan kegiatan: daftar perdiem berformat timesheet berada di bagian (section) lanskap paling depan, bagian
 * lain tetap potret, perpindahan bagian tidak menyisakan halaman kosong, dan urutannya: timesheet, identitas, penerimaan dana,
 * tiap kategori (tabel lalu bukti), rekapitulasi penyelesaian dana, daftar periksa. Semua foto bukti sebuah pengeluaran tersisip
 * (bukan hanya foto pertama) dan ringkasan penyelesaian berupa kartu bertabel. Jalankan: npx tsx scripts/uji_docx_perdiem.ts
 */
import JSZip from "jszip";
import { deflateSync } from "node:zlib";
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

/** PNG polos w × h (tanpa pustaka gambar) sebagai data URL, untuk foto bukti contoh. */
function pngDataUrl(w: number, h: number, warna: [number, number, number]): string {
  const crcTabel = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTabel[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const potong = (jenis: string, data: Buffer) => {
    const isi = Buffer.concat([Buffer.from(jenis), data]);
    const panjang = Buffer.alloc(4);
    panjang.writeUInt32BE(data.length);
    const cek = Buffer.alloc(4);
    cek.writeUInt32BE(crc(isi));
    return Buffer.concat([panjang, isi, cek]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const baris = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) baris.set(warna, y * (w * 3 + 1) + 1 + x * 3);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), potong("IHDR", ihdr), potong("IDAT", deflateSync(baris)), potong("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

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
        trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", deskripsi: `Penerimaan Dana ${kegiatan.nama}`, jumlah: 5000000, tanggal: "2026-09-20" }),
        trx({ deskripsi: "Makan siang tim", detailKegiatan: { penerimaManfaat: ["Andi Pratama"], konsumsi: { penyedia: "Warung Contoh", noTelp: "0811000111", lokasi: "Balai Desa", jumlahPeserta: 12 } } }),
        perdiem("2026-09-21"),
        perdiem("2026-09-22"),
        perdiem("2026-09-23"),
      ],
      kegiatan,
      profilPelapor: profil,
    })
  );
  cek("dua bagian: lanskap (timesheet) paling depan, lalu potret", dengan.map((b) => (b.lanskap ? "L" : "P")).join("") === "LP", dengan.map((b) => [b.lebar, b.tinggi]));
  // 297 mm = 16838 twip, 210 mm = 11906 twip (docx membulatkan ke bawah satu twip).
  const kira = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) <= 2;
  cek("bagian lanskap berukuran A4 lanskap (297 x 210 mm)", kira(dengan[0]?.lebar, 16838) && kira(dengan[0]?.tinggi, 11906), dengan[0] && [dengan[0].lebar, dengan[0].tinggi]);
  cek("bagian potret A4 (210 x 297 mm)", kira(dengan[1]?.lebar, 11906) && kira(dengan[1]?.tinggi, 16838), dengan[1] && [dengan[1].lebar, dengan[1].tinggi]);
  cek("daftar perdiem ada di bagian lanskap", /Uang Harian \(Per Diem\) Kegiatan Lapangan/.test(dengan[0]?.teks ?? "") && !/Uang Harian \(Per Diem\) Kegiatan Lapangan/.test(dengan[1]?.teks ?? ""));
  cek("bagian lanskap hanya berisi timesheet (tanpa identitas atau kategori lain)", !/KONSUMSI|Rekapitulasi|IDENTITAS|Nama Pelapor/.test(dengan[0]?.teks ?? ""));
  const potret = dengan[1]?.teks ?? "";
  const pos = (re: RegExp) => potret.search(re);
  cek("kelompok lain (Konsumsi) di bagian potret", /KONSUMSI/.test(potret));
  cek("urutan potret: identitas, penerimaan dana, kategori, rekapitulasi, daftar periksa", pos(/Nama Pelapor/) < pos(/Penerimaan Dana \(Dana Awal Kegiatan\)/) && pos(/Penerimaan Dana \(Dana Awal Kegiatan\)/) < pos(/KONSUMSI/) && pos(/KONSUMSI/) < pos(/Rekapitulasi Penggunaan Dana/) && pos(/Rekapitulasi Penggunaan Dana/) < pos(/DAFTAR PERIKSA KELENGKAPAN/), [pos(/Nama Pelapor/), pos(/Penerimaan Dana \(Dana Awal Kegiatan\)/), pos(/KONSUMSI/), pos(/Rekapitulasi Penggunaan Dana/), pos(/DAFTAR PERIKSA KELENGKAPAN/)]);
  cek("daftar periksa di bagian potret terakhir", /DAFTAR PERIKSA KELENGKAPAN/.test(potret));
  cek("tanpa baris batas penyerahan laporan fisik", !/Batas Penyerahan|terlambat \d+ hari/.test(potret));
  cek("judul kegiatan tidak diulang pada tabel penerimaan dana", (potret.match(/Kegiatan Contoh/gi) ?? []).length === 1, (potret.match(/Kegiatan Contoh/gi) ?? []).length);
  cek("uraian penerimaan dana bersih: 'Penerimaan Dana Kegiatan'", /Penerimaan Dana Kegiatan/.test(potret));
  cek("tabel kategori memuat Diklaim untuk: pelapor lalu rekan", /Diklaim untuk: Budi Santoso, Andi Pratama/.test(potret));
  cek("tabel kategori memuat penyedia, telepon, lokasi, peserta konsumsi", /Penyedia: Warung Contoh/.test(potret) && /0811000111/.test(potret) && /Lokasi: Balai Desa/.test(potret) && /Peserta: 12 orang/.test(potret));
  cek("tabel kategori memuat metode pembayaran", /Metode: Tunai/.test(potret));
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
  cek("daftar perdiem lanskap di depan, halaman bukti sesudahnya potret", berbukti.map((b) => (b.lanskap ? "L" : "P")).join("") === "LP", berbukti.map((b) => [b.lebar, b.tinggi]));
  cek("tanpa pemisah halaman tambahan", berbukti.slice(1).every((b) => !b.awalPisahHalaman));

  console.log("Semua foto bukti tersisip dan ringkasan penyelesaian bertabel");
  const fotoBukti = (i: number, warna: [number, number, number]) => ({ id: `fb${i}`, nama: `tiket${i}.png`, tipe: "image/png", dataUrl: pngDataUrl(120, 80, warna) });
  const blobFoto = await buatDokumenLaporanKegiatanDocx({
    transaksi: [
      trx({ jenis: "pemasukan", kategori: "Penerimaan Dana", deskripsi: "Penerimaan Dana Kegiatan", jumlah: 3000000, tanggal: "2026-09-20" }),
      // Tiga orang ikut klaim tiket speedboat: tiga foto tiket
      trx({
        deskripsi: "Tiket speedboat",
        kategori: "Transportasi",
        jumlah: 900000,
        bukti: [fotoBukti(1, [200, 120, 100]), fotoBukti(2, [100, 160, 200]), fotoBukti(3, [120, 190, 120])],
        detailKegiatan: { jenisBukti: "Tiket", transportasi: { moda: "Speedboat / Kapal" }, penerimaManfaat: ["Andi", "Rina"] },
      }),
      // Struk snack perjalanan: foto pertama di sebelah kotak struk, foto kedua di bawahnya
      trx({ deskripsi: "Snack perjalanan", jumlah: 120000, bukti: [fotoBukti(4, [210, 190, 120]), fotoBukti(5, [160, 130, 200])], detailKegiatan: { jenisBukti: "Struk thermal (minimarket/SPBU)" } }),
    ],
    kegiatan,
    profilPelapor: profil,
    sertakanDaftarPeriksa: false,
  });
  const zipFoto = await JSZip.loadAsync(await blobFoto.arrayBuffer());
  const media = Object.keys(zipFoto.files).filter((n) => n.startsWith("word/media/") && !zipFoto.files[n].dir);
  cek("kelima foto bukti tersisip (tiga tiket dan dua foto struk)", media.length === 5, media);
  const xmlFoto = await zipFoto.file("word/document.xml")!.async("string");
  const teksFoto = xmlFoto.replace(/<[^>]+>/g, "");
  const jumlahKotakPutus = (xmlFoto.match(/w:val="dashed"/g) ?? []).length;
  cek("jumlah kotak tempel di document.xml sesuai dengan jumlah foto (5 kotak)", jumlahKotakPutus >= 5, jumlahKotakPutus);
  cek("tiap foto berpasangan dengan kotaknya berlabel Bukti n dari N", /Bukti 3 dari 3/.test(teksFoto) && /Bukti 2 dari 2/.test(teksFoto));
  cek("ringkasan penyelesaian: pita judul, total diakui, status, dan rumus", /RINGKASAN PENYELESAIAN DANA KEGIATAN/.test(teksFoto) && /Total pengeluaran yang diakui/.test(teksFoto) && /SISA DANA YANG HARUS DIKEMBALIKAN/i.test(teksFoto) && /Dana awal Rp\s?3\.000\.000 − total pengeluaran yang diakui/.test(teksFoto));
  cek("ringkasan tanpa garis titik-titik", !/\.{6,}/.test(teksFoto));

  console.log("Nama penandatangan pada dokumen Word mengikuti isian form kegiatan");
  const blobTtd = await buatDokumenLaporanKegiatanDocx({
    transaksi: [perdiem("2026-09-21")],
    kegiatan: {
      ...kegiatan,
      penandatangan: {
        dilaporkanOleh: "Sari Wulandari",
        disetujuiOleh: "Rudi Hartono",
      },
      timesheetKop: {
        nama: "Nama Lama Drive",
        disetujuiOleh: "Penyetuju Lama Drive",
      },
    },
    profilPelapor: profil,
  });
  const zipTtd = await JSZip.loadAsync(await blobTtd.arrayBuffer());
  const teksTtd = (await zipTtd.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, " ");
  cek("Dilaporkan Oleh di Word mengikuti penandatangan form kegiatan", /Dilaporkan Oleh\s*:\s*Sari Wulandari/.test(teksTtd), teksTtd);
  cek("Disetujui Oleh di Word mengikuti penandatangan form kegiatan", /Disetujui Oleh\s*:\s*Rudi Hartono/.test(teksTtd), teksTtd);
  cek("kop timesheet Drive tidak dipakai diam-diam di Word", !teksTtd.includes("Nama Lama Drive") && !teksTtd.includes("Penyetuju Lama Drive"));

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
