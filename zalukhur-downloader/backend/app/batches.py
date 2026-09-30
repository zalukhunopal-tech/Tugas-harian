"""Batch processing: satu AOI + satu set opsi diterapkan ke banyak scene, satu job per scene.

Setiap job berjalan di antrean JobManager yang sama (paralelisme dibatasi JOB_WORKERS), gagal/berhasil
sendiri-sendiri, dan hasilnya bisa diunduh sekaligus sebagai satu ZIP.
"""
from __future__ import annotations

import json
import shutil
import threading
import time
import uuid
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable

from app.errors import NotFoundError
from app.jobs import TERMINAL, JobManager


@dataclass
class Batch:
    id: str
    scene_ids: list[str]
    job_ids: list[str]
    created_at: float = field(default_factory=time.time)


class BatchManager:
    def __init__(self, root: Path, jobs: JobManager, ttl_hours: float = 24):
        self.root, self.jobs, self.ttl = root, jobs, ttl_hours * 3600
        self.root.mkdir(parents=True, exist_ok=True)
        self._batches: dict[str, Batch] = {}
        self._lock = threading.Lock()
        for p in self.root.glob("*/batch.json"):
            try:
                b = Batch(**json.loads(p.read_text(encoding="utf-8")))
                self._batches[b.id] = b
            except (ValueError, TypeError):
                continue
        self.cleanup()

    def cleanup(self) -> None:
        now = time.time()
        with self._lock:
            for bid, b in list(self._batches.items()):
                if now - b.created_at > self.ttl:
                    shutil.rmtree(self.root / bid, ignore_errors=True)
                    del self._batches[bid]

    def create(self, scene_ids: list[str], make_work: Callable[[str], Callable[..., dict[str, Any]]]) -> Batch:
        self.cleanup()
        job_ids = [self.jobs.submit(make_work(sid), scene_id=sid).id for sid in scene_ids]
        b = Batch(id=uuid.uuid4().hex, scene_ids=list(scene_ids), job_ids=job_ids)
        with self._lock:
            self._batches[b.id] = b
        d = self.root / b.id
        d.mkdir(parents=True, exist_ok=True)
        (d / "batch.json").write_text(json.dumps(asdict(b)), encoding="utf-8")
        return b

    def _get(self, batch_id: str) -> Batch:
        with self._lock:
            b = self._batches.get(batch_id)
        if b is None:
            raise NotFoundError("Batch tidak ditemukan atau sudah kedaluwarsa.")
        return b

    def summary(self, batch_id: str) -> dict[str, Any]:
        b = self._get(batch_id)
        jobs = []
        for jid, sid in zip(b.job_ids, b.scene_ids):
            try:
                jobs.append(self.jobs.get(jid).public())
            except NotFoundError:
                jobs.append({"id": jid, "scene_id": sid, "status": "FAILED", "progress": 1.0, "files": [],
                             "message": "Hasil sudah kedaluwarsa.", "error": "Hasil sudah kedaluwarsa."})
        done = sum(j["status"] == "COMPLETED" for j in jobs)
        failed = sum(j["status"] == "FAILED" for j in jobs)
        running = len(jobs) - done - failed
        if running:
            status = "RUNNING"
        elif failed == 0:
            status = "COMPLETED"
        elif done == 0:
            status = "FAILED"
        else:
            status = "COMPLETED_WITH_ERRORS"
        return {
            "id": b.id, "status": status, "total": len(jobs), "completed": done, "failed": failed,
            "progress": round(sum(j["progress"] for j in jobs) / max(len(jobs), 1), 3), "jobs": jobs,
            "zip_url": f"/api/batches/{b.id}/download.zip" if done else None,
        }

    def zip_path(self, batch_id: str) -> Path:
        """ZIP semua hasil yang sudah selesai, satu folder per scene. Dibuat ulang bila jumlah hasil berubah."""
        b = self._get(batch_id)
        entries: list[tuple[Path, str]] = []
        for jid, sid in zip(b.job_ids, b.scene_ids):
            try:
                job = self.jobs.get(jid)
            except NotFoundError:
                continue
            if job.status != "COMPLETED":
                continue
            for name in job.files:
                entries.append((self.jobs.file_path(jid, name), f"{sid}/{name}"))
        if not entries:
            raise NotFoundError("Belum ada hasil yang selesai untuk diunduh.")
        target = self.root / b.id / f"bundle_{len(entries)}.zip"
        if not target.exists():
            for old in target.parent.glob("bundle_*.zip"):
                old.unlink(missing_ok=True)
            tmp = target.with_suffix(".tmp")
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as zf:  # TIFF sudah terkompresi
                for path, arc in entries:
                    zf.write(path, arc)
            tmp.replace(target)
        return target

    @staticmethod
    def terminal(summary: dict[str, Any]) -> bool:
        return all(j["status"] in TERMINAL for j in summary["jobs"])
