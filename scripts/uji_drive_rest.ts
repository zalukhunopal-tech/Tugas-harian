/**
 * Uji jalur REST Google Drive untuk berbagi keluarga dan penyiapan folder Keuangan (src/lib/berbagiDrive.ts, setupDrive.ts),
 * dengan Drive/Sheets palsu di memori yang menjawab fetch. Jalankan: npx tsx scripts/uji_drive_rest.ts
 *
 * Jalur REST dipakai aplikasi yang dipasang (PWA) dan GitHub Pages; di sini ID izin tersedia, jadi pencabutan bisa dicoba.
 */
import { cariFolderKeuangan } from "../src/lib/gdriveSync";
import { siapkanFolderKeuangan, periksaKeberadaanFolder, ringkasSetup } from "../src/lib/setupDrive";
import {
  batasiTautanPublik,
  bacaDataDibagikan,
  daftarDibagikanKeSaya,
  muatBerkasKeuangan,
  terapkanRencana,
} from "../src/lib/berbagiDrive";
import { akunPemilikDariIzin, kelompokkanDibagikan, rencanaBerbagi, ringkasAnggota, berkasTautanPublik } from "../src/lib/berbagi";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const FOLDER = "application/vnd.google-apps.folder";
const SHEET = "application/vnd.google-apps.spreadsheet";
const ID_BAWAAN = "1zRqAgxStMdx3Ksm_K1R8R_pec_pMg6qf";

interface BerkasPalsu {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  trashed?: boolean;
  ownedByMe?: boolean;
  dibagikan?: boolean; // milik orang lain, dibagikan kepada saya
  pemilik?: string;
}
interface IzinPalsu {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
  displayName?: string;
}

const files = new Map<string, BerkasPalsu>();
const izin = new Map<string, IzinPalsu[]>();
const nilai = new Map<string, unknown[][]>();
const log: Array<{ metode: string; url: string; body?: any }> = [];
let urut = 1;
let galatPencarian = false;

function reset() {
  files.clear();
  izin.clear();
  nilai.clear();
  log.length = 0;
  urut = 1;
  galatPencarian = false;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function cocokKlausa(f: BerkasPalsu, k: string): boolean {
  let m: RegExpExecArray | null;
  if ((m = /^name\s*=\s*'(.*)'$/.exec(k))) return f.name === m[1];
  if ((m = /^name contains '(.*)'$/.exec(k))) return f.name.toLowerCase().includes(m[1].toLowerCase());
  if ((m = /^'(.*)' in parents$/.exec(k))) return f.parents.includes(m[1]);
  if ((m = /^mimeType\s*=\s*'(.*)'$/.exec(k))) return f.mimeType === m[1];
  if (/^trashed\s*=\s*false$/.test(k)) return !f.trashed;
  if (/^sharedWithMe\s*=\s*true$/.test(k)) return Boolean(f.dibagikan);
  throw new Error("Klausa pencarian tidak dikenal: " + k);
}

const info = (f: BerkasPalsu) => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  webViewLink: `https://drive.google.com/${f.id}`,
  ownedByMe: f.ownedByMe !== false,
  owners: f.pemilik ? [{ emailAddress: f.pemilik, displayName: f.pemilik.split("@")[0] }] : undefined,
});

function tambah(f: Partial<BerkasPalsu> & { name: string; mimeType: string }): BerkasPalsu {
  const berkas: BerkasPalsu = { id: f.id ?? "id" + urut++, parents: [], ...f };
  files.set(berkas.id, berkas);
  return berkas;
}

const fetchPalsu = async (input: any, init: any = {}): Promise<Response> => {
  const url = new URL(String(input));
  const metode = String(init.method || "GET").toUpperCase();
  const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  log.push({ metode, url: url.pathname + url.search, body });

  if (url.hostname === "www.googleapis.com") {
    const p = url.pathname;
    if (p === "/drive/v3/files" && metode === "GET") {
      if (galatPencarian) return json({ error: { message: "Layanan sibuk" } }, 503);
      const klausa = (url.searchParams.get("q") || "").split(/ and /);
      const hasil = [...files.values()].filter((f) => klausa.every((k) => cocokKlausa(f, k.trim())));
      return json({ files: hasil.map(info) });
    }
    if (p === "/drive/v3/files" && metode === "POST") {
      const f = tambah({ name: body.name, mimeType: body.mimeType, parents: body.parents || ["root"] });
      return json(info(f));
    }
    let m = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(p);
    if (m && metode === "POST") {
      const asal = files.get(m[1]);
      if (!asal) return json({ error: { message: "tidak ada" } }, 404);
      const f = tambah({ name: body.name, mimeType: asal.mimeType, parents: body.parents || asal.parents });
      return json(info(f));
    }
    m = /^\/drive\/v3\/files\/([^/]+)\/permissions\/([^/]+)$/.exec(p);
    if (m && metode === "DELETE") {
      const daftar = izin.get(m[1]) || [];
      const baru = daftar.filter((x) => x.id !== m![2]);
      if (baru.length === daftar.length) return json({ error: { message: "izin tidak ada" } }, 404);
      izin.set(m[1], baru);
      return new Response(null, { status: 204 });
    }
    m = /^\/drive\/v3\/files\/([^/]+)\/permissions$/.exec(p);
    if (m && metode === "GET") {
      if (!files.has(m[1])) return json({ error: { message: "tidak ada" } }, 404);
      return json({ permissions: izin.get(m[1]) || [] });
    }
    if (m && metode === "POST") {
      if (!files.has(m[1])) return json({ error: { message: "tidak ada" } }, 404);
      const baru: IzinPalsu = { id: "perm" + urut++, type: body.type, role: body.role, emailAddress: body.emailAddress, displayName: body.emailAddress?.split("@")[0] };
      izin.set(m[1], [...(izin.get(m[1]) || []), baru]);
      return json(baru);
    }
    m = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (m && metode === "GET") {
      const f = files.get(m[1]);
      return f ? json(info(f)) : json({ error: { message: "tidak ada" } }, 404);
    }
    if (m && metode === "PATCH") {
      const f = files.get(m[1]);
      if (!f) return json({ error: { message: "tidak ada" } }, 404);
      const tambahan = url.searchParams.get("addParents");
      if (tambahan) f.parents = [tambahan];
      return json(info(f));
    }
  }

  if (url.hostname === "sheets.googleapis.com") {
    const p = decodeURIComponent(url.pathname);
    if (p === "/v4/spreadsheets" && metode === "POST") {
      const f = tambah({ name: body.properties.title, mimeType: SHEET, parents: ["root"] });
      return json({ spreadsheetId: f.id, sheets: body.sheets });
    }
    let m = /^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/.exec(p);
    if (m && metode === "GET") {
      return json({ values: nilai.get(m[1]) ?? [] });
    }
    if (m && metode === "PUT") {
      const lama = nilai.get(m[1]) ?? [];
      nilai.set(m[1], [...lama, ...body.values]);
      return json({ updatedRows: body.values.length });
    }
    m = /^\/v4\/spreadsheets\/([^/]+)$/.exec(p);
    if (m && metode === "GET") {
      return json({ sheets: [{ properties: { title: "Keuangan", sheetId: 1 } }] });
    }
    if (/:clear$|:batchUpdate$|:batchClear$/.test(p)) return json({});
  }
  throw new Error(`Permintaan tidak dikenal: ${metode} ${url.href}`);
};
(globalThis as any).fetch = fetchPalsu;

const TOKEN = "token-uji";
const tulis = () => log.filter((l) => l.metode !== "GET");
const buatFolder = () => log.filter((l) => l.metode === "POST" && l.url === "/drive/v3/files");

async function main() {
  console.log("Folder bawaan milik orang lain tidak dianggap folder Keuangan saya");
  reset();
  tambah({ id: ID_BAWAAN, name: "Keuangan", mimeType: FOLDER, ownedByMe: false, pemilik: "penulis@example.org" });
  files.get(ID_BAWAAN)!.parents = ["x"];
  // Pencarian nama (langkah 1-2) sengaja tidak menemukannya agar langkah ID bawaan yang diuji: sembunyikan dari pencarian.
  const asalFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (u: any, i: any) => {
    const url = new URL(String(u));
    if (url.pathname === "/drive/v3/files" && !url.searchParams.get("q")?.includes("in parents") && (i?.method || "GET") === "GET") return json({ files: [] });
    return asalFetch(u, i);
  };
  cek("folder bawaan yang bukan milik saya diabaikan", (await cariFolderKeuangan(TOKEN)) === null);
  files.get(ID_BAWAAN)!.ownedByMe = true;
  cek("folder bawaan milik saya (pemilik aplikasi) tetap ditemukan", (await cariFolderKeuangan(TOKEN))?.id === ID_BAWAAN);
  (globalThis as any).fetch = asalFetch;

  console.log("Penyiapan folder Keuangan untuk pengguna baru (Drive kosong)");
  reset();
  const hasil = await siapkanFolderKeuangan(TOKEN, 2026);
  cek("folder Keuangan dibuat", hasil.folderBaru && files.get(hasil.folder.id)?.name === "Keuangan", hasil.dibuat);
  const nama = (n: string) => [...files.values()].filter((f) => f.name === n && !f.trashed);
  cek("Bukti Transaksi/Pribadi, Bukti Transaksi/Kegiatan, Laporan Kegiatan dibuat tepat sekali",
    nama("Bukti Transaksi").length === 1 && nama("Pribadi").length === 1 && nama("Kegiatan").length === 1 && nama("Laporan Kegiatan").length === 1);
  cek("Pribadi dan Kegiatan berada di dalam Bukti Transaksi", nama("Pribadi")[0].parents[0] === nama("Bukti Transaksi")[0].id && nama("Kegiatan")[0].parents[0] === nama("Bukti Transaksi")[0].id);
  cek("Keuangan Pribadi 2026 dan Keuangan Kegiatan 2026 dibuat di dalam folder Keuangan",
    ["Keuangan Pribadi 2026", "Keuangan Kegiatan 2026"].every((n) => nama(n).length === 1 && nama(n)[0].parents.includes(hasil.folder.id)), [...files.values()].map((f) => f.name));
  cek("kedua spreadsheet dibuat baru lewat Sheets API (bukan saling menyalin)",
    log.filter((l) => l.metode === "POST" && l.url === "/v4/spreadsheets").length === 2 && !log.some((l) => /\/copy/.test(l.url)),
    log.filter((l) => l.metode === "POST").map((l) => l.url));
  const sk = nama("Keuangan Kegiatan 2026")[0];
  cek("judul kolom Kegiatan memuat 'Kaitan Kegiatan', Pribadi memuat 'Sumber / Tujuan'",
    (nilai.get(sk.id) || []).some((r) => r.includes("Kaitan Kegiatan")) && (nilai.get(nama("Keuangan Pribadi 2026")[0].id) || []).some((r) => r.includes("Sumber / Tujuan")));
  const sp = nama("Keuangan Pribadi 2026")[0];
  cek("baris judul kolom ditulis ke A6:L6", (nilai.get(sp.id) || []).some((r) => r.includes("Uraian") && r.includes("Pemasukan")));
  cek("tidak ada kegagalan dan ringkasan menyebut dibuat otomatis", hasil.gagal.length === 0 && /dibuat otomatis/.test(ringkasSetup(hasil)), ringkasSetup(hasil));
  const jumlahFile = files.size;
  const ulang = await siapkanFolderKeuangan(TOKEN, 2026);
  cek("dijalankan lagi: tidak membuat apa pun", files.size === jumlahFile && !ulang.folderBaru && ulang.dibuat.length === 0, ulang.dibuat);
  cek("dijalankan lagi: ringkasan 'sudah lengkap'", /sudah lengkap/.test(ringkasSetup(ulang)), ringkasSetup(ulang));

  console.log("Dua penyiapan bersamaan berbagi satu proses");
  reset();
  const [h1, h2] = await Promise.all([siapkanFolderKeuangan(TOKEN, 2026), siapkanFolderKeuangan(TOKEN, 2026)]);
  cek("hanya satu folder Keuangan", nama("Keuangan").length === 1 && h1.folder.id === h2.folder.id);

  console.log("Gangguan pencarian tidak membuat folder");
  reset();
  galatPencarian = true;
  const ket = await periksaKeberadaanFolder(TOKEN);
  cek("galat dibedakan dari 'tidak ada'", ket.status === "galat", ket);
  let melempar = false;
  try {
    await siapkanFolderKeuangan(TOKEN, 2026);
  } catch {
    melempar = true;
  }
  cek("penyiapan berhenti dengan galat dan tidak menulis apa pun", melempar && tulis().length === 0, tulis());
  galatPencarian = false;

  console.log("Folder yang sudah ada dipakai, hanya yang kurang dilengkapi");
  reset();
  const fk = tambah({ name: "Keuangan", mimeType: FOLDER, ownedByMe: true, parents: ["root"] });
  const lama = tambah({ name: "Keuangan Pribadi 2025", mimeType: SHEET, parents: [fk.id] });
  nilai.set(lama.id, [["No", "Tanggal", "Uraian", "Kategori", "Pemasukan"]]);
  const h3 = await siapkanFolderKeuangan(TOKEN, 2026);
  cek("tidak membuat folder Keuangan kedua", !h3.folderBaru && nama("Keuangan").length === 1);
  cek("Keuangan Pribadi 2026 disalin dari tahun sebelumnya", nama("Keuangan Pribadi 2026").length === 1 && nama("Keuangan Pribadi 2026")[0].parents.includes(fk.id));
  cek("file 2025 tidak disentuh", nama("Keuangan Pribadi 2025").length === 1 && !files.get(lama.id)!.trashed);

  console.log("Berbagi: izin, rencana, pencabutan");
  reset();
  const fkeu = tambah({ name: "Keuangan", mimeType: FOLDER, ownedByMe: true, parents: ["root"] });
  const bp = tambah({ id: "BP", name: "Keuangan Pribadi 2026", mimeType: SHEET, parents: [fkeu.id] });
  const bk = tambah({ id: "BK", name: "Keuangan Kegiatan 2026", mimeType: SHEET, parents: [fkeu.id] });
  const ts = tambah({ id: "TS", name: "FORM LAPORAN TIMESHEET KEGIATAN BATCH 4", mimeType: SHEET, parents: [fkeu.id] });
  for (const f of [bp, bk, ts]) izin.set(f.id, [{ id: "own-" + f.id, type: "user", role: "owner", emailAddress: "saya@example.org", displayName: "Saya" }]);
  const isi = { folder: { id: fkeu.id, name: "Keuangan" }, spreadsheets: [bp, bk, ts].map((f) => ({ id: f.id, name: f.name, mimeType: SHEET })), timesheets: [], allFiles: [] } as any;
  let berkas = await muatBerkasKeuangan(TOKEN, isi);
  cek("timesheet tidak ikut dalam berkas yang dibagikan", berkas.map((b) => b.id).sort().join() === "BK,BP", berkas.map((b) => b.id));
  cek("email saya diturunkan dari izin pemilik", akunPemilikDariIzin(berkas)?.email === "saya@example.org");

  const r1 = rencanaBerbagi(berkas, "adik@example.org", { pribadi: false, kegiatan: true });
  const t1 = await terapkanRencana(TOKEN, "adik@example.org", r1);
  cek("Kegiatan dibagikan: satu permintaan POST berperan reader tanpa email pemberitahuan",
    t1.dibagikan === 1 && log.some((l) => l.metode === "POST" && l.url.startsWith("/drive/v3/files/BK/permissions?sendNotificationEmail=false") && l.body.role === "reader" && l.body.type === "user" && l.body.emailAddress === "adik@example.org"), log.filter((l) => l.metode === "POST"));
  cek("Pribadi dan timesheet tidak tersentuh", (izin.get("BP") || []).length === 1 && (izin.get("TS") || []).length === 1);

  berkas = await muatBerkasKeuangan(TOKEN, isi);
  const anggota = ringkasAnggota(berkas, "saya@example.org");
  cek("Adik terbaca dari izin nyata: Kegiatan ya, Pribadi tidak", anggota.length === 1 && anggota[0].dana.kegiatan === "ya" && anggota[0].dana.pribadi === "tidak", anggota);

  const r2 = rencanaBerbagi(berkas, "adik@example.org", { pribadi: false, kegiatan: false });
  const t2 = await terapkanRencana(TOKEN, "adik@example.org", r2);
  cek("mencabut dengan ID izin: DELETE berhasil", t2.dicabut === 1 && t2.cabutManual.length === 0 && (izin.get("BK") || []).every((x) => x.emailAddress !== "adik@example.org"), t2);
  cek("izin pemilik tidak ikut terhapus", (izin.get("BK") || []).some((x) => x.role === "owner"));

  console.log("Tautan publik");
  izin.get("BP")!.push({ id: "anyoneWithLink", type: "anyone", role: "reader" });
  berkas = await muatBerkasKeuangan(TOKEN, isi);
  cek("berkas bertautan publik terdeteksi", berkasTautanPublik(berkas).map((b) => b.id).join() === "BP");
  const bt = await batasiTautanPublik(TOKEN, berkasTautanPublik(berkas));
  cek("dibatasi lewat DELETE izin 'anyoneWithLink'", bt.dibatasi === 1 && bt.manual.length === 0 && !(izin.get("BP") || []).some((x) => x.type === "anyone"), bt);
  izin.get("BK")!.push({ id: "anyoneWithLink", type: "anyone", role: "reader" });
  berkas = await muatBerkasKeuangan(TOKEN, isi);
  const tanpaId = berkas.map((b) => ({ ...b, izin: b.izin.map((i) => ({ ...i, id: undefined })) }));
  const bt2 = await batasiTautanPublik(TOKEN, berkasTautanPublik(tanpaId));
  cek("tanpa ID izin: diserahkan ke pengguna (manual), tidak dianggap berhasil", bt2.dibatasi === 0 && bt2.manual.length === 1, bt2);

  console.log("Dibagikan kepada saya");
  reset();
  tambah({ id: "X1", name: "Keuangan Pribadi 2026", mimeType: SHEET, dibagikan: true, pemilik: "ibu@example.org" });
  tambah({ id: "X2", name: "Resep Kue", mimeType: "application/vnd.google-apps.document", dibagikan: true, pemilik: "ibu@example.org" });
  tambah({ id: "Y1", name: "Keuangan Pribadi 2026", mimeType: SHEET, parents: ["root"] }); // milik saya: tidak ikut
  nilai.set("X1", [
    ["Tanggal", "Uraian", "Kategori", "Pemasukan", "Pengeluaran", "Saldo", "Sumber", "Catatan", "ID", "Metode", "Bukti"],
    ["2026-10-02", "Beli beras", "Makan & Minum", "", 150000, -150000, "", "", "ix1", "Tunai", ""],
    ["2026-10-03", "Uang saku", "Gaji", 1000000, "", 850000, "", "", "ix2", "Transfer", ""],
  ]);
  const dibagikan = await daftarDibagikanKeSaya(TOKEN);
  cek("hanya spreadsheet yang dibagikan orang lain", dibagikan.map((d) => d.id).join() === "X1", dibagikan.map((d) => d.id));
  const kel = kelompokkanDibagikan(dibagikan);
  cek("dikelompokkan per pemilik dan dana", kel.length === 1 && kel[0].email === "ibu@example.org" && kel[0].berkas.pribadi.length === 1, kel);
  const trx = await bacaDataDibagikan(TOKEN, dibagikan[0], "pribadi");
  cek("transaksi terbaca: 2 baris, total benar", trx.length === 2 && trx.reduce((a, t) => a + (t.jenis === "pemasukan" ? t.jumlah : -t.jumlah), 0) === 850000, trx.map((t) => [t.deskripsi, t.jumlah]));
  cek("membaca tidak menulis apa pun", tulis().length === 0, tulis());

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
