from __future__ import annotations

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.errors import AOIError
from app.models.aoi import AOIInfo, AOIRequest
from app.services import aoi as svc

router = APIRouter(prefix="/api/aoi", tags=["aoi"])


@router.post("", response_model=AOIInfo)
def create_aoi(body: AOIRequest, request: Request) -> AOIInfo:
    """Validasi + normalisasi AOI dari geometri (draw) atau lat/lon/radius."""
    s = request.app.state.settings
    if body.geometry is not None:
        geoms = svc.geometries_from_geojson(body.geometry)
        return svc.normalize(geoms, radius_m=body.radius_m, max_area_km2=s.max_aoi_km2)
    return svc.normalize(
        [svc.shape_point(body.lon, body.lat)], radius_m=body.radius_m, max_area_km2=s.max_aoi_km2
    )


@router.post("/upload", response_model=AOIInfo)
async def upload_aoi(request: Request, file: UploadFile = File(...), radius_m: float | None = Form(default=None)) -> AOIInfo:
    """Unggah GeoJSON / KML / SHP (ZIP) / GeoPackage."""
    s = request.app.state.settings
    max_bytes = int(s.max_upload_mb * 1024 * 1024)
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AOIError(f"Berkas terlalu besar (maksimum {s.max_upload_mb:g} MB).", status_code=413)
    geoms = svc.geometries_from_upload(file.filename or "", data, max_bytes)
    return svc.normalize(geoms, radius_m=radius_m, max_area_km2=s.max_aoi_km2)
