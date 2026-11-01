import { StatusUkuranFisik } from "../types";

export interface UmpanBalikPengguna {
  id: string;
  tanggal: string; // ISO
  rating: number; // 1 - 5
  aspek: "posisi" | "jarak" | "ukuran_foto" | "kecukupan_ruang" | "ruang_terbuang" | "keseluruhan";
  catatan: string;
  kategoriKegiatan?: string;
  transaksiId?: string;
}

export interface KoreksiTransaksiUser {
  subkategori?: string;
  lebarKertasMm?: number;
  tinggiKertasMm?: number;
  sumber?: StatusUkuranFisik;
  posisi?: "otomatis" | "samping" | "bawah";
}

export interface PreferensiTataLetak {
  /** Kelonggaran kertas di dalam kotak tempel (padding per sisi), default 3 mm */
  kelonggaranTempelMm: number;
  /** Jarak antara bukti digital dan ruang tempel fisik, default 5 mm */
  jarakPasanganMm: number;
  /** Jarak antarblok transaksi atau antarsubkategori, default 6 mm */
  jarakAntarBlokMm: number;
  /** Posisi pasangan default jika muat */
  posisiPasanganDefault: "otomatis" | "samping" | "bawah";
  /** Koreksi manual pengguna per transaksi */
  koreksiTransaksi: Record<string, KoreksiTransaksiUser>;
  /** Daftar penilaian dan umpan balik pengguna yang tersimpan persisten */
  umpanBalik: UmpanBalikPengguna[];
}

export const PREFERENSI_DEFAULT: PreferensiTataLetak = {
  kelonggaranTempelMm: 3,
  jarakPasanganMm: 5,
  jarakAntarBlokMm: 6,
  posisiPasanganDefault: "otomatis",
  koreksiTransaksi: {},
  umpanBalik: [],
};

const KUNCI_STORAGE = "antigravity_preferensi_tata_letak_v1";
let memoriInProcessPreferensi: PreferensiTataLetak = { ...PREFERENSI_DEFAULT };

export function muatPreferensiTataLetak(): PreferensiTataLetak {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...memoriInProcessPreferensi };
  }
  try {
    const raw = window.localStorage.getItem(KUNCI_STORAGE);
    if (!raw) return { ...PREFERENSI_DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      kelonggaranTempelMm: typeof parsed.kelonggaranTempelMm === "number" ? parsed.kelonggaranTempelMm : PREFERENSI_DEFAULT.kelonggaranTempelMm,
      jarakPasanganMm: typeof parsed.jarakPasanganMm === "number" ? parsed.jarakPasanganMm : PREFERENSI_DEFAULT.jarakPasanganMm,
      jarakAntarBlokMm: typeof parsed.jarakAntarBlokMm === "number" ? parsed.jarakAntarBlokMm : PREFERENSI_DEFAULT.jarakAntarBlokMm,
      posisiPasanganDefault: parsed.posisiPasanganDefault || PREFERENSI_DEFAULT.posisiPasanganDefault,
      koreksiTransaksi: parsed.koreksiTransaksi || {},
      umpanBalik: Array.isArray(parsed.umpanBalik) ? parsed.umpanBalik : [],
    };
  } catch {
    return { ...PREFERENSI_DEFAULT };
  }
}

export function simpanPreferensiTataLetak(p: PreferensiTataLetak): void {
  memoriInProcessPreferensi = { ...p };
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(KUNCI_STORAGE, JSON.stringify(p));
  } catch (e) {
    console.warn("Gagal menyimpan preferensi tata letak ke localStorage:", e);
  }
}

export function simpanUmpanBalikTataLetak(data: Omit<UmpanBalikPengguna, "id" | "tanggal">): UmpanBalikPengguna {
  const pref = muatPreferensiTataLetak();
  const feedback: UmpanBalikPengguna = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tanggal: new Date().toISOString(),
    ...data,
  };
  pref.umpanBalik.unshift(feedback);
  // Simpan maksimal 100 feedback terakhir
  if (pref.umpanBalik.length > 100) pref.umpanBalik = pref.umpanBalik.slice(0, 100);
  simpanPreferensiTataLetak(pref);
  return feedback;
}

export function perbaruiKoreksiTransaksi(transaksiId: string, koreksi: KoreksiTransaksiUser): void {
  const pref = muatPreferensiTataLetak();
  pref.koreksiTransaksi[transaksiId] = {
    ...(pref.koreksiTransaksi[transaksiId] || {}),
    ...koreksi,
  };
  simpanPreferensiTataLetak(pref);
}
