import React, { useState, useMemo } from "react";
import { TargetTabunganItem, Transaksi } from "../types";
import { formatRupiah, hariIni } from "../lib/constants";
import { buatId } from "../lib/storage";

interface TargetTabunganViewProps {
  daftarTarget: TargetTabunganItem[];
  transaksi: Transaksi[];
  onSimpanTarget: (item: TargetTabunganItem) => void;
  onHapusTarget: (id: string) => void;
  onBukaTambahTabungan?: (targetId: string, targetNama: string) => void;
}

export function isTransaksiUntukTarget(t: Transaksi, target: TargetTabunganItem, totalTargetCount: number): boolean {
  if (t.kategori !== "Tabungan") return false;
  if (t.targetTabunganId) {
    return t.targetTabunganId === target.id;
  }
  // Pencocokan teks berdasarkan nama target
  const namaTargetKecil = target.nama.trim().toLowerCase();
  const deskripsiKecil = (t.deskripsi || "").toLowerCase();
  const kaitanKecil = (t.kaitan || "").toLowerCase();
  const catatanKecil = (t.catatan || "").toLowerCase();

  if (
    deskripsiKecil.includes(namaTargetKecil) ||
    kaitanKecil.includes(namaTargetKecil) ||
    catatanKecil.includes(namaTargetKecil)
  ) {
    return true;
  }

  // Jika hanya ada 1 target tabungan dan transaksi berkategori Tabungan belum punya id spesifik
  if (totalTargetCount === 1) {
    return true;
  }

  return false;
}

export const TargetTabunganView: React.FC<TargetTabunganViewProps> = ({
  daftarTarget,
  transaksi,
  onSimpanTarget,
  onHapusTarget,
  onBukaTambahTabungan,
}) => {
  const [modalFormBuka, setModalFormBuka] = useState<boolean>(false);
  const [editItem, setEditItem] = useState<TargetTabunganItem | null>(null);

  const [formNama, setFormNama] = useState<string>("");
  const [formJumlah, setFormJumlah] = useState<string>("");
  const [formTenggat, setFormTenggat] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });
  const [formCatatan, setFormCatatan] = useState<string>("");

  const today = hariIni();

  // Hitung progres per target
  const daftarDenganProgres = useMemo(() => {
    return daftarTarget.map((target) => {
      const listTrx = transaksi.filter((t) =>
        isTransaksiUntukTarget(t, target, daftarTarget.length)
      );

      const terkumpul = listTrx.reduce((s, t) => s + t.jumlah, 0);
      const sisa = Math.max(0, target.targetJumlah - terkumpul);
      const persen =
        target.targetJumlah > 0
          ? Math.min(100, Math.round((terkumpul / target.targetJumlah) * 100))
          : 100;
      const isTercapai = terkumpul >= target.targetJumlah;
      const isLewatTenggat = !isTercapai && target.tenggat < today;

      // Hitung selisih hari
      const d1 = new Date(today).getTime();
      const d2 = new Date(target.tenggat).getTime();
      const sisaHari = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));

      return {
        target,
        terkumpul,
        sisa,
        persen,
        isTercapai,
        isLewatTenggat,
        sisaHari,
        listTrx,
      };
    });
  }, [daftarTarget, transaksi, today]);

  // Ringkasan global
  const ringkasan = useMemo(() => {
    let totalTarget = 0;
    let totalTerkumpul = 0;
    let tercapaiCount = 0;

    for (const item of daftarDenganProgres) {
      totalTarget += item.target.targetJumlah;
      totalTerkumpul += item.terkumpul;
      if (item.isTercapai) tercapaiCount += 1;
    }

    const persenGlobal =
      totalTarget > 0 ? Math.min(100, Math.round((totalTerkumpul / totalTarget) * 100)) : 0;

    return { totalTarget, totalTerkumpul, tercapaiCount, persenGlobal };
  }, [daftarDenganProgres]);

  const handleBukaTambah = () => {
    setEditItem(null);
    setFormNama("");
    setFormJumlah("");
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    setFormTenggat(d.toISOString().slice(0, 10));
    setFormCatatan("");
    setModalFormBuka(true);
  };

  const handleBukaEdit = (item: TargetTabunganItem) => {
    setEditItem(item);
    setFormNama(item.nama);
    setFormJumlah(String(item.targetJumlah));
    setFormTenggat(item.tenggat);
    setFormCatatan(item.catatan || "");
    setModalFormBuka(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const jml = Number(formJumlah.replace(/\D/g, "")) || 0;
    if (!formNama.trim() || jml <= 0) return;

    if (editItem) {
      const diupdate: TargetTabunganItem = {
        ...editItem,
        nama: formNama.trim(),
        targetJumlah: jml,
        tenggat: formTenggat || today,
        catatan: formCatatan.trim(),
        diubah: new Date().toISOString(),
      };
      onSimpanTarget(diupdate);
    } else {
      const baru: TargetTabunganItem = {
        id: buatId(),
        nama: formNama.trim(),
        targetJumlah: jml,
        tenggat: formTenggat || today,
        catatan: formCatatan.trim(),
        dibuat: new Date().toISOString(),
        diubah: new Date().toISOString(),
      };
      onSimpanTarget(baru);
    }

    setModalFormBuka(false);
  };

  return (
    <div className="target-tabungan-container">
      {/* Kartu Ringkasan Global */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Tabungan Terkumpul
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#10b981" }}>
            {formatRupiah(ringkasan.totalTerkumpul)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Dari transaksi berkategori "Tabungan"
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Sasaran Target
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#3b82f6" }}>
            {formatRupiah(ringkasan.totalTarget)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Dari {daftarTarget.length} impian / sasaran
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", borderLeft: "4px solid var(--primary)" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Capaian Target Tabungan
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>
            {ringkasan.persenGlobal}% Terpenuhi
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {ringkasan.tercapaiCount} dari {daftarTarget.length} target tercapai 🎉
          </div>
        </div>
      </div>

      {/* Baris Tombol Buat Target Baru */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
          padding: "14px 18px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Daftar Sasaran &amp; Impian Tabungan</h3>
          <p className="help" style={{ margin: 0, fontSize: "0.82rem" }}>
            Otomatis terisi dari setiap transaksi pengeluaran berkategori <strong>"Tabungan"</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={handleBukaTambah}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <span>🎯</span> + Target Tabungan Baru
        </button>
      </div>

      {/* Daftar Kartu Target Tabungan */}
      {daftarDenganProgres.length === 0 ? (
        <div className="card" style={{ padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎯</div>
          <h3 style={{ margin: "0 0 6px" }}>Belum Ada Target Tabungan</h3>
          <p className="help" style={{ margin: "0 0 16px" }}>
            Tentukan tujuan tabungan Anda (misal: Dana Darurat, Beli Rumah, Kendaraan, atau Liburan)
            dan pantau progresnya secara otomatis!
          </p>
          <button type="button" className="btn-primary" onClick={handleBukaTambah} style={{ margin: "0 auto" }}>
            + Buat Target Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {daftarDenganProgres.map(({ target, terkumpul, sisa, persen, isTercapai, isLewatTenggat, sisaHari, listTrx }) => (
            <div
              key={target.id}
              className="card"
              style={{
                padding: "20px",
                borderRadius: "18px",
                borderLeft: `5px solid ${isTercapai ? "#10b981" : isLewatTenggat ? "#ef4444" : "var(--primary)"}`,
              }}
            >
              {/* Header Target */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ fontSize: "1.2rem" }}>🎯</span>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{target.nama}</h3>

                    {isTercapai ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "12px",
                          background: "rgba(16, 185, 129, 0.2)",
                          color: "#10b981",
                        }}
                      >
                        🎉 Target Tercapai!
                      </span>
                    ) : isLewatTenggat ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "12px",
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#ef4444",
                          border: "1px solid #ef4444",
                        }}
                      >
                        ⚠️ Lewat Tenggat ({target.tenggat})
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          background: "var(--surface-hover, rgba(255, 255, 255, 0.05))",
                        }}
                      >
                        ⏱️ Sisa {sisaHari > 0 ? `${sisaHari} hari lagi` : "hari ini"} (tenggat: {target.tenggat})
                      </span>
                    )}
                  </div>

                  {target.catatan && (
                    <p className="help" style={{ margin: 0, fontSize: "0.85rem" }}>
                      {target.catatan}
                    </p>
                  )}
                </div>

                {/* Sisa & Terkumpul */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Terkumpul:</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#10b981" }}>
                    {formatRupiah(terkumpul)}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Target: {formatRupiah(target.targetJumlah)}
                  </div>
                </div>
              </div>

              {/* Bilah Progres */}
              <div style={{ marginBottom: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  <span>
                    {isTercapai
                      ? "Selamat! Sasaran tabungan Anda telah terpenuhi 🚀"
                      : `Kurang ${formatRupiah(sisa)} lagi`}
                  </span>
                  <span style={{ fontWeight: 700, color: isTercapai ? "#10b981" : "var(--text)" }}>
                    {persen}%
                  </span>
                </div>
                <div className="bar-track" style={{ height: "10px", borderRadius: "6px" }}>
                  <div
                    className="bar-fill"
                    style={{
                      width: `${persen}%`,
                      backgroundColor: isTercapai ? "#10b981" : "var(--primary)",
                      height: "100%",
                      borderRadius: "6px",
                      boxShadow: isTercapai ? "0 0 10px #10b981" : "0 0 8px var(--primary)",
                    }}
                  />
                </div>
              </div>

              {/* Riwayat Transaksi Terkait */}
              {listTrx.length > 0 && (
                <details style={{ marginBottom: "14px", fontSize: "0.85rem" }}>
                  <summary style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 600 }}>
                    Lihat {listTrx.length} setoran tabungan terhubung
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
                    {listTrx.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 0",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{t.deskripsi}</span>
                          <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontSize: "0.78rem" }}>
                            {t.tanggal}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: "#10b981" }}>
                          +{formatRupiah(t.jumlah)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Aksi */}
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
                <div>
                  {onBukaTambahTabungan && !isTercapai && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onBukaTambahTabungan(target.id, target.nama)}
                      style={{ fontSize: "0.85rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>➕</span> Tabung Sekarang
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleBukaEdit(target)}
                    style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (window.confirm(`Hapus target tabungan "${target.nama}"? Transaksi tabungan yang sudah ada tidak akan terhapus.`)) {
                        onHapusTarget(target.id);
                      }
                    }}
                    style={{ fontSize: "0.82rem", padding: "4px 10px", color: "#f87171" }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit Target */}
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
              maxWidth: "420px",
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
                <span>🎯</span> {editItem ? "Ubah Target Tabungan" : "Buat Target Tabungan Baru"}
              </h3>
              <button type="button" className="btn-ikon" onClick={() => setModalFormBuka(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-target-nama">Nama Target / Sasaran Impian</label>
                <input
                  id="input-target-nama"
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Dana Darurat / Laptop Baru / Umroh"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-target-jumlah">Target Nominal (Rp)</label>
                <input
                  id="input-target-jumlah"
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
                <label htmlFor="input-target-tenggat">Tenggat Waktu (Target Selesai)</label>
                <input
                  id="input-target-tenggat"
                  type="date"
                  value={formTenggat}
                  onChange={(e) => setFormTenggat(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "18px" }}>
                <label htmlFor="input-target-catatan">Catatan / Rencana (Opsional)</label>
                <textarea
                  id="input-target-catatan"
                  rows={2}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Contoh: Menabung 500rb per bulan dari sisa gaji"
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setModalFormBuka(false)} style={{ flex: 1 }}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  {editItem ? "Simpan Perubahan" : "Simpan Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
