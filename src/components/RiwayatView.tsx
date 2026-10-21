import React, { useState } from "react";
import { Transaksi, NamaDana } from "../types";
import { formatRupiah, formatAngka, hariIni, namaBulan, namaBulanPendek, namaHari } from "../lib/constants";

interface RiwayatViewProps {
  transaksi: Transaksi[];
  bulanTerpilih: string;
  anggaran: number;
  syncStatus?: { pesan: string; status: "kerja" | "sukses" | "gagal" | "idle" } | null;
  onEdit: (t: Transaksi) => void;
  onDelete: (id: string) => void;
  onGeserBulan: (delta: number) => void;
  onBukaTransaksiBerulang?: () => void;
  jumlahJatuhTempo?: number;
}

function inisialKategori(k: string): string {
  const kata = String(k || "?").replace(/&/g, "").split(/\s+/).filter(Boolean);
  return (kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2)).toUpperCase();
}

export const RiwayatView: React.FC<RiwayatViewProps> = ({
  transaksi,
  bulanTerpilih,
  anggaran,
  syncStatus,
  onEdit,
  onDelete,
  onGeserBulan,
  onBukaTransaksiBerulang,
  jumlahJatuhTempo = 0,
}) => {
  const [filterDana, setFilterDana] = useState<string>("");

  // Saldo keseluruhan per dana (sepanjang waktu)
  const hitungSaldoKumulatif = (dana: NamaDana) => {
    const trx = transaksi.filter((p) => p.dana === dana);
    const masuk = trx.filter((p) => p.jenis === "pemasukan").reduce((s, p) => s + p.jumlah, 0);
    const keluar = trx.filter((p) => p.jenis === "pengeluaran").reduce((s, p) => s + p.jumlah, 0);
    return masuk - keluar;
  };

  // Arus bulan ini per dana
  const hitungArusBulan = (dana: NamaDana) => {
    const trx = transaksi.filter((p) => p.dana === dana && p.tanggal.startsWith(bulanTerpilih));
    const masuk = trx.filter((p) => p.jenis === "pemasukan").reduce((s, p) => s + p.jumlah, 0);
    const keluar = trx.filter((p) => p.jenis === "pengeluaran").reduce((s, p) => s + p.jumlah, 0);
    return { masuk, keluar };
  };

  const saldoPribadi = hitungSaldoKumulatif("Dana Pribadi");
  const saldoKegiatan = hitungSaldoKumulatif("Dana Kegiatan");
  const arusPribadi = hitungArusBulan("Dana Pribadi");
  const arusKegiatan = hitungArusBulan("Dana Kegiatan");

  const [thBln, blBln] = bulanTerpilih.split("-").map(Number);
  const teksNamaBulan = namaBulan.format(new Date(thBln, blBln - 1, 1));

  // Transaksi bulan terpilih & difilter
  const transaksiBulan = transaksi
    .filter((t) => t.tanggal.startsWith(bulanTerpilih))
    .filter((t) => (!filterDana ? true : t.dana === filterDana));

  // Kelompokkan per tanggal (descending)
  const perHariMap = new Map<string, Transaksi[]>();
  for (const t of transaksiBulan) {
    const list = perHariMap.get(t.tanggal) || [];
    list.push(t);
    perHariMap.set(t.tanggal, list);
  }
  const daftarTanggal = Array.from(perHariMap.keys()).sort((a, b) => b.localeCompare(a));

  // Anggaran pengeluaran hari ini
  const tglHariIni = hariIni();
  const keluarHariIni = transaksi
    .filter((t) => t.tanggal === tglHariIni && t.jenis === "pengeluaran")
    .reduce((s, t) => s + t.jumlah, 0);

  const persenAnggaran = anggaran > 0 ? (keluarHariIni / anggaran) * 100 : 0;
  const lebih = keluarHariIni > anggaran;

  // Nama bulan lalu untuk tombol
  const [th, bl] = bulanTerpilih.split("-").map(Number);
  const tglBulanLalu = new Date(th, bl - 2, 1);
  const labelBulanLalu = `${namaBulanPendek.format(tglBulanLalu)} ${tglBulanLalu.getFullYear()} ←`;

  return (
    <section className="view" id="view-riwayat" data-view="riwayat">
      {jumlahJatuhTempo > 0 && onBukaTransaksiBerulang && (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
            border: "1.5px solid var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.86rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🔔</span>
            <span>
              Ada <strong>{jumlahJatuhTempo} transaksi berulang</strong> jatuh tempo hari ini!
            </span>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: "5px 12px", fontSize: "0.8rem", fontWeight: 700 }}
            onClick={onBukaTransaksiBerulang}
          >
            🔁 Kelola &amp; Terapkan
          </button>
        </div>
      )}

      <section className="balances" aria-label="Saldo per dana">
        <div className="balance" data-dana="Dana Pribadi">
          <span className="stat-label">Saldo Dana Pribadi</span>
          <span className={`balance-value ${saldoPribadi < 0 ? "negative" : ""}`}>
            {formatRupiah(saldoPribadi)}
          </span>
          <div className="balance-flow">
            <span className="balance-flow-period">{teksNamaBulan}:</span>
            <span className="balance-flow-row flow-in">masuk {formatRupiah(arusPribadi.masuk)}</span>
            <span className="balance-flow-row flow-out">keluar {formatRupiah(arusPribadi.keluar)}</span>
          </div>
        </div>
        <div className="balance" data-dana="Dana Kegiatan">
          <span className="stat-label">Saldo Dana Kegiatan</span>
          <span className={`balance-value ${saldoKegiatan < 0 ? "negative" : ""}`}>
            {formatRupiah(saldoKegiatan)}
          </span>
          <div className="balance-flow">
            <span className="balance-flow-period">{teksNamaBulan}:</span>
            <span className="balance-flow-row flow-in">masuk {formatRupiah(arusKegiatan.masuk)}</span>
            <span className="balance-flow-row flow-out">keluar {formatRupiah(arusKegiatan.keluar)}</span>
          </div>
        </div>
      </section>

      {syncStatus && syncStatus.status !== "idle" && (
        <p className="sync-pill" data-keadaan={syncStatus.status} id="sync-status">
          {syncStatus.pesan}
        </p>
      )}

      <div className="filter-chips" role="radiogroup" aria-label="Saring dana">
        <button
          type="button"
          className="chip"
          data-dana=""
          aria-checked={filterDana === ""}
          role="radio"
          onClick={() => setFilterDana("")}
        >
          Semua dana
        </button>
        <button
          type="button"
          className="chip"
          data-dana="Dana Pribadi"
          aria-checked={filterDana === "Dana Pribadi"}
          role="radio"
          onClick={() => setFilterDana("Dana Pribadi")}
        >
          Dana Pribadi
        </button>
        <button
          type="button"
          className="chip"
          data-dana="Dana Kegiatan"
          aria-checked={filterDana === "Dana Kegiatan"}
          role="radio"
          onClick={() => setFilterDana("Dana Kegiatan")}
        >
          Dana Kegiatan
        </button>
      </div>

      <div className="budget" id="kartu-anggaran">
        <div className="budget-row">
          <span className="budget-judul">Anggaran pengeluaran hari ini</span>
          <span className="budget-nilai" id="anggaran-ringkas">
            {anggaran > 0 ? `batas ${formatRupiah(anggaran)}` : "belum diatur"}
          </span>
        </div>
        {anggaran > 0 && (
          <div id="status-anggaran" className={`budget-status ${lebih ? "over" : ""}`}>
            <div
              className="meter"
              role="progressbar"
              aria-labelledby="teks-anggaran"
              aria-valuenow={Math.round(persenAnggaran)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="meter-fill"
                id="meter-anggaran"
                style={{ width: `${Math.min(100, Math.max(0, persenAnggaran))}%` }}
              />
            </div>
            <p id="teks-anggaran" className="budget-text">
              {lebih
                ? `⚠ Hari ini melebihi anggaran ${formatRupiah(
                    keluarHariIni - anggaran
                  )} (${Math.round(persenAnggaran)}%)`
                : `Hari ini terpakai ${formatRupiah(keluarHariIni)} (${Math.round(
                    persenAnggaran
                  )}%), sisa ${formatRupiah(anggaran - keluarHariIni)}`}
            </p>
          </div>
        )}
      </div>

      <div id="daftar-hari" className="daftar-hari">
        {daftarTanggal.map((tgl) => {
          const itemHari = perHariMap.get(tgl) || [];
          const keluarHari = itemHari
            .filter((x) => x.jenis === "pengeluaran")
            .reduce((s, x) => s + x.jumlah, 0);
          const masukHari = itemHari
            .filter((x) => x.jenis === "pemasukan")
            .reduce((s, x) => s + x.jumlah, 0);

          const [y, m, d] = tgl.split("-").map(Number);
          const dObj = new Date(y, m - 1, d);

          return (
            <section key={tgl} className="hari">
              <div className="hari-kepala">
                <span>
                  <strong>
                    {d} {namaBulanPendek.format(dObj)}
                  </strong>{" "}
                  <span className="hari-nama">{namaHari.format(dObj)}</span>
                </span>
                <span className="hari-total">
                  {[
                    keluarHari ? `Pengeluaran: ${formatAngka(keluarHari)}` : "",
                    masukHari ? `Pemasukan: ${formatAngka(masukHari)}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <ul className="expense-list">
                {itemHari.map((item) => {
                  const metaBagian = [
                    item.dana,
                    item.metode,
                    item.kaitan,
                  ].filter(Boolean);

                  return (
                    <li key={item.id} className="expense-item">
                      <div className={`ikon-kategori ${item.jenis}`}>
                        {inisialKategori(item.kategori)}
                      </div>
                      <div className="expense-info">
                        <div className="expense-desc">{item.deskripsi}</div>
                        <div className="expense-meta">
                          {item.kategori} · {metaBagian.join(" · ")}
                        </div>
                        {item.catatan && (
                          <div className="expense-note">{item.catatan}</div>
                        )}
                      </div>
                      <div className="expense-kanan">
                        <span
                          className={`expense-amount ${
                            item.jenis === "pemasukan" ? "amount-in" : ""
                          }`}
                        >
                          {item.jenis === "pemasukan" ? "+" : "-"}
                          {formatRupiah(item.jumlah)}
                        </span>
                        <div className="expense-buttons">
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => onEdit(item)}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-delete"
                            onClick={() => {
                              if (confirm(`Hapus transaksi "${item.deskripsi}"?`)) {
                                onDelete(item.id);
                              }
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {daftarTanggal.length === 0 && (
        <p id="kosong" className="empty">
          Belum ada transaksi pada bulan ini.
        </p>
      )}

      <div className="actions tengah">
        <button
          type="button"
          id="bulan-lalu"
          className="btn-secondary btn-pil"
          onClick={() => onGeserBulan(-1)}
        >
          {labelBulanLalu}
        </button>
      </div>
    </section>
  );
};
