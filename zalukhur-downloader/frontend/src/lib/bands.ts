import type { AppConfig } from "../types";

export const PRESET_LABELS: Record<string, string> = {
  rgb: "RGB",
  false_color: "False Color",
  vegetation: "Vegetasi",
  all: "Semua Band",
};

export type ResampleAction = "native" | "upsample" | "downsample";

export interface BandNote {
  band: string;
  native: number;
  action: ResampleAction;
  /** metode yang benar-benar dipakai backend untuk band ini */
  method: string;
}

/** Band mana yang perlu di-resample pada resolusi keluaran yang dipilih. */
export function resampleNotes(
  bands: string[],
  resolution: number,
  cfg: Pick<AppConfig, "bands">,
  requested = "auto",
): BandNote[] {
  return bands.map((band) => {
    const native = cfg.bands[band]?.native_res ?? resolution;
    const action: ResampleAction = native === resolution ? "native" : native > resolution ? "upsample" : "downsample";
    const auto = action === "downsample" ? "average" : "nearest";
    return { band, native, action, method: action === "native" ? "none" : requested === "auto" ? auto : requested };
  });
}

/** Urutan band mengikuti urutan pemilihan; toggle menambah di akhir. */
export function toggleBand(bands: string[], band: string): string[] {
  return bands.includes(band) ? bands.filter((b) => b !== band) : [...bands, band];
}

export function presetMatches(bands: string[], preset: string[]): boolean {
  return bands.length === preset.length && bands.every((b, i) => b === preset[i]);
}
