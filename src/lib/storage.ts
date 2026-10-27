import {
  Transaksi,
  AsetItem,
  DataHarga,
  ProfilPelapor,
  DataKegiatan,
  DataKhususKegiatan,
  LaporanKegiatanFileContent,
} from "../types";
import { STORAGE_KEY, BUDGET_KEY, TEMA_KEY, KARAKTER_KEY, SYNC_URL_KEY, SYNC_KUNCI_KEY, SYNC_QUEUE_KEY, SYNC_TIME_KEY, ASET_KEY, HARGA_KEY, DANA_DEFAULT } from "./constants";

import { ambilAkunAktif, buatIdAkun } from "./multiAkun";

const KUNCI_GLOBAL = new Set([
  "keuangan-tema",
  "keuangan-karakter",
  "keuangan-isi-bertahap",
  "app-layout",
  "keuangan_gdrive_daftar_akun",
  "keuangan_gdrive_akun_aktif_id",
  "keuangan_migrasi_multi_akun_selesai",
]);

export function kunciPenyimpanan(kunci: string): string {
  if (KUNCI_GLOBAL.has(kunci)) {
    return kunci;
  }
  const akun = ambilAkunAktif();
  if (!akun) {
    return kunci;
  }
  const idAkun = buatIdAkun(akun.email || akun.uid);
  return `keuangan_u_${idAkun}_${kunci}`;
}

export function bacaStorage(kunci: string, cadangan: string = ""): string {
  try {
    const k = kunciPenyimpanan(kunci);
    const val = localStorage.getItem(k);
    if (val !== null) return val;
    // Cek kunci global lama jika partisi belum memiliki nilai
    if (k !== kunci) {
      const oldVal = localStorage.getItem(kunci);
      if (oldVal !== null) {
        localStorage.setItem(k, oldVal);
        return oldVal;
      }
    }
    return cadangan;
  } catch {
    return cadangan;
  }
}

export function tulisStorage(kunci: string, nilai: string | null | undefined): boolean {
  try {
    const k = kunciPenyimpanan(kunci);
    if (nilai === null || nilai === "" || nilai === undefined) {
      localStorage.removeItem(k);
    } else {
      localStorage.setItem(k, nilai);
    }
    return true;
  } catch {
    return false;
  }
}

export function bacaJsonStorage<T>(kunci: string, cadangan: T): T {
  try {
    const k = kunciPenyimpanan(kunci);
    let raw = localStorage.getItem(k);
    if (!raw && k !== kunci) {
      const oldRaw = localStorage.getItem(kunci);
      if (oldRaw) {
        localStorage.setItem(k, oldRaw);
        raw = oldRaw;
      }
    }
    if (!raw) return cadangan;
    return JSON.parse(raw) as T;
  } catch {
    return cadangan;
  }
}

export const DELETED_KEY = "keuangan_terhapus_ids";

export function muatIdTerhapus(): Set<string> {
  const data = bacaJsonStorage<string[]>(DELETED_KEY, []);
  return new Set(Array.isArray(data) ? data : []);
}

export function simpanIdTerhapus(ids: Set<string> | string[]): void {
  const arr = Array.from(ids);
  tulisStorage(DELETED_KEY, JSON.stringify(arr));
}

export function tambahIdTerhapus(id: string): void {
  if (!id) return;
  const set = muatIdTerhapus();
  set.add(id);
  simpanIdTerhapus(set);
}

export function buatId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

import { normalisasiJenisBukti, petakanKategoriLama, PROFIL_PELAPOR_DEFAULT, PROFIL_PELAPOR_KEY, DAFTAR_KEGIATAN_KEY, LAPORAN_KEGIATAN_KEY } from "./constants";


export function normalisasiTransaksi(p: Partial<Transaksi>): Transaksi {
  const dana = p.dana === "Dana Kegiatan" ? "Dana Kegiatan" : DANA_DEFAULT;
  const rawKategori = p.kategori || "Lain-lain";
  const kategori = petakanKategoriLama(rawKategori, dana);

  return {
    id: p.id || buatId(),
    jenis: p.jenis === "pemasukan" ? "pemasukan" : "pengeluaran",
    dana,
    tanggal: p.tanggal || new Date().toISOString().slice(0, 10),
    deskripsi: p.deskripsi || "",
    kategori,
    jumlah: Number(p.jumlah) || 0,
    metode: p.metode || "Tunai",
    kaitan: p.kaitan || "",
    catatan: p.catatan || "",
    diubah: p.diubah || new Date().toISOString(),
    bukti: Array.isArray(p.bukti) ? p.bukti : [],
    pasanganId: p.pasanganId || undefined,
    isTalangan: Boolean(p.isTalangan),
    statusTalangan: p.statusTalangan || (p.isTalangan ? "belum_diganti" : undefined),
    talanganUntuk: p.talanganUntuk || undefined,
    targetTabunganId: p.targetTabunganId || undefined,
    kegiatanId: p.kegiatanId || undefined,
    detailKegiatan: bakukanDetail(p.detailKegiatan),
  };
}

/** Data lama memakai "Kwitansi"; ejaan baku adalah "Kuitansi". Objek lain tidak disentuh. */
function bakukanDetail(d: DataKhususKegiatan | undefined): DataKhususKegiatan | undefined {
  if (!d) return undefined;
  const jenis = normalisasiJenisBukti(d.jenisBukti);
  return jenis === d.jenisBukti ? d : { ...d, jenisBukti: jenis };
}

export function muatTransaksi(): Transaksi[] {
  const data = bacaJsonStorage<Partial<Transaksi>[]>(STORAGE_KEY, []);
  if (!Array.isArray(data)) return [];
  const terhapus = muatIdTerhapus();
  return data
    .map(normalisasiTransaksi)
    .filter((t) => !terhapus.has(t.id));
}

export function simpanTransaksi(data: Transaksi[]): void {
  tulisStorage(STORAGE_KEY, JSON.stringify(data));
}

// IndexedDB fallback untuk persistensi data Aset offline & antar-sesi
const IDB_ASET_DB = "keuangan_aset_store_db";
const IDB_ASET_STORE = "daftar_aset";

export function bukaDbAset(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak didukung"));
      return;
    }
    const req = indexedDB.open(IDB_ASET_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_ASET_STORE)) {
        db.createObjectStore(IDB_ASET_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function simpanAsetKeIndexedDB(data: AsetItem[]): Promise<void> {
  try {
    const db = await bukaDbAset();
    const tx = db.transaction(IDB_ASET_STORE, "readwrite");
    const store = tx.objectStore(IDB_ASET_STORE);
    store.clear();
    for (const item of data) {
      store.put(item);
    }
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // abaikan jika indexedDB tidak tersedia di sandbox
  }
}

export async function muatAsetDariIndexedDB(): Promise<AsetItem[]> {
  try {
    const db = await bukaDbAset();
    const tx = db.transaction(IDB_ASET_STORE, "readonly");
    const store = tx.objectStore(IDB_ASET_STORE);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve(Array.isArray(req.result) ? (req.result as AsetItem[]) : []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export const ASET_BACKUP_KEY = "keuangan-aset-cadangan-global";

export function muatAset(): AsetItem[] {
  // 1. Coba muat dari partisi akun saat ini
  const data = bacaJsonStorage<AsetItem[]>(ASET_KEY, []);
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }

  // 2. Jika partisi kosong, periksa kunci cadangan global
  try {
    const rawBackup = localStorage.getItem(ASET_BACKUP_KEY);
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Pulihkan ke partisi aktif
        tulisStorage(ASET_KEY, rawBackup);
        return parsed as AsetItem[];
      }
    }
  } catch {}

  // 3. Periksa apakah ada data di kunci lama tanpa partisi
  try {
    const rawGlobal = localStorage.getItem(ASET_KEY);
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      if (Array.isArray(parsed) && parsed.length > 0) {
        tulisStorage(ASET_KEY, rawGlobal);
        return parsed as AsetItem[];
      }
    }
  } catch {}

  // 4. Periksa partisi akun manapun yang ada di localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("keuangan_u_") && k.endsWith("_keuangan-aset")) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            tulisStorage(ASET_KEY, raw);
            return parsed as AsetItem[];
          }
        }
      }
    }
  } catch {}

  return [];
}

export function simpanAset(data: AsetItem[]): void {
  // 1. Simpan ke partisi aktif
  tulisStorage(ASET_KEY, JSON.stringify(data));

  // 2. Jika ada isinya, perbarui juga salinan cadangan global & IndexedDB
  try {
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem(ASET_BACKUP_KEY, JSON.stringify(data));
      // Juga perbarui kunci lama tanpa partisi untuk kompatibilitas
      localStorage.setItem(ASET_KEY, JSON.stringify(data));
      void simpanAsetKeIndexedDB(data);
    } else if (Array.isArray(data) && data.length === 0) {
      // Jika memang sengaja dihapus semua
      void simpanAsetKeIndexedDB([]);
    }
  } catch {}
}

export function muatHarga(): DataHarga {
  return bacaJsonStorage<DataHarga>(HARGA_KEY, {});
}

export function simpanHarga(harga: DataHarga): void {
  tulisStorage(HARGA_KEY, JSON.stringify(harga));
}

export function muatTransaksiBerulang(): import("../types").TransaksiBerulang[] {
  const data = bacaJsonStorage<import("../types").TransaksiBerulang[]>(
    "keuangan-transaksi-berulang",
    []
  );
  return Array.isArray(data) ? data : [];
}

export function simpanTransaksiBerulang(
  data: import("../types").TransaksiBerulang[]
): void {
  tulisStorage("keuangan-transaksi-berulang", JSON.stringify(data));
}

export const PENGATURAN_KEY = "keuangan-pengaturan";
export const UTANG_PIUTANG_KEY = "keuangan-utang-piutang";
export const TARGET_TABUNGAN_KEY = "keuangan-target-tabungan";
export const APP_LOCK_KEY = "keuangan-app-lock";

export function muatUtangPiutang(): import("../types").ItemHutangPiutang[] {
  const data = bacaJsonStorage<import("../types").ItemHutangPiutang[]>(UTANG_PIUTANG_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function simpanUtangPiutang(data: import("../types").ItemHutangPiutang[]): void {
  tulisStorage(UTANG_PIUTANG_KEY, JSON.stringify(data));
}

export function muatTargetTabungan(): import("../types").TargetTabunganItem[] {
  const data = bacaJsonStorage<import("../types").TargetTabunganItem[]>(TARGET_TABUNGAN_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function simpanTargetTabungan(data: import("../types").TargetTabunganItem[]): void {
  tulisStorage(TARGET_TABUNGAN_KEY, JSON.stringify(data));
}

export function muatAppLock(): import("../types").AppLockConfig {
  const bawaan: import("../types").AppLockConfig = {
    enabled: false,
    pinHash: "",
    salt: "",
    webAuthnEnabled: false,
  };
  const data = bacaJsonStorage<import("../types").AppLockConfig>(APP_LOCK_KEY, bawaan);
  return {
    enabled: Boolean(data?.enabled),
    pinHash: data?.pinHash || "",
    salt: data?.salt || "",
    webAuthnEnabled: Boolean(data?.webAuthnEnabled),
    credentialId: data?.credentialId,
    diubah: data?.diubah,
  };
}

export function simpanAppLock(data: import("../types").AppLockConfig): void {
  tulisStorage(APP_LOCK_KEY, JSON.stringify(data));
}

export function muatPengaturan(): import("../types").PengaturanKeuangan {
  const bawaanHarian = Number(bacaStorage(BUDGET_KEY, "0")) || 0;
  const bawaan: import("../types").PengaturanKeuangan = {
    anggaranHarian: bawaanHarian,
    anggaranKategori: {
      "Dana Pribadi": {},
      "Dana Kegiatan": {},
    },
    utangPiutang: muatUtangPiutang(),
    targetTabungan: muatTargetTabungan(),
    appLock: muatAppLock(),
  };
  const data = bacaJsonStorage<import("../types").PengaturanKeuangan>(PENGATURAN_KEY, bawaan);
  return {
    anggaranHarian: typeof data?.anggaranHarian === "number" ? data.anggaranHarian : bawaanHarian,
    anggaranKategori: {
      "Dana Pribadi": data?.anggaranKategori?.["Dana Pribadi"] || {},
      "Dana Kegiatan": data?.anggaranKategori?.["Dana Kegiatan"] || {},
    },
    utangPiutang: Array.isArray(data?.utangPiutang) ? data.utangPiutang : muatUtangPiutang(),
    targetTabungan: Array.isArray(data?.targetTabungan) ? data.targetTabungan : muatTargetTabungan(),
    penyusutan: Array.isArray(data?.penyusutan) ? data.penyusutan : [],
    appLock: data?.appLock || muatAppLock(),
    terakhirDiubah: data?.terakhirDiubah,
    diubah: data?.diubah,
  };
}

export function simpanPengaturan(data: import("../types").PengaturanKeuangan): void {
  tulisStorage(PENGATURAN_KEY, JSON.stringify(data));
  if (typeof data.anggaranHarian === "number") {
    tulisStorage(BUDGET_KEY, String(data.anggaranHarian));
  }
  if (Array.isArray(data.utangPiutang)) {
    simpanUtangPiutang(data.utangPiutang);
  }
  if (Array.isArray(data.targetTabungan)) {
    simpanTargetTabungan(data.targetTabungan);
  }
  if (data.appLock) {
    simpanAppLock(data.appLock);
  }
}



export function muatProfilPelapor(): ProfilPelapor {
  const data = bacaJsonStorage<ProfilPelapor>(PROFIL_PELAPOR_KEY, PROFIL_PELAPOR_DEFAULT);
  return {
    nama: data?.nama || PROFIL_PELAPOR_DEFAULT.nama,
    jabatan: data?.jabatan || PROFIL_PELAPOR_DEFAULT.jabatan,
    lembaga: data?.lembaga || PROFIL_PELAPOR_DEFAULT.lembaga,
    proyek: data?.proyek || PROFIL_PELAPOR_DEFAULT.proyek,
    penyetuju: data?.penyetuju || PROFIL_PELAPOR_DEFAULT.penyetuju,
    diubah: data?.diubah,
  };
}

export function simpanProfilPelapor(profil: ProfilPelapor): void {
  tulisStorage(PROFIL_PELAPOR_KEY, JSON.stringify(profil));
}

export function muatDaftarKegiatan(): DataKegiatan[] {
  const data = bacaJsonStorage<DataKegiatan[]>(DAFTAR_KEGIATAN_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function simpanDaftarKegiatan(daftar: DataKegiatan[]): void {
  tulisStorage(DAFTAR_KEGIATAN_KEY, JSON.stringify(daftar));
}

export function muatLaporanKegiatanFile(): LaporanKegiatanFileContent {
  const trxList = muatTransaksi();
  const rincianMap: Record<string, DataKhususKegiatan> = {};
  for (const t of trxList) {
    if (t.dana === "Dana Kegiatan" && (t.detailKegiatan || t.kegiatanId)) {
      rincianMap[t.id] = {
        ...(t.detailKegiatan || {}),
        kegiatanId: t.kegiatanId || t.detailKegiatan?.kegiatanId,
      };
    }
  }

  const profil = muatProfilPelapor();
  const kegiatan = muatDaftarKegiatan();

  return {
    versi: 1,
    terakhirDiubah: new Date().toISOString(),
    profilPelapor: profil,
    daftarKegiatan: kegiatan,
    rincianTransaksi: rincianMap,
  };
}

export function simpanLaporanKegiatanFile(fileContent: LaporanKegiatanFileContent): void {
  tulisStorage(LAPORAN_KEGIATAN_KEY, JSON.stringify(fileContent));
  if (fileContent.profilPelapor) {
    simpanProfilPelapor(fileContent.profilPelapor);
  }
  if (fileContent.daftarKegiatan) {
    simpanDaftarKegiatan(fileContent.daftarKegiatan);
  }
  if (fileContent.rincianTransaksi) {
    const listTrx = muatTransaksi();
    let adaPerubahan = false;
    const rincianMap = fileContent.rincianTransaksi;
    const updated = listTrx.map((t) => {
      const extra = rincianMap[t.id];
      if (extra && (!t.detailKegiatan || !t.kegiatanId)) {
        adaPerubahan = true;
        return {
          ...t,
          kegiatanId: t.kegiatanId || extra.kegiatanId,
          detailKegiatan: t.detailKegiatan || extra,
        };
      }
      return t;
    });
    if (adaPerubahan) {
      simpanTransaksi(updated);
    }
  }
}


const INDEKS_TIMESHEET_KEY = "keuangan-timesheet-indeks";

/** Nama file timesheet di folder Keuangan pada tarikan terakhir; dipakai menyarankan batch tanpa harus menarik lagi. */
export function muatIndeksTimesheet(): Array<{ nama: string }> {
  const data = bacaJsonStorage<Array<{ nama: string }>>(INDEKS_TIMESHEET_KEY, []);
  return Array.isArray(data) ? data.filter((x) => x && typeof x.nama === "string") : [];
}

export function simpanIndeksTimesheet(nama: string[]): void {
  tulisStorage(INDEKS_TIMESHEET_KEY, JSON.stringify(nama.map((n) => ({ nama: n }))));
}
