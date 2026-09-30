import { formatDate } from "../lib/dates";
import type { PreviewMode, SearchResponse, Scene } from "../types";

interface Props {
  result: SearchResponse | null;
  selectedId: string | null;
  previewId: string | null;
  previewLoading: string | null;
  previewMode: PreviewMode;
  onPreviewMode: (m: PreviewMode) => void;
  onPreview: (s: Scene) => void;
  onSelect: (s: Scene) => void;
  previewError: string | null;
}

export default function SceneList(p: Props) {
  if (!p.result) return null;
  const r = p.result;
  return (
    <section className="panel" aria-labelledby="h-scenes">
      <h2 id="h-scenes">
        <span className="step">4</span> Scene ditemukan: <span data-testid="scene-count">{r.count}</span>
      </h2>

      {r.count === 0 && (
        <p className="msg warn" data-testid="no-scenes">
          {r.message}
          {r.min_cloud_cover_available != null && ` Cloud cover terendah yang tersedia: ${r.min_cloud_cover_available}%.`}
        </p>
      )}
      {r.truncated && <p className="msg info">Hasil dibatasi. Persempit rentang tanggal untuk melihat semua scene.</p>}

      {r.count > 0 && (
        <div className="seg small" role="radiogroup" aria-label="Mode preview">
          {(
            [
              ["true_color", "True color"],
              ["false_color", "False color"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={p.previewMode === m} className={p.previewMode === m ? "on" : ""} onClick={() => p.onPreviewMode(m)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {p.previewError && <p className="msg error">{p.previewError}</p>}

      <ul className="scenes">
        {r.scenes.map((s) => (
          <li key={s.id} className={"scene" + (s.id === p.selectedId ? " selected" : "")} data-testid="scene-card">
            <div className="scene-head">
              <strong>{formatDate(s.date)}</strong>
              <span className={"cloud " + cloudClass(s.cloud_cover)}>{s.cloud_cover == null ? "—" : `${s.cloud_cover.toFixed(1)}%`} awan</span>
            </div>
            <div className="scene-meta">
              Tile {s.tile ?? "—"} · {s.product_level} · {s.platform ?? "Sentinel-2"}
              {s.aoi_coverage_pct != null && s.aoi_coverage_pct < 100 && (
                <span className="warn-text"> · hanya menutupi {s.aoi_coverage_pct}% AOI</span>
              )}
            </div>
            <div className="btn-row">
              <button type="button" className={"btn" + (p.previewId === s.id ? " active" : "")} disabled={p.previewLoading === s.id} onClick={() => p.onPreview(s)}>
                {p.previewLoading === s.id ? "Memuat…" : p.previewId === s.id ? "Sembunyikan" : "Preview"}
              </button>
              <button type="button" className={"btn primary"} onClick={() => p.onSelect(s)} aria-pressed={s.id === p.selectedId}>
                {s.id === p.selectedId ? "Dipilih ✓" : "Pilih"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function cloudClass(c: number | null) {
  if (c == null) return "";
  return c <= 10 ? "low" : c <= 30 ? "mid" : "high";
}
