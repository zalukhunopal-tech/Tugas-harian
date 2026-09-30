import { describe, expect, it } from "vitest";
import { DEFAULT_CLOUD_MASK, maskProblem, methodLabel, togglePrevious } from "./cloud";

describe("cloud", () => {
  it("togglePrevious menjaga urutan klik dan batas 5", () => {
    let ids: string[] = [];
    for (const x of ["a", "b", "c"]) ids = togglePrevious(ids, x);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(togglePrevious(ids, "b")).toEqual(["a", "c"]);
    const full = ["1", "2", "3", "4", "5"];
    expect(togglePrevious(full, "6")).toEqual(full);
  });

  it("maskProblem", () => {
    expect(maskProblem(DEFAULT_CLOUD_MASK)).toBeNull();
    expect(maskProblem({ ...DEFAULT_CLOUD_MASK, enabled: true })).toBeNull();
    expect(maskProblem({ ...DEFAULT_CLOUD_MASK, enabled: true, classes: [] })).toMatch(/kelas/);
    expect(maskProblem({ ...DEFAULT_CLOUD_MASK, enabled: true, fill_from_previous: true })).toMatch(/sebelumnya/);
    expect(maskProblem({ ...DEFAULT_CLOUD_MASK, enabled: true, fill_from_previous: true, previous_scene_ids: ["x"] })).toBeNull();
  });

  it("methodLabel", () => {
    const on = { ...DEFAULT_CLOUD_MASK, enabled: true };
    expect(methodLabel(DEFAULT_CLOUD_MASK)).toBe("Tanpa cloud masking");
    expect(methodLabel(on)).toMatch(/NoData/);
    expect(methodLabel({ ...on, fill_from_previous: true, previous_scene_ids: ["a"] })).toMatch(/1 citra sebelumnya/);
    expect(methodLabel({ ...on, fill_from_previous: true, previous_scene_ids: ["a", "b"] })).toMatch(/multi-tanggal \(2/);
    // fill dimatikan -> abaikan id yang tersisa
    expect(methodLabel({ ...on, fill_from_previous: false, previous_scene_ids: ["a", "b"] })).toMatch(/NoData/);
  });
});
