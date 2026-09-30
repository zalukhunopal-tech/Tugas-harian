"""Pembaca band satu scene pada grid keluaran, lengkap dengan mask awan dan pengisian.

Dipakai bersama oleh crop, preview, indeks, dan deteksi perubahan agar semuanya melewati
jalur baca yang sama (window, resampling, mask SCL, harmonisasi citra sebelumnya, mask AOI).
"""
from __future__ import annotations

from contextlib import ExitStack
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
import rasterio
from rasterio.windows import Window

from app.config import Settings
from app.processing import raster
from app.processing.resampling import choose, describe
from app.services import composite
from app.services.assets import asset_source, band_nodata, band_scale_offset

NODATA_DN = 0


def open_prev_readers(
    stack: ExitStack, plan: composite.FillPlan | None, band: str, grid: raster.Grid, res: int, requested: str,
    cur_scale: float, cur_offset: float, settings: Settings,
) -> dict[int, Callable[[Any], np.ndarray]]:
    """Pembaca window band dari tiap citra sebelumnya (sudah diharmonisasi ke skala DN citra utama).

    Dibuka hanya untuk citra yang benar-benar mengisi piksel, agar tidak mengunduh data yang tak terpakai.
    """
    readers: dict[int, Callable[[Any], np.ndarray]] = {}
    if plan is None:
        return readers
    for pi, pitem in enumerate(plan.prev_items, start=1):
        if plan.filled_count(pi) == 0:
            continue
        phref, passet = asset_source(pitem, band, settings)
        psrc = stack.enter_context(rasterio.open(phref))
        _, pmethod = choose(abs(psrc.res[0]), res, requested)
        pvrt = stack.enter_context(raster.open_warped(psrc, grid, pmethod, band_nodata(passet, psrc)))
        pscale, poffset = band_scale_offset(passet)
        readers[pi] = lambda win, v=pvrt, ps=pscale, po=poffset: composite.harmonize(
            v.read(1, window=win), ps, po, cur_scale, cur_offset
        )
    return readers


@dataclass
class BandInfo:
    name: str
    asset: dict
    scale: float
    offset: float
    native_res: float
    method_name: str


class SceneReader:
    """Membuka semua `bands` milik `item` sekali, lalu melayani pembacaan per window/strip."""

    def __init__(
        self, stack: ExitStack, item: dict, bands: list[str], grid: raster.Grid, res: int, requested: str,
        plan: composite.FillPlan | None, inside: np.ndarray, settings: Settings,
    ):
        self.plan, self.inside = plan, inside
        self.info: dict[str, BandInfo] = {}
        self._vrt: dict[str, Any] = {}
        self._prev: dict[str, dict[int, Callable[[Any], np.ndarray]]] = {}
        for band in bands:
            href, asset = asset_source(item, band, settings)
            scale, offset = band_scale_offset(asset)
            src = stack.enter_context(rasterio.open(href))
            native = float(abs(src.res[0]))
            method_name, method = choose(native, res, requested)
            self._vrt[band] = stack.enter_context(raster.open_warped(src, grid, method, band_nodata(asset, src)))
            self._prev[band] = open_prev_readers(stack, plan, band, grid, res, requested, scale, offset, settings)
            self.info[band] = BandInfo(band, asset, scale, offset, native, describe(native, res, method_name))

    def read(self, band: str, win: Window) -> np.ndarray:
        """DN uint16 untuk window: mask awan/pengisian diterapkan, lalu di luar AOI menjadi NoData."""
        r0, r1 = int(win.row_off), int(win.row_off + win.height)
        data = self._vrt[band].read(1, window=win)
        prev = self._prev[band]
        data = composite.apply(data, self.plan, slice(r0, r1), lambda k: prev[k](win), NODATA_DN)
        return np.where(self.inside[r0:r1], data, NODATA_DN).astype("uint16")
