import { type DateFilters, type RelativeChoice } from "../lib/dates";

const CLOUD_PRESETS = [0, 5, 10, 20, 30, 50];

interface Props {
  filters: DateFilters;
  onFilters: (f: DateFilters) => void;
  cloud: number;
  onCloud: (c: number) => void;
}

const RELATIVE: { id: RelativeChoice; label: string }[] = [
  { id: "latest", label: "Citra terbaru" },
  { id: "7d", label: "7 hari terakhir" },
  { id: "30d", label: "30 hari terakhir" },
];

export default function FilterPanel({ filters, onFilters, cloud, onCloud }: Props) {
  const set = (patch: Partial<DateFilters>) => onFilters({ ...filters, ...patch });
  return (
    <section className="panel" aria-labelledby="h-filter">
      <h2 id="h-filter">
        <span className="step">3</span> Tanggal &amp; cloud cover
      </h2>

      <div className="seg" role="radiogroup" aria-label="Jenis filter tanggal">
        {(
          [
            ["range", "Rentang"],
            ["single", "Satu tanggal"],
            ["relative", "Relatif"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={filters.mode === m} className={filters.mode === m ? "on" : ""} onClick={() => set({ mode: m })}>
            {label}
          </button>
        ))}
      </div>

      {filters.mode === "range" && (
        <div className="grid2">
          <label className="field">
            <span>Mulai</span>
            <input type="date" value={filters.start} onChange={(e) => set({ start: e.target.value })} aria-label="Tanggal mulai" />
          </label>
          <label className="field">
            <span>Akhir</span>
            <input type="date" value={filters.end} onChange={(e) => set({ end: e.target.value })} aria-label="Tanggal akhir" />
          </label>
        </div>
      )}
      {filters.mode === "single" && (
        <label className="field">
          <span>Tanggal</span>
          <input type="date" value={filters.single} onChange={(e) => set({ single: e.target.value })} aria-label="Tanggal" />
        </label>
      )}
      {filters.mode === "relative" && (
        <>
          <div className="chips" role="radiogroup" aria-label="Rentang relatif">
            {RELATIVE.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={filters.relative === r.id} className={"chip" + (filters.relative === r.id ? " on" : "")} onClick={() => set({ relative: r.id })}>
                {r.label}
              </button>
            ))}
          </div>
          {filters.relative === "latest" && <p className="hint">Scene terbaru yang memenuhi batas cloud cover dalam 60 hari terakhir.</p>}
        </>
      )}

      <div className="field">
        <span>Maksimum cloud cover: <strong>{cloud}%</strong></span>
        <input type="range" min={0} max={100} step={1} value={cloud} onChange={(e) => onCloud(Number(e.target.value))} aria-label="Maksimum cloud cover" />
        <div className="chips">
          {CLOUD_PRESETS.map((c) => (
            <button key={c} type="button" className={"chip" + (cloud === c ? " on" : "")} onClick={() => onCloud(c)}>
              {c}%
            </button>
          ))}
          <label className="chip custom">
            Kustom
            <input type="number" min={0} max={100} value={cloud} onChange={(e) => onCloud(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} aria-label="Cloud cover kustom (%)" />
          </label>
        </div>
        <p className="hint">Cloud cover hanya penyaring awal (rata-rata seluruh scene). Awan tepat di atas AOI tetap mungkin ada.</p>
      </div>
    </section>
  );
}
