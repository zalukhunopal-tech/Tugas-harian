import { DataKhususKegiatan, Transaksi } from "../types";
import { formatRupiah } from "./constants";
import { namaKegiatanSama } from "./kegiatanSama";
import { adalahKudapanPerjalanan, barisPenerimaManfaat, kategoriBolehPenerima, PLAFON_KUDAPAN_PER_ORANG, rapikanNama } from "./penerimaManfaat";

/**
 * Kelengkapan informasi per kategori pengeluaran Dana Kegiatan yang diwajibkan ketentuan SPJ, dalam bentuk baris teks yang sama
 * untuk tabel dokumen siap cetak, kepala lembar bukti, dan dokumen Word. Baris yang datanya belum diisi tidak dicetak.
 */

type JenisTransaksi = Pick<Transaksi, "kategori" | "jenis" | "jumlah" | "detailKegiatan" | "deskripsi">;

const tanggalSingkat = (iso?: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const isi = (...bagian: Array<string | undefined | false>) => bagian.filter((x): x is string => Boolean(x && x.trim())).join(" · ");

/**
 * Nama yang diklaim pada sebuah pengeluaran: pelapor lebih dulu, lalu rekan yang ikut klaim (penerima manfaat), tanpa nama ganda.
 * Kosong untuk kategori yang tidak memakai daftar nama (uang harian dan honorarium sudah punya penerimanya sendiri) dan untuk
 * transaksi yang bukan pengeluaran.
 */
export function namaDiklaim(t: Pick<Transaksi, "kategori" | "jenis" | "detailKegiatan">, namaPelapor: string): string[] {
  if (t.jenis !== "pengeluaran" || !kategoriBolehPenerima(t.kategori)) return [];
  const hasil: string[] = [];
  const ada = new Set<string>();
  for (const mentah of [namaPelapor, ...(t.detailKegiatan?.penerimaManfaat ?? [])]) {
    const nama = rapikanNama(mentah || "");
    if (!nama || ada.has(nama.toLowerCase())) continue;
    ada.add(nama.toLowerCase());
    hasil.push(nama);
  }
  return hasil;
}

/** "Diklaim untuk: Pelapor, Rekan 1, Rekan 2"; hanya pelapor bila tidak ada rekan; null bila tidak ada nama sama sekali. */
export function barisDiklaimUntuk(t: Pick<Transaksi, "kategori" | "jenis" | "detailKegiatan">, namaPelapor: string): string | null {
  const nama = namaDiklaim(t, namaPelapor);
  return nama.length > 0 ? `Diklaim untuk: ${nama.join(", ")}` : null;
}

function kelengkapanTransportasi(moda: string, noPolisi: string): string {
  const m = moda.toLowerCase();
  const bagian: string[] = [];
  if (/pesawat|udara|flight/.test(m)) bagian.push("e-ticket dan boarding pass");
  else if (/speedboat|kapal|ferry|perahu|longboat|bus|kereta|travel|shuttle/.test(m)) bagian.push("tiket");
  else if (/ojek|taksi|taxi|grab|gojek/.test(m)) bagian.push("nota atau bukti pembayaran");
  else bagian.push("tiket atau nota");
  if (noPolisi) bagian.push("STNK kendaraan");
  return bagian.join(" dan ");
}

function barisTransportasi(d: DataKhususKegiatan): string[] {
  const a = d.transportasi;
  if (!a) return [];
  const baris: string[] = [];
  if (a.dari || a.ke) baris.push(`Rute: ${a.dari || "?"} – ${a.ke || "?"}`);
  if (a.moda) baris.push(`Moda: ${a.moda}`);
  if (a.namaSopir || a.noTelpSopir) baris.push(`Sopir: ${isi(a.namaSopir, a.noTelpSopir && `Telp. ${a.noTelpSopir}`)}`);
  if (a.noPolisi) baris.push(`No. polisi: ${a.noPolisi}`);
  if (a.moda || a.noPolisi) baris.push(`Kelengkapan: ${kelengkapanTransportasi(a.moda ?? "", a.noPolisi ?? "")}`);
  return baris;
}

function barisRental(d: DataKhususKegiatan): string[] {
  const r = d.rentalKendaraan;
  if (!r) return [];
  const baris: string[] = [];
  if (r.jenisMerk || r.tahun) baris.push(`Kendaraan: ${isi(r.jenisMerk, r.tahun ? `tahun ${r.tahun}` : "")}`);
  if (r.noPolisi) baris.push(`No. polisi: ${r.noPolisi}`);
  if (r.namaPemilik) baris.push(`Pemilik: ${r.namaPemilik}`);
  const hari = r.jumlahHari ?? 0;
  if (hari > 0 || r.tanggalMulai) {
    const rentang = r.tanggalMulai ? `${tanggalSingkat(r.tanggalMulai)} s.d. ${tanggalSingkat(r.tanggalSelesai || r.tanggalMulai)}` : "";
    baris.push(`Sewa: ${isi(hari > 0 ? `${hari} hari` : "", rentang, r.tarifPerHari ? `@ ${formatRupiah(r.tarifPerHari)}/hari` : "")}`);
  }
  const persen = r.persenGrossUpPajak ?? 0;
  if (r.pajakGrossUpNominal || persen > 0) {
    baris.push(`Gross-up pajak: ${isi(persen > 0 ? `${persen}%` : "", r.pajakGrossUpNominal ? formatRupiah(r.pajakGrossUpNominal) : "")}`);
  }
  const ts = r.timesheet ?? [];
  if (ts.length > 0) {
    const km = ts.reduce((s, x) => s + (x.jarakKm || 0), 0);
    baris.push(`Timesheet rental: ${ts.length} hari${km > 0 ? `, ${km} km` : ""}`);
  }
  baris.push("Kelengkapan: STNK, SIM pengemudi, dan KTP pemilik");
  return baris;
}

function barisBBM(d: DataKhususKegiatan): string[] {
  const b = d.bbm;
  if (!b) return [];
  const baris: string[] = [];
  if (b.kmSaatIsi) baris.push(`KM spidometer saat pengisian: ${b.kmSaatIsi} km`);
  if (b.jarakTempuh) baris.push(`Jarak tempuh: ${b.jarakTempuh} km`);
  if (b.dari || b.ke) baris.push(`Rute: ${b.dari || "?"} – ${b.ke || "?"}`);
  if (b.noPolisi) baris.push(`No. polisi: ${b.noPolisi}`);
  if (b.liter) baris.push(`BBM: ${b.liter} liter${b.hargaPerLiter ? ` @ ${formatRupiah(b.hargaPerLiter)}` : ""}`);
  return baris;
}

function barisAkomodasi(d: DataKhususKegiatan): string[] {
  const a = d.akomodasi;
  if (!a) return [];
  const baris: string[] = [];
  if (a.lokasi) baris.push(`Penginapan: ${a.lokasi}`);
  if (a.tanggalMasuk || a.tanggalKeluar || a.jumlahMalam) {
    baris.push(
      `Menginap: ${isi(
        a.tanggalMasuk && `check-in ${tanggalSingkat(a.tanggalMasuk)}`,
        a.tanggalKeluar && `check-out ${tanggalSingkat(a.tanggalKeluar)}`,
        a.jumlahMalam ? `${a.jumlahMalam} malam` : ""
      )}`
    );
  }
  if (a.namaPemilik || a.noTelp) baris.push(`Pemilik: ${isi(a.namaPemilik, a.noTelp && `Telp. ${a.noTelp}`)}`);
  baris.push("Kelengkapan: fotokopi KTP pemilik penginapan");
  return baris;
}

function barisKonsumsi(t: JenisTransaksi, d: DataKhususKegiatan): string[] {
  const k = d.konsumsi;
  if (!k) return [];
  const baris: string[] = [];
  if (k.penyedia) baris.push(`${k.kudapanPerjalanan ? "Toko/warung" : "Penyedia"}: ${isi(k.penyedia, k.noTelp && `Telp. ${k.noTelp}`)}`);
  else if (k.noTelp) baris.push(`Telp. penyedia: ${k.noTelp}`);
  if (k.lokasi) baris.push(`${k.kudapanPerjalanan ? "Rute" : "Lokasi"}: ${k.lokasi}`);
  if (adalahKudapanPerjalanan(t.kategori, d)) {
    const daftar = barisPenerimaManfaat(t as Pick<Transaksi, "kategori" | "jumlah" | "detailKegiatan">);
    if (daftar) baris.push(daftar);
    baris.push(`Plafon kudapan: ${formatRupiah(PLAFON_KUDAPAN_PER_ORANG)} per orang`);
  } else if (k.jumlahPeserta) {
    baris.push(`Peserta: ${k.jumlahPeserta} orang`);
  }
  return baris;
}

function barisHonorarium(d: DataKhususKegiatan): string[] {
  const h = d.honorarium;
  if (!h) return [];
  const baris: string[] = [];
  if (h.namaPenerima) baris.push(`Penerima: ${h.namaPenerima}`);
  baris.push(`Status: ${h.isPNS ? "PNS" : "Non-PNS"} · NPWP: ${h.hasNPWP ? "ada" : "tidak ada"}`);
  if (h.jumlahOrang || h.jumlahHari) baris.push(`Alokasi: ${h.jumlahOrang ?? 1} orang × ${h.jumlahHari ?? 1} hari`);
  if (h.nomorAbsen) baris.push(`No. absen: ${h.nomorAbsen}`);
  if (h.honorBruto || h.pajakDipotong || h.honorNetto) {
    baris.push(
      `Bruto ${formatRupiah(h.honorBruto ?? 0)} · PPh 21${h.tarifPajakPersen ? ` (${h.tarifPajakPersen}%)` : ""} ${formatRupiah(h.pajakDipotong ?? 0)} · Netto ${formatRupiah(h.honorNetto ?? 0)}`
    );
  }
  return baris;
}

/** Pengadaan Barang & Perlengkapan, Komunikasi, dan Lain-lain: penjual/toko dan surat justifikasi bila bukti tidak lengkap. */
function barisPengadaan(d: DataKhususKegiatan): string[] {
  const baris: string[] = [];
  if (d.namaPenjualPenyedia) baris.push(`Penjual/toko: ${d.namaPenjualPenyedia}`);
  const justifikasi = d.perluSuratJustifikasi || d.jenisBukti === "Bukti tidak lengkap";
  if (justifikasi) {
    baris.push(`Surat Justifikasi: diperlukan karena bukti tidak lengkap${d.alasanJustifikasi ? ` (${d.alasanJustifikasi})` : ""}`);
  }
  return baris;
}

/**
 * Baris kelengkapan khusus kategori (tanpa "Diklaim untuk" dan tanpa rincian jumlah × harga): rute, moda, sopir, kendaraan,
 * penginapan, penyedia, honor, dan seterusnya menurut ketentuan SPJ kategori itu.
 */
export function barisKelengkapan(t: JenisTransaksi): string[] {
  const d = t.detailKegiatan;
  if (!d || t.jenis !== "pengeluaran") return [];
  switch (t.kategori) {
    case "Transportasi":
      return [...barisTransportasi(d), ...penjual(d, "Transportasi")];
    case "Rental Kendaraan":
      return [...barisRental(d), ...penjual(d, "Rental Kendaraan")];
    case "BBM":
      return [...barisBBM(d), ...penjual(d, "BBM")];
    case "Akomodasi":
      return [...barisAkomodasi(d), ...penjual(d, "Akomodasi")];
    case "Konsumsi":
      return [...barisKonsumsi(t, d), ...penjual(d, "Konsumsi")];
    case "Honorarium & Ganti Hari":
      return barisHonorarium(d);
    default:
      return barisPengadaan(d);
  }
}

/** Nama penjual/penyedia umum hanya dicetak untuk kategori yang tidak punya kolom penyedia sendiri. */
function penjual(d: DataKhususKegiatan, kategori: string): string[] {
  const punyaSendiri = kategori === "Konsumsi" ? Boolean(d.konsumsi?.penyedia) : kategori === "Akomodasi" ? Boolean(d.akomodasi?.lokasi) : false;
  return d.namaPenjualPenyedia && !punyaSendiri ? [`Penyedia/penjual: ${d.namaPenjualPenyedia}`] : [];
}

/** Rincian jumlah × harga satuan, uang harian, dan keterangan laporan yang diisi pengguna. */
export function barisRincianDasar(t: JenisTransaksi): string[] {
  const d = t.detailKegiatan;
  if (!d) return [];
  const baris: string[] = [];
  if (d.perdiem?.jumlahHari && d.perdiem?.tarifPerHari) {
    baris.push(`Uang harian ${d.perdiem.jumlahHari} hari × ${formatRupiah(d.perdiem.tarifPerHari)}${d.perdiem.keterangan ? ` (${d.perdiem.keterangan})` : ""}`);
  }
  if (d.rincian) baris.push(`${d.rincian.banyaknya} ${d.rincian.satuan} × ${formatRupiah(d.rincian.hargaSatuan)}`);
  if (d.keteranganLaporan) baris.push(d.keteranganLaporan);
  return baris;
}

/**
 * Seluruh keterangan di bawah uraian sebuah pengeluaran, berurutan: rincian jumlah × harga, kelengkapan kategori, lalu
 * "Diklaim untuk". Dipakai tabel dokumen siap cetak dan dokumen Word.
 */
export function barisRincianLengkap(t: JenisTransaksi, namaPelapor: string): string[] {
  const diklaim = barisDiklaimUntuk(t, namaPelapor);
  const dasar = barisRincianDasar(t);
  const keteranganLaporan = dasar.filter((x) => x === t.detailKegiatan?.keteranganLaporan);
  const hitungan = dasar.filter((x) => !keteranganLaporan.includes(x));
  return [...(diklaim ? [diklaim] : []), ...hitungan, ...barisKelengkapan(t), ...keteranganLaporan];
}

/** Versi ringkas untuk kepala lembar bukti: "Diklaim untuk" lebih dulu, lalu kelengkapan kategori dalam satu paragraf. */
export function barisKepalaBukti(t: JenisTransaksi, namaPelapor: string): string[] {
  const diklaim = barisDiklaimUntuk(t, namaPelapor);
  const kelengkapan = [...barisRincianDasar(t).filter((x) => x !== t.detailKegiatan?.keteranganLaporan), ...barisKelengkapan(t)];
  return [...(diklaim ? [diklaim] : []), ...(kelengkapan.length > 0 ? [kelengkapan.join(" · ")] : [])];
}

const URAIAN_PENERIMAAN_DANA = "Penerimaan Dana Kegiatan";

/**
 * Uraian untuk dokumen. Penerimaan dana lama tersimpan sebagai "Penerimaan Dana <judul kegiatan>"; judul itu sudah ada di kop
 * dokumen dan di kaitan, jadi tidak diulang di setiap baris. Uraian lain dipakai apa adanya.
 */
export function uraianTampil(t: Pick<Transaksi, "jenis" | "deskripsi" | "kaitan" | "kategori">, namaKegiatan?: string): string {
  const uraian = (t.deskripsi || "").trim();
  if (t.jenis !== "pemasukan" || !/^penerimaan dana\b/i.test(uraian)) return uraian;
  const sisa = uraian.replace(/^penerimaan dana\b\s*/i, "").trim();
  if (!sisa) return URAIAN_PENERIMAAN_DANA;
  const judul = [t.kaitan, namaKegiatan].filter((x): x is string => Boolean(x && x.trim()));
  return judul.some((j) => namaKegiatanSama(sisa, j) || sisa.toLowerCase() === j.trim().toLowerCase()) ? URAIAN_PENERIMAAN_DANA : uraian;
}
