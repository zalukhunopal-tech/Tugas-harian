"""Server STAC palsu untuk pengujian end-to-end (BUKAN untuk produksi).

Melayani POST /v1/search dan GET /v1/collections/sentinel-2-l2a/items/{id} dengan scene
sintetis (COG + SCL lokal; pola awan diketahui). Jalankan:  python -m tests.fake_stac_server --port 9100
"""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request

from tests.conftest import build_stage2_scenes



def build_app(workdir: Path) -> FastAPI:
    scenes = build_stage2_scenes(workdir)  # cur 25 Sep, prev1 18 Sep, prev2 13 Sep, old 8 Sep (offset 0)
    items = {v["item"]["id"]: v["item"] for v in scenes.values()}

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
