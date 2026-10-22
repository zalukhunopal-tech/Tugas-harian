import React, { useState } from "react";
import { Transaksi, NamaDana, AnggaranKategoriMap } from "../types";
import { formatRupiah, formatAngka, namaBulan, namaBulanPendek, KATEGORI } from "../lib/constants";
import { LaporanView } from "./LaporanView";

interface GrafikViewProps {
  transaksi: Transaksi[];
  bulanTerpilih: string;
  anggaran: number;
  onSetAnggaran: (nilai: number) => void;
  anggaranKategori?: AnggaranKategoriMap;
  onSetAnggaranKategori?: (dana: NamaDana, kategori: string, nilai: number) => void;
}

export const GrafikView: React.FC<GrafikViewProps> = ({
  transaksi,
  bulanTerpilih,
  anggaran,
  onSetAnggaran,
  anggaranKategori = { "Dana Pribadi": {}, "Dana Kegiatan": {} },
  onSetAnggaranKategori,
}) => {
  const [subTab, setSubTab] = useState<"grafik" | "laporan">("grafik");
  const [inputBatas, setInputBatas] = useState(anggaran > 0 ? String(anggaran) : "");

  // Tab pemilihan dana untuk anggaran kategori
  const [danaAnggaran, setDanaAnggaran] = useState<NamaDana>("Dana Pribadi");
  const [kategoriEdit, setKategoriEdit] = useState<string | null>(null);
  const [inputBatasKat, setInputBatasKat] = useState<string>("");

  // 6 bulan terakhir sampai bulan terpilih (Kategori Pindah Dana TIDAK dihitung)
  const [th, bl] = bulanTerpilih.split("-").map(Number);
  const daftarBulan: Array<{ kunci: string; label: string; masuk: number; keluar: number }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(th, bl - 1 - i, 1);
    const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = transaksi.filter((t) => t.tanggal.startsWith(kunci) && t.kategori !== "Pindah Dana");
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

  // Kategori bulan terpilih (Kategori Pindah Dana TIDAK dihitung)
  const [thBln, blBln] = bulanTerpilih.split("-").map(Number);
  const namaBulanPenuh = namaBulan.format(new Date(thBln, blBln - 1, 1));
  const transaksiBulan = transaksi.filter(
    (t) => t.tanggal.startsWith(bulanTerpilih) && t.kategori !== "Pindah Dana"
  );

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

  const handleSimpanBatasKategori = (kat: string) => {
    const val = Number(inputBatasKat) || 0;
    if (onSetAnggaranKategori) {
      onSetAnggaranKategori(danaAnggaran, kat, val);
    }
    setKategoriEdit(null);
    setInputBatasKat("");
  };

  const daftarKategoriPengeluaran = KATEGORI[danaAnggaran]?.pengeluaran || [];

  return (
    <section className="view" id="view-grafik" data-view="grafik">
      <div className="filter-chips no-print" style={{ marginBottom: "16px" }} role="tablist">
        <button
          type="button"
          className="chip"
          aria-checked={subTab === "grafik"}
          role="tab"
          onClick={() => setSubTab("grafik")}
          style={{ minHeight: "44px", fontWeight: 700 }}
        >
          📊 Grafik &amp; Anggaran
        </button>
        <button
          type="button"
          className="chip"
          aria-checked={subTab === "laporan"}
          role="tab"
          onClick={() => setSubTab("laporan")}
          style={{ minHeight: "44px", fontWeight: 700 }}
        >
          📋 Laporan Dana Kegiatan
        </button>
      </div>

      {subTab === "laporan" ? (
        <LaporanView transaksi={transaksi} />
      ) : (
        <>
          <div className="card card-tren">
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

      <div className="card card-ringkasan-kategori">
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

      {/* Anggaran Bulanan per Kategori untuk Tiap Dana (Requirement 3) */}
      <div className="card card-anggaran-kategori" style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          <h2 style={{ margin: 0 }}>Anggaran bulanan per kategori</h2>
          <div className="filter-chips" style={{ margin: 0 }} role="radiogroup" aria-label="Pilih dana anggaran">
            <button
              type="button"
              className="chip"
              aria-checked={danaAnggaran === "Dana Pribadi"}
              role="radio"
              onClick={() => setDanaAnggaran("Dana Pribadi")}
              style={{ padding: "4px 12px", fontSize: "0.82rem" }}
            >
              Dana Pribadi
            </button>
            <button
              type="button"
              className="chip"
              aria-checked={danaAnggaran === "Dana Kegiatan"}
              role="radio"
              onClick={() => setDanaAnggaran("Dana Kegiatan")}
              style={{ padding: "4px 12px", fontSize: "0.82rem" }}
            >
              Dana Kegiatan
            </button>
          </div>
        </div>

        <p className="help" style={{ margin: "0 0 16px", fontSize: "0.82rem" }}>
          Atur batas belanja per kategori untuk <strong>{danaAnggaran}</strong> pada bulan <strong>{namaBulanPenuh}</strong>.
          Bilah progres berubah <span style={{ color: "#f59e0b", fontWeight: 700 }}>kuning saat ≥80%</span> dan{" "}
          <span style={{ color: "#ef4444", fontWeight: 700 }}>merah saat melewati batas</span>. Data otomatis tersimpan ke <em>Pengaturan.json</em> di Google Drive.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {daftarKategoriPengeluaran.map((kat) => {
            const terpakai = transaksi
              .filter(
                (t) =>
                  t.dana === danaAnggaran &&
                  t.tanggal.startsWith(bulanTerpilih) &&
                  t.kategori === kat &&
                  t.jenis === "pengeluaran"
              )
              .reduce((sum, t) => sum + t.jumlah, 0);

            const batas = anggaranKategori[danaAnggaran]?.[kat] || 0;
            const persen = batas > 0 ? (terpakai / batas) * 100 : 0;
            const isOver = batas > 0 && terpakai > batas;
            const isWarning = batas > 0 && !isOver && persen >= 80;

            let barColor = "var(--accent, #38bdf8)";
            if (isOver) {
              barColor = "#ef4444"; // Merah saat melewati batas
            } else if (isWarning) {
              barColor = "#f59e0b"; // Kuning saat ≥80%
            }

            const isEditing = kategoriEdit === kat;

            return (
              <div
                key={kat}
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: isOver
                    ? "color-mix(in srgb, #ef4444 8%, var(--surface))"
                    : isWarning
                    ? "color-mix(in srgb, #f59e0b 8%, var(--surface))"
                    : "var(--surface)",
                  border: isOver
                    ? "1.5px solid #ef4444"
                    : isWarning
                    ? "1.5px solid #f59e0b"
                    : "1px solid var(--border)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{kat}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.84rem" }}>
                      <strong>{formatRupiah(terpakai)}</strong>
                      <span style={{ color: "var(--text-muted)" }}>
                        {" / "}
                        {batas > 0 ? formatRupiah(batas) : "Tanpa batas"}
                      </span>
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => {
                          setKategoriEdit(kat);
                          setInputBatasKat(batas > 0 ? String(batas) : "");
                        }}
                        style={{ fontSize: "0.74rem", padding: "2px 8px" }}
                      >
                        {batas > 0 ? "Ubah" : "+ Atur"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bilah Progres */}
                {batas > 0 ? (
                  <div>
                    <div
                      style={{
                        height: "9px",
                        borderRadius: "999px",
                        background: "var(--background)",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, persen)}%`,
                          height: "100%",
                          background: barColor,
                          transition: "width 0.3s ease, background 0.3s ease",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "0.75rem" }}>
                      <span style={{ color: barColor, fontWeight: 700 }}>
                        {isOver
                          ? `⚠️ Melewati batas ${formatRupiah(terpakai - batas)} (${Math.round(persen)}%)`
                          : isWarning
                          ? `⚡ Waspada mencapai ${Math.round(persen)}% (Sisa ${formatRupiah(batas - terpakai)})`
                          : `${Math.round(persen)}% terpakai (Sisa ${formatRupiah(batas - terpakai)})`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    Belum ada batas anggaran bulanan untuk kategori ini.
                  </span>
                )}

                {/* Form Edit Inline Batas Anggaran Kategori */}
                {isEditing && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSimpanBatasKategori(kat);
                    }}
                    style={{
                      marginTop: "10px",
                      paddingTop: "8px",
                      borderTop: "1px dashed var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <label style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                      Batas bulanan (Rp):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Contoh: 1500000"
                      value={inputBatasKat}
                      onChange={(e) => setInputBatasKat(e.target.value)}
                      autoFocus
                      style={{ width: "140px", padding: "5px 8px", fontSize: "0.82rem" }}
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ fontSize: "0.76rem", padding: "5px 12px" }}
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setKategoriEdit(null);
                        setInputBatasKat("");
                      }}
                      style={{ fontSize: "0.76rem", padding: "5px 10px" }}
                    >
                      Batal
                    </button>
                    {batas > 0 && (
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => {
                          if (onSetAnggaranKategori) {
                            onSetAnggaranKategori(danaAnggaran, kat, 0);
                          }
                          setKategoriEdit(null);
                        }}
                        style={{ fontSize: "0.74rem", color: "var(--keluar)", marginLeft: "auto" }}
                      >
                        Hapus Batas
                      </button>
                    )}
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}
    </section>
  );
};
