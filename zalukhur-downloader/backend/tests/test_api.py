import numpy as np
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


# ================================================================== tahap 2: cloud masking

@pytest.fixture()
def env2(tmp_path, s2):
    from tests.conftest import stage2_aoi
    stac = FakeStac([s2[k]["item"] for k in ("cur", "prev1", "prev2", "old")])
    settings = Settings(data_dir=tmp_path / "data", stac_url="https://stac.test/v1")
    client = httpx.Client(transport=httpx.MockTransport(stac.handler))
    app = create_app(settings, StacCatalog(settings, client))
    with TestClient(app) as tc:
        tc.stac = stac
        yield tc, s2, stage2_aoi()


CUR, P1, P2, OLD = ("S2A_48MUB_20260925_0_L2A", "S2B_48MUB_20260918_0_L2A", "S2A_48MUB_20260913_0_L2A", "S2A_48MUB_20260908_0_L2A")


def test_previous_candidates_sorted_nearest_first(env2):
    tc, _, aoi = env2
    r = tc.post("/api/scenes/previous", json={"scene_id": CUR, "aoi": aoi, "lookback_days": 45})
    assert r.status_code == 200
    d = r.json()
    assert [s["id"] for s in d["scenes"]] == [P1, P2, OLD] and d["message"] is None
    assert [s["days_before"] for s in d["scenes"]] == [7, 12, 17]
    assert all(s["same_tile"] and s["aoi_coverage_pct"] == 100.0 for s in d["scenes"])


def test_previous_candidates_filters(env2):
    tc, _, aoi = env2
    r = tc.post("/api/scenes/previous", json={"scene_id": CUR, "aoi": aoi, "lookback_days": 45, "max_cloud_cover": 5})
    assert [s["id"] for s in r.json()["scenes"]] == [P2, OLD]  # prev1 (7,1%) tersaring
    # tidak ada citra sebelumnya dalam jendela -> pesan PRD
    r = tc.post("/api/scenes/previous", json={"scene_id": CUR, "aoi": aoi, "lookback_days": 3})
    d = r.json()
    assert d["count"] == 0 and d["message"] == "Citra sebelumnya tidak tersedia. Cloud masking berbasis previous image tidak dapat dilakukan."
    # untuk scene tertua tak ada yang lebih lama
    assert tc.post("/api/scenes/previous", json={"scene_id": OLD, "aoi": aoi}).json()["count"] == 0


def test_aoi_cloud_percentages_from_scl(env2):
    tc, s2, aoi = env2
    r = tc.post("/api/scenes/aoi-cloud", json={"scene_ids": [CUR, P2, "S2A_XXXX_00000000_0_L2A"], "aoi": aoi, "dilate_m": 0})
    assert r.status_code == 200
    by = {s["scene_id"]: s for s in r.json()["stats"]}
    assert by[P2]["cloud_pct"] == 0.0 and by[P2]["valid_pct"] == 100.0
    assert 0 < by[CUR]["cloud_pct"] < 20
    assert "tidak ditemukan" in by["S2A_XXXX_00000000_0_L2A"]["error"].lower()
    # nilai harus cocok dengan pola SCL yang diketahui: 60x60 + 10x10 + 30x30 + 30x30 dari 300x300 piksel 20 m
    expected = (60 * 60 + 10 * 10 + 30 * 30 + 30 * 30) / (300 * 300) * 100
    assert by[CUR]["cloud_pct"] == pytest.approx(expected, abs=1.0)
    # dilasi membesarkan angka
    r2 = tc.post("/api/scenes/aoi-cloud", json={"scene_ids": [CUR], "aoi": aoi, "dilate_m": 60})
    assert r2.json()["stats"][0]["cloud_pct"] > by[CUR]["cloud_pct"]


def test_download_with_cloud_mask_and_fill(env2):
    tc, s2, aoi = env2
    r = tc.post("/api/download", json={
        "scene_id": CUR, "aoi": aoi, "bands": ["B04", "B03", "B02"], "mask_to_aoi": False, "formats": ["geotiff", "cog"],
        "cloud_mask": {"enabled": True, "fill_from_previous": True, "previous_scene_ids": [P1, P2], "dilate_m": 20},
    })
    assert r.status_code == 202, r.text
    done = wait_job(tc, r.json()["id"])
    assert done["status"] == "COMPLETED", done
    assert {f["name"] for f in done["files"]} == {
        "AOI_2026-09-25.tif", "AOI_2026-09-25_COG.tif", "AOI_2026-09-25_QA.tif", "metadata.json"}
    meta = tc.get(f"/api/jobs/{r.json()['id']}/files/metadata.json").json()
    cm = meta["cloud_masking"]
    assert cm["method"] == "scl_multi_date_composite" and meta["processing"][-1] == "cloud_mask_multi_date_composite"
    assert [p["id"] for p in cm["previous_scenes"]] == [P1, P2]
    assert cm["statistics"]["unfilled_masked_pixels"] == 0 and cm["statistics"]["filled_pct"] == cm["statistics"]["masked_pct"] > 0
    from rasterio.io import MemoryFile
    with MemoryFile(tc.get(f"/api/jobs/{r.json()['id']}/files/AOI_2026-09-25_QA.tif").content) as mf, mf.open() as qa:
        assert qa.nodata == 255 and qa.crs.to_epsg() == 32748


def test_download_cloud_mask_validation(env2):
    tc, _, aoi = env2
    base = {"scene_id": CUR, "aoi": aoi, "bands": ["B04"]}
    r = tc.post("/api/download", json={**base, "cloud_mask": {"enabled": True, "fill_from_previous": True}})
    assert r.status_code == 422 and "minimal satu citra sebelumnya" in r.json()["detail"]
    # citra 'sebelumnya' yang justru lebih baru
    r = tc.post("/api/download", json={**base, "scene_id": P1,
                "cloud_mask": {"enabled": True, "fill_from_previous": True, "previous_scene_ids": [CUR]}})
    assert r.status_code == 422 and "harus lebih lama" in r.json()["detail"]
    r = tc.post("/api/download", json={**base, "cloud_mask": {"enabled": True, "fill_from_previous": True, "previous_scene_ids": [CUR]}})
    assert r.status_code == 422 and "tidak boleh sama" in r.json()["detail"]
    r = tc.post("/api/download", json={**base, "cloud_mask": {"enabled": True, "fill_from_previous": True, "previous_scene_ids": ["S2A_XXXX_00000000_0_L2A"]}})
    assert r.status_code == 404
    r = tc.post("/api/download", json={**base, "cloud_mask": {"enabled": True, "classes": ["haze"]}})
    assert r.status_code == 422
    # AOI di luar cakupan citra sebelumnya
    from tests.conftest import ORIGIN, utm_box_to_aoi
    far = utm_box_to_aoi(ORIGIN[0] + 60000, ORIGIN[1] - 3000, ORIGIN[0] + 61000, ORIGIN[1] - 2000)
    r = tc.post("/api/download", json={**base, "aoi": far, "cloud_mask": {"enabled": True, "fill_from_previous": True, "previous_scene_ids": [P1]}})
    assert r.status_code == 422 and "tidak menutupi AOI" in r.json()["detail"]


def test_download_cloud_mask_requires_scl(env2):
    tc, s2, aoi = env2
    import copy
    broken = copy.deepcopy(tc.stac.items[CUR])
    del broken["assets"]["scl"]
    tc.stac.items[CUR] = broken
    r = tc.post("/api/download", json={"scene_id": CUR, "aoi": aoi, "bands": ["B04"], "cloud_mask": {"enabled": True}})
    assert r.status_code == 422 and "SCL" in r.json()["detail"]


def test_preview_with_cloud_mask_shows_magenta_and_stats(env2):
    tc, _, aoi = env2
    r = tc.post("/api/scenes/preview", json={"scene_id": CUR, "aoi": aoi, "cloud_mask": {"enabled": True, "dilate_m": 0}})
    assert r.status_code == 200
    d = r.json()
    assert d["cloud"]["masked_pct"] > 0 and d["cloud"]["filled_pct"] == 0
    from PIL import Image
    import base64, io
    img = Image.open(io.BytesIO(base64.b64decode(d["image"].split(",")[1]))).convert("RGBA")
    px = np.array(img)
    magenta = (px[..., 0] == 255) & (px[..., 1] == 0) & (px[..., 2] == 255)
    assert magenta.any()
    assert abs(magenta.mean() * 100 - d["cloud"]["masked_pct"]) < 2.0   # tampilan sejalan dengan statistik

    # dengan pengisian dari prev2 (bersih): tak ada lagi piksel magenta
    r2 = tc.post("/api/scenes/preview", json={"scene_id": CUR, "aoi": aoi, "cloud_mask": {
        "enabled": True, "dilate_m": 0, "fill_from_previous": True, "previous_scene_ids": [P2]}})
    d2 = r2.json()
    px2 = np.array(Image.open(io.BytesIO(base64.b64decode(d2["image"].split(",")[1]))).convert("RGBA"))
    assert not ((px2[..., 0] == 255) & (px2[..., 1] == 0) & (px2[..., 2] == 255)).any()
    assert d2["cloud"]["filled_pct"] == d2["cloud"]["masked_pct"]
