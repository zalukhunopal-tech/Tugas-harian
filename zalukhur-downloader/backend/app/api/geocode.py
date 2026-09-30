from __future__ import annotations

import threading
import time

import httpx
from fastapi import APIRouter, Query, Request

from app.errors import AppError

router = APIRouter(prefix="/api", tags=["geocode"])

_lock = threading.Lock()
_last = 0.0
_cache: dict[str, list[dict]] = {}


@router.get("/geocode")
def geocode(request: Request, q: str = Query(min_length=3, max_length=120)) -> list[dict]:
    """Pencarian lokasi (Nominatim) lewat backend agar User-Agent & batas 1 req/detik dipatuhi."""
    global _last
    s = request.app.state.settings
    key = q.strip().lower()
    if key in _cache:
        return _cache[key]
    with _lock:
        wait = 1.0 - (time.monotonic() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.monotonic()
        try:
            r = httpx.get(
                f"{s.nominatim_url.rstrip('/')}/search",
                params={"q": q, "format": "jsonv2", "limit": 6},
                headers={"User-Agent": s.user_agent},
                timeout=10,
            )
            r.raise_for_status()
            rows = r.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AppError("Pencarian lokasi sedang tidak tersedia.", code="geocode_unavailable", status_code=502) from exc
    out = [
        {
            "name": row.get("display_name", ""),
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "bbox": [float(row["boundingbox"][2]), float(row["boundingbox"][0]),
                     float(row["boundingbox"][3]), float(row["boundingbox"][1])] if row.get("boundingbox") else None,
        }
        for row in rows
    ]
    if len(_cache) > 200:
        _cache.clear()
    _cache[key] = out
    return out
