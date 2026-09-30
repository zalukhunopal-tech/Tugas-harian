import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { BATCH_LABEL } from "../lib/indices";
import type { Batch, Scene } from "../types";

const JOB_LABEL: Record<string, string> = {
  QUEUED: "Antre", DOWNLOADING: "Mengunduh", PROCESSING: "Memproses", CROPPING: "Memotong", GENERATING: "Membuat berkas",
  COMPLETED: "Selesai", FAILED: "Gagal",
};

export default function BatchPanel({ batchId, scenes }: { batchId: string; scenes: Scene[] }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const b = await api.batch(batchId);
        if (!live) return;
        setBatch(b);
        if (b.status !== "RUNNING") window.clearInterval(timer.current);
      } catch (e) {
        if (live) setError((e as Error).message);
        window.clearInterval(timer.current);
      }
    };
    void tick();
    timer.current = window.setInterval(tick, 1500);
    return () => {
      live = false;
      window.clearInterval(timer.current);
    };
  }, [batchId]);

  if (error) return <p className="msg error" role="alert">{error}</p>;
  if (!batch) return <p className="hint">Memulai batch…</p>;
  return (
    <div className="job" data-testid="batch" data-status={batch.status}>
      <div className="job-head">
        <strong>
          {BATCH_LABEL[batch.status] ?? batch.status}: {batch.completed}/{batch.total} selesai{batch.failed ? `, ${batch.failed} gagal` : ""}
        </strong>
        <span>{Math.round(batch.progress * 100)}%</span>
      </div>
      <progress max={1} value={batch.progress} aria-label="Progres batch" />
      <ul className="batch-jobs">
        {batch.jobs.map((j) => (
          <li key={j.id} data-testid="batch-job" data-status={j.status}>
            <span className="grow">
              <strong>{byId[j.scene_id ?? ""]?.date ?? j.scene_id}</strong>
              <small>{j.status === "FAILED" ? j.error ?? j.message : j.message}</small>
            </span>
            <span className={"jstat " + j.status.toLowerCase()}>{JOB_LABEL[j.status] ?? j.status}</span>
          </li>
        ))}
      </ul>
      {batch.zip_url && batch.status !== "RUNNING" && (
        <a className="btn primary wide center" href={api.fileUrl(batch.zip_url)} download data-testid="batch-zip">
          ⬇ Unduh semua hasil (ZIP)
        </a>
      )}
    </div>
  );
}
