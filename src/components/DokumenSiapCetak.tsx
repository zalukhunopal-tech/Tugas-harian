import React, { useEffect, useMemo, useState } from "react";
import { BuktiItem, DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import { formatAngka, formatRupiah, KELOMPOK_DANA_KEGIATAN } from "../lib/constants";
import { KotakPratinjauBelumTersedia, muatPratinjauBukti } from "../lib/driveBuktiLoader";
import { RingkasanPenyelesaian } from "../lib/penyelesaianDana";
import { KartuPenyelesaianDana } from "./KartuPenyelesaianDana";

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
      judul: k.kategori,
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

/** Keterangan singkat dari rincian khusus Dana Kegiatan, satu baris per hal. */
function keteranganRincian(t: Transaksi): string[] {
  const d = t.detailKegiatan;
  if (!d) return [];
  const baris: string[] = [];
  if (d.perdiem?.jumlahHari && d.perdiem?.tarifPerHari) {
    baris.push(
      `Perdiem ${d.perdiem.jumlahHari} hari × ${formatRupiah(d.perdiem.tarifPerHari)}${d.perdiem.keterangan ? ` (${d.perdiem.keterangan})` : ""}`
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
  if (d.konsumsi?.jumlahPeserta) baris.push(`${d.konsumsi.jumlahPeserta} peserta`);
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

  return (
    <section className="dokumen-siap-cetak" aria-label="Preview dokumen siap cetak">
      <div className="dsc-toolbar no-print">
        <div>
          <h3 className="dsc-toolbar__judul">Preview Dokumen Siap Cetak</h3>
          <p className="dsc-toolbar__ket">
            {kelompok.length} bagian per kategori · {jumlahLampiran} lampiran bukti
            {tanpaBukti > 0 ? ` · ${tanpaBukti} pengeluaran belum punya bukti` : ""}. Foto bukti tampil dengan rasio
            dan ukuran aslinya di atas kertas kosong.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => window.print()}
          disabled={sedangMemuat.size > 0}
          title={sedangMemuat.size > 0 ? "Tunggu sampai semua foto bukti termuat" : "Cetak atau simpan sebagai PDF"}
        >
          {sedangMemuat.size > 0 ? `Memuat ${sedangMemuat.size} bukti…` : "🖨️ Cetak dokumen"}
        </button>
      </div>

      {kelompok.length === 0 ? (
        <p className="dsc-kosong">Tidak ada transaksi pada parameter yang dipilih.</p>
      ) : (
        <div className="dsc-daftar-lembar">
          {kelompok.map((k) => (
            <React.Fragment key={k.kunci}>
              {/* Lembar rincian kategori */}
              <article className="dsc-kertas" data-kelompok={k.kunci}>
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
                <div className="dsc-daftar">
                  <div className="dsc-baris dsc-baris--kepala" aria-hidden="true">
                    <span>No</span>
                    <span>Tanggal</span>
                    <span>Uraian</span>
                    <span className="dsc-jumlah">Jumlah (Rp)</span>
                  </div>
                  {k.item.map((t) => {
                    const rincian = keteranganRincian(t);
                    const nLampiran = t.bukti?.length || 0;
                    return (
                      <div className="dsc-baris" key={t.id}>
                        <span className="dsc-no">{nomorMap.get(t.id)}</span>
                        <span className="dsc-tgl">{tanggalSingkat(t.tanggal)}</span>
                        <div className="dsc-uraian">
                          <div className="dsc-uraian__utama">{t.deskripsi}</div>
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
                        </div>
                        <span className="dsc-jumlah">{formatAngka(t.jumlah)}</span>
                      </div>
                    );
                  })}
                  <div className="dsc-baris dsc-baris--total">
                    <span />
                    <span />
                    <span className="dsc-uraian__utama">Jumlah {k.judul}</span>
                    <span className="dsc-jumlah">{formatAngka(k.total)}</span>
                  </div>
                </div>
              </article>

              {/* Lembar lampiran: satu kertas kosong per foto bukti, seperti struk yang ditempel di kertas HVS */}
              {k.item.flatMap((t) =>
                (t.bukti || []).map((b, i, semua) => (
                  <article className="dsc-kertas dsc-lampiran" key={`lampiran-${t.id}-${b.id}`} data-lampiran={t.id}>
                    <div className="dsc-lampiran__kop">
                      <strong>Lampiran No. {nomorMap.get(t.id)}</strong>
                      {semua.length > 1 ? ` (bukti ${i + 1} dari ${semua.length})` : ""} · {tanggalSingkat(t.tanggal)} ·{" "}
                      {t.deskripsi} · {formatRupiah(t.jumlah)}
                    </div>
                    <div className="dsc-lampiran__isi">
                      <GambarLampiran bukti={b} googleToken={googleToken} onStatus={ubahStatusMuat} />
                    </div>
                  </article>
                ))
              )}
            </React.Fragment>
          ))}

          {/* Lembar penutup: total, penyelesaian dana, dan tanda tangan */}
          <article className="dsc-kertas dsc-penutup">
            <header className="dsc-kop">
              <div className="dsc-kop__judul">{judulLaporan}</div>
              <div className="dsc-kop__sub">
                {kegiatan?.nama ? `${kegiatan.nama} · ` : ""}
                {periodeTeks}
              </div>
            </header>
            <h4 className="dsc-judul-kelompok">Ringkasan</h4>
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
                  namaKegiatan={kegiatan?.nama}
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
