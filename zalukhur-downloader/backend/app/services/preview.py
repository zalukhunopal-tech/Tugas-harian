"""Preview citra (true color / false color) pada AOI, dirender di backend sebagai PNG."""
from __future__ import annotations

import base64
import io
import math

import numpy as np
import rasterio
from PIL import Image

from app.bands import BANDS, PREVIEW_MODES
from app.config import Settings
from app.models.scene import PreviewResponse
from app.processing import raster
from app.processing.resampling import choose
from app.services import aoi as aoi_svc
from app.services.crop import _band_nodata, _band_scale_offset, asset_source, scene_grid

REFLECTANCE_MAX = 0.3  # peregangan tampilan: 0..0.3 -> 0..255
GAMMA = 1 / 1.4


def render(item: dict, aoi_4326, mode: str, settings: Settings) -> PreviewResponse:
    bands = PREVIEW_MODES[mode]
    minx, miny, maxx, maxy = aoi_svc.project(aoi_4326, "EPSG:4326", aoi_svc.utm_epsg(*aoi_4326.centroid.coords[0])).bounds
    side = max(maxx - minx, maxy - miny)
    res = max(10, int(math.ceil(side / settings.preview_max_px / 10.0)) * 10)

    with rasterio.Env(**raster.GDAL_HTTP_ENV):
        grid, aoi_crs = scene_grid(item, aoi_4326, res, settings, max_pixels=10 * settings.preview_max_px**2)
        inside = raster.aoi_mask(aoi_crs, grid)
        channels = []
        valid = inside.copy()
        for band in bands:
            href, asset = asset_source(item, band, settings)
            scale, offset = _band_scale_offset(asset)
            with rasterio.open(href) as src:
                nodata = _band_nodata(asset, src)
                _, method = choose(abs(src.res[0]), res, "auto")
                with raster.open_warped(src, grid, method, nodata) as vrt:
                    dn = vrt.read(1)
            valid &= dn != nodata
            refl = dn.astype("float32") * scale + offset
            channels.append(np.clip(refl / REFLECTANCE_MAX, 0, 1) ** GAMMA)
    rgb = (np.dstack(channels) * 255).astype("uint8")
    alpha = (valid * 255).astype("uint8")
    img = Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)

    x0, y0, x1, y1 = grid.bounds  # minx, miny, maxx, maxy
    crs = grid.crs.to_string()
    tl, tr, br, bl = (aoi_svc.project_xy(crs, "EPSG:4326", x, y) for x, y in [(x0, y1), (x1, y1), (x1, y0), (x0, y0)])
    return PreviewResponse(
        image="data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
        coordinates=[list(tl), list(tr), list(br), list(bl)],
        mode=mode, width=grid.width, height=grid.height,
    )
