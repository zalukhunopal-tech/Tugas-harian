import { useState } from "react";
import { formatDate } from "../lib/dates";
import { usePrevious } from "../lib/usePrevious";
import type { AOIInfo, AppConfig, ChangeOptions, IndexName, Scene } from "../types";

interface Props {
  config: AppConfig;
  scene: Scene;
  aoi: AOIInfo;
  value: ChangeOptions;
  onChange: (v: ChangeOptions) => void;
  maskOn: boolean;
}

export default function ChangePanel({ config, scene, aoi, value: ch, onChange, maskOn }: Props) {
  const set = (patch: Partial<ChangeOptions>) => onChange({ ...ch, ...patch });
  const [lookback, setLookback] = useState(90);
  const { cands, message, error, loading } = usePrevious(scene.id, aoi.geometry, lookback, ch.enabled);

  return (
    <div className="field changebox" data-testid="changebox">
      <span>Deteksi perubahan</span>
      <label className="inline">
        <input type="checkbox" checked={ch.enabled} onChange={(e) => set({ enabled: e.target.checked, reference_scene_id: e.target.checked ? ch.reference_scene_id : null })} />{" "}
        Bandingkan dengan citra yang lebih lama
      </label>

      {ch.enabled && (
        <>
          <div className="grid2">
            <label className="field">
              <span>Indeks</span>
              <select aria-label="Indeks perubahan" value={ch.index} onChange={(e) => set({ index: e.target.value as IndexName })}>
                {(Object.keys(config.indices) as IndexName[]).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ambang perubahan</span>
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={ch.threshold}
                aria-label="Ambang perubahan"
                onChange={(e) => set({ threshold: Math.min(1, Math.max(0.01, Number(e.target.value) || 0.1)) })}
              />
            </label>
          </div>
          <label className="inline">
            Cari referensi sampai
            <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} aria-label="Rentang mundur referensi">
              {[30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} hari sebelumnya
                </option>
              ))}
            </select>
          </label>
          {loading && <p className="hint">Mencari citra referensi…</p>}
          {error && <p className="msg error" role="alert">{error}</p>}
          {!loading && !error && cands.length === 0 && message && <p className="msg warn" data-testid="no-reference">{message}</p>}
          <ul className="prev-list" role="radiogroup" aria-label="Citra referensi">
            {cands.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={ch.reference_scene_id === c.id}
                  className={"prev" + (ch.reference_scene_id === c.id ? " on" : "")}
                  onClick={() => set({ reference_scene_id: c.id })}
                  data-testid="ref-candidate"
                >
                  <span className="badge">{ch.reference_scene_id === c.id ? "✓" : ""}</span>
                  <span className="grow">
                    <strong>{formatDate(c.date)}</strong> · {c.days_before} hari sebelumnya
                    <small>
                      Tile {c.tile ?? "—"}
                      {!c.same_tile && " (beda tile)"} · katalog {c.cloud_cover?.toFixed(1) ?? "—"}% awan
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="msg info">
            Δ = {ch.index} citra ini − {ch.index} referensi. Keluaran: peta selisih (Float32) dan peta kelas (turun / stabil / naik, ambang ±{ch.threshold}) beserta luas
            per kelas (ha).
          </p>
          {!maskOn && (
            <p className="msg warn">Cloud masking mati: awan pada salah satu tanggal akan terbaca sebagai perubahan. Aktifkan mask SCL untuk hasil yang andal.</p>
          )}
        </>
      )}
    </div>
  );
}
