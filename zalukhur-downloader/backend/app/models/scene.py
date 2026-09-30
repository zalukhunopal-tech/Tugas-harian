from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.bands import BANDS, RESAMPLING_METHODS, RESOLUTIONS


class SearchRequest(BaseModel):
    aoi: dict[str, Any]
    start_date: date
    end_date: date
    max_cloud_cover: float = Field(default=100, ge=0, le=100)
    satellite: Literal["sentinel-2"] = "sentinel-2"
    product_level: Literal["L2A"] = "L2A"
    limit: int = Field(default=100, ge=1, le=500)

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date < self.start_date:
            raise ValueError("Tanggal akhir harus sama dengan atau setelah tanggal mulai.")
        return self


class Scene(BaseModel):
    id: str
    collection: str
    datetime: datetime
    date: date
    platform: str | None = None
    cloud_cover: float | None = None
    tile: str | None = None
    product_level: str = "L2A"
    epsg: int | None = None
    geometry: dict[str, Any] | None = None
    thumbnail: str | None = None
    aoi_coverage_pct: float | None = None


class SearchResponse(BaseModel):
    count: int
    scenes: list[Scene]
    message: str | None = None
    truncated: bool = False
    min_cloud_cover_available: float | None = None


MaskClass = Literal["cloud", "cloud_shadow", "cirrus", "snow_ice"]


class CloudMaskOptions(BaseModel):
    """Cloud masking level piksel (SCL) + pengisian dari citra sebelumnya."""

    enabled: bool = False
    classes: list[MaskClass] = ["cloud", "cloud_shadow", "cirrus"]
    dilate_m: int = Field(default=20, ge=0, le=100)
    fill_from_previous: bool = False
    previous_scene_ids: list[str] = Field(default_factory=list, max_length=5)
    include_qa: bool = True

    @field_validator("classes")
    @classmethod
    def _classes(cls, v: list[str]):
        v = list(dict.fromkeys(v))
        if not v:
            raise ValueError("Pilih minimal satu kelas untuk di-mask (awan, bayangan, cirrus, atau salju/es).")
        return v

    @model_validator(mode="after")
    def _fill(self):
        if self.fill_from_previous:
            if not self.enabled:
                raise ValueError("Pengisian dari citra sebelumnya memerlukan cloud masking aktif.")
            if not self.previous_scene_ids:
                raise ValueError("Pilih minimal satu citra sebelumnya untuk mengisi piksel yang ter-mask.")
        if len(set(self.previous_scene_ids)) != len(self.previous_scene_ids):
            raise ValueError("Citra sebelumnya tidak boleh duplikat.")
        return self


class PreviewRequest(BaseModel):
    scene_id: str
    aoi: dict[str, Any]
    mode: Literal["true_color", "false_color"] = "true_color"
    cloud_mask: CloudMaskOptions = Field(default_factory=CloudMaskOptions)


class PreviousRequest(BaseModel):
    scene_id: str
    aoi: dict[str, Any]
    lookback_days: int = Field(default=45, ge=1, le=365)
    max_cloud_cover: float = Field(default=100, ge=0, le=100)
    limit: int = Field(default=10, ge=1, le=30)


class PreviousScene(Scene):
    same_tile: bool = False
    days_before: int = 0


class PreviousResponse(BaseModel):
    count: int
    scenes: list[PreviousScene]
    message: str | None = None


class AoiCloudRequest(BaseModel):
    scene_ids: list[str] = Field(min_length=1, max_length=12)
    aoi: dict[str, Any]
    classes: list[MaskClass] = ["cloud", "cloud_shadow", "cirrus"]
    dilate_m: int = Field(default=20, ge=0, le=100)


class AoiCloudStat(BaseModel):
    scene_id: str
    cloud_pct: float | None = None   # % piksel AOI yang ter-mask (dari yang bertanda data)
    valid_pct: float | None = None   # % piksel AOI yang punya data pada scene ini
    error: str | None = None


class AoiCloudResponse(BaseModel):
    stats: list[AoiCloudStat]


class PreviewResponse(BaseModel):
    image: str  # data URL PNG
    coordinates: list[list[float]]  # TL, TR, BR, BL (lon, lat) untuk image source MapLibre
    mode: str
    width: int
    height: int
    cloud: dict[str, Any] | None = None  # statistik mask bila cloud masking aktif


class DownloadRequest(BaseModel):
    scene_id: str
    aoi: dict[str, Any]
    bands: list[str]
    resolution: int = 10
    formats: list[Literal["geotiff", "cog"]] = ["geotiff"]
    mask_to_aoi: bool = True
    resampling: str = "auto"
    name: str | None = Field(default=None, max_length=60)
    cloud_mask: CloudMaskOptions = Field(default_factory=CloudMaskOptions)

    @field_validator("bands")
    @classmethod
    def _bands(cls, v: list[str]):
        v = [b.upper() for b in v]
        seen: list[str] = []
        for b in v:
            if b not in BANDS:
                raise ValueError(f"Band '{b}' tidak dikenal. Pilihan: {', '.join(BANDS)}.")
            if b not in seen:
                seen.append(b)
        if not seen:
            raise ValueError("Pilih minimal satu band.")
        return seen

    @field_validator("resolution")
    @classmethod
    def _res(cls, v: int):
        if v not in RESOLUTIONS:
            raise ValueError(f"Resolusi harus salah satu dari {RESOLUTIONS} m.")
        return v

    @field_validator("resampling")
    @classmethod
    def _resampling(cls, v: str):
        if v not in RESAMPLING_METHODS:
            raise ValueError(f"Metode resampling harus salah satu dari {RESAMPLING_METHODS}.")
        return v

    @field_validator("formats")
    @classmethod
    def _formats(cls, v: list[str]):
        v = list(dict.fromkeys(v))
        if not v:
            raise ValueError("Pilih minimal satu format keluaran.")
        return v
