/**
 * Uji penerima manfaat (numpang klaim), kudapan perjalanan, kotak tempel bukti, aturan cetak, dan istilah baku.
 * Jalankan: npx tsx scripts/uji_penerima_manfaat.ts
 */
import JSZip from "jszip";
import { buatDokumenLaporanKegiatanDocx } from "../src/lib/docxGenerator";
import {
  PLAFON_KUDAPAN_PER_ORANG,
  barisPenerimaManfaat,
  hapusPenerima,
  kategoriBolehPenerima,
  plafonKudapan,
  tambahPenerima,
} from "../src/lib/penerimaManfaat";
import { perkirakanHalamanTempel, pilihUkuranKotak, susunKotakTempel, perluKotakTempel, UKURAN_KOTAK } from "../src/lib/lembarTempel";
import { aturanHalaman } from "../src/lib/cetak";
import { labelKategori, normalisasiJenisBukti } from "../src/lib/constants";
import { normalisasiTransaksi } from "../src/lib/storage";
import type { DataKegiatan, ProfilPelapor, Transaksi, UkuranKotakTempel } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

// Penyimpanan browser tidak ada di Node; modul hanya membacanya secara opsional.
const peta = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => peta.get(k) ?? null,
  setItem: (k: string, v: string) => void peta.set(k, v),
  removeItem: (k: string) => void peta.delete(k),
};

const kegiatan: DataKegiatan = {
  id: "kg1",
  nama: "Kegiatan Contoh",
  lokasi: "Kota Contoh",
  tanggalMulai: "2026-09-20",
  tanggalSelesai: "2026-09-25",
  batch: 2,
} as DataKegiatan;
const profil = { nama: "Budi Santoso", jabatan: "Staf", lembaga: "Lembaga Contoh", proyek: "Proyek Contoh", penyetuju: "Sari Wulandari" } as ProfilPelapor;

let urut = 0;
const trx = (o: Partial<Transaksi>): Transaksi => ({
  id: `t${++urut}`,
  jenis: "pengeluaran",
  dana: "Dana Kegiatan",
  tanggal: "2026-09-21",
  deskripsi: "Pengeluaran contoh",
  kategori: "Konsumsi",
  jumlah: 150000,
  metode: "Tunai",
  kaitan: kegiatan.nama,
  catatan: "",
  kegiatanId: kegiatan.id,
  bukti: [],
  ...o,
});

async function teksWord(blob: Blob): Promise<{ teks: string; xml: string }> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  return { xml, teks: xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") };
}

async function main() {
  console.log("Plafon kudapan perjalanan (sepertiga uang harian Kalimantan)");
  cek("per orang Rp66.667", PLAFON_KUDAPAN_PER_ORANG === 66667, PLAFON_KUDAPAN_PER_ORANG);
  cek("3 orang = Rp200.000 (dibulatkan sekali di akhir)", plafonKudapan(3) === 200000, plafonKudapan(3));
  cek("1 orang = 66.667, 2 orang = 133.333, 4 orang = 266.667", plafonKudapan(1) === 66667 && plafonKudapan(2) === 133333 && plafonKudapan(4) === 266667);
  cek("0 orang = 0", plafonKudapan(0) === 0 && plafonKudapan(-1) === 0);

  console.log("Daftar penerima manfaat");
  let d = tambahPenerima([], "Nopal");
  d = tambahPenerima(d, "  budi   santoso , ANDI;Nopal\nSiti ");
  cek("koma, titik koma, dan baris baru memisahkan nama", d.join("|") === "Nopal|budi santoso|ANDI|Siti", d);
  cek("nama kembar (beda huruf besar) tidak ditambah", tambahPenerima(d, "NOPAL").length === d.length);
  cek("hapus nama tanpa peduli huruf besar", hapusPenerima(d, "andi").join("|") === "Nopal|budi santoso|Siti");
  cek("uang harian dan honorarium tidak memakai penerima manfaat", !kategoriBolehPenerima("Perdiem") && !kategoriBolehPenerima("Honorarium & Ganti Hari"));
  cek("akomodasi, transportasi, konsumsi memakainya", ["Akomodasi", "Transportasi", "Konsumsi", "Pengadaan Barang & Perlengkapan"].every(kategoriBolehPenerima));

  console.log("Baris penerima manfaat di laporan");
  const kudapan = trx({ jumlah: 200000, detailKegiatan: { konsumsi: { kudapanPerjalanan: true }, penerimaManfaat: ["Nopal", "Budi", "Andi"] } });
  cek(
    "kudapan: 3 orang (nama @ Rp66.667)",
    barisPenerimaManfaat(kudapan) === "Kudapan/Snack Perjalanan — Penerima Manfaat: 3 orang (Nopal, Budi, Andi @ Rp66.667)",
    barisPenerimaManfaat(kudapan)
  );
  const lebihKecil = trx({ jumlah: 150000, detailKegiatan: { konsumsi: { kudapanPerjalanan: true }, penerimaManfaat: ["A", "B", "C"] } });
  cek("kudapan dengan nominal struk lebih kecil: @ mengikuti nominal riil", /@ Rp50\.000\)$/.test(barisPenerimaManfaat(lebihKecil) ?? ""), barisPenerimaManfaat(lebihKecil));
  cek("kudapan tanpa penerima: tertulis belum dicatat", /belum dicatat/.test(barisPenerimaManfaat(trx({ detailKegiatan: { konsumsi: { kudapanPerjalanan: true } } })) ?? ""));
  cek(
    "kategori lain: Penerima Manfaat: nama, nama",
    barisPenerimaManfaat(trx({ kategori: "Transportasi", detailKegiatan: { penerimaManfaat: ["Nopal", "Budi", "Andi"] } })) === "Penerima Manfaat: Nopal, Budi, Andi"
  );
  cek("tanpa penerima: tidak ada baris", barisPenerimaManfaat(trx({ kategori: "Transportasi" })) === null);

  console.log("Ukuran kotak tempel");
  const ukuran = (kategori: string, detail: Transaksi["detailKegiatan"] = {}) => pilihUkuranKotak({ kategori, detailKegiatan: detail });
  cek("struk thermal → Tipe A", ukuran("BBM", { jenisBukti: "Struk thermal (minimarket/SPBU)" }) === "A");
  cek("tiket pesawat dan tiket → Tipe B", ukuran("Transportasi", { jenisBukti: "Tiket pesawat/e-ticket" }) === "B" && ukuran("Transportasi", { jenisBukti: "Tiket" }) === "B");
  cek("invoice + kuitansi → Tipe C", ukuran("Pengadaan Barang & Perlengkapan", { jenisBukti: "Invoice + kuitansi" }) === "C");
  cek("kuitansi biasa mengikuti kategori: Akomodasi B, Konsumsi A, Pengadaan C", ukuran("Akomodasi", { jenisBukti: "Kuitansi" }) === "B" && ukuran("Konsumsi", { jenisBukti: "Kuitansi" }) === "A" && ukuran("Pengadaan Barang & Perlengkapan", { jenisBukti: "Kuitansi" }) === "C");
  cek("ojek → Tipe A", ukuran("Transportasi", { jenisBukti: "Kuitansi", transportasi: { moda: "Ojek" } }) === "A");
  cek("pilihan manual menang atas otomatis", ukuran("Akomodasi", { jenisBukti: "Kuitansi", kotakTempel: "C" }) === "C");
  cek("ukuran sesuai spesifikasi (92×132, 190×88, 190×132 mm)", (["A", "B", "C"] as UkuranKotakTempel[]).map((k) => `${UKURAN_KOTAK[k].lebarMm}x${UKURAN_KOTAK[k].tinggiMm}`).join(",") === "92x132,190x88,190x132");

  console.log("Kotak tempel menurut urutan laporan");
  const semua = [
    trx({ id: "a", kategori: "BBM" }),
    trx({ id: "p", kategori: "Perdiem" }),
    trx({ id: "m", jenis: "pemasukan", kategori: "Penerimaan Dana" }),
    trx({ id: "b", kategori: "Akomodasi" }),
  ];
  const kotak = susunKotakTempel(semua, (id) => ({ a: "1", b: "2" } as Record<string, string>)[id]);
  cek("uang harian dan pemasukan tidak dapat kotak", kotak.map((k) => k.id).join("") === "ab" && !perluKotakTempel(semua[1]) && !perluKotakTempel(semua[2]));
  cek("kepala kotak: No. | Tanggal | Kategori - Uraian | Rp", /^No\. 1 \| 21\/09\/2026 \| BBM - Pengeluaran contoh \| Rp/.test(kotak[0].kepala), kotak[0].kepala);
  const kotakPenerima = susunKotakTempel([trx({ id: "z", kategori: "Transportasi", detailKegiatan: { penerimaManfaat: ["Nopal", "Budi"] } })], () => "7");
  cek("kepala kotak memuat Penerima Manfaat", /\| Penerima Manfaat: Nopal, Budi \| Rp/.test(kotakPenerima[0].kepala), kotakPenerima[0].kepala);

  console.log("Perkiraan halaman lembar tempel (A4 potret, area 190 × 277 mm)");
  const dari = (u: string) => [...u].map((k) => ({ ukuran: UKURAN_KOTAK[k as UkuranKotakTempel] }));
  cek("4 Tipe A = 1 halaman, 5 = 2 halaman", perkirakanHalamanTempel(dari("AAAA")) === 1 && perkirakanHalamanTempel(dari("AAAAA")) === 2);
  cek("3 Tipe B = 1 halaman, 4 = 2 halaman", perkirakanHalamanTempel(dari("BBB")) === 1 && perkirakanHalamanTempel(dari("BBBB")) === 2);
  cek("2 Tipe C = 1 halaman, 3 = 2 halaman", perkirakanHalamanTempel(dari("CC")) === 1 && perkirakanHalamanTempel(dari("CCC")) === 2);
  cek("A berpasangan lalu C = 1 halaman (132 + 132 + jarak)", perkirakanHalamanTempel(dari("AAC")) === 1);
  cek("tanpa kotak = 0 halaman", perkirakanHalamanTempel([]) === 0);

  console.log("Aturan halaman cetak");
  cek("semua: tanpa suntikan (halaman bernama di CSS)", aturanHalaman("semua") === null);
  cek("timesheet: A4 landscape", /size: A4 landscape/.test(aturanHalaman("timesheet") ?? ""));
  cek("klaim: A4 portrait", /size: A4 portrait/.test(aturanHalaman("klaim") ?? ""));

  console.log("Istilah baku");
  cek("kategori Perdiem tampil sebagai Uang Harian, lainnya tetap", labelKategori("Perdiem") === "Uang Harian" && labelKategori("Konsumsi") === "Konsumsi" && labelKategori(undefined) === "");
  cek("jenis bukti lama 'Kwitansi' dibakukan menjadi 'Kuitansi'", normalisasiJenisBukti("Kwitansi") === "Kuitansi" && normalisasiJenisBukti("Invoice + kwitansi") === "Invoice + kuitansi");
  const lama = normalisasiTransaksi({ id: "x", jenis: "pengeluaran", dana: "Dana Kegiatan", detailKegiatan: { jenisBukti: "Kwitansi" as any } });
  cek("transaksi lama yang dimuat memakai ejaan baku", lama.detailKegiatan?.jenisBukti === "Kuitansi");

  console.log("Dokumen Word: pra-kegiatan, penerima manfaat, kudapan, istilah baku");
  const blob = await buatDokumenLaporanKegiatanDocx({
    transaksi: [
      trx({ id: "d", jenis: "pemasukan", kategori: "Penerimaan Dana", deskripsi: "Dana awal", jumlah: 5000000, tanggal: "2026-09-18" }),
      // pra-kegiatan: tiket keberangkatan dibeli sebelum tanggal mulai kegiatan
      trx({
        id: "pra",
        tanggal: "2026-09-17",
        kategori: "Transportasi",
        deskripsi: "Tiket pesawat keberangkatan",
        jumlah: 1850000,
        detailKegiatan: { jenisBukti: "Tiket pesawat/e-ticket", transportasi: { dari: "Jakarta", ke: "Tarakan", moda: "Pesawat" }, penerimaManfaat: ["Nopal", "Budi"] },
      }),
      trx({
        id: "kud",
        tanggal: "2026-09-19",
        deskripsi: "Kudapan perjalanan keberangkatan",
        jumlah: 200000,
        detailKegiatan: { jenisBukti: "Struk thermal (minimarket/SPBU)", konsumsi: { kudapanPerjalanan: true, penyedia: "Toko Contoh" }, penerimaManfaat: ["Nopal", "Budi", "Andi"] },
      }),
      trx({ id: "pd", tanggal: "2026-09-21", kategori: "Perdiem", deskripsi: "Perdiem Contoh · 2026-09-21", jumlah: 200000 }),
    ],
    kegiatan,
    profilPelapor: profil,
  });
  const { teks, xml } = await teksWord(blob);
  cek("pengeluaran pra-kegiatan (17 Sep, sebelum 20 Sep) ikut dilaporkan", /Tiket pesawat keberangkatan/.test(teks));
  cek("penerima manfaat tampil di dokumen Word", /Penerima Manfaat: Nopal, Budi/.test(teks));
  cek(
    "kudapan: rincian penerima dan plafon per orang",
    /Kudapan\/Snack Perjalanan — Penerima Manfaat: 3 orang \(Nopal, Budi, Andi @ Rp66\.667\)/.test(teks),
    teks.match(/Kudapan[^|]{0,120}/)?.[0]
  );
  cek("kudapan memakai label toko/warung, bukan penyedia konsumsi", /Toko\/Warung Pembelian: Toko Contoh/.test(teks));
  cek("uang harian: kop timesheet baku", /Uang Harian \(Per Diem\) Kegiatan Lapangan/.test(teks) && !/Perdiem Kegiatan Lapangan/.test(teks));
  cek("tidak ada ejaan 'kwitansi' di dokumen", !/kwitansi/i.test(xml));

  if (gagal) {
    console.log(`\n${gagal} uji gagal`);
    process.exit(1);
  }
  console.log("\nSemua uji lolos");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
