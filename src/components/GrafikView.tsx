import React, { useState } from "react";
import { Transaksi } from "../types";
import { formatRupiah, formatAngka, namaBulan, namaBulanPendek } from "../lib/constants";

interface GrafikViewProps {
  transaksi: Transaksi[];
  bulanTerpilih: string;
  anggaran: number;
  onSetAnggaran: (nilai: number) => void;
}

export const GrafikView: React.FC<GrafikViewProps> = ({
  transaksi,
  bulanTerpilih,
  anggaran,
  onSetAnggaran,
}) => {
  const [inputBatas, setInputBatas] = useState(anggaran > 0 ? String(anggaran) : "");

  // 6 bulan terakhir sampai bulan terpilih
  const [th, bl] = bulanTerpilih.split("-").map(Number);
  const daftarBulan: Array<{ kunci: string; label: string; masuk: number; keluar: number }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(th, bl - 1 - i, 1);
    const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = transaksi.filter((t) => t.tanggal.startsWith(kunci));
    const masuk = list.filter((t) => t.jenis === "pemasukan").reduce((s, t) => s + t.jumlah, 0);
    const keluar = list.filter((t) => t.jenis === "pengeluaran").reduce((s, t) => s + t.jumlah, 0);
    daftarBulan.push({
      kunci,
      label: namaBulanPendek.format(d),
      masuk,
      keluar,
    });
  }

  const maksTren = Math.max(1, ...daftarBulan.map((b) => Math.max(b.masuk, b.keluar)));

  // Kategori bulan terpilih
  const [thBln, blBln] = bulanTerpilih.split("-").map(Number);
  const namaBulanPenuh = namaBulan.format(new Date(thBln, blBln - 1, 1));
  const transaksiBulan = transaksi.filter((t) => t.tanggal.startsWith(bulanTerpilih));

  const keluarBulan = transaksiBulan.filter((t) => t.jenis === "pengeluaran");
  const masukBulan = transaksiBulan.filter((t) => t.jenis === "pemasukan");

  const totalKeluar = keluarBulan.reduce((s, t) => s + t.jumlah, 0);
  const totalMasuk = masukBulan.reduce((s, t) => s + t.jumlah, 0);

  const buatListKategori = (list: Transaksi[], total: number) => {
    const map = new Map<string, number>();
    for (const t of list) map.set(t.kategori, (map.get(t.kategori) || 0) + t.jumlah);
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const maksKat = sorted.length ? sorted[0][1] : 1;
    return sorted.map(([nama, jml]) => {
      const persen = total ? Math.round((jml / total) * 100) : 0;
      const barPersen = maksKat ? (jml / maksKat) * 100 : 0;
      return { nama, jml, persen, barPersen };
    });
  };

  const kategoriKeluar = buatListKategori(keluarBulan, totalKeluar);
  const kategoriMasuk = buatListKategori(masukBulan, totalMasuk);

  const handleSubmitAnggaran = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(inputBatas) || 0;
    onSetAnggaran(val);
  };

  return (
    <section className="view" id="view-grafik" data-view="grafik">
      <div className="card">
        <h2>Tren 6 bulan terakhir</h2>
        <div className="legenda">
          <span>
            <i className="swatch masuk"></i>Pemasukan
          </span>
          <span>
            <i className="swatch keluar"></i>Pengeluaran
          </span>
        </div>

        <div className="tren" id="tren-bulanan" role="img" aria-label="Pemasukan dan pengeluaran per bulan">
          {daftarBulan.map((b) => {
            const aktif = b.kunci === bulanTerpilih;
            const hMasuk = (b.masuk / maksTren) * 100;
            const hKeluar = (b.keluar / maksTren) * 100;

            return (
              <div
                key={b.kunci}
                className={`tren-kolom ${aktif ? "aktif" : ""}`}
                title={`${b.label}: masuk ${formatRupiah(b.masuk)}, keluar ${formatRupiah(b.keluar)}`}
              >
                <div className="tren-batang">
                  <div className="bar masuk" style={{ height: `${hMasuk}%` }} />
                  <div className="bar keluar" style={{ height: `${hKeluar}%` }} />
                </div>
                <span className="tren-label">{b.label}</span>
              </div>
            );
          })}
        </div>

        <div className="tabel-tren-wrap">
          <table className="tabel-tren" id="tabel-tren">
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Pemasukan</th>
                <th>Pengeluaran</th>
                <th>Selisih</th>
              </tr>
            </thead>
            <tbody>
              {daftarBulan.map((b) => {
                const selisih = b.masuk - b.keluar;
                return (
                  <tr key={b.kunci}>
                    <td>{b.label}</td>
                    <td>{formatAngka(b.masuk)}</td>
                    <td>{formatAngka(b.keluar)}</td>
                    <td className={selisih < 0 ? "negatif" : ""}>
                      {formatAngka(selisih)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 id="judul-kategori">Ringkasan per Kategori — {namaBulanPenuh}</h2>

        <h3>Pengeluaran</h3>
        {kategoriKeluar.length > 0 ? (
          <ul id="ringkasan-keluar" className="category-list">
            {kategoriKeluar.map(({ nama, jml, persen, barPersen }) => (
              <li
                key={nama}
                className="category-row"
                title={`${nama}: ${formatRupiah(jml)} (${persen}% dari total bulan ini)`}
              >
                <span className="category-name">{nama}</span>
                <span className="category-value">
                  {formatRupiah(jml)} · {persen}%
                </span>
                <div className="category-bar">
                  <div className="category-fill" style={{ width: `${barPersen}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p id="keluar-kosong" className="empty">
            Belum ada pengeluaran pada bulan ini.
          </p>
        )}

        <h3>Pemasukan</h3>
        {kategoriMasuk.length > 0 ? (
          <ul id="ringkasan-masuk" className="category-list">
            {kategoriMasuk.map(({ nama, jml, persen, barPersen }) => (
              <li
                key={nama}
                className="category-row"
                title={`${nama}: ${formatRupiah(jml)} (${persen}% dari total bulan ini)`}
              >
                <span className="category-name">{nama}</span>
                <span className="category-value">
                  {formatRupiah(jml)} · {persen}%
                </span>
                <div className="category-bar">
                  <div className="category-fill" style={{ width: `${barPersen}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p id="masuk-kosong" className="empty">
            Belum ada pemasukan pada bulan ini.
          </p>
        )}
      </div>

      <div className="card card-anggaran-harian">
        <h2>Anggaran pengeluaran harian</h2>
        <form id="form-anggaran" className="budget-form" onSubmit={handleSubmitAnggaran}>
          <label htmlFor="anggaran" className="budget-form-label">
            Batas per hari (Rp)
          </label>
          <input
            type="number"
            id="anggaran"
            className="budget-form-input"
            min="0"
            step="1"
            placeholder="Belum diatur"
            value={inputBatas}
            onChange={(e) => setInputBatas(e.target.value)}
          />
          <button type="submit" className="btn-secondary budget-form-btn">
            Atur
          </button>
        </form>
        <p className="help budget-form-help">
          Dipakai untuk meter di tab Riwayat: pengeluaran hari ini dibanding batas.
        </p>
      </div>
    </section>
  );
};
