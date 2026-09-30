"""Server STAC palsu untuk pengujian end-to-end (BUKAN untuk produksi).

Melayani POST /v1/search dan GET /v1/collections/sentinel-2-l2a/items/{id} dengan scene
sintetis (COG lokal). Jalankan:  python -m tests.fake_stac_server --port 9100
"""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

import numpy as np
import rasterio
import uvicorn
from affine import Affine
from fastapi import FastAPI, HTTPException, Request

from app.bands import BANDS
from tests.conftest import ORIGIN, EPSG, dn_array, make_item

SCENES = [
    ("S2A_48MUB_20260925_0_L2A", "2026-09-25T03:29:10Z", 4.2),
    ("S2B_48MUB_20260918_0_L2A", "2026-09-18T03:29:10Z", 7.1),
    ("S2A_48MUB_20260910_0_L2A", "2026-09-10T03:29:10Z", 62.0),
]


def build_app(workdir: Path) -> FastAPI:
    hrefs = {}
    for seed, (b, meta) in enumerate(BANDS.items()):
        arr = dn_array(meta["native_res"], seed)
        path = workdir / f"{b}.tif"
        with rasterio.open(path, "w", driver="GTiff", dtype="uint16", count=1, width=arr.shape[1], height=arr.shape[0],
                           crs=f"EPSG:{EPSG}", transform=Affine(meta["native_res"], 0, ORIGIN[0], 0, -meta["native_res"], ORIGIN[1]),
                           nodata=0, tiled=True, blockxsize=256, blockysize=256, compress="deflate") as dst:
            dst.write(arr, 1)
        hrefs[b] = str(path)
    items = {i: make_item(i, d, c, hrefs) for i, d, c in SCENES}

    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.post("/v1/search")
    async def search(request: Request):
        body = await request.json()
        feats = list(items.values())
        lte = ((body.get("query") or {}).get("eo:cloud_cover") or {}).get("lte")
        if lte is not None:
            feats = [f for f in feats if f["properties"]["eo:cloud_cover"] <= lte]
        start, end = body["datetime"].split("/")
        feats = [f for f in feats if start <= f["properties"]["datetime"] <= end]
        feats.sort(key=lambda f: f["properties"]["datetime"], reverse=True)
        return {"type": "FeatureCollection", "features": feats[: body.get("limit", 10)], "links": []}

    @app.get("/v1/collections/sentinel-2-l2a/items/{item_id}")
    def item(item_id: str):
        if item_id not in items:
            raise HTTPException(404)
        return items[item_id]

    return app


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9100)
    args = ap.parse_args()
    with tempfile.TemporaryDirectory() as d:
        uvicorn.run(build_app(Path(d)), host="127.0.0.1", port=args.port, log_level="warning")
