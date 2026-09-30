"""Deteksi perubahan antara dua tanggal berdasarkan selisih indeks spektral."""
from __future__ import annotations

import numpy as np

from app.processing.indices import NODATA

# Δ = indeks citra utama (terbaru) − indeks citra referensi (lebih lama)
CLASS_NODATA = 0
CLASS_DECREASE, CLASS_STABLE, CLASS_INCREASE = 1, 2, 3
CLASS_LEGEND = {
    "1": "penurunan (Δ < −ambang)",
    "2": "tidak berubah signifikan (|Δ| ≤ ambang)",
    "3": "kenaikan (Δ > ambang)",
    "0": "NoData (di luar AOI, berawan pada salah satu tanggal, atau tanpa data)",
}


def difference(cur: np.ndarray, ref: np.ndarray) -> np.ndarray:
    """Selisih hanya di piksel yang valid pada KEDUA tanggal; lainnya NoData."""
    out = np.full(cur.shape, NODATA, dtype="float32")
    ok = (cur != NODATA) & (ref != NODATA)
    out[ok] = cur[ok] - ref[ok]
    return out


def classify(diff: np.ndarray, threshold: float) -> np.ndarray:
    out = np.zeros(diff.shape, dtype="uint8")
    ok = diff != NODATA
    out[ok] = CLASS_STABLE
    out[ok & (diff < -threshold)] = CLASS_DECREASE
    out[ok & (diff > threshold)] = CLASS_INCREASE
    return out


class ChangeStats:
    def __init__(self) -> None:
        self.counts = {CLASS_DECREASE: 0, CLASS_STABLE: 0, CLASS_INCREASE: 0}
        self.total = 0.0
        self.lo, self.hi = float("inf"), float("-inf")

    def add(self, diff: np.ndarray, cls: np.ndarray) -> None:
        for k in self.counts:
            self.counts[k] += int(np.count_nonzero(cls == k))
        v = diff[diff != NODATA]
        if v.size:
            self.total += float(v.sum(dtype="float64"))
            self.lo, self.hi = min(self.lo, float(v.min())), max(self.hi, float(v.max()))

    def result(self, resolution_m: float, inside_px: int) -> dict:
        n = sum(self.counts.values())
        ha = resolution_m * resolution_m / 10_000.0
        pct = lambda c: round(100 * c / n, 2) if n else 0.0  # noqa: E731
        return {
            "valid_pixels": n,
            "valid_pct_of_aoi": round(100 * n / max(inside_px, 1), 2),
            "mean_change": round(self.total / n, 5) if n else None,
            "min_change": round(self.lo, 5) if n else None,
            "max_change": round(self.hi, 5) if n else None,
            "classes": {
                name: {"pixels": self.counts[k], "area_ha": round(self.counts[k] * ha, 3), "pct_of_valid": pct(self.counts[k])}
                for name, k in (("decrease", CLASS_DECREASE), ("stable", CLASS_STABLE), ("increase", CLASS_INCREASE))
            },
        }
