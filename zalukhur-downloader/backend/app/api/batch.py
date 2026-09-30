from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse

from app.api.query import _safe_id, validated_aoi
from app.models.scene import BatchRequest, DownloadRequest
from app.services import crop, previous

router = APIRouter(prefix="/api", tags=["batch"])


@router.post("/batch", status_code=202)
def create_batch(body: BatchRequest, request: Request) -> dict:
    """Terapkan opsi yang sama ke banyak scene (satu job per scene). Data selalu diambil dari katalog."""
    st = request.app.state
    geom, info = validated_aoi(body.aoi, request)
    aoi_info = {"geometry": info.geometry, "area_km2": info.area_km2}
    scene_ids = [_safe_id(s) for s in body.scene_ids]
    options = body.model_dump(exclude={"scene_ids", "aoi"})

    def make_work(scene_id: str):
        def work(out_dir, progress):
            # semua pengambilan katalog terjadi di worker agar permintaan ini segera kembali
            item = st.catalog.get_item(scene_id)
            req = DownloadRequest(scene_id=scene_id, aoi=body.aoi, **options)
            prev_items, ref_item = previous.prepare(st.catalog, st.settings, item, geom, req, _safe_id)
            return crop.process_scene(item, geom, req, out_dir, st.settings, progress, aoi_info, prev_items, ref_item)

        return work

    batch = st.batches.create(scene_ids, make_work)
    return st.batches.summary(batch.id)


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str, request: Request) -> dict:
    return request.app.state.batches.summary(batch_id)


@router.get("/batches/{batch_id}/download.zip")
def download_batch(batch_id: str, request: Request) -> FileResponse:
    path = request.app.state.batches.zip_path(batch_id)
    return FileResponse(path, filename=f"batch_{batch_id[:8]}.zip", media_type="application/zip")
