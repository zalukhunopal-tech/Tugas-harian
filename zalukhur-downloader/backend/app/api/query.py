from __future__ import annotations

from fastapi import APIRouter, Request
from shapely.geometry import shape

from app.bands import BANDS, PRESETS, PREVIEW_MODES, RESAMPLING_METHODS, RESOLUTIONS
from app.models.scene import PreviewRequest, PreviewResponse, SearchRequest, SearchResponse
from app.services import aoi as aoi_svc
from app.services import cloud_mask, previous
from app.services import preview as preview_svc

router = APIRouter(prefix="/api", tags=["query"])


def validated_aoi(aoi: dict, request: Request):
    """AOI dari klien tidak dipercaya: validasi ulang (geometri, koordinat, luas)."""
    s = request.app.state.settings
    info = aoi_svc.normalize(aoi_svc.geometries_from_geojson(aoi), max_area_km2=s.max_aoi_km2)
    return shape(info.geometry), info


@router.get("/config")
def config(request: Request) -> dict:
    s = request.app.state.settings
    return {
        "max_aoi_km2": s.max_aoi_km2,
        "max_upload_mb": s.max_upload_mb,
        "bands": {k: {"label": v["label"], "native_res": v["native_res"]} for k, v in BANDS.items()},
        "presets": PRESETS,
        "resolutions": list(RESOLUTIONS),
        "resampling": list(RESAMPLING_METHODS),
        "preview_modes": list(PREVIEW_MODES),
        "mask_classes": {
            "cloud": "Awan (probabilitas sedang + tinggi, SCL 8-9)",
            "cloud_shadow": "Bayangan awan (SCL 3)",
            "cirrus": "Cirrus tipis (SCL 10)",
            "snow_ice": "Salju / es (SCL 11)",
        },
        "satellites": [{"id": "sentinel-2", "label": "Sentinel-2", "levels": ["L2A"]}],
    }


@router.post("/scenes/search", response_model=SearchResponse)
def search_scenes(body: SearchRequest, request: Request) -> SearchResponse:
    geom, _ = validated_aoi(body.aoi, request)
    scenes, truncated, message, lowest = request.app.state.catalog.search(
        geom, body.start_date, body.end_date, body.max_cloud_cover, body.limit
    )
    return SearchResponse(
        count=len(scenes), scenes=scenes, message=message, truncated=truncated, min_cloud_cover_available=lowest
    )


@router.post("/scenes/preview", response_model=PreviewResponse)
def preview_scene(body: PreviewRequest, request: Request) -> PreviewResponse:
    geom, _ = validated_aoi(body.aoi, request)
    st = request.app.state
    item = st.catalog.get_item(_safe_id(body.scene_id))
    cm, prev_items = body.cloud_mask, []
    if cm.enabled:
        cloud_mask.scl_href(item, st.settings)
        if cm.fill_from_previous:
            prev_items = previous.resolve(st.catalog, item, cm.previous_scene_ids, geom, st.settings, _safe_id)
    return preview_svc.render(item, geom, body.mode, st.settings, cm, prev_items)


def _safe_id(scene_id: str) -> str:
    import re

    from app.errors import NotFoundError

    if not re.fullmatch(r"[A-Za-z0-9_.\-]{3,120}", scene_id):
        raise NotFoundError("ID scene tidak valid.")
    return scene_id
