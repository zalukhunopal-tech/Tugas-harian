"""Operasi raster: grid keluaran, mask AOI, dan pembacaan band per-window."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

import numpy as np
import rasterio
from affine import Affine
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.vrt import WarpedVRT
from rasterio.windows import Window
from shapely.geometry.base import BaseGeometry

# Opsi GDAL untuk membaca COG jarak jauh secara efisien (HTTP range request).
GDAL_HTTP_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
    "GDAL_HTTP_MULTIPLEX": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "1",
    "GDAL_HTTP_TIMEOUT": "60",
    "VSI_CACHE": "TRUE",
    "VSI_CACHE_SIZE": "67108864",
}


@dataclass(frozen=True)
class Grid:
    crs: CRS
    transform: Affine
    width: int
    height: int
    resolution: float

    @property
    def shape(self) -> tuple[int, int]:
        return (self.height, self.width)

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        t = self.transform
        return (t.c, t.f + t.e * self.height, t.c + t.a * self.width, t.f)


def snap_grid(bounds: tuple[float, float, float, float], origin: tuple[float, float], res: float, crs: CRS) -> Grid:
    """Grid resolusi `res` yang menutupi `bounds`, sejajar dengan origin tile sumber.

    Penyejajaran ke origin tile menjamin piksel keluaran bertepatan dengan piksel asli
    (tanpa pergeseran setengah piksel) untuk band yang resolusi aslinya = `res`.
    """
    minx, miny, maxx, maxy = bounds
    ox, oy = origin
    c0 = math.floor((minx - ox) / res + 1e-9)
    c1 = math.ceil((maxx - ox) / res - 1e-9)
    r0 = math.floor((oy - maxy) / res + 1e-9)
    r1 = math.ceil((oy - miny) / res - 1e-9)
    width, height = max(c1 - c0, 1), max(r1 - r0, 1)
    transform = Affine(res, 0.0, ox + c0 * res, 0.0, -res, oy - r0 * res)
    return Grid(crs=crs, transform=transform, width=width, height=height, resolution=res)


def aoi_mask(geom: BaseGeometry, grid: Grid) -> np.ndarray:
    """True untuk piksel yang berada di dalam AOI (geometri sudah dalam CRS grid)."""
    mask = geometry_mask([geom], out_shape=grid.shape, transform=grid.transform, invert=True, all_touched=False)
    if not mask.any():  # AOI lebih kecil dari satu piksel: ambil piksel yang tersentuh
        mask = geometry_mask([geom], out_shape=grid.shape, transform=grid.transform, invert=True, all_touched=True)
    return mask


def strips(width: int, height: int, rows: int = 1024) -> Iterator[Window]:
    for r in range(0, height, rows):
        yield Window(col_off=0, row_off=r, width=width, height=min(rows, height - r))


def open_warped(src: rasterio.DatasetReader, grid: Grid, resampling: Resampling, nodata: float) -> WarpedVRT:
    """VRT yang menyajikan `src` pada grid keluaran (CRS sama; hanya window + resample)."""
    return WarpedVRT(
        src,
        crs=grid.crs,
        transform=grid.transform,
        width=grid.width,
        height=grid.height,
        resampling=resampling,
        src_nodata=nodata,
        nodata=nodata,
    )
