import React, { CSSProperties, useEffect, useMemo, useState } from "react";
import { BuktiItem, DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import { formatAngka, formatRupiah, KELOMPOK_DANA_KEGIATAN, labelKategori } from "../lib/constants";
import { KotakPratinjauBelumTersedia, muatPratinjauBukti } from "../lib/driveBuktiLoader";
import { RingkasanPenyelesaian } from "../lib/penyelesaianDana";
import { KartuPenyelesaianDana } from "./KartuPenyelesaianDana";
import { DaftarPerdiemDokumen, susunDaftarPerdiem } from "../lib/timesheet";
import { KATEGORI_PERDIEM } from "../lib/penyelesaianDana";
import { KotakTempel, perkirakanHalamanTempel, ringkasKotak, susunKotakTempel } from "../lib/lembarTempel";
import { barisRincianLengkap, uraianTampil } from "../lib/kelengkapanKategori";
import { cetakDokumen } from "../lib/cetak";

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
  /** Unduh dokumen Word dari susunan yang sama (hanya saat satu kegiatan dipilih). */
  aksiWord?: AksiWord;
  /** Saldo awal dan akhir periode untuk laporan selain Dana Kegiatan; dicantumkan di lembar rekapitulasi. */
  saldo?: { awal: number; akhir: number };
}

export interface AksiWord {
  onUnduh: () => void;
  sedang: boolean;
  pesan: { teks: string; tipe: "sukses" | "error" | "info" } | null;
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
 * Proyek, Judul Kegiatan, Nama, Bulan, tabel No | Tanggal | Keterangan | Lokasi | Jumlah (Rp.), Total, dan kolom tanda tangan di bawah tabel.
 * Satu-satunya lembar lanskap (A4 mendatar) dan selalu yang pertama; lembar lain tetap potret.
 * Lembar mengisi A4 mendatar secara proporsional: lebar kolom berupa persen lebar kertas, dan tabelnya meregang mengisi sisa
 * tinggi halaman (baris menjadi lebih lapang bila hanya sedikit hari). Bila baris banyak, tabel mengalir ke halaman berikutnya
 * dan kepala tabel berulang; Total dan tanda tangan (di tfoot) hanya di akhir. Di layar sempit lembar bisa digeser ke samping.
 */
const LembarPerdiemTimesheet: React.FC<{ daftar: DaftarPerdiemDokumen; kunci: string }> = ({ daftar, kunci }) => (
  <>
    <p className="dsc-lanskap-petunjuk no-print">
      Lembar uang harian dicetak lanskap (A4 mendatar), halaman lainnya potret<span className="teks-hp">; geser ke samping untuk melihat seluruhnya</span>.
    </p>
    <div className="dsc-lanskap-gulir dsc-bagian-timesheet">
      <div className="dsc-lanskap-bingkai">
        <article
          className="dsc-kertas dsc-timesheet dsc-lanskap"
          data-kelompok={kunci}
          data-testid="lembar-timesheet"
          style={{ "--ts-baris": Math.max(daftar.baris.length, 1) } as CSSProperties}
        >
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

/* ---------- lampiran bukti: foto digital + kotak tempel nota asli dalam satu lembar ---------- */

interface LampiranBuktiProps {
  judul: string;
  kotak: KotakTempel[];
  googleToken?: string;
  onStatus: (id: string, memuat: boolean) => void;
}

/**
 * Lampiran bukti satu kategori pengeluaran di kertas A4 potret (area cetak bersih 190 × 277 mm), langsung sesudah tabel kategorinya.
 * Foto bukti digital dan kotak kosong tempat nota/struk/tiket asli ditempel berada di kartu yang sama dan tidak terbelah antarhalaman:
 *   Tipe A  foto di kiri, area tempel di kanan (dua kartu per halaman);
 *   Tipe B/C foto di atas, area tempel di bawah (satu kartu per halaman).
 * Pengeluaran tanpa foto tetap mendapat kotak tempel ringkas (Tipe A berpasangan, B dan C satu baris penuh).
 * Kepala tiap kartu memuat uraian, "Diklaim untuk: ..." dan kelengkapan kategori (rute, kendaraan, penyedia, dan seterusnya).
 * Ukuran dalam milimeter lewat --mm: di layar 1 mm = lebar kertas / 210 (pratinjau mengecil bersama kolom), saat cetak 1 mm sebenarnya.
 */
const LampiranBukti: React.FC<LampiranBuktiProps> = ({ judul, kotak, googleToken, onStatus }) => (
  <section className="dsc-tempel dsc-bagian-potret" aria-label={`Lampiran bukti ${judul}`} data-testid="lembar-tempel">
    <p className="dsc-tempel__ket no-print">
      <strong>Lampiran Bukti · {judul}</strong> · {kotak.length} lembar, sekitar {perkirakanHalamanTempel(kotak)} halaman A4 potret. Foto bukti
      digital dan area tempel nota asli berada di lembar yang sama
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
            <div className="dsc-kotak__kepala">
              <div className="dsc-kotak__kepala-utama">{k.kepala}</div>
              {k.rincian.map((r, i) => (
                <div className="dsc-kotak__kepala-rinci" key={i}>
                  {r}
                </div>
              ))}
            </div>
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

const WARNA_PESAN: Record<"sukses" | "error" | "info", { latar: string; teks: string; garis: string; ikon: string }> = {
  sukses: { latar: "rgba(34, 197, 94, 0.15)", teks: "#16a34a", garis: "#86efac", ikon: "✅" },
  error: { latar: "rgba(239, 68, 68, 0.15)", teks: "#dc2626", garis: "#fca5a5", ikon: "⚠️" },
  info: { latar: "rgba(59, 130, 246, 0.15)", teks: "#2563eb", garis: "#bfdbfe", ikon: "ℹ️" },
};

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
  aksiWord,
  saldo,
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

  // Lampiran bukti per kelompok: foto digital dan kotak tempel nota fisik asli dalam satu lembar, urutan nomornya sama dengan laporan.
  const [sertakanTempel, setSertakanTempel] = useState(true);
  const lampiranPerKelompok = useMemo(() => {
    const peta = new Map<string, KotakTempel[]>();
    for (const k of kelompok) {
      peta.set(
        k.kunci,
        susunKotakTempel(k.item, (id) => nomorMap.get(id), { sertakanTempel: sertakanTempel && adalahKegiatan, namaPelapor: profilPelapor.nama })
      );
    }
    return peta;
  }, [kelompok, nomorMap, sertakanTempel, adalahKegiatan, profilPelapor.nama]);
  const lampiran = useMemo(() => kelompok.flatMap((k) => lampiranPerKelompok.get(k.kunci) ?? []), [kelompok, lampiranPerKelompok]);
  const kotakTempelAda = useMemo(
    () =>
      adalahKegiatan &&
      kelompok.some((k) =>
        susunKotakTempel(k.item, (id) => nomorMap.get(id), { sertakanTempel: true, namaPelapor: profilPelapor.nama }).some((x) => x.varian !== "foto")
      ),
    [adalahKegiatan, kelompok, nomorMap, profilPelapor.nama]
  );
  const kotakTempel = lampiran.filter((k) => k.varian !== "foto");
  // Tiap kategori memulai lampirannya di halaman baru, jadi perkiraan halaman dijumlahkan per kategori.
  const perkiraanHalaman = useMemo(
    () => kelompok.reduce((n, k) => n + perkirakanHalamanTempel(lampiranPerKelompok.get(k.kunci) ?? []), 0),
    [kelompok, lampiranPerKelompok]
  );

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
  const judulTombol = (teks: string) => (sedangMemuat.size > 0 ? "Tunggu sampai semua foto bukti termuat" : teks);
  const namaPelapor = profilPelapor.nama;

  // Timesheet (lanskap) paling depan; sisanya potret berpasangan: tabel kategori lalu lampiran buktinya.
  const kelompokPotret = kelompok.filter((k) => !(k.kunci === kunciPerdiem && daftarPerdiem));
  const kelompokTimesheet = daftarPerdiem ? kelompok.find((k) => k.kunci === kunciPerdiem) : undefined;
  const kopDiTabel = kelompokPotret.length > 0;
  const tampilLampiran = (k: Kelompok) => {
    const kotak = lampiranPerKelompok.get(k.kunci) ?? [];
    return kotak.length > 0 ? <LampiranBukti judul={k.judul} kotak={kotak} googleToken={googleToken} onStatus={ubahStatusMuat} /> : null;
  };
  const kop = (
    <header className="dsc-kop">
      <div className="dsc-kop__judul">{judulLaporan}</div>
      <div className="dsc-kop__sub">
        {kegiatan?.nama ? `${kegiatan.nama} · ` : ""}
        {periodeTeks}
      </div>
    </header>
  );

  return (
    <section className="dokumen-siap-cetak" aria-label="Pratinjau dokumen siap cetak">
      <div className="dsc-toolbar no-print">
        <div>
          <h3 className="dsc-toolbar__judul">Dokumen Laporan Siap Cetak</h3>
          <p className="dsc-toolbar__ket">
            {kelompok.length} bagian per kategori · {jumlahLampiran} lampiran bukti
            {tanpaBukti > 0 ? ` · ${tanpaBukti} pengeluaran belum punya bukti` : ""}. Urutan: {daftarPerdiem ? "timesheet uang harian (lanskap), lalu " : ""}
            tiap kategori diikuti foto nota dan kotak tempel buktinya (potret), ditutup rekapitulasi.
          </p>
        </div>
        <div className="dsc-cetak-aksi" role="group" aria-label="Cetak dan unduh dokumen">
          <button
            type="button"
            className="btn-secondary"
            disabled={sedangMemuat.size > 0}
            onClick={() => cetakDokumen()}
            title={judulTombol("Cetak atau simpan sebagai PDF: timesheet lanskap, halaman lain potret")}
          >
            {sedangMemuat.size > 0 ? `Memuat ${sedangMemuat.size} bukti…` : "🖨️ Cetak / Simpan PDF"}
          </button>
          {aksiWord && (
            <button
              type="button"
              className="btn-secondary"
              onClick={aksiWord.onUnduh}
              disabled={aksiWord.sedang}
              title="Dokumen Word dengan susunan yang sama: timesheet lanskap, halaman lain potret (A4, margin 2 cm, Arial 11)"
            >
              {aksiWord.sedang ? "⏳ Menyusun Word..." : "📄 Unduh Laporan Word (.docx)"}
            </button>
          )}
        </div>
        {aksiWord?.pesan && (
          <div
            role="status"
            className="dsc-pesan-word"
            style={{
              background: WARNA_PESAN[aksiWord.pesan.tipe].latar,
              color: WARNA_PESAN[aksiWord.pesan.tipe].teks,
              border: `1px solid ${WARNA_PESAN[aksiWord.pesan.tipe].garis}`,
            }}
          >
            <span>{WARNA_PESAN[aksiWord.pesan.tipe].ikon}</span>
            <span style={{ fontWeight: 600 }}>{aksiWord.pesan.teks}</span>
          </div>
        )}
        {daftarPerdiem && (
          <p className="dsc-cetak-petunjuk">
            Orientasi halaman berganti otomatis dalam satu dokumen (timesheet lanskap, lainnya potret). Bila peramban ponsel Anda
            tidak mengganti orientasi, atur <strong>Orientasi</strong> di jendela cetak sesuai halaman, atau unduh versi Word yang
            orientasinya sudah benar per bagian.
          </p>
        )}
        {kotakTempelAda && (
          <label className="dsc-tempel-pilihan">
            <input type="checkbox" checked={sertakanTempel} onChange={(e) => setSertakanTempel(e.target.checked)} />
            Sertakan kotak tempel bukti fisik asli di lembar yang sama dengan foto bukti ({kotakTempel.length} kotak, lampiran sekitar{" "}
            {perkiraanHalaman} halaman)
          </label>
        )}
      </div>

      {kelompok.length === 0 ? (
        <p className="dsc-kosong">Tidak ada transaksi pada parameter yang dipilih.</p>
      ) : (
        <div className="dsc-daftar-lembar">
          {/* 1. Timesheet uang harian (lanskap), dengan foto buktinya bila ada */}
          {kelompokTimesheet && daftarPerdiem && (
            <>
              <LembarPerdiemTimesheet daftar={daftarPerdiem} kunci={kelompokTimesheet.kunci} />
              {tampilLampiran(kelompokTimesheet)}
            </>
          )}

          {/* 2. Tiap kategori (potret): tabel, lalu foto nota dan kotak tempelnya */}
          {kelompokPotret.map((k, indeks) => (
            <React.Fragment key={k.kunci}>
              <article className="dsc-kertas dsc-bagian-potret" data-kelompok={k.kunci}>
                {indeks === 0 && kop}
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
                      const rincian = barisRincianLengkap(t, namaPelapor);
                      const nLampiran = t.bukti?.length || 0;
                      return (
                        <tr key={t.id}>
                          <td className="dsc-no">{nomorMap.get(t.id)}</td>
                          <td className="dsc-tgl">{tanggalSingkat(t.tanggal)}</td>
                          <td className="dsc-uraian">
                            <div className="dsc-uraian__utama">{uraianTampil(t, kegiatan?.nama)}</div>
                            {rincian.map((r, i) => (
                              <div className={`dsc-uraian__detail${r.startsWith("Diklaim untuk:") ? " dsc-uraian__penerima" : ""}`} key={i}>
                                {r}
                              </div>
                            ))}
                            <div className="dsc-uraian__detail dsc-uraian__metode">
                              Metode: {t.metode || "Tunai"} ·{" "}
                              {nLampiran > 0 ? `Lampiran ${nLampiran}` : k.jenis === "pengeluaran" ? "Tanpa bukti" : "—"}
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
              {tampilLampiran(k)}
            </React.Fragment>
          ))}

          {/* 3. Lembar penutup: rekapitulasi klaim (total, penyelesaian dana, dan tanda tangan) */}
          <article className="dsc-kertas dsc-penutup dsc-bagian-potret">
            {!kopDiTabel && kop}
            <h4 className="dsc-judul-kelompok">{adalahKegiatan ? "Rekapitulasi Klaim" : "Rekapitulasi"}</h4>
            <div className="dsc-daftar">
              {!adalahKegiatan && saldo && (
                <div className="dsc-baris dsc-baris--ringkas">
                  <span className="dsc-uraian__utama">Saldo awal (sebelum periode)</span>
                  <span className="dsc-jumlah">{formatRupiah(saldo.awal)}</span>
                </div>
              )}
              <div className="dsc-baris dsc-baris--ringkas">
                <span className="dsc-uraian__utama">Total penerimaan</span>
                <span className="dsc-jumlah">{formatRupiah(totalMasuk)}</span>
              </div>
              <div className="dsc-baris dsc-baris--ringkas">
                <span className="dsc-uraian__utama">Total pengeluaran</span>
                <span className="dsc-jumlah">{formatRupiah(totalKeluar)}</span>
              </div>
              {!adalahKegiatan && saldo && (
                <div className="dsc-baris dsc-baris--ringkas">
                  <span className="dsc-uraian__utama">Saldo akhir periode</span>
                  <span className="dsc-jumlah">{formatRupiah(saldo.akhir)}</span>
                </div>
              )}
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
        </div>
      )}
    </section>
  );
};
