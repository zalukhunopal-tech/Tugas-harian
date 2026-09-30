"""Fixture pengujian. Data sintetis HANYA untuk pengujian otomatis (bukan pengganti API di produksi)."""
from __future__ import annotations

import os

os.environ["ALLOW_LOCAL_ASSETS"] = "1"

from datetime import datetime, timezone

import numpy as np
import pytest
import rasterio
from affine import Affine
from pyproj import Transformer
from shapely.geometry import box, mapping

from app.bands import BANDS

EPSG = 32748
ORIGIN = (300000.0, 9700000.0)
SIZE_M = 12000  # 12 km x 12 km


def dn_array(res: int, band_seed: int) -> np.ndarray:
    n = SIZE_M // res
    rows, cols = np.mgrid[0:n, 0:n]
    # nilai unik per posisi sel asli; tidak pernah 0 (0 = nodata)
    return (1 + (cols * 13 + rows * 7 + band_seed * 101) % 60000).astype("uint16")


def item_footprint():
    t = Transformer.from_crs(EPSG, 4326, always_xy=True)
    x0, y1 = ORIGIN
    corners = [(x0, y1), (x0 + SIZE_M, y1), (x0 + SIZE_M, y1 - SIZE_M), (x0, y1 - SIZE_M), (x0, y1)]
    return {"type": "Polygon", "coordinates": [[list(t.transform(*c)) for c in corners]]}


def make_item(item_id="S2A_48MUB_20260925_0_L2A", date="2026-09-25T03:29:10Z", cloud=4.2, hrefs=None):
    hrefs = hrefs or {}
    assets = {}
    for b, meta in BANDS.items():
        if b in hrefs:
            assets[meta["asset"]] = {
                "href": hrefs[b],
                "raster:bands": [{"nodata": 0, "data_type": "uint16", "scale": 0.0001, "offset": -0.1,
                                  "spatial_resolution": meta["native_res"]}],
            }
    assets["thumbnail"] = {"href": f"https://example.invalid/{item_id}/thumbnail.jpg"}
    return {
        "type": "Feature", "stac_version": "1.0.0", "id": item_id, "collection": "sentinel-2-l2a",
        "geometry": item_footprint(),
        "properties": {
            "datetime": date, "eo:cloud_cover": cloud, "proj:epsg": EPSG, "platform": "sentinel-2a",
            "grid:code": "MGRS-48MUB",
        },
        "assets": assets, "links": [],
    }


@pytest.fixture(scope="session")
def scene_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("scene")
    arrays = {}
    for seed, (b, meta) in enumerate(BANDS.items()):
        res = meta["native_res"]
        arr = dn_array(res, seed)
        arrays[b] = arr
        with rasterio.open(
            d / f"{b}.tif", "w", driver="GTiff", dtype="uint16", count=1, width=arr.shape[1], height=arr.shape[0],
            crs=f"EPSG:{EPSG}", transform=Affine(res, 0, ORIGIN[0], 0, -res, ORIGIN[1]), nodata=0,
            tiled=True, blockxsize=256, blockysize=256, compress="deflate",
        ) as dst:
            dst.write(arr, 1)
    return d, arrays


@pytest.fixture()
def item(scene_dir):
    d, _ = scene_dir
    return make_item(hrefs={b: str(d / f"{b}.tif") for b in BANDS})


@pytest.fixture()
def arrays(scene_dir):
    return scene_dir[1]


def utm_box_to_aoi(x0, y0, x1, y1):
    """Kotak di koordinat UTM scene -> geometri WGS84 (dengan sisi utk poligon miring)."""
    t = Transformer.from_crs(EPSG, 4326, always_xy=True)
    ring = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    return {"type": "Polygon", "coordinates": [[list(t.transform(*p)) for p in ring]]}
