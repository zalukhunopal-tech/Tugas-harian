import React, { useState } from "react";
import { ArrowLeft, CalendarClock, Cloud, FileText, Fingerprint, IdCard, Minus, Palette, Plus, Users, type LucideIcon } from "lucide-react";
import { KarakterId, TemaId, Transaksi, AsetItem, AppLockConfig, ProfilPelapor, DataKegiatan } from "../types";
import { KARAKTER, PROFIL_PELAPOR_DEFAULT } from "../lib/constants";
import { TOKOH_TEMA, rgbTriplet } from "../lib/tokohTema";
import { KarakterAnimasi } from "./KarakterAnimasi";
import { User } from "firebase/auth";
import { KeuanganDriveContents } from "../lib/gdriveSync";
import { cekStatusSesiGoogle } from "../lib/googleAuth";
import { AppLockKelolaModal } from "./AppLockKelolaModal";
import { TotpKelolaModal } from "./TotpKelolaModal";
import { LABEL_INTERVAL, muatTotp } from "../lib/totp";
import { LaporanView } from "./LaporanView";
import { KeluargaView } from "./KeluargaView";
import { HasilKirim, KeluarDriveModal } from "./KeluarDriveModal";
import { adaDataDiPerangkat } from "../lib/bersihkanPerangkat";

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
  /** Kirim data ke Drive sebelum dihapus dari perangkat saat keluar. */
  onKirimSebelumKeluar?: () => Promise<HasilKirim>;
  /** Putus akun, hapus data keuangan dari perangkat ini, lalu muat ulang aplikasi. */
  onKeluarDanHapus?: () => Promise<void>;
  driveContents: KeuanganDriveContents | null;
  memuatDrive: boolean;
  onPeriksaDrive: () => Promise<void>;
  onTarikDariDrive: () => Promise<void>;
  onKirimKeDrive: () => Promise<void>;

  // Multi-Akun Google
  daftarAkunGoogle?: import("../lib/googleAuth").AkunGoogleTersimpan[];
  onBeralihAkun?: (emailOrUid: string) => Promise<void>;
  onTambahAkun?: () => Promise<string | null>;
  onHapusAkun?: (emailOrUid: string) => Promise<void>;

  transaksi: Transaksi[];
  aset: AsetItem[];
  syncStatusPesan: string;
  onBukaTransaksiBerulang?: () => void;
  jumlahTransaksiBerulang?: number;

  appLockConfig?: AppLockConfig;
  onSimpanAppLockConfig?: (config: AppLockConfig) => void;

  profilPelapor?: ProfilPelapor;
  onSimpanProfilPelapor?: (profil: ProfilPelapor) => void;

  // Laporan Dana Kegiatan
  daftarKegiatan?: DataKegiatan[];
  onUpdateKegiatan?: (kegiatan: DataKegiatan) => void;
  onTambahKegiatan?: (kegiatan: DataKegiatan) => void;
  googleToken?: string;
  /** Token Google saat ini; dipakai Keluarga & Komunitas untuk membagikan dan membaca berkas di Drive. */
  ambilToken?: () => Promise<string | null>;
}

/** Aplikasi-aplikasi di tab Saya: tiap pilihan tampil sebagai ikon di layar utama, lalu membuka isinya satu per satu. */
type IdAplikasi = "drive" | "laporan" | "keluarga" | "tema" | "rutin" | "kunci";

interface AplikasiSaya {
  id: IdAplikasi;
  nama: string;
  /** Teks status kecil di bawah nama (bekas "petunjuk" di baris folder). */
  status: string;
  ikon: LucideIcon;
  /** Dua warna gradasi ikon. */
  warna: [string, string];
  /** Bulatan kecil di sudut ikon: hijau = aktif/terhubung, kuning = perlu perhatian. */
  titik?: "ok" | "perhatian";
  /** Angka di sudut ikon (mis. jumlah jadwal aktif). */
  angka?: number;
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
  onKirimSebelumKeluar,
  onKeluarDanHapus,
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
  appLockConfig = { enabled: false, pinHash: "", salt: "", webAuthnEnabled: false },
  onSimpanAppLockConfig,
  profilPelapor,
  onSimpanProfilPelapor,
  daftarKegiatan = [],
  onUpdateKegiatan,
  onTambahKegiatan,
  googleToken,
  ambilToken,
  daftarAkunGoogle = [],
  onBeralihAkun,
  onTambahAkun,
  onHapusAkun,
}) => {
  const [appAktif, setAppAktif] = useState<IdAplikasi | null>(null);
  const [modalAppLockBuka, setModalAppLockBuka] = useState(false);
  const [modalTotpBuka, setModalTotpBuka] = useState(false);
  const [modalKeluarBuka, setModalKeluarBuka] = useState(false);
  const [totp, setTotp] = useState(() => muatTotp());
  const [ukuranIkonPx, setUkuranIkonPx] = useState<number>(() => {
    try {
      const u = localStorage.getItem("keuangan-ukuran-ikon-px");
      if (u) {
        const val = Number(u);
        if (!isNaN(val) && val >= 52 && val <= 92) return val;
      }
    } catch (_) {}
    return 70; // Standar default: 4 kolom
  });

  const handleGantiUkuran = (val: number) => {
    const clamped = Math.max(52, Math.min(92, val));
    setUkuranIkonPx(clamped);
    try {
      localStorage.setItem("keuangan-ukuran-ikon-px", String(clamped));
    } catch (_) {}
  };

  // Menentukan jumlah kolom dan label berdasarkan ukuran ikon sehingga pilihan berpindah posisi saat ukuran dinaik-turunkan
  const infoUkuran = React.useMemo(() => {
    if (ukuranIkonPx < 58) {
      return { kolom: 6, label: "Sangat Kecil", gapX: 4, gapY: 14 };
    }
    if (ukuranIkonPx < 66) {
      return { kolom: 5, label: "Kecil", gapX: 6, gapY: 18 };
    }
    if (ukuranIkonPx <= 76) {
      return { kolom: 4, label: "Standar", gapX: 8, gapY: 24 };
    }
    if (ukuranIkonPx <= 84) {
      return { kolom: 3, label: "Besar", gapX: 14, gapY: 28 };
    }
    return { kolom: 2, label: "Sangat Besar", gapX: 20, gapY: 32 };
  }, [ukuranIkonPx]);

  const [profilForm, setProfilForm] = useState<ProfilPelapor>(() => {
    return profilPelapor || PROFIL_PELAPOR_DEFAULT;
  });
  const [statusSimpanProfil, setStatusSimpanProfil] = useState<string>("");
  // Profil Pelapor kini bagian dari Laporan Kegiatan: terbuka sendiri selama belum diisi, terlipat bila sudah.
  const [profilTerbuka, setProfilTerbuka] = useState<boolean>(() => !profilPelapor?.nama);

  React.useEffect(() => {
    if (profilPelapor) {
      setProfilForm(profilPelapor);
    }
  }, [profilPelapor]);

  const handleSimpanProfil = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSimpanProfilPelapor) {
      onSimpanProfilPelapor({
        ...profilForm,
        diubah: new Date().toISOString(),
      });
      setStatusSimpanProfil("Profil pelapor tersimpan");
      setTimeout(() => setStatusSimpanProfil(""), 3000);
    }
  };

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


  // Isi tiap aplikasi: sama dengan isi folder sebelumnya.
  const isiDrive = (
    <>
          <p className="help">
            Sinkronkan langsung data transaksi dan aset dengan folder <strong>Keuangan</strong> di
            Google Drive Anda, termasuk spreadsheet <em>Keuangan Pribadi</em>,{" "}
            <em>Keuangan Kegiatan</em>, dan file <em>Aset.json</em>.
          </p>

          {!googleUser ? (
            <div style={{ margin: "14px 0" }}>
              {daftarAkunGoogle && daftarAkunGoogle.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px", color: "var(--text)" }}>
                    Pilih Akun yang Tersimpan di Perangkat:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {daftarAkunGoogle.map((akun) => (
                      <div
                        key={akun.uid || akun.email}
                        className="gdrive-user-card"
                        style={{ margin: 0, padding: "10px 12px" }}
                      >
                        <div className="gdrive-user-info">
                          {akun.photoURL ? (
                            <img
                              src={akun.photoURL}
                              alt={akun.displayName || "User"}
                              style={{ width: 34, height: 34, borderRadius: "50%" }}
                            />
                          ) : (
                            <div className="gdrive-avatar" style={{ width: 34, height: 34, fontSize: "0.85rem" }}>
                              {(akun.displayName || akun.email || "U")[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <strong style={{ fontSize: "0.88rem" }}>{akun.displayName || "Pengguna Google"}</strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{akun.email}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="btn-small btn-primary"
                            onClick={() => onBeralihAkun && void onBeralihAkun(akun.email || akun.uid)}
                          >
                            Aktifkan
                          </button>
                          {onHapusAkun && (
                            <button
                              type="button"
                              className="btn-small btn-delete"
                              title="Hapus akun dan datanya dari perangkat ini"
                              onClick={() => {
                                if (window.confirm(`Hapus akun ${akun.email} dan data lokalnya dari perangkat ini?`)) {
                                  void onHapusAkun(akun.email || akun.uid);
                                }
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              {onKeluarDanHapus && (transaksi.length > 0 || aset.length > 0 || adaDataDiPerangkat()) && (
                <p className="help" style={{ marginTop: "12px" }}>
                  Data keuangan masih tersimpan di perangkat ini.{" "}
                  <button type="button" className="btn-link" id="btn-hapus-data-perangkat" onClick={() => setModalKeluarBuka(true)}>
                    Hapus dari perangkat ini
                  </button>
                </p>
              )}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong>{googleUser.displayName || "Pengguna Google"}</strong>
                      <span
                        className="gdrive-badge"
                        style={{
                          background: "rgba(34, 197, 94, 0.2)",
                          color: "#22c55e",
                          fontSize: "0.7rem",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        Aktif
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {googleUser.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-small btn-delete"
                  id="btn-keluar-drive"
                  onClick={() => setModalKeluarBuka(true)}
                >
                  Keluar
                </button>
              </div>

              {/* Beralih ke Akun Lain yang Sudah Ada di Perangkat */}
              {daftarAkunGoogle &&
                daftarAkunGoogle.filter((a) => a.email !== googleUser.email).length > 0 && (
                  <div
                    style={{
                      margin: "8px 0 12px",
                      padding: "10px 12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px dashed var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        marginBottom: "8px",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Beralih ke Akun Lain di Perangkat Ini:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {daftarAkunGoogle
                        .filter((a) => a.email !== googleUser.email)
                        .map((akun) => (
                          <div
                            key={akun.uid || akun.email}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 8px",
                              background: "var(--surface)",
                              borderRadius: "6px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {akun.photoURL ? (
                                <img
                                  src={akun.photoURL}
                                  alt=""
                                  style={{ width: 28, height: 28, borderRadius: "50%" }}
                                />
                              ) : (
                                <div
                                  className="gdrive-avatar"
                                  style={{ width: 28, height: 28, fontSize: "0.8rem" }}
                                >
                                  {(akun.displayName || akun.email || "U")[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                                  {akun.displayName || akun.email}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                                  {akun.email}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                className="btn-small"
                                style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                                onClick={() =>
                                  onBeralihAkun && void onBeralihAkun(akun.email || akun.uid)
                                }
                              >
                                Ganti Akun
                              </button>
                              {onHapusAkun && (
                                <button
                                  type="button"
                                  className="btn-small btn-delete"
                                  style={{ fontSize: "0.75rem", padding: "3px 6px" }}
                                  title="Hapus dari perangkat"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Hapus data akun ${akun.email} dari perangkat ini?`
                                      )
                                    ) {
                                      void onHapusAkun(akun.email || akun.uid);
                                    }
                                  }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Tombol Tambah / Masuk dengan Akun Google Lain */}
              <div style={{ margin: "6px 0 12px" }}>
                <button
                  type="button"
                  className="btn-small btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", justifyContent: "center", padding: "8px 12px" }}
                  onClick={() => {
                    if (onTambahAkun) void onTambahAkun();
                    else void onGoogleLogin();
                  }}
                  disabled={googleLoading}
                >
                  <span style={{ fontSize: "0.95rem" }}>➕</span>
                  <span style={{ fontWeight: 600 }}>
                    {googleLoading ? "Menghubungkan…" : "Tambah / Masuk Akun Google Lain"}
                  </span>
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
                    <span className={`gdrive-badge ${driveContents.fileLaporanKegiatan ? "ok" : ""}`}>
                      {driveContents.fileLaporanKegiatan ? "✓ Laporan Kegiatan.json" : "— Laporan Kegiatan.json"}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="help">
                    {memuatDrive
                      ? "Memeriksa folder Keuangan di Google Drive…"
                      : "Folder belum diperiksa. Bila folder 'Keuangan' belum ada, aplikasi membuatnya otomatis beserta isinya."}
                  </p>
                  <div className="sync-buttons">
                    <button type="button" className="btn-secondary" disabled={memuatDrive} onClick={() => void onPeriksaDrive()}>
                      Periksa &amp; siapkan folder Keuangan
                    </button>
                  </div>
                </div>
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
    </>
  );

  const isiProfil = (
    <>
          <p className="help">
            Profil pelapor digunakan sebagai identitas resmi penyusun Laporan Pertanggungjawaban (SPJ) Dana Kegiatan.
            Data ini tersimpan aman di berkas <code>Laporan Kegiatan.json</code> di folder Keuangan dan tersinkronisasi otomatis.
          </p>

          <form
            onSubmit={handleSimpanProfil}
            className="profil-pelapor-form md:grid-cols-2"
          >
            {/* Baris 1 kiri di PC: Nama Lengkap Pelapor */}
            <div className="input-field profil-field-nama">
              <label htmlFor="profil-nama" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Nama Lengkap Pelapor
              </label>
              <input
                id="profil-nama"
                type="text"
                value={profilForm.nama}
                onChange={(e) => setProfilForm({ ...profilForm, nama: e.target.value })}
                placeholder="Nama pelapor"
                required
              />
            </div>

            {/* Baris 1 kanan di PC: Jabatan */}
            <div className="input-field profil-field-jabatan">
              <label htmlFor="profil-jabatan" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Jabatan
              </label>
              <input
                id="profil-jabatan"
                type="text"
                value={profilForm.jabatan}
                onChange={(e) => setProfilForm({ ...profilForm, jabatan: e.target.value })}
                placeholder="Contoh: Surveyor"
                required
              />
            </div>

            {/* Baris 2 kiri di PC: Lembaga / Organisasi */}
            <div className="input-field profil-field-lembaga">
              <label htmlFor="profil-lembaga" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Lembaga / Organisasi
              </label>
              <input
                id="profil-lembaga"
                type="text"
                value={profilForm.lembaga}
                onChange={(e) => setProfilForm({ ...profilForm, lembaga: e.target.value })}
                placeholder="Contoh: Nama lembaga atau organisasi"
                required
              />
            </div>

            {/* Baris 2 kanan di PC: Nama Proyek / Lanskap */}
            <div className="input-field profil-field-proyek">
              <label htmlFor="profil-proyek" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Nama Proyek / Lanskap
              </label>
              <input
                id="profil-proyek"
                type="text"
                value={profilForm.proyek}
                onChange={(e) => setProfilForm({ ...profilForm, proyek: e.target.value })}
                placeholder="Contoh: Nama proyek atau lanskap"
                required
              />
            </div>

            {/* Baris terpisah di bawah: Keterangan Awal & Tombol Simpan (md:col-span-2) */}
            <div className="profil-pelapor-footer md:col-span-2">
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Isi sekali; tersimpan di perangkat ini dan di Drive Anda.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {statusSimpanProfil && (
                  <span style={{ fontSize: "0.82rem", color: "#10b981", fontWeight: 700 }}>
                    ✓ {statusSimpanProfil}
                  </span>
                )}
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: "0.88rem", whiteSpace: "nowrap" }}
                >
                  Simpan Profil Pelapor
                </button>
              </div>
            </div>
          </form>
    </>
  );

  const isiTema = (
    <>
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
                  const t = TOKOH_TEMA[kId];
                  const aktif = karakter === kId;
                  return (
                    <button
                      key={kId}
                      type="button"
                      className={`tokoh-kartu ${aktif ? "aktif" : ""}`}
                      data-karakter={kId}
                      role="radio"
                      aria-checked={aktif}
                      onClick={() => onGantiKarakter(kId)}
                      style={
                        {
                          "--tokoh": rgbTriplet(t.warna),
                          "--tokoh-2": rgbTriplet(t.warnaKedua),
                        } as React.CSSProperties
                      }
                    >
                      <span className="tokoh-avatar" aria-hidden="true">
                        <img src={t.avatar} alt="" width={156} height={156} decoding="async" />
                      </span>
                      <span className="tokoh-info">
                        <span className="tokoh-nama">{k.nama}</span>
                        <span className="tokoh-teknik">{k.teknik}</span>
                      </span>
                      <span className="tokoh-ilustrasi" aria-hidden="true">
                        <img src={t.banner} alt="" loading="lazy" decoding="async" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
    </>
  );

  const isiRutin = (
    <>
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
    </>
  );

  const isiKunci = (
    <>
          <p className="help">
            Amankan privasi data keuangan Anda dengan PIN 4–6 digit angka dan autentikasi biometrik
            (Sidik Jari / Face ID melalui WebAuthn). Aplikasi otomatis terkunci setelah ditinggal di latar belakang selama 1 menit.
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: appLockConfig.enabled ? "rgba(16, 185, 129, 0.12)" : "var(--surface-hover, rgba(255, 255, 255, 0.04))",
              border: `1px solid ${appLockConfig.enabled ? "#10b981" : "var(--border)"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: appLockConfig.enabled ? "#10b981" : "var(--text)" }}>
                {appLockConfig.enabled ? "🔒 Kunci Aplikasi Aktif" : "🔓 Kunci Aplikasi Nonaktif"}
              </div>
              <span className="help" style={{ fontSize: "0.78rem" }}>
                {appLockConfig.enabled
                  ? `PIN tersimpan aman (SHA-256)${appLockConfig.webAuthnEnabled ? " • Biometrik aktif" : ""}`
                  : "Aplikasi dapat dibuka langsung tanpa verifikasi"}
              </span>
            </div>

            <button
              type="button"
              className={appLockConfig.enabled ? "btn-secondary" : "btn-primary"}
              onClick={() => setModalAppLockBuka(true)}
              style={{ fontSize: "0.85rem", padding: "8px 16px", fontWeight: 700 }}
            >
              {appLockConfig.enabled ? "Kelola Kunci / PIN" : "Aktifkan Kunci Aplikasi"}
            </button>
          </div>

          <div
            id="kartu-totp"
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: totp ? "rgba(16, 185, 129, 0.12)" : "var(--surface-hover, rgba(255, 255, 255, 0.04))",
              border: `1px solid ${totp ? "#10b981" : "var(--border)"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: totp ? "#10b981" : "var(--text)" }}>
                {totp ? "🔐 Google Authenticator Aktif" : "🔐 Google Authenticator"}
              </div>
              <span className="help" style={{ fontSize: "0.78rem", overflowWrap: "anywhere" }}>
                {totp
                  ? `Akun tertaut: ${totp.email || "—"} • ${LABEL_INTERVAL[totp.interval]}`
                  : appLockConfig.enabled
                    ? "Langkah kedua setelah PIN: kode 6 angka dari ponsel, terikat ke akun email Google Drive Anda."
                    : "Aktifkan Kunci Aplikasi (PIN) lebih dulu untuk memakai langkah kedua ini."}
              </span>
            </div>
            <button
              type="button"
              id="btn-totp"
              className={totp ? "btn-secondary" : "btn-primary"}
              disabled={!appLockConfig.enabled && !totp}
              onClick={() => setModalTotpBuka(true)}
              style={{ fontSize: "0.85rem", padding: "8px 16px", fontWeight: 700 }}
            >
              {totp ? "Kelola" : "Aktifkan"}
            </button>
          </div>
    </>
  );

  const aplikasi: AplikasiSaya[] = [
    {
      id: "drive",
      nama: "Drive Keuangan",
      status: googleUser ? "terhubung" : "belum masuk",
      ikon: Cloud,
      warna: ["#3b82f6", "#06b6d4"],
      titik: googleUser ? "ok" : "perhatian",
    },
    {
      id: "laporan",
      nama: "Laporan Kegiatan",
      status: !profilForm.nama
        ? "profil pelapor belum diisi"
        : daftarKegiatan.length > 0
          ? `${daftarKegiatan.length} kegiatan`
          : "SPJ, timesheet & profil",
      ikon: FileText,
      warna: ["#f59e0b", "#f97316"],
      titik: profilForm.nama ? undefined : "perhatian",
    },
    {
      id: "keluarga",
      nama: "Keluarga",
      status: googleUser ? "hubungkan & bagikan" : "masuk Google dulu",
      ikon: Users,
      warna: ["#f43f5e", "#be123c"],
    },
    {
      id: "tema",
      nama: "Tema & Karakter",
      status: tema === "jujutsu" ? KARAKTER[karakter].nama : "Standar",
      ikon: Palette,
      warna: tema === "jujutsu" ? [TOKOH_TEMA[karakter].warna, TOKOH_TEMA[karakter].warnaKedua] : ["#ec4899", "#f97316"],
    },
    {
      id: "rutin",
      nama: "Transaksi Rutin",
      status: jumlahTransaksiBerulang > 0 ? `${jumlahTransaksiBerulang} jadwal aktif` : "jadwal rutin",
      ikon: CalendarClock,
      warna: ["#10b981", "#14b8a6"],
      angka: jumlahTransaksiBerulang > 0 ? jumlahTransaksiBerulang : undefined,
    },
    {
      id: "kunci",
      nama: "Kunci Aplikasi",
      status: appLockConfig.enabled ? "aktif" : "nonaktif",
      ikon: Fingerprint,
      warna: ["#64748b", "#334155"],
      titik: appLockConfig.enabled ? "ok" : "perhatian",
    },
  ];

  const aplikasiAktif = aplikasi.find((a) => a.id === appAktif) ?? null;

  const bukaAplikasi = (id: IdAplikasi | null) => {
    setAppAktif(id);
    window.scrollTo({ top: 0 });
  };

  const gayaIkon = (a: AplikasiSaya) =>
    ({ "--ikon-1": a.warna[0], "--ikon-2": a.warna[1] }) as React.CSSProperties;

  return (
    <section className="view" id="view-saya" data-view="saya">
      {!aplikasiAktif ? (
        <>
          {/* Judul dan pengatur ukuran ikon dalam satu baris tipis: garis geser diapit − dan +, jumlah kolom sebagai teks redup. */}
          <div className="saya-peluncur-topbar no-print">
            <div className="saya-peluncur-judul">
              Layanan &amp; Fitur
              <span className="saya-peluncur-kolom" title={infoUkuran.label}>
                {infoUkuran.kolom} kolom
              </span>
            </div>
            <div className="saya-ukuran" role="group" aria-label="Ukuran ikon">
              <button
                type="button"
                className="saya-ukuran-btn"
                onClick={() => handleGantiUkuran(ukuranIkonPx - 6)}
                disabled={ukuranIkonPx <= 52}
                aria-label="Perkecil ikon"
                title="Perkecil ikon"
              >
                <Minus size={14} strokeWidth={2.4} />
              </button>
              <input
                type="range"
                className="saya-ukuran-geser"
                min="52"
                max="92"
                step="2"
                value={ukuranIkonPx}
                onChange={(e) => handleGantiUkuran(Number(e.target.value))}
                aria-label="Ukuran ikon"
                aria-valuetext={`${infoUkuran.kolom} kolom, ${infoUkuran.label}`}
                style={{ "--isi": `${((ukuranIkonPx - 52) / 40) * 100}%` } as React.CSSProperties}
              />
              <button
                type="button"
                className="saya-ukuran-btn"
                onClick={() => handleGantiUkuran(ukuranIkonPx + 6)}
                disabled={ukuranIkonPx >= 92}
                aria-label="Perbesar ikon"
                title="Perbesar ikon"
              >
                <Plus size={14} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <nav
            className="saya-peluncur"
            style={{
              "--saya-kolom": infoUkuran.kolom,
              "--saya-ukuran": `${ukuranIkonPx}px`,
              "--saya-gap-y": `${infoUkuran.gapY}px`,
              "--saya-gap-x": `${infoUkuran.gapX}px`,
            } as React.CSSProperties}
            aria-label="Aplikasi"
          >
            {aplikasi.map((a) => {
              const Ikon = a.ikon;
              const pakaiAvatar = a.id === "tema" && tema === "jujutsu";
              const svgUkuran = Math.round(ukuranIkonPx * 0.44);
              return (
                <button
                  key={a.id}
                  type="button"
                  className="saya-app"
                  data-app={a.id}
                  onClick={() => bukaAplikasi(a.id)}
                >
                  <span className="saya-app-ikon" style={gayaIkon(a)} aria-hidden="true">
                    {pakaiAvatar ? (
                      <img className="saya-app-avatar" src={TOKOH_TEMA[karakter].avatar} alt="" width={156} height={156} decoding="async" />
                    ) : (
                      <Ikon size={svgUkuran} strokeWidth={1.9} />
                    )}
                    {a.titik && <span className={`saya-app-titik ${a.titik}`} />}
                    {a.angka !== undefined && <span className="saya-app-angka">{a.angka}</span>}
                  </span>
                  <span className="saya-app-nama">{a.nama}</span>
                  <span className="saya-app-status">{a.status}</span>
                </button>
              );
            })}
          </nav>
        </>
      ) : (
        <>
          <div className="saya-appbar no-print">
            <button type="button" className="saya-kembali" onClick={() => bukaAplikasi(null)} aria-label="Kembali ke daftar aplikasi">
              <ArrowLeft size={22} strokeWidth={2.6} />
            </button>
            <span className="saya-appbar-ikon" style={gayaIkon(aplikasiAktif)} aria-hidden="true">
              {aplikasiAktif.id === "tema" && tema === "jujutsu" ? (
                <img className="saya-app-avatar" src={TOKOH_TEMA[karakter].avatar} alt="" width={156} height={156} decoding="async" />
              ) : (
                <aplikasiAktif.ikon size={18} strokeWidth={2} />
              )}
            </span>
            <h2 className="saya-appbar-judul">{aplikasiAktif.nama}</h2>
          </div>

          {aplikasiAktif.id === "laporan" ? (
            <>
              {/* Profil Pelapor (identitas penyusun SPJ) digabung ke Laporan Kegiatan; tidak ikut dicetak. */}
              <details
                className="folder saya-panel profil-lipat no-print"
                id="panel-profil"
                open={profilTerbuka}
                onToggle={(e) => setProfilTerbuka((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="profil-lipat__ringkas">
                  <span className="profil-lipat__ikon" aria-hidden="true">
                    <IdCard size={18} strokeWidth={2} />
                  </span>
                  <span className="profil-lipat__teks">
                    <strong>Profil Pelapor</strong>
                    <span>
                      {profilPelapor?.nama
                        ? [profilPelapor.nama, profilPelapor.jabatan, profilPelapor.lembaga].filter(Boolean).join(" · ")
                        : "Belum diisi. Isi supaya nama Anda tercantum di laporan."}
                    </span>
                  </span>
                </summary>
                <div className="folder-body">{isiProfil}</div>
              </details>
              <LaporanView
                transaksi={transaksi}
                profilPelapor={profilPelapor}
                daftarKegiatan={daftarKegiatan}
                onUpdateKegiatan={onUpdateKegiatan}
                onSimpanProfilPelapor={onSimpanProfilPelapor}
                onTambahKegiatan={onTambahKegiatan}
                googleToken={googleToken}
                isLoggedInGoogle={Boolean(googleUser)}
              />
            </>
          ) : (
            <div className="folder saya-panel" id={`panel-${aplikasiAktif.id}`}>
              <div className="folder-body">
                {aplikasiAktif.id === "drive" && isiDrive}
                {aplikasiAktif.id === "keluarga" && (
                  <KeluargaView
                    googleUser={googleUser}
                    ambilToken={ambilToken ?? (async () => googleToken ?? null)}
                    driveContents={driveContents}
                    namaPelapor={profilPelapor?.nama}
                    onPeriksaDrive={onPeriksaDrive}
                  />
                )}
                {aplikasiAktif.id === "tema" && isiTema}
                {aplikasiAktif.id === "rutin" && isiRutin}
                {aplikasiAktif.id === "kunci" && isiKunci}
              </div>
            </div>
          )}
        </>
      )}

      {onSimpanAppLockConfig && (
        <AppLockKelolaModal
          isOpen={modalAppLockBuka}
          onClose={() => setModalAppLockBuka(false)}
          config={appLockConfig}
          onSimpanConfig={onSimpanAppLockConfig}
          totpAktif={Boolean(totp)}
        />
      )}
      <TotpKelolaModal
        isOpen={modalTotpBuka}
        onClose={() => setModalTotpBuka(false)}
        kunciAktif={appLockConfig.enabled}
        googleUser={googleUser}
        ambilToken={ambilToken}
        driveContents={driveContents}
        onBerubah={() => setTotp(muatTotp())}
      />
      {modalKeluarBuka && (
        <KeluarDriveModal
          akun={googleUser ? googleUser.email || googleUser.displayName || "Google" : null}
          jumlahTransaksi={transaksi.length}
          jumlahAset={aset.length}
          onKirimDulu={onKirimSebelumKeluar ?? (async () => ({ ok: true }))}
          onKeluarDanHapus={async () => {
            if (onKeluarDanHapus) await onKeluarDanHapus();
            else await onGoogleLogout();
          }}
          onKeluarSaja={onGoogleLogout}
          onTutup={() => setModalKeluarBuka(false)}
        />
      )}
    </section>
  );
};
