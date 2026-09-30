"""Konfigurasi aplikasi. Semua nilai dibaca dari environment variable.

Kredensial (bila suatu saat dibutuhkan, mis. Copernicus Data Space) hanya boleh
berada di sini / di environment backend, tidak pernah dikirim ke frontend.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


@dataclass(frozen=True)
class Settings:
    # Katalog STAC. Earth Search (AWS) menyediakan Sentinel-2 L2A sebagai COG publik
    # tanpa kredensial, sehingga bisa dibaca per-window (cocok untuk crop AOI).
    stac_url: str = field(default_factory=lambda: os.environ.get("STAC_URL", "https://earth-search.aws.element84.com/v1"))
    stac_collection: str = field(default_factory=lambda: os.environ.get("STAC_COLLECTION", "sentinel-2-l2a"))
    stac_timeout: float = field(default_factory=lambda: _float("STAC_TIMEOUT", 30.0))

    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("DATA_DIR", "data")).resolve())
    job_workers: int = field(default_factory=lambda: _int("JOB_WORKERS", 2))
    job_ttl_hours: float = field(default_factory=lambda: _float("JOB_TTL_HOURS", 24))

    max_aoi_km2: float = field(default_factory=lambda: _float("MAX_AOI_KM2", 2500))
    max_upload_mb: float = field(default_factory=lambda: _float("MAX_UPLOAD_MB", 20))
    max_output_pixels: int = field(default_factory=lambda: _int("MAX_OUTPUT_PIXELS", 60_000_000))
    max_search_results: int = field(default_factory=lambda: _int("MAX_SEARCH_RESULTS", 200))
    preview_max_px: int = field(default_factory=lambda: _int("PREVIEW_MAX_PX", 1024))

    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
        )
    )
    frontend_dist: Path | None = field(
        default_factory=lambda: Path(os.environ["FRONTEND_DIST"]).resolve() if os.environ.get("FRONTEND_DIST") else None
    )

    nominatim_url: str = field(default_factory=lambda: os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org"))
    user_agent: str = field(default_factory=lambda: os.environ.get("USER_AGENT", "ZalukhuR-Downloader/1.0 (self-hosted)"))

    # Hanya untuk pengujian otomatis: izinkan href aset berupa path file lokal.
    allow_local_assets: bool = field(default_factory=lambda: os.environ.get("ALLOW_LOCAL_ASSETS", "") == "1")


def get_settings() -> Settings:
    return Settings()
