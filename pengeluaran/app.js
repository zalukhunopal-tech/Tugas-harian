const STORAGE_KEY = "pengeluaran-harian";

const form = document.getElementById("form-pengeluaran");
const inputTanggal = document.getElementById("tanggal");
const inputDeskripsi = document.getElementById("deskripsi");
const inputKategori = document.getElementById("kategori");
const inputJumlah = document.getElementById("jumlah");
const filterTanggal = document.getElementById("filter-tanggal");
const daftar = document.getElementById("daftar");
const kosong = document.getElementById("kosong");
const totalHari = document.getElementById("total-hari");
const totalBulan = document.getElementById("total-bulan");
const jumlahTransaksi = document.getElementById("jumlah-transaksi");
const btnExport = document.getElementById("btn-export");

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

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

let pengeluaran = muatData();

function render() {
  const tanggal = filterTanggal.value;
  const bulan = tanggal.slice(0, 7);

  const hariItu = pengeluaran.filter((p) => p.tanggal === tanggal);
  const bulanItu = pengeluaran.filter((p) => p.tanggal.startsWith(bulan));

  totalHari.textContent = rupiah.format(hariItu.reduce((s, p) => s + p.jumlah, 0));
  totalBulan.textContent = rupiah.format(bulanItu.reduce((s, p) => s + p.jumlah, 0));
  jumlahTransaksi.textContent = hariItu.length;

  const labelHari = tanggal === hariIni() ? "Total hari ini" : "Total tanggal ini";
  totalHari.previousElementSibling.textContent = labelHari;

  daftar.replaceChildren(
    ...hariItu.map((p) => {
      const li = document.createElement("li");
      li.className = "expense-item";

      const info = document.createElement("div");
      info.className = "expense-info";
      const desc = document.createElement("div");
      desc.className = "expense-desc";
      desc.textContent = p.deskripsi;
      const kat = document.createElement("div");
      kat.className = "expense-cat";
      kat.textContent = p.kategori;
      info.append(desc, kat);

      const amount = document.createElement("span");
      amount.className = "expense-amount";
      amount.textContent = rupiah.format(p.jumlah);

      const hapus = document.createElement("button");
      hapus.type = "button";
      hapus.className = "btn-delete";
      hapus.textContent = "Hapus";
      hapus.addEventListener("click", () => hapusPengeluaran(p.id));

      li.append(info, amount, hapus);
      return li;
    })
  );

  kosong.hidden = hariItu.length > 0;
}

function hapusPengeluaran(id) {
  if (!confirm("Hapus pengeluaran ini?")) return;
  pengeluaran = pengeluaran.filter((p) => p.id !== id);
  simpanData(pengeluaran);
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const jumlah = Math.round(Number(inputJumlah.value));
  const deskripsi = inputDeskripsi.value.trim();
  if (!deskripsi || !(jumlah > 0)) return;

  pengeluaran.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    tanggal: inputTanggal.value,
    deskripsi,
    kategori: inputKategori.value,
    jumlah,
  });
  simpanData(pengeluaran);

  filterTanggal.value = inputTanggal.value;
  inputDeskripsi.value = "";
  inputJumlah.value = "";
  inputDeskripsi.focus();
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
    ["Tanggal", "Keterangan", "Kategori", "Jumlah"],
    ...[...pengeluaran]
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map((p) => [p.tanggal, p.deskripsi, p.kategori, p.jumlah]),
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
