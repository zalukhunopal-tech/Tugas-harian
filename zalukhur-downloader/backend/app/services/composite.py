"""Pengisian piksel ter-mask dari citra sebelumnya (gap filling) dan komposit multi-tanggal.

Aturan: citra sebelumnya HANYA mengisi piksel yang ter-mask pada citra utama; ia tidak
menggantikan seluruh citra. Piksel yang juga tidak bersih pada semua citra sebelumnya tetap
NoData. Citra sebelumnya dipakai sesuai urutan prioritas yang diberikan (mis. terdekat dulu).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from app.config import Settings
from app.errors import ProcessingError
from app.processing import raster
from app.services import cloud_mask

# Kode peta QA (uint8): 1 = citra utama bersih, 1+i = terisi dari citra sebelumnya ke-i,
# 254 = ter-mask dan tidak ada pengganti (NoData), 255 = di luar AOI / tanpa data.
QA_CURRENT = 1
QA_UNFILLED = 254
QA_NODATA = 255


@dataclass
class FillPlan:
    masks: cloud_mask.Masks
    inside: np.ndarray                   # True: piksel di dalam AOI
    src_map: np.ndarray                  # uint8: 0 = tidak diisi, i = dari citra sebelumnya ke-i
    prev_items: list[dict] = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    @property
    def n_prev(self) -> int:
        return len(self.prev_items)

    def filled_count(self, i: int) -> int:
        return int(np.count_nonzero(self.src_map == i))


def plan(
    cur_masks: cloud_mask.Masks,
    inside: np.ndarray,
    prev_items: list[dict],
    grid: raster.Grid,
    classes: list[str],
    dilate_m: int,
    settings: Settings,
    on_prev: Callable[[int, int], None] | None = None,
) -> FillPlan:
    if len(prev_items) > 255 - 3:
        raise ProcessingError("Terlalu banyak citra sebelumnya.")
    src_map = np.zeros(grid.shape, dtype="uint8")
    need = cur_masks.bad & inside
    for i, item in enumerate(prev_items, start=1):
        if on_prev:
            on_prev(i, len(prev_items))
        if not need.any():
            break
        pm = cloud_mask.read_masks(item, grid, classes, dilate_m, settings)
        usable = ~pm.bad & ~pm.nodata
        take = need & usable
        src_map[take] = i
        need &= ~take
    return FillPlan(masks=cur_masks, inside=inside, src_map=src_map, prev_items=prev_items,
                    stats=coverage_stats(cur_masks, inside, src_map, len(prev_items)))


def coverage_stats(masks: cloud_mask.Masks, inside: np.ndarray, src_map: np.ndarray, n_prev: int) -> dict:
    total = int(np.count_nonzero(inside))
    valid_cur = inside & ~masks.nodata
    masked = int(np.count_nonzero(masks.bad & inside))
    filled = [int(np.count_nonzero((src_map == i) & inside)) for i in range(1, n_prev + 1)]
    pct = lambda n: round(100.0 * n / total, 2) if total else 0.0  # noqa: E731
    return {
        "aoi_pixels": total,
        "no_data_pixels": int(np.count_nonzero(inside & masks.nodata)),
        "masked_pixels": masked,
        "masked_pct": pct(masked),
        "filled_pixels_per_previous": filled,
        "filled_pct_per_previous": [pct(n) for n in filled],
        "filled_pct": pct(sum(filled)),
        "unfilled_masked_pixels": masked - sum(filled),
        "unfilled_masked_pct": pct(masked - sum(filled)),
        "clear_pct": pct(int(np.count_nonzero(valid_cur & ~masks.bad))),
    }


def qa_map(plan_: FillPlan) -> np.ndarray:
    """Peta provenance per piksel (lihat kode di atas)."""
    qa = np.full(plan_.inside.shape, QA_NODATA, dtype="uint8")
    ok = plan_.inside & ~plan_.masks.nodata
    qa[ok] = QA_CURRENT
    m = ok & plan_.masks.bad
    qa[m] = QA_UNFILLED
    filled = m & (plan_.src_map > 0)
    qa[filled] = (plan_.src_map[filled] + 1).astype("uint8")
    return qa


def harmonize(dn: np.ndarray, prev_scale: float, prev_offset: float, cur_scale: float, cur_offset: float) -> np.ndarray:
    """Ubah DN citra sebelumnya ke skala/offset DN citra utama.

    Scene dengan baseline pemrosesan berbeda memakai offset BOA berbeda (mis. 0 vs -0.1), sehingga
    DN mentah tidak boleh disalin langsung. reflektansi = DN*scale + offset di kedua sisi.
    """
    if prev_scale == cur_scale and prev_offset == cur_offset:
        return dn
    refl = dn.astype("float64") * prev_scale + prev_offset
    out = np.rint((refl - cur_offset) / cur_scale)
    out = np.clip(out, 1, 65535)  # 0 dicadangkan untuk NoData
    return np.where(dn == 0, 0, out).astype("uint16")


def apply(
    cur: np.ndarray,
    plan_: FillPlan | None,
    win_rows: slice,
    get_prev: Callable[[int], np.ndarray],
    nodata: int = 0,
) -> np.ndarray:
    """Terapkan mask + pengisian pada satu strip band. `get_prev(i)` mengembalikan DN citra
    sebelumnya ke-i (sudah diharmonisasi) untuk strip yang sama; dipanggil hanya bila perlu."""
    out = cur.copy()
    if plan_ is None:
        return out
    bad = plan_.masks.bad[win_rows]
    out[bad] = nodata
    fill = plan_.src_map[win_rows]
    for i in range(1, plan_.n_prev + 1):
        sel = fill == i
        if sel.any():
            out[sel] = get_prev(i)[sel]
    return out
