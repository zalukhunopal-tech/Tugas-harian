import React, { useState, useMemo, useRef } from "react";
import { Transaksi, NamaDana, ItemHutangPiutang, ItemPenyusutan, TargetTabunganItem } from "../types";
import { BannerUmurBarang, LencanaUmur } from "./UmurBarangUI";
import { hitungPenyusutan } from "../lib/penyusutan";
import {
  formatRupiah,
  formatAngka,
  hariIni,
  namaBulan,
  namaBulanPendek,
  namaHari,
  METODE_BAYAR,
  KATEGORI,
  labelKategori,
} from "../lib/constants";
import { BuktiPreviewModal } from "./BuktiPreviewModal";
import { UtangPiutangView } from "./UtangPiutangView";
import { TargetTabunganView } from "./TargetTabunganView";
import { UbinKategori, ChipKategori } from "../lib/kategoriIcon";
import { LembarDetailTransaksi } from "./LembarDetailTransaksi";
import { Edit2, Trash2 } from "lucide-react";
import { pesanHapusPerdiem } from "../lib/perdiemOtomatis";
import { hitungTotalHarian } from "../lib/totalHarian";

interface RiwayatViewProps {
  transaksi: Transaksi[];
  bulanTerpilih: string;
  anggaran: number;
  syncStatus?: { pesan: string; status: "kerja" | "sukses" | "gagal" | "idle" | "tunggu" } | null;
  onEdit: (t: Transaksi) => void;
  onDelete: (id: string) => void;
  onGeserBulan: (delta: number) => void;
  onBukaTransaksiBerulang?: () => void;
  jumlahJatuhTempo?: number;
  onToggleStatusTalangan?: (id: string) => void;
  daftarUtangPiutang?: ItemHutangPiutang[];
  onSimpanUtangPiutang?: (item: ItemHutangPiutang) => void;
  onHapusUtangPiutang?: (id: string) => void;
  daftarTargetTabungan?: TargetTabunganItem[];
  onSimpanTargetTabungan?: (item: TargetTabunganItem) => void;
  onHapusTargetTabungan?: (id: string) => void;
  /** Pantauan umur barang: banner peringatan di dashboard dan lencana pada transaksi pembeliannya. */
  daftarPenyusutan?: ItemPenyusutan[];
  onBukaUmurBarang?: () => void;
  onBukaTambahTabungan?: (targetId: string, targetNama: string) => void;
  subTabAwal?: "transaksi" | "utang_piutang" | "target_tabungan";
  googleToken?: string;
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
  onToggleStatusTalangan,
  daftarUtangPiutang = [],
  onSimpanUtangPiutang,
  onHapusUtangPiutang,
  daftarTargetTabungan = [],
  onSimpanTargetTabungan,
  onHapusTargetTabungan,
  daftarPenyusutan = [],
  onBukaUmurBarang,
  onBukaTambahTabungan,
  subTabAwal = "transaksi",
  googleToken,
}) => {
  const [subTab, setSubTab] = useState<"transaksi" | "utang_piutang" | "target_tabungan">(subTabAwal);
  const [transaksiDetail, setTransaksiDetail] = useState<Transaksi | null>(null);
  const [menuLongPress, setMenuLongPress] = useState<Transaksi | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  const handleTouchStart = (item: Transaksi) => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
      setMenuLongPress(item);
    }, 500);
  };

  const handleTouchEndOrMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  // Filter States
  const [filterDana, setFilterDana] = useState<string>("");
  const [cariTeks, setCariTeks] = useState<string>("");
  const [filterKategori, setFilterKategori] = useState<string>("");
  const [filterMetode, setFilterMetode] = useState<string>("");
  const [filterTglMulai, setFilterTglMulai] = useState<string>("");
  const [filterTglSelesai, setFilterTglSelesai] = useState<string>("");
  const [filterStatusTalangan, setFilterStatusTalangan] = useState<string>("");
  const [panelSaringBuka, setPanelSaringBuka] = useState<boolean>(false);

  const [talanganBuka, setTalanganBuka] = useState<boolean>(true);
  const [transaksiLihatBukti, setTransaksiLihatBukti] = useState<Transaksi | null>(null);

  // Daftar Kategori Unik dari semua transaksi & konstanta
  const daftarKategoriTersedia = useMemo(() => {
    const set = new Set<string>();
    // Tambahkan dari konstanta
    KATEGORI["Dana Pribadi"].pengeluaran.forEach((k) => set.add(k));
    KATEGORI["Dana Pribadi"].pemasukan.forEach((k) => set.add(k));
    KATEGORI["Dana Kegiatan"].pengeluaran.forEach((k) => set.add(k));
    KATEGORI["Dana Kegiatan"].pemasukan.forEach((k) => set.add(k));
    set.add("Pindah Dana");
    // Tambahkan dari data transaksi nyata
    transaksi.forEach((t) => {
      if (t.kategori && t.kategori.trim()) set.add(t.kategori.trim());
    });
    return Array.from(set).sort();
  }, [transaksi]);

  // Saldo keseluruhan per dana (sepanjang waktu - Pindah Dana ikut memengaruhi saldo per dana)
  const hitungSaldoKumulatif = (dana: NamaDana) => {
    const trx = transaksi.filter((p) => p.dana === dana);
    const masuk = trx.filter((p) => p.jenis === "pemasukan").reduce((s, p) => s + p.jumlah, 0);
    const keluar = trx.filter((p) => p.jenis === "pengeluaran").reduce((s, p) => s + p.jumlah, 0);
    return masuk - keluar;
  };

  // Arus bulan ini per dana (Kategori Pindah Dana TIDAK dihitung sebagai pemasukan/pengeluaran)
  const hitungArusBulan = (dana: NamaDana) => {
    const trx = transaksi.filter(
      (p) => p.dana === dana && p.tanggal.startsWith(bulanTerpilih) && p.kategori !== "Pindah Dana"
    );
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

  // Daftar talangan yang belum diganti (sepanjang waktu)
  const daftarTalanganBelum = useMemo(() => {
    return transaksi.filter((t) => t.isTalangan && t.statusTalangan !== "sudah_diganti");
  }, [transaksi]);

  const totalTalanganBelum = useMemo(() => {
    return daftarTalanganBelum.reduce((sum, t) => sum + t.jumlah, 0);
  }, [daftarTalanganBelum]);

  // Apakah saringan kustom sedang aktif?
  const saringanAktif = Boolean(
    cariTeks.trim() ||
      filterKategori ||
      filterMetode ||
      filterTglMulai ||
      filterTglSelesai ||
      filterStatusTalangan ||
      filterDana
  );

  const resetSemuaSaringan = () => {
    setCariTeks("");
    setFilterKategori("");
    setFilterMetode("");
    setFilterTglMulai("");
    setFilterTglSelesai("");
    setFilterStatusTalangan("");
    setFilterDana("");
  };

  // Filter Transaksi berdasarkan pencarian dan parameter
  const transaksiDifilter = useMemo(() => {
    const q = cariTeks.trim().toLowerCase();

    return transaksi.filter((t) => {
      // 1. Saring Dana
      if (filterDana && t.dana !== filterDana) return false;

      // 2. Saring Kategori
      if (filterKategori && t.kategori !== filterKategori) return false;

      // 3. Saring Metode Bayar
      if (filterMetode && t.metode !== filterMetode) return false;

      // 4. Saring Status Talangan
      if (filterStatusTalangan === "semua_talangan" && !t.isTalangan) return false;
      if (filterStatusTalangan === "belum_diganti" && (!t.isTalangan || t.statusTalangan === "sudah_diganti")) {
        return false;
      }
      if (filterStatusTalangan === "sudah_diganti" && (!t.isTalangan || t.statusTalangan !== "sudah_diganti")) {
        return false;
      }

      // 5. Saring Rentang Tanggal atau Bulan Terpilih
      if (filterTglMulai || filterTglSelesai) {
        if (filterTglMulai && t.tanggal < filterTglMulai) return false;
        if (filterTglSelesai && t.tanggal > filterTglSelesai) return false;
      } else {
        if (!t.tanggal.startsWith(bulanTerpilih)) return false;
      }

      // 6. Kotak Pencarian: Uraian, Catatan, Sumber/Tujuan, Kaitan Kegiatan, dan Keterangan Talangan
      if (q) {
        const teksDeskripsi = (t.deskripsi || "").toLowerCase();
        const teksCatatan = (t.catatan || "").toLowerCase();
        const teksKaitan = (t.kaitan || "").toLowerCase();
        const teksTalangan = (t.talanganUntuk || "").toLowerCase();

        const cocok =
          teksDeskripsi.includes(q) ||
          teksCatatan.includes(q) ||
          teksKaitan.includes(q) ||
          teksTalangan.includes(q);

        if (!cocok) return false;
      }

      return true;
    });
  }, [
    transaksi,
    filterDana,
    filterKategori,
    filterMetode,
    filterStatusTalangan,
    filterTglMulai,
    filterTglSelesai,
    cariTeks,
    bulanTerpilih,
  ]);

  // Total Pemasukan dan Pengeluaran hasil saringan (Kategori Pindah Dana TIDAK dihitung)
  const totalSaringMasuk = useMemo(() => {
    return transaksiDifilter
      .filter((t) => t.jenis === "pemasukan" && t.kategori !== "Pindah Dana")
      .reduce((s, t) => s + t.jumlah, 0);
  }, [transaksiDifilter]);

  const totalSaringKeluar = useMemo(() => {
    return transaksiDifilter
      .filter((t) => t.jenis === "pengeluaran" && t.kategori !== "Pindah Dana")
      .reduce((s, t) => s + t.jumlah, 0);
  }, [transaksiDifilter]);

  // Kelompokkan per tanggal (descending)
  const perHariMap = new Map<string, Transaksi[]>();
  for (const t of transaksiDifilter) {
    const list = perHariMap.get(t.tanggal) || [];
    list.push(t);
    perHariMap.set(t.tanggal, list);
  }
  const daftarTanggal = Array.from(perHariMap.keys()).sort((a, b) => b.localeCompare(a));

  // Anggaran pengeluaran hari ini (Kategori Pindah Dana tidak dihitung)
  const tglHariIni = hariIni();
  const keluarHariIni = transaksi
    .filter((t) => t.tanggal === tglHariIni && t.jenis === "pengeluaran" && t.kategori !== "Pindah Dana")
    .reduce((s, t) => s + t.jumlah, 0);

  const persenAnggaran = anggaran > 0 ? (keluarHariIni / anggaran) * 100 : 0;
  const lebih = keluarHariIni > anggaran;

  // Nama bulan lalu untuk tombol
  const [th, bl] = bulanTerpilih.split("-").map(Number);
  const tglBulanLalu = new Date(th, bl - 2, 1);
  const labelBulanLalu = `${namaBulanPendek.format(tglBulanLalu)} ${tglBulanLalu.getFullYear()} ←`;

  const jumlahOverdueUtang = useMemo(() => {
    const today = hariIni();
    return (daftarUtangPiutang || []).filter((item) => {
      const totalCicilan = (item.cicilan || []).reduce((s, c) => s + c.jumlah, 0);
      const sisa = Math.max(0, item.jumlah - totalCicilan);
      return sisa > 0 && item.jatuhTempo < today;
    }).length;
  }, [daftarUtangPiutang]);

  return (
    <section className="view" id="view-riwayat" data-view="riwayat">
      {/* Sub-Tabs Navigasi Riwayat: Transaksi, Utang & Piutang, Target Tabungan */}
      <div className="filter-chips no-print" style={{ marginBottom: "16px" }} role="tablist">
        <button
          type="button"
          className="chip"
          aria-checked={subTab === "transaksi"}
          role="tab"
          onClick={() => setSubTab("transaksi")}
          style={{ minHeight: "44px", fontWeight: 700 }}
        >
          📝 Riwayat Transaksi
        </button>
        <button
          type="button"
          className="chip"
          aria-checked={subTab === "utang_piutang"}
          role="tab"
          onClick={() => setSubTab("utang_piutang")}
          style={{
            minHeight: "44px",
            fontWeight: 700,
            borderColor: jumlahOverdueUtang > 0 ? "#ef4444" : undefined,
          }}
        >
          💳 Utang &amp; Piutang
          {jumlahOverdueUtang > 0 && (
            <span
              style={{
                marginLeft: "6px",
                padding: "2px 7px",
                borderRadius: "10px",
                background: "#ef4444",
                color: "#fff",
                fontSize: "0.75rem",
              }}
            >
              {jumlahOverdueUtang}
            </span>
          )}
        </button>
        <button
          type="button"
          className="chip"
          aria-checked={subTab === "target_tabungan"}
          role="tab"
          onClick={() => setSubTab("target_tabungan")}
          style={{ minHeight: "44px", fontWeight: 700 }}
        >
          🎯 Target Tabungan {daftarTargetTabungan.length > 0 ? `(${daftarTargetTabungan.length})` : ""}
        </button>
      </div>

      {subTab === "utang_piutang" ? (
        <UtangPiutangView
          daftar={daftarUtangPiutang}
          onSimpan={onSimpanUtangPiutang || (() => {})}
          onHapus={onHapusUtangPiutang || (() => {})}
        />
      ) : subTab === "target_tabungan" ? (
        <TargetTabunganView
          daftarTarget={daftarTargetTabungan}
          transaksi={transaksi}
          onSimpanTarget={onSimpanTargetTabungan || (() => {})}
          onHapusTarget={onHapusTargetTabungan || (() => {})}
          onBukaTambahTabungan={onBukaTambahTabungan}
        />
      ) : (
        <>
          <BannerUmurBarang daftar={daftarPenyusutan} onBuka={onBukaUmurBarang} />
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

      {/* Card Ringkasan Saldo per Dana */}
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

      {/* Banner / Card Daftar Talangan yang Belum Diganti (Requirement 2) */}
      {daftarTalanganBelum.length > 0 && (
        <section
          className="card"
          style={{
            marginBottom: "16px",
            border: "1.5px solid var(--keluar)",
            background: "color-mix(in srgb, var(--keluar) 8%, var(--surface))",
            padding: "14px 16px",
            borderRadius: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={() => setTalanganBuka((prev) => !prev)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.3rem" }}>🤝</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem", color: "var(--keluar)", fontWeight: 700 }}>
                  Daftar Talangan Belum Diganti ({daftarTalanganBelum.length} transaksi)
                </h3>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Total yang perlu diganti:{" "}
                  <strong style={{ color: "var(--keluar)", fontWeight: 800 }}>
                    {formatRupiah(totalTalanganBelum)}
                  </strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-ikon"
              style={{ fontSize: "1.1rem", background: "none", border: "none", cursor: "pointer" }}
              aria-label={talanganBuka ? "Tutup rincian talangan" : "Buka rincian talangan"}
            >
              {talanganBuka ? "▲" : "▼"}
            </button>
          </div>

          {talanganBuka && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {daftarTalanganBelum.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface)",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ minWidth: "180px", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                      {item.deskripsi}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      <span>📅 {item.tanggal}</span> · <span>🏷️ {labelKategori(item.kategori)}</span> ·{" "}
                      <span>💼 {item.dana}</span>
                      {item.talanganUntuk && (
                        <span style={{ color: "var(--accent)", marginLeft: "4px" }}>
                          ({item.talanganUntuk})
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--keluar)" }}>
                      {formatRupiah(item.jumlah)}
                    </span>
                    {onToggleStatusTalangan && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{
                          fontSize: "0.76rem",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          background: "#16a34a",
                          borderColor: "#16a34a",
                        }}
                        onClick={() => onToggleStatusTalangan(item.id)}
                        title="Tandai talangan ini telah diganti / lunas"
                      >
                        ✓ Tandai Lunas
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {syncStatus && syncStatus.status !== "idle" && (
        <p
          className="sync-pill"
          data-keadaan={syncStatus.status === "sukses" ? "ok" : syncStatus.status}
          id="sync-status"
        >
          {syncStatus.pesan}
        </p>
      )}

      {/* Saringan Cepat Dana */}
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

      {/* Section Kotak Pencarian & Saringan Riwayat (Requirement 1) */}
      <section
        className="card card-cari-saring"
        style={{
          marginBottom: "16px",
          padding: "14px 16px",
          borderRadius: "14px",
          border: saringanAktif ? "1.5px solid var(--accent)" : "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="search"
              placeholder="🔍 Cari uraian, catatan, sumber/tujuan, kaitan kegiatan..."
              value={cariTeks}
              onChange={(e) => setCariTeks(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: "0.88rem",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--text)",
              }}
            />
            {cariTeks && (
              <button
                type="button"
                onClick={() => setCariTeks("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{
              padding: "8px 12px",
              fontSize: "0.84rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderColor: panelSaringBuka ? "var(--accent)" : "var(--border)",
            }}
            onClick={() => setPanelSaringBuka((prev) => !prev)}
            title="Buka / Tutup Filter Lengkap"
          >
            <span>⚙️ Filter</span>
            <span style={{ fontSize: "0.72rem" }}>{panelSaringBuka ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* Panel Filter Terperinci: Kategori, Metode Bayar, Rentang Tanggal, Talangan */}
        {panelSaringBuka && (
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px dashed var(--border)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
            }}
          >
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                Kategori
              </label>
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: "0.82rem" }}
              >
                <option value="">Semua Kategori</option>
                {daftarKategoriTersedia.map((kat) => (
                  <option key={kat} value={kat}>
                    {labelKategori(kat)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                Metode Bayar
              </label>
              <select
                value={filterMetode}
                onChange={(e) => setFilterMetode(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: "0.82rem" }}
              >
                <option value="">Semua Metode</option>
                {METODE_BAYAR.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filterTglMulai}
                onChange={(e) => setFilterTglMulai(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={filterTglSelesai}
                onChange={(e) => setFilterTglSelesai(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                Status Talangan
              </label>
              <select
                value={filterStatusTalangan}
                onChange={(e) => setFilterStatusTalangan(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: "0.82rem" }}
              >
                <option value="">Semua Status</option>
                <option value="semua_talangan">Semua Talangan</option>
                <option value="belum_diganti">Talangan Belum Diganti</option>
                <option value="sudah_diganti">Talangan Sudah Diganti</option>
              </select>
            </div>
          </div>
        )}

        {/* Bar Ringkasan Hasil Saringan (Requirement 1: Tampilkan total pemasukan/pengeluaran) */}
        <div
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "0.83rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span>
              <strong>{transaksiDifilter.length}</strong> transaksi ditemukan
            </span>
            <span>·</span>
            <span style={{ color: "var(--masuk)", fontWeight: 700 }}>
              Masuk: +{formatRupiah(totalSaringMasuk)}
            </span>
            <span>·</span>
            <span style={{ color: "var(--keluar)", fontWeight: 700 }}>
              Keluar: -{formatRupiah(totalSaringKeluar)}
            </span>
          </div>

          {saringanAktif && (
            <button
              type="button"
              className="btn-small"
              onClick={resetSemuaSaringan}
              style={{
                fontSize: "0.75rem",
                padding: "3px 8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              ✕ Reset Saringan
            </button>
          )}
        </div>
      </section>

      {/* Anggaran Harian Meter */}
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

      {/* Daftar Transaksi per Hari */}
      <div id="daftar-hari" className="daftar-hari">
        {daftarTanggal.map((tgl) => {
          const itemHari = perHariMap.get(tgl) || [];
          // Total bersih hari itu (perdiem tidak dihitung sebagai pengeluaran; lihat lib/totalHarian.ts).
          const { masuk: masukHari, keluar: keluarHari, bersih: bersihHari } = hitungTotalHarian(itemHari);

          const [y, m, d] = tgl.split("-").map(Number);
          const dObj = new Date(y, m - 1, d);

          return (
            <section key={tgl} className="hari">
              <div className="hari-kepala">
                <span>
                  <strong>
                    {d} {namaBulanPendek.format(dObj)}
                  </strong>{" "}
                  <span className="hari-nama">· {namaHari.format(dObj)}</span>
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginLeft: "auto",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(masukHari > 0 || keluarHari > 0) && (
                    <span
                      className="hari-total-bersih"
                      title={`Pemasukan ${formatRupiah(masukHari)} − pengeluaran ${formatRupiah(keluarHari)} (uang harian tidak dihitung sebagai pengeluaran)`}
                      style={{
                        color: bersihHari > 0 ? "var(--masuk)" : bersihHari < 0 ? "var(--keluar)" : "var(--muted)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {bersihHari > 0 ? "+" : bersihHari < 0 ? "−" : ""}Rp{formatAngka(Math.abs(bersihHari))}
                    </span>
                  )}
                </div>
              </div>

              <ul className="expense-list" style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                {itemHari.map((item) => {
                  return (
                    <li
                      key={item.id}
                      className="kartu-transaksi-bertingkat"
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        setTransaksiDetail(item);
                      }}
                      onTouchStart={() => handleTouchStart(item)}
                      onTouchMove={handleTouchEndOrMove}
                      onTouchEnd={handleTouchEndOrMove}
                      onTouchCancel={handleTouchEndOrMove}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px minmax(0, 1fr) auto",
                        gap: "12px",
                        alignItems: "flex-start",
                        padding: "12px 14px",
                        borderRadius: "16px",
                        marginBottom: "8px",
                        borderLeft: `3px solid ${
                          item.jenis === "pemasukan" ? "var(--masuk)" : "var(--keluar)"
                        }`,
                        background: "var(--surface)",
                        borderTop: "1px solid var(--border)",
                        borderRight: "1px solid var(--border)",
                        borderBottom: "1px solid var(--border)",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      {/* Kolom 1: Ikon 44 px */}
                      <UbinKategori kategori={item.kategori} ukuran={44} sudut={14} ukuranIkon={22} />

                      {/* Kolom 2: Isi bertingkat (min-width: 0) */}
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
                        {/* Baris 1: Uraian tebal, maks 2 baris lalu "…" */}
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.93rem",
                            lineHeight: 1.35,
                            color: "var(--text)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.deskripsi}
                        </div>

                        {/* Baris 2: Chip kategori, teks kecil abu "Dana Pribadi · QRIS", chip "📎 1 bukti" */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "6px 8px",
                            marginTop: "2px",
                          }}
                        >
                          <ChipKategori kategori={item.kategori} />
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {[item.dana, item.metode].filter(Boolean).join(" · ")}
                          </span>
                          {(() => {
                            const pantauan = daftarPenyusutan.find((x) => x.transaksiId === item.id);
                            const hasilUmur = pantauan ? hitungPenyusutan(pantauan, hariIni()) : null;
                            return hasilUmur ? <LencanaUmur hasil={hasilUmur} /> : null;
                          })()}
                          {item.bukti && item.bukti.length > 0 && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                padding: "2px 7px",
                                borderRadius: "999px",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
                                color: "var(--accent)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              📎 {item.bukti.length} bukti
                            </span>
                          )}
                          {item.isTalangan && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                padding: "2px 7px",
                                borderRadius: "999px",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                background:
                                  item.statusTalangan === "sudah_diganti"
                                    ? "rgba(34,197,94,0.12)"
                                    : "rgba(239,68,68,0.12)",
                                color:
                                  item.statusTalangan === "sudah_diganti"
                                    ? "var(--masuk)"
                                    : "var(--keluar)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.statusTalangan === "sudah_diganti" ? "✓ Lunas" : "⏳ Talangan"}
                            </span>
                          )}
                        </div>

                        {/* Baris 3 (bila ada): Sumber/Tujuan atau Kaitan Kegiatan */}
                        {item.kaitan && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: 1.35,
                              marginTop: "1px",
                            }}
                            title={item.kaitan}
                          >
                            {item.kaitan}
                          </div>
                        )}

                        {/* Baris 4 (bila ada): Catatan miring */}
                        {item.catatan && (
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontStyle: "italic",
                              color: "var(--muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: 1.35,
                              marginTop: "1px",
                            }}
                            title={item.catatan}
                          >
                            {item.catatan}
                          </div>
                        )}
                      </div>

                      {/* Kolom 3: Nominal */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          justifyContent: "flex-start",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "0.95rem",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                            lineHeight: 1.35,
                            color: item.jenis === "pemasukan" ? "var(--masuk)" : "var(--keluar)",
                          }}
                        >
                          {item.jenis === "pemasukan"
                            ? `+Rp${formatAngka(item.jumlah)}`
                            : `−Rp${formatAngka(item.jumlah)}`}
                        </span>
                      </div>

                      {/* Tombol Aksi PC Hover */}
                      <div className="pc-hover-actions">
                        <button
                          type="button"
                          className="btn-icon-hover"
                          title="Ubah transaksi"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-hover btn-delete-hover"
                          title="Hapus transaksi"
                          onClick={(e) => {
                            e.stopPropagation();
                            const isPindah = item.kategori === "Pindah Dana" || Boolean(item.pasanganId);
                            const pesan = isPindah
                              ? `Transaksi "${item.deskripsi}" merupakan transaksi Pindah Dana. Menghapus transaksi ini juga akan otomatis menghapus transaksi pasangannya di dana terkait. Lanjutkan?`
                              : pesanHapusPerdiem(item, transaksi) ??
                                `Hapus transaksi "${item.deskripsi}" (${item.jenis === "pemasukan" ? "+" : "−"}Rp${formatAngka(item.jumlah)})?`;
                            if (window.confirm(pesan)) {
                              onDelete(item.id);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
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
          {saringanAktif
            ? "Tidak ada transaksi yang cocok dengan kriteria pencarian dan saringan."
            : "Belum ada transaksi pada bulan ini."}
        </p>
      )}

      {/* Navigasi Bulan Lalu */}
      {!filterTglMulai && !filterTglSelesai && (
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
      )}
        </>
      )}

      {/* Lembar Detail Transaksi (Bottom Sheet di HP / Dialog di PC) */}
      <LembarDetailTransaksi
        transaksi={transaksiDetail}
        isOpen={Boolean(transaksiDetail)}
        onClose={() => setTransaksiDetail(null)}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatusTalangan={onToggleStatusTalangan}
        googleToken={googleToken}
        daftarTransaksi={transaksi}
      />

      {/* Menu Tekan Lama (Long Press) di HP */}
      {menuLongPress && (
        <div
          className="lembar-backdrop"
          onClick={() => setMenuLongPress(null)}
          style={{ zIndex: 1050 }}
        >
          <div
            className="lembar-detail-card"
            style={{ padding: "18px 20px 24px", maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lembar-drag-handle" onClick={() => setMenuLongPress(null)}>
              <div
                style={{
                  width: "40px",
                  height: "5px",
                  borderRadius: "999px",
                  backgroundColor: "var(--border)",
                }}
              />
            </div>
            <h3 style={{ margin: "4px 0 2px", fontSize: "1.05rem", fontWeight: 800 }}>
              {menuLongPress.deskripsi}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--muted)" }}>
              {menuLongPress.jenis === "pemasukan" ? "+" : "−"}Rp{formatAngka(menuLongPress.jumlah)} · {labelKategori(menuLongPress.kategori)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px",
                  fontWeight: 700,
                }}
                onClick={() => {
                  const trx = menuLongPress;
                  setMenuLongPress(null);
                  onEdit(trx);
                }}
              >
                <Edit2 size={18} />
                <span>Ubah Transaksi</span>
              </button>
              <button
                type="button"
                className="btn-danger"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  border: "1px solid #ef4444",
                  borderRadius: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={() => {
                  const trx = menuLongPress;
                  setMenuLongPress(null);
                  const isPindah = trx.kategori === "Pindah Dana" || Boolean(trx.pasanganId);
                  const pesan = isPindah
                    ? `Transaksi "${trx.deskripsi}" merupakan transaksi Pindah Dana. Menghapus transaksi ini juga akan otomatis menghapus transaksi pasangannya di dana terkait. Lanjutkan?`
                    : pesanHapusPerdiem(trx, transaksi) ??
                      `Hapus transaksi "${trx.deskripsi}" (${trx.jenis === "pemasukan" ? "+" : "−"}Rp${formatAngka(trx.jumlah)})?`;
                  if (window.confirm(pesan)) {
                    onDelete(trx.id);
                  }
                }}
              >
                <Trash2 size={18} />
                <span>Hapus Transaksi</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "10px" }}
                onClick={() => setMenuLongPress(null)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <BuktiPreviewModal
        transaksi={transaksiLihatBukti}
        isOpen={Boolean(transaksiLihatBukti)}
        onClose={() => setTransaksiLihatBukti(null)}
      />
    </section>
  );
};
