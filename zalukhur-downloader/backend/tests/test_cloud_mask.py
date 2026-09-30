import json

import numpy as np
import pytest
import rasterio
from pydantic import ValidationError
from shapely.geometry import shape

from app.config import Settings
from app.errors import ProcessingError
from app.models.scene import CloudMaskOptions, DownloadRequest
from app.services import cloud_mask, composite, crop
from tests.conftest import ORIGIN, stage2_aoi

SETTINGS = Settings()


def run(s2, tmp_path, prev=(), bands=("B04", "B03", "B08"), resolution=10, cm=None, **kw):
    cmo = {"enabled": True, **(cm or {})}
    if prev:
        cmo.update(fill_from_previous=True, previous_scene_ids=[s2[p]["item"]["id"] for p in prev])
    cur = s2["cur"]["item"]
    req = DownloadRequest(scene_id=cur["id"], aoi=stage2_aoi(), bands=list(bands), resolution=resolution,
                          mask_to_aoi=kw.pop("mask_to_aoi", False), cloud_mask=cmo, **kw)
    events = []
    meta = crop.process_scene(cur, shape(req.aoi), req, tmp_path, SETTINGS, lambda *a: events.append(a),
                              prev_items=[s2[p]["item"] for p in prev])
    return req, meta, events


def offsets(ds, res=10):
    return round((ds.transform.c - ORIGIN[0]) / res), round((ORIGIN[1] - ds.transform.f) / res)


def up(a, f):  # ulang piksel 20 m -> grid lebih halus
    return np.repeat(np.repeat(a, f, 0), f, 1)


def window(arr, ds, res):
    c0, r0 = offsets(ds, res)
    return arr[r0:r0 + ds.height, c0:c0 + ds.width]


def open_out(tmp_path, name="AOI_2026-09-25.tif"):
    return rasterio.open(tmp_path / name)


# ------------------------------------------------------------------ mask saja

def test_scl_mask_only_sets_cloud_shadow_cirrus_to_nodata(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, cm={"dilate_m": 0})
    scl10 = up(s2["cur"]["scl"], 2)
    bad = np.isin(scl10, [8, 9, 3, 10])  # salju (11) TIDAK ikut secara bawaan
    with open_out(tmp_path) as ds:
        got = ds.read(1)
        src = window(s2["cur"]["arrays"]["B04"], ds, 10)
        b = window(bad, ds, 10)
        assert b.any() and (~b).any()
        assert (got[b] == 0).all()                      # piksel awan -> NoData
        np.testing.assert_array_equal(got[~b], src[~b])  # sisanya identik dengan sumber
        assert ds.nodata == 0 and ds.crs.to_epsg() == 32748
    cm = meta["cloud_masking"]
    assert cm["method"] == "scl_mask_only" and cm["classes"] == ["cloud", "cloud_shadow", "cirrus"]
    assert cm["scl_codes_masked"] == [3, 8, 9, 10]
    assert cm["statistics"]["masked_pct"] > 0 and cm["statistics"]["filled_pct"] == 0
    assert "cloud_mask" in meta["processing"] and meta["cloud_masking"]["cloud_probability_layer"] == "not_available"


def test_class_selection_snow_only(s2, tmp_path):
    run(s2, tmp_path, cm={"dilate_m": 0, "classes": ["snow_ice"]})
    bad = up(s2["cur"]["scl"], 2) == 11
    with open_out(tmp_path) as ds:
        got, b = ds.read(1), window(bad, ds, 10)
        assert (got[b] == 0).all() and b.sum() > 0
        # awan TIDAK di-mask karena kelas tidak dipilih
        cloud = window(up(s2["cur"]["scl"], 2) == 9, ds, 10)
        assert (got[cloud] != 0).all()


def test_dilation_grows_mask_by_expected_pixels(s2, tmp_path):
    run(s2, tmp_path, cm={"dilate_m": 0, "classes": ["cloud"]})
    with open_out(tmp_path) as ds:
        base = (ds.read(1) == 0)
    d = tmp_path / "dil"
    run(s2, d, cm={"dilate_m": 40, "classes": ["cloud"]})   # 40 m = 2 piksel 20 m = 4 piksel 10 m
    with open_out(d) as ds:
        grown = (ds.read(1) == 0)
    assert grown.sum() > base.sum() and (grown & base).sum() == base.sum()
    # kotak awan 60x60 (20 m) -> dilasi 2 piksel 20 m tiap sisi -> 64x64 piksel 20 m (kotak 9 di baris 100:160)
    # + awan sedang 10x10 -> 14x14
    assert grown.sum() == (64 * 64 + 14 * 14) * 4


def test_resolution_60m_uses_any_reduction(s2, tmp_path):
    # pada 60 m, blok 3x3 piksel SCL 20 m ter-mask bila SALAH SATU pikselnya bayangan (konservatif)
    _, meta, _ = run(s2, tmp_path, resolution=60, cm={"dilate_m": 0, "classes": ["cloud_shadow"]})
    shadow = (s2["cur"]["scl"] == 3)
    expected = shadow.reshape(200, 3, 200, 3).any(axis=(1, 3))
    with open_out(tmp_path) as ds:
        assert ds.res == (60.0, 60.0)
        got_masked = ds.read(1) == 0
        np.testing.assert_array_equal(got_masked, window(expected, ds, 60))
    # bayangan 30x30 piksel 20 m (baris 200:230) tidak sejajar blok 3x3 -> menyentuh 11x11 blok 60 m, bukan 10x10
    assert expected.sum() == 121


def test_no_cloud_mask_is_unchanged_default(s2, tmp_path):
    cur = s2["cur"]["item"]
    req = DownloadRequest(scene_id=cur["id"], aoi=stage2_aoi(), bands=["B04"], mask_to_aoi=False)
    meta = crop.process_scene(cur, shape(req.aoi), req, tmp_path, SETTINGS)
    assert meta["cloud_masking"] == "not_applied" and meta["processing"] == ["aoi_crop"]
    with open_out(tmp_path) as ds:
        assert (ds.read(1) != 0).all()
    assert "qa" not in meta["outputs"]


# ------------------------------------------------------------------ pengisian dari citra sebelumnya

def test_fill_from_previous_uses_only_masked_pixels(s2, tmp_path):
    _, meta, events = run(s2, tmp_path, prev=["prev2"], cm={"dilate_m": 0})
    cur_bad = up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2)
    with open_out(tmp_path) as ds:
        got = ds.read(1)
        cur = window(s2["cur"]["arrays"]["B04"], ds, 10)
        prev = window(s2["prev2"]["arrays"]["B04"], ds, 10)
        b = window(cur_bad, ds, 10)
        np.testing.assert_array_equal(got[~b], cur[~b])   # piksel bersih = citra utama (BUKAN diganti)
        np.testing.assert_array_equal(got[b], prev[b])    # piksel awan = citra sebelumnya, nilai persis
        assert (got != 0).all()
    st = meta["cloud_masking"]["statistics"]
    assert st["filled_pct"] == st["masked_pct"] > 0 and st["unfilled_masked_pixels"] == 0
    assert meta["processing"][-1] == "cloud_mask_previous_image"
    assert meta["cloud_masking"]["method"] == "scl_previous_image_fill"
    assert meta["cloud_masking"]["previous_scenes"][0]["id"] == s2["prev2"]["item"]["id"]
    assert [e[0] for e in events][:1] == ["DOWNLOADING"] and "PROCESSING" in {e[0] for e in events} and "CROPPING" in {e[0] for e in events}


def test_unfilled_where_previous_also_cloudy_stays_nodata(s2, tmp_path):
    # prev1 berawan di baris/kolom 130:200 (20 m) dan bayangan 200:230 -> tumpang tindih dgn cur
    _, meta, _ = run(s2, tmp_path, prev=["prev1"], cm={"dilate_m": 0})
    cur_bad = up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2)
    prev_bad = up(np.isin(s2["prev1"]["scl"], [3, 8, 9, 10]), 2)
    should_fill, should_stay = cur_bad & ~prev_bad, cur_bad & prev_bad
    assert should_stay.any() and should_fill.any()
    with open_out(tmp_path) as ds:
        got = ds.read(1)
        assert (got[window(should_stay, ds, 10)] == 0).all()                 # tetap NoData
        f = window(should_fill, ds, 10)
        np.testing.assert_array_equal(got[f], window(s2["prev1"]["arrays"]["B04"], ds, 10)[f])
    st = meta["cloud_masking"]["statistics"]
    assert st["unfilled_masked_pixels"] > 0 and 0 < st["filled_pct"] < st["masked_pct"]


def test_multi_date_composite_fills_in_priority_order(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev1", "prev2"], cm={"dilate_m": 0})
    cur_bad = up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2)
    p1_bad = up(np.isin(s2["prev1"]["scl"], [3, 8, 9, 10]), 2)
    from_p1, from_p2 = cur_bad & ~p1_bad, cur_bad & p1_bad
    assert from_p1.any() and from_p2.any()
    with open_out(tmp_path) as ds:
        got = ds.read(1)
        np.testing.assert_array_equal(got[window(from_p1, ds, 10)], window(s2["prev1"]["arrays"]["B04"], ds, 10)[window(from_p1, ds, 10)])
        np.testing.assert_array_equal(got[window(from_p2, ds, 10)], window(s2["prev2"]["arrays"]["B04"], ds, 10)[window(from_p2, ds, 10)])
        assert (got != 0).all()  # prev2 bersih -> tidak ada sisa
    assert meta["processing"][-1] == "cloud_mask_multi_date_composite"
    st = meta["cloud_masking"]["statistics"]
    assert st["unfilled_masked_pixels"] == 0 and all(p > 0 for p in st["filled_pct_per_previous"])
    assert [p["id"] for p in meta["cloud_masking"]["previous_scenes"]] == [s2["prev1"]["item"]["id"], s2["prev2"]["item"]["id"]]


def test_priority_order_matters(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev2", "prev1"], cm={"dilate_m": 0})
    st = meta["cloud_masking"]["statistics"]
    assert st["filled_pct_per_previous"][1] == 0.0  # prev2 (bersih) sudah mengisi semuanya


def test_radiometric_harmonization_across_offsets(s2, tmp_path):
    # citra 'old' beroffset 0 (baseline lama); DN-nya harus dikonversi ke skala DN citra utama (+1000)
    run(s2, tmp_path, prev=["old"], cm={"dilate_m": 0})
    cur_bad = up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2)
    with open_out(tmp_path) as ds:
        got = ds.read(1)
        b = window(cur_bad, ds, 10)
        old = window(s2["old"]["arrays"]["B04"], ds, 10).astype("int64")
        np.testing.assert_array_equal(got[b].astype("int64"), old[b] + 1000)
        assert ds.scales == (0.0001,) * 3 and ds.offsets == (-0.1,) * 3


def test_harmonize_unit():
    dn = np.array([0, 1, 500, 65000], dtype="uint16")
    same = composite.harmonize(dn, 1e-4, -0.1, 1e-4, -0.1)
    assert same is dn
    out = composite.harmonize(dn, 1e-4, 0.0, 1e-4, -0.1)
    assert out.tolist() == [0, 1001, 1500, 65535]  # 0 tetap NoData; nilai di atas rentang di-clip


def test_fill_at_20m_and_mixed_native_resolutions(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev2"], bands=("B04", "B05"), resolution=20, cm={"dilate_m": 0})
    cur_bad = np.isin(s2["cur"]["scl"], [3, 8, 9, 10])
    with open_out(tmp_path) as ds:
        assert ds.res == (20.0, 20.0)
        b = window(cur_bad, ds, 20)
        b05 = ds.read(2)
        np.testing.assert_array_equal(b05[b], window(s2["prev2"]["arrays"]["B05"], ds, 20)[b])  # native 20 m: persis
        assert (b05 != 0).all()


def test_qa_map_codes_and_legend(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev1", "prev2"], cm={"dilate_m": 0})
    name = meta["outputs"]["qa"]
    with open_out(tmp_path, name) as qa, open_out(tmp_path) as ds:
        assert qa.transform == ds.transform and qa.crs == ds.crs and qa.nodata == 255 and qa.dtypes == ("uint8",)
        a = qa.read(1)
        assert set(np.unique(a)) == {1, 2, 3}      # bersih, dari prev1, dari prev2 (tanpa sisa 254)
        cur_bad = window(up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]), 2), ds, 10)
        assert ((a > 1) == cur_bad).all()
    assert meta["cloud_masking"]["qa_file"] == name and "254" in meta["cloud_masking"]["qa_legend"]


def test_qa_marks_unfilled_and_can_be_disabled(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev1"], cm={"dilate_m": 0})
    with open_out(tmp_path, meta["outputs"]["qa"]) as qa:
        a = qa.read(1)
        assert 254 in set(np.unique(a))
    with open_out(tmp_path) as ds:
        assert ((ds.read(1) == 0) == (a == 254)).all()  # NoData di keluaran <=> kode 254
    d = tmp_path / "noqa"
    _, meta2, _ = run(s2, d, prev=["prev1"], cm={"dilate_m": 0, "include_qa": False})
    assert "qa" not in meta2["outputs"] and not list(d.glob("*_QA.tif"))


def test_polygon_mask_and_cloud_mask_combined_stats(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev2"], cm={"dilate_m": 0}, mask_to_aoi=True)
    st = meta["cloud_masking"]["statistics"]
    assert st["aoi_pixels"] > 0 and st["masked_pct"] > 0
    with open_out(tmp_path) as ds:
        assert ds.dtypes == ("uint16",) * 3


# ------------------------------------------------------------------ validasi

def test_options_validation():
    with pytest.raises(ValidationError, match="minimal satu citra sebelumnya"):
        CloudMaskOptions(enabled=True, fill_from_previous=True)
    with pytest.raises(ValidationError, match="cloud masking aktif"):
        CloudMaskOptions(enabled=False, fill_from_previous=True, previous_scene_ids=["a"])
    with pytest.raises(ValidationError, match="minimal satu kelas"):
        CloudMaskOptions(enabled=True, classes=[])
    with pytest.raises(ValidationError, match="duplikat"):
        CloudMaskOptions(enabled=True, fill_from_previous=True, previous_scene_ids=["a", "a"])
    with pytest.raises(ValidationError):
        CloudMaskOptions(enabled=True, dilate_m=500)
    with pytest.raises(ValidationError):
        CloudMaskOptions(enabled=True, classes=["haze"])


def test_missing_scl_raises_clear_error(s2, tmp_path):
    import copy
    item = copy.deepcopy(s2["cur"]["item"])
    del item["assets"]["scl"]
    req = DownloadRequest(scene_id=item["id"], aoi=stage2_aoi(), bands=["B04"], cloud_mask={"enabled": True})
    with pytest.raises(ProcessingError, match="SCL"):
        crop.process_scene(item, shape(req.aoi), req, tmp_path, SETTINGS)


def test_dilate_unit():
    m = np.zeros((7, 7), bool)
    m[3, 3] = True
    assert cloud_mask.dilate(m, 0).sum() == 1
    assert cloud_mask.dilate(m, 1).sum() == 9
    assert cloud_mask.dilate(m, 2).sum() == 25
    edge = np.zeros((5, 5), bool)
    edge[0, 0] = True
    assert cloud_mask.dilate(edge, 1).sum() == 4  # tidak membungkus / tidak error di tepi


def test_metadata_written_to_disk_matches(s2, tmp_path):
    _, meta, _ = run(s2, tmp_path, prev=["prev2"])
    on_disk = json.loads((tmp_path / "metadata.json").read_text())
    assert on_disk["cloud_masking"]["applied"] is True and on_disk["cloud_masking"]["dilate_m"] == 20
    assert on_disk["outputs"]["metadata"] == "metadata.json"
