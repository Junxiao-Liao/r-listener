# API

Backend = Hono Worker. All endpoints live on the Worker; the SvelteKit BFF
(`frontend/src/lib/server/api.ts`) proxies them from server routes and forwards
the `session` cookie host-to-host. The browser never talks to the backend
directly.

This doc describes the contract: routes, DTOs, semantics, error codes.

---

## 1. Conventions

### 1.1 Base URL

All routes are relative to the Worker origin (`BACKEND_URL`). The frontend
BFF is expected to prefix its own `/api/...` paths and proxy them through
(see `lib/server/api.ts`). No versioning prefix yet — add `/v1` only when
the first breaking change ships.

### 1.2 Transport & content type

- `Content-Type: application/json; charset=utf-8` for request and response
  bodies, except audio/cover uploads (binary PUT to R2) and streaming (see §7, §8).
- Timestamps: **ISO-8601 UTC strings** on the wire (`2026-04-25T09:12:03.000Z`).
  Stored as unix seconds in D1 (`integer('created_at', { mode: 'timestamp' })`).
- IDs: opaque strings. Convention: ULID-like 26-char base32 generated at
  insert time; never expose D1 rowid.
- All mutation endpoints are idempotent at the shape level: repeated
  create-with-same-input returns 409, repeated delete on missing row
  returns 404 (not 204), repeated toggle endpoints are PATCH.

### 1.3 Response shape

Single resource: the resource object directly.

```json
{ "id": "trk_01H...", "title": "Song", ... }
```

List: `{ items, nextCursor }`. `nextCursor` is `null` when no more.

```json
{ "items": [ ... ], "nextCursor": "eyJ0IjoxNzE..." }
```

Mutations that have no meaningful body return `204 No Content`.

### 1.4 Errors

Uniform shape on any non-2xx response:

```json
{ "error": { "code": "invalid_credentials", "message": "Email or password is wrong." } }
```

For validation failures, a `fields` map may be added:

```json
{ "error": { "code": "validation_failed", "message": "Invalid input.",
             "fields": { "email": "Must be a valid email." } } }
```

`code` is stable (client switches on it). `message` is human-readable and may
change. HTTP status is authoritative for category; `code` is authoritative
for precise reason.

Canonical codes are listed in §9.

### 1.5 Pagination

Cursor-based. Every list endpoint accepts:

- `limit` — integer, default 50, max 200
- `cursor` — opaque string from a prior response's `nextCursor`

Cursors are server-signed opaque blobs encoding (sort-key, id). Clients
never interpret them.

### 1.6 Authentication

Session cookie only. Named `session`; value is a 20-byte base32 token. The
backend creates, validates, and invalidates sessions, and stores SHA-256 of the
token in `sessions` (see `backend/src/auth/session.ts`). The frontend BFF sets,
clears, and forwards the browser cookie; CORS credentials are allowed for direct
dev calls only.

- `HttpOnly; Secure; SameSite=Lax; Path=/`
- Expiry: 30 days rolling. Every authed request that is ≥1 day older than
  the last refresh extends the session row by 30 days.
- When a request rolls the session expiry, the backend includes
  `X-Session-Expires-At: <ISO-8601>` in the response. The SvelteKit BFF is
  responsible for resetting the browser cookie with the same expiry; the
  backend still never emits `Set-Cookie`.

Every request outside `/auth/signin` and `/health` requires a valid session.
401 + `{code:'unauthenticated'}` otherwise.

### 1.7 Authorization

Four scopes of role, checked in this order:

1. **Platform admin** (`users.is_admin = true`). Can access all `/admin/*`
   routes, can call `POST /auth/switch-tenant` for any tenant, and can
   mutate tenant-scoped content regardless of membership role.
2. **Tenant owner** (`memberships.role = 'owner'`) within the active
   tenant. Reserved for destructive tenant-scoped actions later; today
   membership management is admin-only so owner has no extra API powers
   vs. member.
3. **Tenant member** (`memberships.role = 'member'`) within the active
   tenant. Can read and mutate normal tenant-scoped content.
4. **Tenant viewer** (`memberships.role = 'viewer'`) within the active
   tenant. Can read ready tenant-scoped content and use personal listener
   state, but cannot mutate shared workspace content.

Requests to tenant-scoped routes resolve the active tenant from
`sessions.active_tenant_id`. 403 + `{code:'no_active_tenant'}` if the
session has no active tenant; 403 + `{code:'tenant_forbidden'}` if the
user is not a member of it (and not a platform admin).

Tenant-scoped shared-content writes require an editor role (`owner` or
`member`) unless the caller is a platform admin. A `viewer` calling a blocked
write receives `403` + `{code:'insufficient_role'}`.

### 1.8 CSRF

The browser only ever talks to the frontend origin. The BFF attaches the
session cookie host-to-host when calling the backend, so classical CSRF
surface is on the frontend. The backend enforces `Origin` == `FRONTEND_ORIGIN`
on state-changing methods (`POST|PUT|PATCH|DELETE`) as defense-in-depth; 403
+ `{code:'forbidden_origin'}` otherwise.

### 1.9 Rate limits

All `/auth/*` routes are limited to 10 requests / minute / IP via a KV
counter. 429 + `{code:'rate_limited'}`.

### 1.10 Soft delete

Every mutable domain row carries `deleted_at INTEGER NULL`. Delete endpoints
set it; list and get endpoints filter it out. R2 objects for deleted tracks
are retained until a periodic GC (future Cron Trigger); clients must never
see soft-deleted rows.

---

## 2. Domain types

These are the wire DTOs. Implementation-side (`orm` layer) may carry
additional internal columns.

```ts
// Shared primitives
type Iso8601 = string;          // "2026-04-25T09:12:03.000Z"
type Id<K extends string> = string; // e.g. Id<"user"> = "usr_01H..."
type Cursor = string;           // opaque

// Users ---------------------------------------------------------------
type UserDto = {
  id: Id<"user">;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  lastActiveTenantId: Id<"tenant"> | null;  // most-recent tenant across sessions; drives Tenant Picker "Last used" chip
  createdAt: Iso8601;
};

// Tenants -------------------------------------------------------------
type TenantDto = {
  id: Id<"tenant">;
  name: string;
  createdAt: Iso8601;
};

type TenantMembershipDto = {
  tenantId: Id<"tenant">;
  tenantName: string;
  role: "owner" | "member" | "viewer";
  createdAt: Iso8601;
};

type PreferencesDto = {
  language: "en" | "zh";
  autoPlayNext: boolean;
  showMiniPlayer: boolean;
  preferSyncedLyrics: boolean;
  defaultLibrarySort: "createdAt:desc" | "title:asc" | "artist:asc" | "album:asc";
  updatedAt: Iso8601;
};

type CurrentSessionDto = {
  user: UserDto;
  tenants: TenantMembershipDto[];
  preferences: PreferencesDto;
  activeTenantId: Id<"tenant"> | null;
  sessionExpiresAt: Iso8601;
};

// Tracks --------------------------------------------------------------
type TrackDto = {
  id: Id<"track">;
  tenantId: Id<"tenant">;
  title: string;
  artist: string | null;
  album: string | null;
  trackNumber: number | null;
  genre: string | null;
  year: number | null;
  durationMs: number | null;
  coverUrl: string | null;    // presigned cover image GET URL, expires like stream-url
  lyricsLrc: string | null;   // raw lyric text, may be LRC or plain text
  lyricsStatus: "none" | "synced" | "plain" | "invalid";
  contentType: string;        // common audio MIME: MP3, M4A/MP4, AAC, WAV, FLAC, OGG/Opus, WebM
  sizeBytes: number;
  status: "pending" | "ready"; // pending until /finalize succeeds
  createdAt: Iso8601;
  updatedAt: Iso8601;
};

type AdminUserListItemDto = UserDto & {
  workspaceCount: number;
};

type AdminUserDetailDto = UserDto & {
  memberships: TenantMembershipDto[];
};

type AdminTenantListItemDto = TenantDto & {
  memberCount: number; // all active owner/member/viewer memberships
  trackCount: number;
};

// Playlists -----------------------------------------------------------
type PlaylistDto = {
  id: Id<"playlist">;
  tenantId: Id<"tenant">;
  name: string;
  description: string | null;
  trackCount: number;
  totalDurationMs: number;    // SUM of non-deleted, ready tracks' durationMs; computed at read time
  createdAt: Iso8601;
  updatedAt: Iso8601;
};

type PlaylistTrackDto = {
  playlistId: Id<"playlist">;
  trackId: Id<"track">;
  position: number;           // 1-based, dense within a playlist
  addedAt: Iso8601;
  // Embedded for list convenience
  track: TrackDto;
};

// Playback history ----------------------------------------------------
type PlaybackEventInput = {
  trackId: Id<"track">;
  startedAt: Iso8601;           // client clock; server also stamps serverTs
  positionMs: number;           // offset within the track when the event fired
  event: "play" | "progress" | "ended";
  playlistId: Id<"playlist"> | null; // context, if any
};

type RecentTrackDto = {
  track: TrackDto;
  lastPlayedAt: Iso8601;
  lastPositionMs: number;       // useful for "Continue Listening"
  playlistId: Id<"playlist"> | null;
};

// Queue ---------------------------------------------------------------
type QueueItemDto = {
  id: Id<"queue_item">;
  tenantId: Id<"tenant">;
  userId: Id<"user">;
  trackId: Id<"track">;
  position: number;             // 1-based, dense within user + tenant queue
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

// Search --------------------------------------------------------------
type SearchHitDto =
  | { kind: "track"; track: TrackDto }
  | { kind: "playlist"; playlist: PlaylistDto };

// Audit ---------------------------------------------------------------
type AuditLogDto = {
  id: Id<"audit">;
  actorId: Id<"user">;        // admin who performed it
  action: string;             // "user.create", "tenant.delete", ...
  targetType: "user" | "tenant" | "membership" | "track" | "playlist";
  targetId: string;
  tenantId: Id<"tenant"> | null;
  meta: Record<string, unknown>;
  createdAt: Iso8601;
};
```

---

## 3. Health

### `GET /health`
No auth. `200 { "ok": true }`. Already scaffolded.

---

## 4. Auth

### `POST /auth/signin`

Request:
```json
{ "email": "a@b.com", "password": "..." }
```

Response `200`:
```json
{
  "user": { /* UserDto */ },
  "tenants": [ /* TenantMembershipDto[] */ ],
  "preferences": { /* PreferencesDto */ },
  "activeTenantId": "tnt_01H..." | null,
  "sessionToken": "abcd..." // BFF-only; stripped before any browser response
}
```

- `activeTenantId` is a **suggested pre-selection** for the Tenant Picker:
  the last-used tenant from a prior session if still valid and the user is
  still a member; otherwise the first membership; otherwise `null` (user
  has no memberships — admins only).
- The session's `active_tenant_id` is bound only for **single-workspace
  users** (set to their sole membership). For multi-workspace users the
  session row is created with `active_tenant_id = null`; the picker calls
  `POST /auth/switch-tenant` on tap to bind it. The signin response
  `activeTenantId` is purely a UI hint for which card to highlight.
- Creates a session row and returns the raw session token to the server-only
  BFF caller. The backend does not emit `Set-Cookie`.
- The SvelteKit BFF sets the browser `session` cookie with
  `HttpOnly; Secure; SameSite=Lax; Path=/` and an expiry matching the
  backend session expiry. It never exposes `sessionToken` to client code.
- Errors: `401 invalid_credentials`, `403 account_disabled`,
  `429 rate_limited`.

### `GET /auth/session`

Auth: session required.

Response `200`:
```json
{
  "user": { /* UserDto */ },
  "tenants": [ /* TenantMembershipDto[] */ ],
  "preferences": { /* PreferencesDto */ },
  "activeTenantId": "tnt_01H..." | null,
  "sessionExpiresAt": "2026-05-25T09:12:03.000Z"
}
```

- Validates the forwarded `session` cookie, applies the normal rolling refresh
  rule, and returns the current app-shell state needed for SSR reloads.
- Platform admins may have zero memberships. In that case `tenants` may be
  empty and `activeTenantId` may be `null`; the frontend Tenant Picker should
  let admins browse all tenants by calling the admin tenant list endpoint.
- The BFF resets the browser cookie when this or any other authenticated
  backend response includes `X-Session-Expires-At`.
- Errors: `401 unauthenticated`, `403 account_disabled`.

### `POST /auth/signout`

Auth: session required.
Response: `204`. Deletes the current session row. The SvelteKit BFF clears the
browser cookie after the backend confirms signout.

### `POST /auth/switch-tenant`

Auth: session required.
Request:
```json
{ "tenantId": "tnt_01H..." }
```
Response `200`:
```json
{ "user": { ... }, "activeTenantId": "tnt_01H..." }
```

- Non-admin: 403 `tenant_forbidden` if not a member.
- Admin: may switch to any tenant (including tenants they're not a member
  of); action is written to `audit_logs` as `tenant.admin_enter`.
- Errors: `404 tenant_not_found`, `403 tenant_forbidden`.

### `POST /auth/change-password`

Auth: session required. User changes their own password.
Request:
```json
{ "currentPassword": "...", "newPassword": "..." }
```
Response: `204`. All other sessions for the user are revoked; the current
session is kept.
Errors: `400 validation_failed`, `401 invalid_credentials` (wrong current),
`422 weak_password`.

Use `GET /auth/session` after reloads or direct navigation to hydrate the
app shell with identity, memberships, active tenant, preferences, and the
current session expiry. Do not rely on an in-memory frontend store for session
state.

---

## 5. Tenant-scoped resources

All routes in this section are scoped to the session's active tenant. No
tenant id in the URL. Omitting or lacking membership → `403 no_active_tenant`
or `403 tenant_forbidden` as appropriate.

Viewer memberships are listen-only for shared workspace content. Viewers can
read ready tracks/playlists, search, request stream URLs, write personal
playback history, manage their own queue, and update their own preferences.
They cannot upload, edit, delete, or otherwise mutate shared tenant content;
blocked edit calls return `403 insufficient_role`.

### 5.1 Tracks

#### `GET /tracks`
Query: `limit`, `cursor`, `q` (optional, case-insensitive substring on
`title|artist|album`), `sort` (`createdAt:desc` default; `title:asc`,
`artist:asc`, `album:asc` allowed).

Response `200`: `{ items: TrackDto[], nextCursor }`. Excludes
`status='pending'` and soft-deleted rows by default. `?includePending=true`
shows in-flight uploads (used by the uploads UI) and requires an editor role
or platform admin. Viewers requesting `includePending=true` receive
`403 insufficient_role`.

#### `GET /tracks/{id}`
Response `200`: `TrackDto`. `404 not_found` if missing or soft-deleted.
Pending tracks are visible only to editor roles and platform admins; viewers
receive `404 track_not_found` for pending track ids. Soft-deletion is invisible
to clients (no 410, no owner-only signal), matching the UI's "deletions are
non-reversible" principle.

#### `POST /tracks` — **upload init** (step 1 of 3)

Request:
```json
{
  "title": "Song",
  "artist": "A" | null,
  "album": "B" | null,
  "trackNumber": 1 | null,
  "genre": "Rock" | null,
  "year": 2026 | null,
  "contentType": "audio/mpeg",
  "sizeBytes": 8421376,
  "coverContentType": "image/jpeg" | null
}
```

Validation:
- `contentType ∈ { audio/mpeg, audio/mp4, audio/aac, audio/wav,
  audio/x-wav, audio/flac, audio/ogg, audio/opus, audio/webm }`
- `sizeBytes <= MAX_AUDIO_BYTES` (env, default 100 MiB)
- `coverContentType ∈ { image/jpeg, image/png, image/webp }` when present
- `title` 1..200 chars; `artist`/`album`/`genre` 0..200;
  `trackNumber` positive integer; `year` 1000..9999

Response `201`:
```json
{
  "track": { /* TrackDto, status:"pending" */ },
  "upload": {
    "url": "https://...r2.cloudflarestorage.com/...?X-Amz-...",
    "method": "PUT",
    "headers": { "Content-Type": "audio/mpeg" },
    "expiresAt": "2026-04-25T09:27:03.000Z"
  },
  "coverUpload": {
    "url": "https://...r2.cloudflarestorage.com/...?X-Amz-...",
    "method": "PUT",
    "headers": { "Content-Type": "image/jpeg" },
    "expiresAt": "2026-04-25T09:27:03.000Z"
  } | null
}
```

- Inserts a track row with `status='pending'` and R2 key
  `tenants/{tenantId}/tracks/{trackId}.{ext}`.
- `url` is a 15-minute presigned PUT bound to exact `Content-Type` and
  `Content-Length`. R2 rejects mismatched uploads.
- `coverUpload` is returned only when `coverContentType` is present; the
  client may upload cover art before finalizing the track.
- Pending rows older than 1 hour with no `/finalize` are GC'd by a
  future Cron Trigger.

Errors: `400 validation_failed`, `413 payload_too_large`,
`415 unsupported_media_type`.

#### `PUT` (upload, step 2) — **direct to R2, not to the Worker**

Browser performs:
```
PUT {upload.url}
Content-Type: audio/mpeg
Content-Length: 8421376
<binary>
```
No backend involvement. Returns an R2 200 + ETag.

#### `POST /tracks/{id}/finalize` — step 3 of 3

Request:
```json
{
  "durationMs": 215432,
  "lyricsLrc": "[ti:...]\n[00:12.34]line\n..." | null,
  "coverUploaded": true | false
}
```

Server actions:
1. `HEAD` the R2 object; verify it exists, `Content-Type` matches, and
   `Content-Length <= MAX_AUDIO_BYTES`.
2. Trust `durationMs` from client; validate `> 0` and `< 6h`.
3. If `coverUploaded=true`, `HEAD` the cover object and persist
   `cover_r2_key` when it exists and matches the requested content type.
4. Parse `lyricsLrc` to derive `lyricsStatus` (`synced`, `plain`,
   `invalid`, or `none`).
5. Flip `status` to `"ready"`, persist `durationMs`, lyrics fields,
   `sizeBytes` from R2, `updatedAt = now`.

Response `200`: `TrackDto` with `status:"ready"`.

Errors:
- `404 track_not_found`
- `409 track_already_finalized` if `status='ready'`
- `424 upload_missing` if R2 object not found
- `415 unsupported_media_type` on mismatch
- `413 payload_too_large` on size mismatch

> **On duration:** computed server-side is nice-to-have but ffprobe-wasm
> on Workers is heavyweight. For now the client reports `durationMs`
> (trivial via `HTMLAudioElement.duration` at upload time) and we
> validate range. A later Queue consumer can re-derive authoritatively.

#### `PATCH /tracks/{id}`

Editable fields: `title`, `artist`, `album`, `trackNumber`, `genre`, `year`.
All optional; omitted fields unchanged; `null` clears nullable fields.

```json
{ "title": "New name", "genre": "Ambient", "year": 2026 }
```
Response `200`: `TrackDto`.

#### `PUT /tracks/{id}/lyrics`

Upload or replace the track's lyric text. The frontend reads `.lrc` files as
text and sends their contents; there is no separate binary lyric upload.

```json
{ "lyricsLrc": "[00:12.34]line\n..." }
```

Response `200`: `TrackDto` with server-derived `lyricsStatus`:
- `none` — no lyric text
- `synced` — valid timestamped LRC lines are present
- `plain` — non-empty text has no timestamps
- `invalid` — timestamp-like LRC content could not be parsed safely

#### `DELETE /tracks/{id}/lyrics`

Clears lyric text. Response `200`: `TrackDto` with `lyricsStatus:"none"`.

#### `POST /tracks/{id}/cover-upload`

Request:
```json
{ "contentType": "image/jpeg", "sizeBytes": 245760 }
```

Response `200`: `{ "upload": { "url": "...", "method": "PUT", "headers": { "Content-Type": "image/jpeg" }, "expiresAt": "..." } }`.
The client PUTs directly to R2, then calls `POST /tracks/{id}/cover-finalize`.

#### `POST /tracks/{id}/cover-finalize`

Verifies the uploaded cover object and makes it active. Response `200`:
`TrackDto` with a refreshed `coverUrl`.

#### `DELETE /tracks/{id}/cover`

Removes cover art from the track metadata. Response `200`: `TrackDto`.

#### `DELETE /tracks/{id}`

Soft delete: sets `deleted_at`. R2 object retained for later GC.
Response: `204`. Idempotent: second call returns `404 not_found`.

#### `GET /tracks/{id}/stream-url`

Response `200`:
```json
{
  "url": "https://...r2.cloudflarestorage.com/...?X-Amz-...",
  "expiresAt": "2026-04-25T09:27:03.000Z"
}
```

- Presigned GET URL, TTL 15 minutes. R2 serves bytes directly, supporting
  HTTP Range for seeking — critical for iOS background playback and the
  click-to-seek UX. The frontend sets this as `<audio src>`.
- Call site hint: re-fetch when `expiresAt` is within 60 s or on `error`
  event from `<audio>`.
- Errors: `404 track_not_found`, `409 track_not_ready` if
  `status!=='ready'`.

### 5.2 Playlists

#### `GET /playlists`
Query: `limit`, `cursor`, `q` (optional, case-insensitive substring on
`name|description`), `sort` (`createdAt:desc` default; `name:asc`,
`updatedAt:desc`).
Response `200`: `{ items: PlaylistDto[], nextCursor }`.

#### `GET /playlists/{id}`
Response `200`: `PlaylistDto`.

#### `POST /playlists`
```json
{ "name": "Morning", "description": null }
```
Response `201`: `PlaylistDto`. Errors: `400 validation_failed`,
`409 playlist_name_conflict` if the tenant already has a playlist by that
name (among non-deleted).

#### `PATCH /playlists/{id}`
```json
{ "name": "New", "description": "..." }
```
Response `200`: `PlaylistDto`.

#### `DELETE /playlists/{id}`
Soft delete. `204`. Playlist–track rows are kept but hidden from reads.

### 5.3 Playlist tracks

#### `GET /playlists/{id}/tracks`
Query: `limit`, `cursor`. Default sort: `position:asc`.
Response `200`: `{ items: PlaylistTrackDto[], nextCursor }`.
Embeds `track: TrackDto` for efficient playback UI.

#### `POST /playlists/{id}/tracks`
```json
{ "trackId": "trk_01H...", "position": 3 | null }
```
- `position = null` appends at end.
- Otherwise inserts at 1-based `position`; items at and after shift down.
- Rejects duplicate `(playlistId, trackId)` with `409 track_already_in_playlist`.

Response `201`: `PlaylistTrackDto`.

#### `PATCH /playlists/{id}/tracks/{trackId}`
```json
{ "position": 5 }
```
- Dense reorder within the playlist. `position` clamped to `[1, count]`.
- Response `200`: `PlaylistTrackDto`.

#### `DELETE /playlists/{id}/tracks/{trackId}`
Response: `204`. Positions after it compact.

### 5.4 Playback history

Scoped to `(userId, tenantId)`. Events drive the Home page's Continue
Listening and Recently Played sections. One row per `(userId, trackId,
tenantId)` with last-wins semantics on `lastPlayedAt` / `lastPositionMs`;
raw events are not retained long-term.

#### `POST /playback-events`

Batched ingest. Request:
```json
{
  "events": [
    { "trackId": "trk_01H...", "startedAt": "2026-04-25T09:10:00.000Z",
      "positionMs": 0,       "event": "play",     "playlistId": null },
    { "trackId": "trk_01H...", "startedAt": "2026-04-25T09:12:45.000Z",
      "positionMs": 165000,  "event": "progress", "playlistId": null },
    { "trackId": "trk_01H...", "startedAt": "2026-04-25T09:15:30.000Z",
      "positionMs": 330000,  "event": "ended",    "playlistId": null }
  ]
}
```

- `events.length ≤ 50` per call. The client is expected to batch
  `progress` events (e.g. flush every 15 s and on page hide / `pagehide`).
- Server upserts `(userId, tenantId, trackId)` with
  `lastPlayedAt = max(existing, max(events.startedAt))` and
  `lastPositionMs` set from the event with the latest `startedAt`. An
  `ended` event clears `lastPositionMs` to 0 so the track does not appear
  in Continue Listening but still counts as Recently Played.
- Tracks not visible to the caller (wrong tenant, soft-deleted) are
  silently dropped; no 4xx for stale client buffers.

Response: `204`.

Errors: `400 validation_failed` on malformed events.

#### `GET /me/recent-tracks`
Query: `limit` (default 20, max 50), `cursor`.
Response `200`: `{ items: RecentTrackDto[], nextCursor }`, sorted
`lastPlayedAt:desc`. Filters soft-deleted tracks out.

#### `GET /me/continue-listening`
Query: `limit` (default 10, max 20). No cursor (short list by design).
Response `200`: `{ items: RecentTrackDto[] }`, sorted `lastPlayedAt:desc`,
including only rows with `lastPositionMs > 0` and
`lastPositionMs < track.durationMs - 15_000` (i.e. meaningfully resumable).

### 5.5 Queue

Queue is persisted per `(userId, tenantId)`, not per device. It is scoped to the
session's active tenant and only contains ready, non-deleted tracks.

#### `GET /queue`

Response `200`: `QueueStateDto`.

Items are returned in dense `position:asc` order. `currentItemId` is `null` when
the queue is empty or no current item has been selected.

#### `POST /queue/items`

Adds one or more ready tracks to the end of the queue, or inserts them before a
requested 1-based position.

Request:
```json
{ "trackIds": ["trk_01H..."], "position": null }
```

- `trackIds.length` must be 1..100.
- `position = null` appends after the current tail.
- When `position` is provided, the inserted tracks occupy that position and
  existing items at or after it shift down.
- Wrong-tenant, pending, or soft-deleted tracks are rejected.

Response `201`: `QueueStateDto`.

Errors: `400 validation_failed`, `404 track_not_found`, `409 track_not_ready`.

#### `PATCH /queue/items/{id}`

Updates one queue item's position and/or current marker.

Request:
```json
{ "position": 3, "isCurrent": true }
```

- Both fields are optional, but at least one must be present.
- `position` is clamped to `[1, queue length]`.
- Setting `isCurrent: true` clears the current marker from all sibling queue
  items for the same `(userId, tenantId)`.
- Setting `isCurrent: false` clears the marker from this item only.

Response `200`: `QueueStateDto`.

Errors: `400 validation_failed`, `404 queue_item_not_found`.

#### `DELETE /queue/items/{id}`

Removes one queue item and compacts following positions. If it was the current
item, `currentItemId` becomes `null`.

Response `200`: `QueueStateDto`. Missing item returns `404 queue_item_not_found`.

#### `DELETE /queue`

Clears the current user's queue for the active tenant. Response: `204`.

### 5.6 Unified search

The Home page search box queries tracks and playlists together. Library
and Playlists pages can keep using the per-resource `q` on
`GET /tracks` and `GET /playlists` for filtered lists.

#### `GET /search`
Query: `q` (required, ≥ 1 char), `limit` (default 20, max 50), `cursor`,
`kinds` (optional comma-separated subset of `track,playlist`; default
both).

Response `200`:
```json
{
  "items": [
    { "kind": "track",    "track":    { /* TrackDto */ } },
    { "kind": "playlist", "playlist": { /* PlaylistDto */ } }
  ],
  "nextCursor": null
}
```

Ranking: prefix match on title/name beats substring match; ties broken
by `updatedAt:desc`. Implementation is a simple SQL query today (D1 has
no full-text); revisit if the library grows beyond a few thousand rows.

Errors: `400 validation_failed` if `q` empty.

### 5.7 Preferences

Preferences are scoped to the signed-in user, not to a tenant. They drive
Settings, localization, playback defaults, and initial SSR rendering.

#### `GET /me/preferences`

Response `200`: `PreferencesDto`. Creates a default preference row lazily if
one does not exist.

#### `PATCH /me/preferences`

Editable fields: `language`, `autoPlayNext`, `showMiniPlayer`,
`preferSyncedLyrics`, `defaultLibrarySort`. All optional; omitted fields are
unchanged.

```json
{ "language": "zh", "autoPlayNext": false }
```

Response `200`: `PreferencesDto`.

---

## 6. Admin

All routes below require `is_admin = true` on the signed-in user.
Unauthorized callers receive `403 admin_required`.

Every mutating admin route writes one `audit_logs` row. The `meta` object
captures the request body (with secrets redacted: `password`, tokens).

### 6.1 Users

#### `GET /admin/users`
Query: `limit`, `cursor`, `q` (email/displayName substring),
`includeInactive`. Response: `{ items: AdminUserListItemDto[], nextCursor }`.

#### `GET /admin/users/{id}`
Response: `AdminUserDetailDto`.

#### `POST /admin/users`
```json
{ 
  "email": "x@y.com", 
  "password": "...", 
  "displayName": "X", 
  "isAdmin": false,
  "initialMembership": {
    "tenantId": "tnt_01H...",
    "role": "member"
  }
}
```
Validation: email format; password ≥ 12 chars (or your configured policy).
`initialMembership` is optional; when present its `role` is `"owner"`,
`"member"`, or `"viewer"`.
Response `201`: `UserDto`.
Errors: `409 email_conflict`, `422 weak_password`.
Audit: `user.create`.

#### `PATCH /admin/users/{id}`
Editable: `email`, `displayName`, `isAdmin`, `isActive`.
An admin cannot demote themselves (`isAdmin: false` on own id) or deactivate
themselves (`422 cannot_self_downgrade`).
Response: `UserDto`. Audit: `user.update`.

#### `POST /admin/users/{id}/reset-password`
```json
{ "newPassword": "..." }
```
Response: `204`. Revokes all sessions for the target user. Audit:
`user.reset_password`.

#### `DELETE /admin/users/{id}`
Soft delete; revokes all sessions; removes the user from all tenant
memberships (memberships soft-deleted too). Uploaded tracks, playlist records,
and other shared workspace content created by the user remain visible to other
authorized workspace users. `204`. Audit: `user.delete`. Self-delete rejected
`422 cannot_self_delete`.

### 6.2 Tenants

#### `GET /admin/tenants`
Query: `limit`, `cursor`, `q`. Response:
`{ items: AdminTenantListItemDto[], nextCursor }`.

#### `GET /admin/tenants/{id}`
Response: `TenantDto`.

#### `POST /admin/tenants`
```json
{ "name": "Acme Family", "ownerUserId": "usr_01H..." }
```
- A membership with `role='owner'` is created atomically. Tenants cannot be
  created without an initial owner.
- Response `201`: `{ tenant: TenantDto, ownership: TenantMembershipDto }`.
- Errors: `404 user_not_found`.
- Audit: `tenant.create`.

#### `PATCH /admin/tenants/{id}`
Editable: `name`. Response: `TenantDto`. Audit: `tenant.update`.

#### `DELETE /admin/tenants/{id}`
Soft delete. Tracks and playlists in the tenant are cascade-soft-deleted
(mark `deleted_at`). Active sessions with this as `active_tenant_id` have
their `active_tenant_id` set to `null`. `204`. Audit: `tenant.delete`.

### 6.3 Tenant membership

Owner role does **not** grant membership management. All membership changes
are admin-only.

#### `GET /admin/tenants/{id}/members`
Response: `{ items: (TenantMembershipDto & { user: UserDto })[], nextCursor }`.

#### `POST /admin/tenants/{id}/members`
```json
{ "userId": "usr_01H...", "role": "member" }
```
`role` may be `"owner"`, `"member"`, or `"viewer"`. Response `201`:
`TenantMembershipDto`. Errors: `404 user_not_found`, `409 already_member`.
Audit: `membership.create`.

#### `PATCH /admin/tenants/{id}/members/{userId}`
```json
{ "role": "owner" }
```
`role` may be `"owner"`, `"member"`, or `"viewer"`.
Response: `TenantMembershipDto`. Demoting the last owner is rejected with
`422 cannot_remove_last_owner`. Audit: `membership.update`.

#### `DELETE /admin/tenants/{id}/members/{userId}`
Soft-deletes the membership. Sessions with this tenant active drop
`active_tenant_id`. Removing the last owner is rejected with
`422 cannot_remove_last_owner`. `204`. Audit: `membership.delete`.

### 6.4 Audit logs

#### `GET /admin/audit-logs`
Query: `limit`, `cursor`, `actorId`, `tenantId`, `action`, `targetType`,
`from` (ISO), `to` (ISO).
Response: `{ items: AuditLogDto[], nextCursor }`. Sort: `createdAt:desc`.
Append-only; no write endpoint.

---

## 7. Upload flow (summary)

```
┌─browser──────┐    ┌─BFF (Pages)───┐    ┌─Worker───┐    ┌─R2───┐
│              │    │               │    │          │    │      │
│ select file  │───▶│ /api/tracks   │───▶│ /tracks  │    │      │
│              │    │   (init)      │    │  insert  │    │      │
│              │◀───│               │◀───│  presign │    │      │
│ PUT {url}    │─────────────────────────────────────────▶│ put  │
│              │◀─────────────────────────────────────────│ 200  │
│              │───▶│ /api/tracks/  │───▶│ /finalize│───▶│ HEAD │
│              │    │   {id}/fin.   │    │  verify  │◀───│      │
│              │◀───│               │◀───│  flip    │    │      │
└──────────────┘    └───────────────┘    └──────────┘    └──────┘
```

Client responsibility:
1. Call `POST /tracks` with metadata and optional `coverContentType`.
2. `PUT` file bytes directly to `upload.url` with the exact
   `Content-Type` and `Content-Length`.
3. If `coverUpload` is present, `PUT` cover bytes directly to that URL.
4. On R2 success, call `POST /tracks/{id}/finalize` with
   `durationMs` (read from `HTMLAudioElement.duration` after loading
   metadata client-side), optional `lyricsLrc`, and `coverUploaded`.

Failure modes the client must handle:
- R2 PUT times out / 4xx → surface error, allow retry. The track row stays
  `pending`; finalize is never called; GC cleans up after 1 h.
- Finalize returns `424 upload_missing` → prompt user to re-upload (the
  token probably expired before they finished).
- Finalize returns `409 track_already_finalized` → idempotent success,
  treat as OK.

---

## 8. Streaming flow

```
<audio>.src = (await GET /tracks/{id}/stream-url).url
```

R2 serves the bytes with Range support. The Worker is out of the hot path.
Re-fetch `stream-url` on `<audio>` `error` or when the cached URL is
within 60 s of expiry.

Media Session metadata (title/artist/album) comes from the `TrackDto`
returned by `GET /tracks/{id}`, not from the audio stream itself.

---

## 9. Error code reference

| HTTP | `code`                       | When                                             |
| ---- | ---------------------------- | ------------------------------------------------ |
| 400  | `validation_failed`          | Body fails schema; `fields` populated            |
| 401  | `unauthenticated`            | Missing / invalid session                        |
| 401  | `invalid_credentials`        | Wrong email/password on signin or change-pw      |
| 403  | `account_disabled`           | User `isActive=false`                            |
| 403  | `admin_required`             | Non-admin hit `/admin/*`                         |
| 403  | `no_active_tenant`           | Session has `active_tenant_id = null`            |
| 403  | `tenant_forbidden`           | User not a member of active tenant               |
| 403  | `insufficient_role`          | Viewer attempted editor-only tenant mutation     |
| 403  | `forbidden_origin`           | `Origin` header mismatch on mutation             |
| 404  | `not_found`                  | Generic; also used for resource-specific forms   |
| 404  | `user_not_found`             | Admin ops referencing a missing user             |
| 404  | `tenant_not_found`           | Switch/admin ops referencing a missing tenant    |
| 404  | `track_not_found`            | Track missing or not visible                     |
| 404  | `queue_item_not_found`       | Queue item missing or not visible                |
| 409  | `email_conflict`             | Admin create user, email in use                  |
| 409  | `already_member`             | Admin add membership, row exists                 |
| 409  | `playlist_name_conflict`     | Create/rename into an existing name              |
| 409  | `track_already_in_playlist`  | Duplicate playlist-track                         |
| 409  | `track_already_finalized`    | Second `/finalize` call                          |
| 409  | `track_not_ready`            | Stream or queue operation references pending track |
| 413  | `payload_too_large`          | Upload exceeds `MAX_AUDIO_BYTES`                 |
| 415  | `unsupported_media_type`     | Non-allowed audio MIME                           |
| 422  | `weak_password`              | Password fails policy                            |
| 422  | `cannot_self_downgrade`      | Admin tried to demote/deactivate themselves      |
| 422  | `cannot_self_delete`         | Admin tried to delete themselves                 |
| 422  | `cannot_remove_last_owner`   | Admin tried to remove/demote a tenant's last owner |
| 424  | `upload_missing`             | `/finalize` but R2 object absent                 |
| 429  | `rate_limited`               | Auth rate limit exceeded                         |
| 500  | `internal_error`             | Fallback; logged with request id                 |

---

## 10. Backend file layout

API is organized by feature per `AGENTS.md`:

```
backend/src/
  auth/            password.ts, session.ts (present)
  users/
    users.orm.ts         drizzle schema
    users.type.ts        UserDto and feature domain types
    users.dto.ts         input/output schemas and mappers
    users.repository.ts  SELECT/INSERT/UPDATE functions, no business logic
    users.service.ts     password policy, hashing, domain rules
    users.route.ts       Hono subapp mounting /auth/*
  tenants/
    tenants.orm.ts         tenants, memberships
    tenants.type.ts
    tenants.dto.ts
    tenants.repository.ts
    tenants.service.ts
    tenants.route.ts       mounts /auth/switch-tenant here (tenant domain)
  tracks/
    tracks.orm.ts
    tracks.type.ts
    tracks.dto.ts
    tracks.repository.ts
    tracks.service.ts     presign, finalize, soft-delete, lyrics, covers, stream-url
    tracks.route.ts       /tracks/*
  playlists/
    playlists.orm.ts         playlists, playlist_tracks
    playlists.type.ts
    playlists.dto.ts
    playlists.repository.ts
    playlists.service.ts     reorder arithmetic, dense positions
    playlists.route.ts       /playlists/*
  playback/
    playback.orm.ts         playback_history (userId, tenantId, trackId, last*)
    playback.type.ts        PlaybackEventInput, RecentTrackDto
    playback.dto.ts
    playback.repository.ts
    playback.service.ts     last-wins upsert, continue-listening filter
    playback.route.ts       /playback-events, /me/recent-tracks, /me/continue-listening
  queue/
    queue.orm.ts         queue_items
    queue.type.ts        QueueItemDto, QueueStateDto
    queue.dto.ts
    queue.repository.ts  queue reads/writes scoped by user + tenant
    queue.service.ts     add/remove/reorder/current, dense position DTOs
    queue.route.ts       /queue/*
  search/
    search.type.ts    SearchHitDto
    search.dto.ts
    search.service.ts ranking heuristic across tracks + playlists
    search.route.ts   /search
  prefs/
    prefs.orm.ts         user_preferences
    prefs.type.ts        PreferencesDto
    prefs.dto.ts
    prefs.repository.ts
    prefs.service.ts     user preference defaults and updates
    prefs.route.ts       /me/preferences
  admin/
    admin.type.ts
    admin.dto.ts
    admin.service.ts     audit wrappers over per-feature services
    admin.route.ts       /admin/*
  audit/
    audit.orm.ts
    audit.type.ts
    audit.dto.ts
    audit.repository.ts
    audit.route.ts       /admin/audit-logs (read-only)
  middleware/
    middleware.type.ts
    middleware.service.ts
  index.ts         compose subapps, wire middleware
```

Style: FP with domained types and HOFs per `AGENTS.md`. Services are
pure functions `(deps) => (input) => Result<T, DomainError>`; routes are
thin adapters from HTTP to service call. Tests live alongside as
`*.test.ts` and are written first (TDD).
