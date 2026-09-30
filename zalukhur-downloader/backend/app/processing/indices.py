"""Indeks spektral dihitung dari REFLEKTANSI (DN*scale+offset), bukan DN mentah.

Offset BOA (mis. -0,1) membuat rasio pada DN mentah salah; karena itu konversi dilakukan dulu.
Reflektansi negatif (derau di bawah offset) dipotong ke 0, dan piksel dengan penyebut <= 0 menjadi NoData.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

NODATA = np.float32(-9999.0)

INDICES: dict[str, dict] = {
    "NDVI": {"bands": ("B08", "B04"), "formula": "(B08 - B04) / (B08 + B04)", "label": "Normalized Difference Vegetation Index"},
    "NDWI": {"bands": ("B03", "B08"), "formula": "(B03 - B08) / (B03 + B08)", "label": "Normalized Difference Water Index (McFeeters)"},
    "NBR": {"bands": ("B08", "B12"), "formula": "(B08 - B12) / (B08 + B12)", "label": "Normalized Burn Ratio"},
}


def reflectance(dn: np.ndarray, scale: float, offset: float) -> np.ndarray:
    return np.maximum(dn.astype("float64") * scale + offset, 0.0)


def compute(name: str, a_dn: np.ndarray, b_dn: np.ndarray, a_so: tuple[float, float], b_so: tuple[float, float]) -> np.ndarray:
    """(A - B) / (A + B) untuk pasangan band indeks `name`; NoData = -9999."""
    del name  # rumus sama untuk ketiganya: (pertama - kedua) / (pertama + kedua)
    ra, rb = reflectance(a_dn, *a_so), reflectance(b_dn, *b_so)
    den = ra + rb
    ok = (a_dn != 0) & (b_dn != 0) & (den > 0)
    out = np.full(a_dn.shape, NODATA, dtype="float32")
    with np.errstate(divide="ignore", invalid="ignore"):
        out[ok] = np.clip((ra[ok] - rb[ok]) / den[ok], -1.0, 1.0).astype("float32")
    return out


@dataclass
class Stats:
    count: int = 0
    total: float = 0.0
    lo: float = float("inf")
    hi: float = float("-inf")
    _hist: dict = field(default_factory=dict)

    def add(self, arr: np.ndarray) -> None:
        v = arr[arr != NODATA]
        if v.size:
            self.count += int(v.size)
            self.total += float(v.sum(dtype="float64"))
            self.lo, self.hi = min(self.lo, float(v.min())), max(self.hi, float(v.max()))

    def result(self, inside_px: int) -> dict:
        return {
            "valid_pixels": self.count,
            "valid_pct": round(100 * self.count / max(inside_px, 1), 2),
            "mean": round(self.total / self.count, 5) if self.count else None,
            "min": round(self.lo, 5) if self.count else None,
            "max": round(self.hi, 5) if self.count else None,
        }


# --- warna untuk preview: rampa divergen (nilai -1 .. 1)
_RAMPS = {
    "NDVI": [(-1.0, "#a50026"), (-0.5, "#f46d43"), (0.0, "#ffffbf"), (0.5, "#66bd63"), (1.0, "#006837")],
    "NBR": [(-1.0, "#a50026"), (-0.5, "#f46d43"), (0.0, "#ffffbf"), (0.5, "#66bd63"), (1.0, "#006837")],
    "NDWI": [(-1.0, "#8c510a"), (-0.5, "#d8b365"), (0.0, "#f5f5f5"), (0.5, "#5ab4ac"), (1.0, "#08519c")],
}


def _rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def ramp(name: str) -> list[tuple[float, str]]:
    return _RAMPS[name]


def colorize(values: np.ndarray, name: str) -> np.ndarray:
    """Nilai indeks -> RGB uint8 (h, w, 3) dengan interpolasi linear antar titik warna."""
    stops = _RAMPS[name]
    xs = [s[0] for s in stops]
    out = np.zeros(values.shape + (3,), dtype="uint8")
    for c in range(3):
        ys = [_rgb(s[1])[c] for s in stops]
        out[..., c] = np.interp(np.clip(values, -1, 1), xs, ys).round().astype("uint8")
    return out
