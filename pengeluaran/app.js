const STORAGE_KEY = "pengeluaran-harian";
const BUDGET_KEY = "pengeluaran-harian-anggaran";

const form = document.getElementById("form-pengeluaran");
const judulForm = document.getElementById("judul-form");
const kartuForm = document.getElementById("kartu-form");
const inputTanggal = document.getElementById("tanggal");
const inputDeskripsi = document.getElementById("deskripsi");
const inputKategori = document.getElementById("kategori");
const inputJumlah = document.getElementById("jumlah");
const inputMetode = document.getElementById("metode");
const inputCatatan = document.getElementById("catatan");
const btnSimpan = document.getElementById("btn-simpan");
const btnBatal = document.getElementById("btn-batal");
const filterTanggal = document.getElementById("filter-tanggal");
const daftar = document.getElementById("daftar");
const kosong = document.getElementById("kosong");
const labelTotalHari = document.getElementById("label-total-hari");
const totalHari = document.getElementById("total-hari");
const totalBulan = document.getElementById("total-bulan");
const jumlahTransaksi = document.getElementById("jumlah-transaksi");
const btnExport = document.getElementById("btn-export");
const formAnggaran = document.getElementById("form-anggaran");
const inputAnggaran = document.getElementById("anggaran");
const statusAnggaran = document.getElementById("status-anggaran");
const meterAnggaran = document.getElementById("meter-anggaran");
const teksAnggaran = document.getElementById("teks-anggaran");
const judulKategori = document.getElementById("judul-kategori");
const ringkasanKategori = document.getElementById("ringkasan-kategori");
const kategoriKosong = document.getElementById("kategori-kosong");

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

function muatData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
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

let pengeluaran = muatData();
let anggaran = muatAnggaran();
let editId = null;

function total(list) {
  return list.reduce((s, p) => s + p.jumlah, 0);
}

function buatItem(p) {
  const li = document.createElement("li");
  li.className = "expense-item";
  if (p.id === editId) li.classList.add("editing");

  const info = document.createElement("div");
  info.className = "expense-info";
  const desc = document.createElement("div");
  desc.className = "expense-desc";
  desc.textContent = p.deskripsi;
  const meta = document.createElement("div");
  meta.className = "expense-meta";
  meta.textContent = p.metode ? `${p.kategori} · ${p.metode}` : p.kategori;
  info.append(desc, meta);
  if (p.catatan) {
    const note = document.createElement("div");
    note.className = "expense-note";
    note.textContent = p.catatan;
    info.append(note);
  }

  const amount = document.createElement("span");
  amount.className = "expense-amount";
  amount.textContent = rupiah.format(p.jumlah);

  const ubah = document.createElement("button");
  ubah.type = "button";
  ubah.className = "btn-small";
  ubah.textContent = "Ubah";
  ubah.addEventListener("click", () => mulaiEdit(p.id));

  const hapus = document.createElement("button");
  hapus.type = "button";
  hapus.className = "btn-small btn-delete";
  hapus.textContent = "Hapus";
  hapus.addEventListener("click", () => hapusPengeluaran(p.id));

  const tombol = document.createElement("div");
  tombol.className = "expense-buttons";
  tombol.append(ubah, hapus);

  li.append(info, amount, tombol);
  return li;
}

function renderAnggaran(totalTanggal) {
  inputAnggaran.value = anggaran || "";
  statusAnggaran.hidden = !anggaran;
  if (!anggaran) return;

  const persen = (totalTanggal / anggaran) * 100;
  const lebih = totalTanggal > anggaran;
  meterAnggaran.style.width = `${Math.min(persen, 100)}%`;
  statusAnggaran.querySelector(".meter").setAttribute("aria-valuenow", Math.round(persen));
  statusAnggaran.classList.toggle("over", lebih);

  teksAnggaran.textContent = lebih
    ? `⚠ Melebihi anggaran ${rupiah.format(totalTanggal - anggaran)} (${Math.round(persen)}% dari ${rupiah.format(anggaran)})`
    : `Sisa anggaran ${rupiah.format(anggaran - totalTanggal)} (terpakai ${Math.round(persen)}% dari ${rupiah.format(anggaran)})`;
}

function renderKategori(bulanItu, bulan) {
  judulKategori.textContent = `Ringkasan per Kategori — ${namaBulan.format(new Date(`${bulan}-01T00:00`))}`;

  const perKategori = new Map();
  for (const p of bulanItu) {
    perKategori.set(p.kategori, (perKategori.get(p.kategori) || 0) + p.jumlah);
  }
  const baris = [...perKategori].sort((a, b) => b[1] - a[1]);
  const totalBulanIni = total(bulanItu);
  const maks = baris.length ? baris[0][1] : 0;

  ringkasanKategori.replaceChildren(
    ...baris.map(([nama, jumlah]) => {
      const persen = Math.round((jumlah / totalBulanIni) * 100);
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
  kategoriKosong.hidden = baris.length > 0;
}

function render() {
  const tanggal = filterTanggal.value;
  const bulan = tanggal.slice(0, 7);

  const hariItu = pengeluaran.filter((p) => p.tanggal === tanggal);
  const bulanItu = pengeluaran.filter((p) => p.tanggal.startsWith(bulan));
  const totalTanggal = total(hariItu);

  labelTotalHari.textContent = tanggal === hariIni() ? "Total hari ini" : "Total tanggal ini";
  totalHari.textContent = rupiah.format(totalTanggal);
  totalBulan.textContent = rupiah.format(total(bulanItu));
  jumlahTransaksi.textContent = hariItu.length;

  daftar.replaceChildren(...hariItu.map(buatItem));
  kosong.hidden = hariItu.length > 0;

  renderAnggaran(totalTanggal);
  renderKategori(bulanItu, bulan);
}

function resetForm() {
  editId = null;
  judulForm.textContent = "Tambah Pengeluaran";
  btnSimpan.textContent = "Simpan";
  btnBatal.hidden = true;
  inputDeskripsi.value = "";
  inputJumlah.value = "";
  inputCatatan.value = "";
}

function mulaiEdit(id) {
  const p = pengeluaran.find((x) => x.id === id);
  if (!p) return;
  editId = id;
  inputTanggal.value = p.tanggal;
  inputDeskripsi.value = p.deskripsi;
  inputKategori.value = p.kategori;
  inputJumlah.value = p.jumlah;
  inputMetode.value = p.metode || "Tunai";
  inputCatatan.value = p.catatan || "";
  judulForm.textContent = "Ubah Pengeluaran";
  btnSimpan.textContent = "Perbarui";
  btnBatal.hidden = false;
  kartuForm.scrollIntoView({ behavior: "smooth" });
  inputDeskripsi.focus({ preventScroll: true });
  render();
}

function hapusPengeluaran(id) {
  if (!confirm("Hapus pengeluaran ini?")) return;
  pengeluaran = pengeluaran.filter((p) => p.id !== id);
  simpanData(pengeluaran);
  if (editId === id) resetForm();
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const jumlah = Math.round(Number(inputJumlah.value));
  const deskripsi = inputDeskripsi.value.trim();
  if (!deskripsi || !(jumlah > 0)) return;

  const data = {
    tanggal: inputTanggal.value,
    deskripsi,
    kategori: inputKategori.value,
    jumlah,
    metode: inputMetode.value,
    catatan: inputCatatan.value.trim(),
  };

  if (editId) {
    pengeluaran = pengeluaran.map((p) => (p.id === editId ? { ...p, ...data } : p));
  } else {
    pengeluaran.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
    });
  }
  simpanData(pengeluaran);

  filterTanggal.value = inputTanggal.value;
  resetForm();
  inputDeskripsi.focus();
  render();
});

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

btnExport.addEventListener("click", () => {
  if (pengeluaran.length === 0) {
    alert("Belum ada data untuk diunduh.");
    return;
  }
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const baris = [
    ["Tanggal", "Keterangan", "Kategori", "Metode Bayar", "Jumlah", "Catatan"],
    ...[...pengeluaran]
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map((p) => [p.tanggal, p.deskripsi, p.kategori, p.metode || "", p.jumlah, p.catatan || ""]),
  ];
  const csv = baris.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pengeluaran-${hariIni()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

inputTanggal.value = hariIni();
filterTanggal.value = hariIni();
render();
