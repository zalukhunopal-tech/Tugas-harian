/**
 * Uji "pasang ulang tidak menggandakan atau menimpa data di folder Keuangan" (src/lib/gdriveSync.ts), memakai Google Drive
 * dan Sheets palsu di memori yang menjawab fetch. Jalankan: npx tsx scripts/uji_pasang_ulang.ts
 *
 * Pasang ulang = penyimpanan lokal kosong (localStorage hilang) sedangkan Drive masih berisi data lama.
 */
import {
  GalatBelumTarik,
  dapatkanFolderBuktiTarget,
  idStabilBaris,
  kirimSemuaKeDrive,
  resetStatusTarik,
  sudahTarikLengkap,
  tarikSemuaDariDrive,
} from "../src/lib/gdriveSync";
import type { DataHarga } from "../src/lib/aset";
import type { Transaksi } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

/* ---------- localStorage palsu (penyimpanan lokal yang bisa "dihapus" saat pasang ulang) ---------- */
const penyimpanan = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (penyimpanan.has(k) ? penyimpanan.get(k)! : null),
  setItem: (k: string, v: string) => void penyimpanan.set(k, String(v)),
  removeItem: (k: string) => void penyimpanan.delete(k),
  clear: () => penyimpanan.clear(),
};
const pasangUlang = () => {
  penyimpanan.clear();
  resetStatusTarik();
};

/* ---------- Google Drive + Sheets palsu ---------- */
const FOLDER = "application/vnd.google-apps.folder";
const SHEET = "application/vnd.google-apps.spreadsheet";
interface Berkas {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  isi?: string; // berkas JSON
  tab?: string; // spreadsheet
  baris?: Array<Array<string | number>>; // spreadsheet: baris[r][k], 0-based dari A1
}
const files = new Map<string, Berkas>();
const log: Array<{ metode: string; url: string }> = [];
let urut = 1;
let galatCari = false; // files.list menjawab 503
const galatBacaSheet = new Set<string>(); // id spreadsheet yang pembacaan nilainya 500

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
const info = (f: Berkas) => ({ id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: `https://drive.google.com/${f.id}`, ownedByMe: true });

function tambah(f: Partial<Berkas> & { name: string; mimeType: string }): Berkas {
  const b: Berkas = { id: f.id ?? "id" + urut++, parents: ["root"], ...f };
  files.set(b.id, b);
  return b;
}

function cocokKlausa(f: Berkas, k: string): boolean {
  let m: RegExpExecArray | null;
  if ((m = /^name\s*=\s*'(.*)'$/.exec(k))) return f.name === m[1];
  if ((m = /^name contains '(.*)'$/.exec(k))) return f.name.toLowerCase().includes(m[1].toLowerCase());
  if ((m = /^'(.*)' in parents$/.exec(k))) return f.parents.includes(m[1]);
  if ((m = /^mimeType\s*=\s*'(.*)'$/.exec(k))) return f.mimeType === m[1];
  if (/^trashed\s*=\s*false$/.test(k)) return true;
  throw new Error("Klausa tidak dikenal: " + k);
}

const kolomKe = (h: string) => [...h].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
function urai(rentang: string) {
  const m = /^'?(.+?)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/.exec(rentang);
  if (!m) throw new Error("Rentang tidak valid: " + rentang);
  return { k1: kolomKe(m[2]), b1: Number(m[3]), k2: m[4] ? kolomKe(m[4]) : kolomKe(m[2]), b2: m[5] ? Number(m[5]) : Infinity };
}

const fetchPalsu = async (input: any, init: any = {}): Promise<Response> => {
  const url = new URL(String(input));
  const metode = String(init.method || "GET").toUpperCase();
  log.push({ metode, url: url.pathname + url.search });
  const p = decodeURIComponent(url.pathname);

  if (url.hostname === "www.googleapis.com") {
    if (p === "/drive/v3/files" && metode === "GET") {
      if (galatCari) return json({ error: { message: "Layanan sibuk" } }, 503);
      const klausa = (url.searchParams.get("q") || "").split(/ and /);
      return json({ files: [...files.values()].filter((f) => klausa.every((k) => cocokKlausa(f, k.trim()))).map(info) });
    }
    if (p === "/drive/v3/files" && metode === "POST") {
      const body = JSON.parse(init.body);
      return json(info(tambah({ name: body.name, mimeType: body.mimeType, parents: body.parents || ["root"] })));
    }
    let m = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(p);
    if (m && metode === "POST") {
      const asal = files.get(m[1]);
      if (!asal) return json({}, 404);
      const body = JSON.parse(init.body);
      const baru = tambah({ name: body.name, mimeType: asal.mimeType, parents: body.parents || asal.parents, tab: asal.tab, baris: asal.baris?.map((r) => [...r]) });
      return json(info(baru));
    }
    m = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (m && metode === "GET") {
      const f = files.get(m[1]);
      if (!f) return json({}, 404);
      if (url.searchParams.get("alt") === "media") return new Response(f.isi ?? "", { status: 200 });
      return json(info(f));
    }
    if (m && metode === "PATCH") {
      const f = files.get(m[1]);
      if (!f) return json({}, 404);
      const tambahan = url.searchParams.get("addParents");
      if (tambahan) f.parents = [tambahan];
      return json(info(f));
    }
  }

  if (url.hostname === "www.googleapis.com" && p.startsWith("/upload/drive/v3/files")) {
    // ditangani di bawah
  }
  if (p.startsWith("/upload/drive/v3/files")) {
    const m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (m && metode === "PATCH") {
      const f = files.get(m[1]);
      if (!f) return json({}, 404);
      f.isi = typeof init.body === "string" ? init.body : await (init.body as Blob).text();
      return json(info(f));
    }
    if (p === "/upload/drive/v3/files" && metode === "POST") {
      const form = init.body as FormData;
      const meta = JSON.parse(await (form.get("metadata") as Blob).text());
      const isi = await (form.get("file") as Blob).text();
      return json(info(tambah({ name: meta.name, mimeType: meta.mimeType || "application/octet-stream", parents: meta.parents || ["root"], isi })));
    }
  }

  if (url.hostname === "sheets.googleapis.com") {
    if (p === "/v4/spreadsheets" && metode === "POST") {
      const body = JSON.parse(init.body);
      const tab = body.sheets?.[0]?.properties?.title || "Sheet1";
      const f = tambah({ name: body.properties.title, mimeType: SHEET, tab, baris: [] });
      return json({ spreadsheetId: f.id, sheets: [{ properties: { title: tab } }] });
    }
    let m = /^\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(:clear)?$/.exec(p);
    if (m) {
      const f = files.get(m[1]);
      if (!f || !f.baris) return json({}, 404);
      const r = urai(m[2]);
      if (metode === "GET") {
        if (galatBacaSheet.has(f.id)) return json({ error: { message: "galat sementara" } }, 500);
        const nilai: Array<Array<string | number>> = [];
        for (let b = r.b1; b <= Math.min(r.b2, f.baris.length); b++) {
          const baris = (f.baris[b - 1] || []).slice(r.k1 - 1, r.k2);
          while (baris.length && (baris[baris.length - 1] === "" || baris[baris.length - 1] === undefined)) baris.pop();
          nilai.push(baris);
        }
        while (nilai.length && nilai[nilai.length - 1].length === 0) nilai.pop();
        return json({ values: nilai });
      }
      if (metode === "PUT") {
        const body = JSON.parse(init.body);
        body.values.forEach((baris: Array<string | number>, dy: number) => {
          const y = r.b1 - 1 + dy;
          f.baris![y] = f.baris![y] || [];
          baris.forEach((v, dx) => (f.baris![y][r.k1 - 1 + dx] = v));
        });
        return json({ updatedRows: body.values.length });
      }
      if (metode === "POST" && m[3]) {
        for (let b = r.b1; b <= Math.min(r.b2, f.baris.length); b++) {
          for (let k = r.k1; k <= (Number.isFinite(r.k2) ? r.k2 : 12); k++) if (f.baris[b - 1]) f.baris[b - 1][k - 1] = "";
        }
        return json({});
      }
    }
    m = /^\/v4\/spreadsheets\/([^/]+)$/.exec(p);
    if (m && metode === "GET") {
      const f = files.get(m[1]);
      if (!f) return json({}, 404);
      return json({ sheets: [{ properties: { title: f.tab || "Sheet1", sheetId: 1 } }] });
    }
  }
  throw new Error(`Permintaan tidak dikenal: ${metode} ${url.href}`);
};
(globalThis as any).fetch = fetchPalsu;

/* ---------- data uji ---------- */
const HEADER = ["No", "Tanggal", "Uraian", "Kategori", "Pemasukan", "Pengeluaran", "Saldo", "Sumber / Tujuan", "Catatan", "ID Aplikasi", "Metode Bayar", "Bukti"];
// Baris: A No, B Tanggal, C Uraian, D Kategori, E Masuk, F Keluar, G Saldo, H Kaitan, I Catatan, J ID, K Metode, L Bukti
const baris = (tgl: string, uraian: string, kat: string, masuk: number | "", keluar: number | "", id: string): Array<string | number> => [
  "", tgl, uraian, kat, masuk, keluar, "", "", "", id, "Tunai", "",
];

function isiDrive() {
  files.clear();
  log.length = 0;
  urut = 1;
  galatCari = false;
  galatBacaSheet.clear();
  const f = tambah({ id: "F", name: "Keuangan", mimeType: FOLDER });
  tambah({
    id: "SP",
    name: "Keuangan Pribadi 2026",
    mimeType: SHEET,
    parents: [f.id],
    tab: "Keuangan Pribadi",
    baris: [[], [], [], [], [], HEADER, baris("2026-10-02", "Beli beras", "Makan & Minum", "", 150000, "p1"), baris("2026-10-03", "Uang saku", "Gaji", 1000000, "", "p2"), baris("2026-10-04", "Diketik langsung di sheet", "Lain-lain", "", 25000, "")],
  });
  tambah({
    id: "SK",
    name: "Keuangan Kegiatan 2026",
    mimeType: SHEET,
    parents: [f.id],
    tab: "Keuangan Kegiatan",
    baris: [[], [], [], [], [], HEADER, baris("2026-10-05", "Dana awal", "Penerimaan Dana", 5000000, "", "k1")],
  });
  tambah({ id: "AS", name: "Aset.json", mimeType: "application/json", parents: [f.id], isi: JSON.stringify([{ id: "a1", jenis: "emas", nama: "Emas Antam", jumlah: 5 }]) });
  tambah({ id: "SN", name: "Sinkron.json", mimeType: "application/json", parents: [f.id], isi: JSON.stringify({ terhapus: ["sudah-dihapus"], diubah: {}, terakhirSinkron: "2026-10-01T00:00:00.000Z" }) });
  tambah({ id: "LK", name: "Laporan Kegiatan.json", mimeType: "application/json", parents: [f.id], isi: JSON.stringify({ daftarKegiatan: [], laporan: {} }) });
}

const TOKEN = "token-uji";
const HARGA = {} as unknown as DataHarga;
const tulis = () => log.filter((l) => l.metode !== "GET");
const jumlahFile = () => files.size;
const nama = (n: string) => [...files.values()].filter((f) => f.name === n);
const ringkasSheet = (id: string) =>
  (files.get(id)!.baris || [])
    .slice(6)
    .filter((r) => r && r.slice(1).some((v) => v !== "" && v !== undefined))
    .map((r) => [r[1], r[2], r[4], r[5]].join("|"))
    .sort();
const kunciTrx = (t: Transaksi[]) => t.map((x) => [x.tanggal, x.deskripsi, x.jenis, x.jumlah].join("|")).sort();

async function main() {
  console.log("ID stabil untuk baris tanpa ID");
  cek("isi sama -> ID sama", idStabilBaris(["Dana Pribadi", "2026-10-04", "Kopi", "Makan", 0, 25000]) === idStabilBaris(["Dana Pribadi", "2026-10-04", "Kopi", "Makan", 0, 25000]));
  cek("isi beda -> ID beda", idStabilBaris(["a", 1]) !== idStabilBaris(["a", 2]));
  cek("urutan membedakan baris kembar", idStabilBaris(["a"], 0) !== idStabilBaris(["a"], 1));

  console.log("Pasang ulang: Drive berisi data, penyimpanan lokal kosong");
  isiDrive();
  pasangUlang();
  const awalFile = jumlahFile();
  const sebelumSheetP = ringkasSheet("SP");

  let ditolak = false;
  try {
    await kirimSemuaKeDrive(TOKEN, [], [], undefined, { daftarKegiatan: [], laporan: {} } as any);
  } catch (err) {
    ditolak = err instanceof GalatBelumTarik;
  }
  cek("kirim sebelum tarik ditolak (data lokal kosong tidak boleh menimpa Drive)", ditolak && tulis().length === 0, tulis());
  cek("isi spreadsheet Drive tidak berubah", JSON.stringify(ringkasSheet("SP")) === JSON.stringify(sebelumSheetP));

  const t1 = await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("tarik pertama: 4 transaksi dari Drive (sheet pribadi 3 + kegiatan 1), ID terhapus dihormati", t1.transaksi.length === 4, kunciTrx(t1.transaksi));
  cek("penjaga terbuka setelah tarik lengkap", sudahTarikLengkap());
  cek("tarik hanya membaca", tulis().length === 0, tulis());

  const t2 = await tarikSemuaDariDrive(TOKEN, t1.transaksi, t1.aset, HARGA);
  cek("tarik kedua tanpa kirim: tetap 4 (baris tanpa ID tidak berganda)", t2.transaksi.length === 4, kunciTrx(t2.transaksi));
  cek("ID baris tanpa ID sama antar tarik", JSON.stringify(t1.transaksi.map((x) => x.id).sort()) === JSON.stringify(t2.transaksi.map((x) => x.id).sort()));

  await kirimSemuaKeDrive(TOKEN, t2.transaksi, t2.aset, undefined, { daftarKegiatan: [], laporan: {} } as any);
  cek("kirim: tidak ada folder atau berkas baru", jumlahFile() === awalFile, [...files.values()].map((f) => f.name));
  cek("kirim: isi sheet Pribadi sama (3 baris, tanpa ganda)", JSON.stringify(ringkasSheet("SP")) === JSON.stringify(sebelumSheetP), ringkasSheet("SP"));
  cek("baris yang tadinya tanpa ID kini punya ID di kolom J", (files.get("SP")!.baris || []).slice(6).every((r) => r && String(r[9] || "").length > 0));
  cek("Aset.json, Sinkron.json, Laporan Kegiatan.json tetap satu", nama("Aset.json").length === 1 && nama("Sinkron.json").length === 1 && nama("Laporan Kegiatan.json").length === 1);

  console.log("Pasang ulang berkali-kali");
  for (let i = 1; i <= 3; i++) {
    pasangUlang();
    const lokal = await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
    await kirimSemuaKeDrive(TOKEN, lokal.transaksi, lokal.aset, undefined, { daftarKegiatan: [], laporan: {} } as any);
    cek(`pasang ulang ke-${i}: 4 transaksi, tidak ada berkas baru, sheet sama`, lokal.transaksi.length === 4 && jumlahFile() === awalFile && JSON.stringify(ringkasSheet("SP")) === JSON.stringify(sebelumSheetP), { n: lokal.transaksi.length, file: jumlahFile() });
  }

  console.log("Gangguan saat tarik tidak membuka penjaga dan tidak menulis");
  isiDrive();
  pasangUlang();
  galatCari = true;
  let melempar = false;
  try {
    await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  } catch {
    melempar = true;
  }
  galatCari = false;
  cek("pencarian gagal: tarik melempar galat, penjaga tetap tertutup", melempar && !sudahTarikLengkap());
  let ditolak2 = false;
  try {
    await kirimSemuaKeDrive(TOKEN, [], [], undefined, { daftarKegiatan: [], laporan: {} } as any);
  } catch (err) {
    ditolak2 = err instanceof GalatBelumTarik;
  }
  cek("kirim sesudahnya tetap ditolak, Drive tak tersentuh", ditolak2 && tulis().length === 0);

  console.log("Satu spreadsheet gagal dibaca: tarik tidak lengkap");
  isiDrive();
  pasangUlang();
  galatBacaSheet.add("SP");
  const sebagian = await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("tarik selesai tetapi penjaga tertutup", !sudahTarikLengkap() && sebagian.transaksi.length === 1, sebagian.transaksi.length);
  let ditolak3 = false;
  try {
    await kirimSemuaKeDrive(TOKEN, sebagian.transaksi, sebagian.aset, undefined, { daftarKegiatan: [], laporan: {} } as any);
  } catch (err) {
    ditolak3 = err instanceof GalatBelumTarik;
  }
  cek("kirim ditolak: sheet Pribadi tidak dikosongkan", ditolak3 && ringkasSheet("SP").length === 3, ringkasSheet("SP"));
  galatBacaSheet.clear();
  const penuh = await tarikSemuaDariDrive(TOKEN, sebagian.transaksi, sebagian.aset, HARGA);
  cek("setelah gangguan hilang, tarik lengkap dan transaksi utuh", sudahTarikLengkap() && penuh.transaksi.length === 4);

  console.log("Gangguan pencarian saat kirim tidak membuat folder Keuangan kedua");
  isiDrive();
  pasangUlang();
  const ok = await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  log.length = 0;
  galatCari = true;
  let gagalKirim = false;
  try {
    await kirimSemuaKeDrive(TOKEN, ok.transaksi, ok.aset, undefined, { daftarKegiatan: [], laporan: {} } as any);
  } catch {
    gagalKirim = true;
  }
  galatCari = false;
  cek("kirim gagal dengan galat, tidak ada berkas dibuat", gagalKirim && nama("Keuangan").length === 1 && jumlahFile() === 6, [...files.values()].map((f) => f.name));
  log.length = 0;
  galatCari = true;
  let gagalSub = false;
  try {
    await dapatkanFolderBuktiTarget(TOKEN, "F", "Dana Pribadi");
  } catch {
    gagalSub = true;
  }
  galatCari = false;
  cek("pencarian subfolder gagal: tidak membuat 'Bukti Transaksi' kembar", gagalSub && nama("Bukti Transaksi").length === 0 && tulis().length === 0, tulis());
  await dapatkanFolderBuktiTarget(TOKEN, "F", "Dana Pribadi");
  await dapatkanFolderBuktiTarget(TOKEN, "F", "Dana Pribadi");
  cek("subfolder dibuat sekali walau dipanggil berulang", nama("Bukti Transaksi").length === 1 && nama("Pribadi").length === 1);

  console.log("Pengguna baru: Drive kosong");
  files.clear();
  log.length = 0;
  pasangUlang();
  let tidakAda = "";
  try {
    await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  } catch (err: any) {
    tidakAda = err.message;
  }
  cek("tarik: folder tidak ada, tetapi penjaga terbuka (tidak ada isi yang bisa tertimpa)", /tidak ditemukan/.test(tidakAda) && sudahTarikLengkap(), tidakAda);
  const trxBaru: Transaksi[] = [{ id: "n1", jenis: "pengeluaran", dana: "Dana Pribadi", tanggal: "2026-10-06", deskripsi: "Kopi", kategori: "Makan & Minum", jumlah: 20000, metode: "Tunai", kaitan: "", catatan: "" } as Transaksi];
  await kirimSemuaKeDrive(TOKEN, trxBaru, [], undefined, { daftarKegiatan: [], laporan: {} } as any);
  cek("kirim membuat satu folder Keuangan dan spreadsheet tahun 2026", nama("Keuangan").length === 1 && nama("Keuangan Pribadi 2026").length === 1, [...files.values()].map((f) => f.name));
  const n = jumlahFile();
  await kirimSemuaKeDrive(TOKEN, trxBaru, [], undefined, { daftarKegiatan: [], laporan: {} } as any);
  cek("kirim lagi: tidak ada berkas baru", jumlahFile() === n, [...files.values()].map((f) => f.name));

  if (gagal) {
    console.log(`\n${gagal} uji gagal`);
    process.exit(1);
  }
  console.log("\nSemua uji lolos");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
