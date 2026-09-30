from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import numpy as np
import rasterio
from fastapi import APIRouter, Request

from app.api.query import _safe_id, validated_aoi
from app.errors import AppError
from app.models.scene import (
    AoiCloudRequest,
    AoiCloudResponse,
    AoiCloudStat,
    PreviousRequest,
    PreviousResponse,
)
from app.processing import raster
from app.services import cloud_mask, previous
from app.services.crop import scene_grid

router = APIRouter(prefix="/api/scenes", tags=["cloud-mask"])


@router.post("/previous", response_model=PreviousResponse)
def previous_scenes(body: PreviousRequest, request: Request) -> PreviousResponse:
    """Kandidat citra sebelumnya untuk mengisi piksel berawan (terdekat lebih dulu)."""
    st = request.app.state
    geom, _ = validated_aoi(body.aoi, request)
    cur = st.catalog.get_item(_safe_id(body.scene_id))
    scenes, message = previous.candidates(st.catalog, cur, geom, body.lookback_days, body.max_cloud_cover, body.limit)
    return PreviousResponse(count=len(scenes), scenes=scenes, message=message)


def _aoi_cloud(item: dict, geom, classes, dilate_m: int, settings) -> AoiCloudStat:
    with rasterio.Env(**raster.GDAL_HTTP_ENV):
        grid, aoi_crs = scene_grid(item, geom, 20, settings, max_pixels=settings.max_output_pixels)
        inside = raster.aoi_mask(aoi_crs, grid)
        masks = cloud_mask.read_masks(item, grid, classes, dilate_m, settings)
    total = int(np.count_nonzero(inside))
    valid = int(np.count_nonzero(inside & ~masks.nodata))
    bad = int(np.count_nonzero(inside & masks.bad))
    return AoiCloudStat(
        scene_id=item["id"],
        cloud_pct=round(100 * bad / valid, 2) if valid else None,
        valid_pct=round(100 * valid / total, 2) if total else None,
    )


@router.post("/aoi-cloud", response_model=AoiCloudResponse)
def aoi_cloud(body: AoiCloudRequest, request: Request) -> AoiCloudResponse:
    """Persentase piksel berawan (SCL) TEPAT di dalam AOI untuk tiap scene.

    Berbeda dari `cloud_cover` katalog yang merupakan rata-rata seluruh scene.
    """
    st = request.app.state
    geom, _ = validated_aoi(body.aoi, request)

    def one(sid: str) -> AoiCloudStat:
        try:
            item = st.catalog.get_item(_safe_id(sid))
            return _aoi_cloud(item, geom, body.classes, body.dilate_m, st.settings)
        except AppError as exc:
            return AoiCloudStat(scene_id=sid, error=exc.message)
        except Exception:  # noqa: BLE001 - satu scene gagal tidak boleh menggagalkan semuanya
            return AoiCloudStat(scene_id=sid, error="Gagal membaca data scene.")

    with ThreadPoolExecutor(max_workers=4) as pool:
        stats = list(pool.map(one, body.scene_ids))
    return AoiCloudResponse(stats=stats)
