import React, { useEffect, useMemo, useState } from "react";
import { BuktiItem, DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import { formatAngka, formatRupiah, KELOMPOK_DANA_KEGIATAN, labelKategori } from "../lib/constants";
import { KotakPratinjauBelumTersedia, muatPratinjauBukti } from "../lib/driveBuktiLoader";
import { RingkasanPenyelesaian } from "../lib/penyelesaianDana";
import { KartuPenyelesaianDana } from "./KartuPenyelesaianDana";
import { DaftarPerdiemDokumen, susunDaftarPerdiem } from "../lib/timesheet";
import { KATEGORI_PERDIEM } from "../lib/penyelesaianDana";
import { adalahKudapanPerjalanan, barisPenerimaManfaat } from "../lib/penerimaManfaat";
import { KotakTempel, perkirakanHalamanTempel, ringkasKotak, susunKotakTempel } from "../lib/lembarTempel";
import { cetakDokumen, ModeCetak } from "../lib/cetak";

interface DokumenSiapCetakProps {
  /** Transaksi yang sudah disaring dan diurutkan menurut tanggal oleh LaporanView. */
  transaksi: Transaksi[];
  judulLaporan: string;
  periodeTeks: string;
  adalahKegiatan: boolean;
  kegiatan?: DataKegiatan;
  profilPelapor: ProfilPelapor;
  googleToken?: string;
  penyelesaian?: RingkasanPenyelesaian | null;
  penyelesaianSementara?: boolean;
  /** Nama dan rentang kegiatan yang dihitung pada penyelesaian dana (bisa lebih dari periode laporan). */
  namaKegiatanPenyelesaian?: string;
  rentangKegiatanPenyelesaian?: string;
}

interface Kelompok {
  kunci: string;
  huruf: string;
  judul: string;
  jenis: "pemasukan" | "pengeluaran";
  item: Transaksi[];
  total: number;
}

const HURUF = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const KATEGORI_PINDAH_DANA = "Pindah Dana";

function urutkanDalamKelompok(item: Transaksi[], urutanManual: Map<string, number>): Transaksi[] {
  return [...item].sort((a, b) => {
    const ia = urutanManual.has(a.id) ? urutanManual.get(a.id)! : 999999;
    const ib = urutanManual.has(b.id) ? urutanManual.get(b.id)! : 999999;
    if (ia !== ib) return ia - ib;
    return a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id);
  });
}

/**
 * Pemasukan jadi satu kelompok di depan, pengeluaran dikelompokkan per kategori. Untuk Dana Kegiatan urutan
 * kategorinya mengikuti KELOMPOK_DANA_KEGIATAN (sama dengan dokumen Word); lainnya dari yang terbesar.
 * "Pindah Dana" tidak masuk dokumen karena hanya perpindahan antar dana milik sendiri.
 */
export function susunKelompokDokumen(
  transaksi: Transaksi[],
  adalahKegiatan: boolean,
  urutanTransaksiIds: string[] = []
): Kelompok[] {
  const urutanManual = new Map<string, number>();
  urutanTransaksiIds.forEach((id, i) => urutanManual.set(id, i));
  const berlaku = transaksi.filter((t) => t.kategori !== KATEGORI_PINDAH_DANA);

  const hasil: Omit<Kelompok, "huruf">[] = [];

  const masuk = berlaku.filter((t) => t.jenis === "pemasukan");
  if (masuk.length > 0) {
    hasil.push({
      kunci: "pemasukan",
      judul: adalahKegiatan ? "Penerimaan Dana (Dana Awal Kegiatan)" : "Pemasukan",
      jenis: "pemasukan",
      item: urutkanDalamKelompok(masuk, urutanManual),
      total: masuk.reduce((s, t) => s + t.jumlah, 0),
    });
  }

  const perKategori = new Map<string, Transaksi[]>();
  for (const t of berlaku.filter((x) => x.jenis === "pengeluaran")) {
    const list = perKategori.get(t.kategori) || [];
    list.push(t);
    perKategori.set(t.kategori, list);
  }
  const kategoriUrut = [...perKategori.entries()].map(([kategori, item]) => ({
    kategori,
    item,
    total: item.reduce((s, t) => s + t.jumlah, 0),
  }));
  kategoriUrut.sort((a, b) => {
    if (adalahKegiatan) {
      const ia = KELOMPOK_DANA_KEGIATAN.indexOf(a.kategori);
      const ib = KELOMPOK_DANA_KEGIATAN.indexOf(b.kategori);
      const pa = ia >= 0 ? ia : 999;
      const pb = ib >= 0 ? ib : 999;
      if (pa !== pb) return pa - pb;
    }
    return b.total - a.total;
  });
  for (const k of kategoriUrut) {
    hasil.push({
      kunci: `kategori:${k.kategori}`,
      judul: labelKategori(k.kategori),
      jenis: "pengeluaran",
      item: urutkanDalamKelompok(k.item, urutanManual),
      total: k.total,
    });
  }

  return hasil.map((k, i) => ({ ...k, huruf: HURUF[i] ?? String(i + 1) }));
}

function tanggalSingkat(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Keterangan singkat dari rincian khusus Dana Kegiatan, satu baris per hal (penerima manfaat tampil terpisah). */
function keteranganRincian(t: Transaksi): string[] {
  const d = t.detailKegiatan;
  if (!d) return [];
  const baris: string[] = [];
  if (d.perdiem?.jumlahHari && d.perdiem?.tarifPerHari) {
    baris.push(
      `Uang harian ${d.perdiem.jumlahHari} hari × ${formatRupiah(d.perdiem.tarifPerHari)}${d.perdiem.keterangan ? ` (${d.perdiem.keterangan})` : ""}`
    );
  }
  if (d.rincian) {
    baris.push(`${d.rincian.banyaknya} ${d.rincian.satuan} × ${formatRupiah(d.rincian.hargaSatuan)}`);
  }
  if (d.transportasi?.moda) {
    baris.push(`${d.transportasi.dari || "?"} → ${d.transportasi.ke || "?"} (${d.transportasi.moda})`);
  }
  if (d.rentalKendaraan?.jenisMerk) {
    baris.push(`${d.rentalKendaraan.jenisMerk}${d.rentalKendaraan.noPolisi ? ` (${d.rentalKendaraan.noPolisi})` : ""}, ${d.rentalKendaraan.jumlahHari || 1} hari`);
  }
  if (d.bbm?.jarakTempuh) baris.push(`BBM ${d.bbm.jarakTempuh} km`);
  if (d.akomodasi?.lokasi) baris.push(`${d.akomodasi.lokasi}, ${d.akomodasi.jumlahMalam || 1} malam`);
  if (d.konsumsi?.jumlahPeserta && !adalahKudapanPerjalanan(t.kategori, d)) baris.push(`${d.konsumsi.jumlahPeserta} peserta`);
  if (d.honorarium?.namaPenerima) baris.push(`Honor ${d.honorarium.namaPenerima}`);
  if (d.keteranganLaporan) baris.push(d.keteranganLaporan);
  return baris;
}

/* ---------- lampiran ---------- */

type StatusFoto = "memuat" | "ok" | "pdf" | "gagal";

interface GambarLampiranProps {
  bukti: BuktiItem;
  googleToken?: string;
  onStatus: (id: string, memuat: boolean) => void;
}

/**
 * Foto bukti ditampilkan apa adanya: lebar dan tinggi dibiarkan `auto`, dibatasi `max-*` 100% dari kotaknya
 * dan `object-fit: contain`. Rasio asli terjaga (tidak melar, tidak terpotong), dan nota kecil tidak
 * diperbesar melebihi ukuran aslinya, seperti struk yang ditempel di kertas HVS kosong.
 */
const GambarLampiran: React.FC<GambarLampiranProps> = ({ bukti, googleToken, onStatus }) => {
  const [status, setStatus] = useState<StatusFoto>("memuat");
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    let batal = false;
    onStatus(bukti.id, true);
    muatPratinjauBukti(bukti, googleToken)
      .then((hasil) => {
        if (batal) return;
        if (hasil.gagal || !hasil.url) setStatus("gagal");
        else if (hasil.isPdf) setStatus("pdf");
        else {
          setUrl(hasil.url);
          setStatus("ok");
        }
        if (hasil.gagal || !hasil.url || hasil.isPdf) onStatus(bukti.id, false);
      })
      .catch(() => {
        if (batal) return;
        setStatus("gagal");
        onStatus(bukti.id, false);
      });
    return () => {
      batal = true;
      onStatus(bukti.id, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bukti.id, bukti.dataUrl, bukti.driveId, bukti.driveLink, googleToken]);

  if (status === "memuat") return <div className="dsc-lampiran-status">Memuat bukti…</div>;
  if (status === "ok" && url) {
    return (
      <div className="dsc-foto-kotak">
        <img
          className="dsc-foto"
          src={url}
          alt={bukti.nama || "Bukti transaksi"}
          onLoad={() => onStatus(bukti.id, false)}
          onError={() => {
            setStatus("gagal");
            onStatus(bukti.id, false);
          }}
        />
      </div>
    );
  }
  if (status === "pdf") {
    return (
      <div className="dsc-lampiran-status">
        Lampiran berupa PDF ({bukti.nama}).{" "}
        {bukti.driveLink && (
          <a href={bukti.driveLink} target="_blank" rel="noopener noreferrer">
            Buka di Google Drive
          </a>
        )}
      </div>
    );
  }
  return <KotakPratinjauBelumTersedia linkDrive={bukti.driveLink} />;
};

/* ---------- lembar daftar uang harian berformat timesheet ---------- */

/**
 * Daftar uang harian dengan format yang sama dengan file timesheet: Detail Keuangan / Uang Harian (Per Diem) Kegiatan Lapangan,
 * Proyek, Judul Kegiatan, Nama, Bulan, tabel No | Tanggal | Keterangan | Lokasi | Jumlah (Rp.), Total, dan kolom tanda tangan.
 * Satu-satunya lembar lanskap (A4 mendatar) supaya kolom Keterangan dan Lokasi tidak berhimpit; lembar lain tetap potret.
 * Tabelnya tabel sungguhan: kepala tabel berulang di setiap halaman, sedangkan Total dan tanda tangan (tfoot) hanya di akhir.
 * Di layar sempit lembar tidak dikecilkan sampai tak terbaca: ia bisa digeser ke samping di dalam bingkainya.
 */
const LembarPerdiemTimesheet: React.FC<{ daftar: DaftarPerdiemDokumen; kunci: string }> = ({ daftar, kunci }) => (
  <>
    <p className="dsc-lanskap-petunjuk no-print">
      Lembar uang harian dicetak lanskap (A4 mendatar)<span className="teks-hp">; geser ke samping untuk melihat seluruhnya</span>.
    </p>
    <div className="dsc-lanskap-gulir dsc-bagian-timesheet">
      <div className="dsc-lanskap-bingkai">
        <article className="dsc-kertas dsc-timesheet dsc-lanskap" data-kelompok={kunci} data-testid="lembar-timesheet">
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
              <col />
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

/* ---------- lampiran bukti: foto digital + kotak tempel nota asli dalam satu lembar ---------- */

interface LampiranBuktiProps {
  kotak: KotakTempel[];
  googleToken?: string;
  onStatus: (id: string, memuat: boolean) => void;
}

/**
 * Lampiran bukti per pengeluaran di kertas A4 potret (area cetak bersih 190 × 277 mm). Foto bukti digital dan kotak kosong
 * tempat nota/struk/tiket asli ditempel berada di kartu yang sama dan tidak terbelah antarhalaman:
 *   Tipe A  foto di kiri, area tempel di kanan (dua kartu per halaman);
 *   Tipe B/C foto di atas, area tempel di bawah (satu kartu per halaman).
 * Pengeluaran tanpa foto tetap mendapat kotak tempel ringkas (Tipe A berpasangan, B dan C satu baris penuh).
 * Ukuran dalam milimeter lewat --mm: di layar 1 mm = lebar kertas / 210 (pratinjau mengecil bersama kolom), saat cetak 1 mm sebenarnya.
 */
const LampiranBukti: React.FC<LampiranBuktiProps> = ({ kotak, googleToken, onStatus }) => (
  <section className="dsc-tempel dsc-bagian-potret" aria-label="Lampiran bukti" data-testid="lembar-tempel">
    <p className="dsc-tempel__ket no-print">
      <strong>Lampiran Bukti</strong> · {kotak.length} lembar, sekitar {perkirakanHalamanTempel(kotak)} halaman A4 potret. Foto bukti digital
      dan area tempel nota asli berada di lembar yang sama
      {ringkasKotak(kotak) ? ` (kotak: ${ringkasKotak(kotak)})` : ""}. Tempel bukti asli tepat di dalam kotak bergaris putus-putus.
    </p>
    <div className="dsc-tempel__kertas">
      <div className="dsc-tempel__kisi">
        {kotak.map((k) => (
          <div
            key={k.id}
            className={`dsc-kotak dsc-kotak--${k.ukuran.kode} dsc-kotak--${k.varian}`}
            data-ukuran={k.ukuran.kode}
            data-varian={k.varian}
            data-nomor={k.nomor}
          >
            <div className="dsc-kotak__kepala">{k.kepala}</div>
            <div className="dsc-kotak__isi">
              {k.bukti.length > 0 && (
                <div className="dsc-kotak__foto" data-testid="foto-bukti">
                  <span className="dsc-kotak__label">Foto bukti digital{k.bukti.length > 1 ? ` (${k.bukti.length})` : ""}</span>
                  <div className={`dsc-kotak__foto-isi${k.bukti.length > 1 ? " dsc-kotak__foto-isi--banyak" : ""}`}>
                    {k.bukti.map((b) => (
                      <GambarLampiran key={b.id} bukti={b} googleToken={googleToken} onStatus={onStatus} />
                    ))}
                  </div>
                </div>
              )}
              {k.varian !== "foto" && (
                <div className="dsc-kotak__area">
                  <span>Area Tempel Bukti / Nota Asli ({k.ukuran.nama})</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ---------- komponen utama ---------- */

export const DokumenSiapCetak: React.FC<DokumenSiapCetakProps> = ({
  transaksi,
  judulLaporan,
  periodeTeks,
  adalahKegiatan,
  kegiatan,
  profilPelapor,
  googleToken,
  penyelesaian,
  penyelesaianSementara,
  namaKegiatanPenyelesaian,
  rentangKegiatanPenyelesaian,
}) => {
  const kelompok = useMemo(
    () => susunKelompokDokumen(transaksi, adalahKegiatan, kegiatan?.urutanTransaksi),
    [transaksi, adalahKegiatan, kegiatan?.urutanTransaksi]
  );

  // Nomor urut pengeluaran 1..N di seluruh dokumen; pemasukan P1..Pn.
  const nomorMap = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    let p = 0;
    for (const k of kelompok) {
      for (const t of k.item) m.set(t.id, k.jenis === "pengeluaran" ? String(++n) : `P${++p}`);
    }
    return m;
  }, [kelompok]);

  // Daftar perdiem memakai format file timesheet (lihat LembarPerdiemTimesheet), bukan tabel uraian biasa.
  const kunciPerdiem = `kategori:${KATEGORI_PERDIEM}`;
  const daftarPerdiem = useMemo(
    () =>
      adalahKegiatan && kegiatan
        ? susunDaftarPerdiem(kelompok.find((k) => k.kunci === kunciPerdiem)?.item ?? [], kegiatan, profilPelapor)
        : null,
    [adalahKegiatan, kegiatan, kelompok, kunciPerdiem, profilPelapor]
  );

  // Lampiran bukti: foto digital dan kotak tempel nota fisik asli dalam satu lembar; urutannya sama dengan nomor di laporan.
  const [sertakanTempel, setSertakanTempel] = useState(true);
  const semuaItem = useMemo(() => kelompok.flatMap((k) => k.item), [kelompok]);
  const lampiran = useMemo(
    () => susunKotakTempel(semuaItem, (id) => nomorMap.get(id), { sertakanTempel: sertakanTempel && adalahKegiatan }),
    [semuaItem, nomorMap, sertakanTempel, adalahKegiatan]
  );
  const kotakTempelAda = useMemo(
    () => adalahKegiatan && susunKotakTempel(semuaItem, (id) => nomorMap.get(id), { sertakanTempel: true }).some((k) => k.varian !== "foto"),
    [adalahKegiatan, semuaItem, nomorMap]
  );
  const kotakTempel = lampiran.filter((k) => k.varian !== "foto");

  const [sedangMemuat, setSedangMemuat] = useState<Set<string>>(new Set());
  const ubahStatusMuat = React.useCallback((id: string, memuat: boolean) => {
    setSedangMemuat((prev) => {
      if (memuat === prev.has(id)) return prev;
      const baru = new Set(prev);
      if (memuat) baru.add(id);
      else baru.delete(id);
      return baru;
    });
  }, []);

  const totalMasuk = kelompok.filter((k) => k.jenis === "pemasukan").reduce((s, k) => s + k.total, 0);
  const totalKeluar = kelompok.filter((k) => k.jenis === "pengeluaran").reduce((s, k) => s + k.total, 0);
  const jumlahLampiran = transaksi.reduce((s, t) => s + (t.bukti?.length || 0), 0);
  const tanpaBukti = transaksi.filter((t) => t.jenis === "pengeluaran" && t.kategori !== KATEGORI_PINDAH_DANA && !(t.bukti && t.bukti.length > 0)).length;

  const tglCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const cetak = (mode: ModeCetak) => cetakDokumen(mode);
  const judulTombol = (teks: string) => (sedangMemuat.size > 0 ? "Tunggu sampai semua foto bukti termuat" : teks);

  return (
    <section className="dokumen-siap-cetak" aria-label="Pratinjau dokumen siap cetak">
      <div className="dsc-toolbar no-print">
        <div>
          <h3 className="dsc-toolbar__judul">Pratinjau Dokumen Siap Cetak</h3>
          <p className="dsc-toolbar__ket">
            {kelompok.length} bagian per kategori · {jumlahLampiran} lampiran bukti
            {tanpaBukti > 0 ? ` · ${tanpaBukti} pengeluaran belum punya bukti` : ""}. Foto bukti tampil dengan rasio
            dan ukuran aslinya di atas kertas kosong.
          </p>
        </div>
        <div className="dsc-cetak-aksi" role="group" aria-label="Pilihan cetak">
          {daftarPerdiem ? (
            <>
              <button type="button" className="btn-secondary" disabled={sedangMemuat.size > 0} onClick={() => cetak("semua")} title={judulTombol("Cetak semua dokumen: timesheet lanskap, dokumen lain potret")}>
                {sedangMemuat.size > 0 ? `Memuat ${sedangMemuat.size} bukti…` : "🖨️ Cetak Semua Dokumen"}
              </button>
              <button type="button" className="btn-secondary" disabled={sedangMemuat.size > 0} onClick={() => cetak("timesheet")} title={judulTombol("Hanya timesheet, kertas A4 lanskap")}>
                🖨️ Cetak Khusus Timesheet (Lanskap)
              </button>
              <button type="button" className="btn-secondary" disabled={sedangMemuat.size > 0} onClick={() => cetak("klaim")} title={judulTombol("Laporan, rekapitulasi klaim, dan lembar tempel bukti, kertas A4 potret")}>
                🖨️ Cetak Dokumen Klaim &amp; Nota (Potret)
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" disabled={sedangMemuat.size > 0} onClick={() => cetak("klaim")} title={judulTombol("Cetak atau simpan sebagai PDF")}>
              {sedangMemuat.size > 0 ? `Memuat ${sedangMemuat.size} bukti…` : "🖨️ Cetak Dokumen"}
            </button>
          )}
        </div>
        {daftarPerdiem && (
          <p className="dsc-cetak-petunjuk">
            Di HP (Android): setelah tombol ditekan, buka pilihan lain di jendela cetak (panah ▾) dan atur <strong>Orientasi</strong>{" "}
            sesuai tombol: <em>Lanskap</em> untuk timesheet, <em>Potret</em> untuk dokumen klaim dan nota.
          </p>
        )}
        {kotakTempelAda && (
          <label className="dsc-tempel-pilihan">
            <input type="checkbox" checked={sertakanTempel} onChange={(e) => setSertakanTempel(e.target.checked)} />
            Sertakan kotak tempel bukti fisik asli di lembar yang sama dengan foto bukti ({kotakTempel.length} kotak, lampiran sekitar{" "}
            {perkirakanHalamanTempel(lampiran)} halaman)
          </label>
        )}
      </div>

      {kelompok.length === 0 ? (
        <p className="dsc-kosong">Tidak ada transaksi pada parameter yang dipilih.</p>
      ) : (
        <div className="dsc-daftar-lembar">
          {kelompok.map((k) => (
            <React.Fragment key={k.kunci}>
              {/* Lembar rincian kategori */}
              {k.kunci === kunciPerdiem && daftarPerdiem ? (
                <LembarPerdiemTimesheet daftar={daftarPerdiem} kunci={k.kunci} />
              ) : (
              <article className="dsc-kertas dsc-bagian-potret" data-kelompok={k.kunci}>
                <header className="dsc-kop">
                  <div className="dsc-kop__judul">{judulLaporan}</div>
                  <div className="dsc-kop__sub">
                    {kegiatan?.nama ? `${kegiatan.nama} · ` : ""}
                    {periodeTeks}
                  </div>
                </header>
                <h4 className="dsc-judul-kelompok">
                  {k.huruf}. {k.judul}
                </h4>
                <table className="dsc-tabel">
                  <colgroup>
                    <col className="dsc-tabel__k-no" />
                    <col className="dsc-tabel__k-tgl" />
                    <col />
                    <col className="dsc-tabel__k-jml" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      <th>Uraian</th>
                      <th className="dsc-jumlah">Jumlah (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {k.item.map((t) => {
                      const rincian = keteranganRincian(t);
                      const penerima = barisPenerimaManfaat(t);
                      const nLampiran = t.bukti?.length || 0;
                      return (
                        <tr key={t.id}>
                          <td className="dsc-no">{nomorMap.get(t.id)}</td>
                          <td className="dsc-tgl">{tanggalSingkat(t.tanggal)}</td>
                          <td className="dsc-uraian">
                            <div className="dsc-uraian__utama">{t.deskripsi}</div>
                            {penerima && <div className="dsc-uraian__penerima">{penerima}</div>}
                            {rincian.map((r, i) => (
                              <div className="dsc-uraian__detail" key={i}>
                                {r}
                              </div>
                            ))}
                            <div className="dsc-uraian__detail">
                              {t.kaitan ? `${t.kaitan} · ` : ""}
                              {t.metode || "Tunai"} ·{" "}
                              {nLampiran > 0
                                ? `Lampiran ${nLampiran}`
                                : k.jenis === "pengeluaran"
                                  ? "Tanpa bukti"
                                  : "—"}
                            </div>
                          </td>
                          <td className="dsc-jumlah">{formatAngka(t.jumlah)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="dsc-tabel__total">
                      <td />
                      <td />
                      <td className="dsc-uraian__utama">Jumlah {k.judul}</td>
                      <td className="dsc-jumlah">{formatAngka(k.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </article>
              )}

            </React.Fragment>
          ))}

          {/* Lembar penutup: rekapitulasi klaim (total, penyelesaian dana, dan tanda tangan) */}
          <article className="dsc-kertas dsc-penutup dsc-bagian-potret">
            <header className="dsc-kop">
              <div className="dsc-kop__judul">{judulLaporan}</div>
              <div className="dsc-kop__sub">
                {kegiatan?.nama ? `${kegiatan.nama} · ` : ""}
                {periodeTeks}
              </div>
            </header>
            <h4 className="dsc-judul-kelompok">{adalahKegiatan ? "Rekapitulasi Klaim" : "Rekapitulasi"}</h4>
            <div className="dsc-daftar">
              <div className="dsc-baris dsc-baris--ringkas">
                <span className="dsc-uraian__utama">Total penerimaan</span>
                <span className="dsc-jumlah">{formatRupiah(totalMasuk)}</span>
              </div>
              <div className="dsc-baris dsc-baris--ringkas">
                <span className="dsc-uraian__utama">Total pengeluaran</span>
                <span className="dsc-jumlah">{formatRupiah(totalKeluar)}</span>
              </div>
            </div>

            {adalahKegiatan && penyelesaian && (
              <div className="dsc-penyelesaian">
                <KartuPenyelesaianDana
                  ringkasan={penyelesaian}
                  namaKegiatan={namaKegiatanPenyelesaian ?? kegiatan?.nama}
                  rentangKegiatan={rentangKegiatanPenyelesaian}
                  sementara={penyelesaianSementara}
                  ringkas
                />
              </div>
            )}

            <div className="dsc-tanda-tangan">
              <p>
                {kegiatan?.lokasi || "Lokasi"}, {tglCetak}
              </p>
              <p className="dsc-tanda-tangan__peran">Pelapor / Pengelola Dana,</p>
              <div className="dsc-tanda-tangan__ruang" />
              <p className="dsc-tanda-tangan__nama">{profilPelapor.nama}</p>
              <p className="dsc-tanda-tangan__jabatan">
                {profilPelapor.jabatan} · Proyek {profilPelapor.proyek}
              </p>
            </div>
          </article>

          {/* Lampiran bukti di akhir dokumen klaim (potret): foto digital + kotak tempel nota asli dalam satu lembar */}
          {lampiran.length > 0 && <LampiranBukti kotak={lampiran} googleToken={googleToken} onStatus={ubahStatusMuat} />}
        </div>
      )}
    </section>
  );
};
