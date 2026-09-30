// Worker MapLibre sebagai berkas hasil bundling Vite. Tanpa ini, MapLibre meminta
// /assets/maplibre-gl-worker.mjs (404 pada build produksi) sehingga semua layer GeoJSON
// (garis AOI, footprint scene) tidak pernah tergambar.
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
