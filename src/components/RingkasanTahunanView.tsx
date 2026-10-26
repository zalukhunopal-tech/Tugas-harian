import React, { useState, useMemo } from "react";
import { Transaksi } from "../types";
import { formatRupiah, formatAngka, namaBulan, hariIni } from "../lib/constants";
import { Nominal, TeksLayar } from "./TeksLayar";

interface RingkasanTahunanViewProps {
  transaksi: Transaksi[];
  tahunAwal?: number;
}

const DAFTAR_NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const RingkasanTahunanView: React.FC<RingkasanTahunanViewProps> = ({
  transaksi,
  tahunAwal,
}) => {
  const tahunSekarang = Number(hariIni().slice(0, 4));
  const [tahunPilihan, setTahunPilihan] = useState<number>(() => {
    return tahunAwal || tahunSekarang;
  });

  const [tabKategori, setTabKategori] = useState<"pengeluaran" | "pemasukan">("pengeluaran");
  const [filterDana, setFilterDana] = useState<"Semua" | "Dana Pribadi" | "Dana Kegiatan">("Semua");

  // Daftar tahun yang ada pada catatan transaksi
  const daftarTahunTersedia = useMemo(() => {
    const set = new Set<number>();
    set.add(tahunSekarang);
    set.add(tahunSekarang - 1);
    for (const t of transaksi) {
      const y = Number(t.tanggal.slice(0, 4));
      if (!isNaN(y) && y >= 2000 && y <= 2100) {
        set.add(y);
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [transaksi, tahunSekarang]);

  const tahunSebelumnya = tahunPilihan - 1;

  // Transaksi tahun pilihan & tahun sebelumnya tersaring berdasarkan kategori dana
  const trxTahunIni = useMemo(() => {
    const prefix = String(tahunPilihan);
    return transaksi.filter(
      (t) =>
        t.tanggal.startsWith(prefix) &&
        t.kategori !== "Pindah Dana" &&
        (filterDana === "Semua" || t.dana === filterDana)
    );
  }, [transaksi, tahunPilihan, filterDana]);

  const trxTahunLalu = useMemo(() => {
    const prefix = String(tahunSebelumnya);
    return transaksi.filter(
      (t) =>
        t.tanggal.startsWith(prefix) &&
        t.kategori !== "Pindah Dana" &&
        (filterDana === "Semua" || t.dana === filterDana)
    );
  }, [transaksi, tahunSebelumnya, filterDana]);

  // 12 Bulan dalam Tahun Terpilih
  const rekap12Bulan = useMemo(() => {
    return Array.from({ length: 12 }, (_, blnIdx) => {
      const blnStr = String(blnIdx + 1).padStart(2, "0");
      const prefix = `${tahunPilihan}-${blnStr}`;
      const list = trxTahunIni.filter((t) => t.tanggal.startsWith(prefix));

      const masuk = list.filter((t) => t.jenis === "pemasukan").reduce((s, t) => s + t.jumlah, 0);
      const keluar = list.filter((t) => t.jenis === "pengeluaran").reduce((s, t) => s + t.jumlah, 0);
      const selisih = masuk - keluar;

      return {
        bulanIdx: blnIdx,
        nama: DAFTAR_NAMA_BULAN[blnIdx],
        namaPendek: DAFTAR_NAMA_BULAN[blnIdx].slice(0, 3),
        masuk,
        keluar,
        selisih,
        jumlahTrx: list.length,
      };
    });
  }, [trxTahunIni, tahunPilihan]);

  // Total Tahun Ini
  const totalMasukTahunIni = trxTahunIni
    .filter((t) => t.jenis === "pemasukan")
    .reduce((s, t) => s + t.jumlah, 0);
  const totalKeluarTahunIni = trxTahunIni
    .filter((t) => t.jenis === "pengeluaran")
    .reduce((s, t) => s + t.jumlah, 0);
  const selisihTahunIni = totalMasukTahunIni - totalKeluarTahunIni;

  // Total Tahun Lalu
  const totalMasukTahunLalu = trxTahunLalu
    .filter((t) => t.jenis === "pemasukan")
    .reduce((s, t) => s + t.jumlah, 0);
  const totalKeluarTahunLalu = trxTahunLalu
    .filter((t) => t.jenis === "pengeluaran")
    .reduce((s, t) => s + t.jumlah, 0);
  const selisihTahunLalu = totalMasukTahunLalu - totalKeluarTahunLalu;

  // Perhitungan Perbandingan Makro
  const deltaMasuk = totalMasukTahunIni - totalMasukTahunLalu;
  const persenDeltaMasuk =
    totalMasukTahunLalu > 0 ? ((deltaMasuk / totalMasukTahunLalu) * 100).toFixed(1) : null;

  const deltaKeluar = totalKeluarTahunIni - totalKeluarTahunLalu;
  const persenDeltaKeluar =
    totalKeluarTahunLalu > 0 ? ((deltaKeluar / totalKeluarTahunLalu) * 100).toFixed(1) : null;

  const maxBulanNominal = Math.max(
    1,
    ...rekap12Bulan.map((b) => Math.max(b.masuk, b.keluar))
  );

  // Rekap Kategori Tahun Ini
  const rekapKategoriTahunIni = useMemo(() => {
    const mapKeluar = new Map<string, number>();
    const mapMasuk = new Map<string, number>();

    for (const t of trxTahunIni) {
      if (t.jenis === "pengeluaran") {
        mapKeluar.set(t.kategori, (mapKeluar.get(t.kategori) || 0) + t.jumlah);
      } else {
        mapMasuk.set(t.kategori, (mapMasuk.get(t.kategori) || 0) + t.jumlah);
      }
    }

    const susun = (map: Map<string, number>, total: number) => {
      const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      const maks = arr.length > 0 ? arr[0][1] : 1;
      return arr.map(([kategori, jumlah]) => ({
        kategori,
        jumlah,
        persen: total > 0 ? Math.round((jumlah / total) * 100) : 0,
        barPersen: maks > 0 ? (jumlah / maks) * 100 : 0,
      }));
    };

    return {
      pengeluaran: susun(mapKeluar, totalKeluarTahunIni),
      pemasukan: susun(mapMasuk, totalMasukTahunIni),
    };
  }, [trxTahunIni, totalKeluarTahunIni, totalMasukTahunIni]);

  // Perbandingan Kategori Belanja Tahun Ini vs Tahun Lalu
  const perbandinganKategori = useMemo(() => {
    const mapIni = new Map<string, number>();
    const mapLalu = new Map<string, number>();

    for (const t of trxTahunIni) {
      if (t.jenis === "pengeluaran") {
        mapIni.set(t.kategori, (mapIni.get(t.kategori) || 0) + t.jumlah);
      }
    }
    for (const t of trxTahunLalu) {
      if (t.jenis === "pengeluaran") {
        mapLalu.set(t.kategori, (mapLalu.get(t.kategori) || 0) + t.jumlah);
      }
    }

    const semuaKategori = Array.from(
      new Set([...Array.from(mapIni.keys()), ...Array.from(mapLalu.keys())])
    );

    return semuaKategori
      .map((kat) => {
        const jmlIni = mapIni.get(kat) || 0;
        const jmlLalu = mapLalu.get(kat) || 0;
        const selisih = jmlIni - jmlLalu;
        const persen = jmlLalu > 0 ? ((selisih / jmlLalu) * 100).toFixed(1) : null;
        return {
          kategori: kat,
          jmlIni,
          jmlLalu,
          selisih,
          persen,
        };
      })
      .sort((a, b) => b.jmlIni - a.jmlIni);
  }, [trxTahunIni, trxTahunLalu]);

  return (
    <div className="ringkasan-tahunan-container">
      {/* Pengatur Tahun */}
      <div
        className="card ringkasan-tahun-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.6rem" }}>📅</span>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
              Ringkasan Keuangan Tahun {tahunPilihan}
            </h2>
            <p className="help" style={{ margin: 0, fontSize: "0.85rem" }}>
              Analisis 12 bulan &amp; perbandingan dengan tahun {tahunSebelumnya}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn-ikon"
            onClick={() => setTahunPilihan((prev) => prev - 1)}
            title="Tahun Sebelumnya"
          >
            ←
          </button>
          <select
            className="input-select"
            value={tahunPilihan}
            onChange={(e) => setTahunPilihan(Number(e.target.value))}
            style={{
              padding: "6px 14px",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "1rem",
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            {daftarTahunTersedia.map((th) => (
              <option key={th} value={th}>
                Tahun {th}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ikon"
            onClick={() => setTahunPilihan((prev) => prev + 1)}
            title="Tahun Berikutnya"
          >
            →
          </button>
        </div>

        {/* Pemilih Kategori Dana: Cukup 2 Pilihan (Dana Kegiatan & Dana Pribadi; Default: Semua Dana) */}
        <div className="dana-filter-bar no-print">
          <div className="dana-filter-info">
            <span className="dana-filter-title">Kategori Dana:</span>
            <span className="dana-status-text">
              {filterDana === "Semua" ? "Semua Dana (Default)" : filterDana}
            </span>
            {filterDana !== "Semua" && (
              <button
                type="button"
                className="dana-reset-link"
                onClick={() => setFilterDana("Semua")}
                title="Kembali ke Semua Dana (Default)"
              >
                ✕ Reset
              </button>
            )}
          </div>
          <div className="dana-filter-dua-pilihan" role="group" aria-label="Filter Kategori Dana Tahunan">
            <button
              type="button"
              className={`dana-filter-chip ${filterDana === "Dana Kegiatan" ? "aktif" : ""}`}
              onClick={() => setFilterDana(filterDana === "Dana Kegiatan" ? "Semua" : "Dana Kegiatan")}
              title={filterDana === "Dana Kegiatan" ? "Ketuk untuk kembali ke Semua Dana (Default)" : "Filter Dana Kegiatan"}
            >
              💼 Dana Kegiatan
            </button>
            <button
              type="button"
              className={`dana-filter-chip ${filterDana === "Dana Pribadi" ? "aktif" : ""}`}
              onClick={() => setFilterDana(filterDana === "Dana Pribadi" ? "Semua" : "Dana Pribadi")}
              title={filterDana === "Dana Pribadi" ? "Ketuk untuk kembali ke Semua Dana (Default)" : "Filter Dana Pribadi"}
            >
              👤 Dana Pribadi
            </button>
          </div>
        </div>
      </div>

      {/* Tiga Kartu Metrik Utama & Perbandingan dengan Tahun Lalu */}
      <div
        className="ringkasan-metrik-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* Pemasukan */}
        <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Pemasukan {tahunPilihan}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#10b981" }}>
            {formatRupiah(totalMasukTahunIni)}
          </div>
          <div style={{ fontSize: "0.8rem", marginTop: "8px", color: "var(--text-muted)" }}>
            Tahun {tahunSebelumnya}: {formatRupiah(totalMasukTahunLalu)}
            {persenDeltaMasuk !== null && (
              <span
                style={{
                  marginLeft: "8px",
                  fontWeight: 700,
                  color: deltaMasuk >= 0 ? "#10b981" : "#ef4444",
                }}
              >
                ({deltaMasuk >= 0 ? "+" : ""}
                {persenDeltaMasuk}%)
              </span>
            )}
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Pengeluaran {tahunPilihan}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ef4444" }}>
            {formatRupiah(totalKeluarTahunIni)}
          </div>
          <div style={{ fontSize: "0.8rem", marginTop: "8px", color: "var(--text-muted)" }}>
            Tahun {tahunSebelumnya}: {formatRupiah(totalKeluarTahunLalu)}
            {persenDeltaKeluar !== null && (
              <span
                style={{
                  marginLeft: "8px",
                  fontWeight: 700,
                  color: deltaKeluar <= 0 ? "#10b981" : "#ef4444",
                }}
              >
                ({deltaKeluar >= 0 ? "+" : ""}
                {persenDeltaKeluar}%)
              </span>
            )}
          </div>
        </div>

        {/* Arus Kas Bersih */}
        <div
          className="card"
          style={{
            padding: "18px 20px",
            borderLeft: `4px solid ${selisihTahunIni >= 0 ? "var(--primary)" : "#f97316"}`,
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Selisih / Arus Kas Bersih
          </div>
          <div
            style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: selisihTahunIni >= 0 ? "var(--primary)" : "#f97316",
            }}
          >
            {formatRupiah(selisihTahunIni)}
          </div>
          <div style={{ fontSize: "0.8rem", marginTop: "8px", color: "var(--text-muted)" }}>
            Rata-rata/bln: {formatRupiah(Math.round(totalKeluarTahunIni / 12))}
          </div>
        </div>
      </div>

      {/* Bagian 1: Tabel & Grafik 12 Bulan dalam Tahun yang Dipilih */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📊</span> Rincian 12 Bulan (Tahun {tahunPilihan})
            {filterDana !== "Semua" && <span className="dana-badge-aktif">{filterDana}</span>}
          </h3>
          <div className="legenda" style={{ margin: 0 }}>
            <span>
              <i className="swatch masuk" /> Masuk
            </span>
            <span>
              <i className="swatch keluar" /> Keluar
            </span>
          </div>
        </div>

        {/* Bar visual 12 bulan */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "8px",
            alignItems: "flex-end",
            height: "140px",
            padding: "10px 0 24px",
            borderBottom: "1px solid var(--border)",
            marginBottom: "16px",
          }}
        >
          {rekap12Bulan.map((b) => {
            const hMasuk = maxBulanNominal > 0 ? (b.masuk / maxBulanNominal) * 100 : 0;
            const hKeluar = maxBulanNominal > 0 ? (b.keluar / maxBulanNominal) * 100 : 0;

            return (
              <div
                key={b.bulanIdx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                  position: "relative",
                }}
                title={`${b.nama}: Masuk ${formatRupiah(b.masuk)}, Keluar ${formatRupiah(b.keluar)}`}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "3px",
                    width: "100%",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "44%",
                      height: `${Math.max(4, hMasuk)}%`,
                      backgroundColor: "#10b981",
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.3s ease",
                    }}
                  />
                  <div
                    style={{
                      width: "44%",
                      height: `${Math.max(4, hKeluar)}%`,
                      backgroundColor: "#ef4444",
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.3s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: "-20px",
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  {b.namaPendek}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tabel Rincian 12 Bulan */}
        <div className="wadah-tabel-hp" style={{ overflowX: "auto" }}>
          <table className="tabel-rekap tabel-rekap-12" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                <th style={{ padding: "8px 6px" }}>Bulan</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>
                  <TeksLayar pc="Pemasukan" hp="Masuk (Rp)" />
                </th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>
                  <TeksLayar pc="Pengeluaran" hp="Keluar (Rp)" />
                </th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>
                  <TeksLayar pc="Selisih" hp="Selisih (Rp)" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rekap12Bulan.map((b) => (
                <tr key={b.bulanIdx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "9px 6px", fontWeight: 600 }}>
                    <TeksLayar pc={b.nama} hp={b.namaPendek} />
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right", color: b.masuk > 0 ? "#10b981" : "inherit" }}>
                    {b.masuk > 0 ? <Nominal n={b.masuk} /> : "—"}
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right", color: b.keluar > 0 ? "#ef4444" : "inherit" }}>
                    {b.keluar > 0 ? <Nominal n={b.keluar} /> : "—"}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: b.selisih >= 0 ? "#10b981" : "#f97316",
                    }}
                  >
                    {b.masuk === 0 && b.keluar === 0 ? "—" : <Nominal n={b.selisih} />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 800 }}>
                <td style={{ padding: "10px 6px" }}>
                  <TeksLayar pc="Total Setahun" hp="Total" />
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", color: "#10b981" }}>
                  <Nominal n={totalMasukTahunIni} />
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", color: "#ef4444" }}>
                  <Nominal n={totalKeluarTahunIni} />
                </td>
                <td
                  style={{
                    padding: "10px 6px",
                    textAlign: "right",
                    color: selisihTahunIni >= 0 ? "#10b981" : "#f97316",
                  }}
                >
                  <Nominal n={selisihTahunIni} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bagian 2: Total per Kategori Setahun */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🏷️</span> Total per Kategori Setahun ({tahunPilihan})
            {filterDana !== "Semua" && <span className="dana-badge-aktif">{filterDana}</span>}
          </h3>
          <div className="filter-chips" style={{ margin: 0 }}>
            <button
              type="button"
              className="chip"
              aria-checked={tabKategori === "pengeluaran"}
              onClick={() => setTabKategori("pengeluaran")}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              className="chip"
              aria-checked={tabKategori === "pemasukan"}
              onClick={() => setTabKategori("pemasukan")}
            >
              Pemasukan
            </button>
          </div>
        </div>

        {rekapKategoriTahunIni[tabKategori].length === 0 ? (
          <p className="kosong" style={{ padding: "20px" }}>
            Belum ada data {tabKategori} di tahun {tahunPilihan}.
          </p>
        ) : (
          <div className="kategori-list" style={{ gap: "12px" }}>
            {rekapKategoriTahunIni[tabKategori].map((k) => (
              <div key={k.kategori} className="kategori-item" style={{ padding: "8px 0" }}>
                <div className="kategori-header" style={{ marginBottom: "6px" }}>
                  <span className="kategori-nama" style={{ fontWeight: 600 }}>
                    {k.kategori}
                  </span>{" "}
                  <span className="kategori-jumlah" style={{ fontWeight: 700 }}>
                    {formatRupiah(k.jumlah)}
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "6px" }}>
                      ({k.persen}%)
                    </span>
                  </span>
                </div>
                <div className="bar-track" style={{ height: "8px", borderRadius: "4px" }}>
                  <div
                    className="bar-fill"
                    style={{
                      width: `${k.barPersen}%`,
                      backgroundColor: tabKategori === "pengeluaran" ? "#ef4444" : "#10b981",
                      height: "100%",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bagian 3: Perbandingan Belanja per Kategori dengan Tahun Sebelumnya */}
      <div className="card">
        <h3 className="judul-perbandingan" style={{ margin: "0 0 8px", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>⚖️</span> Perbandingan Pengeluaran vs Tahun {tahunSebelumnya}
          {filterDana !== "Semua" && <span className="dana-badge-aktif">{filterDana}</span>}
        </h3>
        <p className="help" style={{ margin: "0 0 14px", fontSize: "0.85rem" }}>
          Perbandingan perubahan nominal dan persentase belanja per kategori antara tahun {tahunSebelumnya} dan {tahunPilihan}.
        </p>

        {perbandinganKategori.length === 0 ? (
          <p className="kosong" style={{ padding: "20px" }}>
            Belum ada perbandingan data untuk tahun {tahunPilihan} dan {tahunSebelumnya}.
          </p>
        ) : (
          <div className="wadah-tabel-hp" style={{ overflowX: "auto" }}>
            <table className="tabel-rekap tabel-perbandingan" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "8px 6px" }}>Kategori</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>
                    <TeksLayar pc={`Tahun ${tahunSebelumnya}`} hp={`${tahunSebelumnya} (Rp)`} />
                  </th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>
                    <TeksLayar pc={`Tahun ${tahunPilihan}`} hp={`${tahunPilihan} (Rp)`} />
                  </th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>
                    <TeksLayar pc="Selisih" hp="Selisih (Rp)" />
                  </th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Tren</th>
                </tr>
              </thead>
              <tbody>
                {perbandinganKategori.map((row) => {
                  const hemat = row.selisih < 0;
                  const sama = row.selisih === 0;
                  // Label tren: di kolom Tren (tablet/PC) dan, di HP, di bawah nama kategori (kolom Tren disembunyikan).
                  const lencanaTren =
                    row.persen !== null && Number(row.persen) === 0 ? (
                      <span className="tren-lencana tren-baru" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Tetap
                      </span>
                    ) : row.persen !== null ? (
                      <span
                        className="tren-lencana"
                        style={{
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          background: hemat ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: hemat ? "#10b981" : "#ef4444",
                        }}
                      >
                        {Number(row.persen) > 0 ? `▲ +${row.persen}%` : `▼ ${row.persen}%`}
                      </span>
                    ) : row.jmlIni > 0 && row.jmlLalu === 0 ? (
                      <span className="tren-lencana tren-baru" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Baru
                      </span>
                    ) : (
                      <span className="tren-lencana tren-baru" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        —
                      </span>
                    );

                  return (
                    <tr key={row.kategori} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "9px 6px", fontWeight: 600 }}>
                        {row.kategori}
                        <span className="tren-di-nama">{lencanaTren}</span>
                      </td>
                      <td data-label={`${tahunSebelumnya} (Rp)`} style={{ padding: "9px 6px", textAlign: "right", color: "var(--text-muted)" }}>
                        {row.jmlLalu > 0 ? <Nominal n={row.jmlLalu} /> : "—"}
                      </td>
                      <td data-label={`${tahunPilihan} (Rp)`} style={{ padding: "9px 6px", textAlign: "right", fontWeight: 700 }}>
                        {row.jmlIni > 0 ? <Nominal n={row.jmlIni} /> : "—"}
                      </td>
                      <td
                        data-label="Selisih (Rp)"
                        style={{
                          padding: "9px 6px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: sama ? "var(--text-muted)" : hemat ? "#10b981" : "#ef4444",
                        }}
                      >
                        {row.selisih > 0 ? (
                          <Nominal n={row.selisih} tanda="+" />
                        ) : row.selisih < 0 ? (
                          <Nominal n={Math.abs(row.selisih)} tanda="-" />
                        ) : (
                          "0"
                        )}
                      </td>
                      <td style={{ padding: "9px 6px", textAlign: "right" }}>{lencanaTren}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
