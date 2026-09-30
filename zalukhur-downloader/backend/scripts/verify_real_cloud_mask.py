"""Verifikasi manual cloud masking + pengisian ke scene Sentinel-2 ASLI (butuh internet ke bucket publik).

Scene utama 48MUB 2024-06-10 berawan; pengisi: 2024-06-05, 2024-06-03 (baseline sama) dan
2021-06-06 (baseline 03.00). Pada Earth Search DN ketiganya sudah bebas offset (offset BOA sudah dikurangkan;
lihat app/services/assets.py), sehingga piksel pengisi harus SAMA PERSIS dengan DN sumber. Piksel keluaran
dibandingkan dengan pembacaan langsung dari COG sumber.

    PYTHONPATH=. python scripts/verify_real_cloud_mask.py
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
def item(y, m, sid):
    return json.load(urllib.request.urlopen(f"{B}{y}/{m}/{sid}/{sid}.json"))

cur = item(2024, 6, "S2A_48MUB_20240610_0_L2A")
prevs = [item(2024, 6, "S2B_48MUB_20240605_0_L2A"), item(2024, 6, "S2A_48MUB_20240603_0_L2A"),
         item(2021, 6, "S2A_48MUB_20210606_0_L2A")]
S = Settings(data_dir=Path(tempfile.mkdtemp(prefix="zd-realcm-")))
t = Transformer.from_crs(32748, 4326, always_xy=True)

# cari jendela 6x6 km yang cukup berawan di SCL scene utama
with rasterio.Env(**raster.GDAL_HTTP_ENV), rasterio.open(cur["assets"]["scl"]["href"]) as src:
    scl = src.read(1, out_shape=(549, 549))  # 200 m per piksel, cukup untuk memilih lokasi
bad = np.isin(scl, [3, 8, 9, 10]).astype(float)
k = 30  # 30 piksel * 200 m = 6 km
best = None
for r in range(0, 549 - k, 10):
    for c in range(0, 549 - k, 10):
        f = bad[r:r + k, c:c + k].mean()
        if 0.15 <= f <= 0.45 and (best is None or abs(f - .3) < abs(best[0] - .3)):
            best = (f, r, c)
f, r, c = best
x0, y1 = 300000 + c * 200, 9700000 - r * 200
ring = [(x0, y1 - 6000), (x0 + 6000, y1 - 6000), (x0 + 6000, y1), (x0, y1), (x0, y1 - 6000)]
aoi = {"type": "Polygon", "coordinates": [[list(t.transform(*p)) for p in ring]]}
print(f"AOI 6x6 km dipilih (awan kasar ~{f:.0%})")

req = DownloadRequest(
    scene_id=cur["id"], aoi=aoi, bands=["B04", "B03", "B02"], resolution=10, mask_to_aoi=False, formats=["geotiff"],
    cloud_mask={"enabled": True, "fill_from_previous": True, "previous_scene_ids": [p["id"] for p in prevs], "dilate_m": 20},
)
out = S.data_dir / "job"
meta = crop.process_scene(cur, shape(aoi), req, out, S, prev_items=prevs)
cm = meta["cloud_masking"]
print("method", cm["method"], "| masked %.1f%% filled %.1f%% unfilled %.1f%%" % (
    cm["statistics"]["masked_pct"], cm["statistics"]["filled_pct"], cm["statistics"]["unfilled_masked_pct"]))
for p in cm["previous_scenes"]:
    print("  isi dari", p["id"], "%.1f%%" % p["filled_pct"])

def read_like(item_, band, ds, win_of):
    a = item_["assets"][crop.BANDS[band]["asset"]]
    with rasterio.Env(**raster.GDAL_HTTP_ENV), rasterio.open(a["href"]) as s:
        w = rasterio.windows.from_bounds(*ds.bounds, transform=s.transform).round_offsets().round_lengths()
        return s.read(1, window=w).astype("int64"), a["raster:bands"][0]["offset"]

with rasterio.open(out / "AOI_2024-06-10.tif") as ds, rasterio.open(out / "AOI_2024-06-10_QA.tif") as qa:
    got, q = ds.read(1).astype("int64"), qa.read(1)
    cur_dn, cur_off = read_like(cur, "B04", ds, None)
    clear = q == 1
    print("piksel bersih identik dgn citra utama:", np.array_equal(got[clear], cur_dn[clear]), f"({clear.sum()} px)")
    for i, p in enumerate(prevs, start=1):
        sel = q == i + 1
        if not sel.any():
            print(f"  prev{i}: tidak dipakai"); continue
        pdn, poff = read_like(p, "B04", ds, None)
        print(f"  prev{i} ({p['id']}, offset katalog {poff}): {sel.sum()} px terisi, DN identik dgn sumber (tanpa geser offset):",
              np.array_equal(got[sel], pdn[sel]))
    un = q == 254
    print("piksel tak terisi = NoData:", bool((got[un] == 0).all()), f"({un.sum()} px)")
    print("QA kode:", {int(v): int((q == v).sum()) for v in np.unique(q)})
