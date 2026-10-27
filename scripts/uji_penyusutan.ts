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
  teksUmurTotal,
  terapkanPreset,
} from "../src/lib/penyusutan";
import { PRESET_ASET as ASET_KATALOG, SEMUA_PRESET, cariPresetDariTeks, presetPerKelompok } from "../src/lib/basisDataUmur";
import { BATAS_MINIMAL_ASET, BATAS_MINIMAL_HABIS_PAKAI, nilaiTawaranDepresiasi } from "../src/lib/tawaranDepresiasi";
import { KELOMPOK_PAJAK, RUMUS_DEPRESIASI, SUMBER_RISET } from "../src/lib/pedomanDepresiasi";
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
  cek("oli mesin motor: 2.000 km atau 2 bulan", cariPreset("oli-mesin-motor")?.umur === 2000 && cariPreset("oli-mesin-motor")?.satuanPemakaian === "km" && cariPreset("oli-mesin-motor")?.batasWaktuBulan === 2);
  cek("oli gardan: 8.000 km", cariPreset("oli-gardan")?.umur === 8000);
  cek("semua preset habis pakai bergaris lurus, semua aset berbasis waktu", PRESET_HABIS_PAKAI.every((p) => p.metode === "garis-lurus" && p.jenis === "habis-pakai") && PRESET_ASET.every((p) => p.jenis === "aset" && p.basis === "waktu"));
  const f = terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true }, cariPreset("aki-motor")!);
  cek("preset aki motor: waktu 24 bulan, nama terisi", f.basis === "waktu" && f.umurTotal === "24" && f.satuanWaktu === "bulan" && f.nama === "Aki Motor" && f.batasWaktuBulan === "", f);
  const f2 = terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true, nama: "Oli Shell Helix" }, cariPreset("oli-mesin-motor")!);
  cek("nama yang diketik pengguna tidak ditimpa preset", f2.nama === "Oli Shell Helix" && f2.basis === "pemakaian" && f2.umurTotal === "2000" && f2.batasWaktuBulan === "2");
}

console.log("Basis data umur: kelengkapan dan konsistensi");
{
  cek("id preset unik", new Set(SEMUA_PRESET.map((p) => p.id)).size === SEMUA_PRESET.length);
  cek("setiap preset punya umur > 0, ikon, catatan, rentang, sumber, dan kata kunci", SEMUA_PRESET.every((p) => p.umur > 0 && p.ikon && p.catatan && p.rentang && p.sumber && p.kataKunci.length > 0));
  cek("preset berbasis pemakaian punya satuan; berbasis waktu punya satuan waktu", SEMUA_PRESET.every((p) => (p.basis === "pemakaian" ? Boolean(p.satuanPemakaian) : Boolean(p.satuanWaktu))));
  cek("batas waktu kedua hanya untuk basis pemakaian", SEMUA_PRESET.every((p) => !p.batasWaktuBulan || p.basis === "pemakaian"));
  cek("aset punya kelompok pajak 1–4 bila berasal dari PMK", ASET_KATALOG.filter((p) => p.keyakinan === "sumber").every((p) => p.kelompokPajak && p.kelompokPajak >= 1 && p.kelompokPajak <= 4));
  cek("empat kelompok katalog tampil berurutan", presetPerKelompok().map((g) => g.kelompok).join("|") === "Motor|Mobil|Elektronik|Aset & Perabot", presetPerKelompok().map((g) => g.kelompok));
  const patokan: Array<[string, number, string]> = [
    ["oli-mesin-motor", 2000, "km"], ["oli-gardan", 8000, "km"], ["v-belt", 25000, "km"], ["ban-motor", 40000, "km"], ["minyak-rem", 25000, "km"],
    ["oli-mesin-mobil", 10000, "km"], ["oli-mesin-mobil-mineral", 5000, "km"], ["kampas-rem-mobil", 40000, "km"], ["busi-iridium", 20000, "km"],
  ];
  for (const [id, umur, satuan] of patokan) cek(`${id}: ${umur.toLocaleString("id-ID")} ${satuan}`, cariPreset(id)?.umur === umur && cariPreset(id)?.satuanPemakaian === satuan);
  const waktu: Array<[string, number]> = [["aki-motor", 24], ["aki-mobil", 30], ["wiper", 12], ["baterai-ponsel", 24]];
  for (const [id, bulan] of waktu) cek(`${id}: ${bulan} bulan`, cariPreset(id)?.umur === bulan && cariPreset(id)?.satuanWaktu === "bulan");
  cek("laptop kelompok 1: 4 tahun, mobil kelompok 2: 8 tahun", cariPreset("laptop")?.umur === 4 && cariPreset("laptop")?.kelompokPajak === 1 && cariPreset("mobil-aset")?.umur === 8 && cariPreset("mobil-aset")?.kelompokPajak === 2);
  cek("pedoman PMK: 4/8/16/20 tahun, saldo menurun = 2 × garis lurus", KELOMPOK_PAJAK.map((k) => k.masa).join("|") === "4 tahun|8 tahun|16 tahun|20 tahun" && KELOMPOK_PAJAK.every((k) => parseFloat(k.saldoMenurun.replace(",", ".")) === 2 * parseFloat(k.garisLurus.replace(",", "."))));
  cek("pedoman memuat lima rumus dan sumber riset berupa https", RUMUS_DEPRESIASI.length === 5 && SUMBER_RISET.length >= 10 && SUMBER_RISET.every((x) => x.url.startsWith("https://")));
}

console.log("Jumlah angka tahun (SYD): A = (C - S) × t × (2n - t + 1) / (n(n + 1))");
{
  const item = dasar({ metode: "jumlah-angka-tahun", harga: 10000000, umurTotal: 4, satuanWaktu: "tahun", nilaiResidu: 0 });
  const h1 = hitungPenyusutan({ ...item, tanggalMulai: "2025-01-01" }, "2026-01-01")!; // 365 hari ≈ 0,9993 tahun
  const t = 365 / 365.25;
  cek("beban tahun pertama = 2(C - S)/(n + 1) = 4 jt", dekat(h1.bebanPerSatuan, 4000000, 1), h1.bebanPerSatuan);
  cek("nilai buku = C - akumulasi (rumus kontinu)", dekat(h1.nilaiBuku, 10000000 - (10000000 * t * (2 * 4 - t + 1)) / (4 * 5), 1), h1.nilaiBuku);
  // tepat 2 tahun penuh: 10 jt × (4+3)/10 = 7 jt susut, sisa 3 jt (dihitung dengan t bulat)
  const dua = hitungPenyusutan({ ...item, umurTotal: 24, satuanWaktu: "bulan", tanggalMulai: "2026-01-01" }, "2026-01-01")!;
  cek("belum berjalan: nilai buku = harga", dua.nilaiBuku === 10000000);
  cek("SYD di akhir umur = nilai residu", hitungPenyusutan({ ...item, nilaiResidu: 1000000 }, "2040-01-01")!.nilaiBuku === 1000000);
  const gl = hitungPenyusutan(dasar({ harga: 10000000, umurTotal: 4, tanggalMulai: "2025-01-01" }), "2026-01-01")!;
  const ddb = hitungPenyusutan(dasar({ harga: 10000000, umurTotal: 4, metode: "saldo-menurun-ganda", tanggalMulai: "2025-01-01" }), "2026-01-01")!;
  cek("urutan nilai buku setelah 1 tahun: DDB < SYD < garis lurus", ddb.nilaiBuku < h1.nilaiBuku && h1.nilaiBuku < gl.nilaiBuku, [ddb.nilaiBuku, h1.nilaiBuku, gl.nilaiBuku]);
}

console.log("Batas ganda: km ATAU bulan, mana yang lebih dulu");
{
  const oli = dasar({ jenisBarang: "habis-pakai", basis: "pemakaian", harga: 60000, umurTotal: 2000, satuanWaktu: undefined, satuanPemakaian: "km", batasWaktuBulan: 2, pemakaianAwal: 45000, pemakaianSekarang: 45100, tanggalMulai: "2026-10-01" });
  const awal = hitungPenyusutan(oli, "2026-10-02")!;
  cek("baru diganti: dekat 100%, penentu pemakaian", awal.persenSisaUmur > 94 && awal.penentu === "pemakaian", [awal.persenSisaUmur, awal.penentu]);
  // 2 bulan ≈ 60,875 hari; 50 hari berjalan → waktu tersisa ≈ 17,9%, km tersisa 95% → waktu yang menentukan
  const lamaTakDipakai = hitungPenyusutan(oli, "2026-11-20")!;
  cek("jarang dipakai tetapi sudah 50 hari: waktu menentukan dan memicu peringatan", lamaTakDipakai.penentu === "waktu" && lamaTakDipakai.perluPeringatan && dekat(lamaTakDipakai.persenSisaUmur, (1 - 50 / (2 * (365.25 / 12))) * 100, 0.1), [lamaTakDipakai.persenSisaUmur, lamaTakDipakai.penentu]);
  cek("sisa km tetap dihitung terpisah", lamaTakDipakai.sisaPemakaian === 1900, lamaTakDipakai.sisaPemakaian);
  cek("sisa waktu dalam hari dan tanggal batas tersedia", lamaTakDipakai.sisaWaktuHari === Math.round(2 * (365.25 / 12) - 50) && lamaTakDipakai.tanggalHabis === "2026-12-01", [lamaTakDipakai.sisaWaktuHari, lamaTakDipakai.tanggalHabis]);
  const banyakKm = hitungPenyusutan({ ...oli, pemakaianSekarang: 46500 }, "2026-10-10")!;
  cek("sering dipakai: km menentukan (sisa 500 km = 25%)", banyakKm.penentu === "pemakaian" && dekat(banyakKm.persenSisaUmur, 25, 0.01) && banyakKm.perluPeringatan, [banyakKm.persenSisaUmur, banyakKm.penentu]);
  cek("nilai buku mengikuti batas yang lebih dulu tercapai", dekat(lamaTakDipakai.nilaiBuku, 60000 * (lamaTakDipakai.persenSisaUmur / 100), 0.5), lamaTakDipakai.nilaiBuku);
  cek("lewat batas waktu = habis walau km masih banyak", hitungPenyusutan(oli, "2026-12-15")!.tingkat === "habis");
  cek("teks sisa umur menyebut km dan waktu", /km atau .*(hari|bulan)/.test(teksSisaUmur(oli, lamaTakDipakai)), teksSisaUmur(oli, lamaTakDipakai));
  cek("teks umur total: 2.000 km atau 2 bulan", teksUmurTotal(oli) === "2.000 km atau 2 bulan", teksUmurTotal(oli));
  const tanpaBatas = hitungPenyusutan({ ...oli, batasWaktuBulan: undefined }, "2026-11-20")!;
  cek("tanpa batas waktu: hasil lama tidak berubah", tanpaBatas.penentu === undefined && tanpaBatas.sisaWaktuHari === undefined && dekat(tanpaBatas.persenSisaUmur, 95, 0.01));
  cek("aset berbasis waktu tidak terpengaruh batas waktu", hitungPenyusutan(dasar({ batasWaktuBulan: 1 }), "2026-01-01")!.penentu === undefined);
  cek("galat: batas waktu 0 atau negatif ditolak", galatForm({ ...terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true }, cariPreset("oli-mesin-motor")!), batasWaktuBulan: "-1" }, 60000) !== null);
  const dariForm = itemDariForm(terapkanPreset({ ...FORM_PENYUSUTAN_AWAL, aktif: true }, cariPreset("oli-mesin-motor")!), { id: "o", harga: 60000, tanggalTransaksi: "2026-10-01", namaCadangan: "" })!;
  cek("item dari preset oli membawa batas waktu 2 bulan; kembali ke form tetap 2", dariForm.batasWaktuBulan === 2 && formDariItem(dariForm).batasWaktuBulan === "2");
  cek("beralih ke basis waktu menghapus batas kedua", itemDariForm({ ...formDariItem(dariForm), basis: "waktu", satuanWaktu: "bulan", umurTotal: "6" }, { id: "o", harga: 60000, tanggalTransaksi: "2026-10-01", namaCadangan: "" })!.batasWaktuBulan === undefined);
}

console.log("Pengenalan barang dari uraian");
{
  const id = (teks: string) => cariPresetDariTeks(teks)?.preset.id;
  cek("ganti oli → oli mesin motor (bawaan motor)", id("Ganti oli") === "oli-mesin-motor", id("Ganti oli"));
  cek("oli mobil Avanza → oli mesin mobil", id("Ganti oli Avanza") === "oli-mesin-mobil" && id("Ganti oli mobil") === "oli-mesin-mobil", [id("Ganti oli Avanza"), id("Ganti oli mobil")]);
  cek("oli gardan → oli gardan matic", id("Beli oli gardan Vario") === "oli-gardan", id("Beli oli gardan Vario"));
  cek("aki → aki motor; aki mobil → aki mobil", id("Beli aki") === "aki-motor" && id("Aki mobil baru") === "aki-mobil");
  cek("ban motor vs ban mobil", id("Ganti ban depan") === "ban-motor" && id("Ban mobil 4 buah") === "ban-mobil" && id("Ban Innova") === "ban-mobil", [id("Ganti ban depan"), id("Ban mobil 4 buah"), id("Ban Innova")]);
  cek("busi iridium lebih spesifik daripada busi", id("Busi iridium") === "busi-iridium" && id("Busi") === "busi-motor");
  cek("v-belt dan kampas rem", id("Ganti V-Belt") === "v-belt" && id("Kampas rem depan") === "kampas-rem-motor" && id("Kampas rem mobil") === "kampas-rem-mobil");
  cek("laptop, hp, kamera, meja, AC", id("Laptop Lenovo") === "laptop" && id("HP Samsung") === "ponsel" && id("Kamera mirrorless") === "kamera-elektronik" && id("Meja kerja") === "perabot-kayu" && id("AC 1 PK") === "perabot-logam");
  cek("uraian tak dikenal → tidak cocok", cariPresetDariTeks("Makan siang") === null && cariPresetDariTeks("") === null);
  cek("kata utuh saja: 'bangun' tidak dikira 'ban'", cariPresetDariTeks("Bangun tidur")?.preset.id === undefined);
}

console.log("Tawaran otomatis: hanya barang yang bukan sekali pakai");
{
  const trx = (deskripsi: string, kategori: string, jumlah: number) => ({ jenis: "pengeluaran" as const, deskripsi, kategori, jumlah });
  cek("laptop Rp 8 jt → ditawari dengan preset laptop", nilaiTawaranDepresiasi(trx("Beli laptop", "Belanja Harian", 8000000)).preset?.id === "laptop");
  cek("ganti oli Rp 65 rb → ditawari", nilaiTawaranDepresiasi(trx("Ganti oli mesin", "Transportasi", 65000)).tawar);
  cek("oli di kategori BBM tetap ditawari", nilaiTawaranDepresiasi(trx("Oli Yamalube", "BBM", 60000)).tawar);
  cek("pemasukan tidak pernah ditawari", !nilaiTawaranDepresiasi({ jenis: "pemasukan", deskripsi: "Laptop", kategori: "Pemasukan Lain", jumlah: 9000000 }).tawar);
  cek("makan, bensin, pulsa, tiket → tidak ditawari", !["Makan siang", "Bensin Pertalite", "Pulsa 50rb", "Tiket pesawat", "Kopi"].some((d) => nilaiTawaranDepresiasi(trx(d, "Transportasi", 500000)).tawar));
  cek("kategori sekali pakai (Konsumsi, Akomodasi, Perdiem, Rental) tidak ditawari walau uraiannya cocok", !["Konsumsi", "Akomodasi", "Perdiem", "Rental Kendaraan", "Honorarium & Ganti Hari"].some((k) => nilaiTawaranDepresiasi(trx("Laptop", k, 9000000)).tawar));
  cek("servis AC bukan membeli AC → tidak ditawari", !nilaiTawaranDepresiasi(trx("Servis AC", "Lain-lain", 500000)).tawar);
  cek("sewa laptop tidak ditawari", !nilaiTawaranDepresiasi(trx("Sewa laptop", "Lain-lain", 900000)).tawar);
  cek(`di bawah batas minimal tidak ditawari (habis pakai < ${BATAS_MINIMAL_HABIS_PAKAI}, aset < ${BATAS_MINIMAL_ASET})`, !nilaiTawaranDepresiasi(trx("Oli", "Transportasi", BATAS_MINIMAL_HABIS_PAKAI - 1)).tawar && !nilaiTawaranDepresiasi(trx("Flashdisk", "Belanja Harian", BATAS_MINIMAL_ASET - 1)).tawar);
  const umum = nilaiTawaranDepresiasi(trx("Pembelian genset kecil lapangan XYZ", "Pengadaan Barang & Perlengkapan", 1500000));
  cek("pengadaan barang bernilai besar tanpa kata kunci dikenali tetap ditawari (peralatan kerja)", umum.tawar && umum.preset?.id !== undefined, umum);
  cek("pengadaan kecil tanpa kata kunci tidak ditawari", !nilaiTawaranDepresiasi(trx("Kertas HVS dan map", "Pengadaan Barang & Perlengkapan", 120000)).tawar);
  cek("alasan tawaran terisi", nilaiTawaranDepresiasi(trx("Beli laptop", "Belanja Harian", 8000000)).alasan.length > 10);
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
