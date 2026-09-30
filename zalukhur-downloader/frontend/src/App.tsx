import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import AoiPanel from "./components/AoiPanel";
import DownloadPanel from "./components/DownloadPanel";
import FilterPanel from "./components/FilterPanel";
import GeocodeBox from "./components/GeocodeBox";
import MapView, { type Basemap, type FitRequest } from "./components/MapView";
import SceneList from "./components/SceneList";
import { defaultFilters, resolveRange, type DateFilters } from "./lib/dates";
import type { AOIInfo, AppConfig, DrawMode, Geometry, PreviewMode, PreviewResponse, Scene, SearchResponse } from "./types";

type PointSource = { lat: number; lon: number } | null;

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // AOI
  const [aoi, setAoi] = useState<AOIInfo | null>(null);
  const [aoiError, setAoiError] = useState<string | null>(null);
  const [aoiLoading, setAoiLoading] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [radius, setRadius] = useState(500);
  const [pointSource, setPointSource] = useState<PointSource>(null);
  const [fit, setFit] = useState<FitRequest | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("osm");
  const aoiSeq = useRef(0);

  // Query
  const [filters, setFilters] = useState<DateFilters>(() => defaultFilters());
  const [cloud, setCloud] = useState(20);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  // Scene
  const [selected, setSelected] = useState<Scene | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("true_color");
  const [preview, setPreview] = useState<{ sceneId: string; data: PreviewResponse } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch((e: Error) => setConfigError(e.message));
  }, []);

  const resetResults = useCallback(() => {
    setResult(null);
    setSelected(null);
    setPreview(null);
    setSearchError(null);
    setPreviewError(null);
  }, []);

  // Menerapkan AOI baru: hanya hasil permintaan terakhir yang dipakai
  const applyAoi = useCallback(
    async (make: () => Promise<AOIInfo>, source: PointSource = null) => {
      const mine = ++aoiSeq.current;
      setAoiLoading(true);
      setAoiError(null);
      try {
        const info = await make();
        if (mine !== aoiSeq.current) return;
        setAoi(info);
        setPointSource(source);
        resetResults();
        setFit({ bbox: info.bbox, nonce: Date.now() });
      } catch (e) {
        if (mine !== aoiSeq.current) return;
        setAoiError((e as Error).message);
      } finally {
        if (mine === aoiSeq.current) setAoiLoading(false);
      }
    },
    [resetResults],
  );

  const onDraw = useCallback(
    (g: Geometry) => {
      setDrawMode(null);
      if (g.type === "Point") {
        const [lon, lat] = g.coordinates as [number, number];
        void applyAoi(() => api.aoiFromGeometry(g, radius), { lat, lon });
      } else {
        void applyAoi(() => api.aoiFromGeometry(g));
      }
    },
    [applyAoi, radius],
  );

  // radius berubah saat AOI berupa titik -> hitung ulang (debounce)
  useEffect(() => {
    if (!pointSource || !(radius > 0)) return;
    const t = window.setTimeout(() => {
      void applyAoi(() => api.aoiFromPoint(pointSource.lat, pointSource.lon, radius), pointSource);
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  const clearAoi = () => {
    aoiSeq.current++;
    setAoi(null);
    setPointSource(null);
    setAoiError(null);
    resetResults();
  };

  const range = useMemo(() => resolveRange(filters), [filters]);

  const search = async () => {
    if (!aoi || "error" in range) return;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    setPreview(null);
    try {
      setResult(
        await api.search({ aoi: aoi.geometry, start_date: range.start, end_date: range.end, max_cloud_cover: cloud, limit: range.limit }),
      );
    } catch (e) {
      setResult(null);
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const loadPreview = useCallback(
    async (scene: Scene, mode: PreviewMode) => {
      if (!aoi) return;
      setPreviewLoading(scene.id);
      setPreviewError(null);
      try {
        const data = await api.preview(scene.id, aoi.geometry, mode);
        setPreview({ sceneId: scene.id, data });
      } catch (e) {
        setPreviewError((e as Error).message);
      } finally {
        setPreviewLoading(null);
      }
    },
    [aoi],
  );

  const togglePreview = (scene: Scene) => {
    if (preview?.sceneId === scene.id) setPreview(null);
    else void loadPreview(scene, previewMode);
  };

  const changePreviewMode = (m: PreviewMode) => {
    setPreviewMode(m);
    const scene = result?.scenes.find((s) => s.id === preview?.sceneId);
    if (scene) void loadPreview(scene, m);
  };

  const canSearch = !!aoi && !("error" in range) && !searching;

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="brand">
          <h1>ZalukhuR Downloader</h1>
          <p>Cari, potong (crop AOI), dan unduh citra Sentinel-2.</p>
        </header>

        <section className="panel" aria-labelledby="h-src">
          <h2 id="h-src">
            <span className="step">1</span> Sumber data
          </h2>
          <div className="src-row">
            <span className="tag">Sentinel-2</span>
            <span className="tag">Level-2A</span>
          </div>
        </section>

        {configError && <p className="msg error" role="alert">{configError}</p>}

        <AoiPanel
          aoi={aoi}
          error={aoiError}
          loading={aoiLoading}
          drawMode={drawMode}
          onDrawMode={setDrawMode}
          radius={radius}
          onRadius={setRadius}
          onUpload={(f) => void applyAoi(() => api.aoiFromFile(f, radius))}
          onCoords={(lat, lon) => void applyAoi(() => api.aoiFromPoint(lat, lon, radius), { lat, lon })}
          onClear={clearAoi}
          maxKm2={config?.max_aoi_km2 ?? 2500}
        />

        <FilterPanel filters={filters} onFilters={setFilters} cloud={cloud} onCloud={setCloud} />

        <div className="panel search-box">
          {"error" in range && <p className="msg error">{range.error}</p>}
          <button type="button" className="btn primary wide" disabled={!canSearch} onClick={search} data-testid="search">
            {searching ? "Mencari…" : "CARI CITRA"}
          </button>
          {!aoi && <p className="hint">Tentukan AOI terlebih dahulu.</p>}
          {searchError && <p className="msg error" role="alert">{searchError}</p>}
        </div>

        <SceneList
          result={result}
          selectedId={selected?.id ?? null}
          previewId={preview?.sceneId ?? null}
          previewLoading={previewLoading}
          previewMode={previewMode}
          onPreviewMode={changePreviewMode}
          onPreview={togglePreview}
          onSelect={setSelected}
          previewError={previewError}
        />

        {selected && aoi && config && <DownloadPanel config={config} scene={selected} aoi={aoi} />}

        <footer className="foot">
          Contains modified Copernicus Sentinel data. Data melalui Earth Search (AWS Open Data).
        </footer>
      </aside>

      <main className="stage">
        <div className="topbar">
          <GeocodeBox onPick={(bbox) => setFit({ bbox, nonce: Date.now() })} />
          <div className="seg small" role="radiogroup" aria-label="Peta dasar">
            {(
              [
                ["osm", "Peta"],
                ["satellite", "Satelit"],
                ["none", "Kosong"],
              ] as const
            ).map(([b, label]) => (
              <button key={b} type="button" role="radio" aria-checked={basemap === b} className={basemap === b ? "on" : ""} onClick={() => setBasemap(b)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <MapView
          aoi={aoi}
          drawMode={drawMode}
          basemap={basemap}
          scenes={result?.scenes ?? []}
          selectedId={selected?.id ?? null}
          preview={preview?.data ?? null}
          fit={fit}
          onDraw={onDraw}
        />
      </main>
    </div>
  );
}
