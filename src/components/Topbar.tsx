import React from "react";
import { KarakterId, Transaksi } from "../types";
import { KARAKTER, formatRupiah, namaBulan, namaBulanPendek } from "../lib/constants";
import { jalankanPerluasanDomain } from "../lib/domain";

interface TopbarProps {
  karakter: KarakterId;
  bulanTerpilih: string; // YYYY-MM
  onPilihBulan: (bulan: string) => void;
  transaksi: Transaksi[];
}

export const Topbar: React.FC<TopbarProps> = ({
  karakter,
  bulanTerpilih,
  onPilihBulan,
  transaksi,
}) => {
  const meta = KARAKTER[karakter] || KARAKTER.gojo;

  const geserBulan = (delta: number) => {
    const [th, bl] = bulanTerpilih.split("-").map(Number);
    const d = new Date(th, bl - 1 + delta, 1);
    const baru = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    onPilihBulan(baru);
  };

  const [tahun, bulanAngka] = bulanTerpilih.split("-").map(Number);
  const tanggalObj = new Date(tahun, bulanAngka - 1, 1);
  const teksBulan = namaBulanPendek.format(tanggalObj);

  // Hitung ringkasan bulan terpilih
  const transaksiBulan = transaksi.filter((t) => t.tanggal.startsWith(bulanTerpilih));
  const totalKeluar = transaksiBulan
    .filter((t) => t.jenis === "pengeluaran")
    .reduce((s, t) => s + t.jumlah, 0);
  const totalMasuk = transaksiBulan
    .filter((t) => t.jenis === "pemasukan")
    .reduce((s, t) => s + t.jumlah, 0);
  const saldoBulan = totalMasuk - totalKeluar;

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          <div className="hanko" id="hanko" aria-hidden="true">
            {meta.lambang}
          </div>
          <div>
            <h1>Catatan Keuangan</h1>
            <p className="tagline" id="tagline">
              {meta.tagline}
            </p>
          </div>
        </div>
        <button
          type="button"
          id="btn-domain"
          className="btn-domain"
          title="Perluasan Domain"
          onClick={() => jalankanPerluasanDomain(karakter)}
        >
          領域展開
        </button>
      </div>

      <div className="topbar-row ringkasan-bulan">
        <div className="pilih-bulan">
          <button
            type="button"
            id="bulan-prev"
            className="btn-ikon"
            aria-label="Bulan sebelumnya"
            onClick={() => geserBulan(-1)}
          >
            ‹
          </button>
          <label className="bulan-label">
            <span className="bulan-tahun" id="bulan-tahun">
              {tahun}
            </span>
            <span className="bulan-nama" id="bulan-nama">
              {teksBulan} ▾
            </span>
            <input
              type="month"
              id="bulan"
              aria-label="Pilih bulan"
              value={bulanTerpilih}
              onChange={(e) => {
                if (e.target.value) onPilihBulan(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            id="bulan-next"
            className="btn-ikon"
            aria-label="Bulan berikutnya"
            onClick={() => geserBulan(1)}
          >
            ›
          </button>
        </div>
        <div className="stat-bulan">
          <span className="stat-label">Pengeluaran</span>
          <span className="stat-value" id="keluar-bulan">
            {formatRupiah(totalKeluar)}
          </span>
        </div>
        <div className="stat-bulan">
          <span className="stat-label">Pemasukan</span>
          <span className="stat-value" id="masuk-bulan">
            {formatRupiah(totalMasuk)}
          </span>
        </div>
        <div className="stat-bulan">
          <span className="stat-label">Saldo</span>
          <span className="stat-value" id="saldo-bulan">
            {formatRupiah(saldoBulan)}
          </span>
        </div>
      </div>
    </header>
  );
};
