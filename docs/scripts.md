# Scripts

- **dev.sh** — Starts backend and frontend dev servers concurrently. Ctrl+C stops both.
- **init.sh** — First-time Cloudflare setup: provisions D1, R2, KV; prints IDs to paste into `wrangler.toml`.
- **deploy.sh** — Builds frontend, applies migrations, deploys Worker + assets to Cloudflare.
- **db-init.ts** — Generates D1 seed SQL (admin user, tenant, membership).
