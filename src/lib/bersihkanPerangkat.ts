/**
 * Membersihkan data keuangan dari perangkat ini (saat keluar dari sinkron Google Drive, atau atas permintaan).
 * Aplikasi menyalin isi Drive ke penyimpanan browser supaya bisa dipakai tanpa jaringan; salinan itu tidak ikut hilang
 * sendiri ketika akun diputus, dan pada sambungan berikutnya ia ditulis balik ke Drive.
 */

/** Awalan kunci localStorage milik aplikasi. Semua yang berawalan ini dianggap data pengguna kecuali ada di daftar bawah. */
const AWALAN_KUNCI = ["keuangan", "pengeluaran-harian"];

/** Hanya selera tampilan (tema, karakter, tata letak) yang tetap, bukan data milik seseorang. */
export const KUNCI_DIPERTAHANKAN: readonly string[] = ["keuangan-tema", "keuangan-karakter", "keuangan-isi-bertahap", "app-layout"];

/** IndexedDB berisi foto bukti yang menunggu diunggah dan salinan bukti dari Drive. */
export const NAMA_DB_DATA: readonly string[] = ["keuangan_bukti_offline", "keuangan_drive_bukti_cache"];

type PenyimpananMini = Pick<Storage, "length" | "key" | "removeItem">;

/** Kunci yang akan dihapus (tanpa menghapusnya), terurut. */
export function daftarKunciData(penyimpanan: PenyimpananMini): string[] {
  const hasil: string[] = [];
  for (let i = 0; i < penyimpanan.length; i++) {
    const k = penyimpanan.key(i);
    if (k && AWALAN_KUNCI.some((a) => k.startsWith(a)) && !KUNCI_DIPERTAHANKAN.includes(k)) hasil.push(k);
  }
  return hasil.sort();
}

/** Ada data keuangan yang tersimpan di perangkat ini? (false juga bila penyimpanan tak bisa diakses) */
export function adaDataDiPerangkat(): boolean {
  try {
    return daftarKunciData(localStorage).length > 0;
  } catch {
    return false;
  }
}

/** Menghapus semua kunci data dari penyimpanan; mengembalikan kunci yang dihapus. */
export function hapusKunciData(penyimpanan: PenyimpananMini): string[] {
  const kunci = daftarKunciData(penyimpanan);
  for (const k of kunci) penyimpanan.removeItem(k);
  return kunci;
}

function hapusDb(nama: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(nama);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // Ada sambungan lain yang masih terbuka: tutup dulu dengan menunggu; jangan menggantung selamanya.
      req.onblocked = () => setTimeout(resolve, 1500);
    } catch {
      resolve();
    }
  });
}

export interface HasilBersih {
  kunciDihapus: number;
  /** false bila penyimpanan browser tidak bisa diakses (mode privat, diblokir). */
  penyimpananTersedia: boolean;
}

/** Hapus data keuangan dari localStorage dan IndexedDB di perangkat ini. Tidak menyentuh Google Drive. */
export async function bersihkanDataPerangkat(): Promise<HasilBersih> {
  let kunciDihapus = 0;
  let penyimpananTersedia = true;
  try {
    kunciDihapus = hapusKunciData(localStorage).length;
  } catch {
    penyimpananTersedia = false;
  }
  if (typeof indexedDB !== "undefined") await Promise.all(NAMA_DB_DATA.map(hapusDb));
  try {
    sessionStorage.clear();
  } catch {
    // tidak tersedia; tidak ada yang perlu dibersihkan
  }
  return { kunciDihapus, penyimpananTersedia };
}
