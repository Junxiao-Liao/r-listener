#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

echo "Starting backend on http://127.0.0.1:8787"
(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run dev) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:5173"
(cd "${ROOT_DIR}/frontend" && npm run dev) &
FRONTEND_PID=$!

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
