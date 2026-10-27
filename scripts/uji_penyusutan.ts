/**
 * Uji rumus penyusutan dan prediksi umur barang: garis lurus, saldo menurun ganda, sisa umur (waktu dan pemakaian), ambang
 * peringatan 30%, preset, dan konversi isian formulir. Jalankan: npx tsx scripts/uji_penyusutan.ts
 */
import {
  AMBANG_PERINGATAN,
  FORM_PENYUSUTAN_AWAL,
  PRESET_ASET,
  PRESET_HABIS_PAKAI,
  cariPreset,
  formDariItem,
  galatForm,
  hitungPenyusutan,
  itemDariForm,
  itemPerluPeringatan,
  mulaiSiklusBaru,
  formatBeban,
  pesanPeringatan,
  perbaruiPemakaian,
  teksSisaUmur,
  terapkanPreset,
} from "../src/lib/penyusutan";
import type { ItemPenyusutan } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}
const dekat = (a: number, b: number, toleransi = 0.01) => Math.abs(a - b) <= toleransi;

const dasar = (o: Partial<ItemPenyusutan>): ItemPenyusutan => ({
  id: "i1",
  nama: "Barang",
  jenisBarang: "aset",
  basis: "waktu",
  metode: "garis-lurus",
  harga: 12000000,
  nilaiResidu: 0,
  umurTotal: 4,
  satuanWaktu: "tahun",
  tanggalMulai: "2024-01-01",
  dibuat: "2024-01-01T00:00:00.000Z",
  ...o,
});

console.log("Garis lurus: D = (C - S) / n; BV = C - D × t; P_sisa = BV / C × 100%");
{
  // C = 12.000.000, S = 2.000.000, n = 4 tahun; 2 tahun berlalu (tepat 731 hari ≈ 2,0014 tahun → hitung pada 2026-01-01)
  const item = dasar({ nilaiResidu: 2000000 });
  const h = hitungPenyusutan(item, "2026-01-01")!;
  cek("beban per tahun = (12 jt - 2 jt) / 4 = 2,5 jt", dekat(h.bebanPerSatuan, 2500000, 1), h.bebanPerSatuan);
  const t = 731 / 365.25;
  cek("umur berjalan ≈ 2 tahun", dekat(h.berjalan, t, 0.0001), h.berjalan);
  cek("nilai buku = C - D × t", dekat(h.nilaiBuku, 12000000 - 2500000 * t, 1), h.nilaiBuku);
  cek("P_sisa = BV / C × 100", dekat(h.persenSisaNilai, ((12000000 - 2500000 * t) / 12000000) * 100, 0.001), h.persenSisaNilai);
  cek("nilai buku tidak turun di bawah nilai residu", hitungPenyusutan(item, "2040-01-01")!.nilaiBuku === 2000000);
}

console.log("Saldo menurun ganda: R = 2 / n; BV = C × (1 - R)^t, minimum S");
{
  const item = dasar({ metode: "saldo-menurun-ganda" });
  const satuTahun = hitungPenyusutan(item, "2025-01-01")!; // 366 hari (2024 kabisat) → t ≈ 1,002
  const t = 366 / 365.25;
  cek("R = 2/4 = 50%: beban tahun pertama 6 jt", dekat(satuTahun.bebanPerSatuan, 6000000, 1), satuTahun.bebanPerSatuan);
  cek("BV = C × 0,5^t", dekat(satuTahun.nilaiBuku, 12000000 * Math.pow(0.5, t), 1), satuTahun.nilaiBuku);
  const berresidu = dasar({ metode: "saldo-menurun-ganda", nilaiResidu: 1500000 });
  cek("nilai buku dibatasi nilai residu", hitungPenyusutan(berresidu, "2034-01-01")!.nilaiBuku === 1500000);
  cek("n ≤ 2 (R ≥ 1) tidak menghasilkan nilai negatif", hitungPenyusutan(dasar({ metode: "saldo-menurun-ganda", umurTotal: 1 }), "2026-01-01")!.nilaiBuku === 0);
  cek("DDB menyusut lebih cepat daripada garis lurus di tahun pertama", satuTahun.nilaiBuku < hitungPenyusutan(dasar({}), "2025-01-01")!.nilaiBuku);
}

console.log("Sisa umur pakai: waktu");
{
  const item = dasar({ jenisBarang: "habis-pakai", umurTotal: 24, satuanWaktu: "bulan", tanggalMulai: "2026-01-01" });
  const h = hitungPenyusutan(item, "2026-07-01")!; // 181 hari berlalu
  const total = 24 * (365.25 / 12);
  cek("sisa hari = total umur (hari) - hari berjalan", h.sisaUmurHari === Math.round(total - 181), h.sisaUmurHari);
  cek("P_umur = sisa / total × 100", dekat(h.persenSisaUmur, ((total - 181) / total) * 100, 0.1), h.persenSisaUmur);
  cek("perkiraan tanggal habis = tanggal beli + total hari", h.tanggalHabis === "2028-01-02", h.tanggalHabis);
  cek("teks sisa umur memuat bulan", /bulan/.test(teksSisaUmur(item, h)), teksSisaUmur(item, h));
  cek("tanggal beli di masa depan: belum berjalan", hitungPenyusutan(item, "2025-06-01")!.berjalan === 0);
}

console.log("Sisa umur pakai: jarak (oli motor)");
{
  const oli = dasar({ jenisBarang: "habis-pakai", basis: "pemakaian", harga: 60000, umurTotal: 2000, satuanWaktu: undefined, satuanPemakaian: "km", pemakaianAwal: 45000, pemakaianSekarang: 46200 });
  const h = hitungPenyusutan(oli, "2026-10-01")!;
  cek("sisa KM = batas - (KM sekarang - KM saat ganti) = 800", h.sisaPemakaian === 800, h.sisaPemakaian);
  cek("P_umur = 800 / 2000 = 40%", dekat(h.persenSisaUmur, 40), h.persenSisaUmur);
  cek("nilai buku garis lurus ikut berdasarkan pemakaian: 60.000 × 40% = 24.000", dekat(h.nilaiBuku, 24000, 0.5), h.nilaiBuku);
  cek("40% belum memicu peringatan", !h.perluPeringatan && h.tingkat === "aman");
  const hampir = hitungPenyusutan({ ...oli, pemakaianSekarang: 46400 }, "2026-10-01")!;
  cek("tepat 30% (sisa 600 km) memicu peringatan (menyentuh ambang)", dekat(hampir.persenSisaUmur, 30) && hampir.perluPeringatan && hampir.tingkat === "mendekati", hampir);
  cek("di bawah 10% = kritis", hitungPenyusutan({ ...oli, pemakaianSekarang: 46850 }, "2026-10-01")!.tingkat === "kritis");
  const lewat = hitungPenyusutan({ ...oli, pemakaianSekarang: 47500 }, "2026-10-01")!;
  cek("melewati batas = habis, sisa 0, nilai buku 0", lewat.tingkat === "habis" && lewat.sisaPemakaian === 0 && lewat.nilaiBuku === 0 && lewat.persenSisaUmur === 0);
  cek("tanpa angka KM sekarang: dianggap belum dipakai", hitungPenyusutan({ ...oli, pemakaianSekarang: undefined }, "2026-10-01")!.persenSisaUmur === 100);
  cek("pesan peringatan menyebut nama dan persentase", /Oli.*30%/.test(pesanPeringatan({ ...oli, nama: "Oli Mesin Motor" }, hampir)) , pesanPeringatan({ ...oli, nama: "Oli Mesin Motor" }, hampir));
}

console.log("Peringatan di bawah/di sekitar 30%: P_sisa ATAU P_umur");
{
  cek(`ambang peringatan ${AMBANG_PERINGATAN}%`, AMBANG_PERINGATAN === 30);
  // DDB: nilai turun lebih cepat daripada umur → P_sisa yang memicu
  const laptop = dasar({ metode: "saldo-menurun-ganda", umurTotal: 4, tanggalMulai: "2024-01-01" });
  const h = hitungPenyusutan(laptop, "2025-12-01")!; // ±1,92 tahun: umur tersisa ±52%, nilai ±26%
  cek("nilai buku ≤ 30% memicu peringatan walau umur masih > 30%", h.persenSisaUmur > 30 && h.persenSisaNilai <= 30 && h.perluPeringatan, [h.persenSisaUmur, h.persenSisaNilai]);
  const daftar = [dasar({ id: "a", tanggalMulai: "2026-09-01" }), laptop, dasar({ id: "c", metode: "garis-lurus", tanggalMulai: "2022-06-01" })];
  const peringatan = itemPerluPeringatan(daftar, "2025-12-01");
  cek("daftar peringatan hanya berisi yang ≤ 30%, paling mendesak dahulu", peringatan.length === 2 && peringatan[0].hasil.persenTerendah <= peringatan[1].hasil.persenTerendah && peringatan.every((x) => x.hasil.persenTerendah <= 30), peringatan.map((x) => [x.item.id, Math.round(x.hasil.persenTerendah)]));
}

console.log("Tampilan beban kecil");
{
  cek("beban besar dibulatkan ke Rupiah utuh", /^Rp 2\.500\.000$/.test(formatBeban(2500000)), formatBeban(2500000));
  cek("beban kecil per km tidak dibulatkan ke bilangan bulat (Rp32,5)", /^Rp 32,5/.test(formatBeban(32.5)), formatBeban(32.5));
}

console.log("Data belum sah");
{
  cek("umur total 0 → tidak dihitung", hitungPenyusutan(dasar({ umurTotal: 0 }), "2026-01-01") === null);
  cek("harga 0 → tidak dihitung", hitungPenyusutan(dasar({ harga: 0 }), "2026-01-01") === null);
}

console.log("Preset");
{
  cek("oli mesin motor: 2.000 km", cariPreset("oli-mesin-motor")?.umur === 2000 && cariPreset("oli-mesin-motor")?.satuanPemakaian === "km");
  cek("oli gardan: 8.000 km", cariPreset("oli-gardan")?.umur === 8000);
  cek("semua preset habis pakai bergaris lurus, semua aset berbasis waktu", PRESET_HABIS_PAKAI.every((p) => p.metode === "garis-lurus" && p.jenis === "habis-pakai") && PRESET_ASET.every((p) => p.jenis === "aset" && p.basis === "waktu"));
  const f = terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true }, cariPreset("aki")!);
  cek("preset aki: waktu 24 bulan, nama terisi", f.basis === "waktu" && f.umurTotal === "24" && f.satuanWaktu === "bulan" && f.nama === "Aki (Accu)", f);
  const f2 = terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true, nama: "Oli Shell Helix" }, cariPreset("oli-mesin-motor")!);
  cek("nama yang diketik pengguna tidak ditimpa preset", f2.nama === "Oli Shell Helix" && f2.basis === "pemakaian" && f2.umurTotal === "2000");
}

console.log("Isian formulir ↔ item");
{
  const form = { ...terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true }, cariPreset("oli-mesin-motor")!), pemakaianAwal: "45000", pemakaianSekarang: "" };
  const item = itemDariForm(form, { id: "p1", transaksiId: "t1", harga: 65000, tanggalTransaksi: "2026-10-20", namaCadangan: "Ganti oli" }, "2026-10-20T01:00:00.000Z")!;
  cek("item dari form: harga, umur, basis, KM awal = KM saat ini", item.harga === 65000 && item.umurTotal === 2000 && item.basis === "pemakaian" && item.pemakaianAwal === 45000 && item.pemakaianSekarang === 45000 && item.satuanPemakaian === "km", item);
  cek("tanggal mulai mengikuti tanggal transaksi", item.tanggalMulai === "2026-10-20");
  cek("barang habis pakai selalu garis lurus", itemDariForm({ ...form, metode: "saldo-menurun-ganda" }, { id: "x", harga: 1000, tanggalTransaksi: "2026-01-01", namaCadangan: "x" })!.metode === "garis-lurus");
  cek("form ↔ item bolak-balik", formDariItem(item).umurTotal === "2000" && formDariItem(item).pemakaianAwal === "45000" && formDariItem(item).aktif);
  cek("galat: umur kosong", galatForm({ ...FORM_PENYUSUTAN_AWAL, aktif: true }, 100000) !== null);
  cek("galat: residu melebihi harga", galatForm({ ...form, nilaiResidu: "999999" }, 65000) !== null);
  cek("tanpa galat bila fitur dimatikan", galatForm({ ...FORM_PENYUSUTAN_AWAL, aktif: false, umurTotal: "" }, 0) === null);
  const baru = mulaiSiklusBaru(perbaruiPemakaian(item, 46900, "2026-12-01", "2026-12-01T00:00:00.000Z"), "2026-12-02");
  cek("diganti: siklus baru dari KM saat ini dan hari ini", baru.tanggalMulai === "2026-12-02" && baru.pemakaianAwal === 46900 && baru.pemakaianSekarang === 46900, baru);
  cek("pembaruan KM tidak boleh kurang dari KM saat ganti", perbaruiPemakaian(item, 100, "2026-12-01").pemakaianSekarang === 45000);
}

if (gagal) {
  console.log(`\n${gagal} uji gagal`);
  process.exit(1);
}
console.log("\nSemua uji lolos");
