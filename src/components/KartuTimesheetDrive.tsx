import React, { useState } from "react";
import { DataKegiatan } from "../types";
import { ambilIsiFolderKeuangan, cariFolderKeuangan, GDriveFileInfo } from "../lib/gdriveSync";
import { getAccessToken } from "../lib/googleAuth";
import { cocokkanFileTimesheet } from "../lib/timesheet";
import { buatKegiatanDariTimesheet, tautanTimesheet } from "../lib/timesheetDrive";

interface KartuTimesheetDriveProps {
  daftarKegiatan: DataKegiatan[];
  googleToken?: string;
  isLoggedInGoogle?: boolean;
  onTambahKegiatan?: (kegiatan: DataKegiatan) => void;
}

/**
 * Tampil di Laporan Dana Kegiatan hanya bila aplikasi belum punya data kegiatan sama sekali. Mendaftar file timesheet di folder
 * Keuangan; yang belum punya kegiatan bisa dijadikan kegiatan dengan satu ketukan (nama, rentang tanggal, batch, Keterangan, dan Lokasi diambil dari file; file hanya dibaca).
 * Tanpa kegiatan, tidak ada pilihan kegiatan di Laporan dan kartu Timesheet Perdiem tidak bisa tampil.
 */
export const KartuTimesheetDrive: React.FC<KartuTimesheetDriveProps> = ({ daftarKegiatan, googleToken, isLoggedInGoogle, onTambahKegiatan }) => {
  const [berkas, setBerkas] = useState<GDriveFileInfo[] | null>(null);
  const [kerja, setKerja] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; tipe: "sukses" | "galat" | "info" } | null>(null);
  const siap = Boolean(isLoggedInGoogle || googleToken);

  const tokenDanBerkas = async () => {
    const token = googleToken || (await getAccessToken());
    if (!token) throw new Error("Masuk ke akun Google dulu di tab Saya.");
    const folder = await cariFolderKeuangan(token);
    if (!folder) throw new Error("Folder 'Keuangan' tidak ditemukan di Google Drive.");
    const contents = await ambilIsiFolderKeuangan(token, folder.id);
    return { token, files: contents.timesheets ?? [] };
  };

  const cek = async () => {
    setKerja("cek");
    setPesan(null);
    try {
      const { files } = await tokenDanBerkas();
      setBerkas(files);
      if (files.length === 0) setPesan({ teks: "Belum ada file timesheet di folder Keuangan.", tipe: "info" });
    } catch (err: any) {
      setPesan({ teks: err?.message ?? String(err), tipe: "galat" });
    } finally {
      setKerja(null);
    }
  };

  const buat = async (file: GDriveFileInfo) => {
    setKerja(file.id);
    setPesan(null);
    try {
      const { token } = await tokenDanBerkas();
      const kegiatan = await buatKegiatanDariTimesheet(token, file);
      onTambahKegiatan?.(kegiatan);
      setPesan({
        teks: `Kegiatan dibuat dari file itu (${kegiatan.tanggalMulai} s.d. ${kegiatan.tanggalSelesai}, ${kegiatan.timesheetBaris?.length ?? 0} hari berisi keterangan). Pilih di "Pilih Kegiatan Lapangan".`,
        tipe: "sukses",
      });
    } catch (err: any) {
      setPesan({ teks: err?.message ?? String(err), tipe: "galat" });
    } finally {
      setKerja(null);
    }
  };

  const pemakai = (file: GDriveFileInfo) =>
    daftarKegiatan.find(
      (k) => k.timesheetId === file.id || cocokkanFileTimesheet(k, [{ id: file.id, nama: file.name, modifiedTime: file.modifiedTime }])?.id === file.id
    );

  return (
    <div className="card no-print kartu-timesheet" data-testid="kartu-timesheet-drive">
      <div className="kartu-timesheet__judul">
        <h3>🗓️ Timesheet di Google Drive</h3>
        <p>
          Belum ada data kegiatan di aplikasi, jadi pilihan kegiatan dan kartu Timesheet Uang Harian belum tampil. Buat kegiatan dari file
          timesheet Anda di folder Keuangan.
        </p>
      </div>

      <div className="kartu-timesheet__aksi">
        <button type="button" className="btn-primary" disabled={!siap || kerja !== null} onClick={cek}>
          {kerja === "cek" ? "⏳ Memeriksa…" : "🔍 Cek file timesheet di Drive"}
        </button>
      </div>

      {berkas && berkas.length > 0 && (
        <ul className="kartu-timesheet__daftar">
          {berkas.map((f) => {
            const k = pemakai(f);
            return (
              <li key={f.id}>
                <a href={tautanTimesheet(f.id)} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
                {k ? (
                  <span>Dipakai kegiatan: {k.nama}</span>
                ) : (
                  <button type="button" className="btn-small" disabled={kerja !== null || !onTambahKegiatan} onClick={() => buat(f)}>
                    {kerja === f.id ? "⏳ Membuat…" : "Buat kegiatan dari file ini"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!siap && <p className="kartu-timesheet__catatan">Masuk ke akun Google di tab Saya untuk memeriksa folder Keuangan.</p>}
      {pesan && (
        <p className={`kartu-timesheet__pesan kartu-timesheet__pesan--${pesan.tipe}`} role="status">
          {pesan.teks}
        </p>
      )}
    </div>
  );
};
