"""Cloud masking level piksel dari Scene Classification Layer (SCL) Sentinel-2 L2A.

SCL adalah satu-satunya informasi awan yang tersedia dari sumber data saat ini (aset
probabilitas awan CLD/SNW tidak disediakan katalog). Mask dihitung pada grid keluaran.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import rasterio
from affine import Affine
from rasterio.enums import Resampling

from app.config import Settings
from app.errors import ProcessingError
from app.processing import raster

# Kode kelas SCL Sentinel-2 L2A
SCL_NODATA = 0
SCL_LABELS = {
    0: "NO_DATA", 1: "SATURATED_OR_DEFECTIVE", 2: "DARK_AREA_PIXELS", 3: "CLOUD_SHADOWS", 4: "VEGETATION",
    5: "NOT_VEGETATED", 6: "WATER", 7: "UNCLASSIFIED", 8: "CLOUD_MEDIUM_PROBABILITY",
    9: "CLOUD_HIGH_PROBABILITY", 10: "THIN_CIRRUS", 11: "SNOW_ICE",
}
CLASS_GROUPS: dict[str, list[int]] = {
    "cloud": [8, 9],
    "cloud_shadow": [3],
    "cirrus": [10],
    "snow_ice": [11],
}
SCL_WORK_RES = 20  # resolusi asli SCL (m)


def bad_codes(classes: list[str]) -> list[int]:
    codes: list[int] = []
    for c in classes:
        codes.extend(CLASS_GROUPS[c])
    return sorted(set(codes))


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    """Dilasi 3x3 sebanyak `px` iterasi (membesarkan area awan ke tepi tipis/halo)."""
    for _ in range(px):
        m = mask.copy()
        m[1:] |= mask[:-1]
        m[:-1] |= mask[1:]
        m[:, 1:] |= mask[:, :-1]
        m[:, :-1] |= mask[:, 1:]
        m[1:, 1:] |= mask[:-1, :-1]
        m[1:, :-1] |= mask[:-1, 1:]
        m[:-1, 1:] |= mask[1:, :-1]
        m[:-1, :-1] |= mask[1:, 1:]
        mask = m
    return mask


@dataclass
class Masks:
    bad: np.ndarray      # True: awan/bayangan/cirrus/salju terpilih (setelah dilasi)
    nodata: np.ndarray   # True: SCL = NO_DATA (di luar cakupan scene)


def scl_href(item: dict, settings: Settings) -> str:
    asset = (item.get("assets") or {}).get("scl")
    href = asset.get("href") if asset else None
    if not href:
        raise ProcessingError(f"Scene {item.get('id')} tidak memiliki layer klasifikasi (SCL); cloud masking tidak dapat dilakukan.")
    if not href.startswith("https://") and not (settings.allow_local_assets and href and not href.startswith("file:")):
        raise ProcessingError("Sumber SCL tidak valid.")
    return href


def read_masks(item: dict, grid: raster.Grid, classes: list[str], dilate_m: int, settings: Settings) -> Masks:
    """SCL -> mask pada `grid` (resolusi 10/20/60 m).

    Dihitung pada grid kerja <=20 m lalu dikecilkan dengan aturan "any" untuk 60 m, sehingga
    satu piksel awan kecil tidak hilang saat resolusi diperkasar (konservatif).
    """
    work_res = min(grid.resolution, SCL_WORK_RES)
    factor = int(round(grid.resolution / work_res)) if grid.resolution > work_res else 1
    px = math.ceil(dilate_m / work_res) if dilate_m > 0 else 0
    # Margin di sekeliling AOI: awan tepat di luar AOI juga harus ikut melebar (dilasi) ke dalamnya.
    # Kelipatan `factor` agar reduksi blok 60 m tetap sejajar.
    pad = math.ceil(px / factor) * factor if px else 0
    t = grid.transform
    work = raster.Grid(
        crs=grid.crs,
        transform=Affine(work_res, 0, t.c - pad * work_res, 0, -work_res, t.f + pad * work_res),
        width=grid.width * factor + 2 * pad, height=grid.height * factor + 2 * pad, resolution=work_res,
    )

    with rasterio.open(scl_href(item, settings)) as src, raster.open_warped(src, work, Resampling.nearest, SCL_NODATA) as vrt:
        scl = vrt.read(1)

    bad = np.isin(scl, bad_codes(classes))
    nodata = scl == SCL_NODATA
    if px:
        bad = dilate(bad, px)
    if pad:
        bad, nodata = bad[pad:-pad, pad:-pad], nodata[pad:-pad, pad:-pad]
    if factor > 1:
        h, w = grid.height, grid.width
        bad = bad.reshape(h, factor, w, factor).any(axis=(1, 3))
        nodata = nodata.reshape(h, factor, w, factor).all(axis=(1, 3))
    return Masks(bad=bad & ~nodata, nodata=nodata)
