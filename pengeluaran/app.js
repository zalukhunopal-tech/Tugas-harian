const STORAGE_KEY = "pengeluaran-harian";
const BUDGET_KEY = "pengeluaran-harian-anggaran";
const TEMA_KEY = "keuangan-tema";
const KARAKTER_KEY = "keuangan-karakter";
const SYNC_URL_KEY = "keuangan-sync-url";
const SYNC_KUNCI_KEY = "keuangan-sync-kunci";
const SYNC_QUEUE_KEY = "keuangan-sync-antrean";
const SYNC_TIME_KEY = "keuangan-sync-terakhir";
const ASET_KEY = "keuangan-aset";
const HARGA_KEY = "keuangan-harga";
const NAMA_FILE_ASET = "Aset.json";
const NAMA_FILE_HARGA = "Harga Pasar.json";

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
  gojo: { nama: "Gojo Satoru", lambang: "無", tagline: "無下限呪術 · Tanpa Batas. Saldo tak terhingga? Sayangnya tidak." },
  sukuna: { nama: "Ryomen Sukuna", lambang: "宿", tagline: "呪いの王 · Raja Kutukan. Setiap pengeluaran adalah tebasan." },
  jogo: { nama: "Jogo", lambang: "火", tagline: "蓋棺鉄囲山 · Jangan biarkan anggaran meletus." },
  nanami: { nama: "Nanami Kento", lambang: "七", tagline: "十劃呪法 · Rasio 7:3. Kerja lembur tidak dibayar." },
};

const $ = (id) => document.getElementById(id);

const form = $("form-transaksi");
const judulForm = $("judul-form");
const radioJenis = form.elements.jenis;
const inputDana = $("dana");
const inputTanggal = $("tanggal");
const inputDeskripsi = $("deskripsi");
const inputKategori = $("kategori");
const inputJumlah = $("jumlah");
const inputMetode = $("metode");
const inputKaitan = $("kaitan");
const labelKaitan = $("label-kaitan");
const inputCatatan = $("catatan");
const btnSimpan = $("btn-simpan");
const btnBatal = $("btn-batal");
const inputBulan = $("bulan");
const daftarHari = $("daftar-hari");
const kosong = $("kosong");
const btnExport = $("btn-export");
const formAnggaran = $("form-anggaran");
const inputAnggaran = $("anggaran");
const statusAnggaran = $("status-anggaran");
const meterAnggaran = $("meter-anggaran");
const teksAnggaran = $("teks-anggaran");
const judulKategori = $("judul-kategori");
const ringkasanKeluar = $("ringkasan-keluar");
const keluarKosong = $("keluar-kosong");
const ringkasanMasuk = $("ringkasan-masuk");
const masukKosong = $("masuk-kosong");
const kartuSaldo = document.querySelectorAll(".balance");
const chips = document.querySelectorAll(".chip");
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const angkaRingkas = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const namaBulan = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const namaBulanPendek = new Intl.DateTimeFormat("id-ID", { month: "short" });
const namaHari = new Intl.DateTimeFormat("id-ID", { weekday: "long" });

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

function bacaJsonStorage(kunci, cadangan) {
  try {
    const nilai = JSON.parse(bacaStorage(kunci, "null"));
    return nilai === null ? cadangan : nilai;
  } catch {
    return cadangan;
  }
}

// Entri lama (sebelum ada pemasukan, dana, dan kaitan) dianggap pengeluaran dari Dana Pribadi.
function normalisasi(p) {
  return { jenis: "pengeluaran", dana: DANA_DEFAULT, metode: "", kaitan: "", catatan: "", ...p };
}

function muatData() {
  const data = bacaJsonStorage(STORAGE_KEY, []);
  return Array.isArray(data) ? data.map(normalisasi) : [];
}

function simpanData(data) {
  if (!tulisStorage(STORAGE_KEY, JSON.stringify(data))) alert("Gagal menyimpan data ke penyimpanan browser.");
}

function buatId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let transaksi = muatData();
let anggaran = Number(bacaStorage(BUDGET_KEY, "0")) || 0;
let editId = null;
let bulanTerpilih = hariIni().slice(0, 7);
let filterDanaNilai = "";

function total(list, jenis) {
  return list.filter((p) => p.jenis === jenis).reduce((s, p) => s + p.jumlah, 0);
}

/* ---------- Navigasi tab ---------- */

function tampilkan(nama) {
  for (const v of views) v.hidden = v.dataset.view !== nama;
  for (const n of navItems) {
    if (n.dataset.view === nama) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  }
  document.body.dataset.view = nama;
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

for (const n of navItems) {
  n.addEventListener("click", () => {
    if (n.dataset.view === "tambah" && editId) {
      resetForm();
      isiKategori();
    }
    tampilkan(n.dataset.view);
    if (n.dataset.view === "tambah") inputDeskripsi.focus({ preventScroll: true });
    if (n.dataset.view === "aset") perbaruiHargaBilaBasi();
  });
}

/* ---------- Pemilih bulan ---------- */

function geserBulan(delta) {
  const [th, bl] = bulanTerpilih.split("-").map(Number);
  const d = new Date(th, bl - 1 + delta, 1);
  bulanTerpilih = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  render();
}

$("bulan-prev").addEventListener("click", () => geserBulan(-1));
$("bulan-next").addEventListener("click", () => geserBulan(1));
$("bulan-lalu").addEventListener("click", () => geserBulan(-1));
inputBulan.addEventListener("change", () => {
  if (/^\d{4}-\d{2}$/.test(inputBulan.value)) {
    bulanTerpilih = inputBulan.value;
    render();
  }
});

for (const chip of chips) {
  chip.addEventListener("click", () => {
    filterDanaNilai = chip.dataset.dana;
    for (const c of chips) c.setAttribute("aria-checked", String(c === chip));
    render();
  });
}

function tanggalKeDate(iso) {
  return new Date(`${iso}-01T00:00`.replace(/^(\d{4}-\d{2}-\d{2})-01/, "$1"));
}

/* ---------- Form transaksi ---------- */

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
  tampilkan("tambah");
  inputDeskripsi.focus({ preventScroll: true });
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

  bulanTerpilih = data.tanggal.slice(0, 7);
  if (filterDanaNilai && filterDanaNilai !== data.dana) {
    filterDanaNilai = "";
    for (const c of chips) c.setAttribute("aria-checked", String(c.dataset.dana === ""));
  }
  resetForm();
  isiKategori();
  render();
  tampilkan("riwayat");
  pulsaSimpan();
});

for (const radio of radioJenis) radio.addEventListener("change", () => isiKategori());
inputDana.addEventListener("change", () => isiKategori());
btnBatal.addEventListener("click", () => {
  resetForm();
  isiKategori();
  tampilkan("riwayat");
});

formAnggaran.addEventListener("submit", (e) => {
  e.preventDefault();
  const nilai = Math.round(Number(inputAnggaran.value));
  anggaran = nilai > 0 ? nilai : 0;
  tulisStorage(BUDGET_KEY, anggaran ? String(anggaran) : null);
  render();
});

/* ---------- Render riwayat ---------- */

function buatItem(p) {
  const masuk = p.jenis === "pemasukan";
  const li = document.createElement("li");
  li.className = "expense-item";

  const ikon = document.createElement("span");
  ikon.className = `ikon-kategori ${masuk ? "masuk" : "keluar"}`;
  ikon.textContent = inisialKategori(p.kategori);
  ikon.title = p.kategori;

  const info = document.createElement("div");
  info.className = "expense-info";
  const desc = document.createElement("div");
  desc.className = "expense-desc";
  desc.textContent = p.deskripsi;
  const meta = document.createElement("div");
  meta.className = "expense-meta";
  meta.textContent = [p.kategori, p.dana === "Dana Kegiatan" ? "Kegiatan" : "Pribadi", p.metode, p.kaitan].filter(Boolean).join(" · ");
  info.append(desc, meta);
  if (p.catatan) {
    const note = document.createElement("div");
    note.className = "expense-note";
    note.textContent = p.catatan;
    info.append(note);
  }

  const kanan = document.createElement("div");
  kanan.className = "expense-kanan";
  const amount = document.createElement("span");
  amount.className = `expense-amount ${masuk ? "amount-in" : ""}`;
  amount.textContent = `${masuk ? "+" : "−"}${angkaRingkas.format(p.jumlah)}`;

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
  kanan.append(amount, tombol);

  li.append(ikon, info, kanan);
  return li;
}

function inisialKategori(k) {
  const kata = String(k || "?").replace(/&/g, "").split(/\s+/).filter(Boolean);
  return (kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2)).toUpperCase();
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
      `${namaBulan.format(tanggalKeDate(bulan))}: masuk ${rupiah.format(total(bulanItu, "pemasukan"))}` +
      ` · keluar ${rupiah.format(total(bulanItu, "pengeluaran"))}`;
  }
}

function renderAnggaran() {
  inputAnggaran.value = anggaran || "";
  $("anggaran-ringkas").textContent = anggaran ? `batas ${rupiah.format(anggaran)}` : "belum diatur";
  statusAnggaran.hidden = !anggaran;
  if (!anggaran) return;
  const keluarHariIni = total(transaksi.filter((p) => p.tanggal === hariIni()), "pengeluaran");
  const persen = (keluarHariIni / anggaran) * 100;
  const lebih = keluarHariIni > anggaran;
  meterAnggaran.style.width = `${Math.min(persen, 100)}%`;
  statusAnggaran.querySelector(".meter").setAttribute("aria-valuenow", Math.round(persen));
  statusAnggaran.classList.toggle("over", lebih);
  teksAnggaran.textContent = lebih
    ? `⚠ Hari ini melebihi anggaran ${rupiah.format(keluarHariIni - anggaran)} (${Math.round(persen)}%)`
    : `Hari ini terpakai ${rupiah.format(keluarHariIni)} (${Math.round(persen)}%), sisa ${rupiah.format(anggaran - keluarHariIni)}`;
}

function renderDaftarHari(bulanItu) {
  const perHari = new Map();
  for (const p of bulanItu) {
    if (!perHari.has(p.tanggal)) perHari.set(p.tanggal, []);
    perHari.get(p.tanggal).push(p);
  }
  const hari = [...perHari.keys()].sort((a, b) => b.localeCompare(a));
  daftarHari.replaceChildren(
    ...hari.map((tgl) => {
      const list = perHari.get(tgl);
      const bagian = document.createElement("section");
      bagian.className = "hari";
      const kepala = document.createElement("div");
      kepala.className = "hari-kepala";
      const d = tanggalKeDate(tgl);
      const kiri = document.createElement("span");
      kiri.innerHTML = `<strong>${d.getDate()} ${namaBulanPendek.format(d)}</strong> <span class="hari-nama">${namaHari.format(d)}</span>`;
      const kanan = document.createElement("span");
      kanan.className = "hari-total";
      const keluar = total(list, "pengeluaran");
      const masuk = total(list, "pemasukan");
      kanan.textContent = [keluar ? `Pengeluaran: ${angkaRingkas.format(keluar)}` : "", masuk ? `Pemasukan: ${angkaRingkas.format(masuk)}` : ""]
        .filter(Boolean)
        .join(" · ");
      kepala.append(kiri, kanan);
      const ul = document.createElement("ul");
      ul.className = "expense-list";
      ul.append(...list.map(buatItem));
      bagian.append(kepala, ul);
      return bagian;
    })
  );
  kosong.hidden = hari.length > 0;
}

function renderDaftarKategori(list, wadah, pesanKosong) {
  const perKategori = new Map();
  for (const p of list) perKategori.set(p.kategori, (perKategori.get(p.kategori) || 0) + p.jumlah);
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

// Batang pemasukan/pengeluaran untuk 6 bulan yang berakhir pada bulan terpilih.
function renderTren(terfilter) {
  const [th, bl] = bulanTerpilih.split("-").map(Number);
  const bulan = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(th, bl - 1 - i, 1);
    const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = terfilter.filter((p) => p.tanggal.startsWith(kunci));
    bulan.push({ kunci, label: namaBulanPendek.format(d), masuk: total(list, "pemasukan"), keluar: total(list, "pengeluaran") });
  }
  const maks = Math.max(1, ...bulan.map((b) => Math.max(b.masuk, b.keluar)));
  const wadah = $("tren-bulanan");
  wadah.replaceChildren(
    ...bulan.map((b) => {
      const kolom = document.createElement("div");
      kolom.className = "tren-kolom" + (b.kunci === bulanTerpilih ? " aktif" : "");
      kolom.title = `${b.label}: masuk ${rupiah.format(b.masuk)}, keluar ${rupiah.format(b.keluar)}`;
      const batang = document.createElement("div");
      batang.className = "tren-batang";
      for (const [kelas, nilai] of [["masuk", b.masuk], ["keluar", b.keluar]]) {
        const bar = document.createElement("div");
        bar.className = `bar ${kelas}`;
        bar.style.height = `${(nilai / maks) * 100}%`;
        batang.append(bar);
      }
      const label = document.createElement("span");
      label.className = "tren-label";
      label.textContent = b.label;
      kolom.append(batang, label);
      return kolom;
    })
  );
  const tabel = $("tabel-tren");
  tabel.innerHTML =
    "<thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th></tr></thead><tbody>" +
    bulan
      .map(
        (b) =>
          `<tr><td>${b.label}</td><td>${angkaRingkas.format(b.masuk)}</td><td>${angkaRingkas.format(b.keluar)}</td><td class="${b.masuk - b.keluar < 0 ? "negatif" : ""}">${angkaRingkas.format(b.masuk - b.keluar)}</td></tr>`
      )
      .join("") +
    "</tbody>";
}

function render() {
  const bulan = bulanTerpilih;
  const [th, bl] = bulan.split("-").map(Number);
  const dBulan = new Date(th, bl - 1, 1);
  inputBulan.value = bulan;
  $("bulan-tahun").textContent = th;
  $("bulan-nama").textContent = `${namaBulanPendek.format(dBulan)} ▾`;
  const dLalu = new Date(th, bl - 2, 1);
  $("bulan-lalu").textContent = `${namaBulanPendek.format(dLalu)} ${dLalu.getFullYear()} ←`;

  const terfilter = filterDanaNilai ? transaksi.filter((p) => p.dana === filterDanaNilai) : transaksi;
  const bulanItu = terfilter.filter((p) => p.tanggal.startsWith(bulan));
  const keluar = total(bulanItu, "pengeluaran");
  const masuk = total(bulanItu, "pemasukan");
  $("keluar-bulan").textContent = angkaRingkas.format(keluar);
  $("masuk-bulan").textContent = angkaRingkas.format(masuk);
  const saldoEl = $("saldo-bulan");
  saldoEl.textContent = angkaRingkas.format(masuk - keluar);
  saldoEl.classList.toggle("negative", masuk - keluar < 0);

  renderSaldo(bulan);
  renderAnggaran();
  renderDaftarHari(bulanItu);
  renderTren(terfilter);
  judulKategori.textContent = `Ringkasan per Kategori — ${namaBulan.format(dBulan)}` + (filterDanaNilai ? ` · ${filterDanaNilai}` : "");
  renderDaftarKategori(bulanItu.filter((p) => p.jenis === "pengeluaran"), ringkasanKeluar, keluarKosong);
  renderDaftarKategori(bulanItu.filter((p) => p.jenis === "pemasukan"), ringkasanMasuk, masukKosong);
}

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

/* ---------- Aset: emas, kripto, JMO/JHT, investasi ---------- */

const formAset = $("form-aset");
const radioJenisAset = formAset.elements["jenis-aset"];
const kartuFormAset = $("kartu-form-aset");
const daftarAsetEl = $("daftar-aset");
const asetKosongEl = $("aset-kosong");
const IKON_ASET = { emas: "Au", crypto: "₿", jmo: "JHT", investasi: "%" };
const NAMA_JENIS_ASET = { emas: "Emas", crypto: "Kripto", jmo: "JMO · JHT", investasi: "Investasi" };

let aset = (bacaJsonStorage(ASET_KEY, []) || []).map(Aset.rapikanAset).filter(Boolean);
let harga = bacaJsonStorage(HARGA_KEY, {}) || {};
let editAsetId = null;
let sedangAmbilHarga = false;

function simpanAsetLokal() {
  tulisStorage(ASET_KEY, aset.length ? JSON.stringify(aset) : null);
}

function simpanHargaLokal() {
  tulisStorage(HARGA_KEY, JSON.stringify(harga));
}

function jenisAsetTerpilih() {
  return radioJenisAset.value;
}

function tampilkanFieldAset() {
  const jenis = jenisAsetTerpilih();
  for (const el of formAset.querySelectorAll("[data-untuk]")) el.hidden = el.dataset.untuk !== jenis;
  $("aset-nama").placeholder = {
    emas: "Contoh: Emas Antam 5 gr",
    crypto: "Contoh: Bitcoin di Indodax",
    jmo: "Contoh: JHT BPJS Ketenagakerjaan",
    investasi: "Contoh: Deposito BRI 12 bulan",
  }[jenis];
}

function resetFormAset() {
  editAsetId = null;
  formAset.reset();
  $("aset-jmo-iuran").value = "5.7";
  $("aset-jmo-hasil").value = "5.5";
  $("aset-jmo-tanggal").value = hariIni();
  $("aset-mulai").value = hariIni();
  $("judul-form-aset").textContent = "Tambah Aset";
  $("btn-simpan-aset").textContent = "Simpan aset";
  tampilkanFieldAset();
}

function bukaFormAset(a) {
  resetFormAset();
  if (a) {
    editAsetId = a.id;
    radioJenisAset.value = a.jenis;
    $("aset-nama").value = a.nama;
    $("aset-catatan").value = a.catatan || "";
    if (a.jenis === "emas") {
      $("aset-gram").value = a.gram;
      $("aset-emas-beli").value = a.hargaBeli || "";
    } else if (a.jenis === "crypto") {
      $("aset-koin").value = a.koin;
      $("aset-jumlah-koin").value = a.jumlah;
      $("aset-koin-beli").value = a.hargaBeli || "";
    } else if (a.jenis === "jmo") {
      $("aset-jmo-saldo").value = a.saldoAwal;
      $("aset-jmo-tanggal").value = a.tanggalSaldo;
      $("aset-jmo-gaji").value = a.gaji;
      $("aset-jmo-iuran").value = a.iuranPersen;
      $("aset-jmo-hasil").value = a.hasilPersen;
      $("aset-jmo-tambahan").value = a.iuranTambahan || "";
    } else {
      $("aset-modal").value = a.modal;
      $("aset-mulai").value = a.tanggalMulai;
      $("aset-bunga").value = a.bungaPersen;
      $("aset-skema").value = a.skema;
    }
    $("judul-form-aset").textContent = "Ubah Aset";
    $("btn-simpan-aset").textContent = "Perbarui aset";
    tampilkanFieldAset();
  }
  kartuFormAset.hidden = false;
  kartuFormAset.scrollIntoView({ behavior: "smooth", block: "start" });
  $("aset-nama").focus({ preventScroll: true });
}

$("btn-tambah-aset").addEventListener("click", () => bukaFormAset(null));
$("btn-batal-aset").addEventListener("click", () => {
  kartuFormAset.hidden = true;
  resetFormAset();
});
for (const r of radioJenisAset) r.addEventListener("change", tampilkanFieldAset);

formAset.addEventListener("submit", (e) => {
  e.preventDefault();
  const jenis = jenisAsetTerpilih();
  const nilai = (id) => $(id).value.trim();
  const mentah = { id: editAsetId || `a${buatId()}`, jenis, nama: nilai("aset-nama"), catatan: nilai("aset-catatan"), dibuat: hariIni() };
  if (jenis === "emas") Object.assign(mentah, { gram: nilai("aset-gram"), hargaBeli: nilai("aset-emas-beli") });
  else if (jenis === "crypto") {
    const koin = nilai("aset-koin").toLowerCase();
    const opsi = [...$("daftar-koin").options].find((o) => o.value === koin);
    Object.assign(mentah, { koin, simbol: opsi ? opsi.textContent : koin.slice(0, 6), jumlah: nilai("aset-jumlah-koin"), hargaBeli: nilai("aset-koin-beli") });
  } else if (jenis === "jmo") {
    Object.assign(mentah, {
      saldoAwal: nilai("aset-jmo-saldo"),
      tanggalSaldo: nilai("aset-jmo-tanggal"),
      gaji: nilai("aset-jmo-gaji"),
      iuranPersen: nilai("aset-jmo-iuran"),
      hasilPersen: nilai("aset-jmo-hasil"),
      iuranTambahan: nilai("aset-jmo-tambahan"),
    });
  } else Object.assign(mentah, { modal: nilai("aset-modal"), tanggalMulai: nilai("aset-mulai"), bungaPersen: nilai("aset-bunga"), skema: $("aset-skema").value });

  const bersih = Aset.rapikanAset(mentah);
  if (!bersih) return;
  const wajib = { emas: bersih.gram > 0, crypto: !!bersih.koin && bersih.jumlah > 0, jmo: bersih.saldoAwal >= 0 && !!bersih.tanggalSaldo, investasi: bersih.modal > 0 && !!bersih.tanggalMulai }[jenis];
  if (!wajib) {
    alert("Lengkapi angka dan tanggal untuk jenis aset ini.");
    return;
  }
  const lama = aset.find((x) => x.id === bersih.id);
  if (lama) bersih.dibuat = lama.dibuat || bersih.dibuat;
  aset = lama ? aset.map((x) => (x.id === bersih.id ? bersih : x)) : [...aset, bersih];
  simpanAsetLokal();
  antre({ action: "aset", aset });
  kartuFormAset.hidden = true;
  resetFormAset();
  renderAset();
  if (jenis === "crypto" && !Aset.hargaKoin(harga, bersih.koin)) perbaruiHarga(true);
  pulsaSimpan();
});

function hapusAset(id) {
  if (!confirm("Hapus aset ini?")) return;
  aset = aset.filter((x) => x.id !== id);
  simpanAsetLokal();
  antre({ action: "aset", aset });
  renderAset();
}

function renderAset() {
  const ringkas = Aset.ringkasAset(aset, harga);
  $("aset-total").textContent = rupiah.format(ringkas.total);
  const untungEl = $("aset-untung");
  if (ringkas.untung === null) untungEl.textContent = aset.length ? "Isi harga beli untuk melihat untung/rugi." : "";
  else {
    untungEl.textContent = `${ringkas.untung >= 0 ? "▲" : "▼"} ${rupiah.format(Math.abs(ringkas.untung))} (${ringkas.persen >= 0 ? "+" : ""}${ringkas.persen.toFixed(2)}%) dari modal ${rupiah.format(ringkas.modal)}`;
    untungEl.className = `aset-total-untung ${ringkas.untung >= 0 ? "untung" : "rugi"}`;
  }

  const kelompok = new Map();
  for (const x of ringkas.item) {
    if (!kelompok.has(x.aset.jenis)) kelompok.set(x.aset.jenis, []);
    kelompok.get(x.aset.jenis).push(x);
  }
  daftarAsetEl.replaceChildren(
    ...Aset.JENIS_ASET.filter((j) => kelompok.has(j)).map((jenis) => {
      const bagian = document.createElement("section");
      bagian.className = "hari";
      const kepala = document.createElement("div");
      kepala.className = "hari-kepala";
      const subtotal = kelompok.get(jenis).reduce((s, x) => s + (x.tersedia ? x.nilai : 0), 0);
      kepala.innerHTML = `<strong>${NAMA_JENIS_ASET[jenis]}</strong><span class="hari-total">${rupiah.format(subtotal)}</span>`;
      const ul = document.createElement("ul");
      ul.className = "expense-list";
      ul.append(
        ...kelompok.get(jenis).map((x) => {
          const li = document.createElement("li");
          li.className = "expense-item";
          const ikon = document.createElement("span");
          ikon.className = `ikon-kategori aset-${jenis}`;
          ikon.textContent = IKON_ASET[jenis];
          const info = document.createElement("div");
          info.className = "expense-info";
          const nama = document.createElement("div");
          nama.className = "expense-desc";
          nama.textContent = x.aset.nama;
          const ket = document.createElement("div");
          ket.className = "expense-meta";
          ket.textContent = x.keterangan;
          info.append(nama, ket);
          if (x.aset.catatan) {
            const c = document.createElement("div");
            c.className = "expense-note";
            c.textContent = x.aset.catatan;
            info.append(c);
          }
          const kanan = document.createElement("div");
          kanan.className = "expense-kanan";
          const nilai = document.createElement("span");
          nilai.className = "expense-amount";
          nilai.textContent = x.tersedia ? rupiah.format(x.nilai) : "—";
          kanan.append(nilai);
          if (x.untung !== null) {
            const u = document.createElement("span");
            u.className = `aset-untung ${x.untung >= 0 ? "untung" : "rugi"}`;
            u.textContent = `${x.untung >= 0 ? "+" : "−"}${angkaRingkas.format(Math.abs(x.untung))} (${x.persen >= 0 ? "+" : ""}${x.persen.toFixed(1)}%)`;
            kanan.append(u);
          }
          const tombol = document.createElement("div");
          tombol.className = "expense-buttons";
          const ubah = document.createElement("button");
          ubah.type = "button";
          ubah.className = "btn-small";
          ubah.textContent = "Ubah";
          ubah.addEventListener("click", () => bukaFormAset(x.aset));
          const hapus = document.createElement("button");
          hapus.type = "button";
          hapus.className = "btn-small btn-delete";
          hapus.textContent = "Hapus";
          hapus.addEventListener("click", () => hapusAset(x.aset.id));
          tombol.append(ubah, hapus);
          kanan.append(tombol);
          li.append(ikon, info, kanan);
          return li;
        })
      );
      bagian.append(kepala, ul);
      return bagian;
    })
  );
  asetKosongEl.hidden = aset.length > 0;
  renderInfoHarga(ringkas);
}

function renderInfoHarga(ringkas) {
  const emas = Aset.hargaEmasEfektif(harga);
  const waktu = harga.waktu ? new Date(harga.waktu) : null;
  const bagian = [];
  if (emas) bagian.push(`Emas ${rupiah.format(emas.jual)}/gr${emas.sumber ? ` (${emas.sumber})` : ""}`);
  const koin = Aset.koinDipakai(aset).filter((k) => Aset.hargaKoin(harga, k));
  if (koin.length) bagian.push(koin.map((k) => `${k} ${rupiah.format(harga.crypto[k].idr)}`).join(", "));
  const info = $("aset-harga-info");
  if (!bagian.length) info.textContent = "Harga pasar belum dimuat. Tekan “Perbarui harga” atau isi harga emas manual di bawah.";
  else {
    info.textContent = `${bagian.join(" · ")}${waktu ? ` · diperbarui ${waktu.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}` : ""}${Aset.hargaBasi(harga) ? " · harga sudah lama" : ""}`;
  }
  $("hint-harga").textContent = waktu ? `diperbarui ${waktu.toLocaleTimeString("id-ID", { timeStyle: "short" })}` : "belum ada";
  if (ringkas && ringkas.belumTersedia) info.textContent += ` · ${ringkas.belumTersedia} aset belum punya harga.`;
  $("emas-manual").value = harga.manual && harga.manual.emas ? harga.manual.emas.jual : "";
  $("emas-buyback-manual").value = harga.manual && harga.manual.emas && harga.manual.emas.buyback ? harga.manual.emas.buyback : "";
}

// Menerapkan aset dan harga hasil tarikan dari Drive/Web App. Pada sinkronisasi pertama,
// aset yang sudah dibuat di browser ini digabungkan (dan dikirim) supaya tidak hilang;
// sesudah itu daftar di Drive menjadi acuan.
function terapkanDataJauh(jauh) {
  if (!jauh) return;
  if (Array.isArray(jauh.aset) && !asetLokalMenunggu()) {
    const jauhBersih = jauh.aset.map(Aset.rapikanAset).filter(Boolean);
    const pertamaKali = !bacaStorage(SYNC_TIME_KEY, "");
    const lokalSaja = pertamaKali ? aset.filter((a) => !jauhBersih.some((j) => j.id === a.id)) : [];
    aset = [...jauhBersih, ...lokalSaja];
    simpanAsetLokal();
    if (lokalSaja.length) antre({ action: "aset", aset });
  }
  if (jauh.harga && typeof jauh.harga === "object") {
    harga = Aset.gabungHarga(harga, { ...jauh.harga, manual: undefined });
    simpanHargaLokal();
  }
  renderAset();
}

async function ambilCoinGeckoLangsung() {
  const ids = Aset.koinDipakai(aset);
  const respons = await fetch(Aset.urlCoinGecko(ids), { headers: { accept: "application/json" } });
  if (!respons.ok) throw new Error(`CoinGecko menjawab ${respons.status}`);
  return Aset.petakanCoinGecko(await respons.json());
}

// Sumber harga bergantung jalur: Web App (emas+kripto dari Apps Script), konektor Drive
// (Harga Pasar.json), dan CoinGecko langsung dari browser bila diizinkan.
async function perbaruiHarga(paksa) {
  if (sedangAmbilHarga) return;
  sedangAmbilHarga = true;
  const detail = $("harga-detail");
  const tombol = $("btn-perbarui-harga");
  tombol.disabled = true;
  const catatan = [];
  try {
    const mode = typeof modeSync === "function" ? modeSync() : null;
    if (mode === "url") {
      try {
        const hasil = await ambilDariSheet("harga", paksa ? "&segar=1" : "");
        if (hasil.harga) harga = Aset.gabungHarga(harga, { ...hasil.harga, manual: undefined });
      } catch (err) {
        catatan.push(`Apps Script: ${err.message}`);
      }
    } else if (mode === "konektor") {
      try {
        cacheDrive = null;
        const { fileHarga } = await cariDrive();
        if (fileHarga) {
          const hasil = await panggilDrive("download_file_content", { fileId: fileHarga }, { baca: true });
          harga = Aset.gabungHarga(harga, { ...JSON.parse(dariBase64(hasil && hasil.content)), manual: undefined });
        } else catatan.push("File Harga Pasar.json belum ada; jalankan pasangPemicu di Apps Script.");
      } catch (err) {
        catatan.push(`Drive: ${err.message}`);
      }
    }
    if (mode !== "konektor" || !harga.crypto || !Object.keys(harga.crypto).length) {
      try {
        const kripto = await ambilCoinGeckoLangsung();
        if (Object.keys(kripto).length) harga = Aset.gabungHarga(harga, { crypto: kripto, waktu: new Date().toISOString() });
      } catch (err) {
        catatan.push(`CoinGecko: ${err.message}`);
      }
    }
    simpanHargaLokal();
    renderAset();
    detail.textContent = catatan.length ? `Sebagian sumber gagal — ${catatan.join("; ")}.` : "Harga diperbarui.";
  } finally {
    sedangAmbilHarga = false;
    tombol.disabled = false;
  }
}

function perbaruiHargaBilaBasi() {
  if (aset.length && Aset.hargaBasi(harga)) perbaruiHarga(false);
}

$("btn-perbarui-harga").addEventListener("click", () => perbaruiHarga(true));

$("form-harga-manual").addEventListener("submit", (e) => {
  e.preventDefault();
  const jual = Math.round(Number($("emas-manual").value)) || 0;
  const buyback = Math.round(Number($("emas-buyback-manual").value)) || 0;
  harga = { ...harga, manual: jual > 0 ? { emas: { jual, buyback: buyback > 0 && buyback < jual ? buyback : null, waktu: new Date().toISOString() } } : null };
  if (!harga.waktu) harga.waktu = new Date().toISOString();
  simpanHargaLokal();
  renderAset();
  $("harga-detail").textContent = jual > 0 ? "Harga emas manual disimpan dan dipakai selama lebih baru dari harga otomatis." : "Harga manual dihapus.";
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
let syncKunci = bacaStorage(SYNC_KUNCI_KEY, "");
const inputSyncKunci = document.getElementById("sync-kunci");
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
    body: JSON.stringify(syncKunci ? { ...payload, kunci: syncKunci } : payload),
  });
  const hasil = await bacaJson(respons);
  if (!hasil.ok) throw new Error(hasil.error || "Apps Script menolak permintaan");
  return hasil;
}

async function ambilDariSheet(action, tambahan = "") {
  const pemisah = syncUrl.includes("?") ? "&" : "?";
  const kunci = syncKunci ? `&kunci=${encodeURIComponent(syncKunci)}` : "";
  const respons = await fetchSheet(`${syncUrl}${pemisah}action=${action}${kunci}${tambahan}`);
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
  const fileJson = (nama) => files.find((f) => f.title === nama && f.mimeType !== "application/vnd.google-apps.folder");
  cacheDrive = {
    sheet,
    folderAntrean: folder ? folder.id : null,
    fileAset: (fileJson(NAMA_FILE_ASET) || {}).id || null,
    fileHarga: (fileJson(NAMA_FILE_HARGA) || {}).id || null,
  };
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
  const { sheet, fileAset, fileHarga } = await cariDrive();
  const semua = [];
  for (const [dana, fileId] of Object.entries(sheet)) {
    const hasil = await panggilDrive("download_file_content", { fileId, exportMimeType: "text/csv" }, { baca: true });
    semua.push(...barisKeTransaksi(parseCsv(dariBase64(hasil && hasil.content)), dana));
  }
  const bacaJsonDrive = async (fileId) => {
    if (!fileId) return null;
    try {
      const hasil = await panggilDrive("download_file_content", { fileId }, { baca: true });
      return JSON.parse(dariBase64(hasil && hasil.content));
    } catch {
      return null;
    }
  };
  const isiAset = await bacaJsonDrive(fileAset);
  const isiHarga = await bacaJsonDrive(fileHarga);
  return {
    transaksi: semua,
    aset: isiAset && Array.isArray(isiAset.aset) ? isiAset.aset : null,
    harga: isiHarga && typeof isiHarga === "object" ? isiHarga : null,
  };
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
  if (op.action === "aset") return "aset";
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

function tercermin(op, dariSheet, asetJauh) {
  if (op.action === "aset") return Array.isArray(asetJauh) && JSON.stringify(asetJauh) === JSON.stringify(op.aset);
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
function gabungDenganPerubahanLokal(dariSheet, asetJauh) {
  terkirim = terkirim.filter((t) => Date.now() - t.waktu < BATAS_TERKIRIM && !tercermin(t.op, dariSheet, asetJauh));
  simpanTerkirim();
  return [...terkirim.map((t) => t.op), ...antrean].filter((op) => op.action !== "aset").reduce(terapkanOpLokal, dariSheet);
}

// Daftar aset dari Drive dipakai hanya bila tidak ada perubahan aset lokal yang masih menunggu.
function asetLokalMenunggu() {
  return antrean.some((op) => op.action === "aset") || terkirim.some((t) => t.op.action === "aset");
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
    const jauh = mode === "konektor" ? await bacaDrive() : await ambilDariSheet("list");
    transaksi = gabungDenganPerubahanLokal((jauh.transaksi || []).map(normalisasi), jauh.aset);
    simpanData(transaksi);
    terapkanDataJauh(jauh);
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
  if (!kirim.length && !aset.length) {
    syncDetail.textContent = "Tidak ada data lokal untuk dikirim.";
    return;
  }
  if (!confirm(`Kirim ${kirim.length} transaksi dan ${aset.length} aset lokal ke Google Drive? Baris yang sudah ada (id sama) diperbarui, sisanya ditambahkan.`)) return;
  for (const p of kirim) antre({ action: "upsert", transaksi: p });
  if (aset.length) antre({ action: "aset", aset });
  syncDetail.textContent = `${kirim.length} transaksi dan ${aset.length} aset dimasukkan ke antrean pengiriman.`;
}

formSync.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = inputSyncUrl.value.trim();
  if (!url) return;
  syncDetail.textContent = "Menguji koneksi…";
  const kunciLama = syncKunci;
  syncUrl = url;
  syncKunci = inputSyncKunci.value.trim();
  try {
    const hasil = await ambilDariSheet("ping");
    tulisStorage(SYNC_URL_KEY, url);
    tulisStorage(SYNC_KUNCI_KEY, syncKunci || null);
    syncDetail.textContent = `Terhubung. Sheet yang dipakai: ${(hasil.sheets || []).join(" dan ")}.`;
    await tarikDariSheet();
  } catch (err) {
    syncUrl = bacaStorage(SYNC_URL_KEY, "");
    syncKunci = kunciLama;
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
  syncKunci = "";
  antrean = [];
  tulisStorage(SYNC_URL_KEY, null);
  tulisStorage(SYNC_KUNCI_KEY, null);
  inputSyncKunci.value = "";
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
ambilKodeGs();

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
resetFormAset();
inputTanggal.value = hariIni();
inputSyncUrl.value = syncUrl;
inputSyncKunci.value = syncKunci;
statusIdle();
render();
renderAset();
tampilkan("riwayat");
mulaiSinkron();
perbaruiHargaBilaBasi();
