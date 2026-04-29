# R Listener Full-App Implementation Plan

This document is the implementation plan for building the complete private
multi-tenant music listener from the current scaffold. It is an execution plan,
not a record of the current state.

## Summary

Build the app in vertical, test-first slices on a single-Worker SPA
architecture:

- `frontend/`: SvelteKit pure SPA via `@sveltejs/adapter-static`. Server
  state in TanStack Query (`@tanstack/svelte-query`); UI state in Svelte 5
  `$state` runes. No SSR, no BFF.
- `backend/`: Hono on Cloudflare Workers, mounted under `/api/*`, also
  serving the built SPA via the `[assets]` binding (one Worker, one origin).
  Owns D1, R2, KV, and all domain logic. Issues the session cookie directly.
- D1 + Drizzle for app data and migrations.
- R2 for audio and cover assets.
- KV for rate limiting and lightweight counters.
- Paraglide for EN / 中文 localization (cookie strategy on the client).
- Tailwind + shadcn-svelte for UI.

Decisions already locked:

- Scope: full app.
- Delivery: vertical slices.
- Tests: Vitest + Playwright.
- Runtime validation: Zod.
- Session cookie: backend sets/rolls/clears `Set-Cookie` directly. The SPA
  shares one origin with the API so the cookie is first-party; no BFF, no
  CORS, no `X-Session-Expires-At` round-trip.
- Initial admin/bootstrap: manual SQL, not a seed command.
- Infrastructure: automate Wrangler setup/deploy scripts.
- Upload metadata: browser-side parser with filename fallback.
- Queue: backend-persisted per user and tenant.
- Queue API style: CRUD rows.
- Current-session hydration: `GET /api/auth/session` (cached by TanStack
  Query under the `['session']` key).
- Frontend page implementation: feature pages under `frontend/src/pages`,
  with SvelteKit routes kept thin (just `<Page />` shells).
- Local dev launcher: root `./dev.sh` starts backend (`wrangler dev`,
  port 8787) and frontend (`vite dev`, port 5173) together; Vite proxies
  `/api/*` to the backend.
- Deploy: GitHub Actions builds the frontend then `wrangler deploy` ships
  the single Worker. Default URL: `r-listener.<account>.workers.dev`.

## Architecture Rules

- Preserve feature grouping required by `AGENTS.md`.
- Backend features use `repository`, `orm`, `dto`, `service`, and `route`.
- Frontend feature pages stay self-contained under `frontend/src/pages`.
  SvelteKit `frontend/src/routes` files should be thin wrappers/loaders that
  call into those page modules.
- Prefer existing ecosystem and local patterns over custom frameworks.
- Write tests first for each slice, then implement the minimum code needed to
  pass.
- Keep services mostly functional: dependencies in, typed input in, typed result
  or domain error out.
- Keep routes thin: parse input, call service, adapt result to HTTP.

## Public API And Contract Changes

The existing contracts in `api.md` and `db.md` remain authoritative, with these
implementation clarifications.

### Cookie Ownership

The backend owns the session cookie end to end. The SPA never sees the
session token — it just sends `fetch` requests; the browser handles the
cookie because the API and SPA share one origin.

Signin flow:

1. SPA `useSigninMutation` POSTs credentials to `/api/auth/signin`.
2. Backend validates credentials, creates the session row, and emits
   `Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/;
   expires=<sessionExpiresAt>` on the response.
3. The response body contains the `CurrentSessionDto` (no token); the SPA
   stores it in the TanStack Query `['session']` cache.

Rolling refresh flow:

1. Backend validates the `session` cookie on every authenticated request.
2. If the session is due for refresh, the backend extends the D1 session
   row and re-emits `Set-Cookie` with the new expiry on the same response.
3. The browser updates the cookie automatically. No client code is involved.

Signout flow:

1. SPA `useSignoutMutation` POSTs to `/api/auth/signout`.
2. Backend deletes the session row and emits a `Set-Cookie` that clears
   the browser cookie (expired `Max-Age`).
3. The mutation's `onSettled` removes cached queries so the next render
   sees no session.

### Persisted Queue API

Add a queue domain scoped to `(userId, tenantId)`.

DTOs:

```ts
type QueueItemDto = {
  id: Id<"queue_item">;
  tenantId: Id<"tenant">;
  userId: Id<"user">;
  trackId: Id<"track">;
  position: number;
  isCurrent: boolean;
  addedAt: Iso8601;
  updatedAt: Iso8601;
  track: TrackDto;
};

type QueueStateDto = {
  items: QueueItemDto[];
  currentItemId: Id<"queue_item"> | null;
  updatedAt: Iso8601 | null;
};
```

Routes:

- `GET /queue`: returns `QueueStateDto`.
- `POST /queue/items`: adds one or more ready tracks to the queue.
- `PATCH /queue/items/{id}`: updates item position and/or current marker.
- `DELETE /queue/items/{id}`: removes one queue item.
- `DELETE /queue`: clears the queue for the active tenant.

Rules:

- Queue rows are only visible inside the active tenant.
- Queue rows may only reference non-deleted, ready tracks in that tenant.
- Reordering returns dense 1-based positions in DTOs.
- At most one queue item is current for a `(userId, tenantId)` pair.
- Queue persistence is per user and tenant, not per device.

## Implementation Phases

### 1. Foundation And Tooling

Goal: make the repo ready for test-first feature work.

Backend:

- Add Vitest.
- Add `test`, `test:unit`, and `typecheck` scripts.
- Add Zod.
- Add typed API error helpers for the uniform error shape.
- Add test helpers for service tests and route tests.

Frontend:

- Add Vitest where pure frontend helpers need coverage.
- Add Playwright with mobile viewport projects.
- Add `test`, `test:unit`, `test:e2e`, `check`, and `build` scripts as needed.
- Keep Playwright tests focused on critical user flows rather than snapshot
  coverage.

Infrastructure:

- Add scripts for Wrangler-assisted setup and deployment:
  - D1 creation command wrapper or documented command.
  - R2 bucket creation command wrapper or documented command.
  - KV namespace creation command wrapper or documented command.
  - D1 migration apply wrapper.
  - Backend deploy wrapper.
  - Frontend deploy wrapper.
- Scripts must not commit generated IDs or secrets.
- Keep `.dev.vars` local and git-ignored.

Acceptance:

- `backend` typecheck passes.
- `frontend` check/build passes.
- Empty or starter test suites run successfully.
- Local setup docs explain required environment variables.

### 2. Database And Backend Feature Skeleton

Goal: replace the placeholder schema with feature-owned Drizzle modules and
route/service structure.

Implement backend folders:

```txt
backend/src/
  users/
  auth/
  tenants/
  tracks/
  playlists/
  playback/
  queue/
  search/
  prefs/
  admin/
  audit/
  middleware/
```

Each feature should contain only the layers it needs:

- `*.orm.ts`: Drizzle tables and indexes.
- `*.dto.ts`: DTO types, Zod schemas, and mapping helpers.
- `*.repository.ts`: database queries only.
- `*.service.ts`: domain rules and orchestration.
- `*.route.ts`: Hono routes.
- `*.type.ts`: centralized feature domain and DTO-facing types.

Database modules:

- Users.
- Sessions.
- Tenants.
- Memberships.
- Tracks.
- Playlists.
- Playlist tracks.
- Playback history.
- Queue items.
- User preferences.
- Audit logs.

Update `backend/src/db/schema.ts` to re-export all feature ORM modules so
Drizzle migrations see the complete graph.

Acceptance:

- Initial migration is generated under the backend migration directory.
- Migration creates all app tables and indexes.
- Typecheck proves all schema exports are valid.

### 3. Backend Middleware And Shared Domain Utilities

Goal: establish the backend conventions every later feature depends on.

Implement:

- Uniform JSON error responses.
- Request body/query validation helpers using Zod.
- Session parsing from the forwarded `session` cookie.
- Session validation with expiry and rolling refresh.
- `requireSession`.
- `requireTenant`.
- `requireTenantEditor` for owner/member tenant-scoped shared-content writes.
- `requireAdmin`.
- Origin enforcement for state-changing methods.
- KV-backed rate limiting for `/auth/*`.
- ID generation helpers for prefixed UUIDv7 IDs.
- Timestamp conversion helpers between D1 unix seconds and ISO strings.

Tests first:

- Missing/invalid session returns `401 unauthenticated`.
- No active tenant returns `403 no_active_tenant`.
- Non-member active tenant returns `403 tenant_forbidden`.
- Viewer hitting an editor-only tenant route returns `403 insufficient_role`.
- Non-admin admin route returns `403 admin_required`.
- Bad mutation origin returns `403 forbidden_origin`.
- Rate-limited auth route returns `429 rate_limited`.

Acceptance:

- `GET /health` still works without auth.
- Protected route test fixtures can be mounted with middleware.
- All middleware tests pass.

### 4. Auth, Preferences, And Tenant Selection Slice

Goal: users can sign in, select an active workspace, update preferences, change
password, and sign out.

Backend:

- Implement user repositories and DTO mappers.
- Implement session repositories.
- Implement tenant and membership reads.
- Implement preferences lazy creation and updates.
- Add root `dev.sh` that starts backend `npm run dev` on
  `127.0.0.1:8787` and frontend `npm run dev` on `localhost:5173`, with
  signal cleanup for both child processes.
- Implement (all under `/api`):
  - `POST /api/auth/signin`
  - `POST /api/auth/signout`
  - `POST /api/auth/switch-tenant`
  - `POST /api/auth/change-password`
  - `GET /api/auth/session`
  - `GET /api/me/preferences`
  - `PATCH /api/me/preferences`
- On signin, the backend issues `Set-Cookie: session=...; HttpOnly; Secure;
  SameSite=Lax; Path=/` and returns the `CurrentSessionDto` body (no token).
- Return `sessionExpiresAt` in the signin JSON.
- On signin, bind `sessions.active_tenant_id` only for single-workspace
  users; multi-workspace users start with `active_tenant_id = null` and
  bind via `POST /api/auth/switch-tenant` from the Tenant Picker.
- The signin response's `activeTenantId` is a suggested pre-selection
  for the picker, not a commitment to bind the session.
- `GET /api/auth/session` returns the current user, memberships, preferences,
  active tenant, and session expiry. The SPA caches it under TanStack Query
  key `['session']` as the single source of truth.
- Enforce disabled-account and weak-password behavior.
- Weak password means failing: at least 12 characters and at least 3 of
  lowercase, uppercase, digit, symbol.
- Revoke sibling sessions on password change.

Frontend:

- Add sign-in page (`src/pages/signin/`). On submit calls
  `useSigninMutation`; on success seeds the `['session']` query and
  navigates to `/` or `/tenants`.
- Add tenant picker page that reads memberships from the cached
  `['session']` query and calls `useSwitchTenantMutation` on tap; the
  mutation invalidates `['session']` so the rest of the app re-renders
  with the new active tenant.
- Add settings page basics:
  - Username.
  - Active workspace.
  - Switch workspace.
  - Change password.
  - Sign out.
  - Language, autosaved through `useUpdatePreferencesMutation`.
  - Playback preferences.
  - Theme, autosaved through `useUpdatePreferencesMutation`. The mutation
    sets the `theme` cookie client-side (so the inline `<head>` script can
    apply it on next cold load) and runs `applyTheme` for live UI.
- Add change password page; on success navigates to `/signin`.
- The change-password UI must visibly show: “at least 12 characters and at
  least 3 of lowercase, uppercase, digit, symbol.”
- Add EN and 中文 messages for these screens.

Manual bootstrap:

- Document the manual SQL path for the first admin, first tenant, initial owner
  membership, and default preference row.
- Include how to generate an argon2id password hash with the backend helper or a
  one-off local command, but do not add an application seed command.

Tests first:

- Signin success creates session.
- Single-workspace users get `sessions.active_tenant_id` bound on signin
  and skip the tenant picker in the frontend flow.
- Multi-workspace users get `sessions.active_tenant_id = null` on signin
  and always see the tenant picker; tapping a card calls
  `POST /auth/switch-tenant` to bind the active tenant.
- Authenticated reload calls `GET /api/auth/session` and the backend
  re-emits `Set-Cookie` with the new expiry when rolling refresh fires.
- Platform admins with no tenant memberships can use Tenant Picker to browse
  all tenants and enter one as admin.
- Disabled account cannot sign in.
- Wrong password returns `invalid_credentials`.
- Change password requires current password.
- Change password revokes other sessions.
- Preferences get creates defaults.
- Preferences patch updates only provided fields.

Acceptance:

- A manually bootstrapped user can sign in locally.
- Backend owns the `session` cookie end-to-end (set on signin, rolled on
  authed requests, cleared on signout).
- The SPA never sees the session token — `fetch('/api/...')` works because
  the cookie is first-party.
- Browser check: start `./dev.sh`, open the frontend, verify the app loads,
  and verify `/api/health` reports a healthy backend. Full signin, tenant
  picker, and settings browser acceptance waits for the Step 4 frontend
  slice when only the backend slice is implemented.

### 5. Tracks, Uploads, Lyrics, Covers, And Streaming Slice

Goal: owner/member users can upload private audio, see completed tracks in
Library, manage metadata/lyrics/covers, and stream audio from R2; viewer users
can stream ready tracks without editing shared content.

**Implementation decisions (Step 5):**

- **R2 upload**: Worker proxy (multipart/form-data). Client sends audio bytes
  to the Worker; Worker writes to R2 binding. No S3 presigned URLs needed.
- **R2 streaming**: Worker proxy stream. `GET /tracks/{id}/stream` pipes the
  R2 object as a `ReadableStream` through the Worker with Range header support.
- **Upload flow**: Two-step.
  1. `POST /tracks` (multipart: audio file + optional `title`/`artist`/`album`).
     Creates a pending track row, stores audio in R2. Returns `TrackDto`.
  2. `POST /tracks/{id}/finalize` (JSON: `durationMs` + optional `lyricsLrc`,
     `trackNumber`, `genre`, `year`). Parses lyrics status, validates R2 object
     exists, sets status to `ready`.
- **Cover support**: Skipped for now. `coverR2Key` column stays null. No
  `cover-upload`/`cover-finalize`/`cover-delete` endpoints in this slice.
- **Pagination**: Cursor-based. Cursor is the track ID (UUIDv7, time-sortable).
  Query params: `cursor` (optional, exclusive), `limit` (default 50).
- **Sort options**: `title`, `artist`, `album`, `year`, `durationMs`, `createdAt`,
  `updatedAt`. Default: `createdAt` descending. Query param: `sort`.
- **Max audio file size**: 100 MB (Worker body limit).
- **Audio MIME types**: `audio/mpeg`, `audio/mp4`, `audio/mp3`, `audio/ogg`,
  `audio/flac`, `audio/wav`, `audio/x-wav`, `audio/aac`,
  `audio/x-m4a`, `audio/webm`.
- **Lyrics status detection**: Uses `lrc-kit` library for parsing, mirrored
  client-side for preview:
  - Empty/whitespace → `none`
  - At least one timed lyric parsed by `lrc-kit` → `synced`
  - Non-empty text with no timed lyrics → `plain`
  - All non-metadata lines are empty bracket tags (no text after `]`) → `invalid`
  - Metadata-only (e.g. `[ti:...]\n[ar:...]`) → `none`
- **Browser metadata parsing**: Use `music-metadata-browser` library to extract
  title, artist, album, track number, genre, year, duration, embedded cover
  bytes, and embedded lyrics (ID3 USLT/SYLT) from all common audio formats
  before upload. Server-side extraction is deferred.
- **R2 key format**: `tenants/{tenantId}/tracks/{trackId}.{ext}` where `ext`
  is derived from the MIME type (e.g., `mp3`, `flac`, `ogg`).
- **PATCH /tracks/{id} fields**: `title`, `artist`, `album`, `trackNumber`,
  `genre`, `year`, `durationMs`. All optional (partial patch).
- **GET /tracks query params**: `cursor` (exclusive track ID), `limit` (default
  50, max 100), `sort` (default `createdAt` desc), `q` (text search on
  title/artist/album), `includePending` (boolean, editors only).
- **PUT /tracks/{id}/lyrics body**: JSON `{ "lyricsLrc": "<raw lrc text>" }`.
  Backend parses and stores `lyricsStatus` derivation automatically.
- **DELETE /tracks/{id}**: soft-delete (sets `deleted_at`).
- **Stream endpoint**: `GET /tracks/{id}/stream` returns the raw audio stream
  (proxied from R2). Range requests supported. Rejects pending tracks with 404.
- **includePending**: Editors (owner/member/admin) can use `includePending=true`
  to see their pending uploads. Viewers get `403 insufficient_role` when using
  this flag. Default is `false` — pending tracks are hidden.

Backend:

- Implement track ORM, repository, DTO, service, and routes.
- Implement:
  - `GET /tracks` (with cursor pagination, sort, q, includePending)
  - `GET /tracks/{id}`
  - `POST /tracks` (multipart: audio + optional metadata)
  - `POST /tracks/{id}/finalize` (durationMs + optional lyricsLrc, etc.)
  - `PATCH /tracks/{id}`
  - `PUT /tracks/{id}/lyrics`
  - `DELETE /tracks/{id}/lyrics`
  - `DELETE /tracks/{id}` (soft-delete)
  - `GET /tracks/{id}/stream` (R2 proxy stream with Range support)
- Generate R2 keys under `tenants/{tenantId}/tracks/`.
- Validate MIME types, upload sizes, duration, lyrics, and tenant ownership.
- Keep pending uploads hidden from normal Library reads.
- Require owner/member/admin for upload, finalize, metadata, lyrics, cover,
  delete, and `includePending=true`; viewers get `403 insufficient_role`.
- Preserve soft-delete behavior.

Frontend:

- Add browser-compatible metadata parsing for title, artist, album, duration,
  and cover when available.
- Fall back to filename-derived title when metadata is missing.
- Pair `.lrc` files to audio files by matching base filename.
- Implement pages:
  - Upload.
  - Upload Review.
  - Upload Progress.
  - Library.
  - Music Detail.
  - Edit Music Metadata.
- Disable upload/edit/delete/lyrics/cover controls for viewers with a short
  role explanation.
- Upload flow:
  - Review selected files.
  - Call backend upload init.
  - PUT bytes directly to R2 URL.
  - PUT cover bytes when present.
  - Call finalize with duration and lyrics text.
  - Show pending/progress only on Upload Progress.
  - Add completed tracks to Library only after finalize succeeds.

Tests first:

- Track validation rejects unsupported MIME and oversized files.
- Finalize rejects missing R2 object.
- Finalize rejects already-ready track.
- Lyrics status derives `none`, `synced`, `plain`, and `invalid`.
- Soft-deleted tracks disappear from reads.
- Stream URL rejects pending tracks.
- Viewer can list/stream ready tracks but cannot upload, finalize, edit, delete,
  edit lyrics/covers, or request `includePending=true`.
- Upload review pairs matching audio and `.lrc` files.
- Upload progress handles retry/remove failed item states.

Acceptance:

- A user can upload at least one audio file and see it in Library after
  completion.
- A ready track can produce a stream URL.
- Metadata, lyrics, and cover updates round-trip through the UI.

### 6. Playback, Player, Queue, And Media Session Slice

Goal: playback works on mobile and desktop, including queue persistence,
history, lyrics seeking, mini-player, and Media Session controls.

Backend:

- Implement playback history:
  - `POST /playback-events`
  - `GET /me/recent-tracks`
  - `GET /me/continue-listening`
- Implement queue ORM, repository, DTO, service, and routes:
  - `GET /queue`
  - `POST /queue/items`
  - `PATCH /queue/items/{id}`
  - `DELETE /queue/items/{id}`
  - `DELETE /queue`
- Enforce tenant scoping and ready-track-only queue items.
- Keep queue positions dense in DTOs.
- Keep a single current queue item per user and tenant.
- Allow viewers to write personal playback history and queue state.

Frontend:

- Add one long-lived `<audio>` element at app shell level.
- Treat the audio element as the source of truth for playback state.
- Implement player state management for:
  - Current track.
  - Playing/paused.
  - Current time.
  - Duration.
  - Queue.
  - Stream URL expiry.
- Implement mini-player above bottom nav.
- Implement full player page.
- Implement lyrics player page:
  - Synced lyrics highlight.
  - Tap/click line to seek.
  - Plain/no/invalid lyrics states.
- Implement queue page with CRUD-backed add/remove/reorder/current behavior.
- Register Media Session metadata and handlers for play, pause, previous, and
  next.
- Treat `/api/tracks/{id}/stream` as a stable Worker-proxied stream URL; reload
  the audio element on error.
- Batch playback progress events and flush on interval and `pagehide`.

Tests first:

- Playback `ended` writes `lastPositionMs = 0`.
- Continue Listening excludes completed tracks.
- Recent tracks keeps completed tracks.
- Queue rejects wrong-tenant or pending tracks.
- Queue add/remove/reorder/current behavior preserves dense order.
- Viewer can write playback events and manage their own queue.
- Player can load a track and request a stream URL.
- Lyrics line click calls seek behavior.
- Mini-player expands to full player.

Manual QA:

- iOS Safari background playback.
- iOS lock-screen Now Playing metadata and controls.
- Android Chrome media controls.
- Auto-play next after first user-initiated play.

Acceptance:

- User can play, pause, seek, go next/previous, and continue playback with a
  persisted queue.
- Playback history drives Home continue/recent sections.

### 7. Playlists Slice

Goal: owner/member users can create, edit, delete, play, and reorder custom
playlists; viewer users can browse and play playlists without editing them.

Backend:

- Implement playlist ORM, repository, DTO, service, and routes.
- Implement playlist track add/remove/reorder.
- Enforce unique playlist names per tenant among non-deleted playlists.
- Enforce duplicate-track rejection inside one playlist.
- Require owner/member/admin for playlist and playlist-track mutations.
- Compute `trackCount` and `totalDurationMs` at read time.

Frontend:

- Implement:
  - Playlists.
  - Create Playlist.
  - Edit Playlist.
  - Playlist Detail.
  - Add Music to Playlist.
  - Reorder Playlist.
- Generate playlist covers from playlist name.
- Wire playlist play action into queue/player.
- Disable playlist create/edit/delete/add/reorder controls for viewers with a
  short role explanation.

Tests first:

- Playlist create rejects duplicate name.
- Playlist update can rename and edit description.
- Playlist delete soft-deletes.
- Add track appends by default.
- Insert/reorder/remove yields dense positions.
- Duplicate track add returns conflict.
- Viewer can read/play playlists but cannot create, update, delete, add,
  remove, or reorder playlist tracks.

Acceptance:

- User can create a playlist, add tracks, reorder them, play the playlist, and
  delete the playlist.

### 8. Search And Home Slice

Goal: Home and search reflect the user's active workspace and private library.

Backend:

- Implement unified search:
  - `GET /search`
- Support per-resource list search and sorting:
  - Tracks: `q`, `sort`, pagination.
  - Playlists: `q`, `sort`, pagination.
- Use simple SQL prefix/substr ranking for v1.

Frontend:

- Implement Home page:
  - Greeting with active workspace.
  - Search entry that navigates to `/search?q=...`.
  - Continue Listening.
  - Recently Played.
  - Recently Uploaded.
  - Recently Updated Playlists.
  - Concise shortcut buttons: Library, Playlists, Player, Upload.
- Implement dedicated `/search` result UI with grouped tracks and playlists.
- Add empty/loading/error states.

Tests first:

- Unified search rejects empty query.
- Prefix matches rank ahead of substring matches.
- Wrong-tenant and soft-deleted resources do not appear.
- Home renders empty states for a new tenant.
- Home navigation reaches upload, library, playlist, and player flows.
- Playwright mocks `/api/*` and runs against the production preview server
  (`build` then `vite preview`) to avoid dev-server HMR churn.

Acceptance:

- Home is useful for a tenant with and without music.
- Search finds only private active-tenant content.
- Bottom navigation contains Home, Library, Playlists, and Settings. Upload is
  reached from Home and Library for editors.

### 9. Admin Slice

Goal: platform admins can manage users, tenants, memberships, and audit logs.

Backend:

- Implement admin DTOs, services, and routes:
  - Users list/detail/create/update/reset-password/delete.
  - Tenants list/detail/create/update/delete.
  - Tenant members list/create/update/delete.
  - Audit logs list.
- Wrap mutating admin operations with audit log writes.
- Redact secrets in audit metadata.
- Enforce:
  - Admin required.
  - Cannot demote/deactivate self.
  - Cannot delete self.
  - Cannot remove or demote the last tenant owner to member/viewer.
- Allow membership roles `owner`, `member`, and `viewer`.
- Implement admin tenant enter by using switch-tenant behavior and audit action
  `tenant.admin_enter`.

Frontend:

- Add Settings -> Admin entry for platform admins only.
- Let platform admins enter the admin area even when they have no tenant
  memberships or active tenant.
- Implement:
  - Admin Users.
  - Admin User Detail.
  - Admin Create User.
  - Admin Tenants.
  - Admin Tenant Detail.
  - Admin Tenant Members.
  - Admin Audit Logs.
- Add confirmation sheets for destructive actions.
- Disable impossible self/last-owner actions with clear inline explanation.
- Include Viewer in admin membership role selectors.

Tests first:

- Non-admin cannot access admin routes.
- Create user rejects duplicate username and weak password.
- Reset password revokes sessions.
- Self-demotion/self-delete are rejected.
- Tenant create requires initial owner.
- Last owner cannot be removed or demoted.
- Admin can create, update, and list viewer memberships.
- Mutating admin actions create audit logs.
- Audit log filters work.

Acceptance:

- Admin can create user, create tenant, add membership, enter workspace, and see
  audit entries for the actions.
- Admin user deletion removes access but keeps that user's uploaded tracks and
  playlists visible to remaining authorized workspace users.

### 10. Localization, UI Polish, And Responsive Completion

Goal: complete the production-facing UI quality pass after all flows work.

Frontend:

- Complete EN and 中文 message coverage.
- Ensure all bottom-nav pages are mobile-first and usable at desktop widths.
- Keep consumer pages music-app-like, not dashboard-like.
- Keep admin pages utilitarian but visually consistent.
- Add all required empty/error/loading states:
  - Empty Library.
  - Empty Playlist.
  - No Lyrics.
  - Invalid Lyrics.
  - Upload Failed.
  - Unsupported Format.
  - Search No Results.
  - Account Disabled.
  - Skeleton list rows.
- Ensure destructive actions require confirmation.
- Ensure text fits on mobile and desktop.
- Verify mini-player and bottom nav do not overlap content.

Tests:

- Playwright smoke in English and Chinese routes/locales.
- Mobile viewport coverage for main flows.
- Desktop-width smoke for basic usability.

Acceptance:

- Every planned screen has a usable implementation.
- All user-visible strings are localized or intentionally non-localized.

### 11. Release Readiness

Goal: make the app deployable and operable.

Documentation:

- Local development setup.
- Manual SQL bootstrap.
- Cloudflare D1/R2/KV setup.
- Environment variables and secrets.
- Migration generation and apply process.
- Deploy commands.
- Real-device audio QA checklist.

Verification:

- Backend typecheck.
- Backend tests.
- Frontend check.
- Frontend build.
- Frontend tests.
- Playwright e2e tests.
- Manual iOS/Android playback checks.

Acceptance:

- A fresh environment can be provisioned using documented commands and scripts.
- A manually bootstrapped admin can create users/tenants and use the full app.
- The app can be deployed as a single Cloudflare Worker via GitHub Actions
  (frontend build + `wrangler deploy`).

## Test Matrix

Backend Vitest:

- DTO validation.
- Service domain rules.
- Repository behavior for tenant scoping and soft delete.
- Auth/session lifecycle.
- Middleware authorization.
- Viewer/editor role authorization.
- Upload and stream validation.
- Playlist and queue ordering.
- Playback history.
- Admin audit and safety rules.

Frontend Vitest:

- Upload file grouping and `.lrc` matching.
- Metadata fallback helpers.
- Lyrics parsing/display helpers.
- Queue state transforms.
- Formatting helpers for duration, dates, and file sizes.

Playwright:

- Sign in and sign out.
- Tenant picker.
- Upload review and progress.
- Library browsing and music detail.
- Full player and mini-player.
- Lyrics seek.
- Queue CRUD.
- Playlist CRUD and reorder.
- Viewer disabled edit affordances.
- Settings and preferences.
- Admin user/tenant/member/audit flows.
- EN and 中文 smoke coverage.

Manual:

- iOS Safari background playback.
- iOS lock-screen controls.
- Android media controls.
- Large upload retry/failure.
- Stream error recovery by reloading the stable Worker-proxied stream URL.

## Assumptions

- No public signup is added.
- Admin-created users receive credentials out of band.
- Soft delete remains invisible to normal users.
- Pending uploads are visible only on Upload Progress.
- Track duration is supplied by the browser and range-validated by backend.
- Server-side audio metadata extraction is deferred.
- Queue persistence is per user and active tenant, not per device.
- Cloudflare resource IDs and secrets are never committed.
- Manual SQL bootstrap is acceptable for initial production setup.
