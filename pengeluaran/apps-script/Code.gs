/**
 * Perantara sinkronisasi "Catatan Keuangan Harian" <-> Google Sheets.
 *
 * Dipasang sebagai Google Apps Script Web App dari akun pemilik folder Keuangan.
 * Aplikasi web mengirim transaksi ke sini (POST) dan menarik seluruh isi sheet (GET).
 * Halaman artifact Claude tidak boleh menghubungi Web App ini, jadi ia menulis perubahan sebagai
 * file JSON di subfolder "Antrean Sinkron" lewat konektor Google Drive; prosesAntreanDrive()
 * (dipicu setiap menit, pasang dengan menjalankan pasangPemicu() sekali) memasukkannya ke sheet.
 * Harga pasar (emas Antam dari Logam Mulia, kripto dari CoinGecko) diambil perbaruiHarga() tiap jam
 * dan disimpan di "Harga Pasar.json"; daftar aset aplikasi disimpan di "Aset.json".
 * Keamanan: bila Script Property KUNCI_SINKRON diisi, setiap permintaan Web App harus membawa kunci itu.
 * Panduan pemasangan: README.md di folder yang sama.
 *
 * Tata letak sheet (sama untuk Keuangan Pribadi dan Keuangan Kegiatan):
 *   baris 6 header, data mulai baris 7.
 *   A No (ARRAYFORMULA) | B Tanggal | C Uraian | D Kategori | E Pemasukan | F Pengeluaran
 *   G Saldo (ARRAYFORMULA) | H Sumber/Tujuan atau Kaitan Kegiatan | I Catatan | J ID Aplikasi
 * Kolom A dan G TIDAK PERNAH ditulis oleh skrip ini.
 */

var FOLDER_ID = "1zRqAgxStMdx3Ksm_K1R8R_pec_pMg6qf";
var NAMA_SHEET = { "Dana Pribadi": "Keuangan Pribadi", "Dana Kegiatan": "Keuangan Kegiatan" };
var BARIS_HEADER = 6;
var BARIS_AWAL = 7;
var KOL = { tanggal: 2, uraian: 3, kategori: 4, pemasukan: 5, pengeluaran: 6, kaitan: 8, catatan: 9, id: 10 };
var NAMA_FOLDER_ANTREAN = "Antrean Sinkron";
var NAMA_FILE_ASET = "Aset.json";
var NAMA_FILE_HARGA = "Harga Pasar.json";
var KOIN_DEFAULT = ["bitcoin", "ethereum"];
var HARGA_SEGAR_MENIT = 55;
var SUMBER_EMAS = [
  { nama: "Logam Mulia", url: "https://www.logammulia.com/id/harga-emas-hari-ini" },
  { nama: "Logam Mulia (beranda)", url: "https://www.logammulia.com/id" },
];
var URL_COINGECKO = "https://api.coingecko.com/api/v3/simple/price?vs_currencies=idr&include_24hr_change=true&ids=";
var VERSI = 3;

var cacheSheet = {};
var cacheFile = {};

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "ping";
  return jalankan(function () {
    periksaKunci(e && e.parameter && e.parameter.kunci);
    if (action === "ping") {
      return {
        ok: true,
        versi: VERSI,
        sheets: Object.keys(NAMA_SHEET).map(function (dana) {
          return ambilSheet(dana).getParent().getName();
        }),
      };
    }
    if (action === "list") return { ok: true, transaksi: bacaSemua(), aset: bacaAset(), harga: perbaruiHarga(false) };
    if (action === "harga") return { ok: true, harga: perbaruiHarga(e.parameter.segar === "1") };
    if (action === "aset") return { ok: true, aset: bacaAset() };
    throw new Error("Aksi tidak dikenal: " + action);
  });
}

function doPost(e) {
  return jalankan(function () {
    var body = JSON.parse(e.postData.contents);
    periksaKunci(body.kunci);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === "upsert") return { ok: true, id: upsert(body.transaksi) };
      if (body.action === "delete") return { ok: true, dihapus: hapus(body.id) };
      if (body.action === "aset") return { ok: true, jumlah: simpanAset(body.aset) };
      if (body.action === "list") return { ok: true, transaksi: bacaSemua(), aset: bacaAset(), harga: perbaruiHarga(false) };
      throw new Error("Aksi tidak dikenal: " + body.action);
    } finally {
      lock.releaseLock();
    }
  });
}

// Bila KUNCI_SINKRON diisi di Project Settings → Script Properties, URL Web App saja tidak cukup:
// permintaan tanpa kunci yang sama ditolak. Antrean lewat Drive tidak perlu kunci (sudah lewat akun Google).
function periksaKunci(kunciDiberikan) {
  var kunci = PropertiesService.getScriptProperties().getProperty("KUNCI_SINKRON");
  if (!kunci) return;
  if (String(kunciDiberikan || "") !== kunci) throw new Error("Kunci sinkron salah atau kosong");
}

function jalankan(fn) {
  var hasil;
  try {
    hasil = fn();
  } catch (err) {
    hasil = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Akses sheet ---------- */

// File id bisa berubah kalau sheet pernah dibuat ulang, jadi cari berdasarkan nama di folder Keuangan
// dan ambil yang paling baru diperbarui.
function cariFileSheet(dana) {
  if (cacheFile[dana]) return cacheFile[dana];
  var nama = NAMA_SHEET[dana];
  if (!nama) throw new Error("Dana tidak dikenal: " + dana);
  var files = DriveApp.getFolderById(FOLDER_ID).getFiles();
  var terbaru = null;
  while (files.hasNext()) {
    var f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS && f.getName().indexOf(nama) === 0) {
      if (!terbaru || f.getLastUpdated() > terbaru.getLastUpdated()) terbaru = f;
    }
  }
  if (!terbaru) throw new Error("Sheet '" + nama + "' tidak ditemukan di folder Keuangan");
  cacheFile[dana] = terbaru;
  return terbaru;
}

function ambilSheet(dana) {
  if (cacheSheet[dana]) return cacheSheet[dana];
  cacheSheet[dana] = SpreadsheetApp.openById(cariFileSheet(dana).getId()).getSheets()[0];
  return cacheSheet[dana];
}

function pastikanHeaderId(sheet) {
  var sel = sheet.getRange(BARIS_HEADER, KOL.id);
  if (!String(sel.getValue()).trim()) sel.setValue("ID Aplikasi");
}

function jumlahBarisData(sheet) {
  var last = sheet.getLastRow();
  return last < BARIS_AWAL ? 0 : last - BARIS_AWAL + 1;
}

function cariBaris(sheet, id) {
  var n = jumlahBarisData(sheet);
  if (!n) return 0;
  var ids = sheet.getRange(BARIS_AWAL, KOL.id, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return BARIS_AWAL + i;
  }
  return 0;
}

// Baris pertama yang kolom Uraian-nya kosong; panel rekap di K-L tidak dihitung.
function barisKosong(sheet) {
  var n = jumlahBarisData(sheet);
  if (!n) return BARIS_AWAL;
  var uraian = sheet.getRange(BARIS_AWAL, KOL.uraian, n, 1).getValues();
  for (var i = 0; i < uraian.length; i++) {
    if (!String(uraian[i][0]).trim()) return BARIS_AWAL + i;
  }
  return BARIS_AWAL + n;
}

/* ---------- Baca ---------- */

function bacaSemua() {
  var semua = [];
  Object.keys(NAMA_SHEET).forEach(function (dana) {
    var sheet = ambilSheet(dana);
    var n = jumlahBarisData(sheet);
    if (!n) return;
    var nilai = sheet.getRange(BARIS_AWAL, 1, n, KOL.id).getValues();
    var idBaru = [];
    nilai.forEach(function (baris, i) {
      if (!String(baris[KOL.uraian - 1]).trim()) return;
      var id = String(baris[KOL.id - 1]).trim();
      if (!id) {
        id = buatId();
        idBaru.push([BARIS_AWAL + i, id]);
      }
      semua.push(keTransaksi(baris, dana, id));
    });
    // Baris yang diketik manual di sheet diberi id supaya bisa diubah/dihapus dari aplikasi.
    idBaru.forEach(function (pasangan) {
      sheet.getRange(pasangan[0], KOL.id).setValue(pasangan[1]);
    });
    if (idBaru.length) pastikanHeaderId(sheet);
  });
  return semua;
}

function keTransaksi(baris, dana, id) {
  var masuk = angka(baris[KOL.pemasukan - 1]);
  var keluar = angka(baris[KOL.pengeluaran - 1]);
  var kategori = String(baris[KOL.kategori - 1] || "").trim();
  var jenis = masuk > 0 || (keluar === 0 && /pemasukan|penerimaan/i.test(kategori)) ? "pemasukan" : "pengeluaran";
  var catatanMentah = String(baris[KOL.catatan - 1] || "").trim();
  var m = catatanMentah.match(/^Bayar\s+([^.]+)\.\s*/i);
  return {
    id: id,
    dana: dana,
    jenis: jenis,
    tanggal: formatTanggal(baris[KOL.tanggal - 1]),
    deskripsi: String(baris[KOL.uraian - 1]).trim(),
    kategori: kategori,
    jumlah: jenis === "pemasukan" ? masuk : keluar,
    metode: m ? rapikanMetode(m[1]) : "",
    kaitan: String(baris[KOL.kaitan - 1] || "").trim(),
    catatan: m ? catatanMentah.slice(m[0].length) : catatanMentah,
  };
}

function angka(v) {
  if (typeof v === "number") return v;
  var bersih = String(v || "").replace(/[^\d-]/g, "");
  return bersih ? Number(bersih) || 0 : 0;
}

function formatTanggal(v) {
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var s = String(v || "").trim();
  var dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return dmy[3] + "-" + ("0" + dmy[2]).slice(-2) + "-" + ("0" + dmy[1]).slice(-2);
  return s;
}

var METODE = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  "e-wallet": "E-wallet",
  ewallet: "E-wallet",
  "kartu debit/kredit": "Kartu debit/kredit",
};

function rapikanMetode(s) {
  var kunci = s.trim().toLowerCase();
  if (METODE[kunci]) return METODE[kunci];
  return s.trim().charAt(0).toUpperCase() + s.trim().slice(1);
}

function gabungCatatan(tx) {
  var catatan = String(tx.catatan || "").trim();
  var metode = String(tx.metode || "").trim();
  if (!metode) return catatan;
  var teks = metode === "QRIS" || metode === "E-wallet" ? metode : metode.toLowerCase();
  return "Bayar " + teks + "." + (catatan ? " " + catatan : "");
}

/* ---------- Tulis ---------- */

function validasi(tx) {
  if (!tx || typeof tx !== "object") throw new Error("Transaksi kosong");
  if (!NAMA_SHEET[tx.dana]) throw new Error("Dana tidak dikenal: " + tx.dana);
  if (!String(tx.deskripsi || "").trim()) throw new Error("Uraian wajib diisi");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tx.tanggal || ""))) throw new Error("Tanggal harus YYYY-MM-DD");
  if (tx.jenis !== "pemasukan" && tx.jenis !== "pengeluaran") throw new Error("Jenis tidak dikenal: " + tx.jenis);
}

function upsert(tx) {
  validasi(tx);
  var id = String(tx.id || "").trim() || buatId();
  // Kalau dana berpindah saat diubah, baris lama di sheet yang lain dihapus dulu.
  Object.keys(NAMA_SHEET).forEach(function (dana) {
    if (dana === tx.dana) return;
    var lain = ambilSheet(dana);
    var r = cariBaris(lain, id);
    if (r) hapusBaris(lain, r);
  });
  var sheet = ambilSheet(tx.dana);
  var baris = cariBaris(sheet, id) || barisKosong(sheet);
  tulisBaris(sheet, baris, tx, id);
  pastikanHeaderId(sheet);
  return id;
}

function tulisBaris(sheet, baris, tx, id) {
  var masuk = tx.jenis === "pemasukan";
  var jumlah = Math.round(Number(tx.jumlah)) || 0;
  // Tanggal disimpan sebagai teks YYYY-MM-DD, sesuai panduan di sheet.
  sheet.getRange(baris, KOL.tanggal).setNumberFormat("@");
  sheet
    .getRange(baris, KOL.tanggal, 1, 5)
    .setValues([[tx.tanggal, String(tx.deskripsi).trim(), String(tx.kategori || "").trim(), masuk ? jumlah || "" : "", masuk ? "" : jumlah || ""]]);
  sheet.getRange(baris, KOL.kaitan, 1, 3).setValues([[String(tx.kaitan || "").trim(), gabungCatatan(tx), id]]);
}

function hapus(id) {
  id = String(id || "").trim();
  if (!id) throw new Error("ID kosong");
  var jumlahDihapus = 0;
  Object.keys(NAMA_SHEET).forEach(function (dana) {
    var sheet = ambilSheet(dana);
    var r = cariBaris(sheet, id);
    if (r) {
      hapusBaris(sheet, r);
      jumlahDihapus++;
    }
  });
  return jumlahDihapus;
}

// Baris 7 memuat ARRAYFORMULA di A7 dan G7, jadi baris itu hanya dikosongkan, tidak dihapus.
function hapusBaris(sheet, baris) {
  if (baris === BARIS_AWAL) {
    sheet.getRange(baris, KOL.tanggal, 1, 5).clearContent();
    sheet.getRange(baris, KOL.kaitan, 1, 3).clearContent();
  } else {
    sheet.deleteRow(baris);
  }
}

function buatId() {
  return "s" + Utilities.getUuid().replace(/-/g, "").slice(0, 10);
}

/* ---------- Antrean dari halaman artifact Claude ---------- */

/**
 * Jalankan SEKALI dari editor: pilih fungsi "pasangPemicu" di bilah atas, lalu ▶ Jalankan.
 * Membuat subfolder "Antrean Sinkron" (bila belum ada) dan pemicu yang menjalankan
 * prosesAntreanDrive setiap menit. Aman dijalankan ulang; pemicu lama diganti.
 */
function pasangPemicu() {
  ambilFolderAntrean(true);
  ScriptApp.getProjectTriggers().forEach(function (pemicu) {
    if (pemicu.getHandlerFunction() === "prosesAntreanDrive") ScriptApp.deleteTrigger(pemicu);
  });
  ScriptApp.getProjectTriggers().forEach(function (pemicu) {
    if (pemicu.getHandlerFunction() === "perbaruiHargaTerjadwal") ScriptApp.deleteTrigger(pemicu);
  });
  ScriptApp.newTrigger("prosesAntreanDrive").timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger("perbaruiHargaTerjadwal").timeBased().everyHours(1).create();
  prosesAntreanDrive();
  perbaruiHarga(true);
  Logger.log("Pemicu terpasang: antrean artifact diproses tiap menit, harga pasar diperbarui tiap jam.");
}

function perbaruiHargaTerjadwal() {
  perbaruiHarga(true);
}

function ambilFolderAntrean(buat) {
  var induk = DriveApp.getFolderById(FOLDER_ID);
  var ada = induk.getFoldersByName(NAMA_FOLDER_ANTREAN);
  if (ada.hasNext()) return ada.next();
  return buat ? induk.createFolder(NAMA_FOLDER_ANTREAN) : null;
}

// File antrean bernama "op-<milidetik>-...json" sehingga urutan nama = urutan kejadian.
// Operasi upsert/hapus bersifat idempoten, jadi file ganda (kiriman ulang) tidak merusak data.
function prosesAntreanDrive() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var folder = ambilFolderAntrean(false);
    var diproses = 0;
    if (folder) {
      var daftar = [];
      var files = folder.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        if (f.getName().indexOf("op-") === 0) daftar.push(f);
      }
      daftar.sort(function (a, b) {
        return a.getName() < b.getName() ? -1 : a.getName() > b.getName() ? 1 : 0;
      });
      daftar.forEach(function (f) {
        try {
          terapkanOp(JSON.parse(f.getBlob().getDataAsString()));
          f.setTrashed(true);
          diproses++;
        } catch (err) {
          // Ditandai dan dilewati supaya tidak diulang terus; isinya tetap bisa diperiksa.
          f.setName("GAGAL - " + f.getName() + " - " + String((err && err.message) || err).slice(0, 150));
        }
      });
    }
    beriIdBarisBaru(diproses > 0);
  } finally {
    lock.releaseLock();
  }
}

function terapkanOp(op) {
  if (!op || typeof op !== "object") throw new Error("Isi antrean bukan JSON objek");
  if (op.action === "upsert") return upsert(op.transaksi);
  if (op.action === "delete") return hapus(op.id);
  if (op.action === "aset") return simpanAset(op.aset);
  throw new Error("Aksi tidak dikenal: " + op.action);
}

// Baris yang diketik manual di sheet diberi ID supaya bisa diubah/dihapus dari halaman artifact.
// Sheet hanya dibuka bila berubah sejak pemeriksaan terakhir, agar pemicu per menit tetap ringan.
function beriIdBarisBaru(paksa) {
  var props = PropertiesService.getScriptProperties();
  Object.keys(NAMA_SHEET).forEach(function (dana) {
    var kunci = "idDiperiksa_" + dana;
    var diubah = cariFileSheet(dana).getLastUpdated().getTime();
    if (!paksa && diubah <= Number(props.getProperty(kunci) || 0)) return;
    beriIdSheet(ambilSheet(dana));
    props.setProperty(kunci, String(Date.now()));
  });
}

function beriIdSheet(sheet) {
  var n = jumlahBarisData(sheet);
  if (!n) return 0;
  var lebar = KOL.id - KOL.uraian + 1;
  var nilai = sheet.getRange(BARIS_AWAL, KOL.uraian, n, lebar).getValues();
  var jumlah = 0;
  nilai.forEach(function (baris, i) {
    if (String(baris[0]).trim() && !String(baris[lebar - 1]).trim()) {
      sheet.getRange(BARIS_AWAL + i, KOL.id).setValue(buatId());
      jumlah++;
    }
  });
  if (jumlah) pastikanHeaderId(sheet);
  return jumlah;
}

/* ---------- File JSON di folder Keuangan: Aset.json dan Harga Pasar.json ---------- */

function bacaFileJson(nama) {
  var files = DriveApp.getFolderById(FOLDER_ID).getFilesByName(nama);
  if (!files.hasNext()) return null;
  try {
    return JSON.parse(files.next().getBlob().getDataAsString());
  } catch (err) {
    return null;
  }
}

function tulisFileJson(nama, isi) {
  var teks = JSON.stringify(isi, null, 1);
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName(nama);
  if (files.hasNext()) files.next().setContent(teks);
  else folder.createFile(nama, teks, "application/json");
}

function bacaAset() {
  var isi = bacaFileJson(NAMA_FILE_ASET);
  return isi && Array.isArray(isi.aset) ? isi.aset : [];
}

var JENIS_ASET = { emas: 1, crypto: 1, jmo: 1, investasi: 1 };

function simpanAset(daftar) {
  if (!Array.isArray(daftar)) throw new Error("Daftar aset harus berupa array");
  if (daftar.length > 200) throw new Error("Terlalu banyak aset (maks 200)");
  var bersih = daftar
    .filter(function (a) {
      return a && typeof a === "object" && JENIS_ASET[a.jenis] && String(a.nama || "").trim();
    })
    .map(function (a) {
      var salinan = {};
      Object.keys(a).forEach(function (k) {
        var v = a[k];
        if (typeof v === "string") salinan[k] = v.trim().slice(0, 200);
        else if (typeof v === "number" && isFinite(v)) salinan[k] = v;
        else if (typeof v === "boolean") salinan[k] = v;
      });
      return salinan;
    });
  tulisFileJson(NAMA_FILE_ASET, { aset: bersih, diperbarui: new Date().toISOString() });
  return bersih.length;
}

/* ---------- Harga pasar ---------- */

// Mengembalikan harga tersimpan; mengambil ulang bila dipaksa atau lebih tua dari HARGA_SEGAR_MENIT.
function perbaruiHarga(paksa) {
  var lama = bacaFileJson(NAMA_FILE_HARGA) || {};
  var umur = Date.now() - (Date.parse(lama.waktu || "") || 0);
  if (!paksa && umur < HARGA_SEGAR_MENIT * 60000) return lama;

  var baru = { waktu: new Date().toISOString(), emas: lama.emas || null, crypto: lama.crypto || {}, manual: lama.manual || null, catatan: [] };
  try {
    var emas = ambilHargaEmas();
    if (emas) baru.emas = emas;
    else baru.catatan.push("Harga emas tidak terbaca dari sumber; memakai nilai sebelumnya.");
  } catch (err) {
    baru.catatan.push("Emas: " + String((err && err.message) || err));
  }
  try {
    var koin = KOIN_DEFAULT.slice();
    bacaAset().forEach(function (a) {
      if (a.jenis === "crypto" && a.koin && koin.indexOf(String(a.koin).toLowerCase()) < 0) koin.push(String(a.koin).toLowerCase());
    });
    var kripto = ambilHargaCrypto(koin);
    Object.keys(kripto).forEach(function (id) {
      baru.crypto[id] = kripto[id];
    });
  } catch (err) {
    baru.catatan.push("Kripto: " + String((err && err.message) || err));
  }
  tulisFileJson(NAMA_FILE_HARGA, baru);
  return baru;
}

// Mencoba setiap sumber sampai harga 1 gram terbaca. Halaman HTML-nya bisa berubah sewaktu-waktu,
// jadi pembacaannya longgar: cari "1 gram/gr" lalu angka rupiah pertama sesudahnya.
function ambilHargaEmas() {
  for (var i = 0; i < SUMBER_EMAS.length; i++) {
    var respons = UrlFetchApp.fetch(SUMBER_EMAS[i].url, { muteHttpExceptions: true, followRedirects: true });
    if (respons.getResponseCode() !== 200) continue;
    var hasil = parseHargaEmas(respons.getContentText());
    if (hasil) {
      hasil.sumber = SUMBER_EMAS[i].nama;
      hasil.waktu = new Date().toISOString();
      return hasil;
    }
  }
  return null;
}

function parseHargaEmas(html) {
  var teks = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  var jual = cariRupiahSetelah(teks, /(?:^|[^\d,.])1(?:[.,]0+)?\s*(?:gr|gram)\b/i);
  if (!jual) return null;
  var buyback = cariRupiahSetelah(teks, /buy\s*back|harga\s+beli\s+kembali/i);
  // Harga 1 gram emas Antam berada di kisaran ratusan ribu sampai beberapa juta rupiah.
  if (jual < 300000 || jual > 20000000) return null;
  return { jual: jual, buyback: buyback && buyback < jual ? buyback : null };
}

function cariRupiahSetelah(teks, polaAwal) {
  var m = teks.match(polaAwal);
  if (!m) return null;
  var sisa = teks.slice(m.index + m[0].length, m.index + m[0].length + 160);
  var angka = sisa.match(/(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3}){1,3}|\d{6,9})(?![\d])/);
  if (!angka) return null;
  var nilai = Number(angka[1].replace(/[.,]/g, ""));
  return nilai > 0 ? nilai : null;
}

function ambilHargaCrypto(ids) {
  if (!ids.length) return {};
  var respons = UrlFetchApp.fetch(URL_COINGECKO + encodeURIComponent(ids.join(",")), { muteHttpExceptions: true });
  if (respons.getResponseCode() !== 200) throw new Error("CoinGecko menjawab " + respons.getResponseCode());
  var json = JSON.parse(respons.getContentText());
  var hasil = {};
  Object.keys(json).forEach(function (id) {
    var v = json[id];
    if (v && typeof v.idr === "number") {
      hasil[id] = { idr: v.idr, perubahan24: typeof v.idr_24h_change === "number" ? v.idr_24h_change : null, waktu: new Date().toISOString() };
    }
  });
  return hasil;
}
