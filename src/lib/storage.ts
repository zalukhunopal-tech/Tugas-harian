import { Transaksi, AsetItem, DataHarga } from "../types";
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

export function buatId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function normalisasiTransaksi(p: Partial<Transaksi>): Transaksi {
  return {
    id: p.id || buatId(),
    jenis: p.jenis === "pemasukan" ? "pemasukan" : "pengeluaran",
    dana: p.dana === "Dana Kegiatan" ? "Dana Kegiatan" : DANA_DEFAULT,
    tanggal: p.tanggal || new Date().toISOString().slice(0, 10),
    deskripsi: p.deskripsi || "",
    kategori: p.kategori || "Lain-lain",
    jumlah: Number(p.jumlah) || 0,
    metode: p.metode || "Tunai",
    kaitan: p.kaitan || "",
    catatan: p.catatan || "",
  };
}

export function muatTransaksi(): Transaksi[] {
  const data = bacaJsonStorage<Partial<Transaksi>[]>(STORAGE_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.map(normalisasiTransaksi);
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
