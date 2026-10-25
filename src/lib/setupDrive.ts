import {
  GDriveFileInfo,
  GDriveFolder,
  KeuanganDriveContents,
  ambilIsiFolderKeuangan,
  buatFolderKeuangan,
  dapatkanFolderBuktiTarget,
  dapatkanFolderLaporanKegiatan,
  temukanAtauBuatSpreadsheetTahun,
} from "./gdriveSync";
import type { NamaDana } from "../types";

/**
 * Menyiapkan folder "Keuangan" di Google Drive pengguna secara otomatis, supaya pengguna baru (mis. anggota keluarga yang
 * baru memasang aplikasi) tidak perlu membuatnya sendiri:
 *   Keuangan/
 *     Bukti Transaksi/Pribadi, Bukti Transaksi/Kegiatan
 *     Laporan Kegiatan/
 *     Keuangan Pribadi <tahun>, Keuangan Kegiatan <tahun>   (spreadsheet tahun berjalan)
 * Aman dijalankan berulang: yang sudah ada dipakai, tidak dibuat kembar.
 */

export type KeberadaanFolder = { status: "ada"; folder: GDriveFolder } | { status: "tidak-ada" } | { status: "galat"; pesan: string };

const SELEKSI = "fields=files(id,name,webViewLink)";

async function cari(token: string, q: string): Promise<GDriveFolder[] | string> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&${SELEKSI}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return `Pencarian folder gagal (${res.status})`;
    const data = await res.json();
    return (data.files || []) as GDriveFolder[];
  } catch (err: any) {
    return `Pencarian folder gagal: ${err?.message ?? err}`;
  }
}

/**
 * Apakah folder Keuangan sudah ada? Berbeda dari cariFolderKeuangan, galat jaringan atau izin dibedakan dari "memang belum
 * ada": hanya yang kedua boleh berujung pembuatan folder, supaya gangguan sesaat tidak menghasilkan folder Keuangan kedua.
 */
export async function periksaKeberadaanFolder(token: string): Promise<KeberadaanFolder> {
  const tipe = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  for (const q of [`name = 'Keuangan' and ${tipe}`, `name contains 'Keuangan' and ${tipe}`]) {
    const hasil = await cari(token, q);
    if (typeof hasil === "string") return { status: "galat", pesan: hasil };
    if (hasil.length > 0) return { status: "ada", folder: hasil[0] };
  }
  return { status: "tidak-ada" };
}

export interface HasilSetupDrive {
  folder: GDriveFolder;
  /** Folder Keuangan dibuat baru oleh proses ini. */
  folderBaru: boolean;
  /** Nama folder atau berkas yang baru dibuat. */
  dibuat: string[];
  /** Langkah yang tidak berhasil, dalam kalimat yang bisa ditampilkan. */
  gagal: string[];
  contents: KeuanganDriveContents;
}

let sedangBerjalan: Promise<HasilSetupDrive> | null = null;

/** Siapkan folder Keuangan dan isinya. Dua pemanggilan bersamaan berbagi satu proses (tidak membuat folder ganda). */
export function siapkanFolderKeuangan(token: string, tahun: number = new Date().getFullYear()): Promise<HasilSetupDrive> {
  if (!sedangBerjalan) {
    sedangBerjalan = jalankan(token, tahun).finally(() => {
      sedangBerjalan = null;
    });
  }
  return sedangBerjalan;
}

async function jalankan(token: string, tahun: number): Promise<HasilSetupDrive> {
  const dibuat: string[] = [];
  const gagal: string[] = [];

  const ada = await periksaKeberadaanFolder(token);
  if (ada.status === "galat") throw new Error(ada.pesan);
  let folder: GDriveFolder;
  let folderBaru = false;
  if (ada.status === "ada") {
    folder = ada.folder;
  } else {
    folder = await buatFolderKeuangan(token);
    folderBaru = true;
    dibuat.push("Keuangan");
  }

  const langkah = async (nama: string, kerja: () => Promise<unknown>) => {
    try {
      await kerja();
    } catch (err: any) {
      gagal.push(`${nama}: ${err?.message ?? err}`);
    }
  };

  // Subfolder: temukanAtauBuatSubfolder memakai yang ada; "dibuat" dicatat dari isi folder sebelum dan sesudah.
  const adaFolderDiDalam = async (): Promise<Set<string>> => {
    const hasil = await cari(token, `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    return new Set(typeof hasil === "string" ? [] : hasil.map((f) => f.name.toLowerCase()));
  };
  const sebelumFolder = await adaFolderDiDalam();
  for (const dana of ["Dana Pribadi", "Dana Kegiatan"] as NamaDana[]) {
    await langkah(`Bukti Transaksi/${dana === "Dana Pribadi" ? "Pribadi" : "Kegiatan"}`, () => dapatkanFolderBuktiTarget(token, folder.id, dana));
  }
  await langkah("Laporan Kegiatan", () => dapatkanFolderLaporanKegiatan(token, folder.id));
  const sesudahFolder = await adaFolderDiDalam();
  for (const nama of ["Bukti Transaksi", "Laporan Kegiatan"]) {
    if (!sebelumFolder.has(nama.toLowerCase()) && sesudahFolder.has(nama.toLowerCase())) dibuat.push(nama);
  }

  // Spreadsheet tahun berjalan; bila tidak bisa dibuat (mis. mode konektor tanpa contoh untuk disalin), dilaporkan.
  // Tiap dana memakai salinan daftar berkas AWAL: spreadsheet yang baru dibuat untuk satu dana tidak boleh dijadikan contoh
  // salinan untuk dana lain (judul kolomnya berbeda).
  const awal = await ambilIsiFolderKeuangan(token, folder.id);
  const baru: GDriveFileInfo[] = [];
  for (const dana of ["Dana Pribadi", "Dana Kegiatan"] as NamaDana[]) {
    const kata = dana === "Dana Pribadi" ? "pribadi" : "kegiatan";
    const nama = `Keuangan ${dana === "Dana Pribadi" ? "Pribadi" : "Kegiatan"} ${tahun}`;
    const sudahAda = awal.spreadsheets.some((f) => f.name.toLowerCase().includes(kata) && f.name.includes(String(tahun)));
    if (sudahAda) continue;
    try {
      const salinan = { ...awal, spreadsheets: [...awal.spreadsheets], allFiles: [...awal.allFiles] };
      baru.push(await temukanAtauBuatSpreadsheetTahun(token, folder.id, salinan, dana, String(tahun)));
      dibuat.push(nama);
    } catch (err: any) {
      gagal.push(`${nama}: ${err?.message ?? err}`);
    }
  }

  // Baca ulang isi folder supaya sheetPribadi/sheetKegiatan terisi; bila pembacaan gagal, pakai daftar awal ditambah yang baru dibuat.
  let contents = awal;
  if (baru.length > 0) {
    try {
      contents = await ambilIsiFolderKeuangan(token, folder.id);
    } catch {
      contents = { ...awal, spreadsheets: [...awal.spreadsheets, ...baru], allFiles: [...awal.allFiles, ...baru] };
    }
    for (const f of baru) {
      if (!contents.spreadsheets.some((x) => x.id === f.id)) {
        contents.spreadsheets.push(f);
        contents.allFiles.push(f);
      }
    }
  }

  return { folder, folderBaru, dibuat, gagal, contents };
}

/** Kalimat ringkas hasil penyiapan untuk ditampilkan ke pengguna. */
export function ringkasSetup(h: HasilSetupDrive): string {
  const bagian: string[] = [];
  if (h.folderBaru) bagian.push("Folder 'Keuangan' dibuat otomatis di Google Drive Anda");
  else if (h.dibuat.length > 0) bagian.push("Folder 'Keuangan' dilengkapi");
  else bagian.push("Folder 'Keuangan' sudah lengkap");
  if (h.dibuat.length > 0) bagian.push(`(dibuat: ${h.dibuat.join(", ")})`);
  if (h.gagal.length > 0) bagian.push(`Belum bisa: ${h.gagal.join("; ")}`);
  return bagian.join(" ");
}
