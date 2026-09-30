#!/usr/bin/env bash
# ZalukhuR Downloader - satu perintah untuk memasang dan menjalankan (backend + UI dalam satu server).
#
#   ./run.sh            pasang bila perlu, lalu jalankan di http://127.0.0.1:8000
#   ./run.sh setup      hanya pasang dependensi dan bangun UI
#   ./run.sh start      hanya jalankan (setelah setup)
#
# Variabel: HOST (bawaan 127.0.0.1), PORT (8000), serta semua pengaturan backend (lihat README).
set -euo pipefail
cd "$(dirname "$0")"

setup() {
  command -v python3 >/dev/null || { echo "python3 (>= 3.11) diperlukan" >&2; exit 1; }
  command -v npm >/dev/null || { echo "Node.js (>= 20) dan npm diperlukan" >&2; exit 1; }
  [ -d backend/.venv ] || python3 -m venv backend/.venv
  backend/.venv/bin/pip install --quiet --upgrade pip
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
  (cd frontend && npm ci --no-audit --no-fund && npm run build)
}

start() {
  [ -x backend/.venv/bin/python ] && [ -f frontend/dist/index.html ] || { echo "Belum dipasang. Jalankan: ./run.sh setup" >&2; exit 1; }
  export FRONTEND_DIST="${FRONTEND_DIST:-$PWD/frontend/dist}"
  export DATA_DIR="${DATA_DIR:-$PWD/backend/data}"
  echo "ZalukhuR Downloader: http://${HOST:-127.0.0.1}:${PORT:-8000}"
  exec backend/.venv/bin/python -m uvicorn app.main:create_app --factory --app-dir backend \
    --host "${HOST:-127.0.0.1}" --port "${PORT:-8000}"
}

case "${1:-all}" in
  setup) setup ;;
  start) start ;;
  all) { [ -x backend/.venv/bin/python ] && [ -f frontend/dist/index.html ]; } || setup; start ;;
  *) echo "Pemakaian: $0 [setup|start]" >&2; exit 2 ;;
esac
