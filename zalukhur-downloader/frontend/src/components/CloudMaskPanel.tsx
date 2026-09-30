import { useEffect, useState } from "react";
import { api } from "../api";
import { maskProblem, methodLabel, togglePrevious } from "../lib/cloud";
import { formatDate } from "../lib/dates";
import { usePrevious } from "../lib/usePrevious";
import type { AOIInfo, AoiCloudStat, AppConfig, CloudMaskOptions, CloudStats, MaskClass, Scene } from "../types";

interface Props {
  config: AppConfig;
  /** scene tunggal; null pada mode batch (pengisi dipilih otomatis per scene) */
  scene: Scene | null;
  aoi: AOIInfo;
  value: CloudMaskOptions;
  onChange: (v: CloudMaskOptions) => void;
  onPreview: () => void;
  previewing: boolean;
  previewStats: CloudStats | null;
}

const LOOKBACKS = [30, 45, 90, 180];

export default function CloudMaskPanel({ config, scene, aoi, value: cm, onChange, onPreview, previewing, previewStats }: Props) {
  const set = (patch: Partial<CloudMaskOptions>) => onChange({ ...cm, ...patch });
  const batch = scene === null;
  const [stats, setStats] = useState<Record<string, AoiCloudStat>>({});
  const auto = cm.auto_previous > 0;
  const wantPrev = cm.enabled && cm.fill_from_previous && !auto && !batch;
  const { cands, message, error, loading } = usePrevious(scene?.id ?? "", aoi.geometry, cm.auto_lookback_days, wantPrev);

  // % awan SCL tepat di dalam AOI (berbeda dari cloud cover scene di katalog)
  const ids = !batch && cm.enabled ? [scene.id, ...(wantPrev ? cands.map((c) => c.id) : [])].slice(0, 12) : [];
  const idsKey = ids.join(",");
  const classKey = cm.classes.join(",");
  useEffect(() => {
    if (!ids.length || cm.classes.length === 0) return;
    let live = true;
    const t = window.setTimeout(() => {
      api
        .aoiCloud(ids, aoi.geometry, cm.classes, cm.dilate_m)
        .then((r) => live && setStats(Object.fromEntries(r.stats.map((s) => [s.scene_id, s]))))
        .catch(() => live && setStats({}));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, classKey, cm.dilate_m, aoi]);

  const problem = maskProblem(cm);
  const cur = scene ? stats[scene.id] : undefined;
  const toggleClass = (c: MaskClass) =>
    set({ classes: cm.classes.includes(c) ? cm.classes.filter((x) => x !== c) : [...cm.classes, c] });

  return (
    <div className="field cloudmask" data-testid="cloudmask">
      <span>Cloud masking (level piksel)</span>
      <label className="inline">
        <input type="checkbox" checked={cm.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Aktifkan mask dari SCL
      </label>

      {cm.enabled && (
        <>
          <div className="classes" role="group" aria-label="Kelas yang di-mask">
            {(Object.entries(config.mask_classes) as [MaskClass, string][]).map(([c, label]) => (
              <label key={c} className="inline">
                <input type="checkbox" checked={cm.classes.includes(c)} onChange={() => toggleClass(c)} /> {label}
              </label>
            ))}
          </div>
          <label className="inline">
            Perbesar area mask
            <select value={cm.dilate_m} onChange={(e) => set({ dilate_m: Number(e.target.value) })} aria-label="Perbesar area mask">
              {[0, 20, 40, 60, 100].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "tidak" : `${m} m`}
                </option>
              ))}
            </select>
          </label>
          {scene && (
            <p className="hint">
              Awan di AOI (SCL) pada citra ini:{" "}
              <strong data-testid="aoi-cloud-current">{cur?.cloud_pct != null ? `${cur.cloud_pct.toFixed(1)}%` : cur?.error ? "—" : "menghitung…"}</strong>{" "}
              (katalog: {scene.cloud_cover?.toFixed(1) ?? "—"}% untuk seluruh scene).
            </p>
          )}

          <label className="inline">
            <input type="checkbox" checked={cm.fill_from_previous} onChange={(e) => set({ fill_from_previous: e.target.checked, ...(batch && e.target.checked && cm.auto_previous === 0 ? { auto_previous: 1 } : {}) })} />{" "}
            Isi piksel ter-mask dari citra sebelumnya
          </label>

          {cm.fill_from_previous && (
            <div className="prevbox">
              <label className="inline">
                Pemilihan
                <select
                  aria-label="Pemilihan citra sebelumnya"
                  value={cm.auto_previous}
                  onChange={(e) => set({ auto_previous: Number(e.target.value), previous_scene_ids: [] })}
                >
                  {!batch && <option value={0}>Manual (pilih sendiri)</option>}
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Otomatis: {n} terdekat{n > 1 ? " (komposit)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline">
                Cari sampai
                <select value={cm.auto_lookback_days} onChange={(e) => set({ auto_lookback_days: Number(e.target.value) })} aria-label="Rentang mundur">
                  {LOOKBACKS.map((d) => (
                    <option key={d} value={d}>
                      {d} hari sebelumnya
                    </option>
                  ))}
                </select>
              </label>

              {auto && <p className="hint">Dipilih otomatis per scene: tile yang sama lebih dulu, lalu yang terdekat waktunya. Gagal untuk scene yang tak punya pendahulu.</p>}

              {wantPrev && (
                <>
                  {loading && <p className="hint">Mencari citra sebelumnya…</p>}
                  {error && <p className="msg error" role="alert">{error}</p>}
                  {!loading && !error && cands.length === 0 && message && <p className="msg warn" data-testid="no-previous">{message}</p>}
                  <p className="hint">Klik untuk memilih (maks 5). Urutan klik = prioritas; pilih yang terdekat lebih dulu.</p>
                  <ul className="prev-list">
                    {cands.map((c) => {
                      const order = cm.previous_scene_ids.indexOf(c.id) + 1;
                      const st = stats[c.id];
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            className={"prev" + (order ? " on" : "")}
                            aria-pressed={order > 0}
                            onClick={() => set({ previous_scene_ids: togglePrevious(cm.previous_scene_ids, c.id) })}
                            data-testid="prev-candidate"
                          >
                            <span className="badge">{order || ""}</span>
                            <span className="grow">
                              <strong>{formatDate(c.date)}</strong> · {c.days_before} hari sebelumnya
                              <small>
                                Tile {c.tile ?? "—"}
                                {!c.same_tile && " (beda tile)"} · katalog {c.cloud_cover?.toFixed(1) ?? "—"}% · di AOI{" "}
                                {st?.cloud_pct != null ? `${st.cloud_pct.toFixed(1)}%` : st?.error ? "—" : "…"}
                                {c.aoi_coverage_pct != null && c.aoi_coverage_pct < 100 && ` · menutupi ${c.aoi_coverage_pct}% AOI`}
                              </small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          <label className="inline">
            <input type="checkbox" checked={cm.include_qa} onChange={(e) => set({ include_qa: e.target.checked })} /> Sertakan peta QA (asal tiap piksel)
          </label>

          <p className="msg info">{methodLabel(cm)}. Piksel yang tetap berawan di semua citra menjadi NoData.</p>
          {problem && <p className="msg warn" data-testid="mask-problem">{problem}</p>}

          {!batch && (
            <button type="button" className="btn" disabled={!!problem || previewing} onClick={onPreview} data-testid="preview-mask">
              {previewing ? "Memuat…" : "Pratinjau hasil di peta"}
            </button>
          )}
          {previewStats && (
            <p className="hint" data-testid="mask-preview-stats">
              Pratinjau: ter-mask {previewStats.masked_pct.toFixed(1)}% · terisi {previewStats.filled_pct.toFixed(1)}% · sisa NoData{" "}
              {previewStats.unfilled_masked_pct.toFixed(1)}% (magenta di peta).
            </p>
          )}
        </>
      )}
    </div>
  );
}
