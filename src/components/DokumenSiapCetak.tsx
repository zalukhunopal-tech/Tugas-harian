import React, { useMemo, useState } from "react";
import { DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import { formatAngka, formatRupiah, KELOMPOK_DANA_KEGIATAN, labelKategori } from "../lib/constants";
import { KATEGORI_PERDIEM, RingkasanPenyelesaian } from "../lib/penyelesaianDana";
import { KartuPenyelesaianDana } from "./KartuPenyelesaianDana";
import { KotakTempel, perkirakanHalamanTempel, ringkasKotak, susunKotakTempel } from "../lib/lembarTempel";
import { barisRincianLengkap, uraianTampil } from "../lib/kelengkapanKategori";
import { susunLaporanKegiatan, tanggalSingkat } from "../lib/susunanLaporan";
import { cetakDokumen } from "../lib/cetak";
import { GambarLampiran } from "./GambarLampiran";
import { DokumenLaporanKegiatan } from "./DokumenLaporanKegiatan";

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
  /**
   * Semua transaksi dan semua kegiatan. Bila satu kegiatan dipilih, dokumen disusun dari sini dengan aturan yang sama dengan
   * dokumen Word (lib/susunanLaporan.ts), tidak dibatasi rentang tanggal laporan: pengeluaran pra-kegiatan dan hari kepulangan
   * ikut seperti di Word.
   */
  semuaTransaksi?: Transaksi[];
  daftarKegiatan?: DataKegiatan[];
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
  semuaTransaksi,
  daftarKegiatan,
}) => {
  // Satu kegiatan dipilih: dokumen sama persis dengan dokumen Word (susunan, isi, foto, ringkasan penyelesaian).
  const susunan = useMemo(
    () =>
      adalahKegiatan && kegiatan
        ? susunLaporanKegiatan({
            transaksi: semuaTransaksi ?? transaksi,
            kegiatan,
            daftarKegiatan: daftarKegiatan && daftarKegiatan.length > 0 ? daftarKegiatan : [kegiatan],
            profilPelapor,
            urutanTransaksiIds: kegiatan.urutanTransaksi,
            sertakanDaftarPeriksa: kegiatan.sertakanDaftarPeriksa !== false,
          })
        : null,
    [adalahKegiatan, kegiatan, semuaTransaksi, transaksi, daftarKegiatan, profilPelapor]
  );

  const kelompok = useMemo(
    () => (susunan ? [] : susunKelompokDokumen(transaksi, adalahKegiatan, kegiatan?.urutanTransaksi)),
    [susunan, transaksi, adalahKegiatan, kegiatan?.urutanTransaksi]
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
  // Uang harian tidak memerlukan bukti per hari (sudah berupa timesheet), jadi tidak dihitung "belum punya bukti".
  const transaksiDokumen = susunan ? susunan.transaksiKegiatan : transaksi;
  const jumlahLampiran = transaksiDokumen.reduce((s, t) => s + (t.bukti?.length || 0), 0);
  const tanpaBukti = (susunan ? susunan.pengeluaran.filter((t) => t.kategori !== KATEGORI_PERDIEM) : transaksi).filter(
    (t) => t.jenis === "pengeluaran" && t.kategori !== KATEGORI_PINDAH_DANA && !(t.bukti && t.bukti.length > 0)
  ).length;

  const tglCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const judulTombol = (teks: string) => (sedangMemuat.size > 0 ? "Tunggu sampai semua foto bukti termuat" : teks);
  const namaPelapor = profilPelapor.nama;

  // Tiap kategori (potret): tabel lalu lampiran buktinya.
  const kopDiTabel = kelompok.length > 0;
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
          {susunan ? (
            <p className="dsc-toolbar__ket">
              {susunan.kelompok.length} kelompok pengeluaran · {susunan.totalBukti} bukti · {jumlahLampiran} foto bukti
              {tanpaBukti > 0 ? ` · ${tanpaBukti} pengeluaran belum punya foto bukti` : ""}. Susunan sama dengan dokumen Word:{" "}
              {susunan.daftarPerdiem ? "timesheet uang harian (lanskap), " : ""}identitas dan penerimaan dana, tiap kelompok dengan
              kotak tempel bukti asli dan semua foto buktinya, rekapitulasi dan ringkasan penyelesaian dana.
            </p>
          ) : (
            <p className="dsc-toolbar__ket">
              {kelompok.length} bagian per kategori · {jumlahLampiran} lampiran bukti
              {tanpaBukti > 0 ? ` · ${tanpaBukti} pengeluaran belum punya bukti` : ""}. Urutan: tiap kategori diikuti foto nota dan
              kotak tempel buktinya (potret), ditutup rekapitulasi.
            </p>
          )}
        </div>
        <div className="dsc-cetak-aksi" role="group" aria-label="Cetak dan unduh dokumen">
          <button
            type="button"
            className="btn-secondary"
            disabled={sedangMemuat.size > 0}
            onClick={() => cetakDokumen()}
            title={judulTombol(
              susunan?.daftarPerdiem ? "Cetak atau simpan sebagai PDF: timesheet lanskap, halaman lain potret" : "Cetak atau simpan sebagai PDF (A4 potret)"
            )}
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
        {susunan?.daftarPerdiem && (
          <p className="dsc-cetak-petunjuk">
            Orientasi halaman berganti otomatis dalam satu dokumen (timesheet lanskap, lainnya potret). Bila peramban ponsel Anda
            tidak mengganti orientasi, atur <strong>Orientasi</strong> di jendela cetak sesuai halaman, atau unduh versi Word yang
            orientasinya sudah benar per bagian.
          </p>
        )}
        {!susunan && kotakTempelAda && (
          <label className="dsc-tempel-pilihan">
            <input type="checkbox" checked={sertakanTempel} onChange={(e) => setSertakanTempel(e.target.checked)} />
            Sertakan kotak tempel bukti fisik asli di lembar yang sama dengan foto bukti ({kotakTempel.length} kotak, lampiran sekitar{" "}
            {perkiraanHalaman} halaman)
          </label>
        )}
      </div>

      {susunan ? (
        susunan.transaksiKegiatan.length === 0 ? (
          <p className="dsc-kosong">Belum ada transaksi untuk kegiatan ini.</p>
        ) : (
          <div className="dsc-daftar-lembar dlk" data-testid="dokumen-laporan-kegiatan">
            <DokumenLaporanKegiatan susunan={susunan} googleToken={googleToken} onStatus={ubahStatusMuat} />
          </div>
        )
      ) : kelompok.length === 0 ? (
        <p className="dsc-kosong">Tidak ada transaksi pada parameter yang dipilih.</p>
      ) : (
        <div className="dsc-daftar-lembar">
          {/* 1. Tiap kategori (potret): tabel, lalu foto nota dan kotak tempelnya */}
          {kelompok.map((k, indeks) => (
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

          {/* 2. Lembar penutup: rekapitulasi klaim (total, penyelesaian dana, dan tanda tangan) */}
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
