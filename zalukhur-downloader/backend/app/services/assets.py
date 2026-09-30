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


def band_scale_offset(asset: dict) -> tuple[float, float]:
    rb = (asset.get("raster:bands") or [{}])[0]
    return float(rb.get("scale", 1.0)), float(rb.get("offset", 0.0))


def band_nodata(asset: dict, src: rasterio.DatasetReader) -> float:
    rb = (asset.get("raster:bands") or [{}])[0]
    if rb.get("nodata") is not None:
        return float(rb["nodata"])
    return float(src.nodata) if src.nodata is not None else 0.0
