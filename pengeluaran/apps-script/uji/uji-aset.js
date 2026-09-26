// Uji perhitungan aset (pengeluaran/aset.js). Jalankan: node pengeluaran/apps-script/uji/uji-aset.js
const assert = require("assert");
const path = require("path");
const Aset = require(path.join(__dirname, "..", "..", "aset.js"));

const kini = new Date(2026, 8, 26); // 26 Sep 2026
assert.equal(Aset.bulanAntara("2026-01-26", kini), 8);
assert.equal(Aset.bulanAntara("2026-01-27", kini), 7, "bulan belum genap tidak dihitung");
assert.equal(Aset.bulanAntara("2027-01-01", kini), 0);
assert.equal(Aset.bulanAntara("", kini), 0);

// JHT: saldo 12.500.000 per 1 Jan 2026, upah 5.000.000, iuran 5,7% = 285.000/bln, hasil 5,5%/th, 8 bulan
const jmo = Aset.proyeksiJmo({ saldoAwal: 12500000, tanggalSaldo: "2026-01-01", gaji: 5000000, iuranPersen: 5.7, hasilPersen: 5.5 }, kini);
assert.equal(jmo.bulan, 8); assert.equal(jmo.iuranBulanan, 285000); assert.equal(jmo.modal, 12500000 + 285000 * 8);
let s = 12500000; for (let i = 0; i < 8; i++) s = s * (1 + 0.055 / 12) + 285000;
assert.equal(jmo.nilai, Math.round(s)); assert.ok(jmo.nilai > jmo.modal);

// Investasi: 10 juta, 6%/th
const majemuk = Aset.nilaiInvestasi({ modal: 10000000, tanggalMulai: "2025-09-26", bungaPersen: 6, skema: "majemuk-bulanan" }, kini);
assert.equal(majemuk.bulan, 12); assert.equal(majemuk.nilai, Math.round(10000000 * Math.pow(1.005, 12)));
assert.equal(Aset.nilaiInvestasi({ modal: 10000000, tanggalMulai: "2025-09-26", bungaPersen: 6, skema: "sederhana" }, kini).nilai, 10600000);
assert.equal(Aset.nilaiInvestasi({ modal: 10000000, tanggalMulai: "2024-09-26", bungaPersen: 6, skema: "majemuk-tahunan" }, kini).nilai, Math.round(10000000 * 1.06 * 1.06));

// Harga emas: manual vs otomatis, yang lebih baru dipakai
const harga = { waktu: "2026-09-26T08:00:00Z", emas: { jual: 1345000, buyback: 1210000, waktu: "2026-09-26T08:00:00Z", sumber: "Logam Mulia" }, crypto: { bitcoin: { idr: 1650000000, perubahan24: 1.25 } } };
assert.equal(Aset.hargaEmasEfektif(harga).jual, 1345000);
const hargaManual = { ...harga, manual: { emas: { jual: 1400000, buyback: null, waktu: "2026-09-26T09:00:00Z" } } };
assert.equal(Aset.hargaEmasEfektif(hargaManual).jual, 1400000); assert.equal(Aset.hargaEmasEfektif(hargaManual).sumber, "manual");
assert.equal(Aset.hargaEmasEfektif({ ...harga, manual: { emas: { jual: 1400000, waktu: "2026-09-25T09:00:00Z" } } }).jual, 1345000, "manual lebih lama diabaikan");
assert.equal(Aset.hargaEmasEfektif({}), null);

// Ringkasan portofolio
const daftar = [
  { id: "a", jenis: "emas", nama: "Antam", gram: 5, hargaBeli: 1200000 },
  { id: "b", jenis: "crypto", nama: "BTC", koin: "bitcoin", simbol: "BTC", jumlah: 0.01, hargaBeli: 1500000000 },
  { id: "c", jenis: "crypto", nama: "SOL", koin: "solana", simbol: "SOL", jumlah: 2, hargaBeli: 0 },
  { id: "d", jenis: "investasi", nama: "Deposito", modal: 10000000, tanggalMulai: "2025-09-26", bungaPersen: 6, skema: "sederhana" },
];
const r = Aset.ringkasAset(daftar, harga, kini);
assert.equal(r.item[0].nilai, 6725000); assert.equal(r.item[0].untung, 725000); assert.ok(Math.abs(r.item[0].persen - 12.0833) < 0.01);
assert.equal(r.item[1].nilai, 16500000); assert.equal(r.item[1].untung, 1500000);
assert.equal(r.item[2].tersedia, false, "koin tanpa harga ditandai"); assert.equal(r.belumTersedia, 1);
assert.equal(r.total, 6725000 + 16500000 + 10600000);
assert.equal(r.modal, 6000000 + 15000000 + 10000000); assert.equal(r.untung, 725000 + 1500000 + 600000);
assert.match(r.item[1].keterangan, /24 jam \+1\.25%/);

// Pemetaan CoinGecko dan penggabungan harga
assert.deepEqual(Aset.petakanCoinGecko({ bitcoin: { idr: 1, idr_24h_change: -2 }, rusak: { usd: 3 } }), { bitcoin: { idr: 1, perubahan24: -2 } });
assert.ok(Aset.urlCoinGecko(["bitcoin", "ethereum"]).includes("ids=bitcoin%2Cethereum"));
const gabung = Aset.gabungHarga(harga, { waktu: "2026-09-26T10:00:00Z", crypto: { ethereum: { idr: 42000000 } }, emas: null });
assert.equal(gabung.emas.jual, 1345000, "emas lama dipertahankan"); assert.ok(gabung.crypto.bitcoin && gabung.crypto.ethereum);
assert.equal(Aset.hargaBasi(harga, Date.parse("2026-09-26T09:00:00Z")), false);
assert.equal(Aset.hargaBasi(harga, Date.parse("2026-09-27T09:00:00Z")), true);

// Pembersihan input
assert.equal(Aset.rapikanAset({ jenis: "saham", nama: "x" }), null);
assert.equal(Aset.rapikanAset({ jenis: "emas", nama: "  " }), null);
assert.deepEqual(Aset.rapikanAset({ id: "z", jenis: "crypto", nama: " BTC ", koin: "Bitcoin", simbol: "btc", jumlah: "0.5", hargaBeli: "-3" }), { id: "z", jenis: "crypto", nama: "BTC", catatan: "", dibuat: "", koin: "bitcoin", simbol: "BTC", jumlah: 0.5, hargaBeli: 0 });
assert.equal(Aset.rapikanAset({ jenis: "investasi", nama: "x", modal: 1, skema: "aneh" }).skema, "majemuk-bulanan");
console.log("aset.js: semua uji lulus");
