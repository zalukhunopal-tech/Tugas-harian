import { Transaksi, AsetItem, NamaDana, DataHarga, PengaturanKeuangan, LaporanKegiatanFileContent } from "../types";
import { adalahFileTimesheet } from "./timesheet";
import { buatId, normalisasiTransaksi, muatIdTerhapus, simpanIdTerhapus, muatLaporanKegiatanFile, simpanLaporanKegiatanFile } from "./storage";

export interface GDriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface GDriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface SinkronMeta {
  terhapus: string[];
  diubah?: Record<string, string>; // map: id -> ISO timestamp
  terakhirSinkron?: string;
}

export interface KeuanganDriveContents {
  folder: GDriveFolder;
  /** Spreadsheet keuangan (Pribadi/Kegiatan per tahun). File timesheet perdiem tidak termasuk, lihat `timesheets`. */
  spreadsheets: GDriveFileInfo[];
  /** File timesheet perdiem per batch kegiatan; namanya memuat "kegiatan" dan tahun, jadi harus dipisah dari sheet keuangan. */
  timesheets: GDriveFileInfo[];
  sheetPribadi?: GDriveFileInfo;
  sheetKegiatan?: GDriveFileInfo;
  fileAset?: GDriveFileInfo;
  fileHarga?: GDriveFileInfo;
  fileSinkron?: GDriveFileInfo;
  /** Semua salinan Sinkron.json di folder, yang terbaru dulu. Salinan lama (mis. yang sudah di Sampah) menyimpan catatan penghapusan yang tak boleh hilang. */
  semuaSinkron?: GDriveFileInfo[];
  filePengaturan?: GDriveFileInfo;
  fileLaporanKegiatan?: GDriveFileInfo;
  allFiles: GDriveFileInfo[];
}

/**
 * Dari beberapa folder bernama sama pilih yang milik akun ini; urutan createdTime (terlama dulu) membuat pilihannya
 * stabil: tanpa itu, dua folder "Keuangan" bisa bergantian terpilih dan data terbelah di antara keduanya.
 */
function pilihFolderKeuangan(files: Array<GDriveFolder & { ownedByMe?: boolean }> | undefined): GDriveFolder | null {
  return (files ?? []).find((f) => f.ownedByMe !== false) ?? null;
}

let onTokenExpiredRefresher: (() => Promise<string | null>) | null = null;

/**
 * Daftarkan pemanggil pembaruan token saat API Google menerima status 401 Unauthorized
 */
export function daftarkanTokenRefresher(refresher: () => Promise<string | null>) {
  onTokenExpiredRefresher = refresher;
}

/**
 * Pemanggil fetch API Google terpusat dengan penanganan otomatis perpanjangan token jika menerima status 401.
 */
export async function panggilApiGoogle(
  url: string,
  init: RequestInit,
  tokenSaatIni: string
): Promise<{ res: Response; tokenAktif: string }> {
  let token = tokenSaatIni;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, {
    ...init,
    headers,
  });

  if (res.status === 401 && onTokenExpiredRefresher) {
    try {
      console.warn("Menerima 401 dari Google API. Mencoba pembaruan token otomatis...");
      const tokenBaru = await onTokenExpiredRefresher();
      if (tokenBaru && tokenBaru !== token) {
        token = tokenBaru;
        headers.set("Authorization", `Bearer ${token}`);
        res = await fetch(url, {
          ...init,
          headers,
        });
      }
    } catch (e) {
      console.warn("Gagal auto-refresh token saat 401:", e);
    }
  }

  return { res, tokenAktif: token };
}

export async function cariFolderKeuangan(token: string): Promise<GDriveFolder | null> {
  const lapangan = "fields=files(id,name,webViewLink,ownedByMe)&orderBy=createdTime";
  // 1. Cari folder bernama "Keuangan"
  const urlCariNama = `https://www.googleapis.com/drive/v3/files?q=name%3D'Keuangan'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&${lapangan}`;
  try {
    const { res } = await panggilApiGoogle(urlCariNama, {}, token);
    if (res.ok) {
      const folder = pilihFolderKeuangan((await res.json()).files);
      if (folder) return folder;
    }
  } catch (e) {
    console.warn("Cari nama folder Keuangan gagal:", e);
  }

  // 2. Cari folder yang namanya mengandung "Keuangan"
  try {
    const urlCariContains = `https://www.googleapis.com/drive/v3/files?q=name+contains+'Keuangan'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&${lapangan}`;
    const { res } = await panggilApiGoogle(urlCariContains, {}, token);
    if (res.ok) {
      const folder = pilihFolderKeuangan((await res.json()).files);
      if (folder) return folder;
    }
  } catch (e) {
    console.warn("Cari contains Keuangan gagal:", e);
  }

  // Tidak ada ID folder bawaan: folder dicari hanya lewat nama di Drive akun yang sedang masuk, jadi tidak pernah
  // menunjuk ke folder milik orang lain.
  return null;
}

export type KeberadaanFolder = { status: "ada"; folder: GDriveFolder } | { status: "tidak-ada" } | { status: "galat"; pesan: string };

/** Cari folder dengan kueri Drive. Hasil berupa teks = pesan galat, supaya gangguan tidak disangka "folder tidak ada". */
export async function cariFolderDrive(token: string, q: string): Promise<GDriveFolder[] | string> {
  try {
    const { res } = await panggilApiGoogle(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,ownedByMe)&orderBy=createdTime`,
      {},
      token
    );
    if (!res.ok) {
      if (res.status === 401) {
        return "Sesi akses Google Drive telah kedaluwarsa (401). Silakan perbarui akses Drive.";
      }
      return `Pencarian folder gagal (${res.status})`;
    }
    const data = await res.json();
    // Folder milik orang lain yang kebetulan bernama sama tidak dianggap folder saya.
    return ((data.files || []) as Array<GDriveFolder & { ownedByMe?: boolean }>).filter((f) => f.ownedByMe !== false);
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
    const hasil = await cariFolderDrive(token, q);
    if (typeof hasil === "string") return { status: "galat", pesan: hasil };
    if (hasil.length > 0) return { status: "ada", folder: hasil[0] };
  }
  return { status: "tidak-ada" };
}

let pastikanFolderBerjalan: Promise<{ folder: GDriveFolder; baru: boolean }> | null = null;
let folderBaruDibuat: { folder: GDriveFolder; waktu: number } | null = null;
const BATAS_INDEKS_DRIVE_MS = 2 * 60 * 1000;

/**
 * Satu-satunya jalan membuat folder Keuangan. Memakai yang sudah ada; membuat HANYA bila pencarian berhasil dan memang
 * kosong. Pencarian yang gagal melempar galat (tidak membuat apa pun). Pemanggilan bersamaan berbagi satu proses, dan
 * folder yang baru dibuat diingat beberapa menit karena indeks pencarian Drive bisa tertinggal.
 */
export function pastikanFolderKeuangan(token: string): Promise<{ folder: GDriveFolder; baru: boolean }> {
  if (!pastikanFolderBerjalan) {
    pastikanFolderBerjalan = (async () => {
      const ada = await periksaKeberadaanFolder(token);
      if (ada.status === "galat") throw new Error(`Folder Keuangan belum bisa diperiksa: ${ada.pesan}`);
      if (ada.status === "ada") return { folder: ada.folder, baru: false };
      if (folderBaruDibuat && Date.now() - folderBaruDibuat.waktu < BATAS_INDEKS_DRIVE_MS) {
        // Indeks pencarian bisa tertinggal: pakai folder yang baru dibuat, asal memang masih ada dan tidak di Sampah.
        try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderBaruDibuat.folder.id}?fields=id,name,webViewLink,trashed`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok && !(await res.json()).trashed) return { folder: folderBaruDibuat.folder, baru: false };
        } catch {
          // lanjut membuat bila tidak bisa diverifikasi
        }
        folderBaruDibuat = null;
      }
      const folder = await buatFolderKeuangan(token);
      folderBaruDibuat = { folder, waktu: Date.now() };
      return { folder, baru: true };
    })().finally(() => {
      pastikanFolderBerjalan = null;
    });
  }
  return pastikanFolderBerjalan;
}

export async function buatFolderKeuangan(token: string): Promise<GDriveFolder> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Keuangan",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membuat folder Keuangan di Google Drive: ${err}`);
  }

  return (await res.json()) as GDriveFolder;
}

export async function ambilIsiFolderKeuangan(
  token: string,
  folderId: string
): Promise<KeuanganDriveContents> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membaca isi folder Keuangan: ${err}`);
  }

  const data = await res.json();
  const files: GDriveFileInfo[] = data.files || [];
  const spreadsheets: GDriveFileInfo[] = [];
  const timesheets: GDriveFileInfo[] = [];

  const contents: KeuanganDriveContents = {
    folder: { id: folderId, name: "Keuangan" },
    spreadsheets,
    timesheets,
    allFiles: files,
  };

  // Beberapa salinan berkas keadaan (Aset/Sinkron/Pengaturan/Laporan) bisa ada bersamaan: pasang ulang, dua perangkat, atau
  // salinan lama di Sampah yang tak bisa disaring konektor. Urutan daftar tidak bisa dipercaya; pakai yang terbaru.
  const lebihBaru = (a: GDriveFileInfo, b?: GDriveFileInfo): boolean => !b || (a.modifiedTime ?? "") > (b.modifiedTime ?? "");
  const salinanSinkron: GDriveFileInfo[] = [];

  for (const f of files) {
    const namaLower = f.name.toLowerCase();
    const isSpreadsheet =
      f.mimeType === "application/vnd.google-apps.spreadsheet" ||
      f.mimeType.includes("spreadsheet") ||
      namaLower.endsWith(".xlsx");

    if (isSpreadsheet && adalahFileTimesheet(f.name)) {
      timesheets.push(f);
    } else if (isSpreadsheet) {
      spreadsheets.push(f);
      if (namaLower.includes("pribadi") && !contents.sheetPribadi) {
        contents.sheetPribadi = f;
      }
      if (namaLower.includes("kegiatan") && !contents.sheetKegiatan) {
        contents.sheetKegiatan = f;
      }
    } else if (f.name === "Aset.json" || namaLower.includes("aset.json")) {
      if (lebihBaru(f, contents.fileAset)) contents.fileAset = f;
    } else if (f.name === "Harga Pasar.json" || namaLower.includes("harga pasar.json")) {
      if (lebihBaru(f, contents.fileHarga)) contents.fileHarga = f;
    } else if (f.name === "Sinkron.json" || namaLower.includes("sinkron.json")) {
      salinanSinkron.push(f);
      if (lebihBaru(f, contents.fileSinkron)) contents.fileSinkron = f;
    } else if (f.name === "Pengaturan.json" || namaLower.includes("pengaturan.json")) {
      if (lebihBaru(f, contents.filePengaturan)) contents.filePengaturan = f;
    } else if (f.name === "Laporan Kegiatan.json" || namaLower.includes("laporan kegiatan.json")) {
      if (lebihBaru(f, contents.fileLaporanKegiatan)) contents.fileLaporanKegiatan = f;
    }
  }
  contents.semuaSinkron = salinanSinkron.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));

  return contents;
}

export async function bacaSinkronMeta(
  token: string,
  fileId: string
): Promise<SinkronMeta | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as SinkronMeta;
  } catch (e) {
    console.warn("Gagal membaca Sinkron.json:", e);
    return null;
  }
}

/**
 * Menyatukan beberapa salinan Sinkron.json. Catatan penghapusan hanya bertambah: ID yang pernah dihapus tetap terhapus
 * di mana pun salinannya tercatat, sebab satu salinan yang kehilangan daftar itu membuat baris yang sudah dibuang
 * muncul kembali dan ikut ditulis ulang ke spreadsheet. Untuk waktu ubah dipakai yang paling baru per ID.
 */
export function gabungSinkronMeta(daftar: SinkronMeta[]): SinkronMeta {
  const terhapus = new Set<string>();
  const diubah: Record<string, string> = {};
  let terakhirSinkron: string | undefined;
  for (const m of daftar) {
    for (const id of Array.isArray(m?.terhapus) ? m.terhapus : []) if (typeof id === "string" && id) terhapus.add(id);
    for (const [id, waktu] of Object.entries(m?.diubah ?? {})) {
      if (!diubah[id] || String(waktu) > diubah[id]) diubah[id] = String(waktu);
    }
    if (m?.terakhirSinkron && (!terakhirSinkron || m.terakhirSinkron > terakhirSinkron)) terakhirSinkron = m.terakhirSinkron;
  }
  return { terhapus: Array.from(terhapus), diubah, terakhirSinkron };
}

/** Banyak salinan Sinkron.json yang dibaca sekaligus; salinan yang lebih lama dari ini hanya menambah beban baca. */
const BATAS_SALINAN_SINKRON = 6;

/**
 * Membaca Sinkron.json terbaru dan salinan-salinan sebelumnya, lalu menyatukannya. `terbacaTerbaru` false bila salinan
 * terbaru ada tetapi gagal dibaca: pemanggil tidak boleh menulis Sinkron.json baru dari data lokal saja (menghapus catatan
 * penghapusan yang hanya ada di Drive). Salinan lama yang gagal dibaca tidak menghalangi.
 */
export async function bacaSinkronGabungan(
  token: string,
  contents: KeuanganDriveContents
): Promise<{ meta: SinkronMeta | null; terbacaTerbaru: boolean }> {
  const salinan = (contents.semuaSinkron?.length ? contents.semuaSinkron : contents.fileSinkron ? [contents.fileSinkron] : []).slice(
    0,
    BATAS_SALINAN_SINKRON
  );
  if (salinan.length === 0) return { meta: null, terbacaTerbaru: true };
  const terbaca: SinkronMeta[] = [];
  let terbacaTerbaru = false;
  for (let i = 0; i < salinan.length; i++) {
    const m = await bacaSinkronMeta(token, salinan[i].id);
    if (m) {
      terbaca.push(m);
      if (i === 0) terbacaTerbaru = true;
    }
  }
  return { meta: terbaca.length ? gabungSinkronMeta(terbaca) : null, terbacaTerbaru };
}

export async function simpanSinkronMeta(
  token: string,
  folderId: string,
  fileId: string | null,
  meta: SinkronMeta
): Promise<string> {
  const konten = JSON.stringify(meta, null, 2);

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: konten,
      }
    );
    if (!res.ok) throw new Error("Gagal memperbarui file Sinkron.json di Drive");
    return fileId;
  } else {
    const metadata = {
      name: "Sinkron.json",
      parents: [folderId],
      mimeType: "application/json",
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([konten], { type: "application/json" }));

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error("Gagal membuat file Sinkron.json di Drive");
    const json = await res.json();
    return json.id;
  }
}

function parseTanggalSheet(v: any): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Format DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  // Excel serial number
  if (/^\d{5}$/.test(s)) {
    const date = new Date((Number(s) - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  return s;
}

function parseJumlahRupiah(v: any): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  let s = String(v).trim();
  s = s.replace(/^(rp|idr)\s*/i, "").trim();
  if (s.includes(".") && !s.includes(",")) {
    const parts = s.split(".");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      s = s.replace(/\./g, "");
    }
  } else if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pastikan header K6 berisi "Metode Bayar" dan L6 berisi "Bukti". Jika belum, tulis ke sheet.
 */
export async function pastikanHeaderK6(
  token: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<void> {
  try {
    const range = `'${sheetTitle}'!K6:L6`;
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}?valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    let butuhUpdate = true;
    if (checkRes.ok) {
      const data = await checkRes.json();
      const valK = data.values?.[0]?.[0];
      const valL = data.values?.[0]?.[1];
      if (
        valK &&
        String(valK).trim().toLowerCase() === "metode bayar" &&
        valL &&
        String(valL).trim().toLowerCase() === "bukti"
      ) {
        butuhUpdate = false;
      }
    }

    if (butuhUpdate) {
      // Tulis "Metode Bayar" dan "Bukti" ke K6:L6
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          range
        )}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            range,
            majorDimension: "ROWS",
            values: [["Metode Bayar", "Bukti"]],
          }),
        }
      );
    }
  } catch (e) {
    console.warn("Gagal memastikan header K6:L6:", e);
  }
}

/**
 * Kosongkan baris data B7:L sampai baris terakhir tanpa menyentuh rumus kolom A.
 */
export async function kosongkanRentangData(
  token: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<void> {
  const range = `'${sheetTitle}'!B7:L`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:clear`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`Gagal mengosongkan rentang data (${sheetTitle}):`, err);
  }
}

/**
 * Mencari atau membuat subfolder di Google Drive di dalam folder induk
 */
export async function temukanAtauBuatSubfolder(
  token: string,
  parentFolderId: string,
  namaFolder: string
): Promise<GDriveFolder> {
  const q = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)`;

  // Pencarian yang gagal TIDAK boleh berujung pembuatan: folder yang sebenarnya sudah ada akan terbuat kembar.
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e: any) {
    throw new Error(`Pencarian folder '${namaFolder}' gagal: ${e?.message ?? e}`);
  }
  if (!res.ok) {
    throw new Error(`Pencarian folder '${namaFolder}' gagal (${res.status}); tidak membuat folder baru.`);
  }
  const data = await res.json();
  const existing = (data.files || []).find((f: any) => f.name.toLowerCase() === namaFolder.toLowerCase());
  if (existing) {
    return existing as GDriveFolder;
  }

  // Buat folder jika belum ada
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: namaFolder,
      parents: [parentFolderId],
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Gagal membuat folder '${namaFolder}': ${err}`);
  }

  return (await createRes.json()) as GDriveFolder;
}

/**
 * Dapatkan target folder bukti di Google Drive:
 * Keuangan / Bukti Transaksi / Kegiatan (untuk Dana Kegiatan)
 * Keuangan / Bukti Transaksi / Pribadi (untuk Dana Pribadi)
 */
export async function dapatkanFolderBuktiTarget(
  token: string,
  folderKeuanganId: string,
  dana: NamaDana
): Promise<GDriveFolder> {
  // 1. Folder "Bukti Transaksi"
  const folderBuktiUtama = await temukanAtauBuatSubfolder(
    token,
    folderKeuanganId,
    "Bukti Transaksi"
  );

  // 2. Subfolder "Kegiatan" atau "Pribadi"
  const namaSub = dana === "Dana Kegiatan" ? "Kegiatan" : "Pribadi";
  return await temukanAtauBuatSubfolder(token, folderBuktiUtama.id, namaSub);
}

/**
 * Mengunggah file/foto bukti transaksi ke folder Drive yang ditentukan
 */
export async function unggahBuktiKeDrive(
  token: string,
  targetFolderId: string,
  blob: Blob,
  namaFile: string,
  mimeType: string
): Promise<{ driveId: string; driveLink: string }> {
  const metadata = {
    name: namaFile,
    parents: [targetFolderId],
    mimeType: mimeType || "image/jpeg",
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal mengunggah bukti ke Google Drive: ${err}`);
  }

  const json = await res.json();
  const driveLink = json.webViewLink || `https://drive.google.com/file/d/${json.id}/view`;
  return {
    driveId: json.id,
    driveLink,
  };
}

/**
 * Membaca tab paling sesuai dalam spreadsheet
 */
async function cariJudulTabSheet(
  token: string,
  spreadsheetId: string,
  targetDana: NamaDana
): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title,sheetId))`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) {
    return "Sheet1";
  }
  const metaData = await metaRes.json();
  const sheets: Array<{ properties?: { title?: string } }> = metaData.sheets || [];

  let sheetTitle = sheets[0]?.properties?.title || "Sheet1";
  for (const s of sheets) {
    const t = (s.properties?.title || "").toLowerCase();
    if (targetDana === "Dana Pribadi" && (t.includes("pribadi") || t.includes("keuangan pribadi"))) {
      return s.properties?.title || sheetTitle;
    }
    if (targetDana === "Dana Kegiatan" && (t.includes("kegiatan") || t.includes("keuangan kegiatan"))) {
      return s.properties?.title || sheetTitle;
    }
  }
  return sheetTitle;
}

/** Judul kolom baris 6 sheet keuangan memuat Uraian, Pemasukan, atau Pengeluaran (lihat template dan penulisan di kirimSemuaKeDrive). */
export function adalahJudulSheetKeuangan(judul: unknown[] | undefined): boolean {
  return Array.isArray(judul) && judul.some((c) => /uraian|pemasukan|pengeluaran/i.test(String(c ?? "")));
}

/** FNV-1a 32-bit sebagai heksadesimal: sidik jari isi baris, tanpa pustaka tambahan. */
function hashTeks(teks: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * ID untuk baris sheet yang kolom J-nya kosong (mis. diketik langsung di Google Sheets). Diturunkan dari isi baris, bukan
 * acak: tanpa ini setiap tarik memberi baris itu ID baru dan tarik kedua (atau pasang ulang lalu tarik lagi) menggandakannya.
 * `urut` membedakan baris yang isinya persis sama.
 */
export function idStabilBaris(isi: Array<string | number>, urut = 0): string {
  return `sheet-${hashTeks(isi.join("|"))}${urut > 0 ? `-${urut}` : ""}`;
}

/**
 * Membaca transaksi dari rentang B7:K dari sebuah spreadsheet.
 * Mengabaikan transaksi yang ID-nya ada di daftar terhapus.
 */
export async function bacaTransaksiDariSpreadsheet(
  token: string,
  spreadsheetId: string,
  targetDana: NamaDana,
  idTerhapus: Set<string>,
  mapDiubahDrive?: Record<string, string>
): Promise<Transaksi[]> {
  const sheetTitle = await cariJudulTabSheet(token, spreadsheetId, targetDana);

  // Baca rentang B6:L: baris 6 adalah judul kolom, data mulai baris 7
  // (B=Tanggal, C=Uraian, D=Kategori, E=Pemasukan, F=Pengeluaran, G=Saldo, H=Kaitan, I=Catatan, J=ID, K=Metode Bayar, L=Bukti)
  const range = `'${sheetTitle}'!B6:L`;
  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!valRes.ok) {
    const err = await valRes.text();
    throw new Error(`Gagal membaca data sheet (${sheetTitle}): ${err}`);
  }

  const valData = await valRes.json();
  const semuaBaris: any[][] = valData.values || [];
  // Hanya sheet berjudul kolom keuangan (Uraian / Pemasukan / Pengeluaran) yang dibaca sebagai transaksi. Tanpa
  // pemeriksaan ini, file lain di folder (mis. timesheet perdiem) terbaca sebagai transaksi nyasar.
  if (!adalahJudulSheetKeuangan(semuaBaris[0])) {
    console.warn(`Spreadsheet "${sheetTitle}" bukan sheet keuangan (judul kolom di baris 6 tidak dikenali); dilewati.`);
    return [];
  }
  const rows = semuaBaris.slice(1);
  const hasil: Transaksi[] = [];
  // Cacah baris tanpa ID yang isinya sama, supaya dua baris kembar yang sah tetap mendapat ID berbeda tetapi stabil.
  const hitungIsi = new Map<string, number>();

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r || r.length === 0) continue;

    const tgl = parseTanggalSheet(r[0]);
    const uraian = String(r[1] || "").trim();
    if (!uraian && !r[0]) continue; // baris kosong

    const kategori = String(r[2] || "").trim() || "Lain-lain";
    const masuk = parseJumlahRupiah(r[3]);
    const keluar = parseJumlahRupiah(r[4]);
    const kaitan = String(r[6] || "").trim();
    const catatan = String(r[7] || "").trim();
    const rawId = String(r[8] || "").trim();
    // Kolom K (indeks ke-9 dari baris B..L)
    const metode = String(r[9] || "").trim() || "Tunai";
    let idDasar = rawId;
    if (!idDasar) {
      const isiBaris = [targetDana, tgl, uraian, kategori, masuk, keluar, kaitan, metode];
      const kunci = isiBaris.join("|");
      const urut = hitungIsi.get(kunci) ?? 0;
      hitungIsi.set(kunci, urut + 1);
      idDasar = idStabilBaris(isiBaris, urut);
    }
    // Kolom L (indeks ke-10 dari baris B..L): link bukti dipisahkan baris baru
    const rawBukti = String(r[10] || "").trim();
    const buktiItems: import("../types").BuktiItem[] = [];
    if (rawBukti) {
      const links = rawBukti.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
      for (const link of links) {
        buktiItems.push({
          id: buatId(),
          nama: "Bukti Transaksi",
          tipe: link.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg",
          driveLink: link,
        });
      }
    }

    if (idTerhapus.has(idDasar)) {
      // Abaikan transaksi yang telah terhapus
      continue;
    }

    const diubahTimestamp = mapDiubahDrive?.[idDasar] || undefined;

    if (masuk > 0 && keluar > 0) {
      const idM = `${idDasar}-m`;
      const idK = `${idDasar}-k`;
      if (!idTerhapus.has(idM)) {
        hasil.push(
          normalisasiTransaksi({
            id: idM,
            jenis: "pemasukan",
            dana: targetDana,
            tanggal: tgl,
            deskripsi: uraian,
            kategori,
            jumlah: masuk,
            metode,
            kaitan,
            catatan,
            diubah: diubahTimestamp,
            bukti: buktiItems,
          })
        );
      }
      if (!idTerhapus.has(idK)) {
        hasil.push(
          normalisasiTransaksi({
            id: idK,
            jenis: "pengeluaran",
            dana: targetDana,
            tanggal: tgl,
            deskripsi: uraian,
            kategori,
            jumlah: keluar,
            metode,
            kaitan,
            catatan,
            diubah: diubahTimestamp,
            bukti: buktiItems,
          })
        );
      }
    } else if (masuk > 0) {
      const id = idDasar;
      if (!idTerhapus.has(id)) {
        hasil.push(
          normalisasiTransaksi({
            id,
            jenis: "pemasukan",
            dana: targetDana,
            tanggal: tgl,
            deskripsi: uraian,
            kategori,
            jumlah: masuk,
            metode,
            kaitan,
            catatan,
            diubah: diubahTimestamp,
            bukti: buktiItems,
          })
        );
      }
    } else if (keluar > 0) {
      const id = idDasar;
      if (!idTerhapus.has(id)) {
        hasil.push(
          normalisasiTransaksi({
            id,
            jenis: "pengeluaran",
            dana: targetDana,
            tanggal: tgl,
            deskripsi: uraian,
            kategori,
            jumlah: keluar,
            metode,
            kaitan,
            catatan,
            diubah: diubahTimestamp,
            bukti: buktiItems,
          })
        );
      }
    }
  }

  return hasil;
}

/**
 * Membaca semua transaksi dari seluruh spreadsheet per tahun di folder Keuangan
 */
export async function bacaSemuaTransaksiDariFolder(
  token: string,
  contents: KeuanganDriveContents,
  idTerhapus: Set<string>,
  mapDiubahDrive?: Record<string, string>
): Promise<{ transaksi: Transaksi[]; jumlahFile: number; jumlahGalat: number }> {
  const hasilSemua: Transaksi[] = [];
  let fileDibaca = 0;
  // Spreadsheet Google berjudul pribadi/kegiatan yang GAGAL dibaca. Berkas .xlsx tidak dihitung (memang tidak bisa dibaca lewat Sheets API).
  let jumlahGalat = 0;

  for (const file of contents.spreadsheets) {
    const namaLower = file.name.toLowerCase();
    let targetDana: NamaDana | null = null;

    if (namaLower.includes("pribadi")) {
      targetDana = "Dana Pribadi";
    } else if (namaLower.includes("kegiatan")) {
      targetDana = "Dana Kegiatan";
    }

    if (targetDana) {
      try {
        const trx = await bacaTransaksiDariSpreadsheet(
          token,
          file.id,
          targetDana,
          idTerhapus,
          mapDiubahDrive
        );
        hasilSemua.push(...trx);
        fileDibaca++;
      } catch (err: any) {
        console.warn(`Gagal membaca spreadsheet ${file.name}:`, err.message);
        if (file.mimeType === "application/vnd.google-apps.spreadsheet") jumlahGalat++;
      }
    } else {
      // Spreadsheet yang tidak memiliki kata pribadi/kegiatan di nama file: periksa tab sheet
      try {
        const trxPribadi = await bacaTransaksiDariSpreadsheet(
          token,
          file.id,
          "Dana Pribadi",
          idTerhapus,
          mapDiubahDrive
        );
        hasilSemua.push(...trxPribadi);
        fileDibaca++;
      } catch {
        // coba kegiatan
        try {
          const trxKegiatan = await bacaTransaksiDariSpreadsheet(
            token,
            file.id,
            "Dana Kegiatan",
            idTerhapus,
            mapDiubahDrive
          );
          hasilSemua.push(...trxKegiatan);
          fileDibaca++;
        } catch {
          // abaikan jika tidak cocok
        }
      }
    }
  }

  return { transaksi: hasilSemua, jumlahFile: fileDibaca, jumlahGalat };
}

/**
 * Menggabungkan data lokal dan data remote (Drive).
 * Mengabaikan ID yang terhapus dan memilih transaksi dengan field `diubah` terbaru.
 */
export function gabungTransaksi(
  lokal: Transaksi[],
  remote: Transaksi[],
  idTerhapus: Set<string>
): Transaksi[] {
  const map = new Map<string, Transaksi>();

  for (const t of lokal) {
    if (idTerhapus.has(t.id)) continue;
    map.set(t.id, t);
  }

  for (const r of remote) {
    if (idTerhapus.has(r.id)) continue;
    if (map.has(r.id)) {
      const existing = map.get(r.id)!;
      let pemenang = existing;
      if (r.diubah && existing.diubah) {
        if (r.diubah > existing.diubah) {
          pemenang = r;
        }
      } else if (r.diubah) {
        pemenang = r;
      }

      // Gabungkan bukti tanpa duplikasi
      const gabungBukti = [...(existing.bukti || [])];
      const keys = new Set(gabungBukti.map((b) => b.driveLink || b.dataUrl || b.id));
      for (const b of r.bukti || []) {
        const k = b.driveLink || b.dataUrl || b.id;
        if (!keys.has(k)) {
          gabungBukti.push(b);
          keys.add(k);
        }
      }

      map.set(r.id, {
        ...pemenang,
        bukti: gabungBukti,
      });
    } else {
      map.set(r.id, r);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/**
 * Menggabungkan daftar aset lokal dengan aset dari Google Drive (Aset.json).
 * Menghindari data aset lokal terhapus atau tertimpa array kosong dari cloud.
 */
export function gabungAset(lokal: AsetItem[], remote: AsetItem[]): AsetItem[] {
  if (!Array.isArray(remote) || remote.length === 0) {
    return Array.isArray(lokal) ? lokal : [];
  }
  if (!Array.isArray(lokal) || lokal.length === 0) {
    return remote;
  }
  const map = new Map<string, AsetItem>();
  for (const r of remote) {
    if (r && r.id) map.set(r.id, r);
  }
  for (const l of lokal) {
    if (l && l.id) {
      if (!map.has(l.id)) {
        map.set(l.id, l);
      } else {
        const r = map.get(l.id)!;
        map.set(l.id, { ...r, ...l });
      }
    }
  }
  return Array.from(map.values());
}

export async function bacaAsetDariDrive(token: string, fileId: string): Promise<AsetItem[]> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membaca file Aset.json: ${err}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function bacaHargaDariDrive(token: string, fileId: string): Promise<DataHarga | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as DataHarga;
  } catch {
    return null;
  }
}

export async function simpanAsetKeDrive(
  token: string,
  folderId: string,
  fileId: string | null,
  aset: AsetItem[]
): Promise<string> {
  const konten = JSON.stringify(aset, null, 2);

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: konten,
      }
    );
    if (!res.ok) throw new Error("Gagal memperbarui file Aset.json di Drive");
    return fileId;
  } else {
    const metadata = {
      name: "Aset.json",
      parents: [folderId],
      mimeType: "application/json",
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([konten], { type: "application/json" }));

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error("Gagal membuat file Aset.json di Drive");
    const json = await res.json();
    return json.id;
  }
}

export async function bacaPengaturanDariDrive(
  token: string,
  fileId: string
): Promise<import("../types").PengaturanKeuangan | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as import("../types").PengaturanKeuangan;
  } catch (e) {
    console.warn("Gagal membaca Pengaturan.json dari Drive:", e);
    return null;
  }
}

export async function simpanPengaturanKeDrive(
  token: string,
  folderId: string,
  fileId: string | null,
  pengaturan: import("../types").PengaturanKeuangan
): Promise<string> {
  const konten = JSON.stringify(pengaturan, null, 2);

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: konten,
      }
    );
    if (!res.ok) throw new Error("Gagal memperbarui file Pengaturan.json di Drive");
    return fileId;
  } else {
    const metadata = {
      name: "Pengaturan.json",
      parents: [folderId],
      mimeType: "application/json",
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([konten], { type: "application/json" }));

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error("Gagal membuat file Pengaturan.json di Drive");
    const json = await res.json();
    return json.id;
  }
}

export async function bacaLaporanKegiatanDariDrive(
  token: string,
  fileId: string
): Promise<LaporanKegiatanFileContent | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as LaporanKegiatanFileContent;
  } catch (e) {
    console.warn("Gagal membaca Laporan Kegiatan.json dari Drive:", e);
    return null;
  }
}

export async function simpanLaporanKegiatanKeDrive(
  token: string,
  folderId: string,
  fileId: string | null,
  data: LaporanKegiatanFileContent
): Promise<string> {
  const konten = JSON.stringify(data, null, 2);

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: konten,
      }
    );
    if (!res.ok) throw new Error("Gagal memperbarui file Laporan Kegiatan.json di Drive");
    return fileId;
  } else {
    const metadata = {
      name: "Laporan Kegiatan.json",
      parents: [folderId],
      mimeType: "application/json",
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([konten], { type: "application/json" }));

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error("Gagal membuat file Laporan Kegiatan.json di Drive");
    const json = await res.json();
    return json.id;
  }
}

/**
 * Mencari atau menyalin file spreadsheet untuk dana dan tahun tertentu ("Keuangan Pribadi 2026", "Keuangan Kegiatan 2026").
 * Jika belum ada, buat salinan dari file tahun sebelumnya (atau template lain yang tersedia) lalu kosongkan baris datanya (mulai baris 7).
 */
export async function temukanAtauBuatSpreadsheetTahun(
  token: string,
  folderId: string,
  contents: KeuanganDriveContents,
  dana: NamaDana,
  tahun: string
): Promise<GDriveFileInfo> {
  const kataKunciDana = dana === "Dana Pribadi" ? "pribadi" : "kegiatan";
  const namaTargetBaku = `Keuangan ${dana === "Dana Pribadi" ? "Pribadi" : "Kegiatan"} ${tahun}`;

  // 1. Cek apakah sudah ada file dengan nama yang cocok untuk dana & tahun ini
  const fileAda = contents.spreadsheets.find((f) => {
    const n = f.name.toLowerCase();
    return n.includes(kataKunciDana) && n.includes(tahun);
  });
  if (fileAda) {
    return fileAda;
  }

  // 2. Jika belum ada, cari template dari tahun sebelumnya (th - 1) atau file dana yang sama
  const thNum = parseInt(tahun, 10);
  let templateFile: GDriveFileInfo | undefined;

  if (!isNaN(thNum)) {
    const thSebelumnya = String(thNum - 1);
    templateFile = contents.spreadsheets.find((f) => {
      const n = f.name.toLowerCase();
      return n.includes(kataKunciDana) && n.includes(thSebelumnya);
    });
  }

  // Jika tidak ada tahun sebelumnya, cari sembarang spreadsheet dana yang sama
  if (!templateFile) {
    templateFile = contents.spreadsheets.find((f) => f.name.toLowerCase().includes(kataKunciDana));
  }

  // Jika masih tidak ada, pakai spreadsheet mana saja di folder
  if (!templateFile && contents.spreadsheets.length > 0) {
    templateFile = contents.spreadsheets[0];
  }

  if (templateFile) {
    // Buat salinan spreadsheet via Drive API v3 files/{id}/copy
    const copyRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateFile.id}/copy?fields=id,name,mimeType,webViewLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: namaTargetBaku,
          parents: [folderId],
        }),
      }
    );

    if (!copyRes.ok) {
      const err = await copyRes.text();
      throw new Error(`Gagal menyalin template spreadsheet untuk tahun ${tahun}: ${err}`);
    }

    const fileBaru = (await copyRes.json()) as GDriveFileInfo;
    contents.spreadsheets.push(fileBaru);
    contents.allFiles.push(fileBaru);

    // Kosongkan baris data mulai baris 7 pada salinan baru
    const sheetTitle = await cariJudulTabSheet(token, fileBaru.id, dana);
    await kosongkanRentangData(token, fileBaru.id, sheetTitle);
    await pastikanHeaderK6(token, fileBaru.id, sheetTitle);

    return fileBaru;
  }

  // 3. Jika folder benar-benar kosong dari spreadsheet, buat spreadsheet baru via Sheets API
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: namaTargetBaku,
      },
      sheets: [
        {
          properties: {
            title: `Keuangan ${dana === "Dana Pribadi" ? "Pribadi" : "Kegiatan"}`,
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Gagal membuat spreadsheet baru untuk tahun ${tahun}: ${err}`);
  }

  const createdData = await createRes.json();
  const fileId = createdData.spreadsheetId;

  // Pindahkan ke folder Keuangan
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=root&fields=id,name,mimeType,webViewLink`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  // Tulis Header di baris 6 (A6:L6)
  const headerCols = [
    "No",
    "Tanggal",
    "Uraian",
    "Kategori",
    "Pemasukan",
    "Pengeluaran",
    "Saldo",
    dana === "Dana Pribadi" ? "Sumber / Tujuan" : "Kaitan Kegiatan",
    "Catatan",
    "ID Aplikasi",
    "Metode Bayar",
    "Bukti",
  ];

  const tabTitle = createdData.sheets?.[0]?.properties?.title || "Sheet1";
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(
      `'${tabTitle}'!A6:L6`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: `'${tabTitle}'!A6:L6`,
        majorDimension: "ROWS",
        values: [headerCols],
      }),
    }
  );

  const fileBaru: GDriveFileInfo = {
    id: fileId,
    name: namaTargetBaku,
    mimeType: "application/vnd.google-apps.spreadsheet",
  };
  contents.spreadsheets.push(fileBaru);
  contents.allFiles.push(fileBaru);

  return fileBaru;
}

/**
 * Penjaga "tarik dulu". Setelah pasang ulang (atau di sesi baru) data lokal bisa kosong atau belum lengkap, sedangkan kirim
 * menulis ulang spreadsheet dari data lokal dan mengosongkan tahun yang tidak ada di sana. Mengirim sebelum menarik berarti
 * menimpa isi Drive. Karena itu kirim ditolak sampai satu tarik selesai TANPA galat baca di sesi ini.
 */
let tarikLengkapSesi = false;

export class GalatBelumTarik extends Error {
  constructor() {
    super(
      "Tarik data dari Google Drive dulu sampai berhasil tanpa galat, supaya isi spreadsheet Anda tidak tertimpa data lokal yang belum lengkap."
    );
    this.name = "GalatBelumTarik";
  }
}

export const sudahTarikLengkap = (): boolean => tarikLengkapSesi;
/** Dipanggil saat keluar atau ganti akun: data lokal tidak boleh dikirim ke Drive akun lain sebelum ditarik. */
export const resetStatusTarik = (): void => {
  tarikLengkapSesi = false;
};

/**
 * Menyimpan seluruh data transaksi dan aset ke Google Drive secara komprehensif:
 * - Menghitung saldo berjalan kolom G (angka) urut tanggal dan waktu input.
 * - Menulis kolom K "Metode Bayar" (dan memastikan K6 terisi).
 * - Mengosongkan B7:K sebelum menulis ulang data (kolom A aman).
 * - Memetakan transaksi ke file spreadsheet per tahun yang sesuai.
 * - Memperbarui daftar transaksi terhapus di Sinkron.json.
 */
export async function kirimSemuaKeDrive(
  token: string,
  transaksiList: Transaksi[],
  asetList: AsetItem[],
  pengaturan?: import("../types").PengaturanKeuangan,
  laporanKegiatan?: LaporanKegiatanFileContent
): Promise<{ jumlahTrx: number; jumlahAset: number }> {
  if (!tarikLengkapSesi) throw new GalatBelumTarik();

  // 1. Temukan atau buat folder Keuangan
  let folder = await cariFolderKeuangan(token);
  if (!folder) {
    folder = (await pastikanFolderKeuangan(token)).folder;
  }

  const contents = await ambilIsiFolderKeuangan(token, folder.id);

  // 2. Sinkronkan daftar ID terhapus dengan Sinkron.json
  const idTerhapusLokal = muatIdTerhapus();
  if (contents.fileSinkron) {
    const { meta: metaDrive, terbacaTerbaru } = await bacaSinkronGabungan(token, contents);
    // Sinkron.json ada tetapi tak terbaca: menulisnya ulang dari data lokal saja membuang catatan penghapusan yang hanya ada
    // di Drive, dan baris yang sudah dibuang pun hidup lagi. Hentikan; coba lagi nanti.
    if (!terbacaTerbaru) {
      throw new Error("Catatan penghapusan di Drive (Sinkron.json) belum bisa dibaca, jadi kirim ditahan supaya data yang sudah Anda hapus tidak muncul lagi. Coba lagi sebentar lagi.");
    }
    if (metaDrive) {
      for (const id of metaDrive.terhapus) {
        idTerhapusLokal.add(id);
      }
      simpanIdTerhapus(idTerhapusLokal);
    }
  }

  // Saring hanya transaksi yang aktif (tidak terhapus)
  const transaksiAktif = transaksiList.filter((t) => !idTerhapusLokal.has(t.id));

  // 3. Proses per jenis dana
  const daftarDana: NamaDana[] = ["Dana Pribadi", "Dana Kegiatan"];

  for (const dana of daftarDana) {
    // Urutkan semua transaksi dana ini secara kronologis: tanggal ascending, lalu diubah/urutan input
    const trxDana = transaksiAktif
      .filter((t) => t.dana === dana)
      .sort((a, b) => {
        const cDate = a.tanggal.localeCompare(b.tanggal);
        if (cDate !== 0) return cDate;
        return (a.diubah || "").localeCompare(b.diubah || "");
      });

    // Hitung saldo berjalan kumulatif per baris transaksi (angka)
    let saldoKumulatif = 0;
    const trxDenganSaldo = trxDana.map((t) => {
      const masuk = t.jenis === "pemasukan" ? t.jumlah : 0;
      const keluar = t.jenis === "pengeluaran" ? t.jumlah : 0;
      saldoKumulatif += masuk - keluar;
      return {
        ...t,
        saldoBerjalan: saldoKumulatif,
      };
    });

    // Kelompokkan transaksi berdasarkan tahun
    const mapTahun = new Map<string, typeof trxDenganSaldo>();
    for (const item of trxDenganSaldo) {
      const th = item.tanggal.slice(0, 4) || new Date().getFullYear().toString();
      const list = mapTahun.get(th) || [];
      list.push(item);
      mapTahun.set(th, list);
    }

    // Tulis ke spreadsheet masing-masing tahun
    for (const [th, itemsTahun] of mapTahun.entries()) {
      const targetFile = await temukanAtauBuatSpreadsheetTahun(
        token,
        folder.id,
        contents,
        dana,
        th
      );
      const sheetTitle = await cariJudulTabSheet(token, targetFile.id, dana);

      // Pastikan header K6 ada "Metode Bayar" dan L6 ada "Bukti"
      await pastikanHeaderK6(token, targetFile.id, sheetTitle);

      // Kosongkan B7:L terlebih dahulu (kolom A aman)
      await kosongkanRentangData(token, targetFile.id, sheetTitle);

      // Siapkan baris B7:L (11 kolom: B=tgl, C=uraian, D=kat, E=masuk, F=keluar, G=saldo, H=kaitan, I=catatan, J=id, K=metode, L=bukti)
      const rows = itemsTahun.map((t) => {
        const linksBukti = (t.bukti || [])
          .map((b) => b.driveLink)
          .filter(Boolean)
          .join("\n");

        return [
          t.tanggal,
          t.deskripsi,
          t.kategori,
          t.jenis === "pemasukan" ? t.jumlah : "",
          t.jenis === "pengeluaran" ? t.jumlah : "",
          t.saldoBerjalan, // Kolom G: Saldo berjalan dihitung aplikasi (angka)
          t.kaitan || "",
          t.catatan || "",
          t.id,
          t.metode || "Tunai", // Kolom K: Metode Bayar
          linksBukti, // Kolom L: Bukti link Drive
        ];
      });

      if (rows.length > 0) {
        const range = `'${sheetTitle}'!B7:L${6 + rows.length}`;
        const resWrite = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${targetFile.id}/values/${encodeURIComponent(
            range
          )}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              range,
              majorDimension: "ROWS",
              values: rows,
            }),
          }
        );
        if (!resWrite.ok) {
          const err = await resWrite.text();
          console.warn(`Gagal menulis baris data ke ${targetFile.name}:`, err);
        }
      }
    }

    // Periksa file spreadsheet lain untuk dana ini yang tahunnya kini kosong (misal semua transaksi tahun tsb dihapus)
    const kataKunciDana = dana === "Dana Pribadi" ? "pribadi" : "kegiatan";
    for (const f of contents.spreadsheets) {
      const n = f.name.toLowerCase();
      if (n.includes(kataKunciDana)) {
        const m = n.match(/\b(20\d\d)\b/);
        const thFile = m ? m[1] : null;
        if (thFile && !mapTahun.has(thFile)) {
          // Tahun ini tidak memiliki transaksi aktif lagi, kosongkan data sheetnya
          try {
            const sheetTitle = await cariJudulTabSheet(token, f.id, dana);
            await kosongkanRentangData(token, f.id, sheetTitle);
          } catch {
            // abaikan
          }
        }
      }
    }
  }

  // 4. Simpan Aset.json
  await simpanAsetKeDrive(
    token,
    folder.id,
    contents.fileAset ? contents.fileAset.id : null,
    asetList
  );

  // 5. Simpan Sinkron.json (daftar terhapus dan peta waktu diubah)
  const mapDiubah: Record<string, string> = {};
  for (const t of transaksiAktif) {
    if (t.diubah) {
      mapDiubah[t.id] = t.diubah;
    }
  }

  const metaSinkron: SinkronMeta = {
    terhapus: Array.from(idTerhapusLokal),
    diubah: mapDiubah,
    terakhirSinkron: new Date().toISOString(),
  };

  await simpanSinkronMeta(
    token,
    folder.id,
    contents.fileSinkron ? contents.fileSinkron.id : null,
    metaSinkron
  );

  // 6. Simpan Pengaturan.json jika ada
  if (pengaturan) {
    try {
      await simpanPengaturanKeDrive(
        token,
        folder.id,
        contents.filePengaturan ? contents.filePengaturan.id : null,
        pengaturan
      );
    } catch (e: any) {
      console.warn("Gagal menyimpan Pengaturan.json ke Drive:", e.message);
    }
  }

  // 7. Simpan Laporan Kegiatan.json
  try {
    const dataLaporan = laporanKegiatan || muatLaporanKegiatanFile();
    await simpanLaporanKegiatanKeDrive(
      token,
      folder.id,
      contents.fileLaporanKegiatan ? contents.fileLaporanKegiatan.id : null,
      dataLaporan
    );
  } catch (e: any) {
    console.warn("Gagal menyimpan Laporan Kegiatan.json ke Drive:", e.message);
  }

  return {
    jumlahTrx: transaksiAktif.length,
    jumlahAset: asetList.length,
  };
}

/**
 * Menarik seluruh data dari folder Keuangan di Google Drive:
 * - Sinkronisasi Sinkron.json dan daftar ID terhapus
 * - Membaca semua file spreadsheet dari seluruh tahun untuk kedua jenis dana
 * - Menggabungkan dengan transaksi lokal berdasarkan versi `diubah` terbaru
 * - Membaca Aset.json dan Harga Pasar.json
 */
export async function tarikSemuaDariDrive(
  token: string,
  transaksiLokal: Transaksi[],
  asetLokal: AsetItem[],
  hargaLokal: DataHarga
): Promise<{
  transaksi: Transaksi[];
  aset: AsetItem[];
  harga: DataHarga;
  pengaturan?: PengaturanKeuangan;
  laporanKegiatan?: LaporanKegiatanFileContent;
  contents: KeuanganDriveContents;
  totalTrxDitarik: number;
  totalAsetDitarik: number;
}> {
  const folder = await cariFolderKeuangan(token);
  if (!folder) {
    // cariFolderKeuangan juga null saat pencarian GAGAL. Hanya "memang tidak ada" yang berarti tidak ada isi Drive yang
    // bisa tertimpa; gangguan jaringan tidak boleh membuka penjaga kirim.
    const ada = await periksaKeberadaanFolder(token);
    if (ada.status === "galat") throw new Error(`Folder 'Keuangan' belum bisa diperiksa: ${ada.pesan}`);
    if (ada.status === "tidak-ada") tarikLengkapSesi = true;
    throw new Error("Folder 'Keuangan' tidak ditemukan di Google Drive Anda.");
  }

  const contents = await ambilIsiFolderKeuangan(token, folder.id);
  // Bacaan yang gagal membuat tarik tidak lengkap: data lokal belum boleh dikirim menimpa Drive.
  let galatBaca = 0;

  // 1. Baca metadata sinkronisasi dan satukan ID terhapus
  const idTerhapusLokal = muatIdTerhapus();
  let mapDiubahDrive: Record<string, string> | undefined;

  if (contents.fileSinkron) {
    const { meta: metaDrive, terbacaTerbaru } = await bacaSinkronGabungan(token, contents);
    if (!terbacaTerbaru) galatBaca++;
    if (metaDrive) {
      for (const id of metaDrive.terhapus) {
        idTerhapusLokal.add(id);
      }
      simpanIdTerhapus(idTerhapusLokal);
      mapDiubahDrive = metaDrive.diubah;
    }
  }

  // 2. Baca seluruh transaksi dari semua file spreadsheet di folder
  const { transaksi: remoteTrx, jumlahGalat } = await bacaSemuaTransaksiDariFolder(
    token,
    contents,
    idTerhapusLokal,
    mapDiubahDrive
  );
  galatBaca += jumlahGalat;

  // 3. Gabungkan transaksi lokal dan remote berdasarkan `diubah` terbaru
  const hasilGabungTrx = gabungTransaksi(transaksiLokal, remoteTrx, idTerhapusLokal);

  // 4. Tarik Aset.json jika ada dan satukan secara aman dengan aset lokal
  let asetBaru = asetLokal;
  let totalAsetDitarik = 0;
  if (contents.fileAset) {
    try {
      const asetDrive = await bacaAsetDariDrive(token, contents.fileAset.id);
      if (Array.isArray(asetDrive)) {
        asetBaru = gabungAset(asetLokal, asetDrive);
        totalAsetDitarik = asetDrive.length;
      }
    } catch (e: any) {
      console.warn("Gagal membaca Aset.json dari Drive:", e.message);
      galatBaca++;
    }
  }

  // 5. Tarik Harga Pasar.json jika ada
  let hargaBaru = hargaLokal;
  if (contents.fileHarga) {
    try {
      const hDrive = await bacaHargaDariDrive(token, contents.fileHarga.id);
      if (hDrive) {
        hargaBaru = { ...hargaLokal, ...hDrive };
      }
    } catch (e: any) {
      console.warn("Gagal membaca Harga Pasar.json dari Drive:", e.message);
    }
  }

  // 6. Tarik Pengaturan.json jika ada
  let pengaturanBaru: import("../types").PengaturanKeuangan | undefined;
  if (contents.filePengaturan) {
    try {
      const pDrive = await bacaPengaturanDariDrive(token, contents.filePengaturan.id);
      if (pDrive) {
        pengaturanBaru = pDrive;
      }
    } catch (e: any) {
      console.warn("Gagal membaca Pengaturan.json dari Drive:", e.message);
      galatBaca++;
    }
  }

  // 7. Tarik Laporan Kegiatan.json jika ada
  let laporanKegiatanBaru: LaporanKegiatanFileContent | undefined;
  if (contents.fileLaporanKegiatan) {
    try {
      const lDrive = await bacaLaporanKegiatanDariDrive(token, contents.fileLaporanKegiatan.id);
      if (lDrive) {
        laporanKegiatanBaru = lDrive;
        simpanLaporanKegiatanFile(lDrive);
      }
    } catch (e: any) {
      console.warn("Gagal membaca Laporan Kegiatan.json dari Drive:", e.message);
      galatBaca++;
    }
  }

  // Tarik lengkap tanpa galat baca: sekarang data lokal memuat isi Drive, jadi kirim aman dibuka untuk sesi ini.
  if (galatBaca === 0) tarikLengkapSesi = true;

  return {
    transaksi: hasilGabungTrx,
    aset: asetBaru,
    harga: hargaBaru,
    pengaturan: pengaturanBaru,
    laporanKegiatan: laporanKegiatanBaru,
    contents,
    totalTrxDitarik: remoteTrx.length,
    totalAsetDitarik,
  };
}

/**
 * Mencari atau membuat subfolder "Laporan Kegiatan" di dalam folder Keuangan
 */
export async function dapatkanFolderLaporanKegiatan(
  token: string,
  folderKeuanganId: string
): Promise<GDriveFolder> {
  return await temukanAtauBuatSubfolder(token, folderKeuanganId, "Laporan Kegiatan");
}

/**
 * Menyimpan atau memperbarui file Word (.docx) laporan keuangan kegiatan di Google Drive.
 * Timpa file jika nama file sudah ada di folder agar tidak membuat duplikat.
 */
export async function simpanDocxLaporanKeDrive(
  token: string,
  folderLaporanId: string,
  namaFileDocx: string,
  fileDocxBlob: Blob,
  fileIdTerdahulu?: string
): Promise<{ id: string; webViewLink?: string }> {
  let fileId = fileIdTerdahulu;

  // Jika belum ada ID, cari apakah sudah ada file dengan nama sama di folder Laporan Kegiatan
  if (!fileId) {
    const q = `'${folderLaporanId}' in parents and name = '${namaFileDocx.replace(/'/g, "\\'")}' and trashed = false`;
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          fileId = data.files[0].id;
        }
      }
    } catch (e) {
      console.warn("Pencarian file Word di Drive gagal:", e);
    }
  }

  const mimeTypeDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (fileId) {
    // Timpa file yang sama (PATCH)
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": mimeTypeDocx,
        },
        body: fileDocxBlob,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal memperbarui file Laporan Word di Google Drive: ${err}`);
    }
    const data = await res.json();
    return { id: fileId, webViewLink: data.webViewLink };
  } else {
    // Buat file baru (POST multipart)
    const metadata = {
      name: namaFileDocx,
      parents: [folderLaporanId],
      mimeType: mimeTypeDocx,
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", fileDocxBlob);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal membuat file Laporan Word di Google Drive: ${err}`);
    }
    const data = await res.json();
    return { id: data.id, webViewLink: data.webViewLink };
  }
}

