"""Offset reflektansi efektif: flag Earth Search 'boa_offset_applied' berarti offset SUDAH dikurangkan dari DN."""
import copy

import numpy as np
import pytest
import rasterio
from shapely.geometry import shape

from app.config import Settings
from app.models.scene import DownloadRequest
from app.services import crop
from app.services.assets import band_scale_offset, declared_scale_offset
from tests.conftest import ORIGIN, stage2_aoi

SETTINGS = Settings()


def flagged(item, value=True):
    it = copy.deepcopy(item)
    it["properties"]["earthsearch:boa_offset_applied"] = value
    return it


def test_effective_offset_rules():
    asset = {"raster:bands": [{"scale": 0.0001, "offset": -0.1}]}
    assert declared_scale_offset(asset) == (0.0001, -0.1)
    assert band_scale_offset({"properties": {}}, asset) == (0.0001, -0.1)                                   # data mentah: percaya metadata
    assert band_scale_offset({"properties": {"earthsearch:boa_offset_applied": False}}, asset) == (0.0001, -0.1)
    assert band_scale_offset({"properties": {"earthsearch:boa_offset_applied": True}}, asset) == (0.0001, 0.0)  # sudah diterapkan
    assert band_scale_offset({}, {}) == (1.0, 0.0)


def run(cur, aoi, tmp_path, prev=(), **kw):
    req = DownloadRequest(scene_id=cur["id"], aoi=aoi, mask_to_aoi=False, **kw)
    return crop.process_scene(cur, shape(aoi), req, tmp_path, SETTINGS, prev_items=list(prev))


def test_flagged_scene_writes_zero_offset_and_records_override(s2, tmp_path):
    cur = flagged(s2["cur"]["item"])                       # katalog menyatakan -0.1, tetapi DN sudah bebas offset
    meta = run(cur, stage2_aoi(), tmp_path, bands=["B04"], indices=["NDVI"])
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        assert ds.offsets == (0.0,) and ds.scales == (0.0001,)        # QGIS/GDAL: reflektansi = DN*1e-4
    b = meta["band_details"][0]
    assert b["offset"] == 0.0 and b["offset_declared_in_catalog"] == -0.1 and "diabaikan" in b["offset_note"]
    # NDVI dari DN bebas offset: (B08 - B04) / (B08 + B04) langsung pada DN
    a08, a04 = s2["cur"]["arrays"]["B08"].astype("float64"), s2["cur"]["arrays"]["B04"].astype("float64")
    exp = (a08 - a04) / (a08 + a04)
    with rasterio.open(tmp_path / "AOI_2026-09-25_NDVI.tif") as ds:
        c0, r0 = round((ds.transform.c - ORIGIN[0]) / 10), round((ORIGIN[1] - ds.transform.f) / 10)
        np.testing.assert_allclose(ds.read(1), exp[r0:r0 + ds.height, c0:c0 + ds.width], atol=1e-5)


def test_unflagged_raw_scene_keeps_catalog_offset(s2, tmp_path):
    meta = run(s2["cur"]["item"], stage2_aoi(), tmp_path, bands=["B04"])
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        assert ds.offsets == (-0.1,)
    assert "offset_declared_in_catalog" not in meta["band_details"][0]


def test_fill_between_flagged_scenes_copies_dn_unchanged(s2, tmp_path):
    # Skenario Earth Search nyata: kedua scene berflag/offset efektif 0 -> DN pengisi disalin apa adanya
    cur, prev = flagged(s2["cur"]["item"]), flagged(s2["prev2"]["item"])
    run(cur, stage2_aoi(), tmp_path, prev=[prev], bands=["B04"], cloud_mask={
        "enabled": True, "dilate_m": 0, "fill_from_previous": True, "previous_scene_ids": [prev["id"]]})
    bad = np.repeat(np.repeat(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2, 0), 2, 1)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        c0, r0 = round((ds.transform.c - ORIGIN[0]) / 10), round((ORIGIN[1] - ds.transform.f) / 10)
        w = lambda a: a[r0:r0 + ds.height, c0:c0 + ds.width]  # noqa: E731
        got, b = ds.read(1), w(bad)
        np.testing.assert_array_equal(got[b], w(s2["prev2"]["arrays"]["B04"])[b])   # tanpa +1000


def test_fill_flagged_current_from_raw_previous_converts_offset(s2, tmp_path):
    # citra utama sudah bebas offset (efektif 0); pengisi = data ESA mentah tanpa flag, offset -0.1:
    # reflektansi X*1e-4 - 0.1 = DN_cur*1e-4  =>  DN_cur = X - 1000
    cur = flagged(s2["cur"]["item"])
    raw_prev = s2["prev2"]["item"]                         # tanpa flag, offset -0.1
    run(cur, stage2_aoi(), tmp_path, prev=[raw_prev], bands=["B04"], cloud_mask={
        "enabled": True, "dilate_m": 0, "fill_from_previous": True, "previous_scene_ids": [raw_prev["id"]]})
    bad = np.repeat(np.repeat(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2, 0), 2, 1)
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        c0, r0 = round((ds.transform.c - ORIGIN[0]) / 10), round((ORIGIN[1] - ds.transform.f) / 10)
        w = lambda a: a[r0:r0 + ds.height, c0:c0 + ds.width]  # noqa: E731
        got, b = ds.read(1).astype("int64"), w(bad)
        prev = w(s2["prev2"]["arrays"]["B04"]).astype("int64")
        expect = np.clip(prev - 1000, 1, 65535)
        np.testing.assert_array_equal(got[b], expect[b])
