Repo layout:
  frontend/ and backend/ as independent npm projects (no workspace)
  See generated-docs/architect.md for how they fit together.

Frontend (frontend/):
  SvelteKit + TypeScript
  Tailwind CSS + shadcn-svelte
  Paraglide JS for i18n (en, zh)
  Deploys to Cloudflare Pages via adapter-cloudflare
  Thin BFF layer in server routes — proxies to backend, forwards session cookie

Backend (backend/):
  Hono on Cloudflare Workers
  Standalone Worker (not SvelteKit server routes)
  Owns all D1 / R2 / KV bindings and domain logic

Database:
  Cloudflare D1

ORM:
  Drizzle ORM (in backend)

Object Storage:
  Cloudflare R2 (in backend)

Auth:
  HttpOnly cookie session (set by frontend, validated by backend)
  argon2id via hash-wasm (Workers-compatible; not @node-rs/argon2)
  Session tokens: random base32 on the wire, SHA-256 hashed at rest
  Sessions persisted in D1

Cache:
  Cloudflare KV (in backend)

Jobs:
  Later: Cloudflare Queues + Cron Triggers

Deployment:
  Cloudflare Pages (frontend) + Cloudflare Workers (backend)
  Wrangler
  GitHub Actions

Domain:
  Start with pages.dev / workers.dev
  Buy custom domain only when public/long-term
