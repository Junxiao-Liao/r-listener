> AI generated

# r-listener

Self-hosted, multi-tenant music streaming server — a private Spotify-like platform running on Cloudflare.

## Features

- **Upload & stream audio** — upload tracks with metadata, cover art, and synced lyrics (LRC)
- **Playlists** — create, reorder (drag-and-drop), and share playlists within a tenant
- **Playback queue** — persistent per-user queue with position-based ordering
- **Multi-tenant** — isolated tenants with owner/member/viewer roles
- **Admin panel** — manage users, tenants, memberships, and tracks
- **Browser player** — custom audio player with Media Session API integration
- **Continue listening** — recently played and progress tracking across sessions
- **i18n** — English and Chinese support

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Backend | Hono v4 + Drizzle ORM + Zod v4 |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Frontend | SvelteKit v2 (SPA) + Svelte 5 (runes) + TanStack Query v5 |
| Styling | Tailwind CSS v4 + bits-ui |
| Auth | HttpOnly session cookies, scrypt password hashing |

## Quick Start

```bash
# 1. Install dependencies
cd backend  && npm install
cd frontend && npm install

# 2. Set up Cloudflare resources (D1 + R2)
bash scripts/init.sh
# → Update backend/wrangler.toml with the output IDs

# 3. Run database migrations
cd backend && npm run db:migrate:local

# 4. Start dev servers
bash scripts/dev.sh
# → Backend at http://127.0.0.1:8787
# → Frontend at http://127.0.0.1:5173
```

## Project Structure

```
├── backend/          # Hono API worker (TS)
│   ├── src/
│   │   ├── auth/     # Sign-in/sign-out, sessions, password hashing
│   │   ├── tracks/   # Upload, metadata, lyrics, streaming
│   │   ├── playlists/
│   │   ├── queue/
│   │   ├── playback/
│   │   ├── admin/    # Platform admin
│   │   └── middleware/
│   └── migrations/   # D1 schema migrations
├── frontend/         # SvelteKit SPA (TS)
│   └── src/
│       ├── routes/    # Page components
│       ├── lib/       # API client (TanStack Query hooks)
│       └── shared/    # Player, i18n, UI components
├── scripts/           # dev.sh, deploy.sh, init.sh
└── docs/              # API reference, DB schema, overview
```

## Commands

```bash
# Development
bash scripts/dev.sh               # Start both servers

# Testing
cd backend  && npm test          # Vitest
cd frontend && npm test          # Vitest

# Type checking
cd backend  && npm run typecheck
cd frontend && npm run check

# Deploy
bash scripts/deploy.sh
```
