"""Verifikasi manual indeks + deteksi perubahan pada scene Sentinel-2 ASLI (butuh internet ke bucket publik).

NDVI/NDWI/NBR dihitung ulang secara INDEPENDEN dari COG sumber (float64) lalu dibandingkan dengan keluaran
aplikasi. Reflektansi = DN*1e-4 untuk ketiga scene: pada Earth Search, offset BOA pada scene baseline >= 04.00
sudah dikurangkan dari DN (lihat app/services/assets.py; metadata `offset: -0.1` tidak boleh diterapkan lagi).
Pemeriksaan kewajaran fisik (indeks hutan) dicetak di akhir.

    PYTHONPATH=. python scripts/verify_real_indices.py
"""
import json
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from shapely.geometry import shape

from app.config import Settings
from app.models.scene import DownloadRequest
from app.processing import raster
from app.services import cloud_mask, crop

B = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/48/M/UB/"
ORIGIN = (300000.0, 9700000.0)


def item(y, m, sid):
    return json.load(urllib.request.urlopen(f"{B}{y}/{m}/{sid}/{sid}.json"))


cur = item(2024, 6, "S2A_48MUB_20240610_0_L2A")
ref = item(2021, 6, "S2A_48MUB_20210606_0_L2A")
S = Settings(data_dir=Path(tempfile.mkdtemp(prefix="zd-realidx-")))
t = Transformer.from_crs(32748, 4326, always_xy=True)
x0, y1 = 300000 + 60000, 9700000 - 30000   # 4x4 km
aoi = {"type": "Polygon", "coordinates": [[list(t.transform(*p)) for p in
       [(x0, y1 - 4000), (x0 + 4000, y1 - 4000), (x0 + 4000, y1), (x0, y1), (x0, y1 - 4000)]]]}
DIL = 20
req = DownloadRequest(scene_id=cur["id"], aoi=aoi, indices=["NDVI", "NDWI", "NBR"], resolution=10, mask_to_aoi=False,
                      cloud_mask={"enabled": True, "dilate_m": DIL},
                      change={"enabled": True, "index": "NDVI", "reference_scene_id": ref["id"], "threshold": 0.1})
out = S.data_dir / "job"
meta = crop.process_scene(cur, shape(aoi), req, out, S, ref_item=ref)
print("AOI 4x4 km,", meta["width"], "x", meta["height"], "px |", meta["cloud_masking"]["statistics"]["masked_pct"], "% ter-mask")


def at10(it, key, r0, c0, h, w):
    """DN band `key` pada grid 10 m global (baris r0.., kolom c0..), dari COG sumber (native 10/20 m)."""
    with rasterio.Env(**raster.GDAL_HTTP_ENV), rasterio.open(it["assets"][key]["href"]) as s:
        f = int(round(abs(s.res[0]) / 10))
        rr, cc = (np.arange(h) + r0) // f, (np.arange(w) + c0) // f
        win = rasterio.windows.Window(cc.min(), rr.min(), cc.max() - cc.min() + 1, rr.max() - rr.min() + 1)
        a = s.read(1, window=win)
    return a[np.ix_(rr - rr.min(), cc - cc.min())]


def bad10(it, r0, c0, h, w):
    """Mask SCL (awan/bayangan/cirrus) + dilasi 20 m (1 piksel SCL), pada grid 10 m."""
    rr, cc = (np.arange(h) + r0) // 2, (np.arange(w) + c0) // 2
    with rasterio.Env(**raster.GDAL_HTTP_ENV), rasterio.open(it["assets"]["scl"]["href"]) as s:
        win = rasterio.windows.Window(cc.min() - 2, rr.min() - 2, cc.max() - cc.min() + 5, rr.max() - rr.min() + 5)
        scl = s.read(1, window=win, boundless=True, fill_value=0)
    bad20 = cloud_mask.dilate(np.isin(scl, [3, 8, 9, 10]), 1)
    return bad20[np.ix_(rr - rr.min() + 2, cc - cc.min() + 2)]


def ndi(it, k1, k2, r0, c0, h, w, mask_bad):
    a, b = at10(it, k1, r0, c0, h, w).astype("float64"), at10(it, k2, r0, c0, h, w).astype("float64")
    ra, rb = a * 1e-4, b * 1e-4
    ok = (a != 0) & (b != 0) & (ra + rb > 0) & ~mask_bad
    o = np.full(a.shape, -9999.0)
    o[ok] = (ra[ok] - rb[ok]) / (ra + rb)[ok]
    return o


pairs = {"NDVI": ("nir", "red"), "NDWI": ("green", "nir"), "NBR": ("nir", "swir22")}
ok_all = True
for name, (k1, k2) in pairs.items():
    with rasterio.open(out / f"AOI_2024-06-10_{name}.tif") as ds:
        got = ds.read(1)
        r0, c0 = round((ORIGIN[1] - ds.transform.f) / 10), round((ds.transform.c - ORIGIN[0]) / 10)
        bad = bad10(cur, r0, c0, ds.height, ds.width)
        exp = ndi(cur, k1, k2, r0, c0, ds.height, ds.width, bad)
        same_mask = np.array_equal(got == -9999, exp == -9999)
        both = (got != -9999) & (exp != -9999)
        err = float(np.abs(got[both] - exp[both]).max())
        ok_all &= same_mask and err < 1e-5
        v = got[got != -9999]
        print(f"{name}: maks selisih {err:.2e} | NoData sama persis: {same_mask} | rentang [{v.min():.3f}, {v.max():.3f}] rata-rata {v.mean():.3f}")

with rasterio.open(out / "AOI_2024-06-10_dNDVI_vs_2021-06-06.tif") as ds:
    d = ds.read(1)
    r0, c0 = round((ORIGIN[1] - ds.transform.f) / 10), round((ds.transform.c - ORIGIN[0]) / 10)
    ci = ndi(cur, "nir", "red", r0, c0, ds.height, ds.width, bad10(cur, r0, c0, ds.height, ds.width))
    ri = ndi(ref, "nir", "red", r0, c0, ds.height, ds.width, bad10(ref, r0, c0, ds.height, ds.width))
    exp = np.where((ci != -9999) & (ri != -9999), ci - ri, -9999.0)
    both = (d != -9999) & (exp != -9999)
    err = float(np.abs(d[both] - exp[both]).max())
    same = np.array_equal(d == -9999, exp == -9999)
    ok_all &= same and err < 1e-5
    print(f"dNDVI (2024 vs 2021): maks selisih {err:.2e}; NoData sama persis: {same}")

st = meta["products"]["change_detection"]["statistics"]
print("kelas perubahan:", {k: f"{v['pct_of_valid']}% ({v['area_ha']} ha)" for k, v in st["classes"].items()})
print("SEMUA COCOK" if ok_all else "ADA YANG TIDAK COCOK")
