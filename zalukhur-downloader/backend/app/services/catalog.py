"""Klien katalog STAC (Query Engine).

Frontend tidak pernah bicara langsung dengan katalog/penyedia data; semua lewat modul ini.
Implementasi saat ini: Earth Search (AWS) - Sentinel-2 L2A COG, tanpa kredensial.
Penyedia lain (mis. Copernicus Data Space) dapat ditambahkan dengan antarmuka yang sama
(`search`, `get_item`).
"""
from __future__ import annotations

import time
from datetime import date, datetime
from typing import Any

import httpx
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry

from app.config import Settings
from app.errors import CatalogError, NotFoundError
from app.models.scene import Scene
from app.services.aoi import area_km2


def _tile_of(props: dict, item_id: str) -> str | None:
    code = props.get("grid:code")
    if isinstance(code, str) and code.startswith("MGRS-"):
        return code[5:]
    zone, band, sq = props.get("mgrs:utm_zone"), props.get("mgrs:latitude_band"), props.get("mgrs:grid_square")
    if zone and band and sq:
        return f"{int(zone):02d}{band}{sq}"
    parts = item_id.split("_")
    return parts[1] if len(parts) > 1 else None


def _epsg_of(props: dict) -> int | None:
    if props.get("proj:epsg"):
        return int(props["proj:epsg"])
    code = props.get("proj:code")
    if isinstance(code, str) and code.upper().startswith("EPSG:"):
        return int(code.split(":")[1])
    return None


def coverage_pct(aoi: BaseGeometry, footprint: BaseGeometry | None) -> float | None:
    """Persentase AOI yang berada di dalam footprint scene."""
    if footprint is None or footprint.is_empty:
        return None
    inter = aoi.intersection(footprint)
    if inter.is_empty:
        return 0.0
    return round(min(100.0, area_km2(inter) / area_km2(aoi) * 100), 1)


def item_to_scene(item: dict, aoi: BaseGeometry | None = None) -> Scene:
    props = item.get("properties", {})
    dt = datetime.fromisoformat(props["datetime"].replace("Z", "+00:00"))
    footprint = shape(item["geometry"]) if item.get("geometry") else None
    thumb = (item.get("assets", {}).get("thumbnail") or {}).get("href")
    return Scene(
        id=item["id"],
        collection=item.get("collection", ""),
        datetime=dt,
        date=dt.date(),
        platform=props.get("platform"),
        cloud_cover=props.get("eo:cloud_cover"),
        tile=_tile_of(props, item["id"]),
        product_level="L2A",
        epsg=_epsg_of(props),
        geometry=mapping(footprint) if footprint is not None else None,
        thumbnail=thumb,
        aoi_coverage_pct=coverage_pct(aoi, footprint) if aoi is not None else None,
    )


class StacCatalog:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self.settings = settings
        self.base = settings.stac_url.rstrip("/")
        self.client = client or httpx.Client(
            timeout=settings.stac_timeout,
            headers={"User-Agent": settings.user_agent, "Accept": "application/geo+json, application/json"},
        )

    # -- HTTP -----------------------------------------------------------------
    def _request(self, method: str, url: str, **kw) -> dict:
        last: Exception | None = None
        for attempt in range(3):
            try:
                resp = self.client.request(method, url, **kw)
            except httpx.HTTPError as exc:
                last = exc
            else:
                if resp.status_code == 404:
                    raise NotFoundError("Data tidak ditemukan di katalog.")
                if resp.status_code < 500 and resp.status_code != 429:
                    if resp.status_code >= 400:
                        raise CatalogError(f"Katalog menolak permintaan (HTTP {resp.status_code}): {resp.text[:200]}")
                    try:
                        return resp.json()
                    except ValueError as exc:
                        raise CatalogError("Balasan katalog bukan JSON yang valid.") from exc
                last = CatalogError(f"Katalog sedang bermasalah (HTTP {resp.status_code}).")
            time.sleep(0.5 * (attempt + 1))
        raise CatalogError(f"Katalog tidak dapat dihubungi. Coba lagi beberapa saat lagi. ({last})")

    # -- API ------------------------------------------------------------------
    def search_items(
        self,
        aoi: BaseGeometry,
        start: date,
        end: date,
        max_cloud_cover: float,
        limit: int,
    ) -> tuple[list[dict], bool]:
        """Kembalikan (items, truncated). Diurutkan dari yang terbaru."""
        body: dict[str, Any] = {
            "collections": [self.settings.stac_collection],
            "intersects": mapping(aoi),
            "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
            "limit": min(limit, 100),
            "sortby": [{"field": "properties.datetime", "direction": "desc"}],
        }
        if max_cloud_cover < 100:
            body["query"] = {"eo:cloud_cover": {"lte": max_cloud_cover}}

        items: list[dict] = []
        url, payload = f"{self.base}/search", body
        truncated = False
        while True:
            page = self._request("POST", url, json=payload)
            items.extend(page.get("features", []))
            nxt = next((l for l in page.get("links", []) if l.get("rel") == "next"), None)
            if len(items) >= limit:
                truncated = len(items) > limit or nxt is not None
                items = items[:limit]
                break
            if not nxt:
                break
            url = nxt.get("href", url)
            if nxt.get("method", "GET").upper() == "POST":
                payload = {**payload, **(nxt.get("body") or {})} if nxt.get("merge") else (nxt.get("body") or payload)
            else:
                raise CatalogError("Paginasi katalog (GET) tidak didukung.")
        return items, truncated

    def get_item(self, scene_id: str) -> dict:
        return self._request("GET", f"{self.base}/collections/{self.settings.stac_collection}/items/{scene_id}")

    def search(
        self,
        aoi: BaseGeometry,
        start: date,
        end: date,
        max_cloud_cover: float,
        limit: int,
    ) -> tuple[list[Scene], bool, str | None, float | None]:
        """Cari scene. Mengembalikan (scenes, truncated, message, min_cloud_tanpa_filter)."""
        limit = min(limit, self.settings.max_search_results)
        items, truncated = self.search_items(aoi, start, end, max_cloud_cover, limit)
        scenes = [item_to_scene(i, aoi) for i in items]
        if scenes:
            return scenes, truncated, None, None

        # Tidak ada hasil: bedakan "tidak ada citra sama sekali" vs "semua terlalu berawan".
        if max_cloud_cover < 100:
            any_items, _ = self.search_items(aoi, start, end, 100, 100)
            if any_items:
                lowest = min(i.get("properties", {}).get("eo:cloud_cover", 100.0) for i in any_items)
                return [], False, (
                    f"Tidak tersedia citra dengan cloud cover ≤{max_cloud_cover:g}% pada periode tersebut."
                ), round(lowest, 1)
        return [], False, "Tidak ditemukan citra yang memenuhi kriteria.", None
