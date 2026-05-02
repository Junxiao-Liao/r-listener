# Overview

## Architecture

- **Single Cloudflare Worker** hosts the entire app.
  - Hono routes under `/api/*` own D1 and R2 bindings.
  - Same Worker serves the SvelteKit static SPA via `[assets]` binding.
  - One origin → first-party session cookie, no CORS.
- **Pure SPA.** No SSR, no BFF, no `+page.server.ts` files.
- **Feature-grouped files.** Backend: `repository`, `orm`, `dto`, `service`, `route`. Frontend: `pages/` with thin route shells in `src/routes/`.
- **Frontend state** centralized in TanStack Query. UI state in Svelte 5 `$state` runes. Browser-side fetch via `src/shared/api/client.ts`.

## Tech Stack

| Layer    | Choices |
|----------|---------|
| Runtime  | Cloudflare Workers |
| Backend  | Hono, Zod (validation), Drizzle ORM |
| Frontend | SvelteKit + TypeScript, Tailwind CSS, shadcn-svelte |
| i18n     | Paraglide JS (en, zh) |
| DB       | Cloudflare D1 (SQLite) |
| Storage  | Cloudflare R2 (audio, cover art) |
| Auth     | HttpOnly session cookie with hashed tokens stored in D1 |
| Tests    | Vitest (unit/service) |
| Deploy   | GitHub Actions → `wrangler deploy` |

## Key Conventions

- **IDs:** Opaque prefixed UUIDv7 (`usr_`, `tnt_`, `trk_`, `pls_`, etc.)
- **Cursor encoding:** `shared/cursor.ts` provides `encodeBase64Cursor`/`decodeBase64Cursor` for UTF-8-safe base64 pagination cursors (handles non-Latin1 text like Chinese via `encodeURIComponent` + `btoa`)
- **Time:** Unix seconds in D1, ISO-8601 on the wire
- **Soft delete:** `deleted_at` column on domain rows; reads filter it out
- **Tenant scoping:** Every tenant-scoped resource has `tenant_id` FK; cross-tenant visibility is never granted
- **Authz roles:** Platform admin → Tenant owner/member/viewer; viewers read-only on shared content
