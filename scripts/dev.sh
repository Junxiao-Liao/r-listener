#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
	if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
		kill "${BACKEND_PID}" 2>/dev/null || true
	fi
	if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
		kill "${FRONTEND_PID}" 2>/dev/null || true
	fi
	wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

# wrangler dev resolves the [assets] directory eagerly. Make sure it exists
# (an empty placeholder is fine — in dev the browser hits Vite at :5173 and
# proxies /api to the backend, so the ASSETS binding is unused).
mkdir -p "${ROOT_DIR}/frontend/build"
[[ -f "${ROOT_DIR}/frontend/build/index.html" ]] || \
	printf '<!doctype html><meta charset=utf-8><title>dev</title>SPA dev — open http://localhost:5173' \
		> "${ROOT_DIR}/frontend/build/index.html"

echo "Starting backend (Hono + ASSETS) on http://127.0.0.1:8787"
(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run dev) &
BACKEND_PID=$!

echo "Starting frontend (vite, /api proxied to :8787) on http://localhost:5173"
(cd "${ROOT_DIR}/frontend" && npm run dev) &
FRONTEND_PID=$!

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
