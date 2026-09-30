"""Verifikasi manual ke data Sentinel-2 ASLI (butuh internet ke bucket publik sentinel-cogs).

Membaca item STAC scene nyata, menjalankan crop + preview, lalu membandingkan piksel keluaran
dengan pembacaan langsung dari COG sumber. Jalankan dari folder backend:

    PYTHONPATH=. python scripts/verify_real_scene.py
"""
import json, time, sys, urllib.request
import numpy as np, rasterio
from rasterio.windows import from_bounds
from pyproj import Transformer
from shapely.geometry import shape, mapping
from app.config import Settings
from app.models.scene import DownloadRequest
from app.services import crop, preview as pv
from app.processing import raster

U = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/48/M/UB/2024/6/S2A_48MUB_20240610_0_L2A/S2A_48MUB_20240610_0_L2A.json"
item = json.load(urllib.request.urlopen(U))
S = Settings(data_dir=__import__("pathlib").Path(__import__("tempfile").mkdtemp(prefix="zd-real-")))
t = Transformer.from_crs(32748, 4326, always_xy=True)
cx, cy = 300000 + 55000, 9700000 - 55000   # tengah tile
# AOI ~ 2 km x 1.5 km, TIDAK sejajar grid (offset acak) supaya snapping teruji
x0, y0, x1, y1 = cx + 123.0, cy + 77.0, cx + 2123.0, cy + 1577.0
ring = [(x0,y0),(x1,y0),(x1,y1),(x0,y1),(x0,y0)]
aoi = {"type":"Polygon","coordinates":[[list(t.transform(*p)) for p in ring]]}
out = S.data_dir / "job"
import shutil; shutil.rmtree(out, ignore_errors=True)
req = DownloadRequest(scene_id=item["id"], aoi=aoi, bands=["B04","B03","B02","B08","B05"], resolution=10, formats=["geotiff","cog"], mask_to_aoi=False, name="real")
t0 = time.time()
ev = []
meta = crop.process_scene(item, shape(aoi), req, out, S, lambda *a: ev.append(a))
print("crop selesai %.1fs" % (time.time()-t0), meta["outputs"], "%dx%d" % (meta["width"], meta["height"]))
print({b["name"]:(b["resampling"], b["valid_pixel_pct"]) for b in meta["band_details"]})
tif = out/"real_2024-06-10.tif"
with rasterio.Env(**raster.GDAL_HTTP_ENV), rasterio.open(tif) as ds:
    print("CRS", ds.crs, "res", ds.res, "nodata", ds.nodata, "dtype", ds.dtypes[0], "desc", ds.descriptions, "scales", ds.scales, "offsets", ds.offsets)
    for i, b in enumerate(["B04","B03","B02","B08","B05"], 1):
        href = item["assets"][crop.BANDS[b]["asset"]]["href"]
        with rasterio.open(href) as src:
            w = from_bounds(*ds.bounds, transform=src.transform)
            if b == "B05":  # 20 m -> 10 m nearest
                w20 = w.round_offsets().round_lengths()
                a = src.read(1, window=w20)
                ref = np.repeat(np.repeat(a, 2, 0), 2, 1)
            else:
                ref = src.read(1, window=w.round_offsets().round_lengths())
            got = ds.read(i)
            print(b, "sama persis dgn sumber:", np.array_equal(got, ref[:got.shape[0], :got.shape[1]]), got.shape, ref.shape, "min/max", got.min(), got.max())
with rasterio.open(out/"real_2024-06-10_COG.tif") as c:
    print("COG layout", c.tags(ns="IMAGE_STRUCTURE").get("LAYOUT"), "overviews", c.overviews(1))
r = pv.render(item, shape(aoi), "true_color", S)
print("preview", r.width, r.height, r.coordinates[0], r.coordinates[2], len(r.image)//1024, "KB")
