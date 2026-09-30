"""Pembuatan metadata.json dan tag GeoTIFF."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import rasterio


def software_versions() -> dict[str, str]:
    import numpy
    import shapely

    return {
        "rasterio": rasterio.__version__,
        "gdal": rasterio.__gdal_version__,
        "numpy": numpy.__version__,
        "shapely": shapely.__version__,
    }


def build(
    *,
    scene: dict[str, Any],
    aoi_geometry: dict[str, Any],
    aoi_area_km2: float,
    bands: list[dict[str, Any]],
    resolution: int,
    grid: dict[str, Any],
    mask_to_aoi: bool,
    aoi_coverage_pct: float | None,
    outputs: dict[str, str],
    catalog_url: str,
    processing: list[str] | None = None,
    cloud_masking: dict[str, Any] | None = None,
    products: dict[str, Any] | None = None,
) -> dict[str, Any]:
    processing = processing or ["aoi_crop"] + (["aoi_polygon_mask"] if mask_to_aoi else [])
    methods = {b["name"]: b["resampling"] for b in bands}
    return {
        "satellite": "Sentinel-2",
        "product_level": "L2A",
        "scene_id": scene["id"],
        "platform": scene.get("platform"),
        "tile": scene.get("tile"),
        "acquisition_date": scene["date"],
        "acquisition_datetime": scene["datetime"],
        "cloud_cover": scene.get("cloud_cover"),
        "cloud_cover_note": "Persentase awan seluruh scene (metadata katalog); bukan cloud mask level piksel.",
        "aoi": aoi_geometry,
        "aoi_crs": "EPSG:4326",
        "aoi_area_km2": aoi_area_km2,
        "aoi_coverage_by_scene_pct": aoi_coverage_pct,
        "bands": [b["name"] for b in bands],
        "band_details": bands,
        "resolution": f"{resolution}m",
        "resampling": methods,
        "crs": grid["crs"],
        "transform": grid["transform"],
        "width": grid["width"],
        "height": grid["height"],
        "nodata": grid["nodata"],
        "dtype": grid["dtype"],
        "processing": processing,
        "cloud_masking": cloud_masking or "not_applied",
        "reflectance_formula": "reflectance = DN * scale + offset (lihat band_details)",
        "products": products or {},
        "outputs": outputs,
        "source": {
            "catalog": catalog_url,
            "attribution": "Contains modified Copernicus Sentinel data",
        },
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "software": software_versions(),
    }


def write(path: Path, meta: dict[str, Any]) -> None:
    path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
