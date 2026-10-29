import { BarisTimesheet, DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import type { GDriveFileInfo, KeuanganDriveContents } from "./gdriveSync";
import { buatId } from "./storage";
import { adalahPerdiemKegiatan, daftarTanggalRentang } from "./perdiemOtomatis";
import { transaksiKegiatan } from "./penyelesaianDana";
import {
  barisUntukSimpan,
  batchDariJudul,
  batchDariNama,
  batchKegiatan,
  BerkasTimesheet,
  cocokkanFileTimesheet,
  IsiTimesheet,
  judulTabTimesheet,
  judulUntukTimesheet,
  namaFileBeririsan,
  namaFileTimesheet,
  rentangBersih,
  rentangMengikutiTimesheet,
  susunIsiTimesheet,
  uraikanIsiTimesheet,
} from "./timesheet";

/**
 * Membaca, menarik, dan membuat file timesheet perdiem di folder Keuangan Google Drive.
 * Aturan keselamatan: file timesheet yang sudah ada milik pengguna hanya DIBACA. Aplikasi menulis hanya ke file
 * yang ia buat sendiri (salinan file timesheet terbaru, ditandai `timesheetDibuatApp`).
 */

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const BARIS_BACA = 200;

/** Keterangan hari per file timesheet yang sudah dibaca sesi ini, diacu dengan waktu ubah file supaya tidak dibaca dua kali. */
const cacheKeterangan = new Map<string, { diubah?: string; keterangan: string[] }>();

export type StatusTimesheet = "diperbarui" | "tetap" | "belum-ada-file" | "dibuat";

export interface HasilTimesheet {
  kegiatan: DataKegiatan;
  status: StatusTimesheet;
  /** Isi tarikan atau isi yang ditulis ke file; ada bila status "diperbarui" atau "dibuat". */
  isi?: IsiTimesheet;
  /** Apakah data kegiatan berubah dibanding sebelumnya (selain cap waktu tarik), perlu disinkron ke Drive. */
  berubah: boolean;
}

export function tautanTimesheet(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function berkasDariDrive(f: GDriveFileInfo): BerkasTimesheet {
  return { id: f.id, nama: f.name, modifiedTime: f.modifiedTime };
}

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

const header = (token: string, json = false): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

/** Tab yang dipakai: yang namanya memuat "timesheet", bila tidak ada tab pertama. */
async function infoTab(token: string, fileId: string): Promise<{ judul: string; sheetId?: number }> {
  const res = await fetch(`${SHEETS}/${fileId}?fields=sheets(properties(title,sheetId))`, { headers: header(token) });
  await pastikanOk(res, "Membaca daftar tab timesheet");
  const data = await res.json();
  const tab: Array<{ properties?: { title?: string; sheetId?: number } }> = data.sheets || [];
  const pilih = tab.find((t) => /timesheet/i.test(t.properties?.title || "")) ?? tab[0];
  return { judul: pilih?.properties?.title || "Sheet1", sheetId: pilih?.properties?.sheetId };
}

/** Baca isi file timesheet (hanya baca). */
export async function bacaIsiFileTimesheet(
  token: string,
  fileId: string,
  rentang?: { mulai: string; selesai: string }
): Promise<IsiTimesheet> {
  const { judul } = await infoTab(token, fileId);
  const range = `'${judul}'!A1:G${BARIS_BACA}`;
  const res = await fetch(`${SHEETS}/${fileId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, {
    headers: header(token),
  });
  await pastikanOk(res, "Membaca isi timesheet");
  const data = await res.json();
  const nilai: string[][] = Array.isArray(data.values) ? data.values.map((b: unknown[]) => b.map((v) => String(v ?? ""))) : [];
  return uraikanIsiTimesheet(nilai, rentang);
}

function samaBaris(a: BarisTimesheet[] | undefined, b: BarisTimesheet[]): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

/**
 * Cocokkan kegiatan dengan file timesheet-nya di Drive dan tarik isinya (Keterangan dan Lokasi per tanggal).
 * `berkasId` memaksa memakai file tertentu (hubungkan manual); `paksa` membaca ulang walau file tidak berubah.
 */
export async function tarikTimesheetKegiatan(
  token: string,
  contents: KeuanganDriveContents,
  k: DataKegiatan,
  opsi: { paksa?: boolean; berkasId?: string } = {}
): Promise<HasilTimesheet> {
  const daftar = (contents.timesheets ?? []).map(berkasDariDrive);
  const berkas = opsi.berkasId ? daftar.find((f) => f.id === opsi.berkasId) : cocokkanFileTimesheet(k, daftar);
  if (!berkas) return { kegiatan: k, status: "belum-ada-file", berubah: false };

  const terbaru =
    !opsi.paksa &&
    !opsi.berkasId &&
    k.timesheetId === berkas.id &&
    k.timesheetBaris &&
    k.timesheetSinkron &&
    berkas.modifiedTime &&
    berkas.modifiedTime <= k.timesheetSinkron;
  if (terbaru) {
    // File tidak berubah, tetapi rentang kegiatan yang tercatat bisa tertinggal dari tanggal di timesheet (data lama): rapikan tanpa membaca ulang.
    const rentangSalinan = rentangMengikutiTimesheet(k, k.timesheetBaris ?? []);
    if (rentangSalinan.tanggalMulai === k.tanggalMulai && rentangSalinan.tanggalSelesai === k.tanggalSelesai) {
      return { kegiatan: k, status: "tetap", berubah: false };
    }
    return { kegiatan: { ...k, ...rentangSalinan }, status: "diperbarui", berubah: true };
  }

  const isi = await bacaIsiFileTimesheet(token, berkas.id, { mulai: k.tanggalMulai, selesai: k.tanggalSelesai });
  cacheKeterangan.set(berkas.id, { diubah: berkas.modifiedTime, keterangan: isi.baris.map((b) => b.keterangan.trim()).filter(Boolean) });
  const baris = barisUntukSimpan(isi.baris);
  // Tanggal di timesheet menjadi sumber kebenaran: rentang kegiatan ikut melebar bila timesheet memuat hari di luarnya.
  const rentang = rentangMengikutiTimesheet(k, isi.baris);
  const rentangBerubah = rentang.tanggalMulai !== k.tanggalMulai || rentang.tanggalSelesai !== k.tanggalSelesai;
  const berubah =
    k.timesheetId !== berkas.id || k.timesheetNama !== berkas.nama || !samaBaris(k.timesheetBaris, baris) || rentangBerubah;
  const kegiatan: DataKegiatan = {
    ...k,
    ...rentang,
    batch: k.batch ?? batchDariNama(berkas.nama),
    timesheetId: berkas.id,
    timesheetNama: berkas.nama,
    timesheetBaris: baris,
    timesheetSinkron: new Date().toISOString(),
    timesheetDibuatApp: k.timesheetId === berkas.id ? k.timesheetDibuatApp : undefined,
  };
  return { kegiatan, status: berubah ? "diperbarui" : "tetap", isi, berubah };
}

/**
 * Keterangan semua hari di semua file timesheet di folder Keuangan (hanya baca; file yang tidak berubah tidak dibaca
 * ulang dalam satu sesi). Dipakai untuk mengenali transaksi nyasar dari file itu, walau kegiatannya belum dicocokkan.
 */
export async function kumpulkanKeteranganTimesheet(token: string, contents: KeuanganDriveContents): Promise<string[]> {
  const hasil = new Set<string>();
  for (const f of contents.timesheets ?? []) {
    try {
      let cache = cacheKeterangan.get(f.id);
      if (!cache || cache.diubah !== f.modifiedTime) {
        const isi = await bacaIsiFileTimesheet(token, f.id);
        cache = { diubah: f.modifiedTime, keterangan: isi.baris.map((b) => b.keterangan.trim()).filter(Boolean) };
        cacheKeterangan.set(f.id, cache);
      }
      cache.keterangan.forEach((k) => hasil.add(k));
    } catch (err) {
      console.warn(`Timesheet "${f.name}" tidak terbaca untuk pemeriksaan transaksi nyasar:`, err);
    }
  }
  return [...hasil];
}

/** Tarik timesheet untuk banyak kegiatan; satu kegiatan yang gagal tidak menggagalkan yang lain. */
export async function tarikTimesheetSemuaKegiatan(
  token: string,
  contents: KeuanganDriveContents,
  daftar: DataKegiatan[]
): Promise<{ daftar: DataKegiatan[]; berubah: boolean; galat: string[] }> {
  const galat: string[] = [];
  let berubah = false;
  const hasil: DataKegiatan[] = [];
  for (const k of daftar) {
    try {
      const h = await tarikTimesheetKegiatan(token, contents, k);
      hasil.push(h.kegiatan);
      if (h.berubah) berubah = true;
    } catch (err: any) {
      galat.push(`${k.nama}: ${err?.message ?? err}`);
      hasil.push(k);
    }
  }
  return { daftar: hasil, berubah, galat };
}

/* ---------- membuat dan memperbarui file milik aplikasi ---------- */

/** Hari yang ditulis ke file: hari perdiem yang sudah dicatat; bila belum ada, seluruh hari dalam rentang kegiatan. */
function barisUntukFile(
  k: DataKegiatan,
  transaksi: Transaksi[],
  semuaKegiatan: DataKegiatan[],
  keteranganLama: Map<string, BarisTimesheet>
): BarisTimesheet[] {
  const perTanggal = new Map<string, number>();
  for (const t of transaksiKegiatan(transaksi, k, semuaKegiatan)) {
    if (adalahPerdiemKegiatan(t)) perTanggal.set(t.tanggal, (perTanggal.get(t.tanggal) ?? 0) + t.jumlah);
  }
  const tanggal = perTanggal.size ? [...perTanggal.keys()] : daftarTanggalRentang(k.tanggalMulai, k.tanggalSelesai).tanggal;
  return tanggal
    .sort((a, b) => a.localeCompare(b))
    .map((t) => ({
      tanggal: t,
      keterangan: keteranganLama.get(t)?.keterangan ?? "",
      lokasi: keteranganLama.get(t)?.lokasi ?? "",
      jumlah: perTanggal.get(t),
    }));
}

async function tulisIsiKeFile(
  token: string,
  fileId: string,
  nilai: Array<Array<string | number>>,
  judulTab: string,
  sheetId: number | undefined,
  judulBaru?: string
): Promise<void> {
  const bersih = await fetch(`${SHEETS}/${fileId}/values/${encodeURIComponent(rentangBersih(judulTab, nilai.length))}:clear`, {
    method: "POST",
    headers: header(token, true),
    body: "{}",
  });
  await pastikanOk(bersih, "Mengosongkan salinan timesheet");

  const range = `'${judulTab}'!A1:E${nilai.length}`;
  const tulis = await fetch(`${SHEETS}/${fileId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: header(token, true),
    body: JSON.stringify({ range, majorDimension: "ROWS", values: nilai }),
  });
  await pastikanOk(tulis, "Menulis isi timesheet");

  // Nama tab ikut batch baru. Hanya jalur Google langsung yang bisa; di mode konektor ditolak dan itu tidak apa-apa.
  if (judulBaru && sheetId !== undefined && judulBaru !== judulTab) {
    try {
      await fetch(`${SHEETS}/${fileId}:batchUpdate`, {
        method: "POST",
        headers: header(token, true),
        body: JSON.stringify({
          requests: [{ updateSheetProperties: { properties: { sheetId, title: judulBaru }, fields: "title" } }],
        }),
      });
    } catch {
      // abaikan
    }
  }
}

function dataIsi(k: DataKegiatan, profil: ProfilPelapor, baris: BarisTimesheet[]) {
  const batch = batchKegiatan(k);
  return {
    proyek: profil.proyek,
    judulKegiatan: judulUntukTimesheet(k.nama, batch),
    nama: profil.nama,
    mulai: k.tanggalMulai,
    selesai: k.tanggalSelesai,
    baris,
    disetujuiOleh: profil.penyetuju ?? "",
  };
}

/**
 * Siapkan file timesheet untuk kegiatan: pakai file yang cocok (batch dan tahun), dan bila belum ada buat file baru
 * dengan menyalin file timesheet terbaru di folder (format sama persis) lalu mengisinya. Nama file mengikuti batch dan
 * periode kegiatan, mis. "FORM LAPORAN TIMESHEET KEGIATAN BATCH 5 (NOVEMBER 2026)".
 */
export async function siapkanTimesheetKegiatan(
  token: string,
  contents: KeuanganDriveContents,
  k: DataKegiatan,
  profil: ProfilPelapor,
  transaksi: Transaksi[],
  semuaKegiatan: DataKegiatan[],
  opsi: { bolehBuat?: boolean } = {}
): Promise<HasilTimesheet> {
  const ada = await tarikTimesheetKegiatan(token, contents, k);
  if (ada.status !== "belum-ada-file" || opsi.bolehBuat === false) return ada;

  const batch = batchKegiatan(k);
  if (!batch) {
    throw new Error("Isi batch kegiatan dulu supaya aplikasi tahu file timesheet yang dipakai.");
  }
  // Sudah ada file timesheet untuk periode yang sama (batch lain): jangan menambah file kedua, pilih yang sudah ada.
  const sePeriode = (contents.timesheets ?? []).find((f) => namaFileBeririsan(f.name, k.tanggalMulai, k.tanggalSelesai));
  if (sePeriode) {
    throw new Error(
      `Sudah ada file timesheet untuk periode ini: "${sePeriode.name}". Pilih file itu lewat "Pakai file lain", atau ubah nomor batch kegiatan bila memang berbeda.`
    );
  }
  const contoh = [...(contents.timesheets ?? [])].sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))[0];
  if (!contoh) {
    throw new Error(
      "Belum ada file timesheet di folder Keuangan untuk dijadikan contoh format. Salin satu file timesheet dulu, lalu coba lagi."
    );
  }

  const nama = namaFileTimesheet(batch, k.tanggalMulai, k.tanggalSelesai);
  const salin = await fetch(`${DRIVE}/${contoh.id}/copy?fields=id,name,mimeType,webViewLink,modifiedTime`, {
    method: "POST",
    headers: header(token, true),
    body: JSON.stringify({ name: nama, parents: [contents.folder.id] }),
  });
  await pastikanOk(salin, "Menyalin file timesheet");
  const fileBaru = (await salin.json()) as GDriveFileInfo;
  if (!fileBaru.name) fileBaru.name = nama;
  contents.timesheets.push(fileBaru);
  contents.allFiles.push(fileBaru);

  const { judul, sheetId } = await infoTab(token, fileBaru.id);
  const baris = barisUntukFile(k, transaksi, semuaKegiatan, new Map());
  const { nilai } = susunIsiTimesheet(dataIsi(k, profil, baris));
  await tulisIsiKeFile(token, fileBaru.id, nilai, judul, sheetId, judulTabTimesheet(batch));

  const kegiatan: DataKegiatan = {
    ...k,
    batch,
    timesheetId: fileBaru.id,
    timesheetNama: fileBaru.name,
    timesheetBaris: barisUntukSimpan(baris),
    timesheetSinkron: new Date().toISOString(),
    timesheetDibuatApp: true,
  };
  return { kegiatan, status: "dibuat", berubah: true };
}

/**
 * Perbarui tanggal dan jumlah di file buatan aplikasi mengikuti perdiem yang tercatat; Keterangan dan Lokasi yang
 * sudah diisi pengguna di file tetap dipertahankan. File yang bukan buatan aplikasi tidak pernah ditulis.
 */
export async function perbaruiFileTimesheetKegiatan(
  token: string,
  k: DataKegiatan,
  profil: ProfilPelapor,
  transaksi: Transaksi[],
  semuaKegiatan: DataKegiatan[]
): Promise<HasilTimesheet> {
  if (!k.timesheetId || !k.timesheetDibuatApp) {
    throw new Error("File timesheet ini bukan buatan aplikasi, jadi hanya dibaca. Ubah isinya langsung di Google Sheets.");
  }
  const lama = await bacaIsiFileTimesheet(token, k.timesheetId, { mulai: k.tanggalMulai, selesai: k.tanggalSelesai });
  const keteranganLama = new Map(lama.baris.map((b) => [b.tanggal, b]));
  const baris = barisUntukFile(k, transaksi, semuaKegiatan, keteranganLama);
  const { judul, sheetId } = await infoTab(token, k.timesheetId);
  const { nilai } = susunIsiTimesheet({
    ...dataIsi(k, profil, baris),
    disetujuiOleh: lama.disetujuiOleh || profil.penyetuju || "",
  });
  await tulisIsiKeFile(token, k.timesheetId, nilai, judul, sheetId);
  const kegiatan: DataKegiatan = {
    ...k,
    timesheetBaris: barisUntukSimpan(baris),
    timesheetSinkron: new Date().toISOString(),
  };
  return { kegiatan, status: "diperbarui", berubah: true };
}

/**
 * Buat data kegiatan dari sebuah file timesheet yang belum punya kegiatan di aplikasi: nama dari Judul Kegiatan, rentang dari
 * tanggal pertama dan terakhir, batch dari nama file, dan Keterangan/Lokasi langsung tersalin. File hanya dibaca.
 */
export async function buatKegiatanDariTimesheet(token: string, berkas: GDriveFileInfo): Promise<DataKegiatan> {
  const isi = await bacaIsiFileTimesheet(token, berkas.id);
  const tanggal = isi.baris.map((b) => b.tanggal).sort();
  if (tanggal.length === 0) throw new Error(`File "${berkas.name}" belum berisi tanggal uang harian.`);
  const batch = batchDariNama(berkas.name) ?? batchDariJudul(isi.judulKegiatan);
  cacheKeterangan.set(berkas.id, { diubah: berkas.modifiedTime, keterangan: isi.baris.map((b) => b.keterangan.trim()).filter(Boolean) });
  return {
    id: "kg_" + buatId(),
    nama: isi.judulKegiatan || berkas.name,
    lokasi: isi.proyek,
    tanggalMulai: tanggal[0],
    tanggalSelesai: tanggal[tanggal.length - 1],
    ...(batch ? { batch } : {}),
    timesheetId: berkas.id,
    timesheetNama: berkas.name,
    timesheetBaris: barisUntukSimpan(isi.baris),
    timesheetSinkron: new Date().toISOString(),
    dibuat: new Date().toISOString(),
  };
}
