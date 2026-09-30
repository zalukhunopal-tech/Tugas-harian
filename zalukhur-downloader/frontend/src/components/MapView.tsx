import "../maplibre-worker";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, NavigationControl, ScaleControl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { TerraDraw, TerraDrawPointMode, TerraDrawPolygonMode, TerraDrawRectangleMode, TerraDrawRenderMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { AOIInfo, DrawMode, Geometry, PreviewResponse, Scene } from "../types";

export type Basemap = "osm" | "satellite" | "none";

export interface FitRequest {
  bbox: [number, number, number, number];
  nonce: number;
}

interface Props {
  aoi: AOIInfo | null;
  drawMode: DrawMode;
  basemap: Basemap;
  scenes: Scene[];
  selectedId: string | null;
  preview: PreviewResponse | null;
  fit: FitRequest | null;
  onDraw: (geometry: Geometry) => void;
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function style(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
      satellite: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Tiles © Esri — Maxar, Earthstar Geographics",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#dfe7ea" } },
      { id: "osm", type: "raster", source: "osm" },
      { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
    ],
  };
}

export default function MapView({ aoi, drawMode, basemap, scenes, selectedId, preview, fit, onDraw }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const onDrawRef = useRef(onDraw);
  onDrawRef.current = onDraw;
  const [ready, setReady] = useState(false);

  // --- inisialisasi peta + alat gambar
  useEffect(() => {
    if (!box.current) return;
    const map = new MapLibreMap({
      container: box.current,
      style: style(),
      center: [113, -2],
      zoom: 4,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("mousemove", (e) => {
      if (coordRef.current) coordRef.current.textContent = `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`;
    });

    // "style.load", bukan "load": "load" menunggu semua tile selesai, sehingga alat gambar
    // tidak aktif selama tile basemap lambat/gagal dimuat.
    map.once("style.load", () => {
      map.addSource("footprints", { type: "geojson", data: EMPTY });
      map.addSource("selected", { type: "geojson", data: EMPTY });
      map.addSource("aoi", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "footprints-line", type: "line", source: "footprints", paint: { "line-color": "#64748b", "line-width": 1, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "selected-line", type: "line", source: "selected", paint: { "line-color": "#f59e0b", "line-width": 2.5 } });
      map.addLayer({ id: "aoi-fill", type: "fill", source: "aoi", paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.12 } });
      map.addLayer({ id: "aoi-line", type: "line", source: "aoi", paint: { "line-color": "#0369a1", "line-width": 2.5 } });

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawRenderMode({ modeName: "static", styles: {} }),
          new TerraDrawPolygonMode(),
          new TerraDrawRectangleMode(),
          new TerraDrawPointMode(),
        ],
      });
      draw.start();
      draw.setMode("static");
      draw.on("finish", (id) => {
        const f = draw.getSnapshotFeature(id);
        if (f) onDrawRef.current(f.geometry as Geometry);
        draw.clear();
      });
      drawRef.current = draw;
      setReady(true);
    });

    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // --- mode gambar
  useEffect(() => {
    if (!ready) return;
    drawRef.current?.clear();
    drawRef.current?.setMode(drawMode ?? "static");
  }, [drawMode, ready]);

  // --- basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("osm", "visibility", basemap === "osm" ? "visible" : "none");
    map.setLayoutProperty("satellite", "visibility", basemap === "satellite" ? "visible" : "none");
  }, [basemap, ready]);

  // --- AOI
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("aoi") as GeoJSONSource;
    src.setData(aoi ? { type: "Feature", properties: {}, geometry: aoi.geometry as never } : EMPTY);
  }, [aoi, ready]);

  // --- footprint scene
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const feat = (s: Scene) => ({ type: "Feature" as const, properties: { id: s.id }, geometry: s.geometry as never });
    const withGeom = scenes.filter((s) => s.geometry);
    (map.getSource("footprints") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: withGeom.filter((s) => s.id !== selectedId).map(feat),
    } as never);
    (map.getSource("selected") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: withGeom.filter((s) => s.id === selectedId).map(feat),
    } as never);
  }, [scenes, selectedId, ready]);

  // --- preview citra
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer("preview")) map.removeLayer("preview");
    if (map.getSource("preview")) map.removeSource("preview");
    if (preview) {
      map.addSource("preview", {
        type: "image",
        url: preview.image,
        coordinates: preview.coordinates as [[number, number], [number, number], [number, number], [number, number]],
      });
      map.addLayer({ id: "preview", type: "raster", source: "preview", paint: { "raster-fade-duration": 0 } }, "aoi-fill");
    }
  }, [preview, ready]);

  // --- terbang ke bbox
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !fit) return;
    const [w, s, e, n] = fit.bbox;
    map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 16, duration: 600 });
  }, [fit, ready]);

  return (
    <div className="map-wrap">
      <div ref={box} className="map" data-testid="map" data-ready={ready} />
      <div className="coords" aria-live="off">
        <span ref={coordRef}>—</span>
      </div>
      {drawMode && (
        <div className="draw-hint" role="status">
          {drawMode === "polygon" && "Klik untuk menambah titik; klik dua kali atau klik titik pertama untuk menyelesaikan."}
          {drawMode === "rectangle" && "Klik sudut pertama, lalu klik sudut berlawanan."}
          {drawMode === "point" && "Klik lokasi pusat AOI."}
        </div>
      )}
    </div>
  );
}
