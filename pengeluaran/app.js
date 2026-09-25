const STORAGE_KEY = "pengeluaran-harian";
const BUDGET_KEY = "pengeluaran-harian-anggaran";

const KATEGORI = {
  pengeluaran: [
    "Makanan & Minuman",
    "Transportasi",
    "Belanja",
    "Tagihan",
    "Hiburan",
    "Kesehatan",
    "Perlengkapan Kegiatan",
    "Konsumsi Kegiatan",
    "Lainnya",
  ],
  pemasukan: ["Gaji", "Uang Saku", "Iuran Anggota", "Sponsor/Donasi", "Hibah/Bantuan", "Penjualan", "Lainnya"],
};
const DANA_DEFAULT = "Dana Pribadi";

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

// Entri lama (sebelum ada pemasukan dan dana) dianggap pengeluaran dari Dana Pribadi.
function normalisasi(p) {
  return { jenis: "pengeluaran", dana: DANA_DEFAULT, ...p };
}

function muatData() {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(normalisasi);
  } catch {
    return [];
  }
}

function simpanData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    alert("Gagal menyimpan data ke penyimpanan browser.");
  }
}

function muatAnggaran() {
  try {
    return Number(localStorage.getItem(BUDGET_KEY)) || 0;
  } catch {
    return 0;
  }
}

function simpanAnggaran(nilai) {
  try {
    if (nilai > 0) localStorage.setItem(BUDGET_KEY, String(nilai));
    else localStorage.removeItem(BUDGET_KEY);
  } catch {
    alert("Gagal menyimpan anggaran ke penyimpanan browser.");
  }
}

let transaksi = muatData();
let anggaran = muatAnggaran();
let editId = null;

function total(list, jenis) {
  return list.filter((p) => p.jenis === jenis).reduce((s, p) => s + p.jumlah, 0);
}

function jenisTerpilih() {
  return radioJenis.value;
}

function isiKategori(jenis, pilih) {
  inputKategori.replaceChildren(
    ...KATEGORI[jenis].map((k) => {
      const opt = document.createElement("option");
      opt.textContent = k;
      return opt;
    })
  );
  if (pilih && !KATEGORI[jenis].includes(pilih)) {
    const opt = document.createElement("option");
    opt.textContent = pilih;
    inputKategori.append(opt);
  }
  if (pilih) inputKategori.value = pilih;
  inputDeskripsi.placeholder = jenis === "pemasukan" ? "Contoh: Uang saku bulanan" : "Contoh: Makan siang";
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
  meta.textContent = [p.kategori, p.dana, p.metode].filter(Boolean).join(" · ");
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
      const persen = Math.round((jumlah / totalSemua) * 100);
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
      fill.style.width = `${(jumlah / maks) * 100}%`;
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
  inputCatatan.value = "";
}

function mulaiEdit(id) {
  const p = transaksi.find((x) => x.id === id);
  if (!p) return;
  editId = id;
  radioJenis.value = p.jenis;
  isiKategori(p.jenis, p.kategori);
  inputDana.value = p.dana;
  inputTanggal.value = p.tanggal;
  inputDeskripsi.value = p.deskripsi;
  inputJumlah.value = p.jumlah;
  inputMetode.value = p.metode || "Tunai";
  inputCatatan.value = p.catatan || "";
  judulForm.textContent = "Ubah Transaksi";
  btnSimpan.textContent = "Perbarui";
  btnBatal.hidden = false;
  kartuForm.scrollIntoView({ behavior: "smooth" });
  inputDeskripsi.focus({ preventScroll: true });
  render();
}

function hapusTransaksi(id) {
  if (!confirm("Hapus transaksi ini?")) return;
  transaksi = transaksi.filter((p) => p.id !== id);
  simpanData(transaksi);
  if (editId === id) resetForm();
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
    catatan: inputCatatan.value.trim(),
  };

  if (editId) {
    transaksi = transaksi.map((p) => (p.id === editId ? { ...p, ...data } : p));
  } else {
    transaksi.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
    });
  }
  simpanData(transaksi);

  filterTanggal.value = inputTanggal.value;
  if (filterDana.value && filterDana.value !== data.dana) filterDana.value = "";
  resetForm();
  inputDeskripsi.focus();
  render();
});

for (const radio of radioJenis) {
  radio.addEventListener("change", () => isiKategori(jenisTerpilih()));
}

btnBatal.addEventListener("click", () => {
  resetForm();
  render();
});

formAnggaran.addEventListener("submit", (e) => {
  e.preventDefault();
  const nilai = Math.round(Number(inputAnggaran.value));
  anggaran = nilai > 0 ? nilai : 0;
  simpanAnggaran(anggaran);
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
    ["Tanggal", "Jenis", "Dana", "Keterangan", "Kategori", "Metode Bayar", "Jumlah", "Catatan"],
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

isiKategori(jenisTerpilih());
inputTanggal.value = hariIni();
filterTanggal.value = hariIni();
render();
