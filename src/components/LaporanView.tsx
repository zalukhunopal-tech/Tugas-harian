import React, { useState, useMemo } from "react";
import { Transaksi, NamaDana, ProfilPelapor, DataKegiatan } from "../types";
import { formatRupiah, formatAngka, hariIni, formatTanggalLengkap, PROFIL_PELAPOR_DEFAULT } from "../lib/constants";
import { BuktiPreviewModal } from "./BuktiPreviewModal";
import { hitungBatasLaporanFisik } from "../lib/ketentuanKegiatan";

interface LaporanViewProps {
  transaksi: Transaksi[];
  profilPelapor?: ProfilPelapor;
  daftarKegiatan?: DataKegiatan[];
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  transaksi,
  profilPelapor = PROFIL_PELAPOR_DEFAULT,
  daftarKegiatan = [],
}) => {
  // 1. Pilihan filter
  const [dana, setDana] = useState<string>("Dana Kegiatan"); // default Dana Kegiatan
  const [pilihKegiatanId, setPilihKegiatanId] = useState<string>("");
  
  // Default rentang tanggal: awal bulan ini sampai hari ini
  const tglSekarang = hariIni();
  const awalBulanIni = `${tglSekarang.slice(0, 7)}-01`;
  const [tglMulai, setTglMulai] = useState<string>(awalBulanIni);
  const [tglSelesai, setTglSelesai] = useState<string>(tglSekarang);

  const [filterKaitan, setFilterKaitan] = useState<string>("Semua");
  const [transaksiLihatBukti, setTransaksiLihatBukti] = useState<Transaksi | null>(null);

  // Daftar Kaitan Kegiatan dari transaksi yang pernah dipakai
  const daftarKaitanUnik = useMemo(() => {
    const set = new Set<string>();
    for (const t of transaksi) {
      if ((dana === "Semua" || t.dana === dana) && t.kaitan && t.kaitan.trim()) {
        set.add(t.kaitan.trim());
      }
    }
    return Array.from(set).sort();
  }, [transaksi, dana]);

  // Preset Rentang Tanggal Cepat
  const terapkanPreset = (tipe: "bulan-ini" | "bulan-lalu" | "tahun-ini" | "semua") => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (tipe === "bulan-ini") {
      setTglMulai(`${y}-${String(m + 1).padStart(2, "0")}-01`);
      setTglSelesai(hariIni());
    } else if (tipe === "bulan-lalu") {
      const dLalu = new Date(y, m - 1, 1);
      const akhirLalu = new Date(y, m, 0);
      setTglMulai(dLalu.toISOString().slice(0, 10));
      setTglSelesai(akhirLalu.toISOString().slice(0, 10));
    } else if (tipe === "tahun-ini") {
      setTglMulai(`${y}-01-01`);
      setTglSelesai(hariIni());
    } else if (tipe === "semua") {
      setTglMulai("2020-01-01");
      setTglSelesai(hariIni());
    }
  };

  const kegiatanTerpilih = useMemo(() => {
    return daftarKegiatan.find((k) => k.id === pilihKegiatanId);
  }, [daftarKegiatan, pilihKegiatanId]);

  const batasLaporanFisik = useMemo(() => {
    return kegiatanTerpilih?.tanggalSelesai
      ? hitungBatasLaporanFisik(kegiatanTerpilih.tanggalSelesai)
      : null;
  }, [kegiatanTerpilih]);

  // 2. Perhitungan Saldo Awal (sebelum tglMulai)
  const saldoAwal = useMemo(() => {
    return transaksi
      .filter((t) => {
        if (dana !== "Semua" && t.dana !== dana) return false;
        if (filterKaitan !== "Semua" && t.kaitan !== filterKaitan) return false;
        if (pilihKegiatanId) {
          const cocokId = t.kegiatanId === pilihKegiatanId;
          const cocokNama = kegiatanTerpilih && t.kaitan === kegiatanTerpilih.nama;
          if (!cocokId && !cocokNama) return false;
        }
        return t.tanggal < tglMulai;
      })
      .reduce((acc, t) => {
        return acc + (t.jenis === "pemasukan" ? t.jumlah : -t.jumlah);
      }, 0);
  }, [transaksi, dana, filterKaitan, tglMulai, pilihKegiatanId, kegiatanTerpilih]);

  // Transaksi dalam rentang tanggal dan kaitan
  const transaksiLaporan = useMemo(() => {
    return transaksi
      .filter((t) => {
        if (dana !== "Semua" && t.dana !== dana) return false;
        if (filterKaitan !== "Semua" && t.kaitan !== filterKaitan) return false;
        if (pilihKegiatanId) {
          const cocokId = t.kegiatanId === pilihKegiatanId;
          const cocokNama = kegiatanTerpilih && t.kaitan === kegiatanTerpilih.nama;
          if (!cocokId && !cocokNama) return false;
        }
        return t.tanggal >= tglMulai && t.tanggal <= tglSelesai;
      })
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [transaksi, dana, filterKaitan, tglMulai, tglSelesai, pilihKegiatanId, kegiatanTerpilih]);

  // Total Penerimaan & Pengeluaran dalam periode (Kategori Pindah Dana tidak dihitung)
  const totalPenerimaan = useMemo(() => {
    return transaksiLaporan
      .filter((t) => t.jenis === "pemasukan" && t.kategori !== "Pindah Dana")
      .reduce((sum, t) => sum + t.jumlah, 0);
  }, [transaksiLaporan]);

  const totalPengeluaran = useMemo(() => {
    return transaksiLaporan
      .filter((t) => t.jenis === "pengeluaran" && t.kategori !== "Pindah Dana")
      .reduce((sum, t) => sum + t.jumlah, 0);
  }, [transaksiLaporan]);

  // Arus bersih Pindah Dana untuk penghitungan saldo akhir per dana
  const netPindahDana = useMemo(() => {
    return transaksiLaporan
      .filter((t) => t.kategori === "Pindah Dana")
      .reduce((acc, t) => acc + (t.jenis === "pemasukan" ? t.jumlah : -t.jumlah), 0);
  }, [transaksiLaporan]);

  const saldoAkhir = saldoAwal + totalPenerimaan - totalPengeluaran + netPindahDana;

  // Breakdown Pengeluaran per Kategori (Kategori Pindah Dana tidak dihitung)
  const pengeluaranPerKategori = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transaksiLaporan) {
      if (t.jenis === "pengeluaran" && t.kategori !== "Pindah Dana") {
        map.set(t.kategori, (map.get(t.kategori) || 0) + t.jumlah);
      }
    }
    const arr = Array.from(map.entries()).map(([kategori, total]) => ({
      kategori,
      total,
      persen: totalPengeluaran > 0 ? (total / totalPengeluaran) * 100 : 0,
    }));
    return arr.sort((a, b) => b.total - a.total);
  }, [transaksiLaporan, totalPengeluaran]);

  // Peringatan transaksi pengeluaran tanpa bukti
  const pengeluaranTanpaBukti = useMemo(() => {
    return transaksiLaporan.filter(
      (t) => t.jenis === "pengeluaran" && (!t.bukti || t.bukti.length === 0)
    );
  }, [transaksiLaporan]);

  // 3. Unduh CSV / Excel
  const handleUnduhCSV = () => {
    const judul = dana === "Dana Kegiatan" ? "Laporan Penggunaan Dana Kegiatan" : `Laporan Keuangan (${dana})`;
    const barisMeta = [
      [judul],
      [`Periode: ${tglMulai} s.d. ${tglSelesai}`],
      [`Kaitan Kegiatan: ${filterKaitan}`],
      [`Tanggal Dibuat: ${new Date().toLocaleString("id-ID")}`],
      [],
      ["RINGKASAN LAPORAN"],
      ["Saldo Awal (Sebelum Periode)", saldoAwal],
      ["Total Penerimaan", totalPenerimaan],
      ["Total Pengeluaran", totalPengeluaran],
      ["Saldo Akhir", saldoAkhir],
      [],
      ["RINCIAN PENGELUARAN PER KATEGORI"],
      ["Kategori", "Jumlah (Rp)", "Persentase (%)"],
      ...pengeluaranPerKategori.map((k) => [
        `"${k.kategori.replace(/"/g, '""')}"`,
        k.total,
        `${k.persen.toFixed(1)}%`,
      ]),
      [],
      ["TABEL TRANSAKSI"],
      [
        "No",
        "Tanggal",
        "Uraian",
        "Kategori",
        "Dana",
        "Kaitan Kegiatan",
        "Pemasukan (Rp)",
        "Pengeluaran (Rp)",
        "Metode Bayar",
        "Bukti Transaksi (Ada/Tidak)",
        "Link Bukti Drive",
      ],
      ...transaksiLaporan.map((t, idx) => {
        const adaBukti = t.bukti && t.bukti.length > 0;
        const linkBukti = (t.bukti || []).map((b) => b.driveLink || "").filter(Boolean).join(" ; ");
        return [
          idx + 1,
          t.tanggal,
          `"${(t.deskripsi || "").replace(/"/g, '""')}"`,
          `"${(t.kategori || "").replace(/"/g, '""')}"`,
          `"${(t.dana || "").replace(/"/g, '""')}"`,
          `"${(t.kaitan || "").replace(/"/g, '""')}"`,
          t.jenis === "pemasukan" ? t.jumlah : "",
          t.jenis === "pengeluaran" ? t.jumlah : "",
          `"${(t.metode || "Tunai").replace(/"/g, '""')}"`,
          adaBukti ? `Ada (${t.bukti?.length || 0})` : "Belum Ada",
          `"${linkBukti.replace(/"/g, '""')}"`,
        ];
      }),
    ];

    const csvKonten = "\uFEFF" + barisMeta.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvKonten], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${dana.toLowerCase().replace(/\s+/g, "-")}-${tglMulai}-sd-${tglSelesai}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unduh PDF via Print View yang rapi
  const handleCetakPDF = () => {
    window.print();
  };

  const judulLaporan =
    dana === "Dana Kegiatan"
      ? "Laporan Penggunaan Dana Kegiatan"
      : `Laporan Keuangan ${dana}`;

  return (
    <div className="laporan-container" style={{ width: "100%" }}>
      {/* ===== KARTU FILTER LAPORAN ===== */}
      <div className="card no-print" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>📋 Parameter Laporan</h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              Saring pembukuan berdasarkan jenis dana, rentang tanggal, dan kaitan kegiatan.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCetakPDF}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "8px 14px" }}
            >
              📄 Unduh PDF / Cetak
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleUnduhCSV}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "8px 14px" }}
            >
              📊 Unduh Excel/CSV
            </button>
          </div>
        </div>

        {/* Pilihan Dana */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
            Pilih Dana
          </label>
          <div className="filter-chips" style={{ margin: 0 }}>
            <button
              type="button"
              className="chip"
              data-dana="Dana Kegiatan"
              aria-checked={dana === "Dana Kegiatan"}
              onClick={() => setDana("Dana Kegiatan")}
            >
              Dana Kegiatan
            </button>
            <button
              type="button"
              className="chip"
              data-dana="Dana Pribadi"
              aria-checked={dana === "Dana Pribadi"}
              onClick={() => setDana("Dana Pribadi")}
            >
              Dana Pribadi
            </button>
            <button
              type="button"
              className="chip"
              data-dana="Semua"
              aria-checked={dana === "Semua"}
              onClick={() => setDana("Semua")}
            >
              Semua Dana
            </button>
          </div>
        </div>

        {/* Rentang Tanggal & Preset */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label htmlFor="lap-tgl-mulai" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
              Dari Tanggal
            </label>
            <input
              type="date"
              id="lap-tgl-mulai"
              value={tglMulai}
              onChange={(e) => setTglMulai(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label htmlFor="lap-tgl-selesai" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
              Sampai Tanggal
            </label>
            <input
              type="date"
              id="lap-tgl-selesai"
              value={tglSelesai}
              onChange={(e) => setTglSelesai(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
        </div>

        {/* Preset Cepat Tanggal */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginRight: "4px" }}>Periode cepat:</span>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("bulan-ini")}>
            Bulan Ini
          </button>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("bulan-lalu")}>
            Bulan Lalu
          </button>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("tahun-ini")}>
            Tahun Ini
          </button>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("semua")}>
            Sepanjang Waktu
          </button>
        </div>

        {/* Kaitan Kegiatan / Kegiatan Lapangan */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "6px" }}>
          {dana === "Dana Kegiatan" && daftarKegiatan.length > 0 && (
            <div>
              <label htmlFor="lap-kegiatan-select" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
                Pilih Kegiatan Lapangan
              </label>
              <select
                id="lap-kegiatan-select"
                value={pilihKegiatanId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPilihKegiatanId(id);
                  const kg = daftarKegiatan.find((k) => k.id === id);
                  if (kg) {
                    setTglMulai(kg.tanggalMulai);
                    setTglSelesai(kg.tanggalSelesai);
                  }
                }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
              >
                <option value="">Semua Kegiatan Lapangan</option>
                {daftarKegiatan.map((k) => (
                  <option key={k.id} value={k.id}>
                    📌 {k.nama} ({k.lokasi || "Lokasi tidak dicatat"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="lap-kaitan" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
              Kaitan Kegiatan / Sumber
            </label>
            <select
              id="lap-kaitan"
              value={filterKaitan}
              onChange={(e) => setFilterKaitan(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <option value="Semua">Semua Kaitan ({daftarKaitanUnik.length} ditemukan)</option>
              {daftarKaitanUnik.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ===== LEMBAR LAPORAN RESMI (TAMPIL DI LAYAR & TERCETAK RAPI DI PDF) ===== */}
      <div className="card printable-report" style={{ padding: "24px", marginBottom: "24px" }}>
        {/* KOP / JUDUL LAPORAN */}
        <div className="report-header" style={{ borderBottom: "2px solid var(--border)", paddingBottom: "16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h1 style={{ margin: "0 0 6px 0", fontSize: "1.35rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {judulLaporan}
              </h1>
              <div style={{ fontSize: "0.88rem", color: "var(--text)" }}>
                <strong>Periode Kegiatan:</strong> {formatTanggalLengkap(tglMulai)} s.d. {formatTanggalLengkap(tglSelesai)}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "2px" }}>
                <strong>Kaitan / Agenda:</strong> {kegiatanTerpilih ? kegiatanTerpilih.nama : filterKaitan === "Semua" ? "Seluruh Kegiatan" : filterKaitan}
                {kegiatanTerpilih?.lokasi && ` · Lokasi: ${kegiatanTerpilih.lokasi}`}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "0.78rem", color: "var(--muted)" }}>
              <div>Dokumen Laporan Pertanggungjawaban (SPJ)</div>
              <div>Dicetak: {new Date().toLocaleDateString("id-ID")}</div>
            </div>
          </div>
        </div>

        {/* Profil Pelapor & Batas Penyerahan Laporan Fisik */}
        {dana === "Dana Kegiatan" && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
              border: "1.5px solid var(--accent)",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", fontWeight: 700 }}>
                Pelapor / Penanggung Jawab Lapangan:
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: "2px" }}>
                {profilPelapor.nama}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {profilPelapor.jabatan} · {profilPelapor.lembaga} (Proyek: {profilPelapor.proyek})
              </div>
            </div>

            {batasLaporanFisik && (
              <div
                style={{
                  textAlign: "right",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  background: batasLaporanFisik.hariTersisa < 0 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
                  border: `1.5px solid ${batasLaporanFisik.hariTersisa < 0 ? "var(--keluar)" : "#10b981"}`,
                }}
              >
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>
                  Batas Penyerahan SPJ Fisik (+14 Hari)
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.98rem", color: batasLaporanFisik.hariTersisa < 0 ? "var(--keluar)" : "#10b981" }}>
                  {batasLaporanFisik.formatTeks}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {batasLaporanFisik.hariTersisa < 0
                    ? `Terlewat ${Math.abs(batasLaporanFisik.hariTersisa)} hari lalu`
                    : `${batasLaporanFisik.hariTersisa} hari tersisa`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PERINGATAN TRANSAKSI TANPA BUKTI */}
        {pengeluaranTanpaBukti.length > 0 && (
          <div
            className="no-print"
            style={{
              marginBottom: "20px",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1.5px solid #f59e0b",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>⚠️</span>
            <div style={{ fontSize: "0.86rem" }}>
              <strong>Perhatian Kelengkapan Dokumen:</strong> Terdapat{" "}
              <strong>{pengeluaranTanpaBukti.length} transaksi pengeluaran</strong> dalam laporan ini yang{" "}
              <strong>belum memiliki bukti nota/kuitansi</strong>. Pastikan melampirkan bukti fisik demi akuntabilitas pertanggungjawaban.
            </div>
          </div>
        )}

        {/* KARTU RINGKASAN SALDO & ARUS KAS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>Saldo Awal (Sebelum Periode)</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "4px", color: saldoAwal < 0 ? "var(--danger)" : "var(--text)" }}>
              {formatRupiah(saldoAwal)}
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", background: "rgba(34, 197, 94, 0.08)" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--masuk)", fontWeight: 600 }}>Total Penerimaan (+)</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "4px", color: "var(--masuk)" }}>
              +{formatRupiah(totalPenerimaan)}
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", background: "rgba(239, 68, 68, 0.08)" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--keluar)", fontWeight: 600 }}>Total Pengeluaran (-)</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "4px", color: "var(--keluar)" }}>
              -{formatRupiah(totalPengeluaran)}
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "10px", border: "2px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700 }}>Saldo Akhir Periode</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "4px", color: saldoAkhir < 0 ? "var(--danger)" : "var(--accent)" }}>
              {formatRupiah(saldoAkhir)}
            </div>
          </div>
        </div>

        {/* REKAPITULASI PENGELUARAN PER KATEGORI */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 10px 0", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
            Rincian Pengeluaran per Kategori
          </h3>
          {pengeluaranPerKategori.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>Tidak ada pengeluaran dalam periode ini.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" }}>
              {pengeluaranPerKategori.map((k) => (
                <div
                  key={k.kategori}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    fontSize: "0.85rem",
                  }}
                >
                  <span>
                    <strong>{k.kategori}</strong>{" "}
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>({k.persen.toFixed(1)}%)</span>
                  </span>
                  <span style={{ fontWeight: 700, color: "var(--keluar)" }}>{formatRupiah(k.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TABEL DETAIL TRANSAKSI */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              Daftar Rincian Transaksi ({transaksiLaporan.length})
            </h3>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Urut tanggal kronologis
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "8px 10px", width: "40px" }}>No</th>
                  <th style={{ padding: "8px 10px", width: "95px" }}>Tanggal</th>
                  <th style={{ padding: "8px 10px" }}>Uraian &amp; Kaitan</th>
                  <th style={{ padding: "8px 10px", width: "120px" }}>Kategori</th>
                  <th style={{ padding: "8px 10px", width: "90px" }}>Metode</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", width: "110px" }}>Masuk (Rp)</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", width: "110px" }}>Keluar (Rp)</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", width: "85px" }}>Bukti</th>
                </tr>
              </thead>
              <tbody>
                {transaksiLaporan.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "20px", textAlign: "center", color: "var(--muted)" }}>
                      Tidak ada transaksi pada parameter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  transaksiLaporan.map((t, idx) => {
                    const adaBukti = Boolean(t.bukti && t.bukti.length > 0);
                    return (
                      <tr
                        key={t.id || idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 1 ? "rgba(0,0,0,0.02)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "8px 10px" }}>{idx + 1}</td>
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{t.tanggal}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{t.deskripsi}</div>
                          {t.detailKegiatan?.keteranganLaporan && (
                            <div style={{ fontSize: "0.78rem", color: "var(--text)", fontStyle: "italic", marginTop: "2px" }}>
                              "{t.detailKegiatan.keteranganLaporan}"
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px", fontSize: "0.72rem" }}>
                            {t.detailKegiatan?.jenisBukti && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.06)", border: "1px solid var(--border)", fontWeight: 600 }}>
                                📄 {t.detailKegiatan.jenisBukti}
                              </span>
                            )}
                            {t.detailKegiatan?.rincian && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 700 }}>
                                🔢 {t.detailKegiatan.rincian.banyaknya} {t.detailKegiatan.rincian.satuan} × {formatRupiah(t.detailKegiatan.rincian.hargaSatuan)}
                              </span>
                            )}
                            {t.detailKegiatan?.perluSuratJustifikasi && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(239,68,68,0.12)", color: "var(--keluar)", fontWeight: 700 }}>
                                ⚠️ Justifikasi: {t.detailKegiatan.alasanJustifikasi || "Perlu surat"}
                              </span>
                            )}
                            {t.detailKegiatan?.transportasi?.moda && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                                🚗 {t.detailKegiatan.transportasi.dari} → {t.detailKegiatan.transportasi.ke} ({t.detailKegiatan.transportasi.moda})
                              </span>
                            )}
                            {t.detailKegiatan?.rentalKendaraan?.jenisMerk && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                                🚙 {t.detailKegiatan.rentalKendaraan.jenisMerk} ({t.detailKegiatan.rentalKendaraan.noPolisi}) · {t.detailKegiatan.rentalKendaraan.jumlahHari || 1} hari
                              </span>
                            )}
                            {t.detailKegiatan?.bbm?.jarakTempuh && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                                ⛽ {t.detailKegiatan.bbm.jarakTempuh} km (KM: {t.detailKegiatan.bbm.kmSaatIsi})
                              </span>
                            )}
                            {t.detailKegiatan?.akomodasi?.lokasi && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                                🏨 {t.detailKegiatan.akomodasi.lokasi} ({t.detailKegiatan.akomodasi.jumlahMalam || 1} malam)
                              </span>
                            )}
                            {t.detailKegiatan?.konsumsi?.jumlahPeserta && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                                🍽️ {t.detailKegiatan.konsumsi.jumlahPeserta} peserta
                              </span>
                            )}
                            {t.detailKegiatan?.honorarium?.namaPenerima && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                                💼 {t.detailKegiatan.honorarium.namaPenerima} ({t.detailKegiatan.honorarium.isPNS ? "PNS" : "Non-PNS"})
                              </span>
                            )}
                            {t.kaitan && (
                              <span style={{ color: "var(--muted)" }}>
                                📌 {t.kaitan}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px" }}>{t.kategori}</td>
                        <td style={{ padding: "8px 10px" }}>{t.metode || "Tunai"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--masuk)", fontWeight: t.jenis === "pemasukan" ? 700 : 400 }}>
                          {t.jenis === "pemasukan" ? formatAngka(t.jumlah) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--keluar)", fontWeight: t.jenis === "pengeluaran" ? 700 : 400 }}>
                          {t.jenis === "pengeluaran" ? formatAngka(t.jumlah) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          {adaBukti ? (
                            <button
                              type="button"
                              className="btn-small no-print"
                              style={{
                                padding: "2px 6px",
                                fontSize: "0.75rem",
                                borderRadius: "4px",
                                background: "rgba(34, 197, 94, 0.15)",
                                color: "#16a34a",
                                border: "1px solid #16a34a",
                                cursor: "pointer",
                              }}
                              onClick={() => setTransaksiLihatBukti(t)}
                              title="Lihat berkas bukti"
                            >
                              📎 Ada ({t.bukti?.length})
                            </button>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>—</span>
                          )}
                          <span className="print-only">
                            {adaBukti ? `Ada (${t.bukti?.length})` : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--surface)", borderTop: "2px solid var(--border)", fontWeight: 800 }}>
                  <td colSpan={5} style={{ padding: "10px", textAlign: "right" }}>Total Dalam Periode:</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "var(--masuk)" }}>
                    {formatAngka(totalPenerimaan)}
                  </td>
                  <td style={{ padding: "10px", textAlign: "right", color: "var(--keluar)" }}>
                    {formatAngka(totalPengeluaran)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* TANDA TANGAN PERTANGGUNGJAWABAN (KHUSUS CETAK PDF) */}
        <div
          className="print-only"
          style={{
            marginTop: "40px",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            textAlign: "center",
            fontSize: "0.85rem",
          }}
        >
          <div>
            <p>Mengetahui / Menyetujui,</p>
            <div style={{ height: "60px" }}></div>
            <p style={{ fontWeight: 700, textDecoration: "underline" }}>( Koordinator Lapangan )</p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>{profilPelapor.lembaga}</p>
          </div>
          <div>
            <p>Pelapor / Pengelola Dana,</p>
            <div style={{ height: "60px" }}></div>
            <p style={{ fontWeight: 700, textDecoration: "underline" }}>{profilPelapor.nama}</p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
              {profilPelapor.jabatan} · Proyek {profilPelapor.proyek}
            </p>
          </div>
        </div>
      </div>

      {/* Modal Preview Bukti saat diklik dari tabel laporan */}
      <BuktiPreviewModal
        transaksi={transaksiLihatBukti}
        isOpen={Boolean(transaksiLihatBukti)}
        onClose={() => setTransaksiLihatBukti(null)}
      />
    </div>
  );
};
