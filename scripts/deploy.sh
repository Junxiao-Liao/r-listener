#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== r-listener: deploy ==="

# 1. Build frontend
echo "[1/4] Building frontend..."
(cd "${ROOT_DIR}/frontend" && npm ci && npm run build)
echo "       Done."
echo ""

# 2. Install backend dependencies
echo "[2/4] Installing backend dependencies..."
(cd "${ROOT_DIR}/backend" && npm ci)
echo "       Done."
echo ""

# 3. Apply database migrations
echo "[3/4] Applying D1 migrations..."
(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run db:migrate)
echo "       Done."
echo ""

# 4. Deploy worker + assets
echo "[4/4] Deploying worker and assets..."
(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run deploy)
echo "       Done."
echo ""

echo "=== Deploy complete ==="
