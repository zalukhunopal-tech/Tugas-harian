import json

import numpy as np
import pytest
import rasterio
from shapely.geometry import shape

from app.config import Settings
from app.errors import ProcessingError
from app.models.scene import DownloadRequest
from app.services import crop
from tests.conftest import ORIGIN, EPSG, utm_box_to_aoi

SETTINGS = Settings()


def run(item, aoi_geojson, tmp_path, **kw):
    req = DownloadRequest(scene_id=item["id"], aoi=aoi_geojson, **kw)
    events = []
    meta = crop.process_scene(item, shape(aoi_geojson), req, tmp_path, SETTINGS, lambda s, p, m: events.append((s, p, m)))
    return req, meta, events


def test_crop_10m_matches_source_pixels_exactly(item, arrays, tmp_path):
    # AOI persegi di dalam scene, di kelipatan 10 m dari origin: kolom 200..300, baris 100..180
    x0, x1 = ORIGIN[0] + 2000, ORIGIN[0] + 3000
    y1, y0 = ORIGIN[1] - 1000, ORIGIN[1] - 1800
    aoi = utm_box_to_aoi(x0, y0, x1, y1)
    _, meta, events = run(item, aoi, tmp_path, bands=["B04", "B03", "B02"], resolution=10, mask_to_aoi=False)

    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        assert ds.crs.to_epsg() == EPSG
        assert ds.nodata == 0
        assert ds.dtypes == ("uint16",) * 3
        assert ds.descriptions == ("B04", "B03", "B02")
        assert ds.res == (10.0, 10.0)
        assert ds.scales == (0.0001,) * 3 and ds.offsets == (-0.1,) * 3
        # georeferencing: bounds harus persis kelipatan piksel di atas origin tile
        assert (ds.transform.c - ORIGIN[0]) % 10 == 0 and (ORIGIN[1] - ds.transform.f) % 10 == 0
        c0 = round((ds.transform.c - ORIGIN[0]) / 10)
        r0 = round((ORIGIN[1] - ds.transform.f) / 10)
        for i, b in enumerate(["B04", "B03", "B02"], start=1):
            expected = arrays[b][r0:r0 + ds.height, c0:c0 + ds.width]
            np.testing.assert_array_equal(ds.read(i), expected)
        assert ds.width * 10 >= 1000 and ds.width * 10 <= 1020  # AOI ~1000 m, dibulatkan keluar
        assert ds.tags()["SCENE_ID"] == "S2A_48MUB_20260925_0_L2A"
    assert [e[0] for e in events][0] == "DOWNLOADING" and events[-1][0] == "GENERATING"
    assert meta["outputs"] == {"geotiff": "AOI_2026-09-25.tif", "metadata": "metadata.json"}


def test_aoi_polygon_mask_sets_outside_to_nodata(item, tmp_path):
    # segitiga: separuh kotak berada di luar poligon
    x0, y0 = ORIGIN[0] + 2000, ORIGIN[1] - 1800
    from pyproj import Transformer
    t = Transformer.from_crs(EPSG, 4326, always_xy=True)
    tri = {"type": "Polygon", "coordinates": [[list(t.transform(*p)) for p in
           [(x0, y0), (x0 + 1000, y0), (x0, y0 + 800), (x0, y0)]]]}
    _, meta, _ = run(item, tri, tmp_path, bands=["B04"], resolution=10, mask_to_aoi=True)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        a = ds.read(1)
        valid = (a != 0).mean()
        assert 0.4 < valid < 0.6
        # dekat sudut siku-siku (kiri-bawah) terisi; dekat sudut kanan-atas (di luar hipotenusa) nodata
        assert a[-6, 5] != 0 and a[5, -6] == 0
    assert "aoi_polygon_mask" in meta["processing"]
    assert 90 < meta["band_details"][0]["valid_pixel_pct"] <= 100  # nyaris semua piksel DI DALAM AOI terisi


def test_resolution_20m_native_and_downsampled_and_upsampled(item, arrays, tmp_path):
    x0, y1 = ORIGIN[0] + 4000, ORIGIN[1] - 4000
    aoi = utm_box_to_aoi(x0, y1 - 2000, x0 + 2000, y1)
    _, meta, _ = run(item, aoi, tmp_path, bands=["B04", "B05", "B01"], resolution=20, mask_to_aoi=False)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        assert ds.res == (20.0, 20.0)
        c0 = round((ds.transform.c - ORIGIN[0]) / 20); r0 = round((ORIGIN[1] - ds.transform.f) / 20)
        # B05 native 20 m -> identik dengan sumber
        np.testing.assert_array_equal(ds.read(2), arrays["B05"][r0:r0 + ds.height, c0:c0 + ds.width])
        # B04 10 m -> rata-rata blok 2x2
        src = arrays["B04"][2 * r0:2 * (r0 + ds.height), 2 * c0:2 * (c0 + ds.width)].astype("float64")
        avg = src.reshape(ds.height, 2, ds.width, 2).mean(axis=(1, 3))
        assert np.abs(ds.read(1).astype("float64") - avg).max() <= 1.0
        # B01 60 m -> upsampling nearest: setiap piksel adalah salah satu nilai asli 60 m
        b01 = ds.read(3)
        assert set(np.unique(b01)).issubset(set(np.unique(arrays["B01"])))
    by = {b["name"]: b for b in meta["band_details"]}
    assert by["B05"]["resampling"] == "none"
    assert by["B04"]["resampling"] == "average"
    assert by["B01"]["resampling"] == "nearest"
    assert meta["resolution"] == "20m"


def test_upsample_10m_from_20m_band_is_positionally_exact(item, arrays, tmp_path):
    x0, y1 = ORIGIN[0] + 4000, ORIGIN[1] - 4000
    aoi = utm_box_to_aoi(x0, y1 - 1000, x0 + 1000, y1)
    run(item, aoi, tmp_path, bands=["B05"], resolution=10, mask_to_aoi=False)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        c0 = round((ds.transform.c - ORIGIN[0]) / 10); r0 = round((ORIGIN[1] - ds.transform.f) / 10)
        rows = (np.arange(ds.height) + r0) // 2
        cols = (np.arange(ds.width) + c0) // 2
        np.testing.assert_array_equal(ds.read(1), arrays["B05"][np.ix_(rows, cols)])


def test_cog_output_valid_and_preserves_georef(item, tmp_path):
    aoi = utm_box_to_aoi(ORIGIN[0] + 1000, ORIGIN[1] - 3000, ORIGIN[0] + 4000, ORIGIN[1] - 1000)
    _, meta, _ = run(item, aoi, tmp_path, bands=["B04", "B08"], resolution=10, formats=["geotiff", "cog"], mask_to_aoi=False)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as a, rasterio.open(tmp_path / "AOI_2026-09-25_COG.tif") as b:
        assert a.crs == b.crs and a.transform == b.transform and a.nodata == b.nodata
        assert b.profile["tiled"] and b.overviews(1)  # overview ada
        np.testing.assert_array_equal(a.read(), b.read())
        assert b.descriptions == ("B04", "B08")
        assert b.scales == (0.0001, 0.0001) and b.offsets == (-0.1, -0.1)
        assert b.tags(ns="IMAGE_STRUCTURE").get("LAYOUT") == "COG"


def test_cog_only_removes_intermediate_geotiff(item, tmp_path):
    aoi = utm_box_to_aoi(ORIGIN[0] + 1000, ORIGIN[1] - 3000, ORIGIN[0] + 2000, ORIGIN[1] - 2000)
    _, meta, _ = run(item, aoi, tmp_path, bands=["B04"], formats=["cog"], mask_to_aoi=False, name="Hutan Kota!")
    names = sorted(p.name for p in tmp_path.iterdir())
    assert names == ["Hutan_Kota_2026-09-25_COG.tif", "metadata.json"]
    assert meta["outputs"] == {"cog": "Hutan_Kota_2026-09-25_COG.tif", "metadata": "metadata.json"}


def test_metadata_contents(item, tmp_path):
    aoi = utm_box_to_aoi(ORIGIN[0] + 1000, ORIGIN[1] - 3000, ORIGIN[0] + 2000, ORIGIN[1] - 2000)
    _, meta, _ = run(item, aoi, tmp_path, bands=["B02", "B03", "B04"], mask_to_aoi=False)
    on_disk = json.loads((tmp_path / "metadata.json").read_text())
    assert on_disk == json.loads(json.dumps(meta))
    assert on_disk["satellite"] == "Sentinel-2"
    assert on_disk["acquisition_date"] == "2026-09-25"
    assert on_disk["cloud_cover"] == 4.2
    assert on_disk["bands"] == ["B02", "B03", "B04"]
    assert on_disk["resolution"] == "10m"
    assert on_disk["processing"] == ["aoi_crop"]
    assert on_disk["cloud_masking"] == "not_applied"
    assert on_disk["crs"] == f"EPSG:{EPSG}"
    assert on_disk["aoi"]["type"] == "Polygon"
    assert on_disk["aoi_coverage_by_scene_pct"] == 100.0
    assert on_disk["outputs"]["metadata"] == "metadata.json"


def test_partially_outside_scene_is_nodata_and_reports_coverage(item, tmp_path):
    # AOI melewati tepi barat scene (x < origin): separuh di luar
    aoi = utm_box_to_aoi(ORIGIN[0] - 1000, ORIGIN[1] - 3000, ORIGIN[0] + 1000, ORIGIN[1] - 2000)
    _, meta, _ = run(item, aoi, tmp_path, bands=["B04"], mask_to_aoi=False)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        a = ds.read(1)
        assert (a[:, : ds.width // 2 - 5] == 0).all()
        assert (a[:, ds.width // 2 + 5:] != 0).all()
    assert 45 < meta["aoi_coverage_by_scene_pct"] < 55
    assert 40 < meta["band_details"][0]["valid_pixel_pct"] < 60


def test_aoi_outside_scene_raises(item, tmp_path):
    aoi = utm_box_to_aoi(ORIGIN[0] + 50000, ORIGIN[1] - 3000, ORIGIN[0] + 51000, ORIGIN[1] - 2000)
    with pytest.raises(ProcessingError, match="tidak beririsan"):
        run(item, aoi, tmp_path, bands=["B04"])


def test_tiny_aoi_smaller_than_pixel_still_produces_pixels(item, tmp_path):
    from app.services.aoi import circle
    from shapely.geometry import mapping
    # cari titik dalam scene: pusat scene
    from pyproj import Transformer
    lon, lat = Transformer.from_crs(EPSG, 4326, always_xy=True).transform(ORIGIN[0] + 5005, ORIGIN[1] - 5005)
    aoi = mapping(circle(lat, lon, 2))  # radius 2 m
    _, meta, _ = run(item, aoi, tmp_path, bands=["B04"], mask_to_aoi=True)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        assert (ds.read(1) != 0).sum() >= 1


def test_max_pixels_guard(item, tmp_path):
    aoi = utm_box_to_aoi(ORIGIN[0] + 1000, ORIGIN[1] - 9000, ORIGIN[0] + 9000, ORIGIN[1] - 1000)
    req = DownloadRequest(scene_id=item["id"], aoi=aoi, bands=["B04"])
    small = Settings(max_output_pixels=1000)
    with pytest.raises(ProcessingError, match="terlalu besar"):
        crop.process_scene(item, shape(aoi), req, tmp_path, small)


def test_missing_band_asset(item, tmp_path):
    del item["assets"]["swir22"]
    aoi = utm_box_to_aoi(ORIGIN[0] + 1000, ORIGIN[1] - 3000, ORIGIN[0] + 2000, ORIGIN[1] - 2000)
    with pytest.raises(ProcessingError, match="B12"):
        run(item, aoi, tmp_path, bands=["B12"])


def test_remote_href_scheme_is_enforced(item):
    item["assets"]["red"]["href"] = "file:///etc/passwd"
    with pytest.raises(ProcessingError, match="tidak valid"):
        crop.asset_source(item, "B04", SETTINGS)
