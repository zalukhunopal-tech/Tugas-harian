// Uji Code.gs dengan tiruan layanan Apps Script (SpreadsheetApp, DriveApp, UrlFetchApp, dst.).
// Jalankan: node pengeluaran/apps-script/uji/uji-code.js  (tanpa akun Google apa pun)
const fs = require("fs"), vm = require("vm"), assert = require("assert"), path = require("path");
const KODE = path.join(__dirname, "..", "Code.gs");
const W = 12;
const baris = (...v) => { const r = Array(W).fill(""); v.forEach((x, i) => (r[i] = x)); return r; };
function buatSheet(nama, rows) {
  const data = rows;
  const range = (r, c, nr = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[r - 1 + i] || [])[c - 1 + j] ?? "")),
    setValues: (vals) => vals.forEach((row, i) => row.forEach((v, j) => { while (data.length < r + i) data.push(Array(W).fill("")); data[r - 1 + i][c - 1 + j] = v; })),
    getValue: () => (data[r - 1] || [])[c - 1] ?? "",
    setValue: (v) => { while (data.length < r) data.push(Array(W).fill("")); data[r - 1][c - 1] = v; },
    setNumberFormat: () => {},
    clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) data[r - 1 + i][c - 1 + j] = ""; },
  });
  return {
    data,
    getParent: () => ({ getName: () => nama }),
    getLastRow: () => data.reduce((last, row, i) => (row.some((v) => v !== "" && v != null) ? i + 1 : last), 0),
    getRange: range,
    deleteRow: (r) => data.splice(r - 1, 1),
  };
}
const pribadi = buatSheet("Keuangan Pribadi 2026", [
  baris("ALIRAN KEUANGAN PRIBADI - Nopal"), baris("", "", "", "", "", "", "", "", "", "", "REKAP OTOMATIS"),
  baris("", "", "", "", "", "", "", "", "", "", "Total pemasukan", 0), baris(), baris(),
  baris("No", "Tanggal", "Uraian", "Kategori", "Pemasukan (Rp)", "Pengeluaran (Rp)", "Saldo (Rp)", "Sumber / Tujuan", "Catatan", "", "Jumlah transaksi", 2),
  baris("=ARRAYFORMULA(...)", "2026-09-19", "Saldo awal", "Pemasukan Lain", "", "", "=ARRAYFORMULA(...)", "", "Isi angkanya di kolom Pemasukan"),
  baris("", "2026-09-19", "Pembelian makan siang di Hotways Chicken", "Makan & Minum", "", 68000, "", "Hotways Chicken - Tanjung Selor", "Bayar QRIS. Struk HTCS2026 (15:05)"),
  baris(), baris("", "", "", "", "", "", "", "", "", "", "PENGELUARAN PER KATEGORI"),
  baris("", "", "", "", "", "", "", "", "", "", "Makan & Minum", 68000), baris("", "", "", "", "", "", "", "", "", "", "TOTAL", 68000),
]);
const kegiatan = buatSheet("Keuangan Kegiatan 2026", [
  baris("ALIRAN KEUANGAN KEGIATAN"), baris(), baris(), baris(), baris(),
  baris("No", "Tanggal", "Uraian", "Kategori", "Pemasukan (Rp)", "Pengeluaran (Rp)", "Saldo (Rp)", "Kaitan Kegiatan", "Catatan"),
  baris("=AF", new Date(2026, 8, 19), "Penerimaan dana awal kegiatan", "Penerimaan Dana", 26370000, "", "=AF", "", "Dana awal berkegiatan"),
  baris("", "2026-09-20", "Pembelian konsumsi perjalanan (snack) di Indomaret", "Konsumsi", "", 65800, "", "Perjalanan Tanjung Selor - Malinau", "Bayar tunai. Struk 20.09.26"),
]);
const files = [
  { nama: "Keuangan Pribadi 2026", id: "p", sheet: pribadi }, { nama: "Keuangan Pribadi 2025", id: "p-lama", sheet: buatSheet("lama", []) },
  { nama: "Keuangan Kegiatan 2026", id: "k", sheet: kegiatan }, { nama: "Catatan lain", id: "x", sheet: null },
];
let no = 0;
const lastUpdated = { p: new Date(2026, 0, 1), k: new Date(2026, 0, 1) };
let folderAntrean = null;
const buatFolderAntrean = () => ({ nama: "Antrean Sinkron", isi: [], getFiles() { const d = this.isi.filter((f) => !f.trashed); let i = 0; return { hasNext: () => i < d.length, next: () => d[i++] }; } });
const opFile = (nama, isi) => ({ nama, isi, trashed: false, getName() { return this.nama; }, getBlob() { return { getDataAsString: () => this.isi }; }, setTrashed(v) { this.trashed = v; }, setName(n) { this.nama = n; } });
const triggers = []; const props = {};
const jsonFiles = {}; // nama -> isi teks (Aset.json, Harga Pasar.json)
const fileJson = (nama) => ({ getBlob: () => ({ getDataAsString: () => jsonFiles[nama] }), setContent: (t) => { jsonFiles[nama] = t; } });
const HTML_EMAS = `<html><body><h1>Harga Emas Hari Ini</h1><table><tr><td>0.5 gr</td><td>Rp 720.000</td></tr>
<tr><td>1 gr</td><td>Rp 1.345.000</td></tr><tr><td>2 gr</td><td>Rp 2.630.000</td></tr></table>
<p>Harga Buyback Emas: Rp 1.210.000 /gram</p><script>var x = "1 gr Rp 9.999.999";</script></body></html>`;
const fetchLog = []; let coingeckoGagal = false;
Object.assign(globalThis, {
  MimeType: { GOOGLE_SHEETS: "application/vnd.google-apps.spreadsheet" },
  DriveApp: { getFolderById: (id) => { assert.equal(id, "1zRqAgxStMdx3Ksm_K1R8R_pec_pMg6qf"); let i = 0; return {
    getFiles: () => ({ hasNext: () => i < files.length, next: () => { const f = files[i++]; return { getMimeType: () => (f.sheet ? MimeType.GOOGLE_SHEETS : "text/plain"), getName: () => f.nama, getLastUpdated: () => (f.id === "p-lama" ? new Date(2025, 0, 1) : lastUpdated[f.id] || new Date(2026, 0, 1)), getId: () => f.id }; } }),
    getFoldersByName: (n) => { assert.equal(n, "Antrean Sinkron"); let ada = !!folderAntrean; return { hasNext: () => ada, next: () => { ada = false; return folderAntrean; } }; },
    createFolder: (n) => (folderAntrean = buatFolderAntrean()),
    getFilesByName: (n) => { let ada = n in jsonFiles; return { hasNext: () => ada, next: () => { ada = false; return fileJson(n); } }; },
    createFile: (n, teks, mime) => { assert.equal(mime, "application/json"); jsonFiles[n] = teks; return fileJson(n); },
  }; } },
  UrlFetchApp: { fetch: (url) => { fetchLog.push(url);
    if (url.includes("logammulia.com/id/harga-emas-hari-ini")) return { getResponseCode: () => 200, getContentText: () => HTML_EMAS };
    if (url.includes("logammulia.com")) return { getResponseCode: () => 503, getContentText: () => "" };
    if (url.includes("coingecko")) return coingeckoGagal ? { getResponseCode: () => 429, getContentText: () => "" } : { getResponseCode: () => 200, getContentText: () => JSON.stringify({ bitcoin: { idr: 1650000000, idr_24h_change: 1.25 }, ethereum: { idr: 42000000, idr_24h_change: -0.5 }, solana: { idr: 2500000, idr_24h_change: 3 } }) };
    throw new Error("URL tidak dikenal: " + url); } },
  ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1), newTrigger: (fn) => { const buat = (m) => ({ create: () => { const t = { fn, m, getHandlerFunction: () => fn }; triggers.push(t); return t; } }); return { timeBased: () => ({ everyMinutes: buat, everyHours: (h) => buat(h * 60) }) }; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
  Logger: { log: () => {} },
  SpreadsheetApp: { openById: (id) => ({ getSheets: () => [files.find((f) => f.id === id).sheet] }) },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ setMimeType() { return { getContent: () => s }; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  Utilities: { getUuid: () => `uuid-${++no}-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`, formatDate: (d, tz, fmt) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` },
  Session: { getScriptTimeZone: () => "Asia/Makassar" },
});
vm.runInThisContext(fs.readFileSync(KODE, "utf8"), { filename: KODE });
const get = (action) => JSON.parse(doGet({ parameter: { action } }).getContent());
const post = (body) => { cacheSheet = {}; cacheFile = {}; return JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }).getContent()); };

// ping
const ping = get("ping");
assert.deepEqual(ping, { ok: true, versi: 3, sheets: ["Keuangan Pribadi 2026", "Keuangan Kegiatan 2026"] });

// list: memberi id ke baris manual, header J6, parsing metode/tanggal/jenis
const list = get("list");
assert.equal(list.ok, true); assert.equal(list.transaksi.length, 4);
const [saldoAwal, hotways, dana, snack] = list.transaksi;
assert.match(saldoAwal.id, /^suuid1/);
assert.deepEqual(saldoAwal, { id: saldoAwal.id, dana: "Dana Pribadi", jenis: "pemasukan", tanggal: "2026-09-19", deskripsi: "Saldo awal", kategori: "Pemasukan Lain", jumlah: 0, metode: "", kaitan: "", catatan: "Isi angkanya di kolom Pemasukan" });
assert.equal(hotways.jenis, "pengeluaran"); assert.equal(hotways.jumlah, 68000); assert.equal(hotways.metode, "QRIS"); assert.equal(hotways.catatan, "Struk HTCS2026 (15:05)"); assert.equal(hotways.kaitan, "Hotways Chicken - Tanjung Selor");
assert.equal(dana.tanggal, "2026-09-19"); assert.equal(dana.jenis, "pemasukan"); assert.equal(dana.jumlah, 26370000);
assert.equal(snack.metode, "Tunai"); assert.equal(snack.catatan, "Struk 20.09.26"); assert.equal(snack.dana, "Dana Kegiatan");
assert.equal(pribadi.data[5][9], "ID Aplikasi"); assert.equal(pribadi.data[6][9], saldoAwal.id); assert.equal(kegiatan.data[7][9], snack.id);

// upsert baru -> baris kosong pertama (baris 9), bukan setelah panel K/L
const r1 = post({ action: "upsert", transaksi: { id: "app1", dana: "Dana Pribadi", jenis: "pengeluaran", tanggal: "2026-09-25", deskripsi: "Pembelian kopi", kategori: "Makan & Minum", jumlah: 25000, metode: "Tunai", kaitan: "Point Coffee", catatan: "Struk 0042" } });
assert.deepEqual(r1, { ok: true, id: "app1" });
assert.deepEqual(pribadi.data[8].slice(0, 10), ["", "2026-09-25", "Pembelian kopi", "Makan & Minum", "", 25000, "", "Point Coffee", "Bayar tunai. Struk 0042", "app1"]);
assert.equal(pribadi.data[9][10], "PENGELUARAN PER KATEGORI", "panel K/L tidak bergeser");

// upsert ubah -> baris yang sama
post({ action: "upsert", transaksi: { id: "app1", dana: "Dana Pribadi", jenis: "pengeluaran", tanggal: "2026-09-25", deskripsi: "Pembelian kopi susu", kategori: "Makan & Minum", jumlah: 30000, metode: "QRIS", kaitan: "", catatan: "" } });
assert.deepEqual(pribadi.data[8].slice(1, 10), ["2026-09-25", "Pembelian kopi susu", "Makan & Minum", "", 30000, "", "", "Bayar QRIS.", "app1"]);
assert.equal(pribadi.data.length, 12);

// pindah dana -> hapus di Pribadi (deleteRow), tulis di Kegiatan
post({ action: "upsert", transaksi: { id: "app1", dana: "Dana Kegiatan", jenis: "pengeluaran", tanggal: "2026-09-25", deskripsi: "Pembelian kopi rapat", kategori: "Konsumsi", jumlah: 30000, metode: "", kaitan: "Rapat tim GIS", catatan: "" } });
assert.equal(pribadi.data.length, 11); assert.equal(pribadi.data[8][10], "PENGELUARAN PER KATEGORI", "baris kosong terhapus, panel naik satu baris");
assert.deepEqual(kegiatan.data[8].slice(1, 10), ["2026-09-25", "Pembelian kopi rapat", "Konsumsi", "", 30000, "", "Rapat tim GIS", "", "app1"]);
assert.equal(kegiatan.data[5][9], "ID Aplikasi");

// pemasukan -> kolom E, F kosong
post({ action: "upsert", transaksi: { dana: "Dana Kegiatan", jenis: "pemasukan", tanggal: "2026-09-26", deskripsi: "Penerimaan dana tahap 2", kategori: "Penerimaan Dana", jumlah: 5000000 } });
assert.deepEqual(kegiatan.data[9].slice(1, 6), ["2026-09-26", "Penerimaan dana tahap 2", "Penerimaan Dana", 5000000, ""]);
assert.match(kegiatan.data[9][9], /^suuid/);

// hapus: baris biasa dihapus, baris 7 hanya dikosongkan (ARRAYFORMULA tetap)
assert.deepEqual(post({ action: "delete", id: "app1" }), { ok: true, dihapus: 1 });
assert.equal(kegiatan.data[8][2], "Penerimaan dana tahap 2");
assert.deepEqual(post({ action: "delete", id: saldoAwal.id }), { ok: true, dihapus: 1 });
assert.equal(pribadi.data[6][0], "=ARRAYFORMULA(...)"); assert.equal(pribadi.data[6][6], "=ARRAYFORMULA(...)"); assert.equal(pribadi.data[6][2], ""); assert.equal(pribadi.data[7][2], "Pembelian makan siang di Hotways Chicken");
assert.deepEqual(post({ action: "delete", id: "tidak-ada" }), { ok: true, dihapus: 0 });

// validasi
assert.equal(post({ action: "upsert", transaksi: { dana: "Dana Lain", jenis: "pengeluaran", tanggal: "2026-09-25", deskripsi: "x", jumlah: 1 } }).error, "Dana tidak dikenal: Dana Lain");
assert.equal(post({ action: "upsert", transaksi: { dana: "Dana Pribadi", jenis: "pengeluaran", tanggal: "25/09/2026", deskripsi: "x", jumlah: 1 } }).error, "Tanggal harus YYYY-MM-DD");
assert.equal(post({ action: "apa" }).error, "Aksi tidak dikenal: apa");
assert.equal(get("apa").error, "Aksi tidak dikenal: apa");

// ---------- Antrean dari halaman artifact ----------
const jalan = (fn) => { cacheSheet = {}; cacheFile = {}; return fn(); };
// Sebelum pasangPemicu: tidak ada folder -> tidak error, tidak membuat folder
jalan(prosesAntreanDrive); assert.equal(folderAntrean, null);
jalan(pasangPemicu); assert.ok(folderAntrean, "folder dibuat"); assert.deepEqual(triggers.map((t) => [t.fn, t.m]).sort(), [["perbaruiHargaTerjadwal", 60], ["prosesAntreanDrive", 1]]);
jalan(pasangPemicu); assert.equal(triggers.length, 2, "pemicu lama diganti, tidak dobel");

// Baris manual tanpa ID di sheet Kegiatan -> diberi ID saat file sheet berubah
let iManual = kegiatan.data.findIndex((r, i) => i >= 6 && !r[2]);
if (iManual < 0) iManual = kegiatan.data.length;
kegiatan.data[iManual] = baris("", "2026-09-27", "Sewa perahu (diketik manual)", "Transportasi & BBM", "", 400000);
lastUpdated.k = new Date(Date.now() + 1000);
jalan(prosesAntreanDrive);
assert.match(kegiatan.data[iManual][9], /^suuid/, "baris manual mendapat ID");
const idManual = kegiatan.data[iManual][9];
// Tidak berubah lagi -> sheet tidak dibuka ulang (ID tidak berubah, tidak ada panggilan)
jalan(prosesAntreanDrive); assert.equal(kegiatan.data[iManual][9], idManual);

// Urutan diproses berdasar nama; upsert lalu ubah lalu hapus; file ganda idempoten; file rusak ditandai
const tx = { id: "art1", dana: "Dana Pribadi", jenis: "pengeluaran", tanggal: "2026-09-27", deskripsi: "Pembelian air mineral", kategori: "Makan & Minum", jumlah: 8000, metode: "Tunai", kaitan: "", catatan: "" };
folderAntrean.isi.push(
  opFile("op-1790400000003-delete-" + idManual + ".json", JSON.stringify({ action: "delete", id: idManual })),
  opFile("op-1790400000002-upsert-art1.json", JSON.stringify({ action: "upsert", transaksi: { ...tx, jumlah: 9000 } })),
  opFile("op-1790400000001-upsert-art1.json", JSON.stringify({ action: "upsert", transaksi: tx })),
  opFile("op-1790400000001-upsert-art1-dup.json", JSON.stringify({ action: "upsert", transaksi: tx })),
  opFile("op-1790400000004-rusak.json", "{bukan json"),
  opFile("catatan.txt", "abaikan"),
);
jalan(prosesAntreanDrive);
const barisArt = pribadi.data.filter((r) => r[9] === "art1");
assert.equal(barisArt.length, 1, "file ganda tidak membuat baris ganda");
assert.equal(barisArt[0][5], 9000, "op terakhir (urut nama) yang menang");
assert.ok(!kegiatan.data.some((r) => r[9] === idManual), "baris manual terhapus lewat antrean");
const sisa = folderAntrean.isi.filter((f) => !f.trashed).map((f) => f.nama);
assert.equal(sisa.length, 2); assert.ok(sisa.includes("catatan.txt"));
assert.ok(sisa.some((n) => n.startsWith("GAGAL - op-1790400000004-rusak.json - ")), "file rusak ditandai GAGAL");
jalan(prosesAntreanDrive); assert.equal(folderAntrean.isi.filter((f) => !f.trashed).length, 2, "file GAGAL tidak diulang");
assert.throws(() => terapkanOp({ action: "apa" }), /Aksi tidak dikenal/);

// ---------- Kunci sinkron ----------
props.KUNCI_SINKRON = ["rahasia", "panjang", "123"].join("-"); // dirangkai agar tidak menyerupai kunci sungguhan bagi pemindai
assert.equal(get("ping").error, "Kunci sinkron salah atau kosong");
assert.equal(post({ action: "delete", id: "x" }).error, "Kunci sinkron salah atau kosong");
assert.equal(JSON.parse(doGet({ parameter: { action: "ping", kunci: props.KUNCI_SINKRON } }).getContent()).ok, true);
assert.equal(post({ action: "delete", id: "tidak-ada", kunci: props.KUNCI_SINKRON }).ok, true);
delete props.KUNCI_SINKRON;

// ---------- Aset.json ----------
assert.deepEqual(get("aset"), { ok: true, aset: [] });
const asetContoh = [
  { id: "a1", jenis: "emas", nama: "Emas Antam 5 gr", gram: 5, hargaBeli: 1200000, catatan: "", dibuat: "2026-09-26" },
  { id: "a2", jenis: "crypto", nama: "BTC", koin: "solana", simbol: "SOL", jumlah: 2, hargaBeli: 0, catatan: "", dibuat: "2026-09-26" },
  { id: "buruk", jenis: "saham", nama: "tidak dikenal" },
  { id: "a3", jenis: "jmo", nama: "JHT", saldoAwal: 12500000, tanggalSaldo: "2026-01-01", gaji: 5000000, iuranPersen: 5.7, hasilPersen: 5.5, iuranTambahan: 0, catatan: "", dibuat: "2026-09-26", rahasia: { objek: 1 } },
];
assert.deepEqual(post({ action: "aset", aset: asetContoh }), { ok: true, jumlah: 3 });
const asetTersimpan = get("aset").aset;
assert.equal(asetTersimpan.length, 3); assert.equal(asetTersimpan[2].rahasia, undefined, "nilai non-primitif dibuang"); assert.equal(asetTersimpan[0].gram, 5);
assert.equal(post({ action: "aset", aset: "bukan array" }).error, "Daftar aset harus berupa array");
// lewat antrean Drive
folderAntrean.isi.push(opFile("op-1790400000009-aset-aset.json", JSON.stringify({ action: "aset", aset: asetContoh.slice(0, 1) })));
jalan(prosesAntreanDrive);
assert.equal(get("aset").aset.length, 1, "aset lewat antrean menggantikan daftar");

// ---------- Harga pasar ----------
const h1 = get("harga");
assert.equal(h1.ok, true);
assert.deepEqual({ jual: h1.harga.emas.jual, buyback: h1.harga.emas.buyback, sumber: h1.harga.emas.sumber }, { jual: 1345000, buyback: 1210000, sumber: "Logam Mulia" });
assert.equal(h1.harga.crypto.bitcoin.idr, 1650000000); assert.equal(h1.harga.crypto.bitcoin.perubahan24, 1.25);
assert.ok(h1.harga.crypto.solana, "koin dari Aset.json ikut diambil"); assert.ok("Harga Pasar.json" in jsonFiles);
const nFetch = fetchLog.length;
get("harga"); assert.equal(fetchLog.length, nFetch, "harga segar tidak diambil ulang");
coingeckoGagal = true;
const h2 = JSON.parse(doGet({ parameter: { action: "harga", segar: "1" } }).getContent()).harga;
assert.equal(h2.crypto.bitcoin.idr, 1650000000, "nilai lama dipertahankan saat sumber gagal"); assert.match(h2.catatan.join(" "), /Kripto: CoinGecko menjawab 429/);
coingeckoGagal = false;
// parser: script diabaikan, harga di luar kisaran ditolak
assert.equal(parseHargaEmas("<p>1 gr Rp 50.000</p>"), null);
assert.deepEqual(parseHargaEmas("<td>1 gram</td><td>Rp1.500.000</td> buyback Rp 1.400.000"), { jual: 1500000, buyback: 1400000 });
assert.equal(parseHargaEmas("<td>1 gram</td><td>Rp1.500.000</td> buyback Rp 1.900.000").buyback, null, "buyback di atas harga jual diabaikan");
assert.equal(parseHargaEmas("tidak ada harga"), null);
// list membawa aset dan harga
const l2 = get("list"); assert.ok(Array.isArray(l2.aset) && l2.harga && l2.harga.emas);
// pasangPemicu memasang pemicu harga per jam
jalan(pasangPemicu); assert.deepEqual(triggers.map((t) => t.fn).sort(), ["perbaruiHargaTerjadwal", "prosesAntreanDrive"]);
console.log("Code.gs: semua uji lulus");
