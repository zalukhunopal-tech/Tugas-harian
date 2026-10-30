import React, { CSSProperties, useEffect, useState } from "react";
import { BuktiItem, FotoPendukung } from "../types";
import { formatAngka, formatRupiah } from "../lib/constants";
import { RingkasanPenyelesaian } from "../lib/penyelesaianDana";
import { DaftarPerdiemDokumen } from "../lib/timesheet";
import {
  BarisKeterangan,
  BarisTabelLaporan,
  BlokTransaksiLaporan,
  JustifikasiLaporan,
  KALIMAT_PENUTUP_JUSTIFIKASI,
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
  return <style>{`@media print { @page laporan-kegiatan { ${kotak} } @page timesheet-page { ${kotak} } }`}</style>;
};

/** Satu lembar A4 potret. Di layar kepala halaman tampil di margin atas; saat dicetak diganti kotak margin @page. */
const Lembar: React.FC<{ kepala: string; className?: string; children: React.ReactNode } & Record<`data-${string}`, string | number | undefined>> = ({
  kepala,
  className,
  children,
  ...data
}) => (
  <article className={`dsc-kertas dlk-lembar${className ? ` ${className}` : ""}`} {...data}>
    <div className="dlk-kepala-layar" aria-hidden="true">
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

const KotakTempel: React.FC<{ kotak: KotakTempelLaporan; catatan?: string }> = ({ kotak, catatan }) => (
  <div className="dlk-kotak" style={{ "--tinggi": kotak.tinggiMm } as CSSProperties} data-testid="kotak-tempel" data-bentuk={kotak.bentuk}>
    <div className="dlk-kotak__judul">{kotak.judul}</div>
    <div className="dlk-kotak__ket">{kotak.keterangan}</div>
    {catatan && <div className="dlk-kotak__catatan">{catatan}</div>}
  </div>
);

const PasanganBukti: React.FC<{
  pasangan: PasanganBuktiLaporan;
  googleToken?: string;
  onStatus: UbahStatusMuat;
  onUkuran?: (id: string, lebar: number, tinggi: number) => void;
}> = ({ pasangan, googleToken, onStatus, onUkuran }) => {
  const { kotak, foto, tataLetak, urutan, total, label } = pasangan;
  const judulFoto = `FOTO BUKTI DIGITAL${total > 1 ? ` (${urutan} DARI ${total})` : ""}`;

  if (tataLetak === "samping") {
    return (
      <div
        className="dlk-struk dlk-pasangan--samping"
        data-testid="pasangan-bukti"
        data-urutan={urutan}
        data-total={total}
        data-tataletak="samping"
        style={{
          "--tinggi": kotak.tinggiMm,
          "--lebar-kotak": kotak.lebarMm,
          gridTemplateColumns: `calc(${kotak.lebarMm} * var(--mm)) 1fr`,
          minHeight: `calc(${kotak.tinggiMm} * var(--mm))`,
        } as CSSProperties}
      >
        <KotakTempel kotak={kotak} catatan={kotak.catatan} />
        <div className="dlk-struk__foto">
          <div className="dlk-struk__judul-foto">{judulFoto}</div>
          {foto ? (
            <figure className="dlk-foto dlk-foto--struk" data-testid="foto-bukti">
              <GambarLampiran bukti={foto} googleToken={googleToken} onStatus={onStatus} onUkuran={onUkuran} />
              {label && <figcaption className="dlk-foto__label">{label}</figcaption>}
            </figure>
          ) : (
            <p className="dlk-struk__kosong">Belum ada foto bukti digital. Tempel fotokopi bukti di sini (wajib untuk struk thermal yang cepat pudar).</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="dlk-pasangan dlk-pasangan--bawah"
      data-testid="pasangan-bukti"
      data-urutan={urutan}
      data-total={total}
      data-tataletak="bawah"
      style={{
        "--tinggi": kotak.tinggiMm,
      } as CSSProperties}
    >
      {foto && (
        <div className="dlk-foto-tunggal" style={{ marginBottom: "calc(4 * var(--mm))" }}>
          <div className="dlk-foto-judul">{judulFoto}</div>
          <figure className="dlk-foto" data-testid="foto-bukti">
            <GambarLampiran bukti={foto} googleToken={googleToken} onStatus={onStatus} onUkuran={onUkuran} />
            {label && <figcaption className="dlk-foto__label">{label}</figcaption>}
          </figure>
        </div>
      )}
      <KotakTempel kotak={kotak} catatan={kotak.catatan} />
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

const BlokTransaksi: React.FC<{
  blok: BlokTransaksiLaporan;
  googleToken?: string;
  onStatus: UbahStatusMuat;
  onUkuran?: (id: string, lebar: number, tinggi: number) => void;
}> = ({ blok, googleToken, onStatus, onUkuran }) => {
  const t = blok.transaksi;
  return (
    <section className="dlk-blok" data-testid="blok-transaksi" data-nomor={blok.nomor}>
      <div className="dlk-blok__kepala">
        <span>
          No. {blok.nomor}
          {"\u00a0\u00a0 "}
          {t.deskripsi}
        </span>
        <span className="dsc-jumlah">{formatRupiah(t.jumlah)}</span>
      </div>

      <div className="dlk-daftar-pasangan" style={{ display: "flex", flexDirection: "column", gap: "calc(4 * var(--mm))" }}>
        {blok.pasangan.map((p, idx) => (
          <PasanganBukti
            key={`${t.id}-p-${idx}`}
            pasangan={p}
            googleToken={googleToken}
            onStatus={onStatus}
            onUkuran={onUkuran}
          />
        ))}
      </div>

      {blok.lampiranPdf.map((b) => (
        <p key={b.id} className="dlk-tautan">
          Lampiran bukti (lihat berkas asli): {b.driveLink || b.nama}
        </p>
      ))}

      <div className="dlk-keterangan">
        {blok.keterangan.map((b, i) => (
          <BarisKet key={i} baris={b} />
        ))}
      </div>

      {blok.kotakTambahan.map((k, i) => (
        <div className="dlk-kotak-tambahan" key={i}>
          <KotakTempel kotak={k} />
        </div>
      ))}

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
          <Lembar key={`${kel.kategori}-${i}`} kepala={kepala} data-testid={i === 0 ? "dlk-kelompok" : "dlk-kelompok-lanjutan"} data-kategori={kel.kategori}>
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

      {/* 6. Daftar periksa kelengkapan (bisa dimatikan) */}
      {susunan.daftarPeriksa && (
        <Lembar kepala={kepala} data-testid="dlk-daftar-periksa">
          <h3 className="dlk-judul-tengah">DAFTAR PERIKSA KELENGKAPAN SPJ</h3>
          <p className="dlk-catatan-tengah">(Halaman ini sebagai panduan internal kelengkapan dokumen dan boleh tidak dicetak)</p>
          <table className="dlk-tabel dlk-periksa">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "92%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="dlk-tengah">Cek</th>
                <th>Persyaratan &amp; Dokumen Kelengkapan</th>
              </tr>
            </thead>
            <tbody>
              {susunan.daftarPeriksa.map((g) => (
                <React.Fragment key={g.judul}>
                  <tr className="dlk-periksa__grup">
                    <td colSpan={2}>{g.judul}</td>
                  </tr>
                  {g.butir.map((b, i) => (
                    <tr key={i}>
                      <td className="dlk-periksa__cek">☐</td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </Lembar>
      )}
    </>
  );
};
