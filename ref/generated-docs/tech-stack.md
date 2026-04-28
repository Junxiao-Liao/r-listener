## Architecture

- Single Cloudflare Worker hosts the whole app.
    - Hono routes are mounted under `/api/*` in `backend/src/app.ts` and own all
      D1 / R2 / KV bindings.
    - The same Worker serves the SvelteKit static SPA via the `[assets]`
      binding. Non-`/api` paths fall back to `index.html`.
    - One origin → first-party session cookie, no CORS.
- Group files by feature.
    - Backend feature: `repository` `orm` `dto` `service` `route` (no BFF layer).
    - Frontend: `pages/` under which each page (feature) is self-contained;
      route shells under `src/routes/` are thin and delegate to `$pages/...`.
- Frontend state is centralized in TanStack Query (`@tanstack/svelte-query`).
    - One query per backend resource (`useSession`, `useUpdatePreferences`,
      `useAdminTenants`, …) lives in `src/shared/query/*`. Mutations invalidate
      or `setQueryData` the right keys.
    - The browser-side fetch wrapper is `src/shared/api/client.ts` — calls
      `/api/...` (relative URL, browser sends the cookie automatically) and
      throws `ApiError` on non-2xx.
    - UI-only state stays in module-scoped `$state` runes. No hand-rolled
      stores for server data.
- Pure SPA. `svelte.config.js` uses `@sveltejs/adapter-static` with
  `fallback: 'index.html'`. SSR/prerendering are disabled in
  `src/routes/+layout.ts`.
- Theme/locale FOUC is handled by an inline `<head>` script in `app.html`
  that reads the `theme` and `PARAGLIDE_LOCALE` cookies before first paint.
  DB remains the cross-device source of truth; cookies are written by client
  JS after a successful prefs save.
- Use existing ecosystem rather than build from scratch.

## Repo layout
  frontend/ and backend/ as independent npm projects (no workspace).
  Both ship as a single Cloudflare Worker — the backend Worker also serves
  the built SPA via the [assets] binding.
  See generated-docs/impl-plan.md for the full-app execution plan.

Frontend (frontend/):
  SvelteKit + TypeScript, pure SPA via @sveltejs/adapter-static
  Tailwind CSS + shadcn-svelte
  Paraglide JS for i18n (en, zh) — client-side cookie strategy
  Server state: TanStack Query (@tanstack/svelte-query) — one query per
  backend resource in src/shared/query/*; mutations invalidate the cache
  UI state: Svelte 5 $state runes
  Browser-side fetch: src/shared/api/client.ts (calls /api/... relative URL)
  No SSR, no BFF, no +page.server.ts / +server.ts files

Backend (backend/):
  Hono on Cloudflare Workers under /api/*
  Single Worker also serves the built SPA from frontend/build/ via
  the [assets] binding (not_found_handling = single-page-application).
  Owns all D1 / R2 / KV bindings and domain logic
  Sets the session cookie directly (HttpOnly; Secure; SameSite=Lax; Path=/)

Database:
  Cloudflare D1

ORM:
  Drizzle ORM (in backend)

Object Storage:
  Cloudflare R2 (in backend)

Auth:
  HttpOnly cookie session (set and rolled by the backend; first-party — same
  origin as the SPA).
  argon2id via hash-wasm (Workers-compatible; not @node-rs/argon2)
  Session tokens: random base32 on the wire, SHA-256 hashed at rest
  Sessions persisted in D1
  No CORS, no Origin enforcement — same origin removes both concerns

Queue:
  Persisted in D1 per user and active tenant
  Backend exposes CRUD-style /api/queue routes
  Frontend player treats backend queue state as durable cross-device state

Cache:
  Cloudflare KV (in backend)

Jobs:
  Later: Cloudflare Queues + Cron Triggers

Validation:
  Zod for runtime request/DTO validation (backend) and form validation (frontend)

Deployment:
  Single Cloudflare Worker (Hono /api/* + ASSETS for the SPA)
  Wrangler — one wrangler.toml in backend/
  GitHub Actions: builds the frontend then runs `wrangler deploy`

Tests:
  Vitest for backend and frontend unit/service coverage
  Playwright for critical mobile-first browser flows

Bootstrap:
  First admin, first tenant, and initial owner membership are created by
  manual SQL. Do not add an application seed command.

Domain:
  Start with workers.dev (free).
  Buy custom domain only when public/long-term.
