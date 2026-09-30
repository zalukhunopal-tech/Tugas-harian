import json

import numpy as np
import pytest
import rasterio
from pydantic import ValidationError
from shapely.geometry import shape

from app.config import Settings
from app.models.scene import DownloadRequest
from app.processing import indices as idx
from app.services import change as chg
from app.services import crop
from tests.conftest import ORIGIN, stage2_aoi

SETTINGS = Settings()
NODATA = -9999.0


# ---------------------------------------------------------------- perhitungan murni

def test_index_uses_reflectance_not_raw_dn():
    nir, red = np.array([5000], "uint16"), np.array([1500], "uint16")
    v = idx.compute("NDVI", nir, red, (1e-4, -0.1), (1e-4, -0.1))
    assert v[0] == pytest.approx((0.4 - 0.05) / (0.4 + 0.05), abs=1e-6)          # 0.7778
    raw = (5000 - 1500) / (5000 + 1500)                                           # 0.5385 (SALAH bila offset -0.1)
    assert abs(v[0] - raw) > 0.2
    # offset 0 (baseline lama): reflektansi sama dengan DN*1e-4
    v0 = idx.compute("NDVI", nir, red, (1e-4, 0.0), (1e-4, 0.0))
    assert v0[0] == pytest.approx(raw, abs=1e-6)


def test_index_edge_cases_are_nodata():
    a = np.array([0, 100, 1000, 1000], "uint16")
    b = np.array([500, 0, 1000, 1000], "uint16")
    v = idx.compute("NDVI", a, b, (1e-4, -0.1), (1e-4, -0.1))
    # DN 0 = NoData; DN 100 -> refl -0.09 -> dipotong 0; DN 1000/1000 -> refl 0 -> penyebut 0 -> NoData
    assert (v == idx.NODATA).all()
    # reflektansi negatif dipotong 0: pasangan (DN 1000, DN 3000) -> refl 0 dan 0.2 -> indeks -1
    v = idx.compute("NDWI", np.array([1000], "uint16"), np.array([3000], "uint16"), (1e-4, -0.1), (1e-4, -0.1))
    assert v[0] == pytest.approx(-1.0)


def test_index_range_and_stats():
    rng = np.random.default_rng(0)
    a, b = rng.integers(1, 20000, 5000).astype("uint16"), rng.integers(1, 20000, 5000).astype("uint16")
    v = idx.compute("NBR", a, b, (1e-4, -0.1), (1e-4, -0.1))
    ok = v != idx.NODATA
    assert ok.any() and v[ok].min() >= -1 and v[ok].max() <= 1
    st = idx.Stats()
    st.add(v[:2500]); st.add(v[2500:])
    r = st.result(5000)
    assert r["valid_pixels"] == int(ok.sum()) and r["mean"] == pytest.approx(float(v[ok].mean()), abs=1e-4)
    assert r["min"] == pytest.approx(float(v[ok].min()), abs=1e-5)


def test_colorize_endpoints_and_midpoint():
    rgb = idx.colorize(np.array([-1.0, 0.0, 1.0]), "NDVI")
    assert rgb[0].tolist() == [0xA5, 0x00, 0x26] and rgb[1].tolist() == [0xFF, 0xFF, 0xBF] and rgb[2].tolist() == [0x00, 0x68, 0x37]


def test_change_classify_and_difference():
    cur = np.array([0.5, 0.5, 0.5, NODATA, 0.5], "float32")
    ref = np.array([0.2, 0.45, 0.9, 0.5, NODATA], "float32")
    d = chg.difference(cur, ref)
    assert d.tolist() == pytest.approx([0.3, 0.05, -0.4, NODATA, NODATA], abs=1e-6)
    assert chg.classify(d, 0.1).tolist() == [3, 2, 1, 0, 0]   # naik, stabil, turun, nodata, nodata
    assert chg.classify(d, 0.5).tolist() == [2, 2, 2, 0, 0]


# ---------------------------------------------------------------- pengujian terhadap data sintetis

def make(s2, tmp_path, ref=None, prev=(), bands=(), indices=(), cm=None, change=None, resolution=10, **kw):
    cur = s2["cur"]["item"]
    opts = dict(scene_id=cur["id"], aoi=stage2_aoi(), bands=list(bands), indices=list(indices), resolution=resolution,
                mask_to_aoi=False, **kw)
    cmo = dict(cm or {})
    if cmo or prev:
        cmo.setdefault("enabled", True)
    if prev:
        cmo.update(fill_from_previous=True, previous_scene_ids=[s2[p]["item"]["id"] for p in prev])
    if cmo:
        opts["cloud_mask"] = cmo
    if ref:
        opts["change"] = {"enabled": True, "reference_scene_id": s2[ref]["item"]["id"], **(change or {})}
    req = DownloadRequest(**opts)
    meta = crop.process_scene(cur, shape(req.aoi), req, tmp_path, SETTINGS,
                              prev_items=[s2[p]["item"] for p in prev], ref_item=s2[ref]["item"] if ref else None)
    return req, meta


def off_of(s2, name):
    return s2[name]["item"]["assets"]["red"]["raster:bands"][0]["offset"]


def refl(dn, off):
    return np.maximum(dn.astype("float64") * 1e-4 + off, 0.0)


def ndi(a, b, off_a, off_b):
    ra, rb = refl(a, off_a), refl(b, off_b)
    den = ra + rb
    ok = (a != 0) & (b != 0) & (den > 0)
    out = np.full(a.shape, NODATA)
    out[ok] = np.clip((ra[ok] - rb[ok]) / den[ok], -1, 1)
    return out


def up(a, f=2):
    return np.repeat(np.repeat(a, f, 0), f, 1)


def win(arr, ds, res=10):
    c0, r0 = round((ds.transform.c - ORIGIN[0]) / res), round((ORIGIN[1] - ds.transform.f) / res)
    return arr[r0:r0 + ds.height, c0:c0 + ds.width]


def A(s2, name, band, factor=1):
    a = s2[name]["arrays"][band]
    return up(a, factor) if factor > 1 else a


def test_indices_only_output_matches_independent_numpy(s2, tmp_path):
    _, meta = make(s2, tmp_path, indices=["NDVI", "NDWI", "NBR"])
    assert set(meta["outputs"]) == {"index_NDVI", "index_NDWI", "index_NBR", "metadata"}   # tanpa GeoTIFF band
    assert not (tmp_path / "AOI_2026-09-25.tif").exists()
    off = off_of(s2, "cur")
    expect = {
        "NDVI": ndi(A(s2, "cur", "B08"), A(s2, "cur", "B04"), off, off),
        "NDWI": ndi(A(s2, "cur", "B03"), A(s2, "cur", "B08"), off, off),
        "NBR": ndi(A(s2, "cur", "B08"), A(s2, "cur", "B12", 2), off, off),   # B12 20 m -> 10 m (nearest)
    }
    for name, exp in expect.items():
        with rasterio.open(tmp_path / f"AOI_2026-09-25_{name}.tif") as ds:
            got = ds.read(1)
            assert ds.dtypes == ("float32",) and ds.nodata == NODATA and ds.crs.to_epsg() == 32748
            assert ds.descriptions == (name,) and ds.res == (10.0, 10.0)
            np.testing.assert_allclose(got, win(exp, ds), atol=1e-5)
            valid = got != NODATA
            assert valid.any() and got[valid].min() >= -1 and got[valid].max() <= 1
        p = next(x for x in meta["products"]["indices"] if x["name"] == name)
        assert p["statistics"]["mean"] == pytest.approx(float(got[valid].mean()), abs=1e-4)
        assert p["reflectance_negative_clipped_to_zero"] and p["formula"].startswith("(")
    assert meta["processing"][-3:] == ["index_NDVI", "index_NDWI", "index_NBR"]


def test_indices_with_bands_and_cog(s2, tmp_path):
    _, meta = make(s2, tmp_path, bands=["B04", "B08"], indices=["NDVI"], formats=["geotiff", "cog"])
    assert {"geotiff", "cog", "index_NDVI", "index_NDVI_cog"} <= set(meta["outputs"])
    with rasterio.open(tmp_path / "AOI_2026-09-25_NDVI.tif") as a, rasterio.open(tmp_path / "AOI_2026-09-25_NDVI_COG.tif") as b:
        assert b.tags(ns="IMAGE_STRUCTURE").get("LAYOUT") == "COG" and a.transform == b.transform and b.nodata == NODATA
        np.testing.assert_array_equal(a.read(), b.read())
    with rasterio.open(tmp_path / "AOI_2026-09-25.tif") as ds:
        assert ds.descriptions == ("B04", "B08")     # band tambahan hanya untuk indeks tidak masuk berkas band


def test_index_respects_cloud_mask_and_fill(s2, tmp_path):
    scl_bad = up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]))
    _, _ = make(s2, tmp_path, indices=["NDVI"], cm={"dilate_m": 0})
    off = off_of(s2, "cur")
    with rasterio.open(tmp_path / "AOI_2026-09-25_NDVI.tif") as ds:
        got, bad = ds.read(1), win(scl_bad, ds)
        assert (got[bad] == NODATA).all() and (got[~bad] != NODATA).any()
        np.testing.assert_allclose(got[~bad], win(ndi(A(s2, "cur", "B08"), A(s2, "cur", "B04"), off, off), ds)[~bad], atol=1e-5)
    d = tmp_path / "fill"
    make(s2, d, indices=["NDVI"], prev=["prev2"], cm={"dilate_m": 0})
    with rasterio.open(d / "AOI_2026-09-25_NDVI.tif") as ds:
        got, bad = ds.read(1), win(scl_bad, ds)
        exp_prev = win(ndi(A(s2, "prev2", "B08"), A(s2, "prev2", "B04"), off, off), ds)
        np.testing.assert_allclose(got[bad], exp_prev[bad], atol=1e-5)    # piksel awan = indeks citra pengisi


def test_change_detection_matches_numpy_and_stats(s2, tmp_path):
    _, meta = make(s2, tmp_path, ref="prev2", change={"index": "NDVI", "threshold": 0.1}, cm={"enabled": True, "dilate_m": 0})
    off = off_of(s2, "cur")
    cur_i = ndi(A(s2, "cur", "B08"), A(s2, "cur", "B04"), off, off)
    ref_i = ndi(A(s2, "prev2", "B08"), A(s2, "prev2", "B04"), off, off)
    cur_bad = up(np.isin(s2["cur"]["scl"], [3, 8, 9, 10]))
    cur_i[cur_bad] = NODATA                                    # awan pada citra utama -> tidak dibandingkan
    exp_d = np.where((cur_i != NODATA) & (ref_i != NODATA), cur_i - ref_i, NODATA)
    exp_c = np.zeros(exp_d.shape, "uint8")
    ok = exp_d != NODATA
    exp_c[ok] = 2
    exp_c[ok & (exp_d < -0.1)] = 1
    exp_c[ok & (exp_d > 0.1)] = 3
    dname, cname = "AOI_2026-09-25_dNDVI_vs_2026-09-13.tif", "AOI_2026-09-25_change_NDVI_vs_2026-09-13.tif"
    with rasterio.open(tmp_path / dname) as ds, rasterio.open(tmp_path / cname) as cs:
        np.testing.assert_allclose(ds.read(1), win(exp_d, ds), atol=1e-5)
        c = cs.read(1)
        np.testing.assert_array_equal(c, win(exp_c, cs))
        assert cs.dtypes == ("uint8",) and cs.nodata == 0 and ds.transform == cs.transform
        counts = {k: int((c == k).sum()) for k in (1, 2, 3)}
    st = meta["products"]["change_detection"]["statistics"]
    assert st["classes"]["decrease"]["pixels"] == counts[1] and st["classes"]["stable"]["pixels"] == counts[2]
    assert st["classes"]["increase"]["pixels"] == counts[3]
    assert st["classes"]["stable"]["area_ha"] == pytest.approx(counts[2] * 100 / 10_000, abs=1e-3)   # 10 m => 0,01 ha
    assert sum(v["pct_of_valid"] for v in st["classes"].values()) == pytest.approx(100, abs=0.05)
    cd = meta["products"]["change_detection"]
    assert cd["reference_scene"]["date"] == "2026-09-13" and cd["reference_cloud_masked"] is True
    assert meta["processing"][-1] == "change_detection_NDVI" and sum(counts.values()) > 0


def test_change_threshold_changes_classes(s2, tmp_path):
    _, m1 = make(s2, tmp_path / "a", ref="prev2", change={"threshold": 0.05})
    _, m2 = make(s2, tmp_path / "b", ref="prev2", change={"threshold": 0.9})
    s1 = m1["products"]["change_detection"]["statistics"]["classes"]
    s9 = m2["products"]["change_detection"]["statistics"]["classes"]
    assert s9["stable"]["pixels"] > s1["stable"]["pixels"]
    assert s9["decrease"]["pixels"] + s9["increase"]["pixels"] < s1["decrease"]["pixels"] + s1["increase"]["pixels"]


def test_change_reference_with_different_offset_uses_own_reflectance(s2, tmp_path):
    # 'old' beroffset 0: indeksnya HARUS dihitung dari reflektansinya sendiri, bukan dari DN yang disamakan
    _, meta = make(s2, tmp_path, ref="old", change={"index": "NBR"})
    cur_i = ndi(A(s2, "cur", "B08"), A(s2, "cur", "B12", 2), -0.1, -0.1)
    ref_i = ndi(A(s2, "old", "B08"), A(s2, "old", "B12", 2), 0.0, 0.0)
    exp = np.where((cur_i != NODATA) & (ref_i != NODATA), cur_i - ref_i, NODATA)
    with rasterio.open(tmp_path / "AOI_2026-09-25_dNBR_vs_2026-09-08.tif") as ds:
        np.testing.assert_allclose(ds.read(1), win(exp, ds), atol=1e-5)
    assert meta["products"]["change_detection"]["reference_cloud_masked"] is False
    assert "dNBR = -delta" in meta["products"]["change_detection"]["note"]


def test_change_marks_pixels_cloudy_in_reference_as_nodata(s2, tmp_path):
    # prev1 berawan; tanpa mask di citra utama, hanya awan referensi yang membuat NoData
    make(s2, tmp_path, ref="prev1", change={"index": "NDVI"}, cm={"enabled": True, "dilate_m": 0, "classes": ["cloud"]})
    ref_bad = up(np.isin(s2["prev1"]["scl"], [8, 9])); cur_bad = up(np.isin(s2["cur"]["scl"], [8, 9]))
    with rasterio.open(tmp_path / "AOI_2026-09-25_change_NDVI_vs_2026-09-18.tif") as cs:
        c = cs.read(1)
        assert (c[win(ref_bad, cs)] == 0).all() and (c[win(cur_bad, cs)] == 0).all()
        assert (c[win(~ref_bad & ~cur_bad, cs)] > 0).mean() > 0.9


def test_change_output_cog_and_files_listed(s2, tmp_path):
    _, meta = make(s2, tmp_path, ref="prev2", formats=["cog"])
    assert {"change_delta_NDVI_cog", "change_class_NDVI_cog"} <= set(meta["outputs"])
    assert not list(tmp_path.glob("*NDVI_vs_2026-09-13.tif"))   # hanya COG yang diminta


# ---------------------------------------------------------------- validasi

def test_options_validation():
    base = dict(scene_id="X_1234", aoi={"type": "Point", "coordinates": [0, 0]})
    with pytest.raises(ValidationError, match="minimal satu band, indeks"):
        DownloadRequest(**base)
    with pytest.raises(ValidationError, match="citra referensi"):
        DownloadRequest(**base, change={"enabled": True})
    with pytest.raises(ValidationError):
        DownloadRequest(**base, indices=["EVI"])
    with pytest.raises(ValidationError):
        DownloadRequest(**base, indices=["NDVI"], change={"enabled": True, "reference_scene_id": "A_1234", "threshold": 0})
    assert DownloadRequest(**base, indices=["NDVI", "NDVI"]).indices == ["NDVI"]


def test_change_requires_reference_item(s2, tmp_path):
    from app.errors import ProcessingError
    cur = s2["cur"]["item"]
    req = DownloadRequest(scene_id=cur["id"], aoi=stage2_aoi(), change={"enabled": True, "reference_scene_id": "A_1234"})
    with pytest.raises(ProcessingError, match="referensi"):
        crop.process_scene(cur, shape(req.aoi), req, tmp_path, SETTINGS)


def test_metadata_products_written(s2, tmp_path):
    make(s2, tmp_path, indices=["NDVI"], ref="prev2")
    m = json.loads((tmp_path / "metadata.json").read_text())
    assert set(m["products"]) == {"indices", "change_detection"} and m["bands"] == []
