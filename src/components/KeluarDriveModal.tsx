import React, { useState } from "react";
import { createPortal } from "react-dom";

/** Kotak pilihan seukuran ikon; gaya `input` global (lebar penuh, bantalan) tidak boleh ikut menggembungkannya. */
const gayaKotakPilihan: React.CSSProperties = { width: "20px", height: "20px", minHeight: 0, padding: 0, margin: "2px 0 0", flex: "none" };

export interface HasilKirim {
  ok: boolean;
  pesan?: string;
}

interface KeluarDriveModalProps {
  /** Akun yang akan diputus; null bila tidak sedang tersambung (hanya membersihkan perangkat). */
  akun: string | null;
  jumlahTransaksi: number;
  jumlahAset: number;
  /** Kirim data ke Drive sebelum dihapus dari perangkat. Tidak dipakai bila tidak tersambung. */
  onKirimDulu: () => Promise<HasilKirim>;
  /** Putus akun dan hapus data keuangan dari perangkat ini, lalu muat ulang aplikasi. */
  onKeluarDanHapus: () => Promise<void>;
  /** Putus akun saja; data di perangkat tetap ada. */
  onKeluarSaja: () => Promise<void>;
  onTutup: () => void;
}

/**
 * Keluar dari sinkron Google Drive. Pilihan bawaan menghapus data keuangan dari perangkat ini: aplikasi menyimpan salinan isi
 * Drive di browser, dan salinan itu tidak boleh tertinggal di perangkat yang akunnya sudah diputus (dipakai orang lain, atau
 * ditulis balik ke Drive pada sambungan berikutnya). Sebelum menghapus, data dikirim dulu ke Drive; bila gagal, penghapusan
 * butuh persetujuan eksplisit karena yang belum terkirim akan hilang.
 */
export const KeluarDriveModal: React.FC<KeluarDriveModalProps> = ({
  akun,
  jumlahTransaksi,
  jumlahAset,
  onKirimDulu,
  onKeluarDanHapus,
  onKeluarSaja,
  onTutup,
}) => {
  const tersambung = akun !== null;
  const [hapusData, setHapusData] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [gagalKirim, setGagalKirim] = useState<string | null>(null);
  const [setujuTanpaKirim, setSetujuTanpaKirim] = useState(false);

  const adaData = jumlahTransaksi + jumlahAset > 0;
  // Tanpa sambungan tidak ada tempat mengirim: yang belum pernah ke Drive hilang bila dihapus.
  const butuhPersetujuan = hapusData && adaData && (!tersambung || gagalKirim !== null);

  const jalankan = async () => {
    setSibuk(true);
    try {
      if (!hapusData) {
        await onKeluarSaja();
        onTutup();
        return;
      }
      if (tersambung && gagalKirim === null) {
        const hasil = await onKirimDulu();
        if (!hasil.ok) {
          setGagalKirim(hasil.pesan || "Data belum bisa dikirim ke Google Drive.");
          return;
        }
      }
      await onKeluarDanHapus();
    } finally {
      setSibuk(false);
    }
  };

  const judulAksi = !hapusData
    ? "Keluar, simpan data di perangkat"
    : gagalKirim !== null
      ? "Hapus tanpa terkirim"
      : tersambung
        ? "Kirim lalu keluar dan hapus data"
        : "Hapus data dari perangkat ini";

  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Keluar dan bersihkan data"
      data-testid="keluar-drive-modal"
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
      onClick={sibuk ? undefined : onTutup}
    >
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "22px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>{tersambung ? "Keluar dari Google Drive" : "Hapus data dari perangkat ini"}</h3>
        <p className="help" style={{ marginTop: 0 }}>
          {tersambung ? (
            <>
              Sambungan Google Drive (<strong>{akun}</strong>) akan diputus.{" "}
            </>
          ) : null}
          Perangkat ini menyimpan salinan data keuangan Anda ({jumlahTransaksi} transaksi, {jumlahAset} aset, profil, dan
          pengaturan). Data di folder Keuangan Google Drive tidak ikut terhapus.
        </p>

        {tersambung && (
          <div role="radiogroup" aria-label="Data di perangkat ini" style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "12px 0" }}>
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="radio" name="keluar-data" id="keluar-hapus" style={gayaKotakPilihan} checked={hapusData} disabled={sibuk} onChange={() => setHapusData(true)} />
              <span style={{ fontSize: "0.88rem" }}>
                <strong>Hapus data dari perangkat ini</strong> (disarankan). Dikirim ke Drive dulu; kunci aplikasi dan Authenticator di
                perangkat ini ikut dihapus.
              </span>
            </label>
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="radio" name="keluar-data" id="keluar-simpan" style={gayaKotakPilihan} checked={!hapusData} disabled={sibuk} onChange={() => setHapusData(false)} />
              <span style={{ fontSize: "0.88rem" }}>
                <strong>Simpan data di perangkat ini</strong>. Salinan tetap ada dan ditulis balik ke Drive saat Anda masuk lagi.
              </span>
            </label>
          </div>
        )}

        {gagalKirim !== null && (
          <div
            role="alert"
            id="keluar-galat"
            style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", fontSize: "0.85rem", margin: "10px 0" }}
          >
            {gagalKirim} Data yang belum terkirim akan hilang bila dihapus sekarang.
          </div>
        )}

        {butuhPersetujuan && (
          <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "0.85rem", margin: "10px 0", cursor: "pointer" }}>
            <input type="checkbox" id="keluar-setuju" style={gayaKotakPilihan} checked={setujuTanpaKirim} disabled={sibuk} onChange={(e) => setSetujuTanpaKirim(e.target.checked)} />
            <span>
              {tersambung
                ? "Saya mengerti: yang belum terkirim ke Drive hilang dari perangkat ini."
                : "Saya mengerti: data yang belum pernah dikirim ke Drive hilang dari perangkat ini."}
            </span>
          </label>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
          <button
            type="button"
            className="btn-primary"
            style={hapusData ? { background: "var(--keluar)", borderColor: "var(--keluar)" } : undefined}
            id="keluar-lanjut"
            disabled={sibuk || (butuhPersetujuan && !setujuTanpaKirim)}
            onClick={() => void jalankan()}
          >
            {sibuk ? "Memproses…" : judulAksi}
          </button>
          <button type="button" className="btn-secondary" id="keluar-batal" disabled={sibuk} onClick={onTutup}>
            Batal
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
