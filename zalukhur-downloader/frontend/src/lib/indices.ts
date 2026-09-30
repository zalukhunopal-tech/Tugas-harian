import type { DownloadOptions, IndexName } from "../types";

/** Rampa warna preview; harus sama dengan backend (app/processing/indices.py). */
export const RAMPS: Record<IndexName, [number, string][]> = {
  NDVI: [[-1, "#a50026"], [-0.5, "#f46d43"], [0, "#ffffbf"], [0.5, "#66bd63"], [1, "#006837"]],
  NBR: [[-1, "#a50026"], [-0.5, "#f46d43"], [0, "#ffffbf"], [0.5, "#66bd63"], [1, "#006837"]],
  NDWI: [[-1, "#8c510a"], [-0.5, "#d8b365"], [0, "#f5f5f5"], [0.5, "#5ab4ac"], [1, "#08519c"]],
};

export const INDEX_HINT: Record<IndexName, string> = {
  NDVI: "Hijau tua = vegetasi rapat; kuning = jarang/terbuka; merah = tanpa vegetasi.",
  NDWI: "Biru = air; cokelat = daratan kering/vegetasi.",
  NBR: "Hijau = vegetasi sehat; kuning–merah = terbuka atau area terbakar.",
};

export function cssGradient(name: IndexName): string {
  const stops = RAMPS[name].map(([v, c]) => `${c} ${((v + 1) / 2) * 100}%`).join(", ");
  return `linear-gradient(to right, ${stops})`;
}

export function previewIndex(mode: string): IndexName | null {
  const up = mode.toUpperCase();
  return up === "NDVI" || up === "NDWI" || up === "NBR" ? up : null;
}

/** Alasan opsi keluaran belum bisa diproses, atau null bila siap. */
export function outputProblem(o: Pick<DownloadOptions, "bands" | "indices" | "change" | "formats">, batch: boolean): string | null {
  if (o.formats.length === 0) return "Pilih minimal satu format keluaran.";
  if (o.bands.length === 0 && o.indices.length === 0 && !o.change.enabled) {
    return "Pilih minimal satu band, indeks, atau deteksi perubahan.";
  }
  if (o.change.enabled && batch) return "Deteksi perubahan belum tersedia untuk batch.";
  if (o.change.enabled && !o.change.reference_scene_id) return "Pilih citra referensi (lebih lama) untuk deteksi perubahan.";
  return null;
}

export const DEFAULT_CHANGE = { enabled: false, index: "NDVI", reference_scene_id: null, threshold: 0.1 } as const;

/** Ringkasan status job batch untuk label. */
export const BATCH_LABEL: Record<string, string> = {
  RUNNING: "Berjalan",
  COMPLETED: "Selesai",
  COMPLETED_WITH_ERRORS: "Selesai sebagian (ada yang gagal)",
  FAILED: "Gagal semua",
};

/** Toggle scene dalam batch, urutan mengikuti urutan daftar hasil (bukan urutan klik) dan dibatasi `max`. */
export function toggleBatch(current: string[], id: string, order: string[], max: number): string[] {
  const set = new Set(current);
  if (set.has(id)) set.delete(id);
  else if (set.size < max) set.add(id);
  return order.filter((x) => set.has(x));
}
