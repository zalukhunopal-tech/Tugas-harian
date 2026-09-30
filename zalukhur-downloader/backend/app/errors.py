"""Error aplikasi dengan kode mesin + pesan yang ditampilkan ke pengguna."""
from __future__ import annotations


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class AOIError(AppError):
    code = "invalid_aoi"
    status_code = 422


class CatalogError(AppError):
    code = "catalog_error"
    status_code = 502


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404


class ProcessingError(AppError):
    code = "processing_error"
    status_code = 422
