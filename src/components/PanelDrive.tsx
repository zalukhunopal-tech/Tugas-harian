import React from "react";
import { User } from "firebase/auth";
import { Transaksi } from "../types";
import { labelKategori } from "../lib/constants";
import { KeuanganDriveContents } from "../lib/gdriveSync";
import { AkunGoogleTersimpan, cekStatusSesiGoogle } from "../lib/googleAuth";
import { TombolSinkron } from "./TombolSinkron";

interface PanelDriveProps {
  googleUser: User | null;
  googleLoading: boolean;
  onGoogleLogin: () => Promise<void>;
  /** Membuka dialog keluar (kirim dulu, lalu putus akun, dengan atau tanpa menghapus data dari perangkat). */
  onBukaKeluar: () => void;
  /** Tautan "Hapus dari perangkat ini" tampil bila belum masuk tetapi data masih tersimpan di perangkat. */
  tampilHapusDariPerangkat: boolean;
  driveContents: KeuanganDriveContents | null;
  memuatDrive: boolean;
  onPeriksaDrive: () => Promise<void>;
  onTarikDariDrive: () => Promise<void>;
  onKirimKeDrive: () => Promise<void>;
  onPerbaruiAksesDrive?: () => Promise<unknown>;
  /** Sinkronisasi satu langkah (tarik, gabung, kirim); true bila berhasil. */
  onSinkronkan?: () => Promise<boolean>;
  daftarAkunGoogle?: AkunGoogleTersimpan[];
  onBeralihAkun?: (emailOrUid: string) => Promise<void>;
  onTambahAkun?: () => Promise<string | null>;
  onHapusAkun?: (emailOrUid: string) => Promise<void>;
  syncStatusPesan: string;
  transaksi: Transaksi[];
}

const Avatar: React.FC<{ foto?: string | null; nama?: string | null; email?: string | null; ukuran: number }> = ({ foto, nama, email, ukuran }) =>
  foto ? (
    <img className="sinkron-avatar" src={foto} alt="" width={ukuran} height={ukuran} style={{ width: ukuran, height: ukuran }} />
  ) : (
    <span className="sinkron-avatar sinkron-avatar--huruf" aria-hidden="true" style={{ width: ukuran, height: ukuran, fontSize: ukuran * 0.42 }}>
      {(nama || email || "U")[0].toUpperCase()}
    </span>
  );

function unduhCSV(transaksi: Transaksi[]) {
  if (transaksi.length === 0) {
    alert("Belum ada transaksi untuk diunduh.");
    return;
  }
  const header = ["Tanggal", "Jenis", "Dana", "Uraian", "Kategori", "Jumlah", "Metode Bayar", "Sumber / Tujuan", "Catatan", "ID"];
  const kutip = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const baris = transaksi.map((t) => [t.tanggal, t.jenis, t.dana, kutip(t.deskripsi || ""), kutip(labelKategori(t.kategori || "")), t.jumlah, kutip(t.metode || ""), kutip(t.kaitan || ""), kutip(t.catatan || ""), t.id]);
  const csv = "﻿" + [header.join(","), ...baris.map((r) => r.join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `transaksi-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Isi menu "Sinkron" (Drive Keuangan) di tab Saya. Yang tampil hanya yang dipakai sehari-hari: judul Sinkronisasi Data, lingkaran berlogo
 * Google Drive yang ditahan 3 detik, dan nama akun. Pengaturan lain (tarik saja, kirim saja, periksa folder, unduh CSV, ganti atau
 * tambah akun, isi folder, rincian sesi) tetap ada, dilipat di "Opsi lanjutan".
 */
export const PanelDrive: React.FC<PanelDriveProps> = ({
  googleUser,
  googleLoading,
  onGoogleLogin,
  onBukaKeluar,
  tampilHapusDariPerangkat,
  driveContents,
  memuatDrive,
  onPeriksaDrive,
  onTarikDariDrive,
  onKirimKeDrive,
  onPerbaruiAksesDrive,
  onSinkronkan,
  daftarAkunGoogle = [],
  onBeralihAkun,
  onTambahAkun,
  onHapusAkun,
  syncStatusPesan,
  transaksi,
}) => {
  const sinkronkan = onSinkronkan ?? (async () => {
    await onTarikDariDrive();
    await onKirimKeDrive();
    return true;
  });
  const statusSesi = cekStatusSesiGoogle();
  const perluPerpanjang = Boolean(googleUser) && (!statusSesi.tokenAktif || statusSesi.perluPembaruanToken || syncStatusPesan?.includes("401"));
  const akunLain = googleUser ? daftarAkunGoogle.filter((a) => a.email !== googleUser.email) : daftarAkunGoogle;

  const daftarAkunTersimpan = (
    <div className="sinkron-akun-daftar" data-testid="akun-lain">
      {akunLain.map((akun) => (
        <div className="sinkron-akun-baris" key={akun.uid || akun.email}>
          <Avatar foto={akun.photoURL} nama={akun.displayName} email={akun.email} ukuran={32} />
          <div className="sinkron-akun-teks">
            <strong>{akun.displayName || akun.email || "Pengguna Google"}</strong>
            <span>{akun.email}</span>
          </div>
          <div className="sinkron-akun-aksi">
            <button type="button" className={googleUser ? "btn-small" : "btn-small btn-primary"} onClick={() => onBeralihAkun && void onBeralihAkun(akun.email || akun.uid)}>
              {googleUser ? "Ganti Akun" : "Aktifkan"}
            </button>
            {onHapusAkun && (
              <button
                type="button"
                className="btn-small btn-delete"
                title="Hapus akun dan datanya dari perangkat ini"
                onClick={() => {
                  if (window.confirm(`Hapus akun ${akun.email} dan data lokalnya dari perangkat ini?`)) void onHapusAkun(akun.email || akun.uid);
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section className="sinkron" data-testid="panel-sinkron" aria-label="Sinkronisasi data dengan Google Drive">
      <header className="sinkron-kepala">
        <h3 className="sinkron-judul">Sinkronisasi Data</h3>
        <p className="sinkron-sub">Folder Keuangan di Google Drive</p>
      </header>

      <TombolSinkron tersambung={Boolean(googleUser)} sibuk={memuatDrive || googleLoading} onSelesaiTahan={sinkronkan} />

      {!googleUser ? (
        <div className="sinkron-masuk">
          {akunLain.length > 0 && (
            <div className="sinkron-tersimpan">
              <div className="sinkron-subjudul">Pilih akun yang tersimpan di perangkat</div>
              {daftarAkunTersimpan}
            </div>
          )}
          <button type="button" className="gsi-material-button" onClick={() => void onGoogleLogin()} disabled={googleLoading}>
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">{googleLoading ? "Menghubungkan…" : "Masuk dengan Google & Sinkron Drive"}</span>
            </div>
          </button>
          {tampilHapusDariPerangkat && (
            <p className="help sinkron-hapus">
              Data keuangan masih tersimpan di perangkat ini.{" "}
              <button type="button" className="btn-link" id="btn-hapus-data-perangkat" onClick={onBukaKeluar}>
                Hapus dari perangkat ini
              </button>
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="sinkron-akun" data-testid="akun-aktif">
            <Avatar foto={googleUser.photoURL} nama={googleUser.displayName} email={googleUser.email} ukuran={44} />
            <div className="sinkron-akun-teks">
              <span className="sinkron-akun-nama">
                <strong>{googleUser.displayName || "Pengguna Google"}</strong>
                <span className="sinkron-aktif">Aktif</span>
              </span>
              <span className="sinkron-akun-email">{googleUser.email}</span>
            </div>
            <button type="button" className="btn-small btn-delete" id="btn-keluar-drive" onClick={onBukaKeluar}>
              Keluar
            </button>
          </div>

          <p className="sinkron-sesi" data-kedaluwarsa={statusSesi.kedaluwarsa ? "ya" : "tidak"}>
            <span aria-hidden="true">{statusSesi.kedaluwarsa ? "⚠️" : "🔒"}</span>
            <span>
              {statusSesi.kedaluwarsa
                ? "Sesi Sinkronisasi 3 Bulan Kedaluwarsa"
                : `Sesi Sinkronisasi 3 Bulan Aktif (${statusSesi.sisaHari} Hari Tersisa)`}
            </span>
          </p>

          {perluPerpanjang && onPerbaruiAksesDrive && (
            <div className="sinkron-peringatan" role="alert" data-testid="perlu-perbarui-akses">
              <strong>⚡ Akses Google Drive perlu diperbarui</strong>
              <span>Token akses Drive berlaku 1 jam (kebijakan keamanan Google). Data Anda aman; ketuk tombol ini untuk menyambungkan kembali tanpa keluar dari akun.</span>
              <button type="button" className="btn-primary" disabled={googleLoading} onClick={() => void onPerbaruiAksesDrive()}>
                🔄 {googleLoading ? "Menyambungkan…" : "Perbarui Akses Drive Sekarang (1 Ketukan)"}
              </button>
            </div>
          )}
        </>
      )}

      {syncStatusPesan && (
        <p id="sync-detail" className="sinkron-pesan">
          {syncStatusPesan}
        </p>
      )}

      {googleUser && (
        <details className="sinkron-lanjut" id="opsi-lanjutan-drive" data-testid="opsi-lanjutan">
          <summary>Opsi lanjutan</summary>
          <div className="sinkron-lanjut-isi">
            <section className="sinkron-bagian" aria-label="Isi folder Keuangan">
              {driveContents ? (
                <div className="gdrive-folder-status">
                  <div className="sinkron-folder">
                    <span>
                      Folder: <strong>{driveContents.folder.name}</strong>
                    </span>
                    {driveContents.folder.webViewLink && (
                      <a href={driveContents.folder.webViewLink} target="_blank" rel="noreferrer" className="btn-link">
                        Buka di Drive ↗
                      </a>
                    )}
                  </div>
                  <div className="gdrive-badge-row">
                    <span className={`gdrive-badge ${driveContents.sheetPribadi ? "ok" : ""}`}>{driveContents.sheetPribadi ? "✓ Keuangan Pribadi" : "— Keuangan Pribadi"}</span>
                    <span className={`gdrive-badge ${driveContents.sheetKegiatan ? "ok" : ""}`}>{driveContents.sheetKegiatan ? "✓ Keuangan Kegiatan" : "— Keuangan Kegiatan"}</span>
                    <span className={`gdrive-badge ${driveContents.fileAset ? "ok" : ""}`}>{driveContents.fileAset ? "✓ Aset.json" : "— Aset.json"}</span>
                    <span className={`gdrive-badge ${driveContents.fileLaporanKegiatan ? "ok" : ""}`}>{driveContents.fileLaporanKegiatan ? "✓ Laporan Kegiatan.json" : "— Laporan Kegiatan.json"}</span>
                  </div>
                </div>
              ) : (
                <p className="help">
                  {memuatDrive
                    ? "Memeriksa folder Keuangan di Google Drive…"
                    : "Folder belum diperiksa. Bila folder 'Keuangan' belum ada, aplikasi membuatnya otomatis beserta isinya."}
                </p>
              )}
              <div className="sinkron-tombol-lanjut">
                {!driveContents && (
                  <button type="button" className="btn-secondary" disabled={memuatDrive} onClick={() => void onPeriksaDrive()}>
                    Periksa &amp; siapkan folder Keuangan
                  </button>
                )}
                {onPerbaruiAksesDrive && (
                  <button type="button" className="btn-secondary" disabled={googleLoading || memuatDrive} onClick={() => void onPerbaruiAksesDrive()}>
                    🔄 {googleLoading ? "Memperbarui…" : "Perbarui Akses Drive (1-Klik)"}
                  </button>
                )}
                <button type="button" className="btn-primary" disabled={memuatDrive} onClick={() => void onTarikDariDrive()}>
                  {memuatDrive ? "Memproses…" : "Tarik Data dari Folder Keuangan"}
                </button>
                <button type="button" className="btn-secondary" disabled={memuatDrive} onClick={() => void onKirimKeDrive()}>
                  Kirim Data Lokal ke Folder Keuangan
                </button>
                <button type="button" className="btn-secondary" onClick={() => unduhCSV(transaksi)}>
                  Unduh CSV ({transaksi.length} transaksi)
                </button>
              </div>
            </section>

            <section className="sinkron-bagian" aria-label="Akun Google">
              {akunLain.length > 0 && (
                <>
                  <div className="sinkron-subjudul">Beralih ke akun lain di perangkat ini</div>
                  {daftarAkunTersimpan}
                </>
              )}
              <button
                type="button"
                className="btn-secondary sinkron-tambah-akun"
                onClick={() => {
                  if (onTambahAkun) void onTambahAkun();
                  else void onGoogleLogin();
                }}
                disabled={googleLoading}
              >
                ➕ {googleLoading ? "Menghubungkan…" : "Tambah / Masuk Akun Google Lain"}
              </button>
            </section>

            <p className="sinkron-rincian-sesi">
              {statusSesi.kedaluwarsa
                ? "Batas waktu 3 bulan telah berakhir. Silakan masuk ulang dengan Google untuk memperpanjang."
                : `Sesi login & sinkronisasi Drive disimpan otomatis hingga ${statusSesi.tanggalKedaluwarsa}. Aplikasi tetap tersambung tanpa perlu login ulang.`}
            </p>
          </div>
        </details>
      )}
    </section>
  );
};
