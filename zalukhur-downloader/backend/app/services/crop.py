"""Crop AOI + penulisan GeoTIFF/COG + metadata dari satu scene Sentinel-2.

Crop dilakukan saat pembacaan (window per-band pada COG jarak jauh), bukan dengan
mengunduh seluruh scene. CRS, transform, nodata, dan skala/offset reflektansi dipertahankan.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable

import numpy as np
import rasterio
from shapely.geometry import mapping
from rasterio.shutil import copy as rio_copy

from app.bands import BANDS
from app.config import Settings
from app.errors import ProcessingError
from app.models.scene import DownloadRequest
from app.processing import metadata as meta_mod
from app.processing import raster
from app.processing.resampling import choose, describe
from app.services import aoi as aoi_svc
from app.services.catalog import coverage_pct, item_to_scene

ProgressFn = Callable[[str, float, str], None]


def _noop(*_a, **_k):  # pragma: no cover
    pass


def safe_name(name: str | None) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (name or "").strip()).strip("_")
    return cleaned[:40] or "AOI"


def asset_source(item: dict, band: str, settings: Settings) -> tuple[str, dict]:
    key = BANDS[band]["asset"]
    asset = (item.get("assets") or {}).get(key)
    if not asset or not asset.get("href"):
        raise ProcessingError(f"Band {band} tidak tersedia pada scene {item.get('id')}.")
    href: str = asset["href"]
    if not href.startswith("https://") and not (settings.allow_local_assets and Path(href).exists()):
        raise ProcessingError(f"Sumber data band {band} tidak valid.")
    return href, asset


def _band_scale_offset(asset: dict) -> tuple[float, float]:
    rb = (asset.get("raster:bands") or [{}])[0]
    return float(rb.get("scale", 1.0)), float(rb.get("offset", 0.0))


def _band_nodata(asset: dict, src: rasterio.DatasetReader) -> float:
    rb = (asset.get("raster:bands") or [{}])[0]
    if rb.get("nodata") is not None:
        return float(rb["nodata"])
    return float(src.nodata) if src.nodata is not None else 0.0


def scene_grid(item: dict, aoi_4326, resolution: int, settings: Settings, max_pixels: int) -> tuple[raster.Grid, Any]:
    """Grid keluaran + AOI dalam CRS scene. Membuka satu band untuk mengetahui CRS/origin tile."""
    href, _ = asset_source(item, "B02", settings)
    with rasterio.open(href) as src:
        crs, origin, bounds = src.crs, (src.transform.c, src.transform.f), src.bounds
    dense = aoi_4326.segmentize(0.0005)  # ~50 m, agar sisi poligon tidak menyimpang saat diproyeksikan
    aoi_crs = aoi_svc.project(dense, "EPSG:4326", crs.to_string())
    minx, miny, maxx, maxy = aoi_crs.bounds
    if maxx < bounds[0] or minx > bounds[2] or maxy < bounds[1] or miny > bounds[3]:
        raise ProcessingError("AOI tidak beririsan dengan scene yang dipilih.")
    grid = raster.snap_grid(aoi_crs.bounds, origin, resolution, crs)
    if grid.width * grid.height > max_pixels:
        raise ProcessingError(
            f"Area terlalu besar untuk resolusi {resolution} m ({grid.width}×{grid.height} piksel). "
            "Perkecil AOI atau pilih resolusi lebih kasar."
        )
    return grid, aoi_crs


def process_scene(
    item: dict,
    aoi_4326,
    req: DownloadRequest,
    out_dir: Path,
    settings: Settings,
    progress: ProgressFn = _noop,
    aoi_info: dict | None = None,
) -> dict[str, Any]:
    """Jalankan crop untuk satu scene. Mengembalikan metadata (dict) dan menulis berkas ke out_dir."""
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = item_to_scene(item, aoi_4326)
    res = req.resolution
    base = f"{safe_name(req.name)}_{scene.date.isoformat()}"
    tif_path = out_dir / f"{base}.tif"
    cog_path = out_dir / f"{base}_COG.tif"
    want_tif, want_cog = "geotiff" in req.formats, "cog" in req.formats

    with rasterio.Env(**raster.GDAL_HTTP_ENV):
        progress("DOWNLOADING", 0.02, "Menyiapkan grid AOI")
        grid, aoi_crs = scene_grid(item, aoi_4326, res, settings, settings.max_output_pixels)
        mask = raster.aoi_mask(aoi_crs, grid) if req.mask_to_aoi else np.ones(grid.shape, dtype=bool)
        inside_px = int(mask.sum())

        band_info: list[dict[str, Any]] = []
        nodata_out = 0
        profile = dict(
            driver="GTiff", dtype="uint16", count=len(req.bands), crs=grid.crs, transform=grid.transform,
            width=grid.width, height=grid.height, nodata=nodata_out, compress="deflate", predictor=2,
            tiled=True, blockxsize=256, blockysize=256, BIGTIFF="IF_SAFER",
        )
        stage_path = tif_path  # GeoTIFF sementara dipakai juga sebagai sumber COG
        with rasterio.open(stage_path, "w", **profile) as dst:
            for i, band in enumerate(req.bands, start=1):
                progress("DOWNLOADING", 0.05 + 0.8 * (i - 1) / len(req.bands), f"Membaca {band} ({i}/{len(req.bands)})")
                href, asset = asset_source(item, band, settings)
                scale, offset = _band_scale_offset(asset)
                with rasterio.open(href) as src:
                    native = float(abs(src.res[0]))
                    src_nodata = _band_nodata(asset, src)
                    method_name, method = choose(native, res, req.resampling)
                    valid_px = 0
                    with raster.open_warped(src, grid, method, src_nodata) as vrt:
                        for win in raster.strips(grid.width, grid.height):
                            data = vrt.read(1, window=win)
                            r0, r1 = int(win.row_off), int(win.row_off + win.height)
                            m = mask[r0:r1]
                            data = np.where(m, data, nodata_out).astype("uint16")
                            valid_px += int(np.count_nonzero(data != nodata_out))
                            dst.write(data, i, window=win)
                dst.set_band_description(i, band)
                band_info.append({
                    "name": band,
                    "asset": BANDS[band]["asset"],
                    "label": BANDS[band]["label"],
                    "native_resolution_m": native,
                    "resampling": describe(native, res, method_name),
                    "scale": scale,
                    "offset": offset,
                    "valid_pixel_pct": round(100 * valid_px / max(inside_px, 1), 2),
                })
            dst.scales = tuple(b["scale"] for b in band_info)
            dst.offsets = tuple(b["offset"] for b in band_info)
            dst.update_tags(
                SATELLITE="Sentinel-2", PRODUCT_LEVEL="L2A", SCENE_ID=scene.id,
                ACQUISITION_DATE=scene.date.isoformat(), CLOUD_COVER=str(scene.cloud_cover),
                PROCESSING="aoi_crop" + ("+aoi_polygon_mask" if req.mask_to_aoi else ""),
                RESAMPLING=",".join(f"{b['name']}:{b['resampling']}" for b in band_info),
                REFLECTANCE="reflectance = DN * scale + offset",
            )

        progress("GENERATING", 0.9, "Menulis keluaran")
        outputs: dict[str, str] = {}
        if want_cog:
            rio_copy(
                stage_path, cog_path, driver="COG", COMPRESS="DEFLATE", PREDICTOR="YES",
                BLOCKSIZE=256, OVERVIEW_RESAMPLING="AVERAGE", BIGTIFF="IF_SAFER", NUM_THREADS="ALL_CPUS",
            )
            outputs["cog"] = cog_path.name
        if want_tif:
            outputs["geotiff"] = tif_path.name
        else:
            stage_path.unlink(missing_ok=True)

        meta = meta_mod.build(
            scene={"id": scene.id, "platform": scene.platform, "tile": scene.tile, "date": scene.date.isoformat(),
                   "datetime": scene.datetime.isoformat(), "cloud_cover": scene.cloud_cover},
            aoi_geometry=(aoi_info or {}).get("geometry") or mapping(aoi_4326),
            aoi_area_km2=(aoi_info or {}).get("area_km2") or round(aoi_svc.area_km2(aoi_4326), 4),
            bands=band_info,
            resolution=res,
            grid={"crs": grid.crs.to_string(), "transform": list(grid.transform)[:6], "width": grid.width,
                  "height": grid.height, "nodata": nodata_out, "dtype": "uint16"},
            mask_to_aoi=req.mask_to_aoi,
            aoi_coverage_pct=scene.aoi_coverage_pct,
            outputs=outputs,
            catalog_url=f"{settings.stac_url}/collections/{settings.stac_collection}/items/{scene.id}",
        )
        meta_path = out_dir / "metadata.json"
        meta_mod.write(meta_path, meta)
        outputs["metadata"] = meta_path.name
        meta["outputs"] = outputs
        meta_mod.write(meta_path, meta)
    progress("GENERATING", 1.0, "Selesai")
    return meta
