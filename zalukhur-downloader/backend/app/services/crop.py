"""Crop AOI + penulisan GeoTIFF/COG + metadata dari satu scene Sentinel-2.

Crop dilakukan saat pembacaan (window per-band pada COG jarak jauh), bukan dengan
mengunduh seluruh scene. CRS, transform, nodata, dan skala/offset reflektansi dipertahankan.
"""
from __future__ import annotations

import re
from contextlib import ExitStack
from pathlib import Path
from typing import Any, Callable

import numpy as np
import rasterio
from rasterio.shutil import copy as rio_copy
from shapely.geometry import mapping

from app.bands import BANDS
from app.config import Settings
from app.errors import ProcessingError
from app.models.scene import DownloadRequest
from app.processing import metadata as meta_mod
from app.processing import indices as idx_mod
from app.processing import raster
from app.processing.resampling import choose, describe
from app.services import aoi as aoi_svc
from app.services import change as change_svc
from app.services import cloud_mask, composite
from app.services.assets import asset_source, band_nodata, band_scale_offset
from app.services.scene_reader import SceneReader
from app.services.catalog import coverage_pct, item_to_scene

ProgressFn = Callable[[str, float, str], None]


def _noop(*_a, **_k):  # pragma: no cover
    pass


def safe_name(name: str | None) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (name or "").strip()).strip("_")
    return cleaned[:40] or "AOI"


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


def processing_tokens(req: DownloadRequest) -> list[str]:
    tokens = ["aoi_crop"] + (["aoi_polygon_mask"] if req.mask_to_aoi else [])
    cm = req.cloud_mask
    if cm.enabled:
        n = (len(cm.previous_scene_ids) or cm.auto_previous) if cm.fill_from_previous else 0
        tokens.append("cloud_mask_multi_date_composite" if n > 1 else "cloud_mask_previous_image" if n == 1 else "cloud_mask")
    tokens += [f"index_{i}" for i in req.indices]
    if req.change.enabled:
        tokens.append(f"change_detection_{req.change.index}")
    return tokens


QA_LEGEND = {
    "1": "citra utama, piksel bersih",
    "2..N+1": "piksel ter-mask diisi dari citra sebelumnya ke-1..N (urutan sesuai previous_scenes)",
    "254": "ter-mask (awan/bayangan/cirrus/salju) dan tidak ada pengganti bersih -> NoData",
    "255": "di luar AOI atau tanpa data (NoData)",
}


def _write_qa(path: Path, plan: composite.FillPlan, grid: raster.Grid) -> None:
    qa = composite.qa_map(plan)
    with rasterio.open(
        path, "w", driver="GTiff", dtype="uint8", count=1, crs=grid.crs, transform=grid.transform,
        width=grid.width, height=grid.height, nodata=composite.QA_NODATA, compress="deflate", tiled=True,
        blockxsize=256, blockysize=256,
    ) as dst:
        dst.write(qa, 1)
        dst.set_band_description(1, "QA_provenance")
        dst.update_tags(QA_LEGEND="; ".join(f"{k}={v}" for k, v in QA_LEGEND.items()))


def _cloud_block(cm, plan: composite.FillPlan, qa_name: str | None, current_id: str) -> dict[str, Any]:
    prevs = []
    for i, pitem in enumerate(plan.prev_items, start=1):
        ps = item_to_scene(pitem)
        prevs.append({
            "order": i, "id": ps.id, "date": ps.date.isoformat(), "tile": ps.tile, "cloud_cover": ps.cloud_cover,
            "filled_pixels": plan.stats["filled_pixels_per_previous"][i - 1],
            "filled_pct": plan.stats["filled_pct_per_previous"][i - 1],
        })
    n = len(prevs)
    return {
        "applied": True,
        "method": "scl_multi_date_composite" if n > 1 else "scl_previous_image_fill" if n == 1 else "scl_mask_only",
        "source": "Sentinel-2 L2A Scene Classification Layer (SCL)",
        "classes": cm.classes,
        "scl_codes_masked": cloud_mask.bad_codes(cm.classes),
        "dilate_m": cm.dilate_m,
        "cloud_probability_layer": "not_available",
        "current_scene": current_id,
        "previous_scenes": prevs,
        "radiometric_harmonization": "DN citra sebelumnya dikonversi ke skala/offset citra utama (reflektansi = DN*scale+offset)",
        "unfilled_masked_pixels_are": "NoData (0)",
        "statistics": plan.stats,
        "qa_file": qa_name,
        "qa_legend": QA_LEGEND,
    }


COG_OPTS = dict(
    driver="COG", COMPRESS="DEFLATE", PREDICTOR="YES", BLOCKSIZE=256, OVERVIEW_RESAMPLING="AVERAGE",
    BIGTIFF="IF_SAFER", NUM_THREADS="ALL_CPUS",
)


def _finalize(stage: Path, stem: str, formats: list[str], outputs: dict[str, str], key: str, cog_key: str) -> None:
    """GeoTIFF sementara -> GeoTIFF dan/atau COG sesuai format yang diminta."""
    if "cog" in formats:
        cog = stage.with_name(f"{stem}_COG.tif")
        rio_copy(stage, cog, **COG_OPTS)
        outputs[cog_key] = cog.name
    if "geotiff" in formats:
        outputs[key] = stage.name
    else:
        stage.unlink(missing_ok=True)


def _float_profile(grid: raster.Grid) -> dict[str, Any]:
    return dict(
        driver="GTiff", dtype="float32", count=1, crs=grid.crs, transform=grid.transform, width=grid.width,
        height=grid.height, nodata=float(idx_mod.NODATA), compress="deflate", predictor=3, tiled=True,
        blockxsize=256, blockysize=256, BIGTIFF="IF_SAFER",
    )


def needed_bands(req: DownloadRequest) -> list[str]:
    """Band yang dibaca: yang diminta pengguna + band sumber indeks/perubahan (urutan stabil)."""
    out = list(req.bands)
    names = list(req.indices) + ([req.change.index] if req.change.enabled else [])
    for name in names:
        for b in idx_mod.INDICES[name]["bands"]:
            if b not in out:
                out.append(b)
    return out


def process_scene(
    item: dict,
    aoi_4326,
    req: DownloadRequest,
    out_dir: Path,
    settings: Settings,
    progress: ProgressFn = _noop,
    aoi_info: dict | None = None,
    prev_items: list[dict] | None = None,
    ref_item: dict | None = None,
) -> dict[str, Any]:
    """Crop AOI satu scene + (opsional) cloud masking/pengisian, indeks spektral, dan deteksi perubahan.

    Mengembalikan metadata (dict) dan menulis berkas ke out_dir.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = item_to_scene(item, aoi_4326)
    res = req.resolution
    base = f"{safe_name(req.name)}_{scene.date.isoformat()}"
    cm, chg = req.cloud_mask, req.change
    if chg.enabled and ref_item is None:
        raise ProcessingError("Citra referensi untuk deteksi perubahan tidak tersedia.")
    ref_scene = item_to_scene(ref_item) if chg.enabled else None
    nodata_out = 0

    with rasterio.Env(**raster.GDAL_HTTP_ENV):
        progress("DOWNLOADING", 0.02, "Menyiapkan grid AOI")
        grid, aoi_crs = scene_grid(item, aoi_4326, res, settings, settings.max_output_pixels)
        mask = raster.aoi_mask(aoi_crs, grid) if req.mask_to_aoi else np.ones(grid.shape, dtype=bool)
        inside_px = int(mask.sum())

        plan: composite.FillPlan | None = None
        ref_plan: composite.FillPlan | None = None
        if cm.enabled:
            progress("PROCESSING", 0.08, "Membaca SCL dan mendeteksi awan")
            cur_masks = cloud_mask.read_masks(item, grid, cm.classes, cm.dilate_m, settings)
            plan = composite.plan(
                cur_masks, mask, (prev_items or []) if cm.fill_from_previous else [], grid, cm.classes, cm.dilate_m,
                settings,
                on_prev=lambda i, n: progress("PROCESSING", 0.1 + 0.2 * i / n, f"Membaca citra sebelumnya {i}/{n}"),
            )
            if chg.enabled:  # citra referensi di-mask dengan aturan yang sama (tanpa pengisian)
                progress("PROCESSING", 0.3, "Mendeteksi awan pada citra referensi")
                ref_masks = cloud_mask.read_masks(ref_item, grid, cm.classes, cm.dilate_m, settings)
                ref_plan = composite.plan(ref_masks, mask, [], grid, cm.classes, cm.dilate_m, settings)

        bands_needed = needed_bands(req)
        idx_names = list(dict.fromkeys(list(req.indices) + ([chg.index] if chg.enabled else [])))
        outputs: dict[str, str] = {}
        band_info: list[dict[str, Any]] = []
        products: dict[str, Any] = {}
        valid_px = {b: 0 for b in req.bands}
        idx_stats = {n: idx_mod.Stats() for n in idx_names}
        chg_stats = change_svc.ChangeStats()

        main_path = out_dir / f"{base}.tif"
        idx_paths = {n: out_dir / f"{base}_{n}.tif" for n in req.indices}
        ref_tag = ref_scene.date.isoformat() if ref_scene else ""
        d_path = out_dir / f"{base}_d{chg.index}_vs_{ref_tag}.tif"
        c_path = out_dir / f"{base}_change_{chg.index}_vs_{ref_tag}.tif"

        with ExitStack() as stack:
            cur = SceneReader(stack, item, bands_needed, grid, res, req.resampling, plan, mask, settings)
            ref_bands = list(idx_mod.INDICES[chg.index]["bands"]) if chg.enabled else []
            ref = SceneReader(stack, ref_item, ref_bands, grid, res, req.resampling, ref_plan, mask, settings) if chg.enabled else None

            dst = None
            if req.bands:
                dst = stack.enter_context(rasterio.open(main_path, "w", **dict(
                    driver="GTiff", dtype="uint16", count=len(req.bands), crs=grid.crs, transform=grid.transform,
                    width=grid.width, height=grid.height, nodata=nodata_out, compress="deflate", predictor=2,
                    tiled=True, blockxsize=256, blockysize=256, BIGTIFF="IF_SAFER")))
                for i, b in enumerate(req.bands, start=1):
                    dst.set_band_description(i, b)
                dst.scales = tuple(cur.info[b].scale for b in req.bands)
                dst.offsets = tuple(cur.info[b].offset for b in req.bands)
                dst.update_tags(
                    SATELLITE="Sentinel-2", PRODUCT_LEVEL="L2A", SCENE_ID=scene.id,
                    ACQUISITION_DATE=scene.date.isoformat(), CLOUD_COVER=str(scene.cloud_cover),
                    PROCESSING="+".join(processing_tokens(req)),
                    RESAMPLING=",".join(f"{b}:{cur.info[b].method_name}" for b in req.bands),
                    REFLECTANCE="reflectance = DN * scale + offset",
                )
            idx_dst = {}
            for n, path in idx_paths.items():
                d = stack.enter_context(rasterio.open(path, "w", **_float_profile(grid)))
                d.set_band_description(1, n)
                d.update_tags(INDEX=n, FORMULA=idx_mod.INDICES[n]["formula"], SCENE_ID=scene.id,
                              ACQUISITION_DATE=scene.date.isoformat(),
                              NOTE="dihitung dari reflektansi (DN*scale+offset), negatif dipotong 0; NoData=-9999")
                idx_dst[n] = d
            d_dst = c_dst = None
            if chg.enabled:
                d_dst = stack.enter_context(rasterio.open(d_path, "w", **_float_profile(grid)))
                d_dst.set_band_description(1, f"d{chg.index}")
                d_dst.update_tags(CHANGE=f"{chg.index} {scene.date} - {chg.index} {ref_tag}", SCENE_ID=scene.id,
                                  REFERENCE_SCENE_ID=ref_scene.id)
                c_prof = _float_profile(grid) | dict(dtype="uint8", nodata=change_svc.CLASS_NODATA, predictor=2)
                c_dst = stack.enter_context(rasterio.open(c_path, "w", **c_prof))
                c_dst.set_band_description(1, f"change_{chg.index}")
                c_dst.update_tags(CLASSES="; ".join(f"{k}={v}" for k, v in change_svc.CLASS_LEGEND.items()),
                                  THRESHOLD=str(chg.threshold))

            wins = list(raster.strips(grid.width, grid.height))
            for k, win in enumerate(wins):
                progress("CROPPING", 0.35 + 0.5 * k / len(wins), f"Memotong dan menghitung ({k + 1}/{len(wins)})")
                arrays = {b: cur.read(b, win) for b in bands_needed}
                if dst is not None:
                    for i, b in enumerate(req.bands, start=1):
                        dst.write(arrays[b], i, window=win)
                        valid_px[b] += int(np.count_nonzero(arrays[b] != nodata_out))
                idx_vals: dict[str, np.ndarray] = {}
                for n in idx_names:
                    b1, b2 = idx_mod.INDICES[n]["bands"]
                    idx_vals[n] = idx_mod.compute(n, arrays[b1], arrays[b2],
                                                  (cur.info[b1].scale, cur.info[b1].offset),
                                                  (cur.info[b2].scale, cur.info[b2].offset))
                    idx_stats[n].add(idx_vals[n])
                for n, d in idx_dst.items():
                    d.write(idx_vals[n], 1, window=win)
                if chg.enabled and ref is not None:
                    b1, b2 = idx_mod.INDICES[chg.index]["bands"]
                    ra, rb = ref.read(b1, win), ref.read(b2, win)
                    ref_idx = idx_mod.compute(chg.index, ra, rb, (ref.info[b1].scale, ref.info[b1].offset),
                                              (ref.info[b2].scale, ref.info[b2].offset))
                    diff = change_svc.difference(idx_vals[chg.index], ref_idx)
                    cls = change_svc.classify(diff, chg.threshold)
                    chg_stats.add(diff, cls)
                    d_dst.write(diff, 1, window=win)
                    c_dst.write(cls, 1, window=win)

        for b in req.bands:
            i = cur.info[b]
            band_info.append({
                "name": b, "asset": BANDS[b]["asset"], "label": BANDS[b]["label"],
                "native_resolution_m": i.native_res, "resampling": i.method_name,
                "scale": i.scale, "offset": i.offset,
                "valid_pixel_pct": round(100 * valid_px[b] / max(inside_px, 1), 2),
            })

        progress("GENERATING", 0.9, "Menulis keluaran")
        qa_name = None
        if plan is not None and cm.include_qa:
            qa_name = f"{base}_QA.tif"
            _write_qa(out_dir / qa_name, plan, grid)
            outputs["qa"] = qa_name
        if req.bands:
            _finalize(main_path, base, req.formats, outputs, "geotiff", "cog")

        for n in req.indices:
            _finalize(idx_paths[n], f"{base}_{n}", req.formats, outputs, f"index_{n}", f"index_{n}_cog")
        if req.indices:
            products["indices"] = [{
                "name": n, "label": idx_mod.INDICES[n]["label"], "formula": idx_mod.INDICES[n]["formula"],
                "bands": list(idx_mod.INDICES[n]["bands"]), "dtype": "float32", "nodata": float(idx_mod.NODATA),
                "range": [-1, 1], "reflectance_negative_clipped_to_zero": True,
                "source_scale_offset": {b: [cur.info[b].scale, cur.info[b].offset] for b in idx_mod.INDICES[n]["bands"]},
                "statistics": idx_stats[n].result(inside_px),
                "files": {k: v for k, v in outputs.items() if k in (f"index_{n}", f"index_{n}_cog")},
            } for n in req.indices]

        if chg.enabled:
            _finalize(d_path, d_path.stem, req.formats, outputs, f"change_delta_{chg.index}", f"change_delta_{chg.index}_cog")
            _finalize(c_path, c_path.stem, req.formats, outputs, f"change_class_{chg.index}", f"change_class_{chg.index}_cog")
            products["change_detection"] = {
                "index": chg.index, "formula": idx_mod.INDICES[chg.index]["formula"],
                "delta": f"{chg.index}(utama {scene.date}) - {chg.index}(referensi {ref_tag})",
                "note": "Untuk dNBR luka bakar klasik (pre - post), balik tandanya: dNBR = -delta.",
                "threshold": chg.threshold,
                "current_scene": scene.id, "reference_scene": {"id": ref_scene.id, "date": ref_tag,
                                                               "tile": ref_scene.tile, "cloud_cover": ref_scene.cloud_cover},
                "reference_cloud_masked": cm.enabled,
                "class_legend": change_svc.CLASS_LEGEND,
                "statistics": chg_stats.result(res, inside_px),
                "files": {k: v for k, v in outputs.items() if k.startswith(f"change_") and f"_{chg.index}" in k},
            }

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
            processing=processing_tokens(req),
            cloud_masking=_cloud_block(cm, plan, qa_name, scene.id) if plan is not None else None,
            products=products or None,
        )
        meta_path = out_dir / "metadata.json"
        meta_mod.write(meta_path, meta)
        outputs["metadata"] = meta_path.name
        meta["outputs"] = outputs
        meta_mod.write(meta_path, meta)
    progress("GENERATING", 1.0, "Selesai")
    return meta
