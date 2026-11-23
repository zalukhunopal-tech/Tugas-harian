import React, { CSSProperties, useEffect, useState } from "react";
import { BuktiItem, DokumenPendukungItem, FotoPendukung } from "../types";
import { formatAngka, formatRupiah } from "../lib/constants";
import { RingkasanPenyelesaian } from "../lib/penyelesaianDana";
import { DaftarPerdiemDokumen } from "../lib/timesheet";
import { buktiPdf } from "../lib/gambarDokumen";
import { hitungUkuranCetakDokumenMm, SPEC_DOKUMEN_PENDUKUNG } from "../lib/dokumenPendukung";
import {
  BarisKeterangan,
  BarisTabelLaporan,
  BlokTransaksiLaporan,
  JustifikasiLaporan,
  KALIMAT_PENUTUP_JUSTIFIKASI,
  KontrakRentalLaporan,
  KotakTempelLaporan,
  PasanganBuktiLaporan,
  RentalTimesheetLaporan,
  rincianPenyelesaian,
  rumusPenyelesaian,
  SusunanLaporan,
  susunNarasiSuratJustifikasi,
  warnaPenyelesaian,
} from "../lib/susunanLaporan";
import { GambarLampiran } from "./GambarLampiran";

/**
 * Dokumen siap cetak laporan Dana Kegiatan dengan susunan, isi, dan tata letak yang sama dengan dokumen Word
 * (lib/docxGenerator.ts); keduanya dibentuk dari lib/susunanLaporan.ts:
 *   timesheet uang harian (lanskap), judul dan identitas dengan Penerimaan Dana, tiap kelompok pengeluaran di halaman baru
 *   (judul bernomor, tabel, lalu tiap pengeluaran: kotak tempel bukti asli, semua foto bukti digital, keterangan, kotak tambahan,
 *   foto pendukung), dokumen pendukung (timesheet rental, surat justifikasi), rekapitulasi dengan ringkasan penyelesaian dana,
 *   dan daftar periksa.
 * Tiap lembar A4 potret bermargin 20 mm; saat dicetak, kepala halaman dan "Halaman X dari Y" dicetak di margin seperti di Word.
 */

type UbahStatusMuat = (id: string, memuat: boolean) => void;

interface DokumenLaporanKegiatanProps {
  susunan: SusunanLaporan;
  googleToken?: string;
  onStatus: UbahStatusMuat;
  onUkuran?: (id: string, lebar: number, tinggi: number) => void;
}

/** Teks bertanda kutip untuk properti `content` CSS (kepala halaman cetak). */
export function teksKontenCss(teks: string): string {
  return `"${teks.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

/** Kepala halaman dan nomor halaman di margin cetak (kotak margin @page), sama dengan header dan footer dokumen Word. */
const GayaHalamanCetak: React.FC<{ kepala: string }> = ({ kepala }) => {
  const kotak = [
    `@top-right { content: ${teksKontenCss(kepala)}; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #777777; vertical-align: bottom; padding-bottom: 5mm; }`,
    `@bottom-center { content: "Halaman " counter(page) " dari " counter(pages); font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #777777; vertical-align: top; padding-top: 5mm; }`,
  ].join(" ");
  return (
    <style>{`
      @media print {
        @page laporan-kegiatan { ${kotak} }
        @page akomodasi-page { ${kotak} }
        @page timesheet-page { ${kotak} }
      }
    `}</style>
  );
};

/** Satu lembar A4 potret atau lanskap. Di layar kepala halaman tampil di margin atas; saat dicetak diganti kotak margin @page. */
const Lembar: React.FC<{ kepala: string; className?: string; lanskap?: boolean; children: React.ReactNode } & Record<`data-${string}`, string | number | undefined>> = ({
  kepala,
  className,
  lanskap,
  children,
  ...data
}) => (
  <article className={`dsc-kertas dlk-lembar${lanskap ? " dsc-lanskap dlk-lembar--lanskap" : ""}${className ? ` ${className}` : ""}`} {...data}>
    <div className={`dlk-kepala-layar${lanskap ? " dlk-kepala-layar--lanskap" : ""}`} aria-hidden="true">
      {kepala}
    </div>
    {children}
  </article>
);

/* ---------- timesheet uang harian (lanskap) ---------- */

/**
 * Daftar uang harian dengan format yang sama dengan file timesheet: Detail Keuangan / Uang Harian (Per Diem) Kegiatan Lapangan,
 * Proyek, Judul Kegiatan, Nama, Bulan, tabel No | Tanggal | Keterangan | Lokasi | Jumlah (Rp.), Total, dan kolom tanda tangan di bawah tabel.
 * Satu-satunya lembar lanskap (A4 mendatar) dan selalu yang pertama; lembar lain tetap potret.
 * Lembar mengisi A4 mendatar secara proporsional: lebar kolom berupa persen lebar kertas, dan tabelnya meregang mengisi sisa
 * tinggi halaman (baris menjadi lebih lapang bila hanya sedikit hari). Bila baris banyak, tabel mengalir ke halaman berikutnya
 * dan kepala tabel berulang; Total dan tanda tangan (di tfoot) hanya di akhir. Di layar sempit lembar bisa digeser ke samping.
 */
export const LembarPerdiemTimesheet: React.FC<{ daftar: DaftarPerdiemDokumen; kepala?: string }> = ({ daftar, kepala }) => (
  <>
    <p className="dsc-lanskap-petunjuk no-print">
      Lembar uang harian dicetak lanskap (A4 mendatar), halaman lainnya potret<span className="teks-hp">; geser ke samping untuk melihat seluruhnya</span>.
    </p>
    <div className="dsc-lanskap-gulir dsc-bagian-timesheet">
      <div className="dsc-lanskap-bingkai">
        <article
          className="dsc-kertas dsc-timesheet dsc-lanskap"
          data-testid="lembar-timesheet"
          style={{ "--ts-baris": Math.max(daftar.baris.length, 1) } as CSSProperties}
        >
          {kepala && (
            <div className="dlk-kepala-layar dlk-kepala-layar--lanskap" aria-hidden="true">
              {kepala}
            </div>
          )}
          <header className="dsc-ts__kop">
            <div className="dsc-ts__kop-judul">Detail Keuangan</div>
            <div className="dsc-ts__kop-sub">Uang Harian (Per Diem) Kegiatan Lapangan</div>
          </header>
          <dl className="dsc-ts__info">
            <dt>Proyek</dt>
            <dd>: {daftar.proyek}</dd>
            <dt>Judul Kegiatan</dt>
            <dd>: {daftar.judulKegiatan}</dd>
            <dt>Nama</dt>
            <dd>: {daftar.nama}</dd>
            <dt>Bulan</dt>
            <dd>: {daftar.bulan}</dd>
          </dl>
          <table className="dsc-ts__tabel" aria-label="Daftar uang harian kegiatan lapangan">
            <colgroup>
              <col className="dsc-ts__k-no" />
              <col className="dsc-ts__k-tgl" />
              <col className="dsc-ts__k-ket" />
              <col className="dsc-ts__k-lok" />
              <col className="dsc-ts__k-jml" />
            </colgroup>
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Keterangan</th>
                <th>Lokasi</th>
                <th className="dsc-jumlah">Jumlah (Rp.)</th>
              </tr>
            </thead>
            <tbody>
              {daftar.baris.map((b) => (
                <tr key={b.no}>
                  <td>{b.no}</td>
                  <td className="dsc-tgl">{b.tanggal}</td>
                  <td className="dsc-ts__teks">{b.keterangan}</td>
                  <td className="dsc-ts__teks">{b.lokasi}</td>
                  <td className="dsc-jumlah">{formatAngka(b.jumlah)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="dsc-ts__total">
                <td />
                <td />
                <td>Total</td>
                <td />
                <td className="dsc-jumlah">{formatAngka(daftar.total)}</td>
              </tr>
              <tr className="dsc-ts__ttd-baris">
                <td colSpan={5}>
                  <div className="dsc-ts__ttd">
                    <div>
                      <p>Dilaporkan Oleh :</p>
                      <div className="dsc-ts__ttd-ruang" />
                      <p className="dsc-ts__ttd-nama">{daftar.dilaporkanOleh}</p>
                    </div>
                    <div>
                      <p>Disetujui Oleh :</p>
                      <div className="dsc-ts__ttd-ruang" />
                      <p className="dsc-ts__ttd-nama">{daftar.disetujuiOleh}</p>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </article>
      </div>
    </div>
  </>
);

/* ---------- tabel ---------- */

/** Tabel No | Tanggal | Uraian | Jumlah (Rp) dengan baris jumlah, seperti tabel kelompok di Word. */
const TabelLaporan: React.FC<{ baris: BarisTabelLaporan[]; labelTotal: string }> = ({ baris, labelTotal }) => (
  <table className="dlk-tabel">
    <colgroup>
      <col style={{ width: "7%" }} />
      <col style={{ width: "15%" }} />
      <col style={{ width: "58%" }} />
      <col style={{ width: "20%" }} />
    </colgroup>
    <thead>
      <tr>
        <th className="dlk-tengah">No</th>
        <th className="dlk-tengah">Tanggal</th>
        <th>Uraian</th>
        <th className="dlk-kanan">Jumlah (Rp)</th>
      </tr>
    </thead>
    <tbody>
      {baris.map((b) => (
        <tr key={b.transaksi.id}>
          <td className="dlk-tengah">{b.nomor}</td>
          <td className="dlk-tengah">{b.tanggal}</td>
          <td>
            <div className="dlk-tabel__uraian">{b.uraian}</div>
            {b.rincian.map((r, i) => (
              <div key={i} className={`dlk-tabel__rincian${r.startsWith("Diklaim untuk:") ? " dlk-tabel__rincian--diklaim" : ""}`}>
                {r}
              </div>
            ))}
            <div className="dlk-tabel__metode">{b.metode}</div>
          </td>
          <td className="dlk-kanan dsc-jumlah">{formatAngka(b.jumlah)}</td>
        </tr>
      ))}
    </tbody>
    <tfoot>
      <tr>
        <td colSpan={3} className="dlk-kanan">
          {labelTotal}
        </td>
        <td className="dlk-kanan dsc-jumlah">{formatAngka(baris.reduce((s, b) => s + b.jumlah, 0))}</td>
      </tr>
    </tfoot>
  </table>
);

/* ---------- blok tiap pengeluaran ---------- */

const KotakTempel: React.FC<{
  kotak: KotakTempelLaporan;
  catatan?: string;
  mountStyle?: { label?: boolean; border?: boolean; fill?: boolean };
}> = ({ kotak, catatan, mountStyle = { label: true, border: true, fill: true } }) => {
  if (!mountStyle.label && !mountStyle.border && !mountStyle.fill) {
    return (
      <div
        className="dlk-kotak dlk-kotak--bersih"
        style={{
          "--tinggi": kotak.tinggiMm,
          minHeight: `calc(${kotak.tinggiMm} * var(--mm))`,
          width: kotak.lebarMm ? `min(calc(${kotak.lebarMm} * var(--mm)), 100%)` : "100%",
          border: "none",
          background: "transparent",
        } as CSSProperties}
        data-testid="kotak-tempel"
        data-bentuk={kotak.bentuk}
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className="dlk-kotak"
      style={{
        "--tinggi": kotak.tinggiMm,
        minHeight: `calc(${kotak.tinggiMm} * var(--mm))`,
        width: kotak.lebarMm ? `min(calc(${kotak.lebarMm} * var(--mm)), 100%)` : "100%",
      } as CSSProperties}
      data-testid="kotak-tempel"
      data-bentuk={kotak.bentuk}
    >
      {mountStyle.label && (
        <>
          <div className="dlk-kotak__judul">
            {kotak.judul}
            {kotak.dimensiLabel ? ` | ${kotak.dimensiLabel}` : ""}
          </div>
          <div className="dlk-kotak__ket">{kotak.keterangan}</div>
          {catatan && <div className="dlk-kotak__catatan">{catatan}</div>}
        </>
      )}
    </div>
  );
};

const PasanganBukti: React.FC<{
  pasangan: PasanganBuktiLaporan;
}> = ({ pasangan }) => {
  const { kotak, urutan, total, memerlukanKeputusanPengguna, alasanKeputusan } = pasangan;

  const renderPeringatan = () => {
    if (!memerlukanKeputusanPengguna) return null;
    return (
      <div className="dlk-peringatan-keputusan-pengguna" role="alert">
        ⚠️ <strong>Memerlukan Keputusan Pengguna:</strong> {alasanKeputusan || "Ukuran fisik melebihi batas area cetak orientasi ini."}
      </div>
    );
  };

  return (
    <div className="dlk-pasangan-wadah">
      {renderPeringatan()}
      <div
        className="dlk-pasangan dlk-pasangan--tempel-saja"
        data-testid="pasangan-bukti"
        data-urutan={urutan}
        data-total={total}
        data-tataletak="tempel-saja"
        style={{ "--tinggi": kotak.tinggiMm } as CSSProperties}
      >
        <KotakTempel kotak={kotak} catatan={kotak.catatan} />
      </div>
    </div>
  );
};

const BarisKet: React.FC<{ baris: BarisKeterangan }> = ({ baris }) => (
  <p>
    {baris.map((s, i) => (
      <span
        key={i}
        className={[
          s.tebal && "dlk-seg--tebal",
          s.miring && "dlk-seg--miring",
          s.warna === "abu" && "dlk-seg--abu",
          s.warna === "merah" && "dlk-seg--merah",
          s.kecil && "dlk-seg--kecil",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {s.teks}
      </span>
    ))}
  </p>
);

const sebagaiBukti = (f: FotoPendukung): BuktiItem => ({ ...f, tipe: f.tipe || "image/jpeg" });

const dokumenSebagaiBukti = (doc: DokumenPendukungItem): BuktiItem => ({
  id: doc.id,
  nama: doc.nama || doc.label,
  tipe: doc.tipe || "image/jpeg",
  dataUrl: doc.dataUrl,
  driveId: doc.driveId,
  driveLink: doc.driveLink,
  lebarPx: doc.lebarPx,
  tinggiPx: doc.tinggiPx,
});

const KartuDokumenPendukung: React.FC<{
  doc: DokumenPendukungItem;
  lebarMaksMm: number;
  tinggiMaksMm: number;
  googleToken?: string;
  onStatus: UbahStatusMuat;
  onUkuran?: (id: string, lebar: number, tinggi: number) => void;
}> = ({ doc, lebarMaksMm, tinggiMaksMm, googleToken, onStatus, onUkuran }) => {
  const bukti = dokumenSebagaiBukti(doc);
  const spec = SPEC_DOKUMEN_PENDUKUNG[doc.jenis] ?? SPEC_DOKUMEN_PENDUKUNG.lainnya;
  const label = doc.label || spec.labelBaku;
  const ukuran = hitungUkuranCetakDokumenMm(doc, { lebarMaksMm, tinggiMaksMm });

  if (buktiPdf(bukti)) {
    return (
      <div className="dlk-dok-card dlk-dok-card--pdf" data-testid="dokumen-pendukung-cetak" data-jenis={doc.jenis}>
        <div className="dlk-dok-card__label">{label}</div>
        <div className="dlk-dok-card__pdf-info">Berkas PDF: {doc.driveLink || doc.nama}</div>
      </div>
    );
  }

  return (
    <figure
      className="dlk-dok-card"
      data-testid="dokumen-pendukung-cetak"
      data-jenis={doc.jenis}
      style={{ maxWidth: `min(calc(${ukuran.lebarMm} * var(--mm)), 100%)` } as CSSProperties}
    >
      <div
        className="dlk-dok-card__bingkai"
        style={{
          width: `min(calc(${ukuran.lebarMm} * var(--mm)), 100%)`,
          maxHeight: `calc(${ukuran.tinggiMm} * var(--mm))`,
        } as CSSProperties}
      >
        <GambarLampiran bukti={bukti} googleToken={googleToken} onStatus={onStatus} onUkuran={onUkuran} />
      </div>
      <figcaption className="dlk-dok-card__label">{label}</figcaption>
    </figure>
  );
};

const BlokTransaksi: React.FC<{
  blok: BlokTransaksiLaporan;
  googleToken?: string;
  onStatus: UbahStatusMuat;
  onUkuran?: (id: string, lebar: number, tinggi: number) => void;
}> = ({ blok, googleToken, onStatus, onUkuran }) => {
  const t = blok.transaksi;
  const isAkomodasi = t.kategori === "Akomodasi";
  const punyaDokSamping = (blok.dokumenSamping?.length ?? 0) > 0;
  const punyaDokBawah = (blok.dokumenBawah?.length ?? 0) > 0;
  const duaKolom =
    !punyaDokSamping &&
    blok.pasangan.length >= 2 &&
    blok.pasangan.every((p) => p.kotak.lebarMm <= 90);

  const lebarSampingMm = isAkomodasi ? 115 : 86;
  const lebarBawahMm = isAkomodasi ? (blok.dokumenBawah.length >= 2 ? 124 : 255) : 168;
  const tinggiBawahMaksMm = blok.dokumenBawah.length >= 2 ? (isAkomodasi ? 66 : 64) : isAkomodasi ? 82 : 95;

  return (
    <section className="dlk-blok" data-testid="blok-transaksi" data-nomor={blok.nomor}>
      {/* 1. Header Subkategori (jika mulai subkategori baru atau lanjutan) */}
      {blok.mulaiSubkategori && (
        <div className="dlk-subkategori-header" data-testid="subkategori-header">
          <h4 className="dlk-subkategori-judul">
            {blok.subkategoriNomor}. {blok.subkategoriNama}
          </h4>
        </div>
      )}
      {blok.lanjutanSubkategori && !blok.mulaiSubkategori && (
        <div className="dlk-subkategori-lanjutan" data-testid="subkategori-lanjutan">
          <span className="dlk-subkategori-lanjutan-teks">
            (Lanjutan {blok.subkategoriNomor}. {blok.subkategoriNama})
          </span>
        </div>
      )}

      {/* 2. Kepala transaksi */}
      <div className="dlk-blok__kepala">
        <span>
          No. {blok.nomor}
          {"\u00a0\u00a0 "}
          {t.deskripsi}
        </span>
        <span className="dsc-jumlah">{formatRupiah(t.jumlah)}</span>
      </div>

      {/* 3. Keterangan transaksi sebelum ruang tempel bukti fisik */}
      <div className="dlk-keterangan">
        {blok.keterangan.map((b, i) => (
          <BarisKet key={i} baris={b} />
        ))}
      </div>

      {/* 4. Lampiran berkas PDF jika ada */}
      {blok.lampiranPdf.map((b) => (
        <p key={b.id} className="dlk-tautan">
          Lampiran bukti (lihat berkas asli): {b.driveLink || b.nama}
        </p>
      ))}

      {/* 5. Ruang tempel bukti fisik asli (+ dokumen pendukung kartu seperti KTP/STNK/SIM/NPWP bersebelahan) */}
      {punyaDokSamping ? (
        <div
          className="dlk-baris-bukti-dokumen"
          data-testid="baris-bukti-dan-dokumen"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) minmax(0, calc(${lebarSampingMm} * var(--mm)))`,
          } as CSSProperties}
        >
          <div className="dlk-daftar-pasangan" style={{ display: "flex", flexDirection: "column", gap: "calc(4 * var(--mm))" }}>
            {blok.pasangan.map((p, idx) => (
              <PasanganBukti key={`${t.id}-p-${idx}`} pasangan={p} />
            ))}
          </div>
          <div className="dlk-kolom-dokumen-samping" data-testid="kolom-dokumen-samping">
            {blok.dokumenSamping.map((doc) => (
              <KartuDokumenPendukung
                key={doc.id}
                doc={doc}
                lebarMaksMm={lebarSampingMm}
                tinggiMaksMm={92}
                googleToken={googleToken}
                onStatus={onStatus}
                onUkuran={onUkuran}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className={`dlk-daftar-pasangan${duaKolom ? " dlk-daftar-pasangan--dua-kolom" : ""}`}
          style={
            duaKolom
              ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "calc(5 * var(--mm))" }
              : { display: "flex", flexDirection: "column", gap: "calc(5 * var(--mm))" }
          }
        >
          {blok.pasangan.map((p, idx) => (
            <PasanganBukti key={`${t.id}-p-${idx}`} pasangan={p} />
          ))}
        </div>
      )}

      {/* 5b. Dokumen pendukung lebar satu lembar bersama bukti bayar (E-Ticket, Boarding Pass, Kontrak, Absensi, 3 Penawaran, dll.) */}
      {punyaDokBawah && (
        <div
          className={`dlk-dokumen-bawah${isAkomodasi && blok.dokumenBawah.length >= 2 ? " dlk-dokumen-bawah--dua-kolom" : ""}`}
          data-testid="dokumen-pendukung-bawah"
        >
          {blok.dokumenBawah.map((doc) => (
            <KartuDokumenPendukung
              key={doc.id}
              doc={doc}
              lebarMaksMm={lebarBawahMm}
              tinggiMaksMm={tinggiBawahMaksMm}
              googleToken={googleToken}
              onStatus={onStatus}
              onUkuran={onUkuran}
            />
          ))}
        </div>
      )}

      {/* 6. Kotak tempel tambahan jika ada (hanya muncul bila dokumen pendukung belum diunggah) */}
      {blok.kotakTambahan.map((k, i) => (
        <div className="dlk-kotak-tambahan" key={i}>
          <KotakTempel kotak={k} />
        </div>
      ))}

      {/* 7. Foto pendukung jika ada */}
      {blok.fotoPendukung.map((f) => (
        <figure key={f.id} className="dlk-foto dlk-foto--pendukung">
          <GambarLampiran bukti={sebagaiBukti(f)} googleToken={googleToken} onStatus={onStatus} onUkuran={onUkuran} />
          <figcaption>Foto Pendukung: {f.nama || f.keterangan || "Dokumentasi kegiatan lapangan"}</figcaption>
        </figure>
      ))}

      <hr className="dlk-pemisah" />
    </section>
  );
};

/** Blok pengeluaran dibagi per halaman menurut aturan Word: blok bertanda halamanBaru membuka lembar baru. */
function bagiPerHalaman(blok: BlokTransaksiLaporan[]): BlokTransaksiLaporan[][] {
  const hasil: BlokTransaksiLaporan[][] = [[]];
  for (const b of blok) {
    if (b.halamanBaru && hasil[hasil.length - 1].length > 0) hasil.push([]);
    hasil[hasil.length - 1].push(b);
  }
  return hasil;
}

/* ---------- dokumen pendukung ---------- */

const LembarKontrakRental: React.FC<{ k: KontrakRentalLaporan; kepala: string }> = ({ k, kepala }) => (
  <Lembar kepala={kepala} className="dlk-surat dlk-kontrak" data-testid="dlk-kontrak-rental">
    <h3 className="dlk-judul-tengah dlk-kontrak__judul">SURAT PERJANJIAN SEWA KENDARAAN BERMOTOR</h3>
    <p className="dlk-kontrak__pembuka">Pada hari {k.hariTanggal}, kami yang bertanda tangan di bawah ini:</p>

    <p className="dlk-kontrak__pihak">Pihak Pertama (Pemilik Kendaraan):</p>
    <table className="dlk-identitas dlk-identitas--surat dlk-kontrak__tabel">
      <tbody>
        <tr>
          <td>Nama</td>
          <td>:</td>
          <td>{k.pihakPertama.nama}</td>
        </tr>
        <tr>
          <td>Pekerjaan</td>
          <td>:</td>
          <td>{k.pihakPertama.pekerjaan}</td>
        </tr>
        <tr>
          <td>Alamat KTP</td>
          <td>:</td>
          <td>{k.pihakPertama.alamatKtp}</td>
        </tr>
      </tbody>
    </table>

    <p className="dlk-kontrak__pihak">Pihak Kedua (Penyewa):</p>
    <table className="dlk-identitas dlk-identitas--surat dlk-kontrak__tabel">
      <tbody>
        <tr>
          <td>Nama</td>
          <td>:</td>
          <td>{k.pihakKedua.nama}</td>
        </tr>
        <tr>
          <td>Pekerjaan</td>
          <td>:</td>
          <td>{k.pihakKedua.pekerjaan}</td>
        </tr>
        <tr>
          <td>Alamat</td>
          <td>:</td>
          <td>{k.pihakKedua.alamat}</td>
        </tr>
      </tbody>
    </table>

    <p className="dlk-kontrak__pembuka">
      Dengan ini Pihak Pertama menyewakan kendaraan bermotor kepada Pihak Kedua dengan spesifikasi:
    </p>
    <table className="dlk-identitas dlk-identitas--surat dlk-kontrak__tabel">
      <tbody>
        <tr>
          <td>Merk / Jenis</td>
          <td>:</td>
          <td>{k.kendaraan.merkJenis}</td>
        </tr>
        <tr>
          <td>Tahun</td>
          <td>:</td>
          <td>{k.kendaraan.tahun}</td>
        </tr>
        <tr>
          <td>No. Polisi</td>
          <td>:</td>
          <td>{k.kendaraan.noPolisi}</td>
        </tr>
      </tbody>
    </table>

    <p className="dlk-kontrak__pembuka">Adapun syarat dan ketentuan dalam perjanjian sewa menyewa ini sebagai berikut:</p>
    <ol className="dlk-kontrak__klausul">
      {k.klausul.map((isi, idx) => (
        <li key={idx}>{isi}</li>
      ))}
    </ol>

    <p className="dlk-surat__narasi dlk-surat__penutup">
      Demikian surat perjanjian sewa menyewa dibuat agar dapat dipergunakan sebagaimana mestinya dan dibuat rangkap dua dengan dilampirkan materai serta mempunyai kekuatan hukum yang sama.
    </p>

    <div className="dlk-ttd-dua dlk-kontrak__ttd">
      <div className="dlk-tengah">
        <p className="dlk-seg--tebal">Pihak Pertama</p>
        <div className="dlk-ttd-ruang dlk-kontrak__materai">
          <span>Materai Rp10.000</span>
        </div>
        <p className="dlk-seg--tebal">( {k.pihakPertama.nama} )</p>
      </div>
      <div className="dlk-tengah">
        <p className="dlk-seg--tebal">Pihak Kedua</p>
        <div className="dlk-ttd-ruang" />
        <p className="dlk-seg--tebal">( {k.pihakKedua.nama} )</p>
      </div>
    </div>
  </Lembar>
);

const LembarRental: React.FC<{ r: RentalTimesheetLaporan; kepala: string; namaPelapor: string }> = ({ r, kepala, namaPelapor }) => (
  <Lembar kepala={kepala} data-testid="dlk-rental">
    <h3 className="dlk-judul-tengah">{r.judul}</h3>
    <p className="dlk-info-tengah">{r.info}</p>
    <table className="dlk-tabel">
      <colgroup>
        <col style={{ width: "6%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "32%" }} />
        <col style={{ width: "14%" }} />
      </colgroup>
      <thead>
        <tr>
          <th className="dlk-tengah">No</th>
          <th className="dlk-tengah">Tanggal</th>
          <th>Lokasi Basecamp / Rute</th>
          <th>Cakupan Aktivitas</th>
          <th className="dlk-kanan">Jarak (km)</th>
        </tr>
      </thead>
      <tbody>
        {r.baris.map((b) => (
          <tr key={b.no}>
            <td className="dlk-tengah">{b.no}</td>
            <td className="dlk-tengah">{b.tanggal}</td>
            <td>{b.lokasi}</td>
            <td>{b.aktivitas}</td>
            <td className="dlk-kanan dsc-jumlah">{formatAngka(b.jarakKm)} km</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} className="dlk-kanan">
            Total Hari &amp; Jarak Tempuh ({r.baris.length} hari):
          </td>
          <td className="dlk-kanan dsc-jumlah">{formatAngka(r.totalKm)} km</td>
        </tr>
      </tfoot>
    </table>
    <div className="dlk-ttd-dua">
      <div>
        <p>Pengemudi / Pemilik Kendaraan,</p>
        <div className="dlk-ttd-ruang" />
        <p className="dlk-seg--tebal">( {r.namaPemilik} )</p>
      </div>
      <div className="dlk-kanan">
        <p>{r.tanggalTtd}</p>
        <p>Surveyor / Pelapor,</p>
        <div className="dlk-ttd-ruang" />
        <p className="dlk-seg--tebal">( {namaPelapor} )</p>
      </div>
    </div>
  </Lembar>
);

const LembarJustifikasi: React.FC<{ j: JustifikasiLaporan; kepala: string; namaPelapor: string; jabatan: string }> = ({ j, kepala, namaPelapor, jabatan }) => {
  const [narasi, setNarasi] = useState<string[]>(j.narasiBaku);
  const kunci = JSON.stringify(j.paramNarasi);
  useEffect(() => {
    let batal = false;
    susunNarasiSuratJustifikasi(j.paramNarasi).then((p) => {
      if (!batal) setNarasi(p);
    });
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);
  return (
    <Lembar kepala={kepala} className="dlk-surat" data-testid="dlk-justifikasi">
      <h3 className="dlk-judul-tengah">SURAT JUSTIFIKASI</h3>
      <p className="dlk-subjudul dlk-subjudul--kecil">KETIDAKLENGKAPAN DOKUMEN {j.jenisBukti}</p>
      <p>Yang bertanda tangan di bawah ini:</p>
      <table className="dlk-identitas dlk-identitas--surat">
        <tbody>
          {j.identitas.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>:</td>
              <td>{r.nilai || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dlk-surat__pembuka">Dengan ini saya menerangkan sebagai berikut:</p>
      {narasi.map((p, i) => (
        <p key={i} className="dlk-surat__narasi">
          {p}
        </p>
      ))}
      <p className="dlk-surat__narasi dlk-surat__penutup">{KALIMAT_PENUTUP_JUSTIFIKASI}</p>
      <div className="dlk-ttd-kanan">
        <p>{j.tempatTanggal}</p>
        <p>Yang membuat pernyataan,</p>
        <div className="dlk-ttd-ruang" />
        <p className="dlk-ttd-nama">{namaPelapor}</p>
        <p className="dlk-ttd-jabatan">{jabatan}</p>
      </div>
    </Lembar>
  );
};

/* ---------- rekapitulasi dan ringkasan penyelesaian ---------- */

/**
 * Ringkasan penyelesaian dana sebagai kartu bertabel, sama dengan dokumen Word: pita judul gelap, rincian dana awal, realisasi,
 * dan uang harian, baris total yang diakui, lalu pita status berwarna dengan nominal besar dan rumus hitungannya.
 */
export const RingkasanPenyelesaianCetak: React.FC<{ p: RingkasanPenyelesaian }> = ({ p }) => {
  const w = warnaPenyelesaian(p.status);
  return (
    <table
      className="dlk-ringkasan"
      data-testid="ringkasan-penyelesaian"
      data-status={p.status}
      style={{ "--rs-latar": `#${w.latar}`, "--rs-garis": `#${w.garis}`, "--rs-teks": `#${w.teks}` } as CSSProperties}
    >
      <thead>
        <tr>
          <th colSpan={2}>RINGKASAN PENYELESAIAN DANA KEGIATAN</th>
        </tr>
      </thead>
      <tbody>
        {rincianPenyelesaian(p).map(([label, nilai]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className="dsc-jumlah">{formatRupiah(nilai)}</td>
          </tr>
        ))}
        <tr className="dlk-ringkasan__total">
          <td>Total pengeluaran yang diakui</td>
          <td className="dsc-jumlah">{formatRupiah(p.totalDiakui)}</td>
        </tr>
        <tr className="dlk-ringkasan__status">
          <td colSpan={2}>
            <div className="dlk-ringkasan__label">{p.labelStatus.toUpperCase()}</div>
            <div className="dlk-ringkasan__nominal">{formatRupiah(p.jumlahStatus)}</div>
            <div className="dlk-ringkasan__rumus">{rumusPenyelesaian(p)}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

/* ---------- dokumen ---------- */

export const DokumenLaporanKegiatan: React.FC<DokumenLaporanKegiatanProps> = ({ susunan, googleToken, onStatus, onUkuran }) => {
  const { kepalaHalaman: kepala, profil } = susunan;
  return (
    <>
      <GayaHalamanCetak kepala={kepala} />

      {/* 1. Timesheet uang harian (lanskap) */}
      {susunan.daftarPerdiem && <LembarPerdiemTimesheet daftar={susunan.daftarPerdiem} kepala={kepala} />}

      {/* 2. Judul, identitas, dan Penerimaan Dana */}
      <Lembar kepala={kepala} data-testid="dlk-identitas">
        <h2 className="dlk-judul">LAPORAN KEUANGAN KEGIATAN</h2>
        <p className="dlk-subjudul">{susunan.kegiatan.nama.toUpperCase()}</p>
        <table className="dlk-identitas">
          <tbody>
            {susunan.identitas.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>:</td>
                <td>{r.nilai}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {susunan.penerimaan.length > 0 && (
          <>
            <h3 className="dlk-judul-bagian">Penerimaan Dana (Dana Awal Kegiatan)</h3>
            <TabelLaporan baris={susunan.penerimaan} labelTotal="Jumlah Penerimaan Dana" />
          </>
        )}
      </Lembar>

      {/* 3. Tiap kelompok pengeluaran di halaman baru */}
      {susunan.kelompok.map((kel) =>
        bagiPerHalaman(kel.blok).map((halaman, i) => (
          <Lembar
            key={`${kel.kategori}-${i}`}
            kepala={kepala}
            lanskap={kel.kategori === "Akomodasi"}
            data-testid={i === 0 ? "dlk-kelompok" : "dlk-kelompok-lanjutan"}
            data-kategori={kel.kategori}
          >
            {i === 0 && (
              <>
                <h3 className="dlk-judul-kelompok">
                  {kel.nomor}. {kel.judul.toUpperCase()}
                </h3>
                <p className="dlk-sub-kelompok">
                  {kel.transaksi.length} bukti pengeluaran · Subtotal {formatRupiah(kel.subtotal)}
                </p>
                {kel.tabel && <TabelLaporan baris={kel.tabel} labelTotal={`Jumlah ${kel.judul}`} />}
              </>
            )}
            {halaman.map((b) => (
              <BlokTransaksi key={b.transaksi.id} blok={b} googleToken={googleToken} onStatus={onStatus} onUkuran={onUkuran} />
            ))}
          </Lembar>
        ))
      )}

      {/* 4. Dokumen pendukung */}
      {susunan.kontrakRental.map((k) => (
        <LembarKontrakRental key={`kontrak-${k.transaksi.id}`} k={k} kepala={kepala} />
      ))}
      {susunan.rental.map((r) => (
        <LembarRental key={r.transaksi.id} r={r} kepala={kepala} namaPelapor={profil.nama} />
      ))}
      {susunan.justifikasi.map((j) => (
        <LembarJustifikasi key={j.transaksi.id} j={j} kepala={kepala} namaPelapor={profil.nama} jabatan={profil.jabatan} />
      ))}

      {/* 5. Rekapitulasi penggunaan dana dan ringkasan penyelesaian */}
      <Lembar kepala={kepala} data-testid="dlk-rekap">
        <h3 className="dlk-judul-bagian dlk-judul-bagian--awal">Rekapitulasi Penggunaan Dana</h3>
        <table className="dlk-tabel dlk-tabel--rekap">
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "52%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "24%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="dlk-tengah">No</th>
              <th>Kelompok Penggunaan Anggaran</th>
              <th className="dlk-tengah">Jumlah Bukti</th>
              <th className="dlk-kanan">Jumlah (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {susunan.rekap.map((r) => (
              <tr key={r.nomor}>
                <td className="dlk-tengah">{r.nomor}</td>
                <td>{r.label}</td>
                <td className="dlk-tengah">{r.jumlahBukti} bukti</td>
                <td className="dlk-kanan dsc-jumlah">{formatAngka(r.jumlah)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="dlk-kanan">
                Total Pengeluaran
              </td>
              <td className="dlk-tengah">{susunan.totalBukti} bukti</td>
              <td className="dlk-kanan dsc-jumlah">{formatAngka(susunan.totalPengeluaran)}</td>
            </tr>
          </tfoot>
        </table>
        <RingkasanPenyelesaianCetak p={susunan.penyelesaian} />
      </Lembar>

      {/* 6. Daftar periksa kelengkapan (Tabel Lembaga 17 Kategori Otoritatif) */}
      {susunan.daftarPeriksa && (
        <Lembar kepala={kepala} data-testid="dlk-daftar-periksa">
          <h3 className="dlk-judul-tengah">DAFTAR PERIKSA KELENGKAPAN SPJ</h3>
          <p className="dlk-catatan-tengah">Kelengkapan Pelaporan Keuangan - dokumen lembaga</p>
          <table className="dlk-tabel dlk-periksa">
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "64%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="dlk-tengah">No</th>
                <th>Jenis</th>
                <th>Dokumen pendukung</th>
                <th className="dlk-tengah">cek</th>
              </tr>
            </thead>
            <tbody>
              {susunan.daftarPeriksa.map((item, idx) => (
                <tr key={idx}>
                  <td className="dlk-tengah" style={{ verticalAlign: "top" }}>{item.nomor ?? idx + 1}</td>
                  <td style={{ verticalAlign: "top", fontWeight: 700 }}>{item.jenis || item.judul}</td>
                  <td style={{ verticalAlign: "top" }}>
                    {item.butir.length === 1 ? (
                      item.butir[0]
                    ) : (
                      <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
                        {item.butir.map((b, bi) => (
                          <li key={bi} style={{ marginBottom: "2px" }}>{b}</li>
                        ))}
                      </ol>
                    )}
                  </td>
                  <td className="dlk-periksa__cek" style={{ verticalAlign: "top" }}>☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Lembar>
      )}
    </>
  );
};
