"""Job system sederhana: antrean + worker thread, status tersimpan di disk.

Status: QUEUED -> DOWNLOADING (menyiapkan grid AOI) -> PROCESSING (hanya bila cloud masking:
membaca SCL, mendeteksi awan, memilih piksel pengganti) -> CROPPING (baca window tiap band,
terapkan mask/isi, tulis) -> GENERATING (COG, peta QA, metadata) -> COMPLETED (atau FAILED).
"""
from __future__ import annotations

import json
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable

from app.errors import AppError, NotFoundError

STATUSES = ("QUEUED", "DOWNLOADING", "PROCESSING", "CROPPING", "GENERATING", "COMPLETED", "FAILED")
TERMINAL = ("COMPLETED", "FAILED")


@dataclass
class Job:
    id: str
    status: str = "QUEUED"
    progress: float = 0.0
    message: str = "Menunggu antrean"
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    scene_id: str | None = None
    files: list[str] = field(default_factory=list)
    metadata: dict[str, Any] | None = None
    error: str | None = None
    error_code: str | None = None

    def public(self) -> dict[str, Any]:
        d = asdict(self)
        d["files"] = [{"name": n, "url": f"/api/jobs/{self.id}/files/{n}"} for n in self.files]
        return d


class JobManager:
    def __init__(self, root: Path, workers: int = 2, ttl_hours: float = 24):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl_hours * 3600
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="job")
        self._recover()
        self.cleanup()

    # -- persistensi -------------------------------------------------------
    def dir(self, job_id: str) -> Path:
        return self.root / job_id

    def _save(self, job: Job) -> None:
        d = self.dir(job.id)
        d.mkdir(parents=True, exist_ok=True)
        tmp = d / "job.json.tmp"
        tmp.write_text(json.dumps(asdict(job)), encoding="utf-8")
        tmp.replace(d / "job.json")

    def _recover(self) -> None:
        for p in self.root.glob("*/job.json"):
            try:
                job = Job(**json.loads(p.read_text(encoding="utf-8")))
            except (ValueError, TypeError):
                continue
            if job.status not in TERMINAL:  # server mati saat job berjalan
                job.status, job.message = "FAILED", "Proses terhenti karena server dimulai ulang."
                job.error, job.error_code = job.message, "interrupted"
                self._save(job)
            self._jobs[job.id] = job

    def cleanup(self) -> None:
        now = time.time()
        with self._lock:
            for jid, job in list(self._jobs.items()):
                if job.status in TERMINAL and now - job.updated_at > self.ttl:
                    shutil.rmtree(self.dir(jid), ignore_errors=True)
                    del self._jobs[jid]

    # -- API ---------------------------------------------------------------
    def update(self, job_id: str, **changes: Any) -> None:
        with self._lock:
            job = self._jobs[job_id]
            for k, v in changes.items():
                setattr(job, k, v)
            job.updated_at = time.time()
            self._save(job)

    def get(self, job_id: str) -> Job:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            raise NotFoundError("Job tidak ditemukan atau sudah kedaluwarsa.")
        return job

    def submit(self, fn: Callable[[Path, Callable[[str, float, str], None]], dict[str, Any]], scene_id: str | None = None) -> Job:
        """Jalankan `fn(out_dir, progress)` di worker. `fn` mengembalikan metadata."""
        self.cleanup()
        job = Job(id=uuid.uuid4().hex, scene_id=scene_id)
        with self._lock:
            self._jobs[job.id] = job
            self._save(job)

        def progress(status: str, frac: float, message: str) -> None:
            self.update(job.id, status=status, progress=round(min(max(frac, 0.0), 1.0), 3), message=message)

        def run() -> None:
            try:
                meta = fn(self.dir(job.id), progress)
                files = list((meta.get("outputs") or {}).values())
                self.update(job.id, status="COMPLETED", progress=1.0, message="Selesai", files=files, metadata=meta)
            except AppError as exc:
                self.update(job.id, status="FAILED", message=exc.message, error=exc.message, error_code=exc.code)
            except Exception as exc:  # noqa: BLE001 - jangan bocorkan detail internal ke klien
                import logging

                logging.getLogger(__name__).exception("job %s gagal", job.id)
                msg = "Terjadi kesalahan saat memproses citra. Coba lagi atau perkecil AOI."
                self.update(job.id, status="FAILED", message=msg, error=msg, error_code="internal_error")
                del exc

        self._pool.submit(run)
        return job

    def file_path(self, job_id: str, name: str) -> Path:
        job = self.get(job_id)
        if job.status != "COMPLETED" or name not in job.files:
            raise NotFoundError("Berkas tidak ditemukan.")
        path = (self.dir(job_id) / name).resolve()
        if path.parent != self.dir(job_id).resolve() or not path.is_file():
            raise NotFoundError("Berkas tidak ditemukan.")
        return path

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)
