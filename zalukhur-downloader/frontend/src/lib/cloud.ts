import type { CloudMaskOptions } from "../types";

export const DEFAULT_CLOUD_MASK: CloudMaskOptions = {
  enabled: false,
  classes: ["cloud", "cloud_shadow", "cirrus"],
  dilate_m: 20,
  fill_from_previous: false,
  previous_scene_ids: [],
  auto_previous: 0,
  auto_lookback_days: 45,
  include_qa: true,
};

/** Tambah/hapus citra sebelumnya; urutan klik = urutan prioritas pengisian (maks 5). */
export function togglePrevious(ids: string[], id: string, max = 5): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= max ? ids : [...ids, id];
}

/** Alasan opsi cloud mask belum bisa diproses, atau null bila siap. */
export function maskProblem(cm: CloudMaskOptions): string | null {
  if (!cm.enabled) return null;
  if (cm.classes.length === 0) return "Pilih minimal satu kelas untuk di-mask.";
  if (cm.fill_from_previous && cm.previous_scene_ids.length === 0 && cm.auto_previous === 0) {
    return "Pilih minimal satu citra sebelumnya.";
  }
  return null;
}

/** Metode yang akan dijalankan, untuk ringkasan di UI. */
export function methodLabel(cm: CloudMaskOptions): string {
  if (!cm.enabled) return "Tanpa cloud masking";
  const n = cm.fill_from_previous ? cm.previous_scene_ids.length || cm.auto_previous : 0;
  if (n === 0) return "Mask SCL (piksel awan menjadi NoData)";
  if (n === 1) return "Mask SCL + isi dari 1 citra sebelumnya";
  return `Mask SCL + komposit multi-tanggal (${n} citra sebelumnya)`;
}
