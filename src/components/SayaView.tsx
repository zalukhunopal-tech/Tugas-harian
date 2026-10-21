import React, { useState } from "react";
import { KarakterId, TemaId, Transaksi, AsetItem } from "../types";
import { KARAKTER } from "../lib/constants";
import { KarakterAnimasi } from "./KarakterAnimasi";
import { User } from "firebase/auth";
import { KeuanganDriveContents } from "../lib/gdriveSync";
import { cekStatusSesiGoogle } from "../lib/googleAuth";

interface SayaViewProps {
  tema: TemaId;
  karakter: KarakterId;
  onGantiTema: (tema: TemaId) => void;
  onGantiKarakter: (karakter: KarakterId) => void;

  // Google Drive Direct Sync
  googleUser: User | null;
  googleLoading: boolean;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  driveContents: KeuanganDriveContents | null;
  memuatDrive: boolean;
  onPeriksaDrive: () => Promise<void>;
  onTarikDariDrive: () => Promise<void>;
  onKirimKeDrive: () => Promise<void>;

  transaksi: Transaksi[];
  aset: AsetItem[];
  syncStatusPesan: string;
  onBukaTransaksiBerulang?: () => void;
  jumlahTransaksiBerulang?: number;
}

export const SayaView: React.FC<SayaViewProps> = ({
  tema,
  karakter,
  onGantiTema,
  onGantiKarakter,
  googleUser,
  googleLoading,
  onGoogleLogin,
  onGoogleLogout,
  driveContents,
  memuatDrive,
  onPeriksaDrive,
  onTarikDariDrive,
  onKirimKeDrive,
  transaksi,
  aset,
  syncStatusPesan,
  onBukaTransaksiBerulang,
  jumlahTransaksiBerulang = 0,
}) => {
  const handleExportCSV = () => {
    if (transaksi.length === 0) {
      alert("Belum ada transaksi untuk diunduh.");
      return;
    }
    const header = [
      "Tanggal",
      "Jenis",
      "Dana",
      "Uraian",
      "Kategori",
      "Jumlah",
      "Metode Bayar",
      "Sumber / Tujuan",
      "Catatan",
      "ID",
    ];
    const rows = transaksi.map((t) => [
      t.tanggal,
      t.jenis,
      t.dana,
      `"${(t.deskripsi || "").replace(/"/g, '""')}"`,
      `"${(t.kategori || "").replace(/"/g, '""')}"`,
      t.jumlah,
      `"${(t.metode || "").replace(/"/g, '""')}"`,
      `"${(t.kaitan || "").replace(/"/g, '""')}"`,
      `"${(t.catatan || "").replace(/"/g, '""')}"`,
      t.id,
    ]);
    const csvContent = "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="view" id="view-saya" data-view="saya">
      {/* ===== Folder 1: Sinkronisasi Google Drive (Folder Keuangan) ===== */}
      <details className="folder" id="folder-gdrive" open>
        <summary>
          <span className="folder-icon" aria-hidden="true"></span>
          <span className="folder-title">Folder Keuangan di Google Drive</span>
          <span className="folder-hint" id="hint-gdrive">
            {googleUser ? "terhubung" : "belum masuk"}
          </span>
        </summary>
        <div className="folder-body">
          <p className="help">
            Sinkronkan langsung data transaksi dan aset dengan folder <strong>Keuangan</strong> di
            Google Drive Anda, termasuk spreadsheet <em>Keuangan Pribadi</em>,{" "}
            <em>Keuangan Kegiatan</em>, dan file <em>Aset.json</em>.
          </p>

          {!googleUser ? (
            <div style={{ margin: "14px 0" }}>
              <button
                type="button"
                className="gsi-material-button"
                onClick={() => void onGoogleLogin()}
                disabled={googleLoading}
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: "block" }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {googleLoading ? "Menghubungkan…" : "Masuk dengan Google & Sinkron Drive"}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div>
              <div className="gdrive-user-card">
                <div className="gdrive-user-info">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName || "User"}
                      style={{ width: 36, height: 36, borderRadius: "50%" }}
                    />
                  ) : (
                    <div className="gdrive-avatar">
                      {(googleUser.displayName || googleUser.email || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong>{googleUser.displayName || "Pengguna Google"}</strong>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {googleUser.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-small btn-delete"
                  onClick={() => void onGoogleLogout()}
                >
                  Keluar
                </button>
              </div>

              {/* Status Masa Berlaku Sesi 3 Bulan */}
              {(() => {
                const statusSesi = cekStatusSesiGoogle();
                return (
                  <div
                    style={{
                      margin: "8px 0 10px",
                      padding: "8px 11px",
                      borderRadius: "10px",
                      background: statusSesi.kedaluwarsa
                        ? "rgba(239, 68, 68, 0.12)"
                        : "rgba(34, 197, 94, 0.1)",
                      border: `1px solid ${
                        statusSesi.kedaluwarsa
                          ? "rgba(239, 68, 68, 0.3)"
                          : "rgba(34, 197, 94, 0.3)"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: statusSesi.kedaluwarsa ? "#ef4444" : "#22c55e",
                      }}
                    >
                      <span>{statusSesi.kedaluwarsa ? "⚠️" : "🔒"}</span>
                      <span>
                        {statusSesi.kedaluwarsa
                          ? "Sesi Sinkronisasi 3 Bulan Kedaluwarsa"
                          : `Sesi Sinkronisasi 3 Bulan Aktif (${statusSesi.sisaHari} Hari Tersisa)`}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "0.74rem",
                        color: "var(--muted)",
                        lineHeight: 1.35,
                      }}
                    >
                      {statusSesi.kedaluwarsa
                        ? "Batas waktu 3 bulan telah berakhir. Silakan masuk ulang dengan Google untuk memperpanjang."
                        : `Sesi login & sinkronisasi Drive disimpan otomatis hingga ${statusSesi.tanggalKedaluwarsa}. Aplikasi tetap tersambung tanpa perlu login ulang.`}
                    </p>
                  </div>
                );
              })()}

              {driveContents ? (
                <div className="gdrive-folder-status">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>
                      Folder: <strong>{driveContents.folder.name}</strong>
                    </span>
                    {driveContents.folder.webViewLink && (
                      <a
                        href={driveContents.folder.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-link"
                        style={{ fontSize: "0.8rem" }}
                      >
                        Buka di Drive ↗
                      </a>
                    )}
                  </div>

                  <div className="gdrive-badge-row">
                    <span
                      className={`gdrive-badge ${driveContents.sheetPribadi ? "ok" : ""}`}
                    >
                      {driveContents.sheetPribadi ? "✓ Keuangan Pribadi" : "— Keuangan Pribadi"}
                    </span>
                    <span
                      className={`gdrive-badge ${driveContents.sheetKegiatan ? "ok" : ""}`}
                    >
                      {driveContents.sheetKegiatan ? "✓ Keuangan Kegiatan" : "— Keuangan Kegiatan"}
                    </span>
                    <span className={`gdrive-badge ${driveContents.fileAset ? "ok" : ""}`}>
                      {driveContents.fileAset ? "✓ Aset.json" : "— Aset.json"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="help">
                  {memuatDrive ? "Mencari folder Keuangan di Google Drive…" : "Folder belum diperiksa."}
                </p>
              )}

              <div className="sync-buttons">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={memuatDrive}
                  onClick={() => void onTarikDariDrive()}
                >
                  {memuatDrive ? "Memproses…" : "Tarik Data dari Folder Keuangan"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={memuatDrive}
                  onClick={() => void onKirimKeDrive()}
                >
                  Kirim Data Lokal ke Folder Keuangan
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExportCSV}
                >
                  Unduh CSV ({transaksi.length} transaksi)
                </button>
              </div>
            </div>
          )}

          {syncStatusPesan && (
            <p id="sync-detail" className="help" style={{ marginTop: "10px" }}>
              {syncStatusPesan}
            </p>
          )}
        </div>
      </details>

      {/* ===== Folder 2: Tema & Karakter ===== */}
      <details className="folder" id="folder-tema" open>
        <summary>
          <span className="folder-icon" aria-hidden="true"></span>
          <span className="folder-title">Tema &amp; Karakter</span>
          <span className="folder-hint" id="hint-tema">
            {tema === "jujutsu" ? KARAKTER[karakter].nama : "Standar"}
          </span>
        </summary>
        <div className="folder-body">
          <div className="theme-row">
            <button
              type="button"
              id="btn-tema"
              className="btn-small"
              onClick={() => onGantiTema(tema === "jujutsu" ? "standar" : "jujutsu")}
            >
              {tema === "jujutsu" ? "Ganti ke Tema standar" : "Ganti ke Tema Jujutsu"}
            </button>
            <span className="help">Pilihan tema dan karakter tersimpan di browser ini.</span>
          </div>

          {tema === "jujutsu" && (
            <>
              {/* Kartu Pendamping Karakter Animasi Aktif */}
              <div className="karakter-mascot-card">
                <KarakterAnimasi
                  karakter={karakter}
                  ukuran={64}
                  showAura
                  interaktif
                />
                <div className="karakter-mascot-info">
                  <span className="karakter-mascot-role">Pendamping Aktif</span>
                  <div className="karakter-mascot-nama">
                    {KARAKTER[karakter].nama}
                  </div>
                  <div className="karakter-mascot-quote">
                    "{KARAKTER[karakter].tagline}"
                  </div>
                </div>
              </div>

              <div
                className="karakter-grid"
                id="karakter-grid"
                role="radiogroup"
                aria-label="Pilih karakter"
              >
                {(Object.keys(KARAKTER) as KarakterId[]).map((kId) => {
                  const k = KARAKTER[kId];
                  const aktif = karakter === kId;
                  return (
                    <button
                      key={kId}
                      type="button"
                      className={`karakter ${aktif ? "aktif" : ""}`}
                      data-karakter={kId}
                      role="radio"
                      aria-checked={aktif}
                      onClick={() => onGantiKarakter(kId)}
                    >
                      <span className="karakter-lambang">
                        <KarakterAnimasi
                          karakter={kId}
                          ukuran={44}
                          showAura={aktif}
                        />
                      </span>
                      <div className="karakter-info">
                        <span className="karakter-nama">{k.nama}</span>
                        <span className="karakter-teknik">{k.teknik}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </details>

      {/* ===== Folder 4: Transaksi Berulang (Rutin) ===== */}
      <details className="folder" id="folder-berulang" open>
        <summary>
          <span className="folder-icon" aria-hidden="true">🔁</span>
          <span className="folder-title">Transaksi Berulang (Rutin)</span>
          <span className="folder-hint" id="hint-berulang">
            {jumlahTransaksiBerulang > 0 ? `${jumlahTransaksiBerulang} jadwal aktif` : "jadwal rutin"}
          </span>
        </summary>
        <div className="folder-body">
          <p className="help">
            Otomatisasi pencatatan keuangan rutin seperti gaji bulanan, uang sewa kos, tagihan listrik &amp; internet, cicilan, maupun langganan streaming bulanan.
          </p>
          {onBukaTransaksiBerulang && (
            <div className="sync-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={onBukaTransaksiBerulang}
                style={{ width: "100%", justifyContent: "center" }}
              >
                🔁 Buka &amp; Kelola Transaksi Berulang
              </button>
            </div>
          )}
        </div>
      </details>

    </section>
  );
};
