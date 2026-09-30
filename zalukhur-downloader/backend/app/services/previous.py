"""Pemilihan dan validasi citra sebelumnya untuk cloud masking berbasis citra lain."""
from __future__ import annotations

from datetime import timedelta

from shapely.geometry.base import BaseGeometry

from app.config import Settings
from app.errors import AppError, ProcessingError
from app.models.scene import PreviousScene
from app.services import cloud_mask
from app.services.catalog import StacCatalog, item_to_scene

NO_PREVIOUS = "Citra sebelumnya tidak tersedia. Cloud masking berbasis previous image tidak dapat dilakukan."


def candidates(
    catalog: StacCatalog, cur_item: dict, aoi: BaseGeometry, lookback_days: int, max_cloud: float, limit: int
) -> tuple[list[PreviousScene], str | None]:
    """Scene yang lebih lama dari citra utama, menutupi AOI, terbaru (terdekat) lebih dulu."""
    cur = item_to_scene(cur_item, aoi)
    start = cur.date - timedelta(days=lookback_days)
    end = cur.date - timedelta(days=1)
    items, _ = catalog.search_items(aoi, start, end, max_cloud, limit * 3)
    out: list[PreviousScene] = []
    for it in items:
        sc = item_to_scene(it, aoi)
        if sc.id == cur.id or sc.date >= cur.date or not sc.aoi_coverage_pct:
            continue
        out.append(PreviousScene(**sc.model_dump(), same_tile=sc.tile == cur.tile, days_before=(cur.date - sc.date).days))
    out = out[:limit]
    return out, (None if out else NO_PREVIOUS)


def resolve(
    catalog: StacCatalog, cur_item: dict, ids: list[str], aoi: BaseGeometry, settings: Settings, safe_id
) -> list[dict]:
    """Ambil item citra sebelumnya dari katalog (bukan dari klien) dan validasi tiap satunya."""
    cur = item_to_scene(cur_item)
    prevs: list[dict] = []
    for raw in ids:
        pid = safe_id(raw)
        if pid == cur.id:
            raise ProcessingError("Citra sebelumnya tidak boleh sama dengan citra utama.")
        item = catalog.get_item(pid)
        sc = item_to_scene(item, aoi)
        if sc.date >= cur.date:
            raise ProcessingError(
                f"Citra sebelumnya {sc.id} ({sc.date}) harus lebih lama dari citra utama ({cur.date})."
            )
        if not sc.aoi_coverage_pct:
            raise ProcessingError(f"Citra sebelumnya {sc.id} tidak menutupi AOI.")
        try:
            cloud_mask.scl_href(item, settings)
        except AppError:
            raise
        prevs.append(item)
    return prevs
