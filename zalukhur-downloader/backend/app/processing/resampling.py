"""Pemilihan metode resampling secara eksplisit (dicatat di metadata)."""
from __future__ import annotations

from rasterio.enums import Resampling

_MAP = {
    "nearest": Resampling.nearest,
    "bilinear": Resampling.bilinear,
    "cubic": Resampling.cubic,
    "average": Resampling.average,
}


def choose(native_res: float, target_res: float, requested: str = "auto") -> tuple[str, Resampling]:
    """Kembalikan (nama, enum).

    auto: resolusi sama -> nearest (tidak ada resampling nyata), upsampling -> nearest
    (nilai asli tidak diubah/dikarang), downsampling -> average (menghindari aliasing).
    """
    if requested != "auto":
        return requested, _MAP[requested]
    if target_res > native_res:
        return "average", Resampling.average
    return "nearest", Resampling.nearest


def describe(native_res: float, target_res: float, method: str) -> str:
    if native_res == target_res:
        return "none"
    return method
