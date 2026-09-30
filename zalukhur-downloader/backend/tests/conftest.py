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


def make_item(item_id="S2A_48MUB_20260925_0_L2A", date="2026-09-25T03:29:10Z", cloud=4.2, hrefs=None, offset=-0.1):
    hrefs = hrefs or {}
    assets = {}
    for b, meta in BANDS.items():
        if b in hrefs:
            assets[meta["asset"]] = {
                "href": hrefs[b],
                "raster:bands": [{"nodata": 0, "data_type": "uint16", "scale": 0.0001, "offset": offset,
                                  "spatial_resolution": meta["native_res"]}],
            }
    if "SCL" in hrefs:
        assets["scl"] = {"href": hrefs["SCL"], "raster:bands": [{"nodata": 0, "data_type": "uint8", "spatial_resolution": 20}]}
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


# ---------------------------------------------------------------------------- tahap 2
SCL_N = SIZE_M // 20  # 600 x 600 piksel 20 m


def scl_pattern(kind: str) -> np.ndarray:
    """Pola SCL 20 m yang diketahui. Indeks (baris, kolom) pada grid 20 m tile."""
    scl = np.full((SCL_N, SCL_N), 4, dtype="uint8")  # vegetasi
    if kind == "cur":
        scl[100:160, 100:160] = 9   # awan probabilitas tinggi
        scl[100:110, 200:210] = 8   # awan probabilitas sedang
        scl[200:230, 100:130] = 10  # cirrus tipis
        scl[200:230, 200:230] = 3   # bayangan awan
        scl[300:330, 100:130] = 11  # salju/es
    elif kind == "prev1":
        scl[130:200, 130:200] = 9   # awan menimpa sebagian awan citra utama (baris/kolom 130:160)
        scl[200:230, 200:230] = 3   # bayangan juga di lokasi yang sama -> tak bisa mengisi bayangan cur
    elif kind == "clean":
        pass
    else:
        raise ValueError(kind)
    return scl


def write_scene(d, name: str, *, dn_seed_shift: int = 0, dn_add: int = 0, scl=None):
    """Tulis semua band + SCL untuk satu scene sintetis; kembalikan (hrefs, {band: array})."""
    import rasterio as rio

    hrefs, arrays = {}, {}
    for seed, (b, meta) in enumerate(BANDS.items()):
        res = meta["native_res"]
        arr = (dn_array(res, seed + dn_seed_shift).astype("uint32") + dn_add).clip(1, 65535).astype("uint16")
        arrays[b] = arr
        path = d / f"{name}_{b}.tif"
        with rio.open(path, "w", driver="GTiff", dtype="uint16", count=1, width=arr.shape[1], height=arr.shape[0],
                      crs=f"EPSG:{EPSG}", transform=Affine(res, 0, ORIGIN[0], 0, -res, ORIGIN[1]), nodata=0,
                      tiled=True, blockxsize=256, blockysize=256, compress="deflate") as dst:
            dst.write(arr, 1)
        hrefs[b] = str(path)
    if scl is not None:
        path = d / f"{name}_SCL.tif"
        with rio.open(path, "w", driver="GTiff", dtype="uint8", count=1, width=SCL_N, height=SCL_N,
                      crs=f"EPSG:{EPSG}", transform=Affine(20, 0, ORIGIN[0], 0, -20, ORIGIN[1]), nodata=0,
                      tiled=True, blockxsize=256, blockysize=256, compress="deflate") as dst:
            dst.write(scl, 1)
        hrefs["SCL"] = str(path)
    return hrefs, arrays


def build_stage2_scenes(d):
    """cur (25 Sep) + prev1 (18 Sep, berawan sebagian) + prev2 (13 Sep, bersih) + old (8 Sep, offset 0)."""
    specs = [
        ("cur", "S2A_48MUB_20260925_0_L2A", "2026-09-25T03:29:10Z", 4.2, dict(scl=scl_pattern("cur")), -0.1),
        ("prev1", "S2B_48MUB_20260918_0_L2A", "2026-09-18T03:29:10Z", 7.1, dict(dn_seed_shift=50, scl=scl_pattern("prev1")), -0.1),
        ("prev2", "S2A_48MUB_20260913_0_L2A", "2026-09-13T03:29:10Z", 2.0, dict(dn_seed_shift=90, scl=scl_pattern("clean")), -0.1),
        # baseline lama: offset 0 -> DN sama dengan reflektansi*10000; setara DN_cur = DN + 1000
        ("old", "S2A_48MUB_20260908_0_L2A", "2026-09-08T03:29:10Z", 1.0, dict(dn_seed_shift=130, scl=scl_pattern("clean")), 0.0),
    ]
    out = {}
    for name, iid, date, cloud, kw, offset in specs:
        hrefs, arrays = write_scene(d, name, **kw)
        out[name] = {"item": make_item(iid, date, cloud, hrefs, offset=offset), "arrays": arrays, "scl": kw["scl"]}
    return out


@pytest.fixture(scope="session")
def s2(tmp_path_factory):
    return build_stage2_scenes(tmp_path_factory.mktemp("stage2"))


# AOI besar yang mencakup seluruh pola awan (x 1000..7000, y 1000..7000 m dari origin)
def stage2_aoi():
    return utm_box_to_aoi(ORIGIN[0] + 1000, ORIGIN[1] - 7000, ORIGIN[0] + 7000, ORIGIN[1] - 1000)
