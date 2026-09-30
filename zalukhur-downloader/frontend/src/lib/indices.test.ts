import { describe, expect, it } from "vitest";
import { cssGradient, outputProblem, previewIndex, RAMPS, toggleBatch } from "./indices";

const base = { bands: ["B04"], indices: [], formats: ["geotiff"] as ("geotiff" | "cog")[], change: { enabled: false, index: "NDVI" as const, reference_scene_id: null, threshold: 0.1 } };

describe("indices", () => {
  it("rampa mencakup -1..1 dan gradient valid", () => {
    for (const r of Object.values(RAMPS)) {
      expect(r[0]![0]).toBe(-1);
      expect(r[r.length - 1]![0]).toBe(1);
    }
    expect(cssGradient("NDVI")).toBe(
      "linear-gradient(to right, #a50026 0%, #f46d43 25%, #ffffbf 50%, #66bd63 75%, #006837 100%)",
    );
  });

  it("previewIndex", () => {
    expect(previewIndex("ndvi")).toBe("NDVI");
    expect(previewIndex("true_color")).toBeNull();
  });

  it("outputProblem", () => {
    expect(outputProblem(base, false)).toBeNull();
    expect(outputProblem({ ...base, bands: [] }, false)).toMatch(/minimal satu band/);
    expect(outputProblem({ ...base, bands: [], indices: ["NDVI"] }, false)).toBeNull();          // hanya indeks: boleh
    expect(outputProblem({ ...base, formats: [] }, false)).toMatch(/format/);
    const ch = { ...base.change, enabled: true };
    expect(outputProblem({ ...base, change: ch }, false)).toMatch(/referensi/);
    expect(outputProblem({ ...base, change: { ...ch, reference_scene_id: "x" } }, false)).toBeNull();
    expect(outputProblem({ ...base, change: { ...ch, reference_scene_id: "x" } }, true)).toMatch(/batch/);
  });

  it("toggleBatch menjaga urutan daftar dan batas", () => {
    const order = ["a", "b", "c", "d"];
    let cur: string[] = [];
    cur = toggleBatch(cur, "c", order, 3);
    cur = toggleBatch(cur, "a", order, 3);
    expect(cur).toEqual(["a", "c"]);                    // urutan daftar, bukan urutan klik
    cur = toggleBatch(cur, "d", order, 3);
    expect(toggleBatch(cur, "b", order, 3)).toEqual(["a", "c", "d"]);   // penuh: b ditolak
    expect(toggleBatch(cur, "a", order, 3)).toEqual(["c", "d"]);
  });
});
