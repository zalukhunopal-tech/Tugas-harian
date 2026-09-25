const STORAGE_KEY = "pengeluaran-harian";
const BUDGET_KEY = "pengeluaran-harian-anggaran";
const TEMA_KEY = "keuangan-tema";
const KARAKTER_KEY = "keuangan-karakter";
const SYNC_URL_KEY = "keuangan-sync-url";
const SYNC_QUEUE_KEY = "keuangan-sync-antrean";
const SYNC_TIME_KEY = "keuangan-sync-terakhir";

// Kategori ditulis persis seperti panel rekap di sheet Keuangan Pribadi / Keuangan Kegiatan,
// karena rekap per kategori di sheet dihitung dengan SUMIF atas nama kategori.
const KATEGORI = {
  "Dana Pribadi": {
    pemasukan: ["Pemasukan Gaji", "Pemasukan Lain"],
    pengeluaran: [
      "Makan & Minum",
      "Transportasi",
      "Belanja Harian",
      "Pulsa & Internet",
      "Tagihan & Sewa",
      "Keluarga",
      "Tabungan",
      "Hiburan",
      "Lain-lain",
    ],
  },
  "Dana Kegiatan": {
    pemasukan: ["Penerimaan Dana"],
    pengeluaran: [
      "Transportasi & BBM",
      "Konsumsi",
      "Akomodasi",
      "Honor & Upah Lokal",
      "Logistik & Perlengkapan",
      "ATK & Cetak",
      "Komunikasi & Pulsa",
      "Perizinan & Administrasi",
      "Lain-lain",
    ],
  },
};
const DANA_DEFAULT = "Dana Pribadi";
const KAITAN = {
  "Dana Pribadi": { label: "Sumber / Tujuan", placeholder: "Contoh: Warung Bu Sri - Tanjung Selor" },
  "Dana Kegiatan": { label: "Kaitan Kegiatan", placeholder: "Contoh: Perjalanan Tanjung Selor - Malinau" },
};

const KARAKTER = {
  gojo: {
    nama: "Gojo Satoru",
    lambang: "無",
    tagline: "無下限呪術 · Tanpa Batas. Saldo tak terhingga? Sayangnya tidak.",
  },
  sukuna: {
    nama: "Ryomen Sukuna",
    lambang: "宿",
    tagline: "呪いの王 · Raja Kutukan. Setiap pengeluaran adalah tebasan.",
  },
  jogo: {
    nama: "Jogo",
    lambang: "火",
    tagline: "蓋棺鉄囲山 · Jangan biarkan anggaran meletus.",
  },
  nanami: {
    nama: "Nanami Kento",
    lambang: "七",
    tagline: "十劃呪法 · Rasio 7:3. Kerja lembur tidak dibayar.",
  },
};

const form = document.getElementById("form-transaksi");
const judulForm = document.getElementById("judul-form");
const kartuForm = document.getElementById("kartu-form");
const radioJenis = form.elements.jenis;
const inputDana = document.getElementById("dana");
const inputTanggal = document.getElementById("tanggal");
const inputDeskripsi = document.getElementById("deskripsi");
const inputKategori = document.getElementById("kategori");
const inputJumlah = document.getElementById("jumlah");
const inputMetode = document.getElementById("metode");
const inputKaitan = document.getElementById("kaitan");
const labelKaitan = document.getElementById("label-kaitan");
const inputCatatan = document.getElementById("catatan");
const btnSimpan = document.getElementById("btn-simpan");
const btnBatal = document.getElementById("btn-batal");
const filterTanggal = document.getElementById("filter-tanggal");
const filterDana = document.getElementById("filter-dana");
const daftar = document.getElementById("daftar");
const kosong = document.getElementById("kosong");
const labelMasukHari = document.getElementById("label-masuk-hari");
const labelKeluarHari = document.getElementById("label-keluar-hari");
const masukHari = document.getElementById("masuk-hari");
const keluarHari = document.getElementById("keluar-hari");
const jumlahTransaksi = document.getElementById("jumlah-transaksi");
const hintDaftar = document.getElementById("hint-daftar");
const btnExport = document.getElementById("btn-export");
const formAnggaran = document.getElementById("form-anggaran");
const inputAnggaran = document.getElementById("anggaran");
const statusAnggaran = document.getElementById("status-anggaran");
const meterAnggaran = document.getElementById("meter-anggaran");
const teksAnggaran = document.getElementById("teks-anggaran");
const judulKategori = document.getElementById("judul-kategori");
const ringkasanKeluar = document.getElementById("ringkasan-keluar");
const keluarKosong = document.getElementById("keluar-kosong");
const ringkasanMasuk = document.getElementById("ringkasan-masuk");
const masukKosong = document.getElementById("masuk-kosong");
const kartuSaldo = document.querySelectorAll(".balance");
const folderDaftar = document.getElementById("folder-daftar");

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const namaBulan = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });

function hariIni() {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 10);
}

function bacaStorage(kunci, cadangan) {
  try {
    const nilai = localStorage.getItem(kunci);
    return nilai === null ? cadangan : nilai;
  } catch {
    return cadangan;
  }
}

function tulisStorage(kunci, nilai) {
  try {
    if (nilai === null || nilai === "" || nilai === undefined) localStorage.removeItem(kunci);
    else localStorage.setItem(kunci, nilai);
    return true;
  } catch {
    return false;
  }
}

// Entri lama (sebelum ada pemasukan, dana, dan kaitan) dianggap pengeluaran dari Dana Pribadi.
function normalisasi(p) {
  return { jenis: "pengeluaran", dana: DANA_DEFAULT, metode: "", kaitan: "", catatan: "", ...p };
}

function muatData() {
  try {
    return (JSON.parse(bacaStorage(STORAGE_KEY, "[]")) || []).map(normalisasi);
  } catch {
    return [];
  }
}

function simpanData(data) {
  if (!tulisStorage(STORAGE_KEY, JSON.stringify(data))) {
    alert("Gagal menyimpan data ke penyimpanan browser.");
  }
}

let transaksi = muatData();
let anggaran = Number(bacaStorage(BUDGET_KEY, "0")) || 0;
let editId = null;

function total(list, jenis) {
  return list.filter((p) => p.jenis === jenis).reduce((s, p) => s + p.jumlah, 0);
}

function jenisTerpilih() {
  return radioJenis.value;
}

function isiKategori(pilih) {
  const jenis = jenisTerpilih();
  const dana = inputDana.value;
  const daftarKategori = KATEGORI[dana][jenis];
  inputKategori.replaceChildren(
    ...daftarKategori.map((k) => {
      const opt = document.createElement("option");
      opt.textContent = k;
      return opt;
    })
  );
  if (pilih && !daftarKategori.includes(pilih)) {
    const opt = document.createElement("option");
    opt.textContent = pilih;
    inputKategori.append(opt);
  }
  if (pilih) inputKategori.value = pilih;
  inputDeskripsi.placeholder =
    jenis === "pemasukan"
      ? dana === "Dana Kegiatan"
        ? "Contoh: Penerimaan dana tahap 2"
        : "Contoh: Gaji bulan September"
      : dana === "Dana Kegiatan"
        ? "Contoh: Pembelian konsumsi rapat tim"
        : "Contoh: Pembelian makan siang";
  labelKaitan.textContent = KAITAN[dana].label;
  inputKaitan.placeholder = KAITAN[dana].placeholder;
}

function buatItem(p) {
  const masuk = p.jenis === "pemasukan";
  const li = document.createElement("li");
  li.className = "expense-item";
  if (p.id === editId) li.classList.add("editing");

  const info = document.createElement("div");
  info.className = "expense-info";
  const desc = document.createElement("div");
  desc.className = "expense-desc";
  const badge = document.createElement("span");
  badge.className = `badge ${masuk ? "badge-in" : "badge-out"}`;
  badge.textContent = masuk ? "Masuk" : "Keluar";
  desc.append(badge, document.createTextNode(p.deskripsi));
  const meta = document.createElement("div");
  meta.className = "expense-meta";
  meta.textContent = [p.kategori, p.dana, p.metode, p.kaitan].filter(Boolean).join(" · ");
  info.append(desc, meta);
  if (p.catatan) {
    const note = document.createElement("div");
    note.className = "expense-note";
    note.textContent = p.catatan;
    info.append(note);
  }

  const amount = document.createElement("span");
  amount.className = `expense-amount ${masuk ? "amount-in" : ""}`;
  amount.textContent = `${masuk ? "+" : "−"}${rupiah.format(p.jumlah)}`;

  const ubah = document.createElement("button");
  ubah.type = "button";
  ubah.className = "btn-small";
  ubah.textContent = "Ubah";
  ubah.addEventListener("click", () => mulaiEdit(p.id));

  const hapus = document.createElement("button");
  hapus.type = "button";
  hapus.className = "btn-small btn-delete";
  hapus.textContent = "Hapus";
  hapus.addEventListener("click", () => hapusTransaksi(p.id));

  if (p.tanpaId) {
    ubah.disabled = hapus.disabled = true;
    ubah.title = hapus.title =
      "Baris ini diketik langsung di sheet dan belum punya ID. Apps Script memberinya ID dalam ±1 menit; muat ulang dari Sheet untuk mengubahnya.";
  }

  const tombol = document.createElement("div");
  tombol.className = "expense-buttons";
  tombol.append(ubah, hapus);

  li.append(info, amount, tombol);
  return li;
}

function renderSaldo(bulan) {
  for (const kartu of kartuSaldo) {
    const milikDana = transaksi.filter((p) => p.dana === kartu.dataset.dana);
    const saldo = total(milikDana, "pemasukan") - total(milikDana, "pengeluaran");
    const bulanItu = milikDana.filter((p) => p.tanggal.startsWith(bulan));
    const nilai = kartu.querySelector(".balance-value");
    nilai.textContent = rupiah.format(saldo);
    nilai.classList.toggle("negative", saldo < 0);
    kartu.querySelector(".balance-flow").textContent =
      `${namaBulan.format(new Date(`${bulan}-01T00:00`))}: masuk ${rupiah.format(total(bulanItu, "pemasukan"))}` +
      ` · keluar ${rupiah.format(total(bulanItu, "pengeluaran"))}`;
  }
}

function renderAnggaran(keluarTanggal) {
  inputAnggaran.value = anggaran || "";
  statusAnggaran.hidden = !anggaran;
  if (!anggaran) return;

  const persen = (keluarTanggal / anggaran) * 100;
  const lebih = keluarTanggal > anggaran;
  meterAnggaran.style.width = `${Math.min(persen, 100)}%`;
  statusAnggaran.querySelector(".meter").setAttribute("aria-valuenow", Math.round(persen));
  statusAnggaran.classList.toggle("over", lebih);

  teksAnggaran.textContent = lebih
    ? `⚠ Melebihi anggaran ${rupiah.format(keluarTanggal - anggaran)} (${Math.round(persen)}% dari ${rupiah.format(anggaran)})`
    : `Sisa anggaran ${rupiah.format(anggaran - keluarTanggal)} (terpakai ${Math.round(persen)}% dari ${rupiah.format(anggaran)})`;
}

function renderDaftarKategori(list, wadah, pesanKosong) {
  const perKategori = new Map();
  for (const p of list) {
    perKategori.set(p.kategori, (perKategori.get(p.kategori) || 0) + p.jumlah);
  }
  const baris = [...perKategori].sort((a, b) => b[1] - a[1]);
  const totalSemua = list.reduce((s, p) => s + p.jumlah, 0);
  const maks = baris.length ? baris[0][1] : 0;

  wadah.replaceChildren(
    ...baris.map(([nama, jumlah]) => {
      const persen = totalSemua ? Math.round((jumlah / totalSemua) * 100) : 0;
      const li = document.createElement("li");
      li.className = "category-row";
      li.title = `${nama}: ${rupiah.format(jumlah)} (${persen}% dari total bulan ini)`;

      const label = document.createElement("span");
      label.className = "category-name";
      label.textContent = nama;

      const nilai = document.createElement("span");
      nilai.className = "category-value";
      nilai.textContent = `${rupiah.format(jumlah)} · ${persen}%`;

      const bar = document.createElement("div");
      bar.className = "category-bar";
      const fill = document.createElement("div");
      fill.className = "category-fill";
      fill.style.width = `${maks ? (jumlah / maks) * 100 : 0}%`;
      bar.append(fill);

      li.append(label, nilai, bar);
      return li;
    })
  );
  pesanKosong.hidden = baris.length > 0;
}

function render() {
  const tanggal = filterTanggal.value;
  const bulan = tanggal.slice(0, 7);
  const dana = filterDana.value;

  const terfilter = dana ? transaksi.filter((p) => p.dana === dana) : transaksi;
  const hariItu = terfilter.filter((p) => p.tanggal === tanggal);
  const bulanItu = terfilter.filter((p) => p.tanggal.startsWith(bulan));
  const keluarTanggal = total(hariItu, "pengeluaran");

  const kataHari = tanggal === hariIni() ? "hari ini" : "tanggal ini";
  labelMasukHari.textContent = `Pemasukan ${kataHari}`;
  labelKeluarHari.textContent = `Pengeluaran ${kataHari}`;
  masukHari.textContent = rupiah.format(total(hariItu, "pemasukan"));
  keluarHari.textContent = rupiah.format(keluarTanggal);
  jumlahTransaksi.textContent = hariItu.length;
  hintDaftar.textContent = `${hariItu.length} transaksi ${kataHari} · ${transaksi.length} total`;

  daftar.replaceChildren(...hariItu.map(buatItem));
  kosong.hidden = hariItu.length > 0;

  renderSaldo(bulan);
  renderAnggaran(keluarTanggal);

  judulKategori.textContent =
    `Ringkasan per Kategori — ${namaBulan.format(new Date(`${bulan}-01T00:00`))}` + (dana ? ` · ${dana}` : "");
  renderDaftarKategori(bulanItu.filter((p) => p.jenis === "pengeluaran"), ringkasanKeluar, keluarKosong);
  renderDaftarKategori(bulanItu.filter((p) => p.jenis === "pemasukan"), ringkasanMasuk, masukKosong);
}

function resetForm() {
  editId = null;
  judulForm.textContent = "Tambah Transaksi";
  btnSimpan.textContent = "Simpan";
  btnBatal.hidden = true;
  inputDeskripsi.value = "";
  inputJumlah.value = "";
  inputKaitan.value = "";
  inputCatatan.value = "";
}

function mulaiEdit(id) {
  const p = transaksi.find((x) => x.id === id);
  if (!p) return;
  editId = id;
  radioJenis.value = p.jenis;
  inputDana.value = p.dana;
  isiKategori(p.kategori);
  inputTanggal.value = p.tanggal;
  inputDeskripsi.value = p.deskripsi;
  inputJumlah.value = p.jumlah;
  inputMetode.value = p.metode || "";
  if (inputMetode.value !== (p.metode || "")) {
    const opt = document.createElement("option");
    opt.textContent = p.metode;
    inputMetode.append(opt);
    inputMetode.value = p.metode;
  }
  inputKaitan.value = p.kaitan || "";
  inputCatatan.value = p.catatan || "";
  judulForm.textContent = "Ubah Transaksi";
  btnSimpan.textContent = "Perbarui";
  btnBatal.hidden = false;
  kartuForm.scrollIntoView({ behavior: "smooth" });
  inputDeskripsi.focus({ preventScroll: true });
  render();
}

function hapusTransaksi(id) {
  if (!confirm("Hapus transaksi ini? Baris di Google Sheets juga akan dihapus bila sinkronisasi aktif.")) return;
  transaksi = transaksi.filter((p) => p.id !== id);
  simpanData(transaksi);
  if (editId === id) resetForm();
  antre({ action: "delete", id });
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const jumlah = Math.round(Number(inputJumlah.value));
  const deskripsi = inputDeskripsi.value.trim();
  if (!deskripsi || !(jumlah > 0)) return;

  const data = {
    jenis: jenisTerpilih(),
    dana: inputDana.value,
    tanggal: inputTanggal.value,
    deskripsi,
    kategori: inputKategori.value,
    jumlah,
    metode: inputMetode.value,
    kaitan: inputKaitan.value.trim(),
    catatan: inputCatatan.value.trim(),
  };

  let tersimpan;
  if (editId) {
    transaksi = transaksi.map((p) => (p.id === editId ? { ...p, ...data } : p));
    tersimpan = transaksi.find((p) => p.id === editId);
  } else {
    tersimpan = { id: buatId(), ...data };
    transaksi.push(tersimpan);
  }
  simpanData(transaksi);
  antre({ action: "upsert", transaksi: tersimpan });

  filterTanggal.value = data.tanggal;
  if (filterDana.value && filterDana.value !== data.dana) filterDana.value = "";
  resetForm();
  isiKategori();
  inputDeskripsi.focus();
  render();
  pulsaSimpan();
});

function buatId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

for (const radio of radioJenis) {
  radio.addEventListener("change", () => isiKategori());
}
inputDana.addEventListener("change", () => isiKategori());

btnBatal.addEventListener("click", () => {
  resetForm();
  isiKategori();
  render();
});

formAnggaran.addEventListener("submit", (e) => {
  e.preventDefault();
  const nilai = Math.round(Number(inputAnggaran.value));
  anggaran = nilai > 0 ? nilai : 0;
  tulisStorage(BUDGET_KEY, anggaran ? String(anggaran) : null);
  render();
});

filterTanggal.addEventListener("change", () => {
  if (!filterTanggal.value) filterTanggal.value = hariIni();
  render();
});

filterDana.addEventListener("change", render);

btnExport.addEventListener("click", () => {
  if (transaksi.length === 0) {
    alert("Belum ada data untuk diunduh.");
    return;
  }
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const baris = [
    ["Tanggal", "Jenis", "Dana", "Uraian", "Kategori", "Metode Bayar", "Jumlah", "Sumber/Tujuan atau Kaitan Kegiatan", "Catatan"],
    ...[...transaksi]
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map((p) => [
        p.tanggal,
        p.jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran",
        p.dana,
        p.deskripsi,
        p.kategori,
        p.metode || "",
        p.jumlah,
        p.kaitan || "",
        p.catatan || "",
      ]),
  ];
  const csv = baris.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `keuangan-${hariIni()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ---------- Sinkronisasi Google Sheets ---------- */
// Dua jalur:
// - "url": halaman biasa (GitHub Pages / file lokal) memanggil Web App Apps Script secara langsung.
// - "konektor": halaman artifact Claude tidak boleh menghubungi situs luar, jadi ia membaca sheet dan
//   menaruh file antrean lewat konektor Google Drive akun Claude; Apps Script (prosesAntreanDrive)
//   memasukkan antrean itu ke sheet setiap menit.

const FOLDER_KEUANGAN = "1zRqAgxStMdx3Ksm_K1R8R_pec_pMg6qf";
const NAMA_FOLDER_ANTREAN = "Antrean Sinkron";
const SERVER_DRIVE = "Google Drive";
const NAMA_SHEET = { "Dana Pribadi": "Keuangan Pribadi", "Dana Kegiatan": "Keuangan Kegiatan" };
const SYNC_SENT_KEY = "keuangan-sync-terkirim";
// Perubahan yang sudah ditaruh di antrean Drive tetap ditampilkan sampai terlihat di sheet,
// paling lama selama ini (bila Apps Script tidak memprosesnya, ia berhenti ditimpakan).
const BATAS_TERKIRIM = 15 * 60 * 1000;

const formSync = document.getElementById("form-sync");
const inputSyncUrl = document.getElementById("sync-url");
const btnTarik = document.getElementById("btn-tarik");
const btnKirimSemua = document.getElementById("btn-kirim-semua");
const btnPutus = document.getElementById("btn-putus");
const syncStatus = document.getElementById("sync-status");
const syncDetail = document.getElementById("sync-detail");
const hintSync = document.getElementById("hint-sync");
const modeKonektorEl = document.getElementById("mode-konektor");
const peringatanArtifact = document.getElementById("peringatan-artifact");

let syncUrl = bacaStorage(SYNC_URL_KEY, "");
let konektor = null;
let cacheDrive = null;
let timerMuatUlang = null;
let antrean = bacaJsonStorage(SYNC_QUEUE_KEY);
let terkirim = bacaJsonStorage(SYNC_SENT_KEY);
let sedangSync = false;

function bacaJsonStorage(kunci) {
  try {
    const nilai = JSON.parse(bacaStorage(kunci, "[]"));
    return Array.isArray(nilai) ? nilai : [];
  } catch {
    return [];
  }
}

function simpanAntrean() {
  tulisStorage(SYNC_QUEUE_KEY, antrean.length ? JSON.stringify(antrean) : null);
}

function simpanTerkirim() {
  tulisStorage(SYNC_SENT_KEY, terkirim.length ? JSON.stringify(terkirim) : null);
}

const ALAMAT_PAGES = "https://zalukhunopal-tech.github.io/Tugas-harian/pengeluaran/";

// Halaman artifact Claude berjalan di sandbox yang tidak boleh menghubungi situs luar;
// runtime-nya menyediakan window.claude.use.
function diArtifact() {
  return typeof window.claude === "object" && window.claude !== null && typeof window.claude.use === "function";
}

function modeSync() {
  if (konektor) return "konektor";
  if (syncUrl && !diArtifact()) return "url";
  return null;
}

function setStatusSync(teks, keadaan) {
  syncStatus.hidden = !modeSync();
  syncStatus.textContent = teks;
  syncStatus.dataset.keadaan = keadaan;
  // Keterangan folder dibuat ringkas; pesan lengkap ada di label status di atas form.
  const ringkas = { gagal: "gagal — buka untuk detail", kerja: "menyinkronkan…" };
  hintSync.textContent = modeSync() ? ringkas[keadaan] || teks : "belum terhubung";
}

function statusIdle() {
  const mode = modeSync();
  if (!mode) return setStatusSync("Belum terhubung ke Google Sheets", "off");
  if (antrean.length) return setStatusSync(`${antrean.length} perubahan menunggu dikirim`, "tunggu");
  if (mode === "konektor" && terkirim.length) {
    return setStatusSync(`${terkirim.length} perubahan menunggu dimasukkan Apps Script ke sheet`, "tunggu");
  }
  const terakhir = bacaStorage(SYNC_TIME_KEY, "");
  setStatusSync(terakhir ? `Tersinkron dengan Google Sheets · ${terakhir}` : "Terhubung ke Google Sheets", "ok");
}

/* --- Jalur "url": Web App Apps Script --- */

async function bacaJson(respons) {
  const teks = await respons.text();
  try {
    return JSON.parse(teks);
  } catch {
    throw new Error("Balasan bukan JSON. Pastikan URL berakhiran /exec dan akses Web App diatur ke 'Anyone'.");
  }
}

// fetch hanya menolak (TypeError "Failed to fetch") bila browser memblokir permintaannya,
// jadi pesan aslinya diganti penjelasan yang bisa ditindaklanjuti.
async function fetchSheet(url, opsi) {
  try {
    return await fetch(url, opsi);
  } catch {
    if (diArtifact()) {
      throw new Error(`halaman artifact Claude tidak diizinkan menghubungi Google. Buka aplikasi dari ${ALAMAT_PAGES}`);
    }
    throw new Error(
      "browser tidak bisa menghubungi Apps Script. Periksa internet, pastikan URL berakhiran /exec " +
        "dan akses Web App 'Siapa saja' (Anyone). Uji dengan membuka URL itu + ?action=ping di tab baru."
    );
  }
}

async function kirimKeSheet(payload) {
  const respons = await fetchSheet(syncUrl, {
    method: "POST",
    // text/plain menghindari preflight CORS; Apps Script tetap membaca isinya sebagai teks.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const hasil = await bacaJson(respons);
  if (!hasil.ok) throw new Error(hasil.error || "Apps Script menolak permintaan");
  return hasil;
}

async function ambilDariSheet(action) {
  const pemisah = syncUrl.includes("?") ? "&" : "?";
  const respons = await fetchSheet(`${syncUrl}${pemisah}action=${action}`);
  const hasil = await bacaJson(respons);
  if (!hasil.ok) throw new Error(hasil.error || "Apps Script menolak permintaan");
  return hasil;
}

/* --- Jalur "konektor": Google Drive lewat halaman artifact Claude --- */

function pesanKonektor(err) {
  switch (err && err.code) {
    case "needs_reauth":
      return "sambungan Google Drive kedaluwarsa. Sambungkan ulang di claude.ai → Settings → Connectors.";
    case "server_not_connected":
    case "server_not_found":
      return "konektor Google Drive belum ada di akun Claude ini. Tambahkan di claude.ai → Settings → Connectors.";
    case "selection_required":
      return "ada lebih dari satu konektor Google Drive. Pilih salah satu saat diminta, lalu muat ulang.";
    case "not_in_manifest":
      return "izin Google Drive untuk halaman ini ditolak atau dimatikan. Aktifkan lagi dari pengaturan halaman, lalu muat ulang.";
    case "blocked_by_policy":
    case "approval_required":
      return "akses Google Drive diblokir kebijakan organisasi.";
    case "server_unavailable":
    case "rate_limited":
      return "Google Drive sedang tidak bisa dihubungi. Coba lagi sebentar lagi.";
    case "tool_error":
      return `Google Drive menolak permintaan: ${err.message}`;
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return "tampilan ini tidak diberi akses konektor Google Drive.";
    default:
      return (err && err.message) || "kesalahan tidak dikenal dari konektor Google Drive.";
  }
}

class GagalKonektor extends Error {
  constructor(err) {
    super(pesanKonektor(err));
    this.code = err && err.code;
  }
}

// Bacaan boleh diulang sekali bila konektor menandainya retryable; tulisan tidak diulang otomatis.
async function panggilDrive(tool, input, { baca = false } = {}) {
  try {
    return (await konektor.callTool(SERVER_DRIVE, tool, input, baca ? undefined : { cache: false })).payload;
  } catch (err) {
    if (!baca || !(err && err.retryable)) throw new GagalKonektor(err);
    await new Promise((r) => setTimeout(r, err.retryAfterMs || 1000 + Math.random() * 1500));
    try {
      return (await konektor.callTool(SERVER_DRIVE, tool, input)).payload;
    } catch (err2) {
      throw new GagalKonektor(err2);
    }
  }
}

// Pencarian judul di Drive bersifat longgar, jadi kecocokan judul diperiksa di sini.
async function cariDrive() {
  const hasil = await panggilDrive(
    "search_files",
    { query: `parentId = '${FOLDER_KEUANGAN}'`, excludeContentSnippets: true, pageSize: 100 },
    { baca: true }
  );
  const files = (hasil && hasil.files) || [];
  const sheet = {};
  for (const [dana, nama] of Object.entries(NAMA_SHEET)) {
    const cocok = files
      .filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet" && String(f.title || "").startsWith(nama))
      .sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")));
    if (!cocok.length) throw new Error(`sheet '${nama}' tidak ditemukan di folder Drive Keuangan.`);
    sheet[dana] = cocok[0].id;
  }
  const folder = files.find((f) => f.mimeType === "application/vnd.google-apps.folder" && f.title === NAMA_FOLDER_ANTREAN);
  cacheDrive = { sheet, folderAntrean: folder ? folder.id : null };
  return cacheDrive;
}

function dariBase64(b64) {
  const biner = atob(b64 || "");
  return new TextDecoder().decode(Uint8Array.from(biner, (c) => c.charCodeAt(0)));
}

function parseCsv(teks) {
  const hasil = [];
  let baris = [];
  let sel = "";
  let kutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c !== '"') sel += c;
      else if (teks[i + 1] === '"') {
        sel += '"';
        i++;
      } else kutip = false;
    } else if (c === '"') kutip = true;
    else if (c === ",") {
      baris.push(sel);
      sel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      baris.push(sel);
      hasil.push(baris);
      baris = [];
      sel = "";
    } else sel += c;
  }
  if (sel !== "" || baris.length) {
    baris.push(sel);
    hasil.push(baris);
  }
  return hasil;
}

// Tata letak sama dengan Code.gs: header di baris 6, data mulai baris 7, kolom A–J (indeks 0).
const KOL_SHEET = { tanggal: 1, uraian: 2, kategori: 3, pemasukan: 4, pengeluaran: 5, kaitan: 7, catatan: 8, id: 9 };
const BARIS_DATA_SHEET = 6;
const METODE_SHEET = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  "e-wallet": "E-wallet",
  ewallet: "E-wallet",
  "kartu debit/kredit": "Kartu debit/kredit",
};

function angkaSel(v) {
  const bersih = String(v || "").replace(/[^\d-]/g, "");
  return bersih ? Number(bersih) || 0 : 0;
}

function tanggalSel(v) {
  const s = String(v || "").trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : s;
}

function barisKeTransaksi(baris, dana) {
  const hasil = [];
  baris.slice(BARIS_DATA_SHEET).forEach((r, i) => {
    const sel = (k) => String(r[KOL_SHEET[k]] || "").trim();
    if (!sel("uraian")) return;
    const masuk = angkaSel(sel("pemasukan"));
    const keluar = angkaSel(sel("pengeluaran"));
    const kategori = sel("kategori");
    const jenis = masuk > 0 || (keluar === 0 && /pemasukan|penerimaan/i.test(kategori)) ? "pemasukan" : "pengeluaran";
    const catatanMentah = sel("catatan");
    const m = catatanMentah.match(/^Bayar\s+([^.]+)\.\s*/i);
    const metode = m ? METODE_SHEET[m[1].trim().toLowerCase()] || m[1].trim().replace(/^./, (h) => h.toUpperCase()) : "";
    const id = sel("id");
    hasil.push({
      // Baris yang diketik manual belum ber-ID sampai Apps Script memberinya; sementara tidak bisa diubah.
      id: id || `sheet-${dana === "Dana Kegiatan" ? "k" : "p"}-${BARIS_DATA_SHEET + i + 1}`,
      tanpaId: !id,
      dana,
      jenis,
      tanggal: tanggalSel(sel("tanggal")),
      deskripsi: sel("uraian"),
      kategori,
      jumlah: jenis === "pemasukan" ? masuk : keluar,
      metode,
      kaitan: sel("kaitan"),
      catatan: m ? catatanMentah.slice(m[0].length) : catatanMentah,
    });
  });
  return hasil;
}

async function bacaDrive() {
  const { sheet } = await cariDrive();
  const semua = [];
  for (const [dana, fileId] of Object.entries(sheet)) {
    const hasil = await panggilDrive("download_file_content", { fileId, exportMimeType: "text/csv" }, { baca: true });
    semua.push(...barisKeTransaksi(parseCsv(dariBase64(hasil && hasil.content)), dana));
  }
  return semua;
}

async function tulisDrive(op) {
  if (!cacheDrive || !cacheDrive.folderAntrean) await cariDrive();
  if (!cacheDrive.folderAntrean) {
    throw new Error(
      `folder '${NAMA_FOLDER_ANTREAN}' belum ada di folder Keuangan. Jalankan fungsi pasangPemicu sekali di editor Apps Script.`
    );
  }
  const idOp = op.action === "upsert" ? op.transaksi.id : op.id;
  await panggilDrive("create_file", {
    title: `op-${Date.now()}-${op.action}-${idOp}.json`,
    parentId: cacheDrive.folderAntrean,
    textContent: JSON.stringify({ ...op, dibuat: new Date().toISOString() }),
    contentMimeType: "application/json",
    disableConversionToGoogleType: true,
  });
}

// Setelah file antrean terkirim, sheet dibaca ulang saat Apps Script kemungkinan sudah memprosesnya.
function jadwalkanMuatUlang() {
  clearTimeout(timerMuatUlang);
  timerMuatUlang = setTimeout(() => {
    if (modeSync() === "konektor" && !sedangSync) tarikDariSheet();
  }, 75000);
}

/* --- Antrean bersama kedua jalur --- */

function idDariOp(op) {
  return op.action === "upsert" ? op.transaksi.id : op.id;
}

function antre(op) {
  if (!modeSync()) return;
  if (op.action === "upsert") {
    const { tanpaId, ...bersih } = op.transaksi;
    op = { action: "upsert", transaksi: bersih };
  }
  // Perubahan terbaru untuk id yang sama menggantikan yang lama supaya antrean tetap ringkas.
  antrean = antrean.filter((x) => idDariOp(x) !== idDariOp(op));
  antrean.push(op);
  simpanAntrean();
  prosesAntrean();
}

async function kirimOp(op) {
  if (modeSync() === "konektor") {
    await tulisDrive(op);
    terkirim = terkirim.filter((t) => idDariOp(t.op) !== idDariOp(op));
    terkirim.push({ op, waktu: Date.now() });
    simpanTerkirim();
  } else {
    await kirimKeSheet(op);
  }
}

async function prosesAntrean() {
  if (!modeSync() || sedangSync || antrean.length === 0) return;
  sedangSync = true;
  setStatusSync(`Mengirim ${antrean.length} perubahan ke Google Sheets…`, "kerja");
  try {
    while (antrean.length) {
      await kirimOp(antrean[0]);
      antrean.shift();
      simpanAntrean();
    }
    tulisStorage(SYNC_TIME_KEY, waktuSekarang());
    statusIdle();
    if (modeSync() === "konektor") jadwalkanMuatUlang();
  } catch (err) {
    setStatusSync(`Gagal mengirim (${antrean.length} menunggu): ${err.message}`, "gagal");
  } finally {
    sedangSync = false;
  }
}

function tercermin(op, dariSheet) {
  if (op.action === "delete") return !dariSheet.some((p) => p.id === op.id);
  const t = op.transaksi;
  const p = dariSheet.find((x) => x.id === t.id);
  return (
    !!p &&
    p.dana === t.dana &&
    p.jenis === t.jenis &&
    p.tanggal === t.tanggal &&
    p.deskripsi === t.deskripsi &&
    p.kategori === t.kategori &&
    p.jumlah === t.jumlah &&
    (p.kaitan || "") === (t.kaitan || "")
  );
}

function terapkanOpLokal(daftarTx, op) {
  if (op.action === "delete") return daftarTx.filter((p) => p.id !== op.id);
  const ada = daftarTx.some((p) => p.id === op.transaksi.id);
  return ada ? daftarTx.map((p) => (p.id === op.transaksi.id ? normalisasi(op.transaksi) : p)) : [...daftarTx, normalisasi(op.transaksi)];
}

// Perubahan yang belum terkirim, atau sudah di antrean Drive tapi belum dimasukkan Apps Script,
// ditimpakan di atas isi sheet supaya tidak hilang dari layar selama menunggu.
function gabungDenganPerubahanLokal(dariSheet) {
  terkirim = terkirim.filter((t) => Date.now() - t.waktu < BATAS_TERKIRIM && !tercermin(t.op, dariSheet));
  simpanTerkirim();
  return [...terkirim.map((t) => t.op), ...antrean].reduce(terapkanOpLokal, dariSheet);
}

async function tarikDariSheet() {
  const mode = modeSync();
  if (!mode) return false;
  if (mode === "url" && antrean.length) {
    await prosesAntrean();
    if (antrean.length) return false;
  }
  setStatusSync("Menarik data dari Google Sheets…", "kerja");
  try {
    const dariSheet = mode === "konektor" ? await bacaDrive() : (await ambilDariSheet("list")).transaksi;
    transaksi = gabungDenganPerubahanLokal(dariSheet.map(normalisasi));
    simpanData(transaksi);
    tulisStorage(SYNC_TIME_KEY, waktuSekarang());
    statusIdle();
    render();
    return true;
  } catch (err) {
    setStatusSync(`Gagal menarik data: ${err.message}`, "gagal");
    return false;
  }
}

function waktuSekarang() {
  return new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

async function tombolTarik() {
  if (!modeSync()) {
    syncDetail.textContent = "Simpan URL Web App dulu.";
    return;
  }
  if (!confirm("Data di browser ini akan diganti dengan isi Google Sheets. Lanjutkan?")) return;
  const ok = await tarikDariSheet();
  syncDetail.textContent = ok ? `Berhasil menarik ${transaksi.length} transaksi dari sheet.` : syncStatus.textContent;
}

function tombolKirimSemua() {
  if (!modeSync()) {
    syncDetail.textContent = "Simpan URL Web App dulu.";
    return;
  }
  const kirim = transaksi.filter((p) => !p.tanpaId);
  if (!kirim.length) {
    syncDetail.textContent = "Tidak ada data lokal untuk dikirim.";
    return;
  }
  if (!confirm(`Kirim ${kirim.length} transaksi lokal ke Google Sheets? Baris yang sudah ada (id sama) diperbarui, sisanya ditambahkan.`)) return;
  for (const p of kirim) antre({ action: "upsert", transaksi: p });
  syncDetail.textContent = `${kirim.length} transaksi dimasukkan ke antrean pengiriman.`;
}

formSync.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = inputSyncUrl.value.trim();
  if (!url) return;
  syncDetail.textContent = "Menguji koneksi…";
  syncUrl = url;
  try {
    const hasil = await ambilDariSheet("ping");
    tulisStorage(SYNC_URL_KEY, url);
    syncDetail.textContent = `Terhubung. Sheet yang dipakai: ${(hasil.sheets || []).join(" dan ")}.`;
    await tarikDariSheet();
  } catch (err) {
    syncUrl = bacaStorage(SYNC_URL_KEY, "");
    syncDetail.textContent = `Koneksi gagal: ${err.message}`;
    statusIdle();
  }
});

btnTarik.addEventListener("click", tombolTarik);
btnKirimSemua.addEventListener("click", tombolKirimSemua);
document.getElementById("btn-muat-drive").addEventListener("click", tombolTarik);
document.getElementById("btn-kirim-semua-drive").addEventListener("click", tombolKirimSemua);
document.getElementById("btn-kirim-ulang").addEventListener("click", async () => {
  if (!antrean.length) {
    syncDetail.textContent = "Tidak ada perubahan yang menunggu dikirim.";
    return;
  }
  await prosesAntrean();
  syncDetail.textContent = antrean.length ? syncStatus.textContent : "Antrean terkirim.";
});

btnPutus.addEventListener("click", () => {
  if (!confirm("Putuskan sinkronisasi? Data di browser tetap ada, hanya tidak dikirim ke sheet lagi.")) return;
  syncUrl = "";
  antrean = [];
  tulisStorage(SYNC_URL_KEY, null);
  simpanAntrean();
  tulisStorage(SYNC_TIME_KEY, null);
  inputSyncUrl.value = "";
  syncDetail.textContent = "Sinkronisasi diputus.";
  statusIdle();
});

// Di halaman artifact, sinkronisasi memakai konektor Google Drive bila tampilan ini mengizinkannya.
async function mulaiSinkron() {
  if (!diArtifact()) {
    if (syncUrl) tarikDariSheet();
    return;
  }
  formSync.hidden = true;
  let mcp = null;
  try {
    mcp = await window.claude.use("mcp");
  } catch {
    mcp = null;
  }
  if (!mcp) {
    peringatanArtifact.hidden = false;
    statusIdle();
    return;
  }
  konektor = mcp;
  modeKonektorEl.hidden = false;
  statusIdle();
  // Perubahan yang tertinggal tidak dikirim otomatis saat halaman dibuka (itu tulisan tanpa aksi
  // pengguna); tombol "Kirim ulang antrean" atau simpan transaksi berikutnya akan mengirimnya.
  tarikDariSheet();
}

// Salin kode Apps Script sekaligus supaya tidak terpotong saat diseleksi manual di HP.
const KODE_GS_URL = [
  "apps-script/Code.gs",
  "https://raw.githubusercontent.com/zalukhunopal-tech/Tugas-harian/main/pengeluaran/apps-script/Code.gs",
];
const btnSalinKode = document.getElementById("btn-salin-kode");
const infoSalin = document.getElementById("info-salin");
const kodeGsArea = document.getElementById("kode-gs");
const jumlahBarisKode = document.getElementById("jumlah-baris-kode");
let kodeGs = "";
let muatKodeGs = null;

function ambilKodeGs() {
  if (!muatKodeGs) {
    muatKodeGs = (async () => {
      for (const url of KODE_GS_URL) {
        try {
          const respons = await fetch(url, { cache: "no-cache" });
          const teks = respons.ok ? await respons.text() : "";
          if (teks.includes("function doGet") && teks.includes("function doPost")) {
            kodeGs = teks.replace(/\s+$/, "") + "\n";
            jumlahBarisKode.textContent = kodeGs.split("\n").length - 1;
            return kodeGs;
          }
        } catch {}
      }
      muatKodeGs = null;
      return "";
    })();
  }
  return muatKodeGs;
}

function tampilkanKodeManual() {
  kodeGsArea.value = kodeGs;
  kodeGsArea.hidden = false;
  kodeGsArea.focus();
  kodeGsArea.select();
}

btnSalinKode.addEventListener("click", async () => {
  if (!kodeGs) {
    infoSalin.textContent = "Mengambil kode…";
    await ambilKodeGs();
  }
  if (!kodeGs) {
    infoSalin.textContent =
      "Kode tidak bisa diambil (periksa koneksi). Buka file pengeluaran/apps-script/Code.gs di GitHub, tombol Raw, lalu salin semuanya.";
    return;
  }
  const baris = kodeGs.split("\n").length - 1;
  try {
    await navigator.clipboard.writeText(kodeGs);
    kodeGsArea.hidden = true;
    infoSalin.textContent = `✓ ${baris} baris tersalin. Di Kode.gs: pilih semua, hapus, tempel, lalu simpan.`;
  } catch {
    tampilkanKodeManual();
    const ok = (() => {
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      }
    })();
    infoSalin.textContent = ok
      ? `✓ ${baris} baris tersalin. Di Kode.gs: pilih semua, hapus, tempel, lalu simpan.`
      : `Browser tidak mengizinkan salin otomatis. Kode lengkap (${baris} baris) ada di kotak di bawah: pilih semua lalu salin.`;
  }
});

// Ambil kodenya saat folder dibuka supaya salinan ke clipboard langsung terjadi saat tombol ditekan
// (beberapa browser HP menolak menyalin bila ada jeda menunggu jaringan).
document.getElementById("folder-sync").addEventListener("toggle", (e) => {
  if (e.target.open) ambilKodeGs();
});

// Kirim ulang otomatis hanya untuk jalur Web App; di jalur konektor tulisan hanya terjadi
// karena aksi pengguna.
window.addEventListener("online", () => {
  if (modeSync() === "url") prosesAntrean();
});
setInterval(() => {
  if (modeSync() === "url" && antrean.length) prosesAntrean();
}, 60000);

/* ---------- Tema, karakter, dan perluasan domain ---------- */

const btnTema = document.getElementById("btn-tema");
const btnDomain = document.getElementById("btn-domain");
const hanko = document.getElementById("hanko");
const tagline = document.getElementById("tagline");
const hintTema = document.getElementById("hint-tema");
const energi = document.getElementById("energi");
const pulsa = document.getElementById("pulsa");
const tombolKarakter = document.querySelectorAll(".karakter");

function terapkanTema(tema) {
  document.documentElement.dataset.tema = tema;
  btnTema.textContent = tema === "jujutsu" ? "Tema standar" : "Tema Jujutsu";
  btnDomain.hidden = tema !== "jujutsu";
  perbaruiHintTema();
}

function terapkanKarakter(kunci) {
  const k = KARAKTER[kunci] || KARAKTER.gojo;
  document.documentElement.dataset.karakter = kunci;
  hanko.textContent = k.lambang;
  tagline.textContent = k.tagline;
  for (const tombol of tombolKarakter) {
    tombol.setAttribute("aria-checked", String(tombol.dataset.karakter === kunci));
  }
  perbaruiHintTema();
}

function perbaruiHintTema() {
  const k = KARAKTER[document.documentElement.dataset.karakter] || KARAKTER.gojo;
  hintTema.textContent = document.documentElement.dataset.tema === "jujutsu" ? `Jujutsu · ${k.nama}` : "Standar";
}

btnTema.addEventListener("click", () => {
  const tema = document.documentElement.dataset.tema === "jujutsu" ? "standar" : "jujutsu";
  terapkanTema(tema);
  tulisStorage(TEMA_KEY, tema);
});

for (const tombol of tombolKarakter) {
  tombol.addEventListener("click", () => {
    terapkanKarakter(tombol.dataset.karakter);
    tulisStorage(KARAKTER_KEY, tombol.dataset.karakter);
    if (document.documentElement.dataset.tema === "jujutsu") perluasanDomain(tombol.dataset.karakter);
  });
}

btnDomain.addEventListener("click", () => perluasanDomain(document.documentElement.dataset.karakter));

// Denyut singkat bernuansa karakter saat transaksi tersimpan.
function pulsaSimpan() {
  if (document.documentElement.dataset.tema !== "jujutsu") return;
  pulsa.classList.remove("aktif");
  void pulsa.offsetWidth;
  pulsa.classList.add("aktif");
}

// Partikel "energi kutukan" yang melayang naik di latar tema Jujutsu.
for (let i = 0; i < 18; i++) {
  const partikel = document.createElement("span");
  partikel.className = i % 3 === 0 ? "partikel sekunder" : "partikel";
  partikel.style.setProperty("--x", `${Math.random() * 100}vw`);
  partikel.style.setProperty("--ukuran", `${3 + Math.random() * 5}px`);
  partikel.style.setProperty("--durasi", `${9 + Math.random() * 10}s`);
  partikel.style.setProperty("--jeda", `${-Math.random() * 18}s`);
  partikel.style.setProperty("--goyang", `${(Math.random() - 0.5) * 80}px`);
  energi.append(partikel);
}

/* ---------- Mulai ---------- */

terapkanKarakter(document.documentElement.dataset.karakter);
terapkanTema(document.documentElement.dataset.tema);
isiKategori();
inputTanggal.value = hariIni();
filterTanggal.value = hariIni();
inputSyncUrl.value = syncUrl;
statusIdle();
render();
mulaiSinkron();
