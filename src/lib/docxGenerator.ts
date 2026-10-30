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
import { Transaksi, ProfilPelapor, DataKegiatan } from "../types";
import { formatRupiah, formatAngka } from "./constants";
import { RingkasanPenyelesaian } from "./penyelesaianDana";
import { DaftarPerdiemDokumen } from "./timesheet";
import { ambilByteBukti, GambarDokumen, pasDalamKotak, siapkanGambarDokumen, SumberGambar } from "./gambarDokumen";
import {
  BarisKeterangan,
  BarisTabelLaporan,
  KALIMAT_PENUTUP_JUSTIFIKASI,
  PasanganBuktiLaporan,
  rincianPenyelesaian,
  rumusPenyelesaian,
  susunLaporanKegiatan,
  SusunanLaporan,
  susunNarasiSuratJustifikasi,
  warnaPenyelesaian,
} from "./susunanLaporan";

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

/** Foto bukti atau foto pendukung siap disisipkan (format dan ukuran asli dikenali), atau null bila tidak bisa dimuat. */
async function muatGambar(item: SumberGambar, token?: string): Promise<GambarDokumen | null> {
  const data = await ambilByteBukti(item, token);
  return data ? siapkanGambarDokumen(data) : null;
}

/** Paragraf berisi satu gambar yang muat di kotak maksLebar × maksTinggi piksel (96 dpi), rasio asli terjaga. */
function paragrafGambar(g: GambarDokumen, maksLebar: number, maksTinggi: number, rata: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER): Paragraph {
  const ukuran = pasDalamKotak(g.lebar, g.tinggi, maksLebar, maksTinggi);
  return new Paragraph({
    alignment: rata,
    children: [new ImageRun({ data: g.data, type: g.jenis, transformation: { width: ukuran.lebar, height: ukuran.tinggi } })],
  });
}

const teksKecilMiring = (teks: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 60 },
    children: [new TextRun({ text: teks, italics: true, font: "Arial", size: 17, color: "555555" })],
  });

/**
 * Foto bukti digital sebuah pengeluaran: satu foto di tengah (lebar maks. 12 cm), dua foto atau lebih ditata dua per baris
 * (mis. tiket pesawat atau speedboat tiap orang yang ikut klaim). Tiap foto diberi keterangan urutannya.
 */
function buatGridFoto(daftar: Array<{ gambar: GambarDokumen; keterangan: string }>, judul: string): (Paragraph | Table)[] {
  if (daftar.length === 0) return [];
  const kepala = new Paragraph({
    spacing: { before: 120, after: 60 },
    children: [new TextRun({ text: judul, bold: true, font: "Arial", size: 18, color: "555555" })],
  });
  if (daftar.length === 1) return [kepala, paragrafGambar(daftar[0].gambar, 453, 340), teksKecilMiring(daftar[0].keterangan)];
  const tanpaGaris = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const garisTipis = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" };
  const baris: TableRow[] = [];
  for (let i = 0; i < daftar.length; i += 2) {
    const sel = (item?: { gambar: GambarDokumen; keterangan: string }) =>
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        borders: item ? { top: garisTipis, bottom: garisTipis, left: garisTipis, right: garisTipis } : { top: tanpaGaris, bottom: tanpaGaris, left: tanpaGaris, right: tanpaGaris },
        margins: { top: 80, bottom: 40, left: 80, right: 80 },
        children: item ? [paragrafGambar(item.gambar, 290, 300), teksKecilMiring(item.keterangan)] : [new Paragraph({ children: [] })],
      });
    baris.push(new TableRow({ cantSplit: true, children: [sel(daftar[i]), sel(daftar[i + 1])] }));
  }
  return [kepala, new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: baris })];
}

/** Satu baris keterangan (segmen tebal/miring/berwarna) dari susunan laporan menjadi paragraf Word. */
function paragrafKeterangan(baris: BarisKeterangan, sebelum = 0): Paragraph {
  return new Paragraph({
    spacing: { before: sebelum, after: 30 },
    children: baris.map(
      (s) =>
        new TextRun({
          text: s.teks,
          bold: s.tebal,
          italics: s.miring,
          font: "Arial",
          size: s.kecil ? 19 : 20,
          color: s.warna === "merah" ? "B00020" : s.warna === "abu" ? "555555" : undefined,
        })
    ),
  });
}

/**
 * Ringkasan penyelesaian dana sebagai kartu bertabel: pita judul gelap, rincian dana awal, realisasi, dan uang harian, baris
 * total yang diakui, lalu pita status berwarna dengan nominal besar (sisa dikembalikan atau kelebihan diganti), dan rumusnya.
 */
function buatRingkasanPenyelesaian(p: RingkasanPenyelesaian): Table {
  const w = warnaPenyelesaian(p.status);
  const garis = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
  const garisTebal = { style: BorderStyle.SINGLE, size: 12, color: "1F2937" };
  const tanpa = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const sel = (anak: Paragraph[], lebar: number, opsi: { isi?: string; span?: number; atas?: typeof garis; kiri?: typeof garis } = {}) =>
    new TableCell({
      width: { size: lebar, type: WidthType.PERCENTAGE },
      columnSpan: opsi.span,
      verticalAlign: VerticalAlign.CENTER,
      shading: opsi.isi ? { type: ShadingType.CLEAR, fill: opsi.isi } : undefined,
      margins: { top: 90, bottom: 90, left: 160, right: 160 },
      borders: { top: opsi.atas ?? garis, bottom: garis, left: opsi.kiri ?? garis, right: garis },
      children: anak,
    });
  const teks = (isi: string, o: { tebal?: boolean; ukuran?: number; warna?: string; rata?: (typeof AlignmentType)[keyof typeof AlignmentType]; spasi?: number } = {}) =>
    new Paragraph({
      alignment: o.rata,
      children: [new TextRun({ text: isi, bold: o.tebal, font: "Arial", size: o.ukuran ?? 20, color: o.warna, characterSpacing: o.spasi })],
    });
  const rincian = rincianPenyelesaian(p);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [sel([teks("RINGKASAN PENYELESAIAN DANA KEGIATAN", { tebal: true, warna: "FFFFFF", ukuran: 21, spasi: 20 })], 100, { isi: "1F2937", span: 2 })],
      }),
      ...rincian.map(
        ([label, nilai], i) =>
          new TableRow({
            cantSplit: true,
            children: [
              sel([teks(label, { warna: "334155" })], 65, { isi: i % 2 ? "F8FAFC" : "FFFFFF" }),
              sel([teks(formatRupiah(nilai), { rata: AlignmentType.RIGHT, warna: "111111" })], 35, { isi: i % 2 ? "F8FAFC" : "FFFFFF" }),
            ],
          })
      ),
      new TableRow({
        cantSplit: true,
        children: [
          sel([teks("Total pengeluaran yang diakui", { tebal: true, ukuran: 21 })], 65, { isi: "EEF2F7", atas: garisTebal }),
          sel([teks(formatRupiah(p.totalDiakui), { tebal: true, ukuran: 21, rata: AlignmentType.RIGHT })], 35, { isi: "EEF2F7", atas: garisTebal }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          sel(
            [
              teks(p.labelStatus.toUpperCase(), { tebal: true, warna: w.teks, ukuran: 19, spasi: 10 }),
              teks(formatRupiah(p.jumlahStatus), { tebal: true, warna: w.teks, ukuran: 34 }),
              teks(rumusPenyelesaian(p), { warna: "475569", ukuran: 17 }),
            ],
            100,
            { isi: w.latar, span: 2, kiri: { style: BorderStyle.SINGLE, size: 36, color: w.garis } }
          ),
        ],
      }),
    ],
    borders: { top: tanpa, bottom: tanpa, left: tanpa, right: tanpa, insideHorizontal: tanpa, insideVertical: tanpa },
  });
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
  foto?: GambarDokumen | null,
  judulFoto = "FOTOKOPI / ARSIP STRUK"
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
          text: judulFoto,
          bold: true,
          font: "Arial",
          size: 18,
          color: "666666",
        }),
      ],
    }),
  ];

  if (foto) {
    try {
      selKananChildren.push(paragrafGambar(foto, 290, 380));
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
            text: "Belum ada foto bukti digital. Tempel fotokopi bukti di sini (wajib untuk struk thermal yang cepat pudar).",
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
 * Pasangan bukti potret (samping):
 * Dua kolom: Kotak tempel di kiri, Foto bukti digital di kanan.
 */
function buatTabelPasanganSamping(
  p: PasanganBuktiLaporan,
  foto?: GambarDokumen | null
): Table {
  const tinggiTwip = convertMillimetersToTwip(p.kotak.tinggiMm);
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

  const lebarKotakPersen = Math.round((p.kotak.lebarMm / 170) * 100);
  const lebarFotoPersen = 100 - lebarKotakPersen;

  const anakKotak: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({
          text: p.kotak.judul,
          bold: true,
          font: "Arial",
          size: 20,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: p.kotak.catatan ? 40 : 80 },
      children: [
        new TextRun({
          text: p.kotak.keterangan,
          font: "Arial",
          size: 18,
          color: "888888",
        }),
      ],
    }),
  ];

  if (p.kotak.catatan) {
    anakKotak.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `(${p.kotak.catatan})`,
            italics: true,
            font: "Arial",
            size: 16,
            color: "999999",
          }),
        ],
      })
    );
  }

  const selKotak = new TableCell({
    width: { size: lebarKotakPersen, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: dashedBorder,
      bottom: dashedBorder,
      left: dashedBorder,
      right: dashedBorder,
    },
    shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: anakKotak,
  });

  const judulFoto = p.label ? `FOTO BUKTI DIGITAL (${p.label.toUpperCase()})` : "FOTO BUKTI DIGITAL";
  const anakFoto: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: judulFoto,
          bold: true,
          font: "Arial",
          size: 17,
          color: "666666",
        }),
      ],
    }),
  ];

  if (foto) {
    const sisaLebarMm = 170 - p.kotak.lebarMm;
    const maksLebarPx = Math.max(160, Math.round(sisaLebarMm * 3.78) - 24);
    const maksTinggiPx = Math.max(160, Math.round(p.kotak.tinggiMm * 3.78) - 30);
    try {
      anakFoto.push(paragrafGambar(foto, maksLebarPx, maksTinggiPx));
    } catch {
      anakFoto.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "[Lampiran foto tidak dapat ditampilkan]",
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
    anakFoto.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({
            text: "Belum ada foto bukti digital. Tempel fotokopi bukti di sini (wajib untuk struk thermal yang cepat pudar).",
            italics: true,
            font: "Arial",
            size: 18,
            color: "888888",
          }),
        ],
      })
    );
  }

  const selFoto = new TableCell({
    width: { size: lebarFotoPersen, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: solidBorder,
      bottom: solidBorder,
      left: solidBorder,
      right: solidBorder,
    },
    shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: anakFoto,
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        height: { value: tinggiTwip, rule: HeightRule.ATLEAST },
        children: [selKotak, selFoto],
      }),
    ],
  });
}

/**
 * Pasangan bukti lanskap (bawah):
 * Foto bukti digital di atas (bila ada), kotak tempel di bawahnya.
 */
function buatTabelPasanganBawah(
  p: PasanganBuktiLaporan,
  foto?: GambarDokumen | null
): Table {
  const tinggiTwip = convertMillimetersToTwip(p.kotak.tinggiMm);
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

  const anakKotak: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({
          text: p.kotak.judul,
          bold: true,
          font: "Arial",
          size: 20,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: p.kotak.catatan ? 40 : 80 },
      children: [
        new TextRun({
          text: p.kotak.keterangan,
          font: "Arial",
          size: 18,
          color: "888888",
        }),
      ],
    }),
  ];

  if (p.kotak.catatan) {
    anakKotak.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `(${p.kotak.catatan})`,
            italics: true,
            font: "Arial",
            size: 16,
            color: "999999",
          }),
        ],
      })
    );
  }

  const baris: TableRow[] = [];

  // Jika ada foto, tampilkan di atas kotak (lanskap: maks lebar 170 mm ~ 580 px, maks tinggi ~70 mm ~ 260 px)
  if (foto) {
    const judulFoto = p.label ? `FOTO BUKTI DIGITAL (${p.label.toUpperCase()})` : "FOTO BUKTI DIGITAL";
    const anakFoto: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: judulFoto,
            bold: true,
            font: "Arial",
            size: 17,
            color: "666666",
          }),
        ],
      }),
    ];
    try {
      anakFoto.push(paragrafGambar(foto, 580, 260));
    } catch {
      anakFoto.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "[Lampiran foto tidak dapat ditampilkan]",
              italics: true,
              font: "Arial",
              size: 18,
              color: "888888",
            }),
          ],
        })
      );
    }

    baris.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: solidBorder,
              bottom: solidBorder,
              left: solidBorder,
              right: solidBorder,
            },
            shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: anakFoto,
          }),
        ],
      })
    );
  }

  // Baris kotak tempel
  baris.push(
    new TableRow({
      cantSplit: true,
      height: { value: tinggiTwip, rule: HeightRule.ATLEAST },
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: dashedBorder,
            bottom: dashedBorder,
            left: dashedBorder,
            right: dashedBorder,
          },
          shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          children: anakKotak,
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: baris,
  });
}

/** Proporsi kolom timesheet (persen): No, Tanggal, Keterangan, Lokasi, Jumlah. Sama dengan tabel di dokumen siap cetak (style.css). */
export const LEBAR_KOLOM_TIMESHEET = [4, 12, 46, 25, 13];
/** Tinggi baris timesheet (twip): ruang tabel pada halaman lanskap A4 (170 mm dikurangi kop, data, total, tanda tangan) dibagi jumlah hari. */
const RUANG_BARIS_TIMESHEET = 3900;
const TINGGI_BARIS_MIN_TIMESHEET = 340;
const TINGGI_BARIS_MAKS_TIMESHEET = 700;

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
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: opsi.rata, children: [teks(isi, { tebal: opsi.tebal, ukuran: 20 })] })],
    });

  const LEBAR = LEBAR_KOLOM_TIMESHEET;
  // Tabel mengisi halaman lanskap: dengan sedikit hari, tinggi baris minimal dibesarkan sampai tabel dan tanda tangan memenuhi
  // halaman; dengan banyak hari baris setinggi isinya dan tabel mengalir ke halaman berikutnya (kepala tabel berulang).
  const tinggiBarisTwip = Math.max(
    TINGGI_BARIS_MIN_TIMESHEET,
    Math.min(TINGGI_BARIS_MAKS_TIMESHEET, Math.floor(RUANG_BARIS_TIMESHEET / Math.max(daftar.baris.length, 1)))
  );
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
        height: { value: tinggiBarisTwip, rule: HeightRule.ATLEAST },
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
        new Paragraph({ spacing: { before: 700 }, alignment: AlignmentType.CENTER, children: [] }),
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
    new Paragraph({ spacing: { before: 160 }, children: [] }),
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
    profilPelapor: profilAsli,
    urutanTransaksiIds = [],
    sertakanDaftarPeriksa = true,
    googleToken,
  } = opsi;

  // 0. Ukur gambar bukti sebelum menyusun laporan agar susunan memiliki rasio foto yang akurat
  const ukuranFoto = new Map<string, { lebar: number; tinggi: number }>();
  const gambarCache = new Map<string, GambarDokumen | null>();

  for (const t of transaksi) {
    for (const b of t.bukti || []) {
      if (b.lebarPx && b.tinggiPx) {
        ukuranFoto.set(b.id, { lebar: b.lebarPx, tinggi: b.tinggiPx });
      } else {
        const g = await muatGambar(b, googleToken);
        gambarCache.set(b.id, g);
        if (g) {
          ukuranFoto.set(b.id, { lebar: g.lebar, tinggi: g.tinggi });
        }
      }
    }
  }

  // 1. Isi dan urutan dokumen dari susunan laporan, sama dengan dokumen siap cetak di aplikasi (lib/susunanLaporan.ts).
  const susunan: SusunanLaporan = susunLaporanKegiatan({
    transaksi,
    kegiatan,
    daftarKegiatan,
    profilPelapor: profilAsli,
    urutanTransaksiIds,
    sertakanDaftarPeriksa,
    ukuranFoto,
  });
  // Profil untuk dokumen: isian kosong dilengkapi dari kop file timesheet (Profil Pelapor sendiri tidak diubah).
  const profilPelapor = susunan.profil;
  const penyelesaian = susunan.penyelesaian;

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
  // Urutan dokumen: timesheet uang harian (lanskap) paling depan, lalu identitas, penerimaan dana, dan tiap kategori (tabel lalu
  // bukti dan kotak tempelnya, potret), ditutup rekapitulasi penyelesaian dana.
  const daftarPerdiemUtama = susunan.daftarPerdiem;
  const bagianWord: { lanskap: boolean; isi: (Paragraph | Table)[] }[] = daftarPerdiemUtama
    ? [
        { lanskap: true, isi: buatBagianPerdiemTimesheet(daftarPerdiemUtama) },
        { lanskap: false, isi: [] },
      ]
    : [{ lanskap: false, isi: [] }];
  let childrenSections = bagianWord[bagianWord.length - 1].isi;
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
  const barisIdentitasData = susunan.identitas;

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
  // BAGIAN 3B: "Rekapitulasi Penggunaan Dana" dan ringkasan penyelesaian (dipasang di akhir dokumen, sesudah semua kategori
  // dan lampirannya)
  // ==========================================
  const selRekap = (isi: string, lebar: number, o: { tebal?: boolean; kepala?: boolean; rata?: (typeof AlignmentType)[keyof typeof AlignmentType]; span?: number; total?: boolean } = {}) =>
    new TableCell({
      width: { size: lebar, type: WidthType.PERCENTAGE },
      columnSpan: o.span,
      shading: o.kepala ? { type: ShadingType.CLEAR, fill: "F0F0F0" } : o.total ? { type: ShadingType.CLEAR, fill: "F8F8F8" } : undefined,
      borders: tableBordersStandard,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: o.rata, children: [new TextRun({ text: isi, bold: o.tebal || o.kepala || o.total, font: "Arial", size: 20 })] })],
    });
  const isiRekap: (Paragraph | Table)[] = [
    new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 80, after: 100 },
      children: [new TextRun({ text: "Rekapitulasi Penggunaan Dana", bold: true, font: "Arial", size: 23, color: "111111" })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBordersStandard,
      rows: [
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            selRekap("No", 8, { kepala: true, rata: AlignmentType.CENTER }),
            selRekap("Kelompok Penggunaan Anggaran", 52, { kepala: true }),
            selRekap("Jumlah Bukti", 16, { kepala: true, rata: AlignmentType.CENTER }),
            selRekap("Jumlah (Rp)", 24, { kepala: true, rata: AlignmentType.RIGHT }),
          ],
        }),
        ...susunan.rekap.map(
          (r) =>
            new TableRow({
              cantSplit: true,
              children: [
                selRekap(String(r.nomor), 8, { rata: AlignmentType.CENTER }),
                selRekap(r.label, 52),
                selRekap(`${r.jumlahBukti} bukti`, 16, { rata: AlignmentType.CENTER }),
                selRekap(formatAngka(r.jumlah), 24, { rata: AlignmentType.RIGHT }),
              ],
            })
        ),
        new TableRow({
          cantSplit: true,
          children: [
            selRekap("Total Pengeluaran", 60, { total: true, span: 2, rata: AlignmentType.RIGHT }),
            selRekap(`${susunan.totalBukti} bukti`, 16, { total: true, rata: AlignmentType.CENTER }),
            selRekap(formatAngka(susunan.totalPengeluaran), 24, { total: true, rata: AlignmentType.RIGHT }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }),
    buatRingkasanPenyelesaian(penyelesaian),
  ];

  // ==========================================
  // TABEL PER KELOMPOK: No | Tanggal | Uraian | Jumlah. Uraian memuat "Diklaim untuk", kelengkapan menurut ketentuan SPJ
  // kategori, dan metode pembayaran. Judul kegiatan tidak diulang (sudah ada di judul dokumen).
  // ==========================================
  const selTabel = (anak: Paragraph[], lebar: number, opsi: { isi?: string; span?: number } = {}) =>
    new TableCell({
      width: { size: lebar, type: WidthType.PERCENTAGE },
      shading: opsi.isi ? { type: ShadingType.CLEAR, fill: opsi.isi } : undefined,
      borders: tableBordersStandard,
      columnSpan: opsi.span,
      verticalAlign: VerticalAlign.CENTER,
      children: anak,
    });
  const teksTabel = (isi: string, opsi: { tebal?: boolean; ukuran?: number; rata?: (typeof AlignmentType)[keyof typeof AlignmentType]; warna?: string } = {}) =>
    new Paragraph({
      alignment: opsi.rata,
      children: [new TextRun({ text: isi, bold: opsi.tebal, font: "Arial", size: opsi.ukuran ?? 19, color: opsi.warna })],
    });
  const buatTabelKelompok = (daftar: BarisTabelLaporan[], labelTotal: string): Table => {
    const kepalaTabel = new TableRow({
      cantSplit: true,
      tableHeader: true,
      children: [
        selTabel([teksTabel("No", { tebal: true, rata: AlignmentType.CENTER })], 7, { isi: "F0F0F0" }),
        selTabel([teksTabel("Tanggal", { tebal: true, rata: AlignmentType.CENTER })], 15, { isi: "F0F0F0" }),
        selTabel([teksTabel("Uraian", { tebal: true })], 58, { isi: "F0F0F0" }),
        selTabel([teksTabel("Jumlah (Rp)", { tebal: true, rata: AlignmentType.RIGHT })], 20, { isi: "F0F0F0" }),
      ],
    });
    const barisTabel = daftar.map(
      (b) =>
        new TableRow({
          cantSplit: true,
          children: [
            selTabel([teksTabel(b.nomor, { rata: AlignmentType.CENTER })], 7),
            selTabel([teksTabel(b.tanggal, { rata: AlignmentType.CENTER })], 15),
            selTabel(
              [
                teksTabel(b.uraian, { tebal: true }),
                ...b.rincian.map((r) => teksTabel(r, { ukuran: 17, tebal: r.startsWith("Diklaim untuk:"), warna: "333333" })),
                teksTabel(b.metode, { ukuran: 17, warna: "555555" }),
              ],
              58
            ),
            selTabel([teksTabel(formatAngka(b.jumlah), { rata: AlignmentType.RIGHT })], 20),
          ],
        })
    );
    const jumlah = daftar.reduce((x, b) => x + b.jumlah, 0);
    const barisJumlah = new TableRow({
      cantSplit: true,
      children: [
        selTabel([teksTabel(labelTotal, { tebal: true, ukuran: 20, rata: AlignmentType.RIGHT })], 80, { isi: "F8F8F8", span: 3 }),
        selTabel([teksTabel(formatAngka(jumlah), { tebal: true, ukuran: 20, rata: AlignmentType.RIGHT })], 20, { isi: "F8F8F8" }),
      ],
    });
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBordersStandard, rows: [kepalaTabel, ...barisTabel, barisJumlah] });
  };

  // Penerimaan Dana (dana awal): tabel pertama sesudah identitas, tanpa mengulang judul kegiatan.
  if (susunan.penerimaan.length > 0) {
    childrenSections.push(
      new Paragraph({
        spacing: { before: 280, after: 100 },
        children: [new TextRun({ text: "Penerimaan Dana (Dana Awal Kegiatan)", bold: true, font: "Arial", size: 23, color: "111111" })],
      }),
      buatTabelKelompok(susunan.penerimaan, "Jumlah Penerimaan Dana")
    );
  }

  // =========================================================
  // BAGIAN 3D: SATU BAGIAN PER KELOMPOK (HALAMAN BARU): judul, tabel, lalu blok tiap pengeluaran: kotak tempel bukti asli,
  // foto bukti digital (semua foto, dua per baris), keterangan, kotak tambahan, dan foto pendukung
  // =========================================================
  for (const kel of susunan.kelompok) {
    // Bagian potret baru sudah mulai di halaman baru, jadi judulnya tidak diberi pemisah halaman lagi (tanpa halaman kosong).
    const bagianBaruKelompok = pindahOrientasi(false);
    childrenSections.push(
      new Paragraph({
        pageBreakBefore: !bagianBaruKelompok,
        spacing: { before: 80, after: 40 },
        children: [new TextRun({ text: `${kel.nomor}. ${kel.judul.toUpperCase()}`, bold: true, font: "Arial", size: 26, color: "000000" })],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `${kel.transaksi.length} bukti pengeluaran · Subtotal ${formatRupiah(kel.subtotal)}`,
            italics: true,
            font: "Arial",
            size: 19,
            color: "555555",
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 140 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "444444" } }, children: [] })
    );
    if (kel.tabel) {
      childrenSections.push(buatTabelKelompok(kel.tabel, `Jumlah ${kel.judul}`), new Paragraph({ spacing: { after: 60 }, children: [] }));
    }

    for (const blok of kel.blok) {
      const trx = blok.transaksi;
      childrenSections.push(
        new Paragraph({
          pageBreakBefore: blok.halamanBaru,
          keepNext: true,
          spacing: { before: blok.halamanBaru ? 80 : 180, after: 60 },
          tabStops: [{ type: AlignmentType.RIGHT, position: convertMillimetersToTwip(170) }],
          children: [
            new TextRun({ text: `No. ${blok.nomor}   ${trx.deskripsi}`, bold: true, underline: {}, font: "Arial", size: 22, color: "111111" }),
            new TextRun({ text: `\t${formatRupiah(trx.jumlah)}`, bold: true, underline: {}, font: "Arial", size: 22, color: "111111" }),
          ],
        })
      );

      // 1. Pasangan bukti asli dan foto bukti digital (satu kotak per foto bukan PDF)
      for (const [idxPasangan, p] of blok.pasangan.entries()) {
        if (idxPasangan > 0) {
          // Jarak antarpasangan minimal 4 mm
          childrenSections.push(new Paragraph({ spacing: { before: 80, after: 0 }, children: [] }));
        }
        let foto: GambarDokumen | null = null;
        if (p.foto) {
          if (gambarCache.has(p.foto.id)) {
            foto = gambarCache.get(p.foto.id) ?? null;
          } else {
            foto = await muatGambar(p.foto, googleToken);
            gambarCache.set(p.foto.id, foto);
          }
        }
        if (p.tataLetak === "samping") {
          childrenSections.push(buatTabelPasanganSamping(p, foto));
        } else {
          childrenSections.push(buatTabelPasanganBawah(p, foto));
        }
      }

      // 2. Lampiran PDF (ditulis sebagai tautan berkas asli)
      for (const tautan of blok.lampiranPdf.map((b) => b.driveLink || b.nama)) {
        childrenSections.push(
          new Paragraph({
            spacing: { before: 40, after: 30 },
            children: [new TextRun({ text: `Lampiran bukti (lihat berkas asli): ${tautan}`, italics: true, font: "Arial", size: 17, color: "555555" })],
          })
        );
      }

      // 3. Keterangan langsung di bawah kotak
      blok.keterangan.forEach((b, i) => childrenSections.push(paragrafKeterangan(b, i === 0 ? 80 : 0)));

      // 4. Kotak tempel tambahan sesuai kelompok (boarding pass, STNK, KTP, NPWP)
      for (const tambahan of blok.kotakTambahan) {
        childrenSections.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }), buatKotakTempel(tambahan.judul, tambahan.keterangan, tambahan.tinggiMm));
      }

      // 5. Foto pendukung transaksi (lebar maks. 12 cm, keterangan miring)
      for (const foto of blok.fotoPendukung) {
        const gambar = await muatGambar(foto, googleToken);
        if (!gambar) continue;
        childrenSections.push(
          new Paragraph({ spacing: { before: 100, after: 0 }, children: [] }),
          paragrafGambar(gambar, 453, 340),
          teksKecilMiring(`Foto Pendukung: ${foto.nama || foto.keterangan || "Dokumentasi kegiatan lapangan"}`)
        );
      }

      // Garis pemisah antarpengeluaran
      childrenSections.push(
        new Paragraph({ spacing: { before: 120, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" } }, children: [] })
      );
    }
  }

  // =========================================================
  // BAGIAN 3E: "DOKUMEN PENDUKUNG" (HALAMAN BARU): timesheet rental kendaraan dan surat justifikasi
  // =========================================================
  const teksArial = (isi: string, o: { tebal?: boolean; ukuran?: number; warna?: string; garisBawah?: boolean } = {}) =>
    new TextRun({ text: isi, bold: o.tebal, underline: o.garisBawah ? {} : undefined, font: "Arial", size: o.ukuran ?? 21, color: o.warna });
  const selTs = (isi: string, lebar: number | undefined, o: { kepala?: boolean; total?: boolean; rata?: (typeof AlignmentType)[keyof typeof AlignmentType]; span?: number } = {}) =>
    new TableCell({
      width: lebar ? { size: lebar, type: WidthType.PERCENTAGE } : undefined,
      columnSpan: o.span,
      shading: o.kepala ? { type: ShadingType.CLEAR, fill: "F0F0F0" } : o.total ? { type: ShadingType.CLEAR, fill: "F8F8F8" } : undefined,
      borders: tableBordersStandard,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: o.rata, children: [teksArial(isi, { tebal: o.kepala || o.total, ukuran: o.total ? 20 : 19 })] })],
    });

  for (const r of susunan.rental) {
    childrenSections.push(
      new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 }, children: [teksArial(r.judul, { tebal: true, ukuran: 26 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [teksArial(r.info, { ukuran: 20, warna: "444444" })] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBordersStandard,
        rows: [
          new TableRow({
            cantSplit: true,
            tableHeader: true,
            children: [
              selTs("No", 6, { kepala: true, rata: AlignmentType.CENTER }),
              selTs("Tanggal", 18, { kepala: true, rata: AlignmentType.CENTER }),
              selTs("Lokasi Basecamp / Rute", 30, { kepala: true }),
              selTs("Cakupan Aktivitas", 32, { kepala: true }),
              selTs("Jarak (km)", 14, { kepala: true, rata: AlignmentType.RIGHT }),
            ],
          }),
          ...r.baris.map(
            (b) =>
              new TableRow({
                cantSplit: true,
                children: [
                  selTs(String(b.no), undefined, { rata: AlignmentType.CENTER }),
                  selTs(b.tanggal, undefined, { rata: AlignmentType.CENTER }),
                  selTs(b.lokasi, undefined),
                  selTs(b.aktivitas, undefined),
                  selTs(`${formatAngka(b.jarakKm)} km`, undefined, { rata: AlignmentType.RIGHT }),
                ],
              })
          ),
          new TableRow({
            cantSplit: true,
            children: [
              selTs(`Total Hari & Jarak Tempuh (${r.baris.length} hari):`, undefined, { total: true, span: 4, rata: AlignmentType.RIGHT }),
              selTs(`${formatAngka(r.totalKm)} km`, undefined, { total: true, rata: AlignmentType.RIGHT }),
            ],
          }),
        ],
      }),
      // Tanda tangan timesheet: pengemudi dan pelapor (tanpa blok Mengetahui)
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
                  new Paragraph({ spacing: { before: 200, after: 30 }, children: [teksArial("Pengemudi / Pemilik Kendaraan,", { ukuran: 20 })] }),
                  new Paragraph({ spacing: { before: 400, after: 20 }, children: [teksArial(`( ${r.namaPemilik} )`, { tebal: true, ukuran: 20 })] }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: tableBordersNone,
                children: [
                  new Paragraph({ spacing: { before: 200, after: 30 }, alignment: AlignmentType.RIGHT, children: [teksArial(r.tanggalTtd, { ukuran: 20 })] }),
                  new Paragraph({ spacing: { after: 30 }, alignment: AlignmentType.RIGHT, children: [teksArial("Surveyor / Pelapor,", { ukuran: 20 })] }),
                  new Paragraph({ spacing: { before: 400, after: 20 }, alignment: AlignmentType.RIGHT, children: [teksArial(`( ${profilPelapor.nama} )`, { tebal: true, ukuran: 20 })] }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  for (const j of susunan.justifikasi) {
    const paragrafNarasi = await susunNarasiSuratJustifikasi(j.paramNarasi);
    childrenSections.push(
      new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, children: [teksArial("SURAT JUSTIFIKASI", { tebal: true, ukuran: 26 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [teksArial(`KETIDAKLENGKAPAN DOKUMEN ${j.jenisBukti}`, { tebal: true, ukuran: 22, warna: "333333" })],
      }),
      new Paragraph({ spacing: { after: 80 }, children: [teksArial("Yang bertanda tangan di bawah ini:")] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBordersNone,
        rows: j.identitas.map(
          (row) =>
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, borders: tableBordersNone, children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [teksArial(row.label, { tebal: true })] })] }),
                new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, borders: tableBordersNone, children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [teksArial(":")] })] }),
                new TableCell({ width: { size: 64, type: WidthType.PERCENTAGE }, borders: tableBordersNone, children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [teksArial(row.nilai || "-")] })] }),
              ],
            })
        ),
      }),
      new Paragraph({ spacing: { before: 140, after: 80 }, children: [teksArial("Dengan ini saya menerangkan sebagai berikut:")] }),
      ...paragrafNarasi.map((p) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 40, after: 80 }, children: [teksArial(p)] })),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 60, after: 180 },
        children: [teksArial(KALIMAT_PENUTUP_JUSTIFIKASI)],
      }),
      // Tanda tangan pelapor saja (tanpa blok persetujuan / Mengetahui)
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBordersNone,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, borders: tableBordersNone, children: [] }),
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                borders: tableBordersNone,
                children: [
                  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [teksArial(j.tempatTanggal)] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 400 }, children: [teksArial("Yang membuat pernyataan,")] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [teksArial(profilPelapor.nama, { tebal: true, garisBawah: true })] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [teksArial(profilPelapor.jabatan, { ukuran: 19, warna: "444444" })] }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Penutup dokumen (potret): rekapitulasi penggunaan dan penyelesaian dana, lalu daftar periksa.
  pindahOrientasi(false);
  childrenSections.push(...isiRekap);

  // =========================================================
  // BAGIAN 3F: "DAFTAR PERIKSA KELENGKAPAN" (HALAMAN TERAKHIR)
  // BISA DIMATIKAN
  // =========================================================
  if (susunan.daftarPeriksa) {
    childrenSections.push(
      new Paragraph({
        pageBreakBefore: true,
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

    const daftarKetentuanItems = (susunan.daftarPeriksa ?? []).map((g) => ({ kelompok: g.judul, butir: g.butir }));

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
                    text: susunan.kepalaHalaman,
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
