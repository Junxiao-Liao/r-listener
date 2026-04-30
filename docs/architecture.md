# Architecture & Tech Stack

## Architecture

- **Single Cloudflare Worker hosts the whole app.**
    - Hono routes are mounted under `/api/*` in `backend/src/app.ts` and own all
      D1 / R2 / KV bindings.
    - The same Worker serves the SvelteKit static SPA via the `[assets]`
      binding. Non-`/api` paths fall back to `index.html`.
    - One origin → first-party session cookie, no CORS.
- **Group files by feature.**
    - Backend feature: `repository` `orm` `dto` `service` `route` (no BFF layer).
    - Frontend: `pages/` under which each page (feature) is self-contained;
      route shells under `src/routes/` are thin and delegate to `$pages/...`.
- **Frontend state is centralized in TanStack Query (`@tanstack/svelte-query`).**
    - One query per backend resource (`useSession`, `useUpdatePreferences`,
      `useAdminTenants`, …) lives in `src/shared/query/*`. Mutations invalidate
      or `setQueryData` the right keys.
    - The browser-side fetch wrapper is `src/shared/api/client.ts` — calls
      `/api/...` (relative URL, browser sends the cookie automatically) and
      throws `ApiError` on non-2xx.
    - UI-only state stays in module-scoped `$state` runes. No hand-rolled
      stores for server data.
- **Pure SPA.** `svelte.config.js` uses `@sveltejs/adapter-static` with
  `fallback: 'index.html'`. SSR/prerendering are disabled in
  `src/routes/+layout.ts`.
- **Theme/locale FOUC** is handled by an inline `<head>` script in `app.html`
  that reads the `theme` and `PARAGLIDE_LOCALE` cookies before first paint.
  DB remains the cross-device source of truth; cookies are written by client
  JS after a successful prefs save.

## Rules
- Preserve feature grouping required by `AGENTS.md`.
- Backend features use `repository`, `orm`, `dto`, `service`, and `route`.
- Frontend feature pages stay self-contained under `frontend/src/pages`.
  SvelteKit `frontend/src/routes` files should be thin wrappers/loaders that
  call into those page modules.
- Keep services mostly functional: dependencies in, typed input in, typed result
  or domain error out.
- Keep routes thin: parse input, call service, adapt result to HTTP.

## Repo layout
- `frontend/` and `backend/` as independent npm projects (no workspace).
- Both ship as a single Cloudflare Worker.

### Frontend (`frontend/`)
- SvelteKit + TypeScript, pure SPA via `@sveltejs/adapter-static`
- Tailwind CSS + shadcn-svelte
- Paraglide JS for i18n (en, zh) — client-side cookie strategy
- Server state: TanStack Query (`@tanstack/svelte-query`) — one query per backend resource; mutations invalidate the cache
- UI state: Svelte 5 `$state` runes
- Browser-side fetch: `src/shared/api/client.ts`
- No SSR, no BFF, no `+page.server.ts` / `+server.ts` files

### Backend (`backend/`)
- Hono on Cloudflare Workers under `/api/*`
- Serves the built SPA from `frontend/build/` via the `[assets]` binding.
- Owns all D1 / R2 / KV bindings and domain logic
- Sets the session cookie directly (HttpOnly; Secure; SameSite=Lax; Path=/)

### Infrastructure
- **Database:** Cloudflare D1
- **ORM:** Drizzle ORM
- **Object Storage:** Cloudflare R2
- **Auth:** HttpOnly cookie session (set and rolled by backend; first-party). `argon2id` via hash-wasm. Sessions persisted in D1.
- **Queue:** Persisted in D1 per user and active tenant. Backend exposes CRUD-style `/api/queue` routes. Frontend treats queue state as durable cross-device state.
- **Cache:** Cloudflare KV
- **Validation:** Zod for runtime request/DTO validation (backend) and form validation (frontend)
- **Deployment:** Single Cloudflare Worker. GitHub Actions builds frontend then runs `wrangler deploy`.
- **Tests:** Vitest (unit/service) and Playwright (browser flows against `vite preview` + mock `/api/*`).
- **Bootstrap:** First admin, first tenant, and initial owner membership are created by manual SQL.
