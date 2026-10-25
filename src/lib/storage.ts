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

export function bacaStorage(kunci: string, cadangan: string = ""): string {
  try {
    const val = localStorage.getItem(kunci);
    return val === null ? cadangan : val;
  } catch {
    return cadangan;
  }
}

export function tulisStorage(kunci: string, nilai: string | null | undefined): boolean {
  try {
    if (nilai === null || nilai === "" || nilai === undefined) {
      localStorage.removeItem(kunci);
    } else {
      localStorage.setItem(kunci, nilai);
    }
    return true;
  } catch {
    return false;
  }
}

export function bacaJsonStorage<T>(kunci: string, cadangan: T): T {
  try {
    const raw = localStorage.getItem(kunci);
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

import { petakanKategoriLama, PROFIL_PELAPOR_DEFAULT, PROFIL_PELAPOR_KEY, DAFTAR_KEGIATAN_KEY, LAPORAN_KEGIATAN_KEY } from "./constants";


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
    detailKegiatan: p.detailKegiatan || undefined,
  };
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

export function muatAset(): AsetItem[] {
  const data = bacaJsonStorage<AsetItem[]>(ASET_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function simpanAset(data: AsetItem[]): void {
  tulisStorage(ASET_KEY, JSON.stringify(data));
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
