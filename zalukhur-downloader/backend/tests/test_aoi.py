import io
import json
import zipfile

import geopandas as gpd
import pytest
from shapely.geometry import Point, Polygon, box, shape

from app.errors import AOIError
from app.services import aoi as svc

MAX = 2500


def square(lon=101.0, lat=-1.0, d=0.05):
    return box(lon, lat, lon + d, lat + d)


def test_polygon_ok_and_area():
    info = svc.normalize([square()], max_area_km2=MAX)
    # 0.05° ≈ 5.56 km  -> ~30.9 km²
    assert info.geometry["type"] == "Polygon"
    assert 30 < info.area_km2 < 32
    assert info.kind == "polygon"
    assert info.bbox == [101.0, -1.0, 101.05, -0.95]


def test_geojson_feature_collection_merges_features():
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {}, "geometry": shape(square()).__geo_interface__},
        {"type": "Feature", "properties": {}, "geometry": shape(square(101.2)).__geo_interface__},
    ]}
    info = svc.normalize(svc.geometries_from_geojson(fc), max_area_km2=MAX)
    assert info.geometry["type"] == "MultiPolygon" and info.parts == 2
    assert any("digabung" in w for w in info.warnings)


def test_invalid_bowtie_is_repaired_with_warning():
    bowtie = Polygon([(101, -1), (101.1, -0.9), (101.1, -1), (101, -0.9)])
    assert not bowtie.is_valid
    info = svc.normalize([bowtie], max_area_km2=MAX)
    assert info.area_km2 > 0
    assert any("diperbaiki" in w for w in info.warnings)


def test_zero_area_rejected():
    line_poly = Polygon([(101, -1), (101.1, -1), (101.2, -1)])
    with pytest.raises(AOIError):
        svc.normalize([line_poly], max_area_km2=MAX)


def test_too_large_rejected():
    with pytest.raises(AOIError, match="terlalu besar"):
        svc.normalize([box(100, -3, 103, 0)], max_area_km2=MAX)


def test_projected_coordinates_rejected():
    with pytest.raises(AOIError, match="di luar rentang"):
        svc.normalize([box(300000, 9700000, 310000, 9710000)], max_area_km2=MAX)


def test_point_requires_radius_and_becomes_circle():
    with pytest.raises(AOIError, match="radius"):
        svc.normalize([Point(101, -1)], max_area_km2=MAX)
    info = svc.normalize([Point(101, -1)], radius_m=1000, max_area_km2=MAX)
    assert info.kind == "point"
    assert info.area_km2 == pytest.approx(3.1416, rel=0.01)  # pi * 1 km²
    c = shape(info.geometry).centroid
    assert (c.x, c.y) == pytest.approx((101, -1), abs=1e-4)


def test_line_rejected():
    with pytest.raises(AOIError, match="garis"):
        svc.normalize([shape({"type": "LineString", "coordinates": [(101, -1), (101.1, -1)]})], max_area_km2=MAX)


def test_geojson_non_wgs84_crs_rejected():
    obj = {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32748"}},
           "features": []}
    with pytest.raises(AOIError, match="CRS"):
        svc.geometries_from_geojson(obj)
    ok = dict(obj, crs={"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}})
    assert svc.geometries_from_geojson(ok) == []


def test_bad_geojson():
    with pytest.raises(AOIError):
        svc.geometries_from_geojson("{not json")
    with pytest.raises(AOIError):
        svc.geometries_from_geojson({"foo": 1})


def test_empty_rejected():
    with pytest.raises(AOIError, match="kosong"):
        svc.normalize([], max_area_km2=MAX)


KML = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>a</name>
<Polygon><outerBoundaryIs><LinearRing><coordinates>
101.0,-1.0,0 101.05,-1.0,0 101.05,-0.95,0 101.0,-0.95,0 101.0,-1.0,0
</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>"""


def test_kml():
    geoms = svc.geometries_from_kml(KML.encode())
    info = svc.normalize(geoms, max_area_km2=MAX)
    assert 30 < info.area_km2 < 32
    assert not shape(info.geometry).has_z


def _shp_zip(tmp_path, crs, with_prj=True):
    gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[square()], crs=4326).to_crs(crs)
    gdf.to_file(tmp_path / "aoi.shp")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for p in tmp_path.iterdir():
            if p.suffix == ".prj" and not with_prj:
                continue
            if p.suffix in {".shp", ".shx", ".dbf", ".prj", ".cpg"}:
                z.write(p, p.name)
    return buf.getvalue()


def test_shapefile_zip_reprojects_to_wgs84(tmp_path):
    data = _shp_zip(tmp_path, 32747)  # UTM 47S
    geoms = svc.geometries_from_shapefile_zip(data, 10_000_000)
    info = svc.normalize(geoms, max_area_km2=MAX)
    assert info.bbox == pytest.approx([101.0, -1.0, 101.05, -0.95], abs=1e-3)


def test_shapefile_without_prj_rejected(tmp_path):
    data = _shp_zip(tmp_path, 4326, with_prj=False)
    with pytest.raises(AOIError, match="CRS"):
        svc.geometries_from_shapefile_zip(data, 10_000_000)


def test_zip_without_shp_and_bad_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("readme.txt", "x")
    with pytest.raises(AOIError, match=".shp"):
        svc.geometries_from_shapefile_zip(buf.getvalue(), 1000)
    with pytest.raises(AOIError, match="ZIP"):
        svc.geometries_from_shapefile_zip(b"nope", 1000)


def test_zip_path_traversal_is_neutralised(tmp_path):
    data = _shp_zip(tmp_path, 4326)
    src = zipfile.ZipFile(io.BytesIO(data))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for n in src.namelist():
            z.writestr("../../evil/" + n, src.read(n))
    geoms = svc.geometries_from_shapefile_zip(buf.getvalue(), 10_000_000)
    assert len(geoms) == 1
    assert not (tmp_path.parent / "evil").exists()


def test_zip_size_limit(tmp_path):
    data = _shp_zip(tmp_path, 4326)
    with pytest.raises(AOIError, match="terlalu besar"):
        svc.geometries_from_shapefile_zip(data, 10)


def test_geopackage(tmp_path):
    p = tmp_path / "a.gpkg"
    gpd.GeoDataFrame({"id": [1]}, geometry=[square()], crs=4326).to_crs(32747).to_file(p, driver="GPKG")
    geoms = svc.geometries_from_gpkg(p.read_bytes())
    info = svc.normalize(geoms, max_area_km2=MAX)
    assert info.bbox == pytest.approx([101.0, -1.0, 101.05, -0.95], abs=1e-3)


def test_upload_dispatch_and_unsupported():
    assert svc.geometries_from_upload("x.geojson", json.dumps(shape(square()).__geo_interface__).encode(), 1000)
    assert svc.geometries_from_upload("x.kml", KML.encode(), 1000)
    with pytest.raises(AOIError, match="tidak didukung"):
        svc.geometries_from_upload("x.txt", b"", 1000)
