/**
 * Uji logika pengisian bertahap Dana Kegiatan (src/lib/prasyaratDokumen.ts).
 * Jalankan: npx tsx scripts/uji_prasyarat_dokumen.ts. Keluar dengan kode 1 bila ada yang gagal.
 */
import {
  daftarPrasyarat,
  dokumenFisik,
  galatLangkah,
  indeksLangkah,
  IsianBertahap,
  modaPerluDataSopir,
  saranJenisBukti,
  saranUraian,
  URUTAN_LANGKAH,
} from "../src/lib/prasyaratDokumen";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const dasar = (o: Partial<IsianBertahap> = {}): IsianBertahap => ({
  kegiatanId: "kg1",
  kategori: "Lain-lain",
  tanggal: "2026-10-20",
  deskripsi: "Biaya administrasi",
  jumlah: 50000,
  detail: { jenisBukti: "Kwitansi" },
  jumlahBukti: 1,
  kategoriFotoPendukung: [],
  perdiemRentang: null,
  ...o,
});
const kurangWajib = (i: IsianBertahap) => daftarPrasyarat(i).filter((p) => p.tingkat === "wajib" && !p.terpenuhi).map((p) => p.kunci);

console.log("Urutan langkah");
cek("enam langkah, periksa terakhir", URUTAN_LANGKAH.length === 6 && URUTAN_LANGKAH[5].kunci === "periksa");
cek("indeks langkah", indeksLangkah("kegiatan") === 0 && indeksLangkah("bukti") === 4);

console.log("Galat penahan tombol Lanjut");
cek("jenis: kategori Dana Kegiatan sah", galatLangkah("jenis", dasar({ kategori: "BBM" })) === null);
cek("jenis: kategori Dana Pribadi ditolak", galatLangkah("jenis", dasar({ kategori: "Makan & Minum" })) !== null);
cek("nominal: lengkap", galatLangkah("nominal", dasar()) === null);
cek("nominal: menyebut yang kurang", galatLangkah("nominal", dasar({ deskripsi: " ", jumlah: 0 })) === "Lengkapi uraian, jumlah.");
cek("nominal: rentang perdiem tidak butuh tanggal tunggal", galatLangkah("nominal", dasar({ tanggal: "", perdiemRentang: { hari: 3 } })) === null);
cek("bukti: tidak lengkap tanpa alasan ditahan", galatLangkah("bukti", dasar({ detail: { jenisBukti: "Bukti tidak lengkap" } })) !== null);
cek("bukti: tidak lengkap dengan alasan boleh", galatLangkah("bukti", dasar({ detail: { jenisBukti: "Bukti tidak lengkap", alasanJustifikasi: "Di pedalaman" } })) === null);
cek("rincian: non-perdiem tidak ditahan", galatLangkah("rincian", dasar({ kategori: "BBM" })) === null);
cek("rincian: perdiem tanpa tarif ditahan", galatLangkah("rincian", dasar({ kategori: "Perdiem", detail: { perdiem: { jumlahHari: 2 } } })) === "Isi tarif perdiem per hari.");
cek("rincian: perdiem tanpa hari ditahan", galatLangkah("rincian", dasar({ kategori: "Perdiem", detail: { perdiem: { tarifPerHari: 200000 } } })) === "Isi jumlah hari perdiem.");
cek("rincian: perdiem rentang dengan galat ditahan", galatLangkah("rincian", dasar({ kategori: "Perdiem", detail: { perdiem: { tarifPerHari: 200000 } }, perdiemRentang: { hari: 0, galat: "Tanggal selesai tidak boleh sebelum tanggal mulai." } })) === "Tanggal selesai tidak boleh sebelum tanggal mulai.");
cek("rincian: perdiem rentang sah", galatLangkah("rincian", dasar({ kategori: "Perdiem", detail: { perdiem: { tarifPerHari: 200000 } }, perdiemRentang: { hari: 39 } })) === null);
cek("kegiatan dan periksa tidak pernah menahan", galatLangkah("kegiatan", dasar({ kegiatanId: "" })) === null && galatLangkah("periksa", dasar()) === null);

console.log("Prasyarat umum");
cek("lain-lain lengkap: tidak ada wajib yang kurang", kurangWajib(dasar()).length === 0, kurangWajib(dasar()));
cek("tanpa kegiatan: kegiatan wajib", kurangWajib(dasar({ kegiatanId: "" })).includes("kegiatan"));
cek("bukti tidak lengkap: justifikasi wajib", kurangWajib(dasar({ detail: { jenisBukti: "Bukti tidak lengkap" } })).includes("justifikasi"));
cek("foto bukti dianjurkan, bukan wajib", (() => { const p = daftarPrasyarat(dasar({ jumlahBukti: 0 })).find((x) => x.kunci === "foto-bukti"); return Boolean(p && !p.terpenuhi && p.tingkat === "dianjurkan"); })());
cek("setiap prasyarat menunjuk langkah yang ada", daftarPrasyarat(dasar({ kategori: "Rental Kendaraan" })).every((p) => indeksLangkah(p.langkah) >= 0));

console.log("Prasyarat per kategori");
cek("transportasi speedboat: cukup rute dan moda", kurangWajib(dasar({ kategori: "Transportasi", detail: { transportasi: { dari: "Tanjung Selor", ke: "Tarakan", moda: "Speedboat / Kapal" } } })).length === 0);
cek("transportasi ojek: wajib data sopir", kurangWajib(dasar({ kategori: "Transportasi", detail: { transportasi: { dari: "A", ke: "B", moda: "Ojek" } } })).includes("sopir"));
cek("transportasi ojek lengkap", kurangWajib(dasar({ kategori: "Transportasi", detail: { transportasi: { dari: "A", ke: "B", moda: "Ojek", namaSopir: "Pak Udin", noTelpSopir: "0812", noPolisi: "KU 1 A" } } })).length === 0);
cek("rental: kendaraan, tanggal, timesheet wajib", JSON.stringify(kurangWajib(dasar({ kategori: "Rental Kendaraan", detail: {} }))) === JSON.stringify(["kendaraan", "tgl-sewa", "timesheet"]));
cek("rental lengkap", kurangWajib(dasar({ kategori: "Rental Kendaraan", detail: { rentalKendaraan: { noPolisi: "KU 1", namaPemilik: "Pak A", tanggalMulai: "2026-10-01", tanggalSelesai: "2026-10-03", timesheet: [{ id: "1", tanggal: "2026-10-01", lokasiBasecampRute: "", cakupanAktivitas: "", jarakKm: 0 }] } } })).length === 0);
cek("BBM: km, rute, nopol wajib", JSON.stringify(kurangWajib(dasar({ kategori: "BBM", detail: {} }))) === JSON.stringify(["km", "rute-bbm", "nopol-bbm"]));
cek("akomodasi: penginapan dan tanggal wajib, telp dianjurkan", JSON.stringify(kurangWajib(dasar({ kategori: "Akomodasi", detail: {} }))) === JSON.stringify(["penginapan", "tgl-inap"]));
cek("konsumsi: peserta wajib", kurangWajib(dasar({ kategori: "Konsumsi", detail: {} })).includes("peserta"));
cek("konsumsi: foto kegiatan dianjurkan dan terbaca", daftarPrasyarat(dasar({ kategori: "Konsumsi", kategoriFotoPendukung: ["kegiatan"] })).find((p) => p.kunci === "foto-kegiatan")?.terpenuhi === true);
cek("honorarium: penerima dan absen wajib, tanpa nama penjual", (() => { const d = daftarPrasyarat(dasar({ kategori: "Honorarium & Ganti Hari", detail: {} })); return kurangWajib(dasar({ kategori: "Honorarium & Ganti Hari", detail: {} })).join() === "penerima,absen" && !d.some((p) => p.kunci === "penjual"); })());
cek("pengadaan: rincian barang wajib", kurangWajib(dasar({ kategori: "Pengadaan Barang & Perlengkapan" })).includes("rincian-barang"));
cek("pengadaan dengan rincian lengkap", kurangWajib(dasar({ kategori: "Pengadaan Barang & Perlengkapan", detail: { rincian: { banyaknya: 2, satuan: "unit", hargaSatuan: 50000, total: 100000 } } })).length === 0);
cek("perdiem: tanpa prasyarat bukti/foto", (() => { const d = daftarPrasyarat(dasar({ kategori: "Perdiem", detail: { perdiem: { tarifPerHari: 200000, jumlahHari: 3 } } })); return !d.some((p) => p.langkah === "bukti") && kurangWajib(dasar({ kategori: "Perdiem", detail: { perdiem: { tarifPerHari: 200000, jumlahHari: 3 } } })).length === 0; })());
cek("perdiem rentang dihitung dari rentang", kurangWajib(dasar({ kategori: "Perdiem", tanggal: "", detail: { perdiem: { tarifPerHari: 200000 } }, perdiemRentang: { hari: 39 } })).length === 0);

console.log("Saran");
cek("moda sewaan butuh sopir", modaPerluDataSopir("Travel / Mobil sewa") && modaPerluDataSopir("ojek") && !modaPerluDataSopir("Speedboat / Kapal") && !modaPerluDataSopir(undefined));
cek("jenis bukti disarankan", saranJenisBukti("BBM", {}) === "Struk thermal (minimarket/SPBU)" && saranJenisBukti("Transportasi", { transportasi: { moda: "Pesawat" } }) === "Tiket pesawat/e-ticket" && saranJenisBukti("Transportasi", { transportasi: { moda: "Speedboat / Kapal" } }) === "Tiket" && saranJenisBukti("Konsumsi", {}) === "Kwitansi");
cek("uraian transportasi", saranUraian("Transportasi", { transportasi: { dari: "Tanjung Selor", ke: "Tarakan", moda: "Speedboat / Kapal" } }) === "Transportasi Tanjung Selor – Tarakan (Speedboat / Kapal)");
cek("uraian konsumsi", saranUraian("Konsumsi", { konsumsi: { lokasi: "Balai Desa", jumlahPeserta: 15 } }) === "Konsumsi Balai Desa (15 orang)");
cek("uraian rental tanpa merk", saranUraian("Rental Kendaraan", { rentalKendaraan: { noPolisi: "KU 8899 AB" } }) === "Sewa kendaraan KU 8899 AB");
cek("uraian perdiem", saranUraian("Perdiem", {}) === "Perdiem lapangan" && saranUraian("Perdiem", { perdiem: { keterangan: "Kalimantan" } }) === "Perdiem Kalimantan");
cek("uraian kategori tanpa saran kosong", saranUraian("Lain-lain", {}) === "");
cek("dokumen fisik dari ketentuan", dokumenFisik("Rental Kendaraan").length >= 3 && dokumenFisik("Tidak ada").length === 0);

if (gagal > 0) {
  console.log(`\n${gagal} pengujian GAGAL`);
  process.exit(1);
}
console.log("\nSemua pengujian lolos");
