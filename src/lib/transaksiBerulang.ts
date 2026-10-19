import { Transaksi, TransaksiBerulang } from "../types";
import { buatId } from "./storage";

/**
 * Format tanggal YYYY-MM-DD
 */
export function formatTanggalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Menghitung tanggal jatuh tempo berikutnya untuk transaksi berulang
 */
export function hitungTanggalBerikutnya(item: TransaksiBerulang): string {
  const sekarang = new Date();
  const th = sekarang.getFullYear();
  const bl = sekarang.getMonth(); // 0-indexed

  if (item.frekuensi === "harian") {
    // Setiap hari
    if (!item.terakhirDiterapkan) return formatTanggalIso(sekarang);
    const last = new Date(item.terakhirDiterapkan);
    last.setDate(last.getDate() + 1);
    return formatTanggalIso(last);
  }

  if (item.frekuensi === "mingguan") {
    // Setiap minggu pada hari tertentu (default hari ini atau item.hariDalamMinggu)
    const targetHari = item.hariDalamMinggu ?? sekarang.getDay();
    const d = new Date(sekarang);
    const selisih = (targetHari - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + selisih);
    return formatTanggalIso(d);
  }

  if (item.frekuensi === "bulanan") {
    // Setiap bulan pada tanggal tertentu (misal tgl 25)
    const targetTgl = item.hariDalamBulan || new Date(item.tanggalMulai).getDate() || 1;
    // Cek apakah bulan ini sudah lewat tanggal target
    const targetBulanIni = new Date(th, bl, targetTgl);
    if (item.terakhirDiterapkan && item.terakhirDiterapkan.startsWith(`${th}-${String(bl + 1).padStart(2, "0")}`)) {
      // Bulan ini sudah pernah diterapkan, maka jadwal berikutnya bulan depan
      const blnDepan = new Date(th, bl + 1, targetTgl);
      return formatTanggalIso(blnDepan);
    }
    return formatTanggalIso(targetBulanIni);
  }

  if (item.frekuensi === "tahunan") {
    const awal = new Date(item.tanggalMulai);
    const target = new Date(th, awal.getMonth(), awal.getDate());
    if (item.terakhirDiterapkan && item.terakhirDiterapkan.startsWith(String(th))) {
      return formatTanggalIso(new Date(th + 1, awal.getMonth(), awal.getDate()));
    }
    return formatTanggalIso(target);
  }

  return formatTanggalIso(sekarang);
}

/**
 * Memeriksa apakah transaksi berulang saat ini sudah jatuh tempo dan siap diterapkan
 */
export function apakahJatuhTempo(item: TransaksiBerulang): boolean {
  if (!item.aktif) return false;

  const hariIniStr = formatTanggalIso(new Date());
  const tglMulai = item.tanggalMulai || hariIniStr;

  // Jika tanggal mulai masih di masa depan
  if (hariIniStr < tglMulai) return false;

  const sekarang = new Date();
  const th = sekarang.getFullYear();
  const blStr = `${th}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;

  if (item.frekuensi === "harian") {
    return !item.terakhirDiterapkan || item.terakhirDiterapkan < hariIniStr;
  }

  if (item.frekuensi === "mingguan") {
    if (!item.terakhirDiterapkan) return true;
    const lastDate = new Date(item.terakhirDiterapkan);
    const diffMs = sekarang.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
  }

  if (item.frekuensi === "bulanan") {
    // Belum diterapkan di bulan ini
    const targetTgl = item.hariDalamBulan || new Date(item.tanggalMulai).getDate() || 1;
    const sudahBulanIni = item.terakhirDiterapkan && item.terakhirDiterapkan.startsWith(blStr);
    if (sudahBulanIni) return false;
    // Jatuh tempo jika tanggal hari ini >= target tanggal bulan ini
    return sekarang.getDate() >= targetTgl;
  }

  if (item.frekuensi === "tahunan") {
    const sudahTahunIni = item.terakhirDiterapkan && item.terakhirDiterapkan.startsWith(String(th));
    if (sudahTahunIni) return false;
    const awal = new Date(item.tanggalMulai);
    return (
      sekarang.getMonth() > awal.getMonth() ||
      (sekarang.getMonth() === awal.getMonth() && sekarang.getDate() >= awal.getDate())
    );
  }

  return false;
}

/**
 * Membuat data Transaksi baru dari template TransaksiBerulang
 */
export function buatTransaksiDariBerulang(
  item: TransaksiBerulang,
  tanggalTransaksi?: string
): Transaksi {
  const tgl = tanggalTransaksi || formatTanggalIso(new Date());
  return {
    id: buatId(),
    jenis: item.jenis,
    dana: item.dana,
    tanggal: tgl,
    deskripsi: item.nama,
    kategori: item.kategori,
    jumlah: Number(item.jumlah) || 0,
    metode: item.metode || "Tunai",
    kaitan: item.kaitan || "",
    catatan: item.catatan ? `${item.catatan} (Otomatis Rutin ${item.frekuensi})` : `Otomatis Rutin ${item.frekuensi}`,
  };
}
