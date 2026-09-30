import { describe, expect, it } from "vitest";
import { addDays, defaultFilters, formatDate, resolveRange, toISO, type DateFilters } from "./dates";

const TODAY = new Date(2026, 8, 30); // 30 Sep 2026 (lokal)
const base: DateFilters = { mode: "range", start: "2026-01-01", end: "2026-09-30", single: "2026-09-15", relative: "30d" };

describe("dates", () => {
  it("toISO memakai tanggal lokal", () => {
    expect(toISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISO(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("addDays melewati batas bulan/tahun", () => {
    expect(toISO(addDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
    expect(toISO(addDays(new Date(2026, 1, 28), 1))).toBe("2026-03-01");
  });

  it("rentang tanggal", () => {
    expect(resolveRange(base, TODAY)).toEqual({ start: "2026-01-01", end: "2026-09-30" });
  });

  it("rentang: akhir sebelum mulai ditolak", () => {
    const r = resolveRange({ ...base, start: "2026-09-30", end: "2026-09-01" }, TODAY);
    expect(r).toHaveProperty("error");
  });

  it("rentang: kosong / tanggal tidak ada ditolak", () => {
    expect(resolveRange({ ...base, start: "" }, TODAY)).toHaveProperty("error");
    expect(resolveRange({ ...base, end: "2026-02-31" }, TODAY)).toHaveProperty("error");
  });

  it("satu tanggal", () => {
    expect(resolveRange({ ...base, mode: "single" }, TODAY)).toEqual({ start: "2026-09-15", end: "2026-09-15" });
    expect(resolveRange({ ...base, mode: "single", single: "" }, TODAY)).toHaveProperty("error");
  });

  it("relatif: 7 dan 30 hari terakhir", () => {
    expect(resolveRange({ ...base, mode: "relative", relative: "7d" }, TODAY)).toEqual({ start: "2026-09-23", end: "2026-09-30" });
    expect(resolveRange({ ...base, mode: "relative", relative: "30d" }, TODAY)).toEqual({ start: "2026-08-31", end: "2026-09-30" });
  });

  it("relatif: citra terbaru meminta 1 scene dalam 60 hari", () => {
    expect(resolveRange({ ...base, mode: "relative", relative: "latest" }, TODAY)).toEqual({ start: "2026-08-01", end: "2026-09-30", limit: 1 });
  });

  it("defaultFilters valid", () => {
    const d = defaultFilters(TODAY);
    expect(d.end).toBe("2026-09-30");
    expect(resolveRange(d, TODAY)).not.toHaveProperty("error");
  });

  it("formatDate", () => {
    expect(formatDate("2026-09-25")).toBe("25 Sep 2026");
    expect(formatDate("2026-05-01")).toBe("1 Mei 2026");
  });
});
