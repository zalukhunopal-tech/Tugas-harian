export type DateMode = "range" | "single" | "relative";
export type RelativeChoice = "latest" | "7d" | "30d";

export interface DateFilters {
  mode: DateMode;
  start: string;
  end: string;
  single: string;
  relative: RelativeChoice;
}

export interface ResolvedRange {
  start: string;
  end: string;
  /** hanya untuk "Citra terbaru": minta 1 scene terbaru yang memenuhi filter */
  limit?: number;
}

/** yyyy-mm-dd menurut tanggal lokal (bukan UTC). */
export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return r;
}

const RE = /^\d{4}-\d{2}-\d{2}$/;
const valid = (s: string) => RE.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && toISO(new Date(s + "T00:00:00")) === s;

export const LATEST_WINDOW_DAYS = 60;

export function resolveRange(f: DateFilters, today: Date = new Date()): ResolvedRange | { error: string } {
  if (f.mode === "single") {
    if (!valid(f.single)) return { error: "Tanggal tidak valid." };
    return { start: f.single, end: f.single };
  }
  if (f.mode === "relative") {
    const end = toISO(today);
    if (f.relative === "latest") return { start: toISO(addDays(today, -LATEST_WINDOW_DAYS)), end, limit: 1 };
    return { start: toISO(addDays(today, f.relative === "7d" ? -7 : -30)), end };
  }
  if (!valid(f.start) || !valid(f.end)) return { error: "Tanggal mulai dan akhir harus diisi dengan benar." };
  if (f.end < f.start) return { error: "Tanggal akhir harus sama dengan atau setelah tanggal mulai." };
  return { start: f.start, end: f.end };
}

export function defaultFilters(today: Date = new Date()): DateFilters {
  const end = toISO(today);
  return { mode: "range", start: toISO(addDays(today, -30)), end, single: end, relative: "30d" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-09-25" -> "25 Sep 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
