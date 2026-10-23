import { Transaksi, AsetItem, NamaDana, DataHarga, PengaturanKeuangan, LaporanKegiatanFileContent } from "../types";
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
}

export interface SinkronMeta {
  terhapus: string[];
  diubah?: Record<string, string>; // map: id -> ISO timestamp
  terakhirSinkron?: string;
}

export interface KeuanganDriveContents {
  folder: GDriveFolder;
  spreadsheets: GDriveFileInfo[];
  sheetPribadi?: GDriveFileInfo;
  sheetKegiatan?: GDriveFileInfo;
  fileAset?: GDriveFileInfo;
  fileHarga?: GDriveFileInfo;
  fileSinkron?: GDriveFileInfo;
  filePengaturan?: GDriveFileInfo;
  fileLaporanKegiatan?: GDriveFileInfo;
  allFiles: GDriveFileInfo[];
}

export async function cariFolderKeuangan(token: string): Promise<GDriveFolder | null> {
  // 1. Cari folder bernama "Keuangan"
  const urlCariNama = `https://www.googleapis.com/drive/v3/files?q=name%3D'Keuangan'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id,name,webViewLink)`;
  try {
    const res = await fetch(urlCariNama, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0] as GDriveFolder;
      }
    }
  } catch (e) {
    console.warn("Cari nama folder Keuangan gagal:", e);
  }

  // 2. Cari folder yang namanya mengandung "Keuangan"
  try {
    const urlCariContains = `https://www.googleapis.com/drive/v3/files?q=name+contains+'Keuangan'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id,name,webViewLink)`;
    const res = await fetch(urlCariContains, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0] as GDriveFolder;
      }
    }
  } catch (e) {
    console.warn("Cari contains Keuangan gagal:", e);
  }

  // 3. Folder ID bawaan dari template Apps Script jika ada
  const defaultFolderId = "1zRqAgxStMdx3Ksm_K1R8R_pec_pMg6qf";
  try {
    const resId = await fetch(
      `https://www.googleapis.com/drive/v3/files/${defaultFolderId}?fields=id,name,webViewLink,trashed`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (resId.ok) {
      const folderData = await resId.json();
      if (!folderData.trashed) {
        return folderData as GDriveFolder;
      }
    }
  } catch {
    // abaikan jika tidak bisa diakses
  }

  return null;
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
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink)&pageSize=100`;

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

  const contents: KeuanganDriveContents = {
    folder: { id: folderId, name: "Keuangan" },
    spreadsheets,
    allFiles: files,
  };

  for (const f of files) {
    const namaLower = f.name.toLowerCase();
    const isSpreadsheet =
      f.mimeType === "application/vnd.google-apps.spreadsheet" ||
      f.mimeType.includes("spreadsheet") ||
      namaLower.endsWith(".xlsx");

    if (isSpreadsheet) {
      spreadsheets.push(f);
      if (namaLower.includes("pribadi") && !contents.sheetPribadi) {
        contents.sheetPribadi = f;
      }
      if (namaLower.includes("kegiatan") && !contents.sheetKegiatan) {
        contents.sheetKegiatan = f;
      }
    } else if (f.name === "Aset.json" || namaLower.includes("aset.json")) {
      contents.fileAset = f;
    } else if (f.name === "Harga Pasar.json" || namaLower.includes("harga pasar.json")) {
      contents.fileHarga = f;
    } else if (f.name === "Sinkron.json" || namaLower.includes("sinkron.json")) {
      contents.fileSinkron = f;
    } else if (f.name === "Pengaturan.json" || namaLower.includes("pengaturan.json")) {
      contents.filePengaturan = f;
    } else if (f.name === "Laporan Kegiatan.json" || namaLower.includes("laporan kegiatan.json")) {
      contents.fileLaporanKegiatan = f;
    }
  }

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

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      const existing = (data.files || []).find(
        (f: any) => f.name.toLowerCase() === namaFolder.toLowerCase()
      );
      if (existing) {
        return existing as GDriveFolder;
      }
    }
  } catch (e) {
    console.warn(`Pencarian folder ${namaFolder} gagal:`, e);
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

  // Baca rentang B7:L (B=Tanggal, C=Uraian, D=Kategori, E=Pemasukan, F=Pengeluaran, G=Saldo, H=Kaitan, I=Catatan, J=ID, K=Metode Bayar, L=Bukti)
  const range = `'${sheetTitle}'!B7:L`;
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
  const rows: any[][] = valData.values || [];
  const hasil: Transaksi[] = [];

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

    if (rawId && idTerhapus.has(rawId)) {
      // Abaikan transaksi yang telah terhapus
      continue;
    }

    const diubahTimestamp = (rawId && mapDiubahDrive?.[rawId]) || undefined;

    if (masuk > 0 && keluar > 0) {
      const idM = rawId ? `${rawId}-m` : buatId();
      const idK = rawId ? `${rawId}-k` : buatId();
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
      const id = rawId || buatId();
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
      const id = rawId || buatId();
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
): Promise<{ transaksi: Transaksi[]; jumlahFile: number }> {
  const hasilSemua: Transaksi[] = [];
  let fileDibaca = 0;

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

  return { transaksi: hasilSemua, jumlahFile: fileDibaca };
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
  // 1. Temukan atau buat folder Keuangan
  let folder = await cariFolderKeuangan(token);
  if (!folder) {
    folder = await buatFolderKeuangan(token);
  }

  const contents = await ambilIsiFolderKeuangan(token, folder.id);

  // 2. Sinkronkan daftar ID terhapus dengan Sinkron.json
  const idTerhapusLokal = muatIdTerhapus();
  if (contents.fileSinkron) {
    const metaDrive = await bacaSinkronMeta(token, contents.fileSinkron.id);
    if (metaDrive && Array.isArray(metaDrive.terhapus)) {
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
    throw new Error("Folder 'Keuangan' tidak ditemukan di Google Drive Anda.");
  }

  const contents = await ambilIsiFolderKeuangan(token, folder.id);

  // 1. Baca metadata sinkronisasi dan satukan ID terhapus
  const idTerhapusLokal = muatIdTerhapus();
  let mapDiubahDrive: Record<string, string> | undefined;

  if (contents.fileSinkron) {
    const metaDrive = await bacaSinkronMeta(token, contents.fileSinkron.id);
    if (metaDrive) {
      if (Array.isArray(metaDrive.terhapus)) {
        for (const id of metaDrive.terhapus) {
          idTerhapusLokal.add(id);
        }
        simpanIdTerhapus(idTerhapusLokal);
      }
      mapDiubahDrive = metaDrive.diubah;
    }
  }

  // 2. Baca seluruh transaksi dari semua file spreadsheet di folder
  const { transaksi: remoteTrx } = await bacaSemuaTransaksiDariFolder(
    token,
    contents,
    idTerhapusLokal,
    mapDiubahDrive
  );

  // 3. Gabungkan transaksi lokal dan remote berdasarkan `diubah` terbaru
  const hasilGabungTrx = gabungTransaksi(transaksiLokal, remoteTrx, idTerhapusLokal);

  // 4. Tarik Aset.json jika ada
  let asetBaru = asetLokal;
  let totalAsetDitarik = 0;
  if (contents.fileAset) {
    try {
      const asetDrive = await bacaAsetDariDrive(token, contents.fileAset.id);
      if (Array.isArray(asetDrive)) {
        asetBaru = asetDrive;
        totalAsetDitarik = asetDrive.length;
      }
    } catch (e: any) {
      console.warn("Gagal membaca Aset.json dari Drive:", e.message);
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
    }
  }

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

