import { Transaksi } from "../types";
import type { GDriveFileInfo, KeuanganDriveContents } from "./gdriveSync";
import { bacaTransaksiDariSpreadsheet } from "./gdriveSync";
import {
  akunPemilikDariIzin,
  BerkasDibagikan,
  BerkasKeuangan,
  DanaBerbagi,
  IzinFile,
  RencanaBerbagi,
  danaDariNamaFile,
} from "./berbagi";

/**
 * Pemanggilan Google Drive untuk berbagi data keuangan (logika murni ada di berbagi.ts). Hanya izin BACA yang pernah
 * diberikan: orang yang dihubungkan bisa melihat, tidak bisa mengubah.
 */

const DRIVE = "https://www.googleapis.com/drive/v3/files";

const header = (token: string, json = false): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

async function pastikanOk(res: Response, aksi: string): Promise<void> {
  if (res.ok) return;
  let isi = "";
  try {
    isi = await res.text();
  } catch {
    // abaikan
  }
  throw new Error(`${aksi} gagal (${res.status}). ${isi}`.trim());
}

export function tautanBerkas(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/** Daftar izin sebuah berkas. Konektor Claude tidak menyertakan ID izin, jadi `id` bisa kosong. */
export async function ambilIzinBerkas(token: string, fileId: string): Promise<IzinFile[]> {
  const res = await fetch(`${DRIVE}/${fileId}/permissions?fields=permissions(id,type,role,emailAddress,displayName)`, {
    headers: header(token),
  });
  await pastikanOk(res, "Membaca daftar izin");
  const data = await res.json();
  return Array.isArray(data.permissions) ? (data.permissions as IzinFile[]) : [];
}

/** Spreadsheet keuangan saya (Pribadi dan Kegiatan, semua tahun) beserta izinnya. Timesheet dan file lain tidak ikut. */
export async function muatBerkasKeuangan(token: string, contents: KeuanganDriveContents): Promise<BerkasKeuangan[]> {
  const hasil: BerkasKeuangan[] = [];
  for (const f of contents.spreadsheets) {
    const dana = danaDariNamaFile(f.name);
    if (!dana) continue;
    hasil.push({ id: f.id, nama: f.name, dana, izin: await ambilIzinBerkas(token, f.id) });
  }
  return hasil;
}

/**
 * Email akun Google yang sedang tertaut ke Drive, dibaca dari pemilik spreadsheet keuangan sendiri. Dipakai saat profil masuk
 * tidak membawa email asli (mode artefak). Null bila belum ada spreadsheet atau izinnya tidak bisa dibaca.
 */
export async function emailAkunDrive(token: string, contents: KeuanganDriveContents): Promise<string | null> {
  for (const f of contents.spreadsheets) {
    if (!danaDariNamaFile(f.name)) continue;
    try {
      const akun = akunPemilikDariIzin([{ id: f.id, nama: f.name, dana: "pribadi", izin: await ambilIzinBerkas(token, f.id) }]);
      if (akun) return akun.email;
    } catch {
      // coba berkas berikutnya
    }
  }
  return null;
}

/** Beri izin baca kepada satu akun Google. Tanpa email pemberitahuan: orangnya melihatnya di aplikasi. */
export async function bagikanBerkas(token: string, fileId: string, email: string): Promise<void> {
  const res = await fetch(`${DRIVE}/${fileId}/permissions?sendNotificationEmail=false`, {
    method: "POST",
    headers: header(token, true),
    body: JSON.stringify({ type: "user", role: "reader", emailAddress: email }),
  });
  await pastikanOk(res, "Membagikan berkas");
}

export async function cabutIzin(token: string, fileId: string, idIzin: string): Promise<void> {
  const res = await fetch(`${DRIVE}/${fileId}/permissions/${encodeURIComponent(idIzin)}`, { method: "DELETE", headers: header(token) });
  if (res.status === 404) return; // sudah tidak ada
  await pastikanOk(res, "Mencabut izin");
}

export interface HasilTerapan {
  dibagikan: number;
  dicabut: number;
  /** Berkas yang harus dicabut aksesnya sendiri lewat menu Bagikan di Google Drive (ID izin tidak tersedia). */
  cabutManual: BerkasKeuangan[];
  galat: string[];
}

/** Jalankan rencana berbagi satu per satu; satu berkas yang gagal tidak menghentikan yang lain. */
export async function terapkanRencana(token: string, email: string, rencana: RencanaBerbagi): Promise<HasilTerapan> {
  const hasil: HasilTerapan = { dibagikan: 0, dicabut: 0, cabutManual: [], galat: [] };
  for (const b of rencana.bagikan) {
    try {
      await bagikanBerkas(token, b.id, email);
      hasil.dibagikan++;
    } catch (err: any) {
      hasil.galat.push(`${b.nama}: ${err?.message ?? err}`);
    }
  }
  for (const c of rencana.cabut) {
    if (!c.idIzin) {
      hasil.cabutManual.push(c.berkas);
      continue;
    }
    try {
      await cabutIzin(token, c.berkas.id, c.idIzin);
      hasil.dicabut++;
    } catch (err: any) {
      if (/501|tidak bisa mencabut/i.test(String(err?.message))) hasil.cabutManual.push(c.berkas);
      else hasil.galat.push(`${c.berkas.nama}: ${err?.message ?? err}`);
    }
  }
  return hasil;
}

export interface HasilBatasi {
  dibatasi: number;
  /** Berkas yang tautan umumnya harus dibatasi sendiri lewat Google Drive. */
  manual: BerkasKeuangan[];
}

/** Cabut akses "siapa saja yang punya tautan" dari berkas yang punya ID izin. Izin yang diwarisi dari folder tidak bisa dicabut di sini. */
export async function batasiTautanPublik(token: string, berkas: BerkasKeuangan[]): Promise<HasilBatasi> {
  const hasil: HasilBatasi = { dibatasi: 0, manual: [] };
  for (const b of berkas) {
    const umum = b.izin.filter((i) => i.type === "anyone" || i.type === "domain");
    let berhasil = umum.length > 0;
    for (const i of umum) {
      if (!i.id) {
        berhasil = false;
        continue;
      }
      try {
        await cabutIzin(token, b.id, i.id);
      } catch {
        berhasil = false;
      }
    }
    if (berhasil) hasil.dibatasi++;
    else hasil.manual.push(b);
  }
  return hasil;
}

/** Spreadsheet yang dibagikan orang lain kepada saya (tanpa menyaring: berbagi.ts memilih yang berupa data keuangan). */
export async function daftarDibagikanKeSaya(token: string): Promise<BerkasDibagikan[]> {
  const q = encodeURIComponent("sharedWithMe = true and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const res = await fetch(`${DRIVE}?q=${q}&fields=files(id,name,mimeType,modifiedTime,owners(displayName,emailAddress))&pageSize=100`, {
    headers: header(token),
  });
  await pastikanOk(res, "Membaca berkas yang dibagikan kepada saya");
  const data = await res.json();
  const files: Array<GDriveFileInfo & { owners?: Array<{ displayName?: string; emailAddress?: string }> }> = data.files || [];
  return files.map((f) => ({
    id: f.id,
    nama: f.name,
    mimeType: f.mimeType,
    diubah: f.modifiedTime,
    pemilikEmail: f.owners?.[0]?.emailAddress,
    pemilikNama: f.owners?.[0]?.displayName,
  }));
}

/** Baca transaksi dari spreadsheet milik orang lain untuk ditampilkan (tidak disimpan dan tidak digabung dengan data saya). */
export async function bacaDataDibagikan(token: string, berkas: BerkasDibagikan, dana: DanaBerbagi): Promise<Transaksi[]> {
  return bacaTransaksiDariSpreadsheet(token, berkas.id, dana === "pribadi" ? "Dana Pribadi" : "Dana Kegiatan", new Set());
}
