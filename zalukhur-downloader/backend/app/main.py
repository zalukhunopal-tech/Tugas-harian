from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import aoi, batch, download, geocode, processing, query
from app.config import Settings, get_settings
from app.errors import AppError
from app.batches import BatchManager
from app.jobs import JobManager
from app.services.catalog import StacCatalog

log = logging.getLogger("zalukhur")


def create_app(settings: Settings | None = None, catalog: StacCatalog | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        app.state.jobs.shutdown()

    app = FastAPI(title="ZalukhuR Downloader API", version="1.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.catalog = catalog or StacCatalog(settings)
    app.state.jobs = JobManager(settings.data_dir / "jobs", settings.job_workers, settings.job_ttl_hours)
    app.state.batches = BatchManager(settings.data_dir / "batches", app.state.jobs, settings.job_ttl_hours)

    app.add_middleware(
        CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST"], allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "detail": exc.message})

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        msgs = []
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", []) if p != "body")
            msg = str(e.get("msg", "")).removeprefix("Value error, ")
            msgs.append(f"{loc}: {msg}" if loc else msg)
        return JSONResponse(status_code=422, content={"code": "validation_error", "detail": "; ".join(msgs)})

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    for r in (aoi.router, query.router, processing.router, download.router, batch.router, geocode.router):
        app.include_router(r)

    if settings.frontend_dist and settings.frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
    return app

