from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse

from app.api.query import _safe_id, validated_aoi
from app.models.scene import DownloadRequest
from app.services import crop, previous

router = APIRouter(prefix="/api", tags=["download"])

MEDIA = {".tif": "image/tiff", ".json": "application/json"}


@router.post("/download", status_code=202)
def create_download(body: DownloadRequest, request: Request) -> dict:
    """Buat job crop + unduh. Kembalikan id job; pantau lewat GET /api/jobs/{id}."""
    st = request.app.state
    geom, info = validated_aoi(body.aoi, request)
    item = st.catalog.get_item(_safe_id(body.scene_id))  # data & URL aset selalu dari katalog, bukan dari klien
    aoi_info = {"geometry": info.geometry, "area_km2": info.area_km2}

    prev_items, ref_item = previous.prepare(st.catalog, st.settings, item, geom, body, _safe_id)

    def work(out_dir, progress):
        return crop.process_scene(item, geom, body, out_dir, st.settings, progress, aoi_info, prev_items, ref_item)

    job = st.jobs.submit(work, scene_id=body.scene_id)
    return job.public()


@router.get("/jobs/{job_id}")
def get_job(job_id: str, request: Request) -> dict:
    return request.app.state.jobs.get(job_id).public()


@router.get("/jobs/{job_id}/files/{name}")
def get_job_file(job_id: str, name: str, request: Request) -> FileResponse:
    path = request.app.state.jobs.file_path(job_id, name)
    return FileResponse(path, filename=path.name, media_type=MEDIA.get(path.suffix.lower(), "application/octet-stream"))
