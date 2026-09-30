"""Pembacaan, normalisasi, dan validasi AOI.

Semua AOI dinormalkan menjadi (Multi)Polygon WGS84 (EPSG:4326, urutan lon/lat).
"""
from __future__ import annotations

import io
import json
import re
import tempfile
import zipfile
from functools import lru_cache
from pathlib import Path
from typing import Any

import geopandas as gpd
import pyogrio
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform as shp_transform
from shapely.ops import unary_union

from app.errors import AOIError
from app.models.aoi import AOIInfo

SHAPEFILE_PARTS = {".shp", ".shx", ".dbf", ".prj", ".cpg"}
_WGS84_NAMES = re.compile(r"(crs84|epsg[:_]{1,2}4326|epsg::4326|wgs\s*84)", re.I)


@lru_cache(maxsize=8)
def _transformer(src: str, dst: str) -> Transformer:
    return Transformer.from_crs(src, dst, always_xy=True)


def project(geom: BaseGeometry, src: str, dst: str) -> BaseGeometry:
    return shp_transform(_transformer(src, dst).transform, geom)


def project_xy(src: str, dst: str, x: float, y: float) -> tuple[float, float]:
    return _transformer(src, dst).transform(x, y)


def utm_epsg(lon: float, lat: float) -> str:
    zone = int((lon + 180) // 6) + 1
    return f"EPSG:{(32600 if lat >= 0 else 32700) + zone}"


def area_km2(geom_4326: BaseGeometry) -> float:
    """Luas dalam km² memakai proyeksi equal-area (EPSG:6933)."""
    return project(geom_4326, "EPSG:4326", "EPSG:6933").area / 1e6


# --------------------------------------------------------------------------- parsing


def _check_geojson_crs(obj: dict) -> None:
    crs = obj.get("crs")
    if not crs:
        return
    name = (crs.get("properties") or {}).get("name", "") if isinstance(crs, dict) else ""
    if not _WGS84_NAMES.search(str(name)):
        raise AOIError(
            f"CRS GeoJSON '{name}' tidak didukung. Gunakan WGS84 (EPSG:4326) atau ekspor ulang berkas Anda."
        )


def geometries_from_geojson(obj: Any) -> list[BaseGeometry]:
    if isinstance(obj, (str, bytes)):
        try:
            obj = json.loads(obj)
        except json.JSONDecodeError as exc:
            raise AOIError(f"Berkas GeoJSON tidak dapat dibaca: {exc.msg}.") from exc
    if not isinstance(obj, dict) or "type" not in obj:
        raise AOIError("GeoJSON tidak valid: objek 'type' tidak ditemukan.")
    _check_geojson_crs(obj)
    kind = obj["type"]
    try:
        if kind == "FeatureCollection":
            feats = obj.get("features") or []
            geoms = [shape(f["geometry"]) for f in feats if f.get("geometry")]
        elif kind == "Feature":
            geoms = [shape(obj["geometry"])] if obj.get("geometry") else []
        else:
            geoms = [shape(obj)]
    except (KeyError, ValueError, TypeError, AttributeError) as exc:
        raise AOIError(f"Geometri GeoJSON tidak valid: {exc}") from exc
    flat: list[BaseGeometry] = []
    for g in geoms:
        if g.geom_type == "GeometryCollection":
            flat.extend(g.geoms)
        else:
            flat.append(g)
    return flat


def _frame_geoms(gdf: gpd.GeoDataFrame, source: str) -> list[BaseGeometry]:
    if gdf.crs is None:
        raise AOIError(
            f"CRS pada {source} tidak diketahui (berkas .prj hilang?). Sertakan definisi CRS atau ekspor ke EPSG:4326."
        )
    gdf = gdf[~gdf.geometry.isna() & ~gdf.geometry.is_empty]
    return list(gdf.to_crs(4326).geometry)


def geometries_from_kml(data: bytes) -> list[BaseGeometry]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "aoi.kml"
        path.write_bytes(data)
        try:
            layers = [name for name, _ in pyogrio.list_layers(path)]
            geoms: list[BaseGeometry] = []
            for layer in layers:
                gdf = pyogrio.read_dataframe(path, layer=layer)
                if gdf.crs is None:
                    gdf = gdf.set_crs(4326)  # KML selalu WGS84
                geoms.extend(_frame_geoms(gdf, "KML"))
        except AOIError:
            raise
        except Exception as exc:  # pyogrio/GDAL error
            raise AOIError(f"Berkas KML tidak dapat dibaca: {exc}") from exc
    # Fitur 3D (altitude) -> 2D
    return [_force_2d(g) for g in geoms]


def _force_2d(g: BaseGeometry) -> BaseGeometry:
    import shapely

    return shapely.force_2d(g)


def geometries_from_shapefile_zip(data: bytes, max_bytes: int) -> list[BaseGeometry]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise AOIError("Berkas ZIP tidak valid.") from exc
    with zf, tempfile.TemporaryDirectory() as tmp:
        total = 0
        shp_names: list[str] = []
        for info in zf.infolist():
            suffix = Path(info.filename).suffix.lower()
            if info.is_dir() or suffix not in SHAPEFILE_PARTS:
                continue
            total += info.file_size
            if total > max_bytes:
                raise AOIError("Isi ZIP terlalu besar setelah diekstrak.")
            # ekstrak hanya nama berkasnya (mencegah path traversal)
            target = Path(tmp) / Path(info.filename).name
            with zf.open(info) as src, open(target, "wb") as dst:
                dst.write(src.read(max_bytes + 1))
            if suffix == ".shp":
                shp_names.append(target.name)
        if not shp_names:
            raise AOIError("ZIP tidak berisi berkas .shp.")
        geoms: list[BaseGeometry] = []
        for name in sorted(shp_names):
            try:
                gdf = gpd.read_file(Path(tmp) / name)
            except Exception as exc:
                raise AOIError(f"Shapefile '{name}' tidak dapat dibaca: {exc}") from exc
            geoms.extend(_frame_geoms(gdf, f"shapefile '{name}'"))
    return [_force_2d(g) for g in geoms]


def geometries_from_gpkg(data: bytes) -> list[BaseGeometry]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "aoi.gpkg"
        path.write_bytes(data)
        try:
            layers = [name for name, gtype in pyogrio.list_layers(path) if gtype is not None]
            geoms: list[BaseGeometry] = []
            for layer in layers:
                geoms.extend(_frame_geoms(pyogrio.read_dataframe(path, layer=layer), f"layer '{layer}'"))
        except AOIError:
            raise
        except Exception as exc:
            raise AOIError(f"GeoPackage tidak dapat dibaca: {exc}") from exc
    return [_force_2d(g) for g in geoms]


def geometries_from_upload(filename: str, data: bytes, max_bytes: int) -> list[BaseGeometry]:
    name = (filename or "").lower()
    if name.endswith((".geojson", ".json")):
        return geometries_from_geojson(data)
    if name.endswith(".kml"):
        return geometries_from_kml(data)
    if name.endswith(".zip"):
        return geometries_from_shapefile_zip(data, max_bytes)
    if name.endswith(".gpkg"):
        return geometries_from_gpkg(data)
    raise AOIError("Format berkas tidak didukung. Gunakan GeoJSON, KML, SHP (ZIP), atau GeoPackage.")


# ----------------------------------------------------------------------- normalizing


def circle(lat: float, lon: float, radius_m: float) -> BaseGeometry:
    """Lingkaran (poligon) berjari-jari radius_m di sekitar titik, dihitung di UTM lokal."""
    epsg = utm_epsg(lon, lat)
    center = project(shape({"type": "Point", "coordinates": (lon, lat)}), "EPSG:4326", epsg)
    return project(center.buffer(radius_m, quad_segs=32), epsg, "EPSG:4326")


def _coords_in_range(g: BaseGeometry) -> bool:
    minx, miny, maxx, maxy = g.bounds
    return -180 <= minx and maxx <= 180 and -90 <= miny and maxy <= 90


def normalize(
    geoms: list[BaseGeometry],
    *,
    radius_m: float | None = None,
    max_area_km2: float,
) -> AOIInfo:
    """Gabungkan, perbaiki, dan validasi geometri menjadi satu AOI."""
    geoms = [g for g in geoms if g is not None and not g.is_empty]
    if not geoms:
        raise AOIError("AOI kosong. Gambar atau unggah geometri terlebih dahulu.")

    warnings: list[str] = []
    polys: list[BaseGeometry] = []
    kinds: set[str] = set()

    for g in geoms:
        if not _coords_in_range(g):
            raise AOIError(
                "Koordinat berada di luar rentang lon/lat WGS84 (±180, ±90). "
                "Pastikan AOI menggunakan EPSG:4326 (bukan koordinat UTM/proyeksi)."
            )
        if g.geom_type in ("Point", "MultiPoint"):
            if radius_m is None:
                raise AOIError("AOI berupa titik memerlukan radius (meter).")
            kinds.add("point")
            for p in getattr(g, "geoms", [g]):
                polys.append(circle(p.y, p.x, radius_m))
        elif g.geom_type in ("Polygon", "MultiPolygon"):
            kinds.add("polygon")
            if not g.is_valid:
                fixed = make_valid(g)
                polys_only = [x for x in getattr(fixed, "geoms", [fixed]) if x.geom_type in ("Polygon", "MultiPolygon")]
                if not polys_only:
                    raise AOIError("AOI tidak valid. Silakan periksa polygon.")
                g = unary_union(polys_only)
                warnings.append("Geometri tidak valid (mis. garis saling berpotongan) dan telah diperbaiki otomatis.")
            polys.append(g)
        elif g.geom_type in ("LineString", "MultiLineString", "LinearRing"):
            raise AOIError("AOI berupa garis tidak didukung. Gunakan polygon, rectangle, atau titik + radius.")
        else:
            raise AOIError(f"Tipe geometri '{g.geom_type}' tidak didukung sebagai AOI.")

    merged = unary_union(polys)
    if merged.geom_type not in ("Polygon", "MultiPolygon"):
        merged = unary_union([p for p in getattr(merged, "geoms", [merged]) if p.geom_type in ("Polygon", "MultiPolygon")])
    if merged.is_empty or merged.area == 0:
        raise AOIError("AOI tidak valid: luasnya nol. Silakan periksa polygon.")

    if len(geoms) > 1:
        warnings.append(f"{len(geoms)} fitur digabung menjadi satu AOI.")

    km2 = area_km2(merged)
    if km2 <= 0:
        raise AOIError("AOI tidak valid: luasnya nol. Silakan periksa polygon.")
    if km2 > max_area_km2:
        raise AOIError(
            f"AOI terlalu besar ({km2:,.0f} km²). Batas maksimum {max_area_km2:,.0f} km². Perkecil area atau bagi menjadi beberapa AOI."
        )
    if km2 < 0.0004:  # < 20 m x 20 m: lebih kecil dari satu piksel 10 m
        warnings.append("AOI lebih kecil dari satu piksel 10 m; hasil crop mungkin hanya berisi 1-4 piksel.")

    parts = len(merged.geoms) if merged.geom_type == "MultiPolygon" else 1
    c = merged.centroid
    kind = "point" if kinds == {"point"} else "polygon"
    return AOIInfo(
        geometry=mapping(merged),
        area_km2=round(km2, 4),
        bbox=[round(v, 6) for v in merged.bounds],
        centroid=[round(c.x, 6), round(c.y, 6)],
        kind=kind,
        parts=parts,
        warnings=warnings,
    )


def shape_point(lon: float, lat: float) -> BaseGeometry:
    return shape({"type": "Point", "coordinates": (lon, lat)})


def geometry_from_any(aoi: Any) -> BaseGeometry:
    """Ambil geometri 4326 dari geometry/Feature GeoJSON (dipakai endpoint search/download)."""
    geoms = geometries_from_geojson(aoi)
    if len(geoms) != 1:
        raise AOIError("AOI harus berupa satu geometri. Gunakan endpoint /api/aoi untuk menggabungkan.")
    return geoms[0]
