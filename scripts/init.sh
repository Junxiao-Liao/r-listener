#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== r-listener: first-time setup ==="
echo ""

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
(cd "${ROOT_DIR}/frontend" && npm ci)
(cd "${ROOT_DIR}/backend" && npm ci)
echo "       Done."
echo ""

# 2. Authenticate with Cloudflare
echo "[2/6] Authenticating with Cloudflare..."
echo "       If you haven't logged in yet, a browser window will open."
echo "       Otherwise this will just confirm your existing session."
(cd "${ROOT_DIR}/backend" && npx wrangler whoami > /dev/null 2>&1) || \
	(cd "${ROOT_DIR}/backend" && npx wrangler login)
echo "       Done."
echo ""

# 3. Provision D1 database
echo "[3/6] Provisioning D1 database 'r-listener'..."
D1_OUTPUT=$(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run setup:d1 --silent 2>&1) || true
DATABASE_ID=$(echo "${D1_OUTPUT}" | grep -oP 'database_id\s*=\s*"([^"]+)"' | grep -oP '"[^"]+"' | tr -d '"' || true)
if [[ -n "${DATABASE_ID}" ]]; then
	echo "       database_id = \"${DATABASE_ID}\""
	echo "       → Paste this into backend/wrangler.toml under [[d1_databases]].database_id"
elif echo "${D1_OUTPUT}" | grep -qi 'already exists'; then
	echo "       D1 database already exists. Make sure database_id is set in wrangler.toml."
else
	echo "       D1 output (copy the database_id):"
	echo "${D1_OUTPUT}"
fi
echo ""

# 4. Provision R2 bucket
echo "[4/6] Provisioning R2 bucket 'r-listener-audio'..."
(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run setup:r2 --silent 2>&1) || true
echo "       Done (bucket name is already set in wrangler.toml)."
echo ""

# 5. Provision KV namespace
echo "[5/6] Provisioning KV namespace 'r-listener-cache'..."
KV_OUTPUT=$(cd "${ROOT_DIR}/backend" && WRANGLER_LOG_PATH=.wrangler/logs npm run setup:kv --silent 2>&1) || true
KV_ID=$(echo "${KV_OUTPUT}" | grep -oP 'id\s*=\s*"([^"]+)"' | grep -oP '"[^"]+"' | tr -d '"' || true)
if [[ -n "${KV_ID}" ]]; then
	echo "       id = \"${KV_ID}\""
	echo "       → Paste this into backend/wrangler.toml under [[kv_namespaces]].id"
elif echo "${KV_OUTPUT}" | grep -qi 'already exists'; then
	echo "       KV namespace already exists. Make sure id is set in wrangler.toml."
else
	echo "       KV output (copy the id):"
	echo "${KV_OUTPUT}"
fi
echo ""

# 6. Remind about secrets
echo "[6/6] Reminder: set production secrets —"
echo "       echo \"your-production-secret\" | npx wrangler secret put SESSION_SECRET"
echo ""

echo "=== Setup complete ==="
echo "After updating wrangler.toml and setting SESSION_SECRET, run: scripts/deploy.sh"
