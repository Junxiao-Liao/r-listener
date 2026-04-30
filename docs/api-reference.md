# API

Backend = Hono Worker. All endpoints live under `/api/*` on the Worker. The
same Worker also serves the static SPA via the `[assets]` binding, so the
browser, the SPA, and the API all share one origin. The browser calls the
API directly with `fetch('/api/...')`; the session cookie is first-party.

---

## 1. Conventions

### 1.1 Base URL

All routes are mounted under `/api` on the Worker origin (e.g.
`https://r-listener.<account>.workers.dev/api/...`). No versioning prefix
yet — add `/v1` only when the first breaking change ships.

### 1.2 Transport & content type

- `Content-Type: application/json; charset=utf-8` for request and response
  bodies, except track audio uploads (`multipart/form-data` to
  `POST /tracks`, proxied by the Worker to R2) and streaming
  (`GET /tracks/{id}/stream`, raw bytes piped from R2 with Range support).
- Timestamps: **ISO-8601 UTC strings** on the wire (`2026-04-25T09:12:03.000Z`).
  Stored as unix seconds in D1 (`integer('created_at', { mode: 'timestamp' })`).
- IDs: opaque strings. Convention: prefixed UUIDv7 generated at insert time;
  never expose D1 rowid.
- All mutation endpoints are idempotent at the shape level: repeated
  create-with-same-input returns 409, repeated delete on missing row
  returns 404 (not 204), repeated toggle endpoints are PATCH.

### 1.3 Response shape

Single resource: the resource object directly.

```json
{ "id": "trk_018f...", "title": "Song", ... }
```

List: `{ items, nextCursor }`. `nextCursor` is `null` when no more.

```json
{ "items": [ ... ], "nextCursor": "eyJ0IjoxNzE..." }
```

Mutations that have no meaningful body return `204 No Content`.

### 1.4 Errors

Uniform shape on any non-2xx response:

```json
{ "error": { "code": "invalid_credentials", "message": "Username or password is wrong." } }
```

For validation failures, a `fields` map may be added:

```json
{ "error": { "code": "validation_failed", "message": "Invalid input.",
             "fields": { "username": "Invalid username." } } }
```

`code` is stable (client switches on it). `message` is human-readable and may
change. HTTP status is authoritative for category; `code` is authoritative
for precise reason.

Canonical codes are listed in §9.

### 1.5 Pagination

Cursor-based. Every list endpoint accepts:

- `limit` — integer, default 50, max 200
- `cursor` — opaque string from a prior response's `nextCursor`

Cursors are opaque server-generated blobs encoding the next page boundary.
Clients never interpret them.

### 1.6 Authentication

Session cookie only. Named `session`; value is a 20-byte base32 token. The
backend owns the cookie end-to-end: it issues `Set-Cookie` on `/api/auth/signin`,
clears it on `/api/auth/signout`, rolls it on rolling refresh, and stores
SHA-256 of the token in `sessions` (see `backend/src/auth/session.ts`). The
SPA never sees the token — `fetch` sends the cookie automatically because
the API and the SPA share one origin.

- `HttpOnly; Secure; SameSite=Lax; Path=/`
- Expiry: 30 days rolling. Every authed request that is ≥1 day older than
  the last refresh extends the session row by 30 days and re-emits
  `Set-Cookie` with the new expiry.

Every request outside `/api/auth/signin` and `/api/health` requires a valid
session. 401 + `{code:'unauthenticated'}` otherwise.

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

The SPA and the API are same-origin (one Worker), so the session cookie
is first-party with `SameSite=Lax`. Cross-origin POSTs from other sites
will not carry the cookie. No `Origin` enforcement is needed.

### 1.9 Rate limits

All `/api/auth/*` routes are limited to 10 requests / minute / IP via a
KV counter. 429 + `{code:'rate_limited'}`.

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
type Id<K extends string> = string; // e.g. Id<"user"> = "usr_018f..."
type Cursor = string;           // opaque

// Users ---------------------------------------------------------------
type UserDto = {
  id: Id<"user">;
  username: string;
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
  theme: "system" | "light" | "dark";
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
  coverUrl: string | null;    // currently null; cover support is deferred
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
```

---

## 3. Health

### `GET /api/health`
No auth. `200 { "ok": true }`. Already scaffolded.

---

## 4. Auth

### `POST /api/auth/signin`

Request:
```json
{ "username": "alice", "password": "..." }
```

Response `200`:
```json
{
  "user": { /* UserDto */ },
  "tenants": [ /* TenantMembershipDto[] */ ],
  "preferences": { /* PreferencesDto */ },
  "activeTenantId": "tnt_018f..." | null,
  "sessionExpiresAt": "2026-05-25T09:12:03.000Z"
}
```

- The backend issues `Set-Cookie: session=<token>; HttpOnly; Secure;
  SameSite=Lax; Path=/; expires=<sessionExpiresAt>`. The token is never
  in the response body — the browser stores the cookie automatically.
- `activeTenantId` is a **suggested pre-selection** for the Tenant Picker:
  the last-used tenant from a prior session if still valid and the user is
  still a member; otherwise the first membership; otherwise `null` (user
  has no memberships — admins only).
- The session's `active_tenant_id` is bound only for **single-workspace
  users** (set to their sole membership). For multi-workspace users the
  session row is created with `active_tenant_id = null`; the picker calls
  `POST /api/auth/switch-tenant` on tap to bind it. The signin response
  `activeTenantId` is purely a UI hint for which card to highlight.
- Errors: `401 invalid_credentials`, `403 account_disabled`,
  `429 rate_limited`.

### `GET /api/auth/session`

Auth: session required.

Response `200`:
```json
{
  "user": { /* UserDto */ },
  "tenants": [ /* TenantMembershipDto[] */ ],
  "preferences": { /* PreferencesDto */ },
  "activeTenantId": "tnt_018f..." | null,
  "sessionExpiresAt": "2026-05-25T09:12:03.000Z"
}
```

- Validates the `session` cookie, applies the normal rolling refresh rule,
  and returns the current app-shell state. The SPA uses this as the single
  source of truth for current user, active tenant, and preferences.
- When the rolling refresh fires, the backend re-emits `Set-Cookie` with
  the new expiry on the same response — the browser updates the cookie
  transparently. Clients do nothing special.
- Platform admins may have zero memberships. In that case `tenants` may be
  empty and `activeTenantId` may be `null`; the frontend Tenant Picker should
  let admins browse all tenants by calling the admin tenant list endpoint.
- Errors: `401 unauthenticated`, `403 account_disabled`.

### `POST /api/auth/signout`

Auth: session required.
Response: `204`. Deletes the current session row and emits `Set-Cookie`
with an expired `Max-Age` to clear the browser cookie.

### `POST /api/auth/switch-tenant`

Auth: session required.
Request:
```json
{ "tenantId": "tnt_018f..." }
```
Response `200`:
```json
{ "user": { ... }, "activeTenantId": "tnt_018f..." }
```

- Non-admin: 403 `tenant_forbidden` if not a member.
- Admin: may switch to any tenant (including tenants they're not a member of).
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

Password policy for new passwords: at least 12 characters and at least 3 of
lowercase, uppercase, digit, symbol.

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
Query: `limit` (default 50, max 100), `cursor` (opaque, exclusive), `q`
(optional, case-insensitive substring on `title|artist|album`), `sort`
(`createdAt:desc` default; any of `title|artist|album|year|durationMs|createdAt|updatedAt`
× `asc|desc`), `includePending` (boolean, default false).

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

#### `POST /tracks` — **upload (step 1 of 2): Worker-proxied audio bytes**

`Content-Type: multipart/form-data` with these parts:

| field    | required | description                                                     |
|----------|----------|-----------------------------------------------------------------|
| `file`   | yes      | The raw audio bytes. `file.name` is used as the title fallback. |
| `title`  | no       | Optional override. Falls back to `file.name` minus extension.   |
| `artist` | no       | Optional.                                                       |
| `album`  | no       | Optional.                                                       |

Validation (server-side):
- `file.type ∈ { audio/mpeg, audio/mp4, audio/mp3, audio/ogg, audio/flac,
  audio/wav, audio/x-wav, audio/aac, audio/x-m4a, audio/webm }`
- `file.size <= MAX_AUDIO_BYTES` (default 100 MiB) and `> 0`
- `title`/`artist`/`album` non-empty when present (1..200 chars)

The Worker writes the bytes to R2 at
`tenants/{tenantId}/tracks/{trackId}.{ext}` and inserts a row with
`status='pending'`. There is **no** S3-presigned URL flow; clients send the
audio directly to the Worker.

Response `201`: `TrackDto` with `status='pending'`.

Errors: `400 validation_failed` / `400 upload_missing`,
`413 payload_too_large`, `415 unsupported_media_type`.

#### `POST /tracks/{id}/finalize` — step 2 of 2

Request:
```json
{
  "durationMs": 215432,
  "lyricsLrc": "[ti:...]\n[00:12.34]line\n..." | undefined,
  "trackNumber": 1 | undefined,
  "genre": "Rock" | undefined,
  "year": 2026 | undefined
}
```

Server actions:
1. Look up the pending track row and `HEAD` its R2 object; reject with
   `400 upload_missing` if the audio is gone (the client should re-upload).
2. Trust `durationMs` from client; validate `> 0` and `<= 6 h`.
3. Parse `lyricsLrc` (when present) to derive `lyricsStatus`
   (`none`, `synced`, `plain`, or `invalid`) — see "lyrics status detection"
   below.
4. Flip `status` to `'ready'`, persist `durationMs`, lyrics fields,
   `trackNumber`, `genre`, `year`, `updatedAt = now`.

Response `200`: `TrackDto` with `status:'ready'`.

Errors:
- `404 track_not_found`
- `409 track_already_finalized` if `status='ready'`
- `400 upload_missing` if the R2 object is gone

> **On duration:** computed server-side is nice-to-have but ffprobe-wasm
> on Workers is heavyweight. For now the client reports `durationMs`
> (trivial via `HTMLAudioElement.duration` at upload time, or
> `music-metadata-browser`) and we validate range. A later Queue
> consumer can re-derive authoritatively.

**Lyrics status detection** (uses `lrc-kit`, mirrored client-side for preview):
- empty/whitespace → `none`
- at least one timed lyric parsed by `lrc-kit` → `synced`
- unsynced text with real text content → `plain`
- all non-metadata lines are empty bracket tags (no text after `]`) → `invalid`
- metadata-only (e.g. `[ti:...]\n[ar:...]`) → `none`

#### `PATCH /tracks/{id}`

Editable fields: `title`, `artist`, `album`, `trackNumber`, `genre`,
`year`, `durationMs`. All optional; omitted fields unchanged; `null`
clears nullable fields.

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

#### Cover endpoints — **deferred**

`POST /tracks/{id}/cover-upload`, `POST /tracks/{id}/cover-finalize`, and
`DELETE /tracks/{id}/cover` are not implemented in the current slice.
`coverR2Key` stays `null` and `coverUrl` is always `null`. The frontend
renders a deterministic colored placeholder derived from the track title
when no cover exists.

#### `DELETE /tracks/{id}`

Soft delete: sets `deleted_at`. R2 object retained for later GC.
Response: `204`. Idempotent: second call returns `404 not_found`.

#### `GET /tracks/{id}/stream` — **Worker-proxied audio stream**

Returns the raw audio bytes as `application/octet-stream`-typed (with the
track's stored `Content-Type` echoed back) `ReadableStream` piped from R2.
Supports HTTP `Range` for seeking — critical for iOS background playback
and the click-to-seek UX. The frontend sets this as
`<audio src="/api/tracks/{id}/stream">` — the cookie is first-party so
auth works without any extra plumbing.

- Returns `200` with full body, `Content-Length` and `Accept-Ranges: bytes`.
- Returns `206` with `Content-Range` when a `Range` header is present.
- There is no presigned URL or expiry — the SPA does not need to refresh
  stream URLs.
- Errors: `404 track_not_found`, `404 track_not_ready` if
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
{ "trackId": "trk_018f...", "position": 3 | null }
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
    { "trackId": "trk_018f...", "startedAt": "2026-04-25T09:10:00.000Z",
      "positionMs": 0,       "event": "play",     "playlistId": null },
    { "trackId": "trk_018f...", "startedAt": "2026-04-25T09:12:45.000Z",
      "positionMs": 165000,  "event": "progress", "playlistId": null },
    { "trackId": "trk_018f...", "startedAt": "2026-04-25T09:15:30.000Z",
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
- Tracks not visible to the caller (wrong tenant, pending, soft-deleted) are
  silently dropped; no 4xx for stale client buffers.

Response: `204`.

Errors: `400 validation_failed` on malformed events.

#### `GET /me/recent-tracks`
Query: `limit` (default 20, max 50), `cursor`.
Response `200`: `{ items: RecentTrackDto[], nextCursor }`, sorted
`lastPlayedAt:desc`. Filters soft-deleted tracks out.

#### `GET /me/continue-listening`
Query: `limit` (default 10, max 20). No cursor (short list by design).
Response `200`: `{ items: RecentTrackDto[], nextCursor: null }`, sorted
`lastPlayedAt:desc`, including only rows with `lastPositionMs > 0` and
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
{ "trackIds": ["trk_018f..."], "position": null }
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

The Home page search box navigates to `/search?q=...`, where the SPA queries
tracks and playlists together. Library and Playlists pages can keep using the
per-resource `q` on `GET /tracks` and `GET /playlists` for filtered lists.

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
by `updatedAt:desc`. Track search matches title, artist, and album. Playlist
search matches name and description. The response remains a mixed `items`
array; the current UI groups the hits into Tracks and Playlists sections.
Implementation is simple D1 SQL plus an in-service ranking pass today (D1 has
no full-text); revisit if the library grows beyond a few thousand rows.

Errors: `400 validation_failed` if `q` empty.

### 5.7 Preferences

Preferences are scoped to the signed-in user, not to a tenant. They drive
Settings, localization, theme selection, and playback defaults.

The backend contract is `GET /api/me/preferences` and
`PATCH /api/me/preferences`. The settings page calls them directly via
`useUpdatePreferencesMutation` (see `frontend/src/shared/query/prefs.query.ts`).
On a successful patch the mutation invalidates the `['session']` query, sets
the `theme` and `PARAGLIDE_LOCALE` cookies client-side (so the inline
`<head>` script applies them on next cold load), and runs Paraglide
`setLocale` and `applyTheme` for the live UI.

#### `GET /api/me/preferences`

Response `200`: `PreferencesDto`. Creates a default preference row lazily if
one does not exist.

#### `PATCH /api/me/preferences`

Editable fields: `language`, `theme`, `autoPlayNext`, `showMiniPlayer`,
`preferSyncedLyrics`, `defaultLibrarySort`. All optional; omitted fields are
unchanged.

```json
{ "language": "zh", "theme": "dark", "autoPlayNext": false }
```

Response `200`: `PreferencesDto`.

---

## 6. Admin

All routes below require `is_admin = true` on the signed-in user.
Unauthorized callers receive `403 admin_required`.

### 6.1 Users

#### `GET /admin/users`
Query: `limit`, `cursor`, `q` (username substring),
`includeInactive`. Response: `{ items: AdminUserListItemDto[], nextCursor }`.

#### `GET /admin/users/{id}`
Response: `AdminUserDetailDto`.

#### `POST /admin/users`
```json
{ 
  "username": "alice", 
  "password": "...", 
  "isAdmin": false,
  "initialMembership": {
    "tenantId": "tnt_018f...",
    "role": "member"
  }
}
```
Validation: username is trimmed, lowercased, 3-32 characters, and may contain only `a-z`, `0-9`, `_`, and `-`; password ≥ 12 chars (or your configured policy).
`initialMembership` is optional; when present its `role` is `"owner"`,
`"member"`, or `"viewer"`.
Response `201`: `UserDto`.
Errors: `409 username_conflict`, `422 weak_password`.

#### `PATCH /admin/users/{id}`
Editable: `username`, `isAdmin`, `isActive`.
An admin cannot demote themselves (`isAdmin: false` on own id) or deactivate
themselves (`422 cannot_self_downgrade`).
Response: `UserDto`.

#### `POST /admin/users/{id}/reset-password`
```json
{ "newPassword": "..." }
```
Response: `204`. Revokes all sessions for the target user.

#### `DELETE /admin/users/{id}`
Soft delete; revokes all sessions; removes the user from all tenant
memberships (memberships soft-deleted too). Uploaded tracks, playlist records,
and other shared workspace content created by the user remain visible to other
authorized workspace users. `204`. Self-delete rejected
`422 cannot_self_delete`.

### 6.2 Tenants

#### `GET /admin/tenants`
Query: `limit`, `cursor`, `q`. Response:
`{ items: AdminTenantListItemDto[], nextCursor }`.

#### `GET /admin/tenants/{id}`
Response: `TenantDto`.

#### `POST /admin/tenants`
```json
{ "name": "Acme Family", "ownerUserId": "usr_018f..." }
```
- A membership with `role='owner'` is created atomically. Tenants cannot be
  created without an initial owner.
- Response `201`: `{ tenant: TenantDto, ownership: TenantMembershipDto }`.
- Errors: `404 user_not_found`.

#### `PATCH /admin/tenants/{id}`
Editable: `name`. Response: `TenantDto`.

#### `DELETE /admin/tenants/{id}`
Soft delete. Tracks and playlists in the tenant are cascade-soft-deleted
(mark `deleted_at`). Active sessions with this as `active_tenant_id` have
their `active_tenant_id` set to `null`. `204`.

### 6.3 Tenant membership

Owner role does **not** grant membership management. All membership changes
are admin-only.

#### `GET /admin/tenants/{id}/members`
Response: `{ items: (TenantMembershipDto & { user: UserDto })[], nextCursor }`.

#### `POST /admin/tenants/{id}/members`
```json
{ "userId": "usr_018f...", "role": "member" }
```
`role` may be `"owner"`, `"member"`, or `"viewer"`. Response `201`:
`TenantMembershipDto`. Errors: `404 user_not_found`, `409 already_member`.

#### `PATCH /admin/tenants/{id}/members/{userId}`
```json
{ "role": "owner" }
```
`role` may be `"owner"`, `"member"`, or `"viewer"`.
Response: `TenantMembershipDto`. Demoting the last owner is rejected with
`422 cannot_remove_last_owner`.

#### `DELETE /admin/tenants/{id}/members/{userId}`
Soft-deletes the membership. Sessions with this tenant active drop
`active_tenant_id`. Removing the last owner is rejected with
`422 cannot_remove_last_owner`. `204`.

## 7. Upload flow (summary)

```
┌─browser──────┐                          ┌─Worker───┐    ┌─R2───┐
│ select file  │                          │          │    │      │
│ parse meta   │── multipart ────────────▶│ POST     │── put ───▶│
│              │                          │ /tracks  │    │      │
│              │◀─── TrackDto pending ────│          │    │      │
│              │── JSON ─────────────────▶│ POST     │── head ─▶│
│              │                          │ /tracks/ │◀──── ok ──│
│              │                          │  {id}/   │    │      │
│              │◀─── TrackDto ready ──────│ finalize │    │      │
└──────────────┘                          └──────────┘    └──────┘
```

Client responsibility:
1. Parse audio metadata in the browser (e.g. `music-metadata-browser`)
   to get title/artist/album/durationMs/embedded lyrics/cover. The Upload
   Review screen lets the user fix title/artist/album before sending.
2. `POST /api/tracks` as `multipart/form-data` with `file` plus optional
   `title`/`artist`/`album`. The Worker streams the bytes to R2 itself.
3. `POST /api/tracks/{id}/finalize` with `durationMs` and optional
   `lyricsLrc`, `trackNumber`, `genre`, `year`. The server derives
   `lyricsStatus` from the LRC text.

Sibling `.lrc` files paired with audio by base filename override
embedded lyrics tags; if neither is present, `lyricsLrc` is omitted.

Failure modes the client must handle:
- `POST /tracks` times out / 4xx → surface error, allow retry. No row
  is created on a 4xx; on a 5xx after the row was inserted the track
  stays `pending` and is reachable via `?includePending=true` for retry
  or delete from the Upload Progress screen.
- Finalize returns `400 upload_missing` → the audio object is gone;
  prompt the user to re-upload.
- Finalize returns `409 track_already_finalized` → idempotent success,
  treat as OK.

---

## 8. Streaming flow

```
<audio src="/api/tracks/{id}/stream"></audio>
```

The Worker proxies the R2 object as a `ReadableStream` and forwards
HTTP Range requests so seeking and iOS background playback work
naturally. The session cookie is first-party so `<audio>` requests are
authenticated automatically — no extra fetch, no presigned URL refresh.

Media Session metadata (title/artist/album) comes from the `TrackDto`
returned by `GET /tracks/{id}`, not from the audio stream itself.

---

## 9. Error code reference

| HTTP | `code`                       | When                                             |
| ---- | ---------------------------- | ------------------------------------------------ |
| 400  | `validation_failed`          | Body fails schema; `fields` populated            |
| 401  | `unauthenticated`            | Missing / invalid session                        |
| 401  | `invalid_credentials`        | Wrong username/password on signin or change-pw   |
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
| 409  | `username_conflict`          | Admin create user, username in use               |
| 409  | `already_member`             | Admin add membership, row exists                 |
| 409  | `playlist_name_conflict`     | Create/rename into an existing name              |
| 409  | `track_already_in_playlist`  | Duplicate playlist-track                         |
| 409  | `track_already_finalized`    | Second `/finalize` call                          |
| 404/409 | `track_not_ready`         | Stream or queue operation references pending track |
| 413  | `payload_too_large`          | Upload exceeds `MAX_AUDIO_BYTES`                 |
| 415  | `unsupported_media_type`     | Non-allowed audio MIME                           |
| 422  | `weak_password`              | Password fails policy                            |
| 422  | `cannot_self_downgrade`      | Admin tried to demote/deactivate themselves      |
| 422  | `cannot_self_delete`         | Admin tried to delete themselves                 |
| 422  | `cannot_remove_last_owner`   | Admin tried to remove/demote a tenant's last owner |
| 400  | `upload_missing`             | `POST /tracks` with empty body, or `/finalize` when the R2 object is absent |
| 429  | `rate_limited`               | Auth rate limit exceeded                         |
| 500  | `internal_error`             | Fallback; logged with request id                 |

---
