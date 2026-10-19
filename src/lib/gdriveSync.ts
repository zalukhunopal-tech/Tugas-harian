import { Transaksi, AsetItem, NamaDana, DataHarga } from "../types";
import { buatId, normalisasiTransaksi } from "./storage";

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

export interface KeuanganDriveContents {
  folder: GDriveFolder;
  spreadsheets: GDriveFileInfo[];
  sheetPribadi?: GDriveFileInfo;
  sheetKegiatan?: GDriveFileInfo;
  fileAset?: GDriveFileInfo;
  fileHarga?: GDriveFileInfo;
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

  // 3. Folder ID bawaan dari Apps Script Code.gs
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
  } catch (e) {
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
      if (namaLower.includes("pribadi")) {
        contents.sheetPribadi = f;
      }
      if (namaLower.includes("kegiatan")) {
        contents.sheetKegiatan = f;
      }
    } else if (f.name === "Aset.json" || namaLower.includes("aset.json")) {
      contents.fileAset = f;
    } else if (f.name === "Harga Pasar.json" || namaLower.includes("harga pasar.json")) {
      contents.fileHarga = f;
    }
  }

  return contents;
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
  // Hapus prefix Rp atau IDR
  s = s.replace(/^(rp|idr)\s*/i, "").trim();
  // Hilangkan titik pemisah ribuan bila format 100.000
  if (s.includes(".") && !s.includes(",")) {
    const parts = s.split(".");
    // Jika bagian terakhir 3 digit, ini pemisah ribuan
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      s = s.replace(/\./g, "");
    }
  } else if (s.includes(".") && s.includes(",")) {
    // Format 100.000,00 -> hilangkan titik, ganti koma dengan titik
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // Format 100000,00 -> ganti koma dengan titik
    s = s.replace(",", ".");
  }
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function bacaTransaksiDariSpreadsheet(
  token: string,
  spreadsheetId: string,
  targetDana: NamaDana
): Promise<Transaksi[]> {
  // 1. Ambil daftar tab sheet di spreadsheet
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title,sheetId))`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Gagal membaca spreadsheet: ${err}`);
  }

  const metaData = await metaRes.json();
  const sheets: Array<{ properties?: { title?: string } }> = metaData.sheets || [];

  // Cari tab yang paling sesuai (mis. "Keuangan Pribadi", "Dana Pribadi", atau tab pertama)
  let sheetTitle = sheets[0]?.properties?.title || "Sheet1";
  for (const s of sheets) {
    const t = (s.properties?.title || "").toLowerCase();
    if (targetDana === "Dana Pribadi" && (t.includes("pribadi") || t.includes("keuangan pribadi"))) {
      sheetTitle = s.properties?.title || sheetTitle;
      break;
    }
    if (targetDana === "Dana Kegiatan" && (t.includes("kegiatan") || t.includes("keuangan kegiatan"))) {
      sheetTitle = s.properties?.title || sheetTitle;
      break;
    }
  }

  // Baris data mulai baris 7, kolom B sampai J
  const range = `'${sheetTitle}'!B7:J`;
  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!valRes.ok) {
    const err = await valRes.text();
    throw new Error(`Gagal membaca rentang data sheet (${sheetTitle}): ${err}`);
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

    if (masuk > 0 && keluar > 0) {
      // Jika dua-duanya ada dalam 1 baris
      hasil.push(
        normalisasiTransaksi({
          id: rawId ? `${rawId}-m` : buatId(),
          jenis: "pemasukan",
          dana: targetDana,
          tanggal: tgl,
          deskripsi: uraian,
          kategori,
          jumlah: masuk,
          kaitan,
          catatan,
        })
      );
      hasil.push(
        normalisasiTransaksi({
          id: rawId ? `${rawId}-k` : buatId(),
          jenis: "pengeluaran",
          dana: targetDana,
          tanggal: tgl,
          deskripsi: uraian,
          kategori,
          jumlah: keluar,
          kaitan,
          catatan,
        })
      );
    } else if (masuk > 0) {
      hasil.push(
        normalisasiTransaksi({
          id: rawId || buatId(),
          jenis: "pemasukan",
          dana: targetDana,
          tanggal: tgl,
          deskripsi: uraian,
          kategori,
          jumlah: masuk,
          kaitan,
          catatan,
        })
      );
    } else if (keluar > 0) {
      hasil.push(
        normalisasiTransaksi({
          id: rawId || buatId(),
          jenis: "pengeluaran",
          dana: targetDana,
          tanggal: tgl,
          deskripsi: uraian,
          kategori,
          jumlah: keluar,
          kaitan,
          catatan,
        })
      );
    }
  }

  return hasil;
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

export async function simpanTransaksiKeSpreadsheet(
  token: string,
  spreadsheetId: string,
  transaksiList: Transaksi[],
  dana: NamaDana
): Promise<number> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) throw new Error(`Gagal membuka spreadsheet ${dana}`);
  const metaData = await metaRes.json();
  const sheets: Array<{ properties?: { title?: string } }> = metaData.sheets || [];

  let sheetTitle = sheets[0]?.properties?.title || "Sheet1";
  for (const s of sheets) {
    const t = (s.properties?.title || "").toLowerCase();
    if (dana === "Dana Pribadi" && (t.includes("pribadi") || t.includes("keuangan pribadi"))) {
      sheetTitle = s.properties?.title || sheetTitle;
      break;
    }
    if (dana === "Dana Kegiatan" && (t.includes("kegiatan") || t.includes("keuangan kegiatan"))) {
      sheetTitle = s.properties?.title || sheetTitle;
      break;
    }
  }

  const trxDana = transaksiList
    .filter((t) => t.dana === dana)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const rows = trxDana.map((t) => [
    t.tanggal,
    t.deskripsi,
    t.kategori,
    t.jenis === "pemasukan" ? t.jumlah : "",
    t.jenis === "pengeluaran" ? t.jumlah : "",
    "", // Kolom G: Saldo
    t.kaitan || "",
    t.catatan || "",
    t.id,
  ]);

  if (rows.length === 0) return 0;

  const range = `'${sheetTitle}'!B7:J${6 + rows.length}`;
  const res = await fetch(
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
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal menulis ke spreadsheet ${dana}: ${err}`);
  }

  return rows.length;
}
