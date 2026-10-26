/**
 * Manajemen Multi-Akun Google untuk Catatan Keuangan Harian.
 * Memungkinkan beberapa akun Google login di perangkat yang sama,
 * dengan isolasi data lokal (localStorage) dan sinkronisasi ke Google Drive masing-masing.
 */

export interface AkunGoogleTersimpan {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  terakhirAktif: number;
  token?: string | null;
  tokenTime?: number | null;
}

export const KEY_DAFTAR_AKUN = "keuangan_gdrive_daftar_akun";
export const KEY_AKUN_AKTIF_ID = "keuangan_gdrive_akun_aktif_id";
export const KEY_MIGRASI_AWAL = "keuangan_migrasi_multi_akun_selesai";

/**
 * Buat kunci ID aman dan seragam dari email atau UID
 */
export function buatIdAkun(emailOrUid: string): string {
  if (!emailOrUid) return "tamu";
  return emailOrUid.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

/**
 * Ambil daftar semua akun Google yang pernah masuk di perangkat ini
 */
export function ambilDaftarAkun(): AkunGoogleTersimpan[] {
  try {
    const raw = localStorage.getItem(KEY_DAFTAR_AKUN);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Simpan daftar akun ke localStorage
 */
export function simpanDaftarAkun(daftar: AkunGoogleTersimpan[]): void {
  try {
    localStorage.setItem(KEY_DAFTAR_AKUN, JSON.stringify(daftar));
  } catch (e) {
    console.warn("Gagal menyimpan daftar akun:", e);
  }
}

/**
 * Ambil akun yang saat ini sedang aktif dipilih
 */
export function ambilAkunAktif(): AkunGoogleTersimpan | null {
  try {
    const aktifId = localStorage.getItem(KEY_AKUN_AKTIF_ID);
    if (!aktifId) return null;
    const daftar = ambilDaftarAkun();
    return daftar.find((a) => buatIdAkun(a.email || a.uid) === aktifId) || null;
  } catch {
    return null;
  }
}

/**
 * Set akun aktif di perangkat
 */
export function setAkunAktif(akun: AkunGoogleTersimpan | null): void {
  try {
    if (akun) {
      const id = buatIdAkun(akun.email || akun.uid);
      localStorage.setItem(KEY_AKUN_AKTIF_ID, id);
    } else {
      localStorage.removeItem(KEY_AKUN_AKTIF_ID);
    }
  } catch (e) {
    console.warn("Gagal set akun aktif:", e);
  }
}

/**
 * Tambah atau perbarui data akun dalam daftar akun tersimpan
 */
export function tambahAtauPerbaruiAkun(akun: AkunGoogleTersimpan): void {
  const daftar = ambilDaftarAkun();
  const idTarget = buatIdAkun(akun.email || akun.uid);
  const index = daftar.findIndex((a) => buatIdAkun(a.email || a.uid) === idTarget);

  const dataBaru: AkunGoogleTersimpan = {
    ...akun,
    terakhirAktif: Date.now(),
  };

  if (index >= 0) {
    // Pertahankan token jika tidak diisi pada pembaruan ini
    if (!dataBaru.token && daftar[index].token) {
      dataBaru.token = daftar[index].token;
      dataBaru.tokenTime = daftar[index].tokenTime;
    }
    daftar[index] = dataBaru;
  } else {
    daftar.push(dataBaru);
  }

  simpanDaftarAkun(daftar);
  setAkunAktif(dataBaru);
}

/**
 * Hapus akun dari daftar akun di perangkat
 */
export function hapusAkunDariDaftar(emailOrUid: string): void {
  const idTarget = buatIdAkun(emailOrUid);
  const daftar = ambilDaftarAkun();
  const disaring = daftar.filter((a) => buatIdAkun(a.email || a.uid) !== idTarget);
  simpanDaftarAkun(disaring);

  // Jika akun yang dihapus adalah akun yang sedang aktif, kosongkan akun aktif
  const aktif = ambilAkunAktif();
  if (aktif && buatIdAkun(aktif.email || aktif.uid) === idTarget) {
    if (disaring.length > 0) {
      setAkunAktif(disaring[0]);
    } else {
      setAkunAktif(null);
    }
  }

  // Hapus semua data lokal partisi milik akun ini
  hapusSemuaDataAkun(idTarget);
}

/**
 * Kunci-kunci data lokal yang dipartisi per akun
 */
const KUNCI_DATA_TERPARTISI = [
  "pengeluaran-harian",
  "pengeluaran-harian-anggaran",
  "keuangan-aset",
  "keuangan-harga",
  "keuangan-transaksi-berulang",
  "keuangan-pengaturan",
  "keuangan-utang-piutang",
  "keuangan-target-tabungan",
  "keuangan_profil_pelapor_v1",
  "keuangan_daftar_kegiatan_v1",
  "keuangan-laporan-agenda",
  "keuangan_terhapus_ids",
  "keuangan-sync-antrean",
  "keuangan-timesheet-indeks",
  "keuangan-sync-url",
  "keuangan-sync-kunci",
  "keuangan-sync-terakhir",
];

/**
 * Migrasikan data lama (sebelum ada fitur multi-akun) ke partisi akun pertama yang login
 */
export function migrasiDataLokalKeAkun(akunKey: string): void {
  try {
    const sudahMigrasi = localStorage.getItem(KEY_MIGRASI_AWAL);
    if (sudahMigrasi) return;

    let adaDataDipindahkan = false;
    for (const kunci of KUNCI_DATA_TERPARTISI) {
      const dataLama = localStorage.getItem(kunci);
      const kunciBaru = `keuangan_u_${akunKey}_${kunci}`;
      if (dataLama && !localStorage.getItem(kunciBaru)) {
        localStorage.setItem(kunciBaru, dataLama);
        adaDataDipindahkan = true;
      }
    }

    if (adaDataDipindahkan) {
      localStorage.setItem(KEY_MIGRASI_AWAL, akunKey);
      console.log(`Data lokal lama berhasil dimigrasikan ke partisi akun: ${akunKey}`);
    }
  } catch (e) {
    console.warn("Gagal migrasi data ke akun:", e);
  }
}

/**
 * Hapus seluruh partisi data lokal milik satu akun dari localStorage
 */
export function hapusSemuaDataAkun(akunKey: string): void {
  try {
    const prefix = `keuangan_u_${akunKey}_`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {
    console.warn("Gagal menghapus partisi data akun:", e);
  }
}
