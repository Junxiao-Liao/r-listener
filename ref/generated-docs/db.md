# Database

Storage = Cloudflare D1 (SQLite). ORM = Drizzle. Audio bytes and cover art
live in R2 and are referenced by key only; D1 holds metadata, identity,
authorization, playback state, preferences, and audit history.

This doc is the contract between the schema and the rest of the app
(`api.md`, `ui-design.md`). It supersedes the placeholder in
`backend/src/db/schema.ts`.

---

## 1. Conventions

### 1.1 IDs

Opaque text primary keys, prefixed by entity for human grepability:

| Entity              | Prefix  | Example                       |
| ------------------- | ------- | ----------------------------- |
| `users`             | `usr_`  | `usr_018f0000-0000-7000-8000-000000000000` |
| `sessions`          | —       | row keyed by token hash       |
| `tenants`           | `tnt_`  | `tnt_018f0000-0000-7000-8000-000000000000` |
| `memberships`       | `mbr_`  | `mbr_018f0000-0000-7000-8000-000000000000` |
| `tracks`            | `trk_`  | `trk_018f0000-0000-7000-8000-000000000000` |
| `playlists`         | `pls_`  | `pls_018f0000-0000-7000-8000-000000000000` |
| `playlist_tracks`   | `plt_`  | `plt_018f0000-0000-7000-8000-000000000000` |
| `playback_history`  | —       | composite `(user, tenant, track)` |
| `queue_items`       | `que_`  | `que_018f0000-0000-7000-8000-000000000000` |
| `user_preferences`  | —       | `user_id` is the PK           |
| `audit_logs`        | `aud_`  | `aud_018f0000-0000-7000-8000-000000000000` |

The body is a UUIDv7 generated at insert time, so IDs sort lexicographically
by creation time. D1 rowid is never exposed.

### 1.2 Time

All timestamp columns are `INTEGER` storing **unix seconds** (Drizzle
`integer({ mode: 'timestamp' })`). The wire DTOs convert to ISO-8601 in
`*.dto.ts` per feature. There is no timezone column anywhere — UTC only.

### 1.3 Soft delete

Every domain row that the user can "delete" carries
`deleted_at INTEGER NULL`. List/get queries always filter
`WHERE deleted_at IS NULL` unless an admin/own-resource flow explicitly
opts in (e.g. a 410 response). R2 objects are kept until a future Cron
Trigger GC.

Hard deletes only happen on `sessions` (row IS the credential — leaking
one is bad) and `playback_history` rows that lose their referenced track
(handled via FK `ON DELETE CASCADE`).

> **Memberships.** Both admin `user.delete` and admin `membership.delete` set
> membership `deleted_at`. We soft-delete uniformly so audit_log entries that
> reference a removed membership stay readable. Reads filter
> `deleted_at IS NULL` so the API contract is preserved. Deleting a user does
> not delete shared workspace content they created, such as uploaded tracks or
> playlists.

### 1.4 Tenant scoping

Every tenant-scoped resource carries a non-null `tenant_id` FK. There is
no global "library" — a track only exists inside one tenant. Cross-tenant
visibility is never granted; admins see other tenants by switching their
session's `active_tenant_id`.

### 1.5 Drizzle module layout

Each feature owns its `*.orm.ts`. Cross-feature FKs are declared via
`references(() => otherTable.id)` and re-exported through a barrel
`backend/src/db/schema.ts` so migrations see one consolidated graph.

```
backend/src/
  users/users.orm.ts          users
  auth/auth.orm.ts            sessions
  tenants/tenants.orm.ts      tenants, memberships
  tracks/tracks.orm.ts        tracks
  playlists/playlists.orm.ts  playlists, playlist_tracks
  playback/playback.orm.ts    playback_history
  queue/queue.orm.ts          queue_items
  prefs/prefs.orm.ts          user_preferences
  audit/audit.orm.ts          audit_logs
  db/schema.ts                re-exports all of the above
```

---

## 2. Tables

### 2.1 `users`

Identity. Email is globally unique (signin happens before tenant
selection). `last_active_tenant_id` lets the signin response default a
returning user back into their previous workspace even after the cookie
expired.

```ts
export const users = sqliteTable('users', {
  id:                  text('id').primaryKey(),
  email:               text('email').notNull(),
  passwordHash:        text('password_hash').notNull(),       // argon2id encoded
  displayName:         text('display_name'),
  isAdmin:             integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  isActive:            integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastActiveTenantId:  text('last_active_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  createdAt:           integer('created_at',  { mode: 'timestamp' }).notNull(),
  updatedAt:           integer('updated_at',  { mode: 'timestamp' }).notNull(),
  deletedAt:           integer('deleted_at',  { mode: 'timestamp' }),
}, (t) => ({
  emailUq:             uniqueIndex('users_email_uq').on(t.email).where(sql`${t.deletedAt} IS NULL`),
}));
```

Notes:
- Email uniqueness is partial: a soft-deleted user does not block a new
  signup with the same email.
- `is_admin = true` plus `deleted_at IS NULL` is the gate for `/admin/*`.
- `is_active = false` produces 403 `account_disabled` on signin.

### 2.2 `sessions`

Oslo-style: client holds a 20-byte base32 token; DB stores SHA-256 hex
of it as the primary key. A leaked DB never leaks a usable cookie.

```ts
export const sessions = sqliteTable('sessions', {
  tokenHash:        text('token_hash').primaryKey(),          // sha256 hex of cookie value
  userId:           text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activeTenantId:   text('active_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  expiresAt:        integer('expires_at',     { mode: 'timestamp' }).notNull(),
  lastRefreshedAt:  integer('last_refreshed_at', { mode: 'timestamp' }).notNull(),
  createdAt:        integer('created_at',     { mode: 'timestamp' }).notNull(),
  userAgent:        text('user_agent'),                       // for password-change "revoke other sessions" UX
  ip:               text('ip'),
}, (t) => ({
  byUser:           index('sessions_user_idx').on(t.userId),
  byExpiry:         index('sessions_expires_idx').on(t.expiresAt),
}));
```

Lifecycle: insert on signin, update `last_refreshed_at` (and slide
`expires_at` by 30 d) when the request is ≥1 d past the last refresh,
`DELETE FROM sessions WHERE token_hash = ?` on signout. On signin, the
session row's `active_tenant_id` is set only when the user has exactly
one membership; multi-workspace users start with `active_tenant_id = null`
and bind it via `POST /auth/switch-tenant` from the Tenant Picker. Password change
deletes all sibling rows for the same `user_id` except the current one.
A future Cron Trigger sweeps `expires_at < now`.

### 2.3 `tenants`

```ts
export const tenants = sqliteTable('tenants', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:  integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt:  integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  nameUq:     uniqueIndex('tenants_name_uq').on(t.name).where(sql`${t.deletedAt} IS NULL`),
}));
```

Tenant deletion cascades a soft delete to its tracks, playlists,
playlist_tracks, memberships, and clears `sessions.active_tenant_id`.
That cascade is service-level (not FK `ON DELETE`), so all writes go
through the same "set deleted_at" path and we keep audit trails.
Tenant creation must atomically create an initial owner membership; ownerless
tenants are not valid in v1.

### 2.4 `memberships`

Join row between users and tenants. Both `(user, tenant)` and the
membership row itself carry an id so `audit_logs.target_id` can point
at it stably.

```ts
export const memberships = sqliteTable('memberships', {
  id:          text('id').primaryKey(),
  userId:      text('user_id').notNull().references(() => users.id,   { onDelete: 'cascade' }),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role:        text('role', { enum: ['owner', 'member', 'viewer'] }).notNull(),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt:   integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  uniq:        uniqueIndex('memberships_user_tenant_uq')
                 .on(t.userId, t.tenantId)
                 .where(sql`${t.deletedAt} IS NULL`),
  byTenant:    index('memberships_tenant_idx').on(t.tenantId),
}));
```

The "last owner cannot be removed/demoted" rule (UI page #24) is enforced
in the service layer with a `SELECT count(*) … role='owner'` precheck
inside the same transaction.

`viewer` is a listen-only tenant role. It grants workspace entry and ready
content reads, but tenant-scoped shared-content writes require `owner` or
`member` unless the caller is a platform admin.

### 2.5 `tracks`

```ts
export const tracks = sqliteTable('tracks', {
  id:           text('id').primaryKey(),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  uploaderId:   text('uploader_id').notNull().references(() => users.id),

  // Core metadata (matches TrackDto)
  title:        text('title').notNull(),
  artist:       text('artist'),
  album:        text('album'),
  durationMs:   integer('duration_ms'),
  contentType:  text('content_type').notNull(),               // audio/mpeg, audio/mp4, audio/aac, audio/webm, ...
  sizeBytes:    integer('size_bytes').notNull(),

  // Extended ID3-style metadata (UI Edit Metadata page)
  trackNumber:  integer('track_number'),
  genre:        text('genre'),
  year:         integer('year'),

  // Lyrics
  lyricsLrc:    text('lyrics_lrc'),                           // raw lyric text; nullable
  lyricsStatus: text('lyrics_status', { enum: ['none', 'synced', 'plain', 'invalid'] })
                  .notNull().default('none'),

  // Asset keys
  audioR2Key:   text('audio_r2_key').notNull(),               // tenants/{tenantId}/tracks/{trackId}.{ext}
  coverR2Key:   text('cover_r2_key'),                         // optional separate cover image

  // Lifecycle
  status:       text('status', { enum: ['pending', 'ready'] }).notNull().default('pending'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt:    integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  byTenant:     index('tracks_tenant_idx').on(t.tenantId, t.deletedAt, t.status),
  byTenantCreatedAt: index('tracks_tenant_created_idx').on(t.tenantId, t.createdAt),
  byTenantTitle:     index('tracks_tenant_title_idx').on(t.tenantId, t.title),
  byTenantArtist:    index('tracks_tenant_artist_idx').on(t.tenantId, t.artist),
  byTenantAlbum:     index('tracks_tenant_album_idx').on(t.tenantId, t.album),
  byPendingCleanup:  index('tracks_pending_cleanup_idx')
                       .on(t.status, t.createdAt),            // Cron Trigger GC
}));
```

`TrackDto` exposes `trackNumber`, `genre`, `year`, a derived presigned
`coverUrl`, `lyricsLrc`, and `lyricsStatus`. The service derives
`lyricsStatus` whenever lyrics are created, replaced, removed, or finalized.

Users are soft-deleted, not physically deleted, so `uploader_id` remains
non-null and historical uploads remain visible to other tenant users after the
uploader is gone.

Supported audio formats are the common private-library set from `api.md`:
MP3, M4A/MP4, AAC, WAV, FLAC, OGG/Opus, and WebM audio.

### 2.6 `playlists`

```ts
export const playlists = sqliteTable('playlists', {
  id:           text('id').primaryKey(),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ownerId:      text('owner_id').notNull().references(() => users.id),
  name:         text('name').notNull(),
  description:  text('description'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt:    integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  nameUq:       uniqueIndex('playlists_tenant_name_uq')
                  .on(t.tenantId, t.name)
                  .where(sql`${t.deletedAt} IS NULL`),         // 409 playlist_name_conflict
  byTenant:     index('playlists_tenant_idx').on(t.tenantId, t.updatedAt),
}));
```

`PlaylistDto.trackCount` and `PlaylistDto.totalDurationMs` are computed
at read time from `playlist_tracks` joined with non-deleted, ready
`tracks`; neither is denormalized.

Playlist covers are not stored — the UI renders a generated cover from the playlist name. There is no cover upload path for playlists.

### 2.7 `playlist_tracks`

Internal column `position_frac` is a `REAL` so reorders touch one row.
The DTO's 1-based `position` is computed at read time via SQL
`ROW_NUMBER() OVER (PARTITION BY playlist_id ORDER BY position_frac)`.

```ts
export const playlistTracks = sqliteTable('playlist_tracks', {
  id:           text('id').primaryKey(),
  playlistId:   text('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  trackId:      text('track_id').notNull().references(() => tracks.id,   { onDelete: 'cascade' }),
  positionFrac: real('position_frac').notNull(),
  addedAt:      integer('added_at',   { mode: 'timestamp' }).notNull(),
  deletedAt:    integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  uniq:         uniqueIndex('playlist_tracks_uq')
                  .on(t.playlistId, t.trackId)
                  .where(sql`${t.deletedAt} IS NULL`),         // 409 track_already_in_playlist
  byPosition:   index('playlist_tracks_position_idx')
                  .on(t.playlistId, t.deletedAt, t.positionFrac),
}));
```

Insert math:
- Append: `positionFrac = (SELECT max(position_frac) ... ) + 1.0` (or
  `1.0` if empty).
- Insert at requested 1-based `k`: read the two neighbours' `position_frac`
  values, set the new row to their midpoint.
- Reorder of an existing row: same midpoint computation against the new
  neighbours.
- Periodic rebalance (or on degenerate gaps `< 1e-9`): rewrite the
  whole partition with `positionFrac = ROW_NUMBER()`.

This keeps writes O(1) for reorders while the API still hands clients
dense 1..N positions.

### 2.8 `playback_history`

One row per `(userId, tenantId, trackId)`. Last-wins semantics. No raw
event log — `progress` events upsert this row; `ended` clears
`lastPositionMs` to 0 (so it leaves Continue Listening but stays in
Recently Played, exactly per the API spec).

```ts
export const playbackHistory = sqliteTable('playback_history', {
  userId:          text('user_id').notNull().references(() => users.id,   { onDelete: 'cascade' }),
  tenantId:        text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  trackId:         text('track_id').notNull().references(() => tracks.id,  { onDelete: 'cascade' }),
  lastPlaylistId:  text('last_playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
  lastPlayedAt:    integer('last_played_at',   { mode: 'timestamp' }).notNull(),
  lastPositionMs:  integer('last_position_ms').notNull(),
  updatedAt:       integer('updated_at',       { mode: 'timestamp' }).notNull(),
}, (t) => ({
  pk:              primaryKey({ columns: [t.userId, t.tenantId, t.trackId] }),
  recent:          index('playback_recent_idx').on(t.userId, t.tenantId, t.lastPlayedAt),
}));
```

Soft-deleted tracks are filtered out at the JOIN with `tracks`, not by
deleting these rows — so undeleting a track later (admin-only path, not
in scope today) would resurface its history naturally.

### 2.9 `queue_items`

Persisted Now Playing queue. One ordered list per `(user_id, tenant_id)`, scoped
to the active tenant. Queue rows may only reference ready, non-deleted tracks in
the same tenant; that readiness rule is enforced in the queue service because it
depends on track status and soft-delete state.

Internal column `position_frac` mirrors playlist ordering: reorders usually touch
one row, while DTOs expose dense 1-based `position` via
`ROW_NUMBER() OVER (PARTITION BY user_id, tenant_id ORDER BY position_frac)`.

```ts
export const queueItems = sqliteTable('queue_items', {
  id:           text('id').primaryKey(),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  trackId:      text('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  positionFrac: real('position_frac').notNull(),
  isCurrent:    integer('is_current', { mode: 'boolean' }).notNull().default(false),
  addedAt:      integer('added_at',   { mode: 'timestamp' }).notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt:    integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  byUserTenantPosition: index('queue_items_user_tenant_position_idx')
    .on(t.userId, t.tenantId, t.deletedAt, t.positionFrac),
  byTrack: index('queue_items_track_idx').on(t.trackId),
  oneCurrent: uniqueIndex('queue_items_one_current_uq')
    .on(t.userId, t.tenantId, t.isCurrent)
    .where(sql`${t.deletedAt} IS NULL AND ${t.isCurrent} = 1`),
}));
```

Operations:
- Add appends after `max(position_frac)` or inserts at the midpoint around a
  requested 1-based position.
- Reorder computes a new midpoint against neighbouring queue rows and rebalances
  the partition when gaps become too small.
- Setting `is_current = true` first clears sibling current markers inside the
  same transaction.
- Remove/clear soft-delete queue rows and compact DTO positions on the next read.

### 2.10 `user_preferences`

UI Settings page (#19) toggles plus language. One row per user; created
lazily on first `GET /me/preferences` or `PATCH /me/preferences`.

```ts
export const userPreferences = sqliteTable('user_preferences', {
  userId:               text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  language:             text('language', { enum: ['en', 'zh'] }).notNull().default('en'),
  autoPlayNext:         integer('auto_play_next',          { mode: 'boolean' }).notNull().default(true),
  showMiniPlayer:       integer('show_mini_player',        { mode: 'boolean' }).notNull().default(true),
  preferSyncedLyrics:   integer('prefer_synced_lyrics',    { mode: 'boolean' }).notNull().default(true),
  defaultLibrarySort:   text('default_library_sort',
                            { enum: ['createdAt:desc', 'title:asc', 'artist:asc', 'album:asc'] })
                          .notNull().default('createdAt:desc'),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

The signin response embeds a sibling `preferences` field so SSR can render
with the right language and defaults on first paint.

### 2.11 `audit_logs`

Append-only. Written by the admin service wrappers. `meta` is a JSON
column with secrets pre-redacted by the wrapper.

```ts
export const auditLogs = sqliteTable('audit_logs', {
  id:          text('id').primaryKey(),
  actorId:     text('actor_id').notNull().references(() => users.id),
  action:      text('action').notNull(),                              // e.g. user.create, tenant.admin_enter
  targetType:  text('target_type', { enum: ['user', 'tenant', 'membership', 'track', 'playlist'] }).notNull(),
  targetId:    text('target_id').notNull(),                           // not FK: target may be soft-deleted
  tenantId:    text('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  meta:        text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  byCreated:   index('audit_logs_created_idx').on(t.createdAt),
  byActor:     index('audit_logs_actor_idx').on(t.actorId, t.createdAt),
  byTenant:    index('audit_logs_tenant_idx').on(t.tenantId, t.createdAt),
  byAction:    index('audit_logs_action_idx').on(t.action, t.createdAt),
  byTarget:    index('audit_logs_target_idx').on(t.targetType, t.targetId),
}));
```

`target_id` is intentionally not an FK because targets get soft-deleted;
the audit row must remain pointing at them.

---

## 3. Cross-cutting integrity rules

These are enforced in the service layer (FP `(deps) => (input) => Result`)
because SQLite cannot express them as constraints:

1. **Last-owner protection.** A tenant must always have ≥1 non-deleted
   membership with `role='owner'`. `membership.delete` and
   `membership.update(role IN ('member', 'viewer'))` reject with 422
   otherwise. (UI #24)
2. **Self-modification guard.** An admin cannot demote, deactivate, or
   delete themselves. → 422 `cannot_self_downgrade` /
   `cannot_self_delete`. (UI #21)
3. **Tenant scoping on writes.** Every write to a tenant-scoped table
   must include the resolved `active_tenant_id` from the session;
   `*.service.ts` wraps each write in a `WHERE tenant_id = ?` guard.
4. **Viewer write guard.** Tenant-scoped shared-content writes require
   `role IN ('owner', 'member')`, unless the caller is a platform admin.
   Viewers may still write personal listener state: playback history, queue,
   preferences, and password changes.
5. **Track readiness on stream/queue.** `GET /tracks/{id}/stream-url`
   rejects with 409 `track_not_ready` when `status != 'ready'`. Queue add
   rejects pending, soft-deleted, or wrong-tenant tracks. Pending uploads are
   filtered from `GET /tracks` unless `?includePending=true`; that flag is
   editor/admin-only.
6. **Pending-track GC.** A future Cron Trigger deletes tracks where
   `status='pending' AND created_at < now - 1h` and removes the matching
   R2 key. (Not part of v1 schema — covered by `tracks_pending_cleanup_idx`.)
7. **Playback `ended`.** On ingest, an event with `event='ended'` writes
   `last_position_ms = 0` regardless of the reported `positionMs`.
8. **Playlist position rebalance.** When inserting between two
   `position_frac` values whose gap is `< 1e-9`, the service rewrites
   the entire playlist's positions in one statement before inserting.
9. **Queue current marker.** At most one non-deleted queue item may have
   `is_current = true` for a `(user_id, tenant_id)` pair. The service clears
   siblings before setting a new current item.

---

## 4. Migrations

Drizzle Kit (`drizzle.config.ts` already present) emits versioned SQL
under `backend/drizzle/`. Apply via `wrangler d1 migrations apply`.
Initial migration creates everything in §2 in dependency order:

```
users → tenants → memberships
                ↘ sessions (FK active_tenant_id, user_id)
tenants → tracks → playlists → playlist_tracks
               ↘ queue_items (FK user, tenant, track)
                              ↘ playback_history (FK user, tenant, track, last_playlist)
users → user_preferences
users + tenants → audit_logs
```

`users.last_active_tenant_id` and `sessions.active_tenant_id` are added
in a follow-up step within the same migration to break the cycle with
`tenants`.

---

## 5. ER diagram

```
                ┌─────────┐
                │ tenants │
                └──┬──────┘
                   │
   ┌───────────────┼─────────────────────────────────┐
   │               │                                 │
┌──▼──────┐  ┌─────▼────────┐  ┌──────────┐  ┌──────▼─────┐
│ tracks  │  │ memberships  │  │ playlists│  │ audit_logs │
└──┬──────┘  └─────┬────────┘  └────┬─────┘  └────────────┘
   │               │                │
   │               │           ┌────▼────────────┐
   │               │           │ playlist_tracks │
   │               │           └────┬────────────┘
   │               │                │
   │      ┌────────▼─────┐          │
   │      │    users     │──────────┘ (uploader_id, owner_id)
   │      └────┬─────────┘
   │           │
   │      ┌────▼────────┐
   │      │  sessions   │
   │      └─────────────┘
   │           │
   │      ┌────▼────────────────┐
   │      │ user_preferences    │
   │      └─────────────────────┘
   │
┌──▼──────────────┐
│ playback_history│
└─────────────────┘
   (FK to users + tenants + tracks + playlists)

┌─────────────────┐
│   queue_items   │
└─────────────────┘
   (FK to users + tenants + tracks)
```

---

## 6. API sync checklist

The DB/UI-required contracts are reflected in `api.md`:

- `TrackDto` exposes `trackNumber`, `genre`, `year`, `coverUrl`,
  `lyricsLrc`, and `lyricsStatus`.
- `UserDto` exposes `lastActiveTenantId` (sourced from
  `users.last_active_tenant_id`) so the Tenant Picker can mark the
  most-recent workspace.
- `PlaylistDto` exposes `totalDurationMs`, computed at read time.
- `QueueItemDto` and `QueueStateDto` expose persisted per-user/per-tenant queue
  state with dense positions and a single current item.
- Track upload supports optional cover upload; existing tracks support
  cover upload/finalize/remove and lyrics upload/replace/remove.
- `GET/PATCH /me/preferences` exists and signin embeds `preferences`.
- Admin list DTOs expose the summary counts needed by the mobile admin UI.
- Admin user detail embeds memberships, and tenant creation requires an
  initial owner.
