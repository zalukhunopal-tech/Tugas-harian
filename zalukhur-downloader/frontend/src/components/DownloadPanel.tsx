import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { PRESET_LABELS, presetMatches, resampleNotes, toggleBand } from "../lib/bands";
import { formatDate } from "../lib/dates";
import type { AOIInfo, AppConfig, DownloadOptions, Job, Scene } from "../types";

interface Props {
  config: AppConfig;
  scene: Scene;
  aoi: AOIInfo;
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Dalam antrean",
  DOWNLOADING: "Mengunduh & memotong",
  PROCESSING: "Memproses",
  CROPPING: "Memotong",
  GENERATING: "Membuat berkas",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

export default function DownloadPanel({ config, scene, aoi }: Props) {
  const [opts, setOpts] = useState<DownloadOptions>({
    bands: config.presets.rgb ?? ["B04", "B03", "B02"],
    resolution: 10,
    formats: ["geotiff", "cog"],
    mask_to_aoi: true,
    resampling: "auto",
    name: "AOI",
  });
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // scene/AOI berubah -> job lama tidak relevan lagi
  useEffect(() => {
    setJob(null);
    setError(null);
  }, [scene.id, aoi]);

  // polling job
  useEffect(() => {
    window.clearInterval(timer.current);
    if (!job || job.status === "COMPLETED" || job.status === "FAILED") return;
    const id = job.id;
    timer.current = window.setInterval(async () => {
      try {
        setJob(await api.job(id));
      } catch (e) {
        setError((e as Error).message);
        window.clearInterval(timer.current);
      }
    }, 1000);
    return () => window.clearInterval(timer.current);
  }, [job?.id, job?.status]);

  const notes = useMemo(() => resampleNotes(opts.bands, opts.resolution, config, opts.resampling), [opts.bands, opts.resolution, opts.resampling, config]);
  const resampled = notes.filter((n) => n.action !== "native");
  const busy = starting || (job != null && job.status !== "COMPLETED" && job.status !== "FAILED");
  const canStart = opts.bands.length > 0 && opts.formats.length > 0 && !busy;

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      setJob(await api.startDownload(scene.id, aoi.geometry, opts));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const toggleFormat = (f: "geotiff" | "cog") =>
    setOpts((o) => ({ ...o, formats: o.formats.includes(f) ? o.formats.filter((x) => x !== f) : [...o.formats, f] }));

  return (
    <section className="panel" aria-labelledby="h-dl">
      <h2 id="h-dl">
        <span className="step">5</span> Unduh
      </h2>
      <p className="hint">
        Scene {formatDate(scene.date)} · tile {scene.tile ?? "—"} · {scene.cloud_cover?.toFixed(1) ?? "—"}% awan
      </p>

      <div className="field">
        <span>Band</span>
        <div className="chips">
          {Object.entries(config.presets).map(([key, bands]) => (
            <button key={key} type="button" className={"chip" + (presetMatches(opts.bands, bands) ? " on" : "")} onClick={() => setOpts({ ...opts, bands })}>
              {PRESET_LABELS[key] ?? key}
            </button>
          ))}
        </div>
        <div className="bands" role="group" aria-label="Pilih band">
          {Object.entries(config.bands).map(([b, m]) => (
            <label key={b} className={"band" + (opts.bands.includes(b) ? " on" : "")} title={`${m.label} · ${m.native_res} m`}>
              <input type="checkbox" checked={opts.bands.includes(b)} onChange={() => setOpts({ ...opts, bands: toggleBand(opts.bands, b) })} />
              {b}
              <small>{m.native_res}m</small>
            </label>
          ))}
        </div>
        <p className="hint">Urutan band di berkas mengikuti urutan pemilihan: {opts.bands.join(", ") || "—"}</p>
      </div>

      <div className="field">
        <span>Resolusi</span>
        <div className="seg" role="radiogroup" aria-label="Resolusi keluaran">
          {config.resolutions.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={opts.resolution === r} className={opts.resolution === r ? "on" : ""} onClick={() => setOpts({ ...opts, resolution: r })}>
              {r} m
            </button>
          ))}
        </div>
        {resampled.length > 0 && (
          <p className="msg info" data-testid="resample-note">
            Resampling eksplisit dicatat di metadata:{" "}
            {resampled.map((n) => `${n.band} (${n.native} m → ${opts.resolution} m, ${n.method})`).join("; ")}.
          </p>
        )}
        <label className="inline">
          Metode resampling
          <select value={opts.resampling} onChange={(e) => setOpts({ ...opts, resampling: e.target.value })}>
            {config.resampling.map((m) => (
              <option key={m} value={m}>
                {m === "auto" ? "Otomatis (nearest naik, average turun)" : m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field">
        <span>Keluaran</span>
        <label className="inline">
          <input type="checkbox" checked={opts.formats.includes("geotiff")} onChange={() => toggleFormat("geotiff")} /> GeoTIFF
        </label>
        <label className="inline">
          <input type="checkbox" checked={opts.formats.includes("cog")} onChange={() => toggleFormat("cog")} /> Cloud Optimized GeoTIFF (COG)
        </label>
        <label className="inline">
          <input type="checkbox" checked={opts.mask_to_aoi} onChange={(e) => setOpts({ ...opts, mask_to_aoi: e.target.checked })} /> Kosongkan piksel di luar poligon AOI (NoData)
        </label>
        <label className="field">
          <span>Nama berkas</span>
          <input value={opts.name} maxLength={60} onChange={(e) => setOpts({ ...opts, name: e.target.value })} />
        </label>
        <p className="hint">Cloud masking level piksel akan tersedia di tahap berikutnya; hasil saat ini adalah crop AOI apa adanya.</p>
      </div>

      <button type="button" className="btn primary wide" disabled={!canStart} onClick={start} data-testid="start-download">
        {busy ? "Memproses…" : "Proses & unduh"}
      </button>
      {error && <p className="msg error" role="alert">{error}</p>}

      {job && (
        <div className="job" data-testid="job" data-status={job.status}>
          <div className="job-head">
            <strong>{STATUS_LABEL[job.status] ?? job.status}</strong>
            <span>{Math.round(job.progress * 100)}%</span>
          </div>
          <progress max={1} value={job.progress} aria-label="Progres pemrosesan" />
          <p className="hint">{job.message}</p>
          {job.status === "FAILED" && <p className="msg error" role="alert">{job.error ?? job.message}</p>}
          {job.status === "COMPLETED" && (
            <ul className="files" data-testid="files">
              {job.files.map((f) => (
                <li key={f.name}>
                  <a href={api.fileUrl(f.url)} download={f.name}>
                    ⬇ {f.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
