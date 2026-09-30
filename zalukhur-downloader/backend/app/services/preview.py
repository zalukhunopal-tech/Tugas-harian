"""Preview citra pada AOI (true/false color, NDVI/NDWI/NBR), dirender di backend sebagai PNG."""
from __future__ import annotations

import base64
import io
import math
from contextlib import ExitStack

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window

from app.bands import PREVIEW_MODES
from app.config import Settings
from app.models.scene import CloudMaskOptions, PreviewResponse
from app.processing import indices as idx_mod
from app.processing import raster
from app.services import aoi as aoi_svc
from app.services import cloud_mask, composite
from app.services.crop import scene_grid
from app.services.scene_reader import SceneReader

REFLECTANCE_MAX = 0.3  # peregangan tampilan: 0..0.3 -> 0..255
GAMMA = 1 / 1.4
MAGENTA = (255, 0, 255)


def render(
    item: dict, aoi_4326, mode: str, settings: Settings,
    cm: CloudMaskOptions | None = None, prev_items: list[dict] | None = None,
) -> PreviewResponse:
    index = mode.upper() if mode.upper() in idx_mod.INDICES else None
    bands = list(idx_mod.INDICES[index]["bands"]) if index else PREVIEW_MODES[mode]
    minx, miny, maxx, maxy = aoi_svc.project(aoi_4326, "EPSG:4326", aoi_svc.utm_epsg(*aoi_4326.centroid.coords[0])).bounds
    side = max(maxx - minx, maxy - miny)
    res = max(10, int(math.ceil(side / settings.preview_max_px / 10.0)) * 10)

    with rasterio.Env(**raster.GDAL_HTTP_ENV):
        grid, aoi_crs = scene_grid(item, aoi_4326, res, settings, max_pixels=10 * settings.preview_max_px**2)
        inside = raster.aoi_mask(aoi_crs, grid)

        plan = None
        if cm is not None and cm.enabled:
            cur_masks = cloud_mask.read_masks(item, grid, cm.classes, cm.dilate_m, settings)
            plan = composite.plan(cur_masks, inside, (prev_items or []) if cm.fill_from_previous else [], grid,
                                  cm.classes, cm.dilate_m, settings)

        whole = Window(0, 0, grid.width, grid.height)
        with ExitStack() as stack:
            reader = SceneReader(stack, item, bands, grid, res, "auto", plan, inside, settings)
            dn = {b: reader.read(b, whole) for b in bands}
        info = reader.info

    valid = inside.copy()
    for b in bands:
        valid &= dn[b] != 0
    if plan is not None:
        valid &= ~plan.masks.nodata

    if index:
        b1, b2 = idx_mod.INDICES[index]["bands"]
        vals = idx_mod.compute(index, dn[b1], dn[b2], (info[b1].scale, info[b1].offset), (info[b2].scale, info[b2].offset))
        valid &= vals != idx_mod.NODATA
        rgb = idx_mod.colorize(np.where(valid, vals, 0), index)
    else:
        chans = []
        for b in bands:
            refl = dn[b].astype("float32") * info[b].scale + info[b].offset
            chans.append(np.clip(refl / REFLECTANCE_MAX, 0, 1) ** GAMMA)
        rgb = (np.dstack(chans) * 255).astype("uint8")
    alpha = (valid * 255).astype("uint8")

    cloud_stats = None
    if plan is not None:
        # masih ter-mask dan tidak terisi -> magenta (akan menjadi NoData pada hasil unduhan)
        left = plan.masks.bad & inside & (plan.src_map == 0)
        rgb[left] = MAGENTA
        alpha[left] = 200
        cloud_stats = plan.stats

    buf = io.BytesIO()
    Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA").save(buf, format="PNG")

    x0, y0, x1, y1 = grid.bounds  # minx, miny, maxx, maxy
    crs = grid.crs.to_string()
    tl, tr, br, bl = (aoi_svc.project_xy(crs, "EPSG:4326", x, y) for x, y in [(x0, y1), (x1, y1), (x1, y0), (x0, y0)])
    return PreviewResponse(
        image="data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
        coordinates=[list(tl), list(tr), list(br), list(bl)],
        mode=mode, width=grid.width, height=grid.height, cloud=cloud_stats,
    )
