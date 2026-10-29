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
import { perkirakanHalamanTempel, pilihUkuranKotak, susunKotakTempel, perluKotakTempel, tinggiBarisLampiran, UKURAN_KOTAK } from "../src/lib/lembarTempel";
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
  let d = tambahPenerima([], "Rudi");
  d = tambahPenerima(d, "  budi   santoso , ANDI;Rudi\nSiti ");
  cek("koma, titik koma, dan baris baru memisahkan nama", d.join("|") === "Rudi|budi santoso|ANDI|Siti", d);
  cek("nama kembar (beda huruf besar) tidak ditambah", tambahPenerima(d, "RUDI").length === d.length);
  cek("hapus nama tanpa peduli huruf besar", hapusPenerima(d, "andi").join("|") === "Rudi|budi santoso|Siti");
  cek("uang harian dan honorarium tidak memakai penerima manfaat", !kategoriBolehPenerima("Perdiem") && !kategoriBolehPenerima("Honorarium & Ganti Hari"));
  cek("akomodasi, transportasi, konsumsi memakainya", ["Akomodasi", "Transportasi", "Konsumsi", "Pengadaan Barang & Perlengkapan"].every(kategoriBolehPenerima));

  console.log("Baris penerima manfaat di laporan");
  const kudapan = trx({ jumlah: 200000, detailKegiatan: { konsumsi: { kudapanPerjalanan: true }, penerimaManfaat: ["Rudi", "Budi", "Andi"] } });
  cek(
    "kudapan: 3 orang (nama @ Rp66.667)",
    barisPenerimaManfaat(kudapan) === "Kudapan/Snack Perjalanan — Penerima Manfaat: 3 orang (Rudi, Budi, Andi @ Rp66.667)",
    barisPenerimaManfaat(kudapan)
  );
  const lebihKecil = trx({ jumlah: 150000, detailKegiatan: { konsumsi: { kudapanPerjalanan: true }, penerimaManfaat: ["A", "B", "C"] } });
  cek("kudapan dengan nominal struk lebih kecil: @ mengikuti nominal riil", /@ Rp50\.000\)$/.test(barisPenerimaManfaat(lebihKecil) ?? ""), barisPenerimaManfaat(lebihKecil));
  cek("kudapan tanpa penerima: tertulis belum dicatat", /belum dicatat/.test(barisPenerimaManfaat(trx({ detailKegiatan: { konsumsi: { kudapanPerjalanan: true } } })) ?? ""));
  cek(
    "kategori lain: Penerima Manfaat: nama, nama",
    barisPenerimaManfaat(trx({ kategori: "Transportasi", detailKegiatan: { penerimaManfaat: ["Rudi", "Budi", "Andi"] } })) === "Penerima Manfaat: Rudi, Budi, Andi"
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
  const kotakPenerima = susunKotakTempel([trx({ id: "z", kategori: "Transportasi", detailKegiatan: { penerimaManfaat: ["Rudi", "Budi"] } })], () => "7");
  cek("kepala kotak satu baris tanpa daftar nama: No | Tanggal | Kategori - Uraian | Rp", !/Penerima Manfaat|Diklaim/.test(kotakPenerima[0].kepala) && /\| Rp/.test(kotakPenerima[0].kepala), kotakPenerima[0].kepala);
  const kotakDiklaim = susunKotakTempel([trx({ id: "z", kategori: "Transportasi", detailKegiatan: { penerimaManfaat: ["Rudi", "Budi"] } })], () => "7", { sertakanTempel: true, namaPelapor: "Pelapor Contoh" });
  cek("baris di bawah kepala: Diklaim untuk pelapor lalu rekan", kotakDiklaim[0].rincian[0] === "Diklaim untuk: Pelapor Contoh, Rudi, Budi", kotakDiklaim[0].rincian);
  const kotakSendiri = susunKotakTempel([trx({ id: "z", kategori: "Transportasi" })], () => "7", { sertakanTempel: true, namaPelapor: "Pelapor Contoh" });
  cek("tanpa rekan: Diklaim untuk pelapor saja", kotakSendiri[0].rincian[0] === "Diklaim untuk: Pelapor Contoh", kotakSendiri[0].rincian);
  const kotakPerdiem = susunKotakTempel([trx({ id: "z", kategori: "Perdiem", bukti: [{ id: "f", nama: "f.jpg", tipe: "image/jpeg", dataUrl: "data:image/jpeg;base64,AA==" }] })], () => "1", { sertakanTempel: true, namaPelapor: "Pelapor Contoh" });
  cek("uang harian: tanpa baris Diklaim untuk", kotakPerdiem[0].rincian.length === 0, kotakPerdiem[0].rincian);

  console.log("Perkiraan halaman lampiran bukti (A4 potret, area 190 × 277 mm)");
  const dari = (u: string, varian: "ringkas" | "terpadu" | "foto" = "ringkas") => [...u].map((k) => ({ ukuran: UKURAN_KOTAK[k as UkuranKotakTempel], varian }));
  cek("ringkas: 4 Tipe A = 1 halaman, 5 = 2 halaman", perkirakanHalamanTempel(dari("AAAA")) === 1 && perkirakanHalamanTempel(dari("AAAAA")) === 2);
  cek("ringkas: 3 Tipe B = 1 halaman, 4 = 2 halaman", perkirakanHalamanTempel(dari("BBB")) === 1 && perkirakanHalamanTempel(dari("BBBB")) === 2);
  cek("ringkas: 2 Tipe C = 1 halaman, 3 = 2 halaman", perkirakanHalamanTempel(dari("CC")) === 1 && perkirakanHalamanTempel(dari("CCC")) === 2);
  cek("ringkas: A berpasangan lalu C = 1 halaman (132 + 132 + jarak)", perkirakanHalamanTempel(dari("AAC")) === 1);
  cek("terpadu (foto + tempel): 2 Tipe A per halaman", perkirakanHalamanTempel(dari("AA", "terpadu")) === 1 && perkirakanHalamanTempel(dari("AAA", "terpadu")) === 2);
  cek("terpadu: Tipe B dan C masing-masing satu halaman", perkirakanHalamanTempel(dari("B", "terpadu")) === 1 && perkirakanHalamanTempel(dari("BB", "terpadu")) === 2 && perkirakanHalamanTempel(dari("CC", "terpadu")) === 2);
  cek("tinggi kartu terpadu: A 132 mm, B 222 mm, C 246 mm", tinggiBarisLampiran({ ukuran: UKURAN_KOTAK.A, varian: "terpadu" }) === 132 && tinggiBarisLampiran({ ukuran: UKURAN_KOTAK.B, varian: "terpadu" }) === 222 && tinggiBarisLampiran({ ukuran: UKURAN_KOTAK.C, varian: "terpadu" }) === 246);
  cek("lembar foto saja: satu halaman tiap foto", perkirakanHalamanTempel(dari("AB", "foto")) === 2);
  cek("tanpa kotak = 0 halaman", perkirakanHalamanTempel([]) === 0);

  console.log("Foto digital dan kotak tempel dalam satu lembar");
  const foto = { id: "f1", nama: "struk.jpg", tipe: "image/jpeg", dataUrl: "data:image/jpeg;base64,AA==" };
  const bukti = susunKotakTempel(
    [trx({ id: "a", kategori: "BBM", bukti: [foto] }), trx({ id: "b", kategori: "Akomodasi" }), trx({ id: "p", kategori: "Perdiem", bukti: [foto] }), trx({ id: "n", kategori: "Konsumsi", jenis: "pemasukan", bukti: [foto] })],
    (id) => id
  );
  cek("pengeluaran berfoto → varian terpadu (foto + tempel dalam satu kartu)", bukti[0].varian === "terpadu" && bukti[0].bukti.length === 1);
  cek("pengeluaran tanpa foto → kotak tempel ringkas", bukti[1].varian === "ringkas" && bukti[1].bukti.length === 0);
  cek("uang harian dan penerimaan berfoto → lembar foto saja (tanpa kotak tempel)", bukti[2].varian === "foto" && bukti[3].varian === "foto");
  const tanpaTempel = susunKotakTempel([trx({ id: "a", kategori: "BBM", bukti: [foto] }), trx({ id: "b", kategori: "Akomodasi" })], (id) => id, { sertakanTempel: false });
  cek("kotak tempel dimatikan: hanya yang berfoto, sebagai lembar foto", tanpaTempel.length === 1 && tanpaTempel[0].varian === "foto");

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
        detailKegiatan: { jenisBukti: "Tiket pesawat/e-ticket", transportasi: { dari: "Jakarta", ke: "Tarakan", moda: "Pesawat" }, penerimaManfaat: ["Rudi", "Budi"] },
      }),
      trx({
        id: "kud",
        tanggal: "2026-09-19",
        deskripsi: "Kudapan perjalanan keberangkatan",
        jumlah: 200000,
        detailKegiatan: { jenisBukti: "Struk thermal (minimarket/SPBU)", konsumsi: { kudapanPerjalanan: true, penyedia: "Toko Contoh" }, penerimaManfaat: ["Rudi", "Budi", "Andi"] },
      }),
      trx({ id: "pd", tanggal: "2026-09-21", kategori: "Perdiem", deskripsi: "Perdiem Contoh · 2026-09-21", jumlah: 200000 }),
    ],
    kegiatan,
    profilPelapor: profil,
  });
  const { teks, xml } = await teksWord(blob);
  cek("pengeluaran pra-kegiatan (17 Sep, sebelum 20 Sep) ikut dilaporkan", /Tiket pesawat keberangkatan/.test(teks));
  cek("daftar nama yang diklaim tampil di dokumen Word: pelapor lalu rekan", new RegExp(`Diklaim untuk: ${profil.nama}, Rudi, Budi`).test(teks), teks.match(/Diklaim untuk[^|]{0,80}/)?.[0]);
  cek(
    "kudapan: rincian penerima dan plafon per orang",
    /Kudapan\/Snack Perjalanan — Penerima Manfaat: 3 orang \(Rudi, Budi, Andi @ Rp66\.667\)/.test(teks),
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
