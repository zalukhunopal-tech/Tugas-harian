"""Definisi band Sentinel-2 L2A dan preset.

`asset` = nama aset pada item STAC Earth Search. `native_res` = resolusi asli (m).
"""
from __future__ import annotations

BANDS: dict[str, dict] = {
    "B01": {"asset": "coastal", "native_res": 60, "label": "Coastal aerosol"},
    "B02": {"asset": "blue", "native_res": 10, "label": "Blue"},
    "B03": {"asset": "green", "native_res": 10, "label": "Green"},
    "B04": {"asset": "red", "native_res": 10, "label": "Red"},
    "B05": {"asset": "rededge1", "native_res": 20, "label": "Red edge 1"},
    "B06": {"asset": "rededge2", "native_res": 20, "label": "Red edge 2"},
    "B07": {"asset": "rededge3", "native_res": 20, "label": "Red edge 3"},
    "B08": {"asset": "nir", "native_res": 10, "label": "NIR"},
    "B8A": {"asset": "nir08", "native_res": 20, "label": "NIR narrow"},
    "B09": {"asset": "nir09", "native_res": 60, "label": "Water vapour"},
    "B11": {"asset": "swir16", "native_res": 20, "label": "SWIR 1"},
    "B12": {"asset": "swir22", "native_res": 20, "label": "SWIR 2"},
}

# Urutan band di dalam file keluaran mengikuti urutan yang diminta pengguna, sehingga
# preset RGB berurutan R,G,B (band 1-3) dan tampil benar secara default di QGIS/ArcGIS.
PRESETS: dict[str, list[str]] = {
    "rgb": ["B04", "B03", "B02"],
    "false_color": ["B08", "B04", "B03"],
    "vegetation": ["B04", "B08"],
    "all": list(BANDS.keys()),
}

RESOLUTIONS = (10, 20, 60)

PREVIEW_MODES: dict[str, list[str]] = {
    "true_color": ["B04", "B03", "B02"],
    "false_color": ["B08", "B04", "B03"],
}

RESAMPLING_METHODS = ("auto", "nearest", "bilinear", "cubic", "average")
