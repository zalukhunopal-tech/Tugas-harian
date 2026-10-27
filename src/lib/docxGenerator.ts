import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  convertMillimetersToTwip,
  HeightRule,
  VerticalAlign,
  ShadingType,
  PageOrientation,
} from "docx";
import {
  Transaksi,
  ProfilPelapor,
  DataKegiatan,
  DataKhususKegiatan,
  BuktiItem,
  FotoPendukung,
} from "../types";
import {
  KELOMPOK_DANA_KEGIATAN,
  formatRupiah,
  formatAngka,
  hariIni, labelKategori } from "./constants";
import { hitungBatasLaporanFisik, KETENTUAN_DANA_KEGIATAN } from "./ketentuanKegiatan";
import { hitungPenyelesaian, KATEGORI_PERDIEM, transaksiKegiatan } from "./penyelesaianDana";
import { adalahKudapanPerjalanan, barisPenerimaManfaat } from "./penerimaManfaat";
import { DaftarPerdiemDokumen, susunDaftarPerdiem } from "./timesheet";
import { ambilSemuaBuktiOffline } from "./buktiStorage";

export interface OpsiLaporanDocx {
  transaksi: Transaksi[];
  kegiatan: DataKegiatan;
  /** Semua kegiatan, untuk memastikan penerimaan dana yang sudah dikaitkan ke kegiatan lain tidak ikut terhitung. */
  daftarKegiatan?: DataKegiatan[];
  profilPelapor: ProfilPelapor;
  urutanTransaksiIds?: string[];
  sertakanDaftarPeriksa?: boolean;
  googleToken?: string;
}

/**
 * Format tanggal Indonesia: "15 Agustus 2026"
 */
function formatTanggalIndo(tglStr?: string): string {
  if (!tglStr) return "-";
  try {
    const d = new Date(tglStr);
    if (isNaN(d.getTime())) return tglStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return tglStr;
  }
}

/**
 * Mengubah dataUrl base64 menjadi Uint8Array untuk ImageRun docx
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(";base64,") ? dataUrl.split(";base64,")[1] : dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Mengambil byte gambar dari dataUrl, Google Drive, atau IndexedDB offline
 */
async function ambilByteGambar(
  item: { dataUrl?: string; driveId?: string; id?: string },
  token?: string
): Promise<Uint8Array | null> {
  // 1. Data URL lokal
  if (item.dataUrl && item.dataUrl.startsWith("data:image")) {
    try {
      return dataUrlToUint8Array(item.dataUrl);
    } catch (e) {
      console.warn("Gagal mengurai dataUrl gambar:", e);
    }
  }

  // 2. Google Drive
  if (item.driveId && token) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${item.driveId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch (e) {
      console.warn("Gagal mengunduh gambar dari Drive:", e);
    }
  }

  // 3. IndexedDB offline antrean
  if (item.id) {
    try {
      const offlineList = await ambilSemuaBuktiOffline();
      const match = offlineList.find((b) => b.id === item.id);
      if (match && match.blob) {
        const buf = await match.blob.arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch (e) {
      console.warn("Gagal membaca gambar dari IndexedDB offline:", e);
    }
  }

  return null;
}

/**
 * Meminta narasi surat justifikasi dari server Gemini AI atau fallback baku
 */
async function susunNarasiSuratJustifikasi(params: {
  alasanSingkat?: string;
  jenisBukti?: string;
  uraian: string;
  jumlah: number;
  tanggal: string;
  namaKegiatan: string;
  lokasiKegiatan: string;
  namaPelapor: string;
  jabatanPelapor: string;
  lembagaProyek: string;
}): Promise<string[]> {
  try {
    const res = await fetch("/api/gemini/susun-surat-justifikasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.paragraf) && data.paragraf.length > 0) {
        return data.paragraf;
      }
    }
  } catch (e) {
    console.warn("Fetch narasi justifikasi AI gagal, memakai template baku:", e);
  }

  // Fallback standar 3 paragraf baku
  const nominalFmt = formatRupiah(params.jumlah);
  const p1 = `Sehubungan dengan pelaksanaan kegiatan ${params.namaKegiatan || "lapangan"} yang berlokasi di ${params.lokasiKegiatan || "lapangan"}, bersama ini saya menerangkan bahwa pada tanggal ${formatTanggalIndo(params.tanggal)} telah dilakukan transaksi pengeluaran riil sebesar ${nominalFmt} untuk keperluan ${params.uraian || "kegiatan operasional"}.`;
  const p2 = `Adapun mengenai dokumen pertanggungjawaban transaksi tersebut, dokumen yang dapat dilampirkan berstatus ${params.jenisBukti || "bukti tidak lengkap"} dikarenakan ${params.alasanSingkat || "keterbatasan fasilitas administrasi penyedia jasa/penjual di lokasi kegiatan lapangan serta kondisi geografis yang berada di wilayah terpencil"}.`;
  const p3 = `Dengan ini saya menyatakan dengan sesungguhnya bahwa transaksi tersebut di atas adalah benar-benar terlaksana dan mutlak dipergunakan untuk mendukung kelancaran operasional kegiatan kedinasan, tanpa adanya unsur manipulasi atau kepentingan pribadi, serta saya bersedia bertanggung jawab sepenuhnya atas kebenaran keterangan ini.`;
  return [p1, p2, p3];
}

/**
 * Membuat tabel kotak tempel dengan garis putus-putus abu-abu
 */
function buatKotakTempel(
  teksUtama: string,
  subTeks: string,
  tinggiMm: number = 65
): Table {
  const tinggiTwip = convertMillimetersToTwip(tinggiMm);
  const dashedBorder = {
    style: BorderStyle.DASHED,
    size: 6,
    color: "888888",
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        height: { value: tinggiTwip, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: dashedBorder,
              bottom: dashedBorder,
              left: dashedBorder,
              right: dashedBorder,
            },
            shading: {
              type: ShadingType.CLEAR,
              fill: "FAFAFA",
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 40 },
                children: [
                  new TextRun({
                    text: teksUtama,
                    bold: true,
                    font: "Arial",
                    size: 20, // 10pt
                    color: "777777",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: subTeks,
                    font: "Arial",
                    size: 18, // 9pt
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Membuat kotak khusus untuk struk thermal:
 * Kiri: Kotak tempel struk asli 8x12 cm
 * Kanan: Foto struk sebagai arsip fotokopi
 */
function buatKotakStrukThermal(
  teksUtama: string,
  subTeks: string,
  fotoByte?: Uint8Array | null
): Table {
  const tinggiTwip = convertMillimetersToTwip(120);
  const dashedBorder = {
    style: BorderStyle.DASHED,
    size: 6,
    color: "888888",
  };
  const solidBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "CCCCCC",
  };

  const selKiri = new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: dashedBorder,
      bottom: dashedBorder,
      left: dashedBorder,
      right: dashedBorder,
    },
    shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 60 },
        children: [
          new TextRun({
            text: teksUtama,
            bold: true,
            font: "Arial",
            size: 20,
            color: "777777",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: subTeks,
            font: "Arial",
            size: 18,
            color: "999999",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "(Struk Thermal Mudah Pudar)",
            italics: true,
            font: "Arial",
            size: 16,
            color: "AAAAAA",
          }),
        ],
      }),
    ],
  });

  const selKananChildren: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [
        new TextRun({
          text: "FOTOKOPI / ARSIP STRUK",
          bold: true,
          font: "Arial",
          size: 18,
          color: "666666",
        }),
      ],
    }),
  ];

  if (fotoByte) {
    try {
      selKananChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: fotoByte,
              transformation: {
                width: 250,
                height: 340,
              },
              type: "jpg",
            }),
          ],
        })
      );
    } catch {
      selKananChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "[Lampiran foto struk terlampir pada file arsip]",
              italics: true,
              font: "Arial",
              size: 18,
              color: "888888",
            }),
          ],
        })
      );
    }
  } else {
    selKananChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: "TEMPEL FOTOKOPI STRUK DI SINI\n(Wajib untuk struk thermal yang cepat pudar)",
            italics: true,
            font: "Arial",
            size: 18,
            color: "888888",
          }),
        ],
      })
    );
  }

  const selKanan = new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: solidBorder,
      bottom: solidBorder,
      left: solidBorder,
      right: solidBorder,
    },
    shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
    children: selKananChildren,
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        height: { value: tinggiTwip, rule: HeightRule.ATLEAST },
        children: [selKiri, selKanan],
      }),
    ],
  });
}

/**
 * Daftar perdiem berformat file timesheet: "Detail Keuangan / Uang Harian (Per Diem) Kegiatan Lapangan", data Proyek, Judul Kegiatan,
 * Nama, Bulan, tabel No | Tanggal | Keterangan | Lokasi | Jumlah (Rp.), baris Total, lalu Dilaporkan Oleh / Disetujui Oleh.
 * Menggantikan kotak tempel per hari untuk kelompok Perdiem (perdiem tidak punya bukti fisik per hari).
 */
function buatBagianPerdiemTimesheet(daftar: DaftarPerdiemDokumen): (Paragraph | Table)[] {
  const garis = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
  const garisTebal = { style: BorderStyle.SINGLE, size: 8, color: "111111" };
  const tanpaGaris = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bordersTabel = { top: garis, bottom: garis, left: garis, right: garis, insideHorizontal: garis, insideVertical: garis };
  const bordersKosong = { top: tanpaGaris, bottom: tanpaGaris, left: tanpaGaris, right: tanpaGaris, insideHorizontal: tanpaGaris, insideVertical: tanpaGaris };

  const teks = (isi: string, opsi: { tebal?: boolean; ukuran?: number } = {}) =>
    new TextRun({ text: isi, bold: opsi.tebal, font: "Arial", size: opsi.ukuran ?? 20, color: "111111" });

  const sel = (isi: string, lebar: number, opsi: { tebal?: boolean; rata?: (typeof AlignmentType)[keyof typeof AlignmentType]; isi?: string } = {}) =>
    new TableCell({
      width: { size: lebar, type: WidthType.PERCENTAGE },
      borders: bordersTabel,
      shading: opsi.isi ? { type: ShadingType.CLEAR, fill: opsi.isi } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ alignment: opsi.rata, children: [teks(isi, { tebal: opsi.tebal, ukuran: 19 })] })],
    });

  const LEBAR = [6, 14, 42, 22, 16];
  const kepala = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: ["No", "Tanggal", "Keterangan", "Lokasi", "Jumlah (Rp.)"].map((h, i) =>
      sel(h, LEBAR[i], { tebal: true, isi: "EFEFEF", rata: i === 4 ? AlignmentType.RIGHT : i < 2 ? AlignmentType.CENTER : undefined })
    ),
  });
  const barisData = daftar.baris.map(
    (b) =>
      new TableRow({
        cantSplit: true,
        children: [
          sel(String(b.no), LEBAR[0], { rata: AlignmentType.CENTER }),
          sel(b.tanggal, LEBAR[1], { rata: AlignmentType.CENTER }),
          sel(b.keterangan, LEBAR[2]),
          sel(b.lokasi, LEBAR[3]),
          sel(formatAngka(b.jumlah), LEBAR[4], { rata: AlignmentType.RIGHT }),
        ],
      })
  );
  const barisTotal = new TableRow({
    cantSplit: true,
    children: [
      sel("", LEBAR[0]),
      sel("", LEBAR[1]),
      sel("Total", LEBAR[2], { tebal: true }),
      sel("", LEBAR[3]),
      sel(formatAngka(daftar.total), LEBAR[4], { tebal: true, rata: AlignmentType.RIGHT }),
    ],
  });

  const barisInfo = [
    ["Proyek", daftar.proyek],
    ["Judul Kegiatan", daftar.judulKegiatan],
    ["Nama", daftar.nama],
    ["Bulan", daftar.bulan],
  ];
  const tabelInfo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordersKosong,
    rows: barisInfo.map(
      ([label, nilai]) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
              borders: bordersKosong,
              children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [teks(label, { tebal: true })] })],
            }),
            new TableCell({
              width: { size: 78, type: WidthType.PERCENTAGE },
              borders: bordersKosong,
              children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [teks(`: ${nilai}`)] })],
            }),
          ],
        })
    ),
  });

  const selTtd = (judul: string, nama: string) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: bordersKosong,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [teks(judul, { tebal: true })] }),
        new Paragraph({ spacing: { before: 900 }, alignment: AlignmentType.CENTER, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: nama, bold: true, underline: nama ? {} : undefined, font: "Arial", size: 20, color: "111111" })],
        }),
      ],
    });
  const tabelTtd = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordersKosong,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [selTtd("Dilaporkan Oleh :", daftar.dilaporkanOleh), selTtd("Disetujui Oleh :", daftar.disetujuiOleh)],
      }),
    ],
  });

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 0 },
      children: [new TextRun({ text: "Detail Keuangan", bold: true, font: "Arial", size: 28, color: "111111" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: "Uang Harian (Per Diem) Kegiatan Lapangan", bold: true, font: "Arial", size: 24, color: "111111" })],
    }),
    tabelInfo,
    new Paragraph({ spacing: { before: 120, after: 60 }, border: { bottom: garisTebal }, children: [] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: bordersTabel,
      rows: [kepala, ...barisData, barisTotal],
    }),
    new Paragraph({ spacing: { before: 280 }, children: [] }),
    tabelTtd,
  ];
}

/**
 * Fungsi utama pembuat dokumen Word (.docx) laporan dana kegiatan
 */
export async function buatDokumenLaporanKegiatanDocx(
  opsi: OpsiLaporanDocx
): Promise<Blob> {
  const {
    transaksi,
    kegiatan,
    daftarKegiatan = [kegiatan],
    profilPelapor,
    urutanTransaksiIds = [],
    sertakanDaftarPeriksa = true,
    googleToken,
  } = opsi;

  // 1. Saring transaksi kegiatan ini
  // (termasuk penerimaan dana pada rentang kegiatan yang belum dikaitkan, supaya dana awal terisi otomatis)
  const trxKegiatan = transaksiKegiatan(transaksi, kegiatan, daftarKegiatan);

  const pengeluaranRaw = trxKegiatan.filter((t) => t.jenis === "pengeluaran");

  // 2. Tentukan urutan transaksi pengeluaran (Berdasarkan manual urutanTransaksiIds jika ada, atau default kelompok lalu tanggal)
  const mapKelompokUrutan = new Map<string, number>();
  KELOMPOK_DANA_KEGIATAN.forEach((k, idx) => mapKelompokUrutan.set(k, idx));

  let daftarPengeluaran = [...pengeluaranRaw];

  if (urutanTransaksiIds && urutanTransaksiIds.length > 0) {
    const idIndexMap = new Map<string, number>();
    urutanTransaksiIds.forEach((id, idx) => idIndexMap.set(id, idx));

    daftarPengeluaran.sort((a, b) => {
      const idxA = idIndexMap.has(a.id) ? idIndexMap.get(a.id)! : 999999;
      const idxB = idIndexMap.has(b.id) ? idIndexMap.get(b.id)! : 999999;
      if (idxA !== idxB) return idxA - idxB;
      const orderA = mapKelompokUrutan.get(a.kategori) ?? 99;
      const orderB = mapKelompokUrutan.get(b.kategori) ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.tanggal.localeCompare(b.tanggal);
    });
  } else {
    daftarPengeluaran.sort((a, b) => {
      const orderA = mapKelompokUrutan.get(a.kategori) ?? 99;
      const orderB = mapKelompokUrutan.get(b.kategori) ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.tanggal.localeCompare(b.tanggal);
    });
  }

  // Berikan nomor urut global 1..N yang konsisten di seluruh dokumen
  const mapNomorUrut = new Map<string, number>();
  daftarPengeluaran.forEach((t, i) => mapNomorUrut.set(t.id, i + 1));

  const totalPengeluaran = daftarPengeluaran.reduce((s, t) => s + t.jumlah, 0);
  // Penyelesaian akhir dana kegiatan (dana awal vs realisasi + perdiem), aturan di lib/penyelesaianDana.ts
  const penyelesaian = hitungPenyelesaian(trxKegiatan);

  const periodeFmt = `${formatTanggalIndo(kegiatan.tanggalMulai)} s.d. ${formatTanggalIndo(kegiatan.tanggalSelesai)}`;
  const batasLaporan = hitungBatasLaporanFisik(kegiatan.tanggalSelesai);

  // Border standar tabel
  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "D0D0D0",
  };
  const tableBordersStandard = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
    insideHorizontal: thinBorder,
    insideVertical: thinBorder,
  };
  const borderNone = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };
  const tableBordersNone = {
    top: borderNone,
    bottom: borderNone,
    left: borderNone,
    right: borderNone,
    insideHorizontal: borderNone,
    insideVertical: borderNone,
  };

  // Dokumen Word dibagi menjadi beberapa bagian (section): daftar perdiem berformat timesheet dicetak lanskap supaya kolomnya
  // tidak berhimpit, bagian lain tetap potret. `childrenSections` selalu menunjuk isi bagian yang sedang diisi.
  const bagianWord: { lanskap: boolean; isi: (Paragraph | Table)[] }[] = [{ lanskap: false, isi: [] }];
  let childrenSections = bagianWord[0].isi;
  /** Pindah ke bagian baru (mulai di halaman baru) bila orientasinya berbeda; true bila bagian baru dibuat. */
  const pindahOrientasi = (lanskap: boolean): boolean => {
    if (bagianWord[bagianWord.length - 1].lanskap === lanskap) return false;
    const baru = { lanskap, isi: [] as (Paragraph | Table)[] };
    bagianWord.push(baru);
    childrenSections = baru.isi;
    return true;
  };

  // ==========================================
  // BAGIAN 3A: JUDUL & IDENTITAS
  // ==========================================
  childrenSections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: "LAPORAN KEUANGAN KEGIATAN",
          bold: true,
          font: "Arial",
          size: 28, // 14pt
          color: "111111",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: kegiatan.nama.toUpperCase(),
          bold: true,
          font: "Arial",
          size: 24, // 12pt
          color: "333333",
        }),
      ],
    })
  );

  // Tabel Identitas Tanpa Garis
  const barisIdentitasData = [
    { label: "Nama Pelapor", nilai: profilPelapor.nama || "-" },
    { label: "Jabatan", nilai: profilPelapor.jabatan || "-" },
    { label: "Lembaga / Proyek", nilai: `${profilPelapor.lembaga || "-"} / ${profilPelapor.proyek || "-"}` },
    { label: "Lokasi Kegiatan", nilai: kegiatan.lokasi || "-" },
    { label: "Periode Kegiatan", nilai: periodeFmt },
    {
      label: "Batas Penyerahan Laporan Fisik",
      nilai: `${batasLaporan.formatTeks} (${batasLaporan.hariTersisa >= 0 ? `sisa ${batasLaporan.hariTersisa} hari` : `terlambat ${Math.abs(batasLaporan.hariTersisa)} hari`})`,
    },
  ];

  const tabelIdentitas = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBordersNone,
    rows: barisIdentitasData.map(
      (item) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              borders: tableBordersNone,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: item.label,
                      bold: true,
                      font: "Arial",
                      size: 21,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4, type: WidthType.PERCENTAGE },
              borders: tableBordersNone,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [new TextRun({ text: ":", font: "Arial", size: 21 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 62, type: WidthType.PERCENTAGE },
              borders: tableBordersNone,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: item.nilai,
                      font: "Arial",
                      size: 21,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    ),
  });

  childrenSections.push(tabelIdentitas);

  // ==========================================
  // BAGIAN 3B: "A. Ringkasan Penggunaan Dana"
  // ==========================================
  childrenSections.push(
    new Paragraph({
      spacing: { before: 280, after: 100 },
      children: [
        new TextRun({
          text: "A. Ringkasan Penggunaan Dana",
          bold: true,
          font: "Arial",
          size: 23, // 11.5pt
          color: "111111",
        }),
      ],
    })
  );

  // Buat ringkasan per kelompok
  const barisRingkasanKelompok: TableRow[] = [
    // Header tabel ringkasan
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "No", bold: true, font: "Arial", size: 20 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 52, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Kelompok Penggunaan Anggaran",
                  bold: true,
                  font: "Arial",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Jumlah Bukti", bold: true, font: "Arial", size: 20 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Jumlah (Rp)", bold: true, font: "Arial", size: 20 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  KELOMPOK_DANA_KEGIATAN.forEach((kategori, idx) => {
    const listKat = daftarPengeluaran.filter((t) => t.kategori === kategori);
    const subtotal = listKat.reduce((s, t) => s + t.jumlah, 0);

    barisRingkasanKelompok.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(idx + 1), font: "Arial", size: 20 })],
              }),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: kategori, font: "Arial", size: 20 })],
              }),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${listKat.length} bukti`,
                    font: "Arial",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: formatAngka(subtotal),
                    font: "Arial",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  // Baris Total Ringkasan
  barisRingkasanKelompok.push(
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          borders: tableBordersStandard,
          columnSpan: 2,
          shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Total Pengeluaran",
                  bold: true,
                  font: "Arial",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: tableBordersStandard,
          shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${daftarPengeluaran.length} bukti`,
                  bold: true,
                  font: "Arial",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: tableBordersStandard,
          shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: formatAngka(totalPengeluaran),
                  bold: true,
                  font: "Arial",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  childrenSections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBordersStandard,
      rows: barisRingkasanKelompok,
    })
  );

  // Baris bertitik rata kanan di bawah ringkasan: penyelesaian akhir dana kegiatan
  const barisPenyelesaian = (
    label: string,
    nilai: number,
    opsi: { tebal?: boolean; warna?: string; setelah?: number } = {}
  ) =>
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: opsi.setelah ?? 30 },
      children: [
        new TextRun({
          text: `${label} ........................................ ${formatRupiah(nilai)}`,
          bold: opsi.tebal,
          font: "Arial",
          size: opsi.tebal ? 21 : 20,
          color: opsi.warna,
        }),
      ],
    });

  childrenSections.push(
    new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }),
    barisPenyelesaian("Dana awal kegiatan (uang muka dari lembaga)", penyelesaian.danaAwal),
    barisPenyelesaian("Realisasi pengeluaran kegiatan", penyelesaian.realisasiOperasional),
    barisPenyelesaian("Total uang harian", penyelesaian.totalPerdiem),
    barisPenyelesaian("Total pengeluaran yang diakui", penyelesaian.totalDiakui, { tebal: true })
  );

  // Status penyelesaian akhir: sisa dana dikembalikan, atau kelebihan biaya diganti lembaga
  childrenSections.push(
    penyelesaian.status === "nihil"
      ? new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 },
          children: [new TextRun({ text: penyelesaian.labelStatus, bold: true, font: "Arial", size: 21, color: "1D4ED8" })],
        })
      : barisPenyelesaian(penyelesaian.labelStatus, penyelesaian.jumlahStatus, {
          tebal: true,
          warna: penyelesaian.status === "reimbursement" ? "B00020" : "0D652D",
          setelah: 200,
        })
  );

  // ==========================================
  // BAGIAN 3C: "B. Daftar Rincian Pengeluaran"
  // ==========================================
  childrenSections.push(
    new Paragraph({
      spacing: { before: 160, after: 100 },
      children: [
        new TextRun({
          text: "B. Daftar Rincian Pengeluaran",
          bold: true,
          font: "Arial",
          size: 23,
          color: "111111",
        }),
      ],
    })
  );

  const barisDaftarRincian: TableRow[] = [
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 6, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "No", bold: true, font: "Arial", size: 19 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Tanggal", bold: true, font: "Arial", size: 19 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Uraian Pengeluaran", bold: true, font: "Arial", size: 19 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Kelompok", bold: true, font: "Arial", size: 19 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
          borders: tableBordersStandard,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Jumlah (Rp)", bold: true, font: "Arial", size: 19 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  daftarPengeluaran.forEach((t) => {
    const no = mapNomorUrut.get(t.id) || 1;
    barisDaftarRincian.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(no), font: "Arial", size: 19 })],
              }),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: t.tanggal, font: "Arial", size: 19 })],
              }),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: t.deskripsi, font: "Arial", size: 19 }),
                  ...(t.detailKegiatan?.namaPenjualPenyedia
                    ? [
                        new TextRun({
                          text: ` (${t.detailKegiatan.namaPenjualPenyedia})`,
                          italics: true,
                          font: "Arial",
                          size: 17,
                          color: "555555",
                        }),
                      ]
                    : []),
                ],
              }),
              ...(barisPenerimaManfaat(t)
                ? [new Paragraph({ children: [new TextRun({ text: barisPenerimaManfaat(t)!, bold: true, font: "Arial", size: 17, color: "333333" })] })]
                : []),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: labelKategori(t.kategori), font: "Arial", size: 19 })],
              }),
            ],
          }),
          new TableCell({
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: formatAngka(t.jumlah),
                    font: "Arial",
                    size: 19,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  // Baris Total Pengeluaran
  barisDaftarRincian.push(
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          borders: tableBordersStandard,
          columnSpan: 4,
          shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Total Rincian Pengeluaran",
                  bold: true,
                  font: "Arial",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: tableBordersStandard,
          shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: formatAngka(totalPengeluaran),
                  bold: true,
                  font: "Arial",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  childrenSections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBordersStandard,
      rows: barisDaftarRincian,
    })
  );

  // =========================================================
  // BAGIAN 3D: SATU BAGIAN PER KELOMPOK (HALAMAN BARU)
  // KOTAK TEMPEL, KETERANGAN, LAMPIRAN TAMBAHAN & FOTO
  // =========================================================
  let kelompokAktifIndex = 1;

  for (const namaKelompok of KELOMPOK_DANA_KEGIATAN) {
    const trxDalamKelompok = daftarPengeluaran.filter((t) => t.kategori === namaKelompok);
    if (trxDalamKelompok.length === 0) continue;

    const subtotalKelompok = trxDalamKelompok.reduce((s, t) => s + t.jumlah, 0);

    // Perdiem dengan daftar berformat timesheet dicetak lanskap; kelompok lain potret. Bagian baru sudah mulai di halaman
    // baru, jadi judulnya tidak diberi pemisah halaman lagi (menghindari halaman kosong).
    const daftarPerdiem = namaKelompok === KATEGORI_PERDIEM ? susunDaftarPerdiem(trxDalamKelompok, kegiatan, profilPelapor) : null;
    const bagianBaruKelompok = pindahOrientasi(Boolean(daftarPerdiem));

    // Judul Kelompok dimulai di halaman baru
    childrenSections.push(
      new Paragraph({
        pageBreakBefore: !bagianBaruKelompok,
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: `${kelompokAktifIndex}. ${labelKategori(namaKelompok).toUpperCase()}`,
            bold: true,
            font: "Arial",
            size: 26, // 13pt
            color: "000000",
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `${trxDalamKelompok.length} bukti pengeluaran · Subtotal ${formatRupiah(subtotalKelompok)}`,
            italics: true,
            font: "Arial",
            size: 19,
            color: "555555",
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 140 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "444444" },
        },
        children: [],
      })
    );

    kelompokAktifIndex++;

    // Perdiem: daftar harian berformat timesheet (Keterangan dan Lokasi dari file timesheet) menggantikan kotak tempel.
    // Perdiem yang punya foto atau bukti tetap mendapat halaman buktinya di bawah daftar.
    let trxUntukKotak = trxDalamKelompok;
    if (daftarPerdiem) {
      childrenSections.push(...buatBagianPerdiemTimesheet(daftarPerdiem));
      trxUntukKotak = trxDalamKelompok.filter(
        (t) => (t.bukti && t.bukti.length > 0) || (t.detailKegiatan?.fotoPendukung && t.detailKegiatan.fotoPendukung.length > 0)
      );
      if (trxUntukKotak.length === 0) continue;
      // Halaman bukti perdiem (bila ada) kembali potret.
      pindahOrientasi(false);
    }

    // Hitung posisi transaksi dalam halaman (maksimal 2 transaksi sederhana per halaman)
    let transaksiDiHalamanIni = 0;

    for (const trx of trxUntukKotak) {
      const noGlobal = mapNomorUrut.get(trx.id) || 1;
      const detail = trx.detailKegiatan || {};
      const jenisBukti = detail.jenisBukti || "Kuitansi";
      const isThermal = jenisBukti === "Struk thermal (minimarket/SPBU)";

      // Cek apakah transaksi ini kompleks (memiliki beberapa kotak atau foto)
      const isPesawat = detail.transportasi?.moda?.toLowerCase().includes("pesawat") || jenisBukti.toLowerCase().includes("pesawat");
      const isTravel = detail.transportasi?.moda?.toLowerCase().includes("travel") || detail.transportasi?.moda?.toLowerCase().includes("ojek") || detail.transportasi?.namaSopir;
      const isRental = namaKelompok === "Rental Kendaraan";
      const isAkomodasi = namaKelompok === "Akomodasi";
      const isHonor = namaKelompok === "Honorarium & Ganti Hari";
      const punyaFoto = (detail.fotoPendukung && detail.fotoPendukung.length > 0) || (trx.bukti && trx.bukti.length > 0);

      const isKompleks = isThermal || isRental || isHonor || isPesawat || isTravel || isAkomodasi || punyaFoto;

      // Aturan halaman:
      // - Jika transaksi kompleks: mulai di halaman baru (kecuali jika tepat di awal kelompok)
      // - Jika sudah ada 2 transaksi sederhana di halaman ini: mulai di halaman baru
      let butuhHalamanBaru = false;
      if (transaksiDiHalamanIni >= 2) {
        butuhHalamanBaru = true;
      } else if (transaksiDiHalamanIni > 0 && isKompleks) {
        butuhHalamanBaru = true;
      }

      // Baris Judul Transaksi: "No. <n>  <uraian>" dengan jumlah rata kanan, bergaris bawah
      const headerTrxChildren: (Paragraph | Table)[] = [];

      headerTrxChildren.push(
        new Paragraph({
          pageBreakBefore: butuhHalamanBaru,
          spacing: { before: butuhHalamanBaru ? 80 : 180, after: 60 },
          children: [
            new TextRun({
              text: `No. ${noGlobal}   ${trx.deskripsi}`,
              bold: true,
              underline: {},
              font: "Arial",
              size: 22,
              color: "111111",
            }),
            new TextRun({
              text: `\t${formatRupiah(trx.jumlah)}`,
              bold: true,
              underline: {},
              font: "Arial",
              size: 22,
              color: "111111",
            }),
          ],
          tabStops: [
            {
              type: AlignmentType.RIGHT,
              position: convertMillimetersToTwip(170), // rata kanan margin A4 (210 - 20 - 20 = 170mm)
            },
          ],
        })
      );

      childrenSections.push(...headerTrxChildren);

      // Reset hitungan halaman jika berganti halaman
      if (butuhHalamanBaru) {
        transaksiDiHalamanIni = 0;
      }
      transaksiDiHalamanIni += isKompleks ? 2 : 1;

      // 1. Kotak Tempel Utama
      if (isThermal) {
        // Ambil foto bukti struk
        let fotoByte: Uint8Array | null = null;
        if (trx.bukti && trx.bukti.length > 0) {
          fotoByte = await ambilByteGambar(trx.bukti[0], googleToken);
        }
        childrenSections.push(
          buatKotakStrukThermal(
            "TEMPEL STRUK ASLI DI SINI",
            `No. ${noGlobal} · ${trx.deskripsi} · ${formatRupiah(trx.jumlah)}${trx.detailKegiatan?.penerimaManfaat?.length ? ` · Penerima Manfaat: ${trx.detailKegiatan.penerimaManfaat.join(", ")}` : ""}`,
            fotoByte
          )
        );
      } else {
        const tinggiMm = jenisBukti.toLowerCase().includes("tiket") || jenisBukti.toLowerCase().includes("kuitansi") ? 65 : 65;
        childrenSections.push(
          buatKotakTempel(
            `TEMPEL ${jenisBukti.toUpperCase()} ASLI DI SINI`,
            `No. ${noGlobal} · ${trx.deskripsi} · ${formatRupiah(trx.jumlah)}${trx.detailKegiatan?.penerimaManfaat?.length ? ` · Penerima Manfaat: ${trx.detailKegiatan.penerimaManfaat.join(", ")}` : ""}`,
            tinggiMm
          )
        );
      }

      // 2. Keterangan Langsung di Bawah Kotak
      const paragrafKeterangan: Paragraph[] = [];

      // Baris Pelapor (Tebal) & Tanggal
      paragrafKeterangan.push(
        new Paragraph({
          spacing: { before: 80, after: 30 },
          children: [
            new TextRun({
              text: `Pelapor: ${profilPelapor.nama}`,
              bold: true,
              font: "Arial",
              size: 20,
            }),
            new TextRun({
              text: `  |  Tanggal: ${formatTanggalIndo(trx.tanggal)}`,
              font: "Arial",
              size: 20,
              color: "555555",
            }),
            ...(detail.namaPenjualPenyedia
              ? [
                  new TextRun({
                    text: `  |  Penyedia/Toko: ${detail.namaPenjualPenyedia}`,
                    font: "Arial",
                    size: 20,
                    color: "555555",
                  }),
                ]
              : []),
          ],
        })
      );

      // Keterangan untuk laporan
      if (detail.keteranganLaporan || trx.catatan) {
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: "Keterangan: ",
                bold: true,
                font: "Arial",
                size: 20,
              }),
              new TextRun({
                text: detail.keteranganLaporan || trx.catatan || "-",
                font: "Arial",
                size: 20,
              }),
            ],
          })
        );
      }

      // Rincian banyaknya × satuan × harga satuan
      if (detail.rincian && detail.rincian.banyaknya > 0 && detail.rincian.hargaSatuan > 0) {
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: "Rincian: ",
                bold: true,
                font: "Arial",
                size: 20,
              }),
              new TextRun({
                text: `${formatAngka(detail.rincian.banyaknya)} ${detail.rincian.satuan || "unit"} × ${formatRupiah(detail.rincian.hargaSatuan)} = ${formatRupiah(detail.rincian.total || trx.jumlah)}`,
                font: "Arial",
                size: 20,
              }),
            ],
          })
        );
      }

      // Isian khusus Rental Kendaraan (gross-up pajak)
      if (namaKelompok === "Rental Kendaraan" && detail.rentalKendaraan) {
        const rk = detail.rentalKendaraan;
        const persen = rk.persenGrossUpPajak ?? 2;
        const grossUpNominal = persen > 0 ? Math.round(trx.jumlah / (1 - persen / 100)) : trx.jumlah;
        const pajakPph23 = grossUpNominal - trx.jumlah;

        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Kendaraan: ${rk.jenisMerk || "Mobil/Motor"} (${rk.tahun || "-"}) · Plat: ${rk.noPolisi || "-"} · Pemilik: ${rk.namaPemilik || "-"}`,
                font: "Arial",
                size: 19,
                color: "444444",
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Durasi Sewa: ${rk.jumlahHari || 1} hari (${formatTanggalIndo(rk.tanggalMulai)} s.d. ${formatTanggalIndo(rk.tanggalSelesai)}) @ ${formatRupiah(rk.tarifPerHari || 0)}/hari`,
                font: "Arial",
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Nilai gross-up pajak ${persen}%: `,
                bold: true,
                font: "Arial",
                size: 20,
              }),
              new TextRun({
                text: `${formatRupiah(grossUpNominal)} (Pajak PPh 23: ${formatRupiah(pajakPph23)}, Netto dibayarkan: ${formatRupiah(trx.jumlah)})`,
                font: "Arial",
                size: 20,
              }),
            ],
          })
        );
      }

      // Isian khusus Honorarium & Ganti Hari (potongan pajak)
      if (namaKelompok === "Honorarium & Ganti Hari" && detail.honorarium) {
        const hon = detail.honorarium;
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Penerima: ${hon.namaPenerima || "-"} (${hon.isPNS ? "PNS" : "Bukan PNS"}, ${hon.hasNPWP ? "Memiliki NPWP" : "Tanpa NPWP"})`,
                font: "Arial",
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Alokasi: ${hon.jumlahOrang || 1} orang × ${hon.jumlahHari || 1} hari | No. Absen: ${hon.nomorAbsen || "-"}`,
                font: "Arial",
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: "Potongan Pajak PPh 21: ",
                bold: true,
                font: "Arial",
                size: 20,
              }),
              new TextRun({
                text: `Bruto ${formatRupiah(hon.honorBruto || trx.jumlah)} · Tarif ${hon.tarifPajakPersen || 5}% · Potongan ${formatRupiah(hon.pajakDipotong || 0)} · Diterima Bersih (Netto) ${formatRupiah(hon.honorNetto || trx.jumlah)}`,
                font: "Arial",
                size: 20,
              }),
            ],
          })
        );
      }

      // Isian khusus BBM
      if (namaKelompok === "BBM" && detail.bbm) {
        const b = detail.bbm;
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Rute BBM: ${b.dari || "-"} → ${b.ke || "-"} | Plat: ${b.noPolisi || "-"} | KM Isi: ${b.kmSaatIsi || "-"} | Jarak Tempuh: ${b.jarakTempuh ? `${b.jarakTempuh} km` : "-"}`,
                font: "Arial",
                size: 19,
              }),
            ],
          })
        );
      }

      // Isian khusus Transportasi (Sopir / Plat)
      if (namaKelompok === "Transportasi" && detail.transportasi) {
        const tr = detail.transportasi;
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Rute: ${tr.dari || "-"} → ${tr.ke || "-"} | Moda: ${tr.moda || "-"}`,
                font: "Arial",
                size: 19,
              }),
              ...(tr.namaSopir
                ? [
                    new TextRun({
                      text: ` | Sopir/Pengemudi: ${tr.namaSopir} (Telp: ${tr.noTelpSopir || "-"}, Plat: ${tr.noPolisi || "-"})`,
                      font: "Arial",
                      size: 19,
                    }),
                  ]
                : []),
            ],
          })
        );
      }

      // Isian khusus Akomodasi
      if (namaKelompok === "Akomodasi" && detail.akomodasi) {
        const ak = detail.akomodasi;
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `Penginapan: ${ak.lokasi || "-"} | Check-in: ${formatTanggalIndo(ak.tanggalMasuk)} | Check-out: ${formatTanggalIndo(ak.tanggalKeluar)} (${ak.jumlahMalam || 1} malam) | Pemilik: ${ak.namaPemilik || "-"} (Telp: ${ak.noTelp || "-"})`,
                font: "Arial",
                size: 19,
              }),
            ],
          })
        );
      }

      // Isian khusus Konsumsi
      if (namaKelompok === "Konsumsi" && detail.konsumsi) {
        const kon = detail.konsumsi;
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: adalahKudapanPerjalanan(namaKelompok, detail)
                  ? `Toko/Warung Pembelian: ${kon.penyedia || "-"} (Telp: ${kon.noTelp || "-"}) | Rute/Lokasi: ${kon.lokasi || "-"}`
                  : `Penyedia Konsumsi: ${kon.penyedia || "-"} (Telp: ${kon.noTelp || "-"}) | Lokasi: ${kon.lokasi || "-"} | Jumlah Peserta: ${kon.jumlahPeserta || "-"} orang`,
                font: "Arial",
                size: 19,
              }),
            ],
          })
        );
      }

      // Penerima manfaat (staf yang ikut memakai fasilitas atau menikmati pengeluaran ini), semua kategori
      const teksPenerima = barisPenerimaManfaat(trx);
      if (teksPenerima) {
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: teksPenerima, bold: true, font: "Arial", size: 19 })],
          })
        );
      }

      // Keterangan jika ada Surat Justifikasi
      if (detail.perluSuratJustifikasi) {
        paragrafKeterangan.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: "Surat Justifikasi: ",
                bold: true,
                font: "Arial",
                size: 20,
                color: "B00020",
              }),
              new TextRun({
                text: `Dilampirkan di bagian Dokumen Pendukung (${detail.alasanJustifikasi || "Kuitansi asli tidak lengkap"})`,
                font: "Arial",
                size: 20,
                italics: true,
              }),
            ],
          })
        );
      }

      childrenSections.push(...paragrafKeterangan);

      // 3. Kotak Tempel Tambahan Sesuai Kelompok
      if (isPesawat) {
        childrenSections.push(
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
          buatKotakTempel(
            "TEMPEL BOARDING PASS ASLI / TIKET TRAVEL ASLI DI SINI",
            `No. ${noGlobal} · Boarding Pass / Tiket Pesawat Asli · ${profilPelapor.nama}`,
            55
          )
        );
      }

      if (isTravel) {
        childrenSections.push(
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
          buatKotakTempel(
            "TEMPEL FOTOKOPI STNK KENDARAAN TRAVEL / OJEK DI SINI",
            `No. ${noGlobal} · STNK ${detail.transportasi?.noPolisi || "Kendaraan"} · Sopir: ${detail.transportasi?.namaSopir || "-"}`,
            50
          )
        );
      }

      if (isRental) {
        childrenSections.push(
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
          buatKotakTempel(
            "TEMPEL FOTOKOPI STNK, KTP PEMILIK/PENERIMA UANG, DAN SIM PENYEWA DI SINI",
            `No. ${noGlobal} · Dokumen Legalitas Rental: STNK Plat ${detail.rentalKendaraan?.noPolisi || "-"} · KTP Pemilik: ${detail.rentalKendaraan?.namaPemilik || "-"} · SIM Pengemudi`,
            60
          )
        );
      }

      if (isAkomodasi) {
        childrenSections.push(
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
          buatKotakTempel(
            "TEMPEL FOTOKOPI KTP PEMILIK PENGINAPAN DI SINI",
            `No. ${noGlobal} · KTP Pemilik Penginapan: ${detail.akomodasi?.namaPemilik || "-"}`,
            50
          )
        );
      }

      if (isHonor) {
        childrenSections.push(
          new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
          buatKotakTempel(
            "TEMPEL FOTOKOPI KTP DAN NPWP PENERIMA HONOR / GANTI HARI DI SINI",
            `No. ${noGlobal} · Dokumen Pajak Penerima Honor: ${detail.honorarium?.namaPenerima || "-"}`,
            60
          )
        );
      }

      // 4. Foto Pendukung Transaksi (Lebar maks. 12 cm dengan keterangan miring)
      const listFoto: FotoPendukung[] = detail.fotoPendukung || [];
      if (listFoto.length > 0) {
        for (const foto of listFoto) {
          const fotoBytes = await ambilByteGambar(foto, googleToken);
          if (fotoBytes) {
            try {
              childrenSections.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 40 },
                  children: [
                    new ImageRun({
                      data: fotoBytes,
                      transformation: {
                        width: 420, // ~11 cm
                        height: 280,
                      },
                      type: "jpg",
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: `Foto Pendukung: ${foto.nama || foto.keterangan || "Dokumentasi kegiatan lapangan"}`,
                      italics: true,
                      font: "Arial",
                      size: 18,
                      color: "555555",
                    }),
                  ],
                })
              );
            } catch (errFoto) {
              console.warn("Gagal merender ImageRun foto pendukung:", errFoto);
            }
          }
        }
      }

      // Garis pemisah antar transaksi
      childrenSections.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
          },
          children: [],
        })
      );
    }
  }

  // =========================================================
  // BAGIAN 3E: "DOKUMEN PENDUKUNG" (HALAMAN BARU)
  // TIMESHEET RENTAL & SURAT JUSTIFIKASI
  // ==========================================
  const rentalDenganTimesheet = daftarPengeluaran.filter(
    (t) =>
      t.kategori === "Rental Kendaraan" &&
      t.detailKegiatan?.rentalKendaraan?.timesheet &&
      t.detailKegiatan.rentalKendaraan.timesheet.length > 0
  );

  const transaksiPerluJustifikasi = daftarPengeluaran.filter(
    (t) => t.detailKegiatan?.perluSuratJustifikasi
  );

  const adaDokumenPendukung = rentalDenganTimesheet.length > 0 || transaksiPerluJustifikasi.length > 0;

  if (adaDokumenPendukung) {
    // 1. Timesheet Rental Kendaraan
    for (const trxRental of rentalDenganTimesheet) {
      const rk = trxRental.detailKegiatan!.rentalKendaraan!;
      const timesheetList = rk.timesheet || [];
      const totalKm = timesheetList.reduce((s, row) => s + (row.jarakKm || 0), 0);
      const isMotor = (rk.jenisMerk || "").toLowerCase().includes("motor");
      const judulTimesheet = isMotor ? "TIMESHEET RENTAL MOTOR" : "TIMESHEET RENTAL MOBIL";

      childrenSections.push(
        new Paragraph({
          pageBreakBefore: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 60 },
          children: [
            new TextRun({
              text: judulTimesheet,
              bold: true,
              font: "Arial",
              size: 26,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: `Kendaraan: ${rk.jenisMerk || "-"} · No. Polisi: ${rk.noPolisi || "-"} · Lokasi: ${kegiatan.lokasi} · Periode: ${formatTanggalIndo(rk.tanggalMulai)} s.d. ${formatTanggalIndo(rk.tanggalSelesai)}`,
              font: "Arial",
              size: 20,
              color: "444444",
            }),
          ],
        })
      );

      // Tabel Timesheet
      const barisTimesheet: TableRow[] = [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 6, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
              borders: tableBordersStandard,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "No", bold: true, font: "Arial", size: 19 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 18, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
              borders: tableBordersStandard,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Tanggal", bold: true, font: "Arial", size: 19 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
              borders: tableBordersStandard,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Lokasi Basecamp / Rute",
                      bold: true,
                      font: "Arial",
                      size: 19,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
              borders: tableBordersStandard,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Cakupan Aktivitas",
                      bold: true,
                      font: "Arial",
                      size: 19,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 14, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
              borders: tableBordersStandard,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: "Jarak (km)", bold: true, font: "Arial", size: 19 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ];

      timesheetList.forEach((row, rIdx) => {
        barisTimesheet.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(rIdx + 1), font: "Arial", size: 19 })],
                  }),
                ],
              }),
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: row.tanggal, font: "Arial", size: 19 })],
                  }),
                ],
              }),
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: row.lokasiBasecampRute || "-", font: "Arial", size: 19 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: row.cakupanAktivitas || "-", font: "Arial", size: 19 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: `${formatAngka(row.jarakKm || 0)} km`,
                        font: "Arial",
                        size: 19,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      });

      // Baris Total Timesheet
      barisTimesheet.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: tableBordersStandard,
              columnSpan: 4,
              shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `Total Hari & Jarak Tempuh (${timesheetList.length} hari):`,
                      bold: true,
                      font: "Arial",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: tableBordersStandard,
              shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `${formatAngka(totalKm)} km`,
                      bold: true,
                      font: "Arial",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      childrenSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBordersStandard,
          rows: barisTimesheet,
        }),
        // Tanda Tangan Timesheet (Pengemudi & Pelapor - TANPA blok Mengetahui)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBordersNone,
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: tableBordersNone,
                  children: [
                    new Paragraph({
                      spacing: { before: 200, after: 30 },
                      children: [new TextRun({ text: "Pengemudi / Pemilik Kendaraan,", font: "Arial", size: 20 })],
                    }),
                    new Paragraph({
                      spacing: { before: 400, after: 20 },
                      children: [
                        new TextRun({
                          text: `( ${rk.namaPemilik || "Pengemudi"} )`,
                          bold: true,
                          font: "Arial",
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: tableBordersNone,
                  children: [
                    new Paragraph({
                      spacing: { before: 200, after: 30 },
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: `${kegiatan.lokasi || "Lokasi"}, ${formatTanggalIndo(rk.tanggalSelesai || hariIni())}`,
                          font: "Arial",
                          size: 20,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 30 },
                      alignment: AlignmentType.RIGHT,
                      children: [new TextRun({ text: "Surveyor / Pelapor,", font: "Arial", size: 20 })],
                    }),
                    new Paragraph({
                      spacing: { before: 400, after: 20 },
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: `( ${profilPelapor.nama} )`,
                          bold: true,
                          font: "Arial",
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }

    // 2. Surat Justifikasi untuk Setiap Transaksi yang Ditandai
    for (const trxJustifikasi of transaksiPerluJustifikasi) {
      const detail = trxJustifikasi.detailKegiatan || {};
      const noGlobal = mapNomorUrut.get(trxJustifikasi.id) || 1;
      const jenisBuktiUpper = (detail.jenisBukti || "Bukti Pengeluaran").toUpperCase();

      // Dapatkan 2-3 paragraf narasi dari Gemini AI
      const paragrafNarasi = await susunNarasiSuratJustifikasi({
        alasanSingkat: detail.alasanJustifikasi,
        jenisBukti: detail.jenisBukti,
        uraian: trxJustifikasi.deskripsi,
        jumlah: trxJustifikasi.jumlah,
        tanggal: trxJustifikasi.tanggal,
        namaKegiatan: kegiatan.nama,
        lokasiKegiatan: kegiatan.lokasi,
        namaPelapor: profilPelapor.nama,
        jabatanPelapor: profilPelapor.jabatan,
        lembagaProyek: `${profilPelapor.lembaga} - ${profilPelapor.proyek}`,
      });

      childrenSections.push(
        new Paragraph({
          pageBreakBefore: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: "SURAT JUSTIFIKASI",
              bold: true,
              font: "Arial",
              size: 26,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: `KETIDAKLENGKAPAN DOKUMEN ${jenisBuktiUpper}`,
              bold: true,
              font: "Arial",
              size: 22,
              color: "333333",
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Yang bertanda tangan di bawah ini:",
              font: "Arial",
              size: 21,
            }),
          ],
        }),
        // Identitas pelapor di surat justifikasi
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBordersNone,
          rows: [
            { label: "Nama", val: profilPelapor.nama },
            { label: "Jabatan", val: profilPelapor.jabatan },
            { label: "Lembaga / Proyek", val: `${profilPelapor.lembaga} / ${profilPelapor.proyek}` },
            { label: "Nama Kegiatan", val: kegiatan.nama },
            { label: "Nomor Bukti Pengeluaran", val: `No. ${noGlobal} (${trxJustifikasi.deskripsi})` },
          ].map(
            (row) =>
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 32, type: WidthType.PERCENTAGE },
                    borders: tableBordersNone,
                    children: [
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [new TextRun({ text: row.label, bold: true, font: "Arial", size: 21 })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4, type: WidthType.PERCENTAGE },
                    borders: tableBordersNone,
                    children: [
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [new TextRun({ text: ":", font: "Arial", size: 21 })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 64, type: WidthType.PERCENTAGE },
                    borders: tableBordersNone,
                    children: [
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [new TextRun({ text: row.val || "-", font: "Arial", size: 21 })],
                      }),
                    ],
                  }),
                ],
              })
          ),
        }),
        new Paragraph({
          spacing: { before: 140, after: 80 },
          children: [
            new TextRun({
              text: "Dengan ini saya menerangkan sebagai berikut:",
              font: "Arial",
              size: 21,
            }),
          ],
        })
      );

      // 2-3 paragraf narasi justifikasi rata kiri-kanan
      paragrafNarasi.forEach((p) => {
        childrenSections.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 80 },
            children: [
              new TextRun({
                text: p,
                font: "Arial",
                size: 21,
              }),
            ],
          })
        );
      });

      // Kalimat penutup
      childrenSections.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 60, after: 180 },
          children: [
            new TextRun({
              text: "Demikian surat justifikasi ini dibuat dengan sebenarnya dengan penuh tanggung jawab untuk dipergunakan sebagaimana mestinya.",
              font: "Arial",
              size: 21,
            }),
          ],
        }),
        // Tanda tangan pelapor (JANGAN buat blok tanda tangan persetujuan / Mengetahui!)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBordersNone,
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 45, type: WidthType.PERCENTAGE },
                  borders: tableBordersNone,
                  children: [],
                }),
                new TableCell({
                  width: { size: 55, type: WidthType.PERCENTAGE },
                  borders: tableBordersNone,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { after: 30 },
                      children: [
                        new TextRun({
                          text: `${kegiatan.lokasi || "Lokasi"}, ${formatTanggalIndo(trxJustifikasi.tanggal || hariIni())}`,
                          font: "Arial",
                          size: 21,
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { after: 400 },
                      children: [
                        new TextRun({
                          text: "Yang membuat pernyataan,",
                          font: "Arial",
                          size: 21,
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: profilPelapor.nama,
                          bold: true,
                          underline: {},
                          font: "Arial",
                          size: 21,
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: profilPelapor.jabatan,
                          font: "Arial",
                          size: 19,
                          color: "444444",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }
  }

  // Sesudah daftar kelompok (yang bisa berakhir di bagian lanskap perdiem) dokumen kembali potret.
  const bagianBaruPenutup = pindahOrientasi(false);

  // =========================================================
  // BAGIAN 3F: "DAFTAR PERIKSA KELENGKAPAN" (HALAMAN TERAKHIR)
  // BISA DIMATIKAN
  // =========================================================
  if (sertakanDaftarPeriksa) {
    childrenSections.push(
      new Paragraph({
        pageBreakBefore: !bagianBaruPenutup,
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: "DAFTAR PERIKSA KELENGKAPAN SPJ",
            bold: true,
            font: "Arial",
            size: 26,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: "(Halaman ini sebagai panduan internal kelengkapan dokumen dan boleh tidak dicetak)",
            italics: true,
            font: "Arial",
            size: 19,
            color: "777777",
          }),
        ],
      })
    );

    // Kumpulkan ketentuan umum dan ketentuan kelompok yang dipakai
    const kelompokYangDigunakan = new Set(daftarPengeluaran.map((t) => t.kategori));

    const daftarKetentuanItems: { kelompok: string; butir: string[] }[] = [];

    // Ketentuan Umum
    if (KETENTUAN_DANA_KEGIATAN["Umum"]?.butir) {
      daftarKetentuanItems.push({
        kelompok: "Ketentuan Umum SPJ",
        butir: KETENTUAN_DANA_KEGIATAN["Umum"].butir,
      });
    }

    // Ketentuan per kelompok yang ada transaksinya
    for (const kat of KELOMPOK_DANA_KEGIATAN) {
      if (kelompokYangDigunakan.has(kat)) {
        const itemKelompok = KETENTUAN_DANA_KEGIATAN[kat];
        if (itemKelompok && itemKelompok.butir && itemKelompok.butir.length > 0) {
          daftarKetentuanItems.push({
            kelompok: `Ketentuan Khusus: ${kat}`,
            butir: itemKelompok.butir,
          });
        }
      }
    }

    const barisChecklist: TableRow[] = [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Cek", bold: true, font: "Arial", size: 19 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 92, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
            borders: tableBordersStandard,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Persyaratan & Dokumen Kelengkapan",
                    bold: true,
                    font: "Arial",
                    size: 19,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    for (const group of daftarKetentuanItems) {
      // Subheader kelompok ketentuan
      barisChecklist.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: 2,
              shading: { type: ShadingType.CLEAR, fill: "F8F8F8" },
              borders: tableBordersStandard,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  spacing: { before: 40, after: 40 },
                  children: [
                    new TextRun({
                      text: group.kelompok,
                      bold: true,
                      font: "Arial",
                      size: 20,
                      color: "222222",
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      group.butir.forEach((item) => {
        barisChecklist.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "☐",
                        font: "Arial",
                        size: 24, // Kotak centang
                        color: "555555",
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: tableBordersStandard,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [
                      new TextRun({
                        text: item,
                        font: "Arial",
                        size: 19,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      });
    }

    childrenSections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBordersStandard,
        rows: barisChecklist,
      })
    );
  }

  // ==========================================
  // BANGUN DOKUMEN DOCX
  // Margin 2cm, A4, Arial 11, Header & Footer
  // ==========================================
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22, // 11pt (22 half-points)
            color: "000000",
          },
        },
      },
    },
    sections: bagianWord
      .filter((b) => b.isi.length > 0)
      .map((b) => ({
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210), // A4: 210mm
              height: convertMillimetersToTwip(297), // A4: 297mm
              // Lanskap: docx menukar lebar dan tinggi sendiri (297 x 210 mm).
              orientation: b.lanskap ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(20), // 2 cm
              bottom: convertMillimetersToTwip(20), // 2 cm
              left: convertMillimetersToTwip(20), // 2 cm
              right: convertMillimetersToTwip(20), // 2 cm
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: `Laporan Keuangan Kegiatan · ${profilPelapor.nama} · ${periodeFmt}`,
                    font: "Arial",
                    size: 18, // 9pt
                    color: "777777",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                  new TextRun({
                    text: "Halaman ",
                    font: "Arial",
                    size: 18,
                    color: "777777",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 18,
                    color: "777777",
                  }),
                  new TextRun({
                    text: " dari ",
                    font: "Arial",
                    size: 18,
                    color: "777777",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Arial",
                    size: 18,
                    color: "777777",
                  }),
                ],
              }),
            ],
          }),
        },
        children: b.isi,
      })),
  });

  return await Packer.toBlob(doc);
}

/**
 * Helper untuk men-download blob di browser dengan nama file yang ditentukan
 */
export function unduhFileBlob(blob: Blob, namaFile: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
