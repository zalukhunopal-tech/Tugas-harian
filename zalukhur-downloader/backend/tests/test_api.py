import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.catalog import StacCatalog
from tests.conftest import EPSG, ORIGIN, make_item, utm_box_to_aoi


class FakeStac:
    """Katalog tiruan berbasis httpx.MockTransport (hanya untuk pengujian)."""

    def __init__(self, items):
        self.items = {i["id"]: i for i in items}
        self.requests = []
        self.fail = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.fail:
            self.fail -= 1
            return httpx.Response(503)
        path = request.url.path
        if request.method == "POST" and path.endswith("/search"):
            body = json.loads(request.content)
            feats = list(self.items.values())
            q = (body.get("query") or {}).get("eo:cloud_cover", {}).get("lte")
            if q is not None:
                feats = [f for f in feats if f["properties"]["eo:cloud_cover"] <= q]
            start, end = body["datetime"].split("/")
            feats = [f for f in feats if start <= f["properties"]["datetime"] <= end]
            feats.sort(key=lambda f: f["properties"]["datetime"], reverse=True)
            limit = body.get("limit", 10)
            page = int(body.get("page", 1))
            chunk = feats[(page - 1) * limit: page * limit]
            links = []
            if page * limit < len(feats):
                links = [{"rel": "next", "method": "POST", "body": {**body, "page": page + 1}, "href": str(request.url)}]
            return httpx.Response(200, json={"type": "FeatureCollection", "features": chunk, "links": links})
        if request.method == "GET" and "/items/" in path:
            iid = path.rsplit("/", 1)[1]
            if iid in self.items:
                return httpx.Response(200, json=self.items[iid])
            return httpx.Response(404, json={"code": "NotFoundError"})
        return httpx.Response(404)


@pytest.fixture()
def env(tmp_path, scene_dir):
    d, _ = scene_dir
    from app.bands import BANDS
    hrefs = {b: str(d / f"{b}.tif") for b in BANDS}
    items = [
        make_item("S2A_48MUB_20260925_0_L2A", "2026-09-25T03:29:10Z", 4.2, hrefs),
        make_item("S2B_48MUB_20260918_0_L2A", "2026-09-18T03:29:10Z", 7.1, hrefs),
        make_item("S2A_48MUB_20260910_0_L2A", "2026-09-10T03:29:10Z", 62.0, hrefs),
        make_item("S2A_48MUB_20260101_0_L2A", "2026-01-01T03:29:10Z", 2.3, hrefs),
    ]
    stac = FakeStac(items)
    settings = Settings(data_dir=tmp_path / "data", stac_url="https://stac.test/v1")
    client = httpx.Client(transport=httpx.MockTransport(stac.handler))
    app = create_app(settings, StacCatalog(settings, client))
    with TestClient(app) as tc:
        yield tc, stac, settings


AOI = utm_box_to_aoi(ORIGIN[0] + 2000, ORIGIN[1] - 3000, ORIGIN[0] + 3000, ORIGIN[1] - 2000)


def search_body(**kw):
    return {"aoi": AOI, "start_date": "2026-09-01", "end_date": "2026-09-30", "max_cloud_cover": 20, **kw}


# ---- AOI -----------------------------------------------------------------------

def test_health_and_config(env):
    tc, *_ = env
    assert tc.get("/api/health").json() == {"status": "ok"}
    cfg = tc.get("/api/config").json()
    assert cfg["resolutions"] == [10, 20, 60] and cfg["presets"]["rgb"] == ["B04", "B03", "B02"]


def test_aoi_endpoint_polygon_point_and_errors(env):
    tc, *_ = env
    r = tc.post("/api/aoi", json={"geometry": AOI})
    assert r.status_code == 200 and r.json()["area_km2"] == pytest.approx(1.0, rel=0.02)
    r = tc.post("/api/aoi", json={"lat": -2.7, "lon": 102.3, "radius_m": 500})
    assert r.status_code == 200 and r.json()["kind"] == "point"
    r = tc.post("/api/aoi", json={"geometry": {"type": "Point", "coordinates": [102.3, -2.7]}})
    assert r.status_code == 422 and "radius" in r.json()["detail"]
    r = tc.post("/api/aoi", json={"geometry": {"type": "Polygon", "coordinates": [[[100, -3], [104, -3], [104, 1], [100, 1], [100, -3]]]}})
    assert r.status_code == 422 and r.json()["code"] == "invalid_aoi" and "terlalu besar" in r.json()["detail"]
    r = tc.post("/api/aoi", json={"lat": 1})
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_aoi_upload_geojson_and_limits(env):
    tc, *_ = env
    payload = json.dumps({"type": "Feature", "properties": {}, "geometry": AOI}).encode()
    r = tc.post("/api/aoi/upload", files={"file": ("a.geojson", payload, "application/json")})
    assert r.status_code == 200 and r.json()["kind"] == "polygon"
    r = tc.post("/api/aoi/upload", files={"file": ("a.txt", b"x", "text/plain")})
    assert r.status_code == 422 and "tidak didukung" in r.json()["detail"]
    big = b"0" * (21 * 1024 * 1024)
    r = tc.post("/api/aoi/upload", files={"file": ("a.geojson", big, "application/json")})
    assert r.status_code == 413


# ---- Search --------------------------------------------------------------------

def test_search_filters_by_date_and_cloud_sorted_desc(env):
    tc, stac, _ = env
    r = tc.post("/api/scenes/search", json=search_body())
    assert r.status_code == 200
    data = r.json()
    assert [s["id"] for s in data["scenes"]] == ["S2A_48MUB_20260925_0_L2A", "S2B_48MUB_20260918_0_L2A"]
    s0 = data["scenes"][0]
    assert s0["cloud_cover"] == 4.2 and s0["tile"] == "48MUB" and s0["date"] == "2026-09-25"
    assert s0["product_level"] == "L2A" and s0["aoi_coverage_pct"] == 100.0
    sent = json.loads(stac.requests[-1].content)
    assert sent["collections"] == ["sentinel-2-l2a"]
    assert sent["query"] == {"eo:cloud_cover": {"lte": 20}}
    assert sent["datetime"] == "2026-09-01T00:00:00Z/2026-09-30T23:59:59Z"
    assert sent["intersects"]["type"] == "Polygon"


def test_search_single_date(env):
    tc, *_ = env
    r = tc.post("/api/scenes/search", json=search_body(start_date="2026-09-25", end_date="2026-09-25", max_cloud_cover=100))
    assert [s["date"] for s in r.json()["scenes"]] == ["2026-09-25"]


def test_search_no_scenes_message(env):
    tc, *_ = env
    r = tc.post("/api/scenes/search", json=search_body(start_date="2025-01-01", end_date="2025-01-31"))
    assert r.json()["count"] == 0 and r.json()["message"] == "Tidak ditemukan citra yang memenuhi kriteria."


def test_search_all_too_cloudy_message(env):
    tc, *_ = env
    r = tc.post("/api/scenes/search", json=search_body(start_date="2026-09-08", end_date="2026-09-12", max_cloud_cover=20))
    d = r.json()
    assert d["count"] == 0
    assert d["message"] == "Tidak tersedia citra dengan cloud cover ≤20% pada periode tersebut."
    assert d["min_cloud_cover_available"] == 62.0


def test_search_pagination_and_limit(env):
    tc, stac, _ = env
    r = tc.post("/api/scenes/search", json=search_body(start_date="2026-01-01", end_date="2026-12-31", max_cloud_cover=100, limit=3))
    d = r.json()
    assert d["count"] == 3 and d["truncated"] is True
    r = tc.post("/api/scenes/search", json=search_body(start_date="2026-01-01", end_date="2026-12-31", max_cloud_cover=100, limit=10))
    assert r.json()["count"] == 4 and r.json()["truncated"] is False


def test_search_validation(env):
    tc, *_ = env
    r = tc.post("/api/scenes/search", json=search_body(start_date="2026-10-01", end_date="2026-09-01"))
    assert r.status_code == 422 and "Tanggal akhir" in r.json()["detail"]
    r = tc.post("/api/scenes/search", json=search_body(max_cloud_cover=120))
    assert r.status_code == 422
    r = tc.post("/api/scenes/search", json=search_body(satellite="landsat"))
    assert r.status_code == 422
    r = tc.post("/api/scenes/search", json={**search_body(), "aoi": {"type": "Point", "coordinates": [1, 1]}})
    assert r.status_code == 422 and r.json()["code"] == "invalid_aoi"


def test_catalog_retry_then_error(env, monkeypatch):
    tc, stac, _ = env
    monkeypatch.setattr("time.sleep", lambda *_: None)
    stac.fail = 2
    assert tc.post("/api/scenes/search", json=search_body()).status_code == 200  # pulih setelah 2 kegagalan
    stac.fail = 10
    r = tc.post("/api/scenes/search", json=search_body())
    assert r.status_code == 502 and r.json()["code"] == "catalog_error"


# ---- Preview -------------------------------------------------------------------

def test_preview_png_with_corners(env):
    tc, *_ = env
    r = tc.post("/api/scenes/preview", json={"scene_id": "S2A_48MUB_20260925_0_L2A", "aoi": AOI, "mode": "true_color"})
    assert r.status_code == 200
    d = r.json()
    assert d["image"].startswith("data:image/png;base64,")
    assert d["width"] >= 100 and d["height"] >= 100
    tl, tr, br, bl = d["coordinates"]
    assert tl[0] < tr[0] and tl[1] > bl[1]  # barat->timur, utara->selatan
    from PIL import Image
    import base64, io
    img = Image.open(io.BytesIO(base64.b64decode(d["image"].split(",")[1])))
    assert img.mode == "RGBA" and img.size == (d["width"], d["height"])
    assert img.getchannel("A").getextrema()[1] == 255
    # false color juga bekerja
    assert tc.post("/api/scenes/preview", json={"scene_id": "S2A_48MUB_20260925_0_L2A", "aoi": AOI, "mode": "false_color"}).status_code == 200


def test_preview_bad_ids(env):
    tc, *_ = env
    assert tc.post("/api/scenes/preview", json={"scene_id": "../etc/passwd", "aoi": AOI}).status_code == 404
    assert tc.post("/api/scenes/preview", json={"scene_id": "NOPE_1234", "aoi": AOI}).status_code == 404


# ---- Download job ----------------------------------------------------------------

def wait_job(tc, job_id, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = tc.get(f"/api/jobs/{job_id}").json()
        if j["status"] in ("COMPLETED", "FAILED"):
            return j
        time.sleep(0.05)
    raise AssertionError("job timeout")


def test_download_job_lifecycle_and_files(env):
    tc, *_ = env
    r = tc.post("/api/download", json={
        "scene_id": "S2A_48MUB_20260925_0_L2A", "aoi": AOI, "bands": ["B04", "B03", "B02"],
        "resolution": 10, "formats": ["geotiff", "cog"], "name": "Lokasi Uji",
    })
    assert r.status_code == 202
    job = r.json()
    assert job["status"] in ("QUEUED", "DOWNLOADING", "GENERATING", "COMPLETED")
    done = wait_job(tc, job["id"])
    assert done["status"] == "COMPLETED", done
    names = {f["name"] for f in done["files"]}
    assert names == {"Lokasi_Uji_2026-09-25_COG.tif", "Lokasi_Uji_2026-09-25.tif", "metadata.json"}
    f = tc.get(done["files"][0]["url"])
    assert f.status_code == 200 and len(f.content) > 1000
    meta = tc.get(f"/api/jobs/{job['id']}/files/metadata.json").json()
    assert meta["bands"] == ["B04", "B03", "B02"] and meta["cloud_cover"] == 4.2
    # QGIS-ready: dapat dibuka dan georeferensi benar
    import rasterio, io
    from rasterio.io import MemoryFile
    with MemoryFile(tc.get(f"/api/jobs/{job['id']}/files/Lokasi_Uji_2026-09-25.tif").content) as mf, mf.open() as ds:
        assert ds.crs.to_epsg() == EPSG and ds.count == 3


def test_download_failure_reports_message(env):
    tc, *_ = env
    far = utm_box_to_aoi(ORIGIN[0] + 60000, ORIGIN[1] - 3000, ORIGIN[0] + 61000, ORIGIN[1] - 2000)
    r = tc.post("/api/download", json={"scene_id": "S2A_48MUB_20260925_0_L2A", "aoi": far, "bands": ["B04"]})
    done = wait_job(tc, r.json()["id"])
    assert done["status"] == "FAILED" and "tidak beririsan" in done["error"] and done["files"] == []


def test_download_validation_and_unknown_scene(env):
    tc, *_ = env
    base = {"scene_id": "S2A_48MUB_20260925_0_L2A", "aoi": AOI, "bands": ["B04"]}
    assert tc.post("/api/download", json={**base, "bands": []}).status_code == 422
    assert tc.post("/api/download", json={**base, "bands": ["B99"]}).status_code == 422
    assert tc.post("/api/download", json={**base, "resolution": 15}).status_code == 422
    assert tc.post("/api/download", json={**base, "formats": []}).status_code == 422
    assert tc.post("/api/download", json={**base, "resampling": "lanczos"}).status_code == 422
    assert tc.post("/api/download", json={**base, "scene_id": "S2A_XXXX_00000000_0_L2A"}).status_code == 404


def test_job_file_security(env):
    tc, *_ = env
    r = tc.post("/api/download", json={"scene_id": "S2A_48MUB_20260925_0_L2A", "aoi": AOI, "bands": ["B04"]})
    jid = r.json()["id"]
    wait_job(tc, jid)
    assert tc.get(f"/api/jobs/{jid}/files/job.json").status_code == 404  # bukan keluaran
    assert tc.get(f"/api/jobs/{jid}/files/..%2Fjob.json").status_code == 404
    assert tc.get("/api/jobs/doesnotexist").status_code == 404
