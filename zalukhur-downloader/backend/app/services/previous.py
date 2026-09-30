"""Pemilihan dan validasi citra sebelumnya untuk cloud masking berbasis citra lain."""
from __future__ import annotations

from datetime import timedelta

from shapely.geometry.base import BaseGeometry

from app.config import Settings
from app.errors import ProcessingError
from app.models.scene import PreviousScene
from app.services import cloud_mask
from app.services.catalog import StacCatalog, item_to_scene

NO_PREVIOUS = "Citra sebelumnya tidak tersedia. Cloud masking berbasis previous image tidak dapat dilakukan."


def _find(
    catalog: StacCatalog, cur_item: dict, aoi: BaseGeometry, lookback_days: int, max_cloud: float, limit: int
) -> list[tuple[dict, PreviousScene]]:
    """Scene yang lebih lama dari citra utama dan menutupi AOI, terbaru (terdekat) lebih dulu."""
    cur = item_to_scene(cur_item, aoi)
    start = cur.date - timedelta(days=lookback_days)
    end = cur.date - timedelta(days=1)
    items, _ = catalog.search_items(aoi, start, end, max_cloud, limit * 3)
    out: list[tuple[dict, PreviousScene]] = []
    for it in items:
        sc = item_to_scene(it, aoi)
        if sc.id == cur.id or sc.date >= cur.date or not sc.aoi_coverage_pct:
            continue
        out.append((it, PreviousScene(**sc.model_dump(), same_tile=sc.tile == cur.tile, days_before=(cur.date - sc.date).days)))
    return out[:limit]


def candidates(
    catalog: StacCatalog, cur_item: dict, aoi: BaseGeometry, lookback_days: int, max_cloud: float, limit: int
) -> tuple[list[PreviousScene], str | None]:
    out = [sc for _, sc in _find(catalog, cur_item, aoi, lookback_days, max_cloud, limit)]
    return out, (None if out else NO_PREVIOUS)


def auto(
    catalog: StacCatalog, cur_item: dict, aoi: BaseGeometry, count: int, lookback_days: int, settings: Settings
) -> list[dict]:
    """Pilih `count` citra sebelumnya otomatis: tile yang sama lebih dulu, lalu yang terdekat waktunya."""
    found = [(it, sc) for it, sc in _find(catalog, cur_item, aoi, lookback_days, 100, 30) if (it.get("assets") or {}).get("scl")]
    found.sort(key=lambda t: (not t[1].same_tile, t[1].days_before))
    if not found:
        raise ProcessingError(NO_PREVIOUS)
    return [it for it, _ in found[:count]]


def resolve(
    catalog: StacCatalog, cur_item: dict, ids: list[str], aoi: BaseGeometry, settings: Settings, safe_id,
    require_scl: bool = True,
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
        if require_scl:
            cloud_mask.scl_href(item, settings)
        prevs.append(item)
    return prevs


def prepare(catalog: StacCatalog, settings: Settings, item: dict, aoi: BaseGeometry, opts, safe_id) -> tuple[list[dict], dict | None]:
    """Ambil (citra sebelumnya, citra referensi perubahan) sesuai opsi; semuanya dari katalog, bukan klien."""
    cm, prev_items, ref_item = opts.cloud_mask, [], None
    if cm.enabled:
        cloud_mask.scl_href(item, settings)  # gagal cepat bila scene tak punya SCL
        if cm.fill_from_previous:
            if cm.previous_scene_ids:
                prev_items = resolve(catalog, item, cm.previous_scene_ids, aoi, settings, safe_id)
            else:
                prev_items = auto(catalog, item, aoi, cm.auto_previous, cm.auto_lookback_days, settings)
    if opts.change.enabled:
        ref_item = resolve(catalog, item, [opts.change.reference_scene_id], aoi, settings, safe_id, require_scl=cm.enabled)[0]
    return prev_items, ref_item
