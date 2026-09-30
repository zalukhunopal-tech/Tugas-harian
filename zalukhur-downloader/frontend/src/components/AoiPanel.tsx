import { useRef, useState } from "react";
import type { AOIInfo, DrawMode } from "../types";

interface Props {
  aoi: AOIInfo | null;
  error: string | null;
  loading: boolean;
  drawMode: DrawMode;
  onDrawMode: (m: DrawMode) => void;
  radius: number;
  onRadius: (r: number) => void;
  onUpload: (file: File) => void;
  onCoords: (lat: number, lon: number) => void;
  onClear: () => void;
  maxKm2: number;
}

const TOOLS: { mode: Exclude<DrawMode, null>; label: string }[] = [
  { mode: "polygon", label: "Polygon" },
  { mode: "rectangle", label: "Rectangle" },
  { mode: "point", label: "Titik + radius" },
];

export default function AoiPanel(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [coordErr, setCoordErr] = useState<string | null>(null);

  const submitCoords = () => {
    const la = Number(lat.replace(",", "."));
    const lo = Number(lon.replace(",", "."));
    if (lat.trim() === "" || lon.trim() === "" || !Number.isFinite(la) || !Number.isFinite(lo)) {
      return setCoordErr("Isi latitude dan longitude dengan angka.");
    }
    if (la < -90 || la > 90 || lo < -180 || lo > 180) return setCoordErr("Latitude harus −90…90 dan longitude −180…180.");
    setCoordErr(null);
    p.onCoords(la, lo);
  };

  return (
    <section className="panel" aria-labelledby="h-aoi">
      <h2 id="h-aoi">
        <span className="step">2</span> Area of Interest (AOI)
      </h2>

      <div className="btn-row" role="group" aria-label="Gambar AOI">
        {TOOLS.map((t) => (
          <button
            key={t.mode}
            type="button"
            className={"btn" + (p.drawMode === t.mode ? " active" : "")}
            aria-pressed={p.drawMode === t.mode}
            onClick={() => p.onDrawMode(p.drawMode === t.mode ? null : t.mode)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Radius untuk titik (m)</span>
        <input
          type="number"
          min={1}
          max={50000}
          value={p.radius}
          onChange={(e) => p.onRadius(Number(e.target.value))}
          aria-label="Radius (meter)"
        />
      </label>

      <div className="btn-row">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Unggah berkas…
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".geojson,.json,.kml,.zip,.gpkg"
          data-testid="aoi-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onUpload(f);
            e.target.value = "";
          }}
        />
        <span className="hint">GeoJSON, KML, SHP (ZIP), GeoPackage</span>
      </div>

      <details className="coords-form">
        <summary>Masukkan koordinat</summary>
        <div className="grid2">
          <label className="field">
            <span>Latitude</span>
            <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-2.5" />
          </label>
          <label className="field">
            <span>Longitude</span>
            <input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="102.3" />
          </label>
        </div>
        <button type="button" className="btn" onClick={submitCoords}>
          Buat AOI dari koordinat
        </button>
        {coordErr && <p className="msg error">{coordErr}</p>}
      </details>

      {p.loading && <p className="msg info">Memvalidasi AOI…</p>}
      {p.error && (
        <p className="msg error" role="alert">
          {p.error}
        </p>
      )}
      {p.aoi && (
        <div className="aoi-info" data-testid="aoi-info">
          <div>
            <strong>{p.aoi.kind === "point" ? "AOI titik + radius" : "AOI poligon"}</strong>
            {p.aoi.parts > 1 && ` · ${p.aoi.parts} bagian`}
          </div>
          <div>
            Luas: <strong>{p.aoi.area_km2.toLocaleString("id-ID", { maximumFractionDigits: 2 })} km²</strong> · {p.aoi.crs}
          </div>
          {p.aoi.warnings.map((w) => (
            <p key={w} className="msg warn">
              {w}
            </p>
          ))}
          <button type="button" className="link" onClick={p.onClear}>
            Hapus AOI
          </button>
        </div>
      )}
      {!p.aoi && !p.error && !p.loading && (
        <p className="hint">Batas luas AOI: {p.maxKm2.toLocaleString("id-ID")} km².</p>
      )}
    </section>
  );
}
