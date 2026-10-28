import React, { useState, useMemo } from "react";
import { ItemHutangPiutang, CicilanItem, JenisHutang } from "../types";
import { formatRupiah, hariIni } from "../lib/constants";
import { buatId } from "../lib/storage";

interface UtangPiutangViewProps {
  daftar: ItemHutangPiutang[];
  onSimpan: (item: ItemHutangPiutang) => void;
  onHapus: (id: string) => void;
}

export const UtangPiutangView: React.FC<UtangPiutangViewProps> = ({
  daftar,
  onSimpan,
  onHapus,
}) => {
  const [cariTeks, setCariTeks] = useState<string>("");

  const [modalFormBuka, setModalFormBuka] = useState<boolean>(false);
  const [editItem, setEditItem] = useState<ItemHutangPiutang | null>(null);

  // Form states
  const [formJenis, setFormJenis] = useState<JenisHutang>("utang");
  const [formNamaOrang, setFormNamaOrang] = useState<string>("");
  const [formJumlah, setFormJumlah] = useState<string>("");
  const [formJatuhTempo, setFormJatuhTempo] = useState<string>(hariIni());
  const [formCatatan, setFormCatatan] = useState<string>("");

  // Modal bayar cicilan
  const [modalCicilanItem, setModalCicilanItem] = useState<ItemHutangPiutang | null>(null);
  const [inputCicilanJumlah, setInputCicilanJumlah] = useState<string>("");
  const [inputCicilanTanggal, setInputCicilanTanggal] = useState<string>(hariIni());
  const [inputCicilanCatatan, setInputCicilanCatatan] = useState<string>("");

  const today = hariIni();

  // Helper kalkulasi per item
  const hitungItem = (item: ItemHutangPiutang) => {
    const totalCicilan = (item.cicilan || []).reduce((s, c) => s + c.jumlah, 0);
    const sisa = Math.max(0, item.jumlah - totalCicilan);
    const isLunas = sisa === 0;
    const isJatuhTempo = !isLunas && item.jatuhTempo < today;
    const persen = item.jumlah > 0 ? Math.min(100, Math.round((totalCicilan / item.jumlah) * 100)) : 100;
    return { totalCicilan, sisa, isLunas, isJatuhTempo, persen };
  };

  // Ringkasan global
  const ringkasan = useMemo(() => {
    let totalUtangSisa = 0;
    let totalPiutangSisa = 0;
    let jumlahJatuhTempo = 0;

    for (const item of daftar) {
      const { sisa, isLunas, isJatuhTempo } = hitungItem(item);
      if (!isLunas) {
        if (item.jenis === "utang") {
          totalUtangSisa += sisa;
        } else {
          totalPiutangSisa += sisa;
        }
        if (isJatuhTempo) {
          jumlahJatuhTempo += 1;
        }
      }
    }

    return { totalUtangSisa, totalPiutangSisa, jumlahJatuhTempo };
  }, [daftar, today]);

  // Filter daftar berdasarkan teks pencarian
  const daftarTersaring = useMemo(() => {
    return daftar.filter((item) => {
      if (cariTeks.trim()) {
        const q = cariTeks.toLowerCase();
        const namaCocok = item.namaOrang.toLowerCase().includes(q);
        const catatanCocok = (item.catatan || "").toLowerCase().includes(q);
        if (!namaCocok && !catatanCocok) return false;
      }

      return true;
    });
  }, [daftar, cariTeks]);

  const handleBukaTambah = () => {
    setEditItem(null);
    setFormJenis("utang");
    setFormNamaOrang("");
    setFormJumlah("");
    setFormJatuhTempo(hariIni());
    setFormCatatan("");
    setModalFormBuka(true);
  };

  const handleBukaEdit = (item: ItemHutangPiutang) => {
    setEditItem(item);
    setFormJenis(item.jenis);
    setFormNamaOrang(item.namaOrang);
    setFormJumlah(String(item.jumlah));
    setFormJatuhTempo(item.jatuhTempo);
    setFormCatatan(item.catatan || "");
    setModalFormBuka(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const jml = Number(formJumlah.replace(/\D/g, "")) || 0;
    if (!formNamaOrang.trim() || jml <= 0) return;

    if (editItem) {
      const diupdate: ItemHutangPiutang = {
        ...editItem,
        jenis: formJenis,
        namaOrang: formNamaOrang.trim(),
        jumlah: jml,
        jatuhTempo: formJatuhTempo || hariIni(),
        catatan: formCatatan.trim(),
        diubah: new Date().toISOString(),
      };
      onSimpan(diupdate);
    } else {
      const baru: ItemHutangPiutang = {
        id: buatId(),
        jenis: formJenis,
        namaOrang: formNamaOrang.trim(),
        jumlah: jml,
        jatuhTempo: formJatuhTempo || hariIni(),
        catatan: formCatatan.trim(),
        cicilan: [],
        dibuat: new Date().toISOString(),
        diubah: new Date().toISOString(),
      };
      onSimpan(baru);
    }

    setModalFormBuka(false);
  };

  const handleBukaModalCicilan = (item: ItemHutangPiutang) => {
    const { sisa } = hitungItem(item);
    setModalCicilanItem(item);
    setInputCicilanJumlah(String(sisa));
    setInputCicilanTanggal(hariIni());
    setInputCicilanCatatan("");
  };

  const handleSubmitCicilan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCicilanItem) return;
    const jml = Number(inputCicilanJumlah.replace(/\D/g, "")) || 0;
    if (jml <= 0) return;

    const cicilanBaru: CicilanItem = {
      id: buatId(),
      tanggal: inputCicilanTanggal || hariIni(),
      jumlah: jml,
      catatan: inputCicilanCatatan.trim() || "Cicilan",
      diubah: new Date().toISOString(),
    };

    const itemDiperbarui: ItemHutangPiutang = {
      ...modalCicilanItem,
      cicilan: [...(modalCicilanItem.cicilan || []), cicilanBaru],
      diubah: new Date().toISOString(),
    };

    onSimpan(itemDiperbarui);
    setModalCicilanItem(null);
  };

  const handleHapusSatuCicilan = (item: ItemHutangPiutang, cicilanId: string) => {
    const konfirmasi = window.confirm("Hapus catatan cicilan ini?");
    if (!konfirmasi) return;

    const itemDiperbarui: ItemHutangPiutang = {
      ...item,
      cicilan: (item.cicilan || []).filter((c) => c.id !== cicilanId),
      diubah: new Date().toISOString(),
    };

    onSimpan(itemDiperbarui);
  };

  const handleTandaiLunas = (item: ItemHutangPiutang) => {
    const { sisa } = hitungItem(item);
    if (sisa <= 0) return;

    const konfirmasi = window.confirm(
      `Tandai lunas sisa ${formatRupiah(sisa)} untuk ${item.namaOrang}?`
    );
    if (!konfirmasi) return;

    const pelunasan: CicilanItem = {
      id: buatId(),
      tanggal: hariIni(),
      jumlah: sisa,
      catatan: "Pelunasan penuh",
      diubah: new Date().toISOString(),
    };

    const itemDiperbarui: ItemHutangPiutang = {
      ...item,
      cicilan: [...(item.cicilan || []), pelunasan],
      diubah: new Date().toISOString(),
    };

    onSimpan(itemDiperbarui);
  };

  return (
    <div className="utang-piutang-container">
      {/* Kartu Ringkasan Atas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Utang Saya (Kewajiban)
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ef4444" }}>
            {formatRupiah(ringkasan.totalUtangSisa)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Uang yang wajib dikembalikan
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Piutang Saya (Tagihan)
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#10b981" }}>
            {formatRupiah(ringkasan.totalPiutangSisa)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Uang yang dipinjam orang lain
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: "16px 18px",
            borderLeft: `4px solid ${ringkasan.jumlahJatuhTempo > 0 ? "#dc2626" : "var(--border)"}`,
            background: ringkasan.jumlahJatuhTempo > 0 ? "rgba(220, 38, 38, 0.08)" : undefined,
          }}
        >
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Sudah Jatuh Tempo
          </div>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 800,
              color: ringkasan.jumlahJatuhTempo > 0 ? "#dc2626" : "var(--text)",
            }}
          >
            {ringkasan.jumlahJatuhTempo} Catatan
          </div>
          <div style={{ fontSize: "0.78rem", color: ringkasan.jumlahJatuhTempo > 0 ? "#ef4444" : "var(--text-muted)", marginTop: "4px" }}>
            {ringkasan.jumlahJatuhTempo > 0 ? "⚠️ Segera tindak lanjuti!" : "Tidak ada yang lewat batas"}
          </div>
        </div>
      </div>



      {/* Daftar Item Utang & Piutang */}
      {daftarTersaring.length === 0 ? (
        daftar.length === 0 ? (
          <div className="card" style={{ padding: "36px 20px", textAlign: "center" }}>
            {/* Gambar Pencari di Kotak Belum Ada Catatan Utang/Piutang */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(6, 182, 212, 0.12)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                fontSize: "1.75rem",
              }}
            >
              🔍
            </div>
            <h3 style={{ margin: "0 0 6px" }}>Belum Ada Catatan Utang / Piutang</h3>
            <p className="help" style={{ margin: "0 auto 16px", maxWidth: "420px" }}>
              Catat pinjaman uang, jatuh tempo, serta pembayaran bertahap (cicilan) dengan rapi.
            </p>

            {/* Fitur pencarian terpadu di dalam kotak */}
            <div
              style={{
                maxWidth: "340px",
                margin: "0 auto 20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "4px 12px",
              }}
            >
              <span style={{ opacity: 0.7 }}>🔍</span>
              <input
                type="search"
                value={cariTeks}
                onChange={(e) => setCariTeks(e.target.value)}
                placeholder="Cari nama orang atau catatan…"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "8px 0",
                  fontSize: "0.85rem",
                  color: "inherit",
                }}
              />
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleBukaTambah}
              style={{
                margin: "0 auto",
                padding: "10px 24px",
                borderRadius: "12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>➕</span> Buat Catatan Pertama
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: "36px 20px", textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(6, 182, 212, 0.12)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                fontSize: "1.75rem",
              }}
            >
              🔍
            </div>
            <h3 style={{ margin: "0 0 6px" }}>Catatan Tidak Ditemukan</h3>
            <p className="help" style={{ margin: "0 auto 18px", maxWidth: "420px" }}>
              {cariTeks
                ? `Tidak ada catatan yang cocok dengan kata kunci "${cariTeks}".`
                : "Tidak ada catatan pada filter yang sedang aktif."}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              {cariTeks && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCariTeks("")}
                  style={{ padding: "8px 18px", borderRadius: "10px" }}
                >
                  Reset Pencarian
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleBukaTambah}
                style={{ padding: "8px 20px", borderRadius: "10px", fontWeight: 700 }}
              >
                ➕ Tambah Catatan
              </button>
            </div>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {daftarTersaring.map((item) => {
            const { totalCicilan, sisa, isLunas, isJatuhTempo, persen } = hitungItem(item);
            const isUtang = item.jenis === "utang";

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: "18px 20px",
                  borderRadius: "16px",
                  borderLeft: `5px solid ${
                    isJatuhTempo ? "#dc2626" : isLunas ? "#10b981" : isUtang ? "#f97316" : "#3b82f6"
                  }`,
                }}
              >
                {/* Header Item */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: isUtang ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                          color: isUtang ? "#f87171" : "#34d399",
                          border: `1px solid ${isUtang ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        }}
                      >
                        {isUtang ? "Utang Saya (Wajib Bayar)" : "Piutang (Tagihan)"}
                      </span>

                      {isLunas ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "rgba(16, 185, 129, 0.2)",
                            color: "#10b981",
                          }}
                        >
                          ✓ Lunas
                        </span>
                      ) : isJatuhTempo ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "rgba(220, 38, 38, 0.25)",
                            color: "#ef4444",
                            border: "1px solid #ef4444",
                          }}
                        >
                          ⚠️ Lewat Jatuh Tempo ({item.jatuhTempo})
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "var(--surface-hover, rgba(255, 255, 255, 0.05))",
                          }}
                        >
                          Jatuh tempo: {item.jatuhTempo}
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: "6px 0 2px", fontSize: "1.15rem", fontWeight: 800 }}>
                      {item.namaOrang}
                    </h3>
                    {item.catatan && (
                      <p className="help" style={{ margin: 0, fontSize: "0.85rem" }}>
                        {item.catatan}
                      </p>
                    )}
                  </div>

                  {/* Nominal Sisa */}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sisa yang Harus Dibayar:</div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        color: isLunas ? "#10b981" : isUtang ? "#ef4444" : "#3b82f6",
                      }}
                    >
                      {formatRupiah(sisa)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Pokok: {formatRupiah(item.jumlah)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar Cicilan */}
                <div style={{ marginBottom: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    <span>Dicicil: {formatRupiah(totalCicilan)}</span>
                    <span>{persen}%</span>
                  </div>
                  <div className="bar-track" style={{ height: "8px", borderRadius: "4px" }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${persen}%`,
                        backgroundColor: isLunas ? "#10b981" : isUtang ? "#f97316" : "#3b82f6",
                        height: "100%",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>

                {/* Riwayat Cicilan Jika Ada */}
                {item.cicilan && item.cicilan.length > 0 && (
                  <details style={{ marginBottom: "14px", fontSize: "0.85rem" }}>
                    <summary style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 600 }}>
                      Lihat {item.cicilan.length} riwayat cicilan
                    </summary>
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {item.cicilan.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "6px 0",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600 }}>{formatRupiah(c.jumlah)}</span>
                            <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontSize: "0.78rem" }}>
                              {c.tanggal} {c.catatan ? `• ${c.catatan}` : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-ikon"
                            onClick={() => handleHapusSatuCicilan(item, c.id)}
                            title="Hapus cicilan"
                            style={{ fontSize: "0.85rem", padding: "2px 6px" }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Tombol Aksi */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px" }}>
                    {!isLunas && (
                      <>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleBukaModalCicilan(item)}
                          style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                        >
                          ➕ Bayar Cicilan
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleTandaiLunas(item)}
                          style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                        >
                          ✓ Tandai Lunas
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleBukaEdit(item)}
                      style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (window.confirm(`Hapus catatan utang/piutang untuk ${item.namaOrang}?`)) {
                          onHapus(item.id);
                        }
                      }}
                      style={{ fontSize: "0.82rem", padding: "4px 10px", color: "#f87171" }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tombol Tambah Catatan di Bagian Bawah setelah catatan ada */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginTop: "20px",
              marginBottom: "24px",
              padding: "0 8px",
            }}
          >
            <button
              type="button"
              className="btn-primary"
              onClick={handleBukaTambah}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 28px",
                borderRadius: "14px",
                fontSize: "0.95rem",
                fontWeight: 700,
                width: "100%",
                maxWidth: "340px",
                boxShadow: "0 4px 16px rgba(6, 182, 212, 0.3)",
                cursor: "pointer",
              }}
            >
              <span>➕</span> Tambah Catatan
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Catatan Utang / Piutang */}
      {modalFormBuka && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setModalFormBuka(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "440px",
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>💳</span> {editItem ? "Ubah Utang / Piutang" : "Catat Utang / Piutang Baru"}
              </h3>
              <button type="button" className="btn-ikon" onClick={() => setModalFormBuka(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              {/* Pilihan Jenis: Utang vs Piutang */}
              <div className="filter-chips" style={{ marginBottom: "14px" }}>
                <button
                  type="button"
                  className="chip"
                  aria-checked={formJenis === "utang"}
                  onClick={() => setFormJenis("utang")}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Utang Saya (Wajib Bayar)
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-checked={formJenis === "piutang"}
                  onClick={() => setFormJenis("piutang")}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Piutang Saya (Tagihan)
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-nama-orang">Nama Orang / Lembaga</label>
                <input
                  id="input-nama-orang"
                  type="text"
                  value={formNamaOrang}
                  onChange={(e) => setFormNamaOrang(e.target.value)}
                  placeholder="Contoh: Pak Budi / Bank / Teman Kantor"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-jumlah-pokok">Jumlah Pokok (Rp)</label>
                <input
                  id="input-jumlah-pokok"
                  type="text"
                  inputMode="numeric"
                  value={formJumlah}
                  onChange={(e) => {
                    const angka = e.target.value.replace(/\D/g, "");
                    setFormJumlah(angka ? Number(angka).toLocaleString("id-ID") : "");
                  }}
                  placeholder="0"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-jatuh-tempo">Tanggal Jatuh Tempo</label>
                <input
                  id="input-jatuh-tempo"
                  type="date"
                  value={formJatuhTempo}
                  onChange={(e) => setFormJatuhTempo(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "18px" }}>
                <label htmlFor="input-catatan-utang">Catatan / Keterangan (Opsional)</label>
                <textarea
                  id="input-catatan-utang"
                  rows={2}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Contoh: Pinjaman modal usaha / Renovasi rumah"
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setModalFormBuka(false)} style={{ flex: 1 }}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  {editItem ? "Simpan Perubahan" : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bayar Cicilan */}
      {modalCicilanItem && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setModalCicilanItem(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: "400px",
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                <span>💰</span> Tambah Cicilan untuk {modalCicilanItem.namaOrang}
              </h3>
              <button type="button" className="btn-ikon" onClick={() => setModalCicilanItem(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCicilan}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-cicilan-jml">Nominal Cicilan (Rp)</label>
                <input
                  id="input-cicilan-jml"
                  type="text"
                  inputMode="numeric"
                  value={inputCicilanJumlah}
                  onChange={(e) => {
                    const angka = e.target.value.replace(/\D/g, "");
                    setInputCicilanJumlah(angka ? Number(angka).toLocaleString("id-ID") : "");
                  }}
                  placeholder="0"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-cicilan-tgl">Tanggal Pembayaran</label>
                <input
                  id="input-cicilan-tgl"
                  type="date"
                  value={inputCicilanTanggal}
                  onChange={(e) => setInputCicilanTanggal(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label htmlFor="input-cicilan-ket">Keterangan Cicilan</label>
                <input
                  id="input-cicilan-ket"
                  type="text"
                  value={inputCicilanCatatan}
                  onChange={(e) => setInputCicilanCatatan(e.target.value)}
                  placeholder="Contoh: Cicilan ke-1 / Transfer BCA"
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setModalCicilanItem(null)} style={{ flex: 1 }}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  Simpan Cicilan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
