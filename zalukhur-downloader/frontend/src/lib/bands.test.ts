import { describe, expect, it } from "vitest";
import { presetMatches, resampleNotes, toggleBand } from "./bands";

const cfg = {
  bands: {
    B01: { label: "Coastal", native_res: 60 },
    B02: { label: "Blue", native_res: 10 },
    B05: { label: "RE1", native_res: 20 },
  },
};

describe("bands", () => {
  it("resolusi 10 m: B02 asli, B05 dan B01 diperbesar (nearest)", () => {
    const n = resampleNotes(["B02", "B05", "B01"], 10, cfg);
    expect(n.map((x) => [x.band, x.action, x.method])).toEqual([
      ["B02", "native", "none"],
      ["B05", "upsample", "nearest"],
      ["B01", "upsample", "nearest"],
    ]);
  });

  it("resolusi 60 m: semua diperkecil (average) kecuali B01", () => {
    const n = resampleNotes(["B02", "B05", "B01"], 60, cfg);
    expect(n.map((x) => [x.action, x.method])).toEqual([["downsample", "average"], ["downsample", "average"], ["native", "none"]]);
  });

  it("metode eksplisit dari pengguna dipakai apa adanya", () => {
    expect(resampleNotes(["B05"], 10, cfg, "cubic")[0]!.method).toBe("cubic");
    expect(resampleNotes(["B05"], 20, cfg, "cubic")[0]!.method).toBe("none");
  });

  it("toggleBand menjaga urutan pemilihan", () => {
    expect(toggleBand(["B04", "B03"], "B02")).toEqual(["B04", "B03", "B02"]);
    expect(toggleBand(["B04", "B03", "B02"], "B03")).toEqual(["B04", "B02"]);
  });

  it("presetMatches peka urutan", () => {
    expect(presetMatches(["B04", "B03", "B02"], ["B04", "B03", "B02"])).toBe(true);
    expect(presetMatches(["B02", "B03", "B04"], ["B04", "B03", "B02"])).toBe(false);
  });
});
