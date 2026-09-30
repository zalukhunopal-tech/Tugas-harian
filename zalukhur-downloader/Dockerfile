# ZalukhuR Downloader - satu image: backend FastAPI + UI hasil build.
#   docker build -t zalukhur-downloader .
#   docker run -p 8000:8000 -v zalukhur-data:/data zalukhur-downloader
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /web/dist ./frontend-dist
RUN useradd --create-home app && mkdir /data && chown app /data
USER app
ENV FRONTEND_DIST=/app/frontend-dist \
    DATA_DIR=/data \
    CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    PORT=8000
EXPOSE 8000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s/api/health' % os.environ['PORT'], timeout=4)"
# $PORT dipakai platform hosting (Render/Railway/Fly) bila menyediakannya
CMD ["sh", "-c", "exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT}"]
