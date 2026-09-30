"""Akses aset band dari item STAC (href, scale/offset, nodata)."""
from __future__ import annotations

from pathlib import Path

import rasterio

from app.bands import BANDS
from app.config import Settings
from app.errors import ProcessingError


def asset_source(item: dict, band: str, settings: Settings) -> tuple[str, dict]:
    key = BANDS[band]["asset"]
    asset = (item.get("assets") or {}).get(key)
    if not asset or not asset.get("href"):
        raise ProcessingError(f"Band {band} tidak tersedia pada scene {item.get('id')}.")
    href: str = asset["href"]
    if not href.startswith("https://") and not (settings.allow_local_assets and Path(href).exists()):
        raise ProcessingError(f"Sumber data band {band} tidak valid.")
    return href, asset


BOA_OFFSET_FLAG = "earthsearch:boa_offset_applied"


def declared_scale_offset(asset: dict) -> tuple[float, float]:
    rb = (asset.get("raster:bands") or [{}])[0]
    return float(rb.get("scale", 1.0)), float(rb.get("offset", 0.0))


def band_scale_offset(item: dict, asset: dict) -> tuple[float, float]:
    """Skala & offset EFEKTIF untuk `reflektansi = DN * scale + offset`.

    Earth Search menandai `earthsearch:boa_offset_applied = true` pada scene baseline >= 04.00: offset BOA
    (+1000) sudah dikurangkan dari DN (DN = reflektansi x 10000), tetapi `raster:bands.offset` di metadata
    masih -0,1. Menerapkannya lagi menggeser reflektansi sebesar 0,1 dan membuat reflektansi hutan negatif
    (diukur pada data asli: median B05 vegetasi ~900 baik pada scene 2021 tanpa offset maupun 2022/2024).
    Katalog tanpa flag ini (mis. data ESA mentah) dipercaya sesuai metadatanya.
    """
    scale, offset = declared_scale_offset(asset)
    if (item.get("properties") or {}).get(BOA_OFFSET_FLAG) is True:
        offset = 0.0
    return scale, offset


def band_nodata(asset: dict, src: rasterio.DatasetReader) -> float:
    rb = (asset.get("raster:bands") or [{}])[0]
    if rb.get("nodata") is not None:
        return float(rb["nodata"])
    return float(src.nodata) if src.nodata is not None else 0.0
