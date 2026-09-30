from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class AOIRequest(BaseModel):
    """AOI dari geometri (Polygon/Rectangle/Point) atau dari koordinat + radius."""

    geometry: dict[str, Any] | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    radius_m: float | None = Field(default=None, gt=0, le=50_000)

    @model_validator(mode="after")
    def _one_source(self):
        has_geom = self.geometry is not None
        has_point = self.lat is not None or self.lon is not None
        if has_geom == has_point:
            raise ValueError("Isi salah satu: 'geometry' atau 'lat'+'lon'+'radius_m'.")
        if has_point and (self.lat is None or self.lon is None or self.radius_m is None):
            raise ValueError("Mode koordinat memerlukan lat, lon, dan radius_m.")
        return self


class AOIInfo(BaseModel):
    geometry: dict[str, Any]
    crs: str = "EPSG:4326"
    area_km2: float
    bbox: list[float]
    centroid: list[float]
    kind: str
    parts: int = 1
    warnings: list[str] = []
