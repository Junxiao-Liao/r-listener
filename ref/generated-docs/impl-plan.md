# R Listener Full-App Implementation Plan

This document is the implementation plan for building the complete private
multi-tenant music listener from the current scaffold. It is an execution plan,
not a record of the current state.

## Summary

Build the app in vertical, test-first slices while keeping the existing
architecture:

- `frontend/`: SvelteKit app on Cloudflare Pages, acting as a thin BFF.
- `backend/`: Hono Worker on Cloudflare Workers, owning D1, R2, KV, and all
  domain logic.
- D1 + Drizzle for app data and migrations.
- R2 for audio and cover assets.
- KV for rate limiting and lightweight counters.
- Paraglide for EN / 中文 localization.
- Tailwind + shadcn-svelte for UI.

Decisions already locked:

- Scope: full app.
- Delivery: vertical slices.
- Tests: Vitest + Playwright.
- Runtime validation: Zod.
- Browser session cookies: set and clear in the SvelteKit BFF.
- Rolling session refresh: backend returns refreshed expiry metadata;
  SvelteKit resets the browser cookie.
- Initial admin/bootstrap: manual SQL, not a seed command.
- Infrastructure: automate Wrangler setup/deploy scripts.
- Upload metadata: browser-side parser with filename fallback.
- Queue: backend-persisted per user and tenant.
- Queue API style: CRUD rows.
- Current-session hydration: `GET /auth/session`.
- Frontend page implementation: feature pages under `frontend/src/pages`,
  with SvelteKit routes kept thin.
- Local dev launcher: root `./dev.sh` starts backend and frontend together.
- Step 4 and later acceptance includes a browser check.

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

The backend creates, validates, and invalidates sessions, but it does not set
browser cookies directly.

Signin flow:

1. Browser posts credentials to a SvelteKit server route/action.
2. SvelteKit calls backend `POST /auth/signin`.
3. Backend validates credentials, creates the session row, and returns the raw
   session token, `sessionExpiresAt`, and signin payload to the server-only
   caller.
4. SvelteKit sets the app-origin `session` cookie:
   `HttpOnly; Secure; SameSite=Lax; Path=/`, with an expiry matching the
   backend session expiry.

Rolling refresh flow:

1. Backend validates the forwarded `session` cookie on every authenticated
   request.
2. If the session is due for refresh, backend extends the D1 session row and
   returns `X-Session-Expires-At`.
3. SvelteKit resets the app-origin browser cookie with the updated expiry.

Signout flow:

1. Browser posts to a SvelteKit server route/action.
2. SvelteKit forwards the current session token to backend `POST /auth/signout`.
3. Backend deletes the session row.
4. SvelteKit clears the browser cookie.

Backend routes still accept the forwarded `session` cookie from the BFF for
normal authenticated requests.

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
- Implement:
  - `POST /auth/signin`
  - `POST /auth/signout`
  - `POST /auth/switch-tenant`
  - `POST /auth/change-password`
  - `GET /auth/session`
  - `GET /me/preferences`
  - `PATCH /me/preferences`
- Return session token data to BFF-only signin callers.
- Return `sessionExpiresAt` in the signin JSON alongside the BFF-only
  `sessionToken`.
- On signin, bind `sessions.active_tenant_id` only for single-workspace
  users; multi-workspace users start with `active_tenant_id = null` and
  bind via `POST /auth/switch-tenant` from the Tenant Picker.
- The signin response's `activeTenantId` is a suggested pre-selection
  for the picker, not a commitment to bind the session.
- `GET /auth/session` returns the current user, memberships, preferences,
  active tenant, and session expiry for SSR reloads and app shell hydration.
- Enforce disabled-account and weak-password behavior.
- Weak password means failing: at least 12 characters and at least 3 of
  lowercase, uppercase, digit, symbol.
- Revoke sibling sessions on password change.

Frontend:

- Add sign-in page.
- Add SvelteKit server handlers/actions for signin and signout.
- Set and clear browser cookies in SvelteKit only.
- Add tenant picker page.
- Add settings page basics:
  - Email.
  - Active workspace.
  - Switch workspace.
  - Change password.
  - Sign out.
  - Language, autosaved immediately through the BFF.
  - Playback preferences.
  - Theme, autosaved immediately through the BFF.
- Add a frontend-only `/settings/preferences` route that forwards visual
  preference patches to the backend and keeps the current locale/theme
  state aligned without a full reload.
- Add change password page.
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
- Authenticated reload calls `GET /auth/session` and refreshes the browser
  cookie when the backend returns refreshed session expiry metadata.
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
- SvelteKit owns browser cookie writes.
- Authenticated BFF calls forward the cookie to backend.
- Browser check: start `./dev.sh`, open the frontend, verify the app loads, and
  verify `/api/health` reports a healthy backend. Full signin, tenant picker,
  and settings browser acceptance waits for the Step 4 frontend slice when only
  the backend slice is implemented.

### 5. Tracks, Uploads, Lyrics, Covers, And Streaming Slice

Goal: owner/member users can upload private audio, see completed tracks in
Library, manage metadata/lyrics/covers, and stream audio from R2; viewer users
can stream ready tracks without editing shared content.

Backend:

- Implement track ORM, repository, DTO, service, and routes.
- Implement:
  - `GET /tracks`
  - `GET /tracks/{id}`
  - `POST /tracks`
  - `POST /tracks/{id}/finalize`
  - `PATCH /tracks/{id}`
  - `PUT /tracks/{id}/lyrics`
  - `DELETE /tracks/{id}/lyrics`
  - `POST /tracks/{id}/cover-upload`
  - `POST /tracks/{id}/cover-finalize`
  - `DELETE /tracks/{id}/cover`
  - `DELETE /tracks/{id}`
  - `GET /tracks/{id}/stream-url`
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
- Re-fetch stream URLs when close to expiry or on audio error.
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
  - Search entry.
  - Continue Listening.
  - Recently Played.
  - Recently Uploaded.
  - Recently Updated Playlists.
  - Upload shortcut.
- Implement search result UI for tracks and playlists.
- Add empty/loading/error states.

Tests first:

- Unified search rejects empty query.
- Prefix matches rank ahead of substring matches.
- Wrong-tenant and soft-deleted resources do not appear.
- Home renders empty states for a new tenant.
- Home navigation reaches upload, library, playlist, and player flows.

Acceptance:

- Home is useful for a tenant with and without music.
- Search finds only private active-tenant content.

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
- The app can be deployed to Cloudflare Pages and Workers.

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
- Expired stream URL recovery.

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
