/**
 * Penerjemah permintaan REST Google (Drive v3 dan Sheets v4) ke konektor Google Drive dan Google Sheets
 * milik akun Claude yang membuka artefak.
 *
 * Kenapa ada: sandbox artefak memblokir jaringan keluar dan popup login, jadi `src/lib/gdriveSync.ts`
 * (yang memanggil googleapis.com dengan token) tidak bisa jalan apa adanya. Daripada menyalin logika
 * sinkronnya, lapisan ini dipasang di `window.fetch` dan menerjemahkan permintaan yang sama ke
 * `claude.mcp.callTool`. Kalau `gdriveSync.ts` berubah tetapi tetap memakai endpoint yang sama, artefak
 * ikut berubah setelah dibangun ulang.
 *
 * Batas konektor yang disiasati di sini:
 * - `update_file` hanya mengubah metadata, bukan isi file. "Timpa isi" (PATCH uploadType=media) ditiru dengan
 *   membuat file baru lalu memindahkan yang lama ke Sampah, dan hanya untuk file keadaan aplikasi
 *   (Aset/Sinkron/Pengaturan/Laporan Kegiatan .json dan laporan .docx). ID file berubah; aplikasi selalu
 *   membaca ulang isi folder sebelum menyinkron, jadi tidak masalah.
 * - Konektor Sheets tidak bisa membuat spreadsheet baru. Spreadsheet tahun baru dibuat lewat salinan
 *   (copy_file) dari tahun sebelumnya, seperti jalur utama di aplikasi.
 * - `valueRenderOption` diabaikan: nilai sel datang sebagai teks terformat. Pembaca di aplikasi
 *   (`parseTanggalSheet`, `parseJumlahRupiah`) memang menangani teks.
 */

export const SERVER_DRIVE = "Google Drive";
export const SERVER_SHEETS = "Google Sheets";

const MIME_FOLDER = "application/vnd.google-apps.folder";
const NAMA_JSON_KEADAAN = /^(Aset|Sinkron|Pengaturan|Laporan Kegiatan)\.json$/i;
// Yang cukup satu salinan terbaru. Sinkron.json tidak termasuk: salinan lamanya (juga yang sudah di Sampah, yang tak bisa
// disaring dari pencarian) menyimpan catatan penghapusan yang harus ikut dibaca aplikasi, lihat bacaSinkronGabungan.
const NAMA_JSON_SATU_SALINAN = /^(Aset|Pengaturan|Laporan Kegiatan)\.json$/i;
const BATAS_BASE64_INLINE = 700 * 1024; // input callTool dibatasi 1 MiB
const BARIS_PER_TULIS = 500;

interface HasilPanggil {
  payload?: unknown;
}

export interface Mcp {
  callTool(
    server: string,
    tool: string,
    input?: unknown,
    options?: { cache?: false | { staleTime?: number; gcTime?: number; refresh?: boolean } }
  ): Promise<HasilPanggil>;
  listTools(server?: string): Promise<{
    servers: Array<{ server: string; authStatus: string; tools: Array<{ name: string }> }>;
    fileArgs?: boolean;
  }>;
}

interface Claude {
  use(nama: string): Promise<any>;
}

function claudeGlobal(): Claude | undefined {
  return (window as unknown as { claude?: Claude }).claude;
}

let janjiMcp: Promise<Mcp | null> | null = null;

/** Namespace `mcp` bila tampilan ini boleh memakainya; `null` bila tidak (lihat claude.use). */
export function dapatkanMcp(): Promise<Mcp | null> {
  if (!janjiMcp) {
    const c = claudeGlobal();
    janjiMcp = c?.use ? c.use("mcp").then((m: Mcp | null) => m ?? null, () => null) : Promise.resolve(null);
  }
  return janjiMcp;
}

export async function dapatkanIzin(): Promise<any | null> {
  const c = claudeGlobal();
  if (!c?.use) return null;
  try {
    return (await c.use("permissions")) ?? null;
  } catch {
    return null;
  }
}

/* ---------- galat ---------- */

interface GalatMcp {
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterMs?: number;
}

class GalatHttp extends Error {
  constructor(public status: number, pesan: string) {
    super(pesan);
  }
}

function dariGalatMcp(err: unknown): GalatHttp {
  if (err instanceof GalatHttp) return err;
  const e = (err ?? {}) as GalatMcp;
  switch (e.code) {
    case "needs_reauth":
      return new GalatHttp(401, "Sambungan Google kedaluwarsa. Sambungkan ulang di claude.ai → Settings → Connectors.");
    case "server_not_connected":
    case "server_not_found":
      return new GalatHttp(
        401,
        "Konektor Google Drive atau Google Sheets belum ada di akun Claude ini. Tambahkan di claude.ai → Settings → Connectors."
      );
    case "selection_required":
      return new GalatHttp(401, "Ada lebih dari satu konektor dengan nama yang sama. Pilih salah satu saat diminta, lalu muat ulang.");
    case "not_in_manifest":
    case "approval_required":
    case "consent_required":
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return new GalatHttp(403, "Izin konektor untuk halaman ini ditolak atau dimatikan. Aktifkan dari menu Izin halaman, lalu muat ulang.");
    case "blocked_by_policy":
      return new GalatHttp(403, "Akses ke Google diblokir kebijakan organisasi.");
    case "server_unavailable":
    case "rate_limited":
    case "upstream_error":
      return new GalatHttp(503, "Google sedang tidak bisa dihubungi. Coba lagi sebentar lagi.");
    case "tool_error":
      return new GalatHttp(400, `Google menolak permintaan: ${String(e.message ?? "").slice(0, 300)}`);
    default:
      return new GalatHttp(500, String(e.message ?? "Kesalahan tidak dikenal dari konektor."));
  }
}

/* ---------- pemanggilan ---------- */

const tunda = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function panggil(server: string, tool: string, input: unknown, boleh_ulang: boolean): Promise<any> {
  const mcp = await dapatkanMcp();
  if (!mcp) throw new GalatHttp(403, "Halaman ini tidak diberi akses konektor. Buka artefak lewat claude.ai dengan akun pemilik.");
  try {
    const hasil = await mcp.callTool(server, tool, input, { cache: false });
    return hasil.payload ?? {};
  } catch (err) {
    const e = err as GalatMcp;
    // Ulangi satu kali, hanya untuk baca: untuk tulis, galat `retryable` adalah hasil yang ambigu.
    if (boleh_ulang && e?.retryable) {
      await tunda(Math.min(e.retryAfterMs ?? 1500, 5000));
      try {
        const hasil = await mcp.callTool(server, tool, input, { cache: false });
        return hasil.payload ?? {};
      } catch (err2) {
        throw dariGalatMcp(err2);
      }
    }
    throw dariGalatMcp(err);
  }
}

let jumlahGalatBaca = 0;

/**
 * Banyaknya pembacaan yang gagal sejak halaman dibuka. Pembungkus gdriveSync memakainya untuk tahu apakah
 * sebuah "tarik data" benar-benar utuh: aplikasi menelan galat baca per spreadsheet, jadi tarik yang
 * sebagian gagal tampak seperti Drive yang kosong.
 */
export const hitungGalatBaca = () => jumlahGalatBaca;

async function baca(server: string, tool: string, input: unknown): Promise<any> {
  try {
    return await panggil(server, tool, input, true);
  } catch (err) {
    // get_file_metadata dipakai untuk menjajaki folder bawaan yang boleh saja tidak ada; galat "alat menolak"
    // dari Drive (mis. file tidak ditemukan) juga bukan tanda kegagalan sistem.
    const galatTolakan = err instanceof GalatHttp && err.status === 400 && server === SERVER_DRIVE;
    if (tool !== "get_file_metadata" && !galatTolakan) jumlahGalatBaca++;
    throw err;
  }
}
const tulis = (server: string, tool: string, input: unknown) => panggil(server, tool, input, false);

/* ---------- pembantu ---------- */

function teksKeJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function teksGalat(status: number, pesan: string): Response {
  return new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function base64KeByte(b64: string) {
  const biner = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) out[i] = biner.charCodeAt(i);
  return out;
}

function byteKeBase64(byte: Uint8Array): string {
  let s = "";
  const potong = 0x8000;
  for (let i = 0; i < byte.length; i += potong) {
    s += String.fromCharCode(...byte.subarray(i, i + potong));
  }
  return btoa(s);
}

function bentukFileDrive(f: any) {
  return {
    id: f.id,
    name: f.title ?? f.name,
    mimeType: f.mimeType,
    webViewLink: f.viewUrl ?? f.webViewLink,
    modifiedTime: f.modifiedTime,
    parents: f.parentId ? [f.parentId] : undefined,
    // Konektor hanya memberi email pemilik (kolom `owner`), tanpa nama.
    owners: f.owner ? [{ emailAddress: f.owner }] : undefined,
    trashed: false,
  };
}

/* ---------- kueri Drive v3 -> kueri konektor ---------- */

function bagiDanDiLuarKutip(q: string): string[] {
  const hasil: string[] = [];
  let mulai = 0;
  let dalamKutip = false;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (ch === "\\" && dalamKutip) {
      i++;
      continue;
    }
    if (ch === "'") dalamKutip = !dalamKutip;
    if (!dalamKutip) {
      const m = /^\s+and\s+/i.exec(q.slice(i));
      if (m) {
        hasil.push(q.slice(mulai, i));
        i += m[0].length - 1;
        mulai = i + 1;
      }
    }
  }
  hasil.push(q.slice(mulai));
  return hasil;
}

const KUTIP = "('(?:\\\\.|[^'\\\\])*')";

export function terjemahkanKueri(q: string): string {
  const hasil: string[] = [];
  for (const klausa of bagiDanDiLuarKutip(q)) {
    const s = klausa.trim();
    let m: RegExpExecArray | null;
    if (/^trashed\s*=\s*false$/i.test(s)) continue;
    if (/^sharedWithMe\s*=\s*true$/i.test(s)) {
      hasil.push("sharedWithMe = true");
      continue;
    }
    if ((m = new RegExp(`^name\\s*(=|contains)\\s*${KUTIP}$`, "i").exec(s))) {
      hasil.push(`title ${m[1].toLowerCase()} ${m[2]}`);
    } else if ((m = new RegExp(`^${KUTIP}\\s+in\\s+parents$`, "i").exec(s))) {
      hasil.push(`parentId = ${m[1]}`);
    } else if ((m = new RegExp(`^mimeType\\s*(=|contains)\\s*${KUTIP}$`, "i").exec(s))) {
      hasil.push(`mimeType ${m[1].toLowerCase()} ${m[2]}`);
    } else {
      throw new GalatHttp(400, `Kueri Drive tidak didukung konektor: ${s}`);
    }
  }
  if (hasil.length === 0) throw new GalatHttp(400, "Kueri Drive kosong.");
  return hasil.join(" and ");
}

/* ---------- Drive ---------- */

// File yang baru dipindahkan ke Sampah oleh sesi ini; disaring dari daftar kalau pencarian masih memuatnya.
const sudahDiSampah = new Set<string>();

// ID lama -> ID pengganti, untuk file yang isinya "ditimpa" (dibuat ulang). Aplikasi menyimpan ID dari
// daftar folder terakhir; tanpa pemetaan ini, penimpaan kedua lewat ID lama akan membuat file kembar.
const penggantiId = new Map<string, string>();

function idTerkini(id: string): string {
  let sekarang = id;
  for (let i = 0; i < 20 && penggantiId.has(sekarang); i++) sekarang = penggantiId.get(sekarang)!;
  return sekarang;
}

// File yang baru dibuat oleh sesi ini; ditambahkan ke daftar bila indeks pencarian Drive belum memuatnya,
// supaya sinkron berikutnya tidak membuat Aset.json atau Sinkron.json kembar.
interface BerkasBaru {
  id: string;
  title: string;
  mimeType: string;
  parentId?: string;
  viewUrl?: string;
  modifiedTime: string;
}
const baruDibuat: BerkasBaru[] = [];

const bukaKutip = (v: string) => v.slice(1, -1).replace(/\\(.)/g, "$1");

function cocokKlausa(f: BerkasBaru, klausa: string): boolean {
  let m: RegExpExecArray | null;
  if ((m = new RegExp(`^title\\s+(=|contains)\\s+${KUTIP}$`, "i").exec(klausa))) {
    const nilai = bukaKutip(m[2]);
    return m[1] === "=" ? f.title === nilai : f.title.toLowerCase().includes(nilai.toLowerCase());
  }
  if ((m = new RegExp(`^parentId\\s*=\\s*${KUTIP}$`, "i").exec(klausa))) return f.parentId === bukaKutip(m[1]);
  if ((m = new RegExp(`^mimeType\\s+(=|contains)\\s+${KUTIP}$`, "i").exec(klausa))) {
    const nilai = bukaKutip(m[2]);
    return m[1] === "=" ? f.mimeType === nilai : f.mimeType.includes(nilai);
  }
  return false;
}

async function daftarFile(url: URL): Promise<Response> {
  const query = terjemahkanKueri(url.searchParams.get("q") ?? "");
  const ukuranHalaman = 100;
  const semua = new Map<string, any>();
  let token: string | undefined;
  for (let halaman = 0; halaman < 10; halaman++) {
    const r = await baca(SERVER_DRIVE, "search_files", {
      query,
      pageSize: ukuranHalaman,
      excludeContentSnippets: true,
      ...(token ? { pageToken: token } : {}),
    });
    const files: any[] = Array.isArray(r.files) ? r.files : [];
    for (const f of files) if (f?.id) semua.set(f.id, f);
    // Konektor selalu menyertakan nextPageToken; halaman yang tidak penuh berarti halaman terakhir.
    if (files.length < ukuranHalaman || !r.nextPageToken) break;
    token = r.nextPageToken;
  }

  for (const b of baruDibuat) {
    if (!semua.has(b.id) && bagiDanDiLuarKutip(query).every((k) => cocokKlausa(b, k.trim()))) semua.set(b.id, b);
  }
  let hasil = [...semua.values()].filter((f) => !sudahDiSampah.has(f.id));

  // Jaga-jaga bila file lama belum hilang dari hasil pencarian: untuk file keadaan aplikasi pakai yang terbaru.
  const terbaru = new Map<string, any>();
  for (const f of hasil) {
    if (!NAMA_JSON_SATU_SALINAN.test(f.title ?? "")) continue;
    const kunci = String(f.title).toLowerCase();
    const lama = terbaru.get(kunci);
    if (!lama || String(f.modifiedTime ?? "") > String(lama.modifiedTime ?? "")) terbaru.set(kunci, f);
  }
  hasil = hasil.filter((f) => !NAMA_JSON_SATU_SALINAN.test(f.title ?? "") || terbaru.get(String(f.title).toLowerCase()) === f);

  return teksKeJson({ files: hasil.map(bentukFileDrive) });
}

async function metadataFile(id: string): Promise<Response> {
  const f = await baca(SERVER_DRIVE, "get_file_metadata", { fileId: idTerkini(id), excludeContentSnippets: true });
  return teksKeJson(bentukFileDrive(f));
}

async function unduhFile(id: string): Promise<Response> {
  const r = await baca(SERVER_DRIVE, "download_file_content", { fileId: idTerkini(id) });
  if (typeof r.content !== "string") throw new GalatHttp(400, "Konektor tidak mengembalikan isi file.");
  return new Response(base64KeByte(r.content), {
    status: 200,
    headers: { "Content-Type": r.mimeType || "application/octet-stream" },
  });
}

function adalahTeks(tipe: string): boolean {
  return tipe === "application/json" || tipe.startsWith("text/");
}

async function buatFile(
  meta: { name: string; parents?: string[]; mimeType?: string },
  isi: Blob
): Promise<any> {
  const tipe = meta.mimeType || isi.type || "application/octet-stream";
  const masukan: Record<string, unknown> = {
    title: meta.name,
    contentMimeType: tipe,
    disableConversionToGoogleType: true,
  };
  if (meta.parents?.[0]) masukan.parentId = meta.parents[0];

  if (adalahTeks(tipe)) {
    masukan.textContent = await isi.text();
  } else {
    const mcp = await dapatkanMcp();
    const daftar = mcp ? await mcp.listTools().catch(() => null) : null;
    if (daftar?.fileArgs) {
      masukan.base64Content = { $file: { data: isi, name: meta.name, type: tipe } };
    } else if (isi.size <= BATAS_BASE64_INLINE) {
      masukan.base64Content = byteKeBase64(new Uint8Array(await isi.arrayBuffer()));
    } else {
      throw new GalatHttp(413, "File terlalu besar untuk dikirim lewat konektor dari tampilan ini.");
    }
  }
  const f = await tulis(SERVER_DRIVE, "create_file", masukan);
  const id: string = f.id ?? f.fileId ?? (await cariIdBerkasBaru(meta.name, meta.parents?.[0]));
  const hasil = { id, name: f.title ?? meta.name, mimeType: f.mimeType ?? tipe, webViewLink: f.viewUrl ?? f.webViewLink };
  catatBaru({ id, title: hasil.name, mimeType: hasil.mimeType, parentId: meta.parents?.[0], viewUrl: hasil.webViewLink });
  return hasil;
}

function catatBaru(b: Omit<BerkasBaru, "modifiedTime">): void {
  baruDibuat.push({ ...b, modifiedTime: new Date().toISOString() });
  if (baruDibuat.length > 200) baruDibuat.shift();
}

/** Jaga-jaga bila jawaban create_file tidak memuat ID: cari file yang baru dibuat berdasarkan nama dan folder. */
async function cariIdBerkasBaru(nama: string, induk?: string): Promise<string> {
  const esc = nama.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = `title = '${esc}'${induk ? ` and parentId = '${induk}'` : ""}`;
  const r = await baca(SERVER_DRIVE, "search_files", { query, pageSize: 20, excludeContentSnippets: true });
  const files: any[] = Array.isArray(r.files) ? r.files : [];
  files.sort((a, b) => String(b.modifiedTime ?? "").localeCompare(String(a.modifiedTime ?? "")));
  if (!files[0]?.id) throw new GalatHttp(502, `File "${nama}" dibuat, tetapi konektor tidak memberi tahu ID-nya.`);
  return files[0].id;
}

async function buatFolder(badan: { name: string; parents?: string[] }): Promise<Response> {
  const dasar: Record<string, unknown> = { title: badan.name };
  if (badan.parents?.[0]) dasar.parentId = badan.parents[0];
  let f: any;
  try {
    f = await tulis(SERVER_DRIVE, "create_file", { ...dasar, mimeType: MIME_FOLDER });
  } catch (err) {
    // Deskripsi alat menyebut kedua nama kolom; coba nama yang satunya bila yang pertama ditolak.
    if (err instanceof GalatHttp && err.status === 400) {
      f = await tulis(SERVER_DRIVE, "create_file", { ...dasar, contentMimeType: MIME_FOLDER });
    } else {
      throw err;
    }
  }
  const id: string = f.id ?? f.fileId ?? (await cariIdBerkasBaru(badan.name, badan.parents?.[0]));
  catatBaru({ id, title: f.title ?? badan.name, mimeType: MIME_FOLDER, parentId: badan.parents?.[0], viewUrl: f.viewUrl ?? f.webViewLink });
  return teksKeJson({ id, name: f.title ?? badan.name, mimeType: MIME_FOLDER, webViewLink: f.viewUrl ?? f.webViewLink });
}

function bolehDitimpa(nama: string): boolean {
  return NAMA_JSON_KEADAAN.test(nama) || /\.docx$/i.test(nama);
}

// Cap waktu yang diisi ulang aplikasi pada setiap simpan dan tidak dipakai untuk keputusan apa pun.
const KUNCI_WAKTU_BERUBAH = ["terakhirSinkron", "terakhirDiubah"];

function normalisasiJson(teks: string): string | null {
  try {
    const nilai = JSON.parse(teks);
    if (nilai && typeof nilai === "object" && !Array.isArray(nilai)) {
      for (const k of KUNCI_WAKTU_BERUBAH) delete nilai[k];
    }
    return JSON.stringify(nilai);
  } catch {
    return null;
  }
}

async function timpaIsiFile(idDiminta: string, isi: Blob, tipeBadan: string): Promise<Response> {
  const id = idTerkini(idDiminta);
  const meta = await baca(SERVER_DRIVE, "get_file_metadata", { fileId: id, excludeContentSnippets: true });
  const nama: string = meta.title ?? "";
  if (!bolehDitimpa(nama)) {
    throw new GalatHttp(
      403,
      `Konektor Google Drive tidak bisa menimpa isi "${nama}". Yang didukung hanya Aset/Sinkron/Pengaturan/Laporan Kegiatan (.json) dan laporan .docx.`
    );
  }
  const tipe = tipeBadan || meta.mimeType || "application/octet-stream";

  // Lewati bila isinya sama (selain cap waktu di atas), supaya setiap perubahan kecil tidak menumpuk file di Sampah.
  if (/\.json$/i.test(nama)) {
    try {
      const barunya = normalisasiJson(await isi.text());
      const lama = await baca(SERVER_DRIVE, "download_file_content", { fileId: id });
      const lamanya = typeof lama.content === "string" ? normalisasiJson(new TextDecoder().decode(base64KeByte(lama.content))) : null;
      if (barunya !== null && barunya === lamanya) {
        return teksKeJson({ id, name: nama, mimeType: meta.mimeType, webViewLink: meta.viewUrl, dilewati: true });
      }
    } catch (err) {
      if (err instanceof GalatHttp && err.status >= 401 && err.status !== 404) throw err;
      // bila perbandingan gagal, lanjut menulis
    }
  }

  const baru = await buatFile({ name: nama, parents: meta.parentId ? [meta.parentId] : undefined, mimeType: tipe }, isi);
  penggantiId.set(id, baru.id);
  if (idDiminta !== id) penggantiId.set(idDiminta, baru.id);
  try {
    await tulis(SERVER_DRIVE, "trash_file", { fileId: id });
    sudahDiSampah.add(id);
  } catch (err) {
    console.warn(`File lama "${nama}" gagal dipindahkan ke Sampah; versi terbaru tetap dipakai.`, err);
  }
  return teksKeJson(baru);
}

async function salinFile(idAsal: string, badan: { name?: string; parents?: string[] }): Promise<Response> {
  const masukan: Record<string, unknown> = { fileId: idAsal };
  if (badan.name) masukan.title = badan.name;
  if (badan.parents?.[0]) masukan.parentId = badan.parents[0];
  const f = await tulis(SERVER_DRIVE, "copy_file", masukan);
  const nama = String(f.title ?? badan.name ?? "");
  const id: string = f.id ?? f.fileId ?? (await cariIdBerkasBaru(nama, badan.parents?.[0]));
  catatBaru({ id, title: nama, mimeType: f.mimeType ?? "", parentId: badan.parents?.[0], viewUrl: f.viewUrl ?? f.webViewLink });
  return teksKeJson({ id, name: nama, mimeType: f.mimeType, webViewLink: f.viewUrl ?? f.webViewLink });
}

/* ---------- izin berbagi ---------- */

async function izinFile(idDiminta: string): Promise<Response> {
  const r = await baca(SERVER_DRIVE, "get_file_permissions", { fileId: idTerkini(idDiminta) });
  return teksKeJson({ permissions: Array.isArray(r.permissions) ? r.permissions : [] });
}

async function bagikanFile(idDiminta: string, badan: { type?: string; role?: string; emailAddress?: string }): Promise<Response> {
  if (badan.type !== "user" || !badan.emailAddress) {
    throw new GalatHttp(400, "Konektor hanya bisa membagikan kepada akun Google tertentu (alamat email).");
  }
  const role = badan.role === "writer" || badan.role === "commenter" ? badan.role : "reader";
  await tulis(SERVER_DRIVE, "share_file", { fileId: idTerkini(idDiminta), role, emailAddress: badan.emailAddress });
  return teksKeJson({ id: `${badan.emailAddress}:${role}`, type: "user", role, emailAddress: badan.emailAddress });
}

/* ---------- Sheets ---------- */

async function ambilNilai(idSheet: string, rentang: string): Promise<Response> {
  const r = await baca(SERVER_SHEETS, "get_values", { spreadsheetId: idSheet, range: rentang });
  return teksKeJson({ range: r.range ?? rentang, majorDimension: "ROWS", values: Array.isArray(r.values) ? r.values : [] });
}

async function metaSpreadsheet(idSheet: string): Promise<Response> {
  const r = await baca(SERVER_SHEETS, "get_spreadsheet", {
    spreadsheetId: idSheet,
    fields: ["sheets.properties.sheetId", "sheets.properties.title"],
  });
  return teksKeJson({ sheets: Array.isArray(r.sheets) ? r.sheets : [] });
}

/** Tulis nilai; bila banyak baris, dipecah agar tiap panggilan tetap di bawah batas 1 MiB. */
async function tulisNilai(idSheet: string, rentang: string, nilai: unknown[][]): Promise<Response> {
  const m = /^(.*!)?([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/.exec(rentang);
  if (!m || nilai.length <= BARIS_PER_TULIS) {
    await tulis(SERVER_SHEETS, "update_values", { spreadsheetId: idSheet, range: rentang, values: nilai });
    return teksKeJson({ updatedRange: rentang, updatedRows: nilai.length });
  }
  const [, awalan = "", kolomA, barisAwal, kolomB] = m;
  const mulai = Number(barisAwal);
  for (let i = 0; i < nilai.length; i += BARIS_PER_TULIS) {
    const potongan = nilai.slice(i, i + BARIS_PER_TULIS);
    const a = mulai + i;
    const b = a + potongan.length - 1;
    await tulis(SERVER_SHEETS, "update_values", {
      spreadsheetId: idSheet,
      range: `${awalan}${kolomA}${a}:${kolomB}${b}`,
      values: potongan,
    });
  }
  return teksKeJson({ updatedRange: rentang, updatedRows: nilai.length });
}

async function kosongkan(idSheet: string, rentang: string): Promise<Response> {
  await tulis(SERVER_SHEETS, "batch_clear_values", { spreadsheetId: idSheet, ranges: [rentang] });
  return teksKeJson({ spreadsheetId: idSheet, clearedRange: rentang });
}

/* ---------- penghubung fetch ---------- */

async function bacaBadan(input: RequestInfo | URL, init?: RequestInit): Promise<BodyInit | null | undefined> {
  if (init && "body" in init) return init.body;
  if (typeof Request !== "undefined" && input instanceof Request) return input.clone().blob();
  return undefined;
}

async function badanKeBlob(badan: BodyInit | null | undefined, tipe: string): Promise<Blob> {
  if (badan == null) return new Blob([], { type: tipe });
  if (badan instanceof Blob) return badan;
  if (typeof badan === "string") return new Blob([badan], { type: tipe });
  return new Response(badan).blob();
}

function tipeKonten(init?: RequestInit): string {
  const h = init?.headers;
  if (!h) return "";
  if (h instanceof Headers) return h.get("Content-Type") ?? "";
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  const rec = h as Record<string, string>;
  const kunci = Object.keys(rec).find((k) => k.toLowerCase() === "content-type");
  return kunci ? rec[kunci] : "";
}

async function tangani(url: URL, metode: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = url.pathname;
  let m: RegExpExecArray | null;

  if (url.hostname === "sheets.googleapis.com") {
    if ((m = /^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/.exec(path))) {
      const idSheet = decodeURIComponent(m[1]);
      const mentah = m[2];
      if (metode === "POST" && mentah.endsWith(":clear")) {
        return kosongkan(idSheet, decodeURIComponent(mentah.slice(0, -":clear".length)));
      }
      const rentang = decodeURIComponent(mentah);
      if (metode === "GET") return ambilNilai(idSheet, rentang);
      if (metode === "PUT") {
        const badan = JSON.parse(String(await bacaBadan(input, init)));
        return tulisNilai(idSheet, rentang, badan.values ?? []);
      }
    }
    if (metode === "GET" && (m = /^\/v4\/spreadsheets\/([^/]+)$/.exec(path))) {
      return metaSpreadsheet(decodeURIComponent(m[1]));
    }
    if (metode === "POST" && path === "/v4/spreadsheets") {
      throw new GalatHttp(
        501,
        "Konektor Google Sheets tidak bisa membuat spreadsheet baru. Buat file 'Keuangan Pribadi <tahun>' dan 'Keuangan Kegiatan <tahun>' di folder Keuangan (misalnya salin dari tahun lalu), lalu sinkronkan lagi."
      );
    }
  }

  if (url.hostname === "www.googleapis.com") {
    if (metode === "GET" && path === "/drive/v3/files") return daftarFile(url);

    if ((m = /^\/drive\/v3\/files\/([^/]+)\/permissions$/.exec(path))) {
      const id = decodeURIComponent(m[1]);
      if (metode === "GET") return izinFile(id);
      if (metode === "POST") return bagikanFile(id, JSON.parse(String((await bacaBadan(input, init)) ?? "{}")));
    }
    if (/^\/drive\/v3\/files\/[^/]+\/permissions\/[^/]+$/.test(path) && metode === "DELETE") {
      throw new GalatHttp(501, "Konektor Google Drive tidak bisa mencabut izin. Cabut lewat menu Bagikan di Google Drive.");
    }
    if ((m = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(path)) && metode === "POST") {
      const badan = JSON.parse(String(await bacaBadan(input, init) ?? "{}"));
      return salinFile(decodeURIComponent(m[1]), badan);
    }
    if ((m = /^\/drive\/v3\/files\/([^/]+)$/.exec(path)) && metode === "GET") {
      const id = decodeURIComponent(m[1]);
      return url.searchParams.get("alt") === "media" ? unduhFile(id) : metadataFile(id);
    }
    if (metode === "POST" && path === "/drive/v3/files") {
      const badan = JSON.parse(String(await bacaBadan(input, init) ?? "{}"));
      if (badan.mimeType === MIME_FOLDER) return buatFolder(badan);
      throw new GalatHttp(400, "Konektor hanya mendukung pembuatan folder lewat jalur ini.");
    }
    if (metode === "POST" && path === "/upload/drive/v3/files" && url.searchParams.get("uploadType") === "multipart") {
      const badan = await bacaBadan(input, init);
      if (!(badan instanceof FormData)) throw new GalatHttp(400, "Unggahan multipart tidak dikenali.");
      const meta = JSON.parse(await (badan.get("metadata") as Blob).text());
      const berkas = badan.get("file") as Blob;
      return teksKeJson(await buatFile(meta, berkas));
    }
    if ((m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path)) && metode === "PATCH" && url.searchParams.get("uploadType") === "media") {
      const tipe = tipeKonten(init);
      const isi = await badanKeBlob(await bacaBadan(input, init), tipe);
      return timpaIsiFile(decodeURIComponent(m[1]), isi, tipe);
    }
  }

  throw new GalatHttp(501, `Permintaan ${metode} ${url.hostname}${path} belum didukung di mode konektor.`);
}

let terpasang = false;

/** Pasang penerjemah di window.fetch; permintaan ke host lain lewat tanpa diubah. */
export function pasangKonektor(): void {
  if (terpasang) return;
  terpasang = true;
  const asli = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    } catch {
      return asli(input, init);
    }
    if (url.hostname !== "www.googleapis.com" && url.hostname !== "sheets.googleapis.com") {
      return asli(input, init);
    }
    const metode = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    try {
      return await tangani(url, metode, input, init);
    } catch (err) {
      const g = dariGalatMcp(err);
      return teksGalat(g.status, g.message);
    }
  };
}
