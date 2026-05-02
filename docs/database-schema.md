# Database

## Conventions

- **IDs:** Prefixed UUIDv7 (`usr_`, `tnt_`, `trk_`, `art_`, `pls_`, `mbr_`, `qi_`, `plt_`, `aud_`)
- **Time:** `INTEGER` unix seconds in D1 → ISO-8601 on the wire
- **Soft delete:** `deleted_at INTEGER NULL` on domain rows; reads filter `WHERE deleted_at IS NULL`
- **Tenant scoping:** Tenant-scoped rows carry `tenant_id` FK; no cross-tenant visibility
- **ORM:** Drizzle. Each feature owns `*.orm.ts`; barrel export in `db/schema.ts`

## Storage

| Storage | Technology | Purpose |
|---------|-----------|---------|
| D1 | SQLite (Drizzle ORM) | Domain data: users, tenants, memberships, tracks, playlists, queue, preferences, audit logs |
| KV | Cloudflare KV | Sessions, rate limiting, entity/query caching, preference caching, playback history buffer |
| R2 | Cloudflare R2 | Content-addressable audio file storage (`audio/{sha256}.{ext}`) and streaming |

## Tables

| Table | Purpose | Key FKs |
|-------|---------|---------|
| `users` | Identity, credentials, admin flag | `last_active_tenant_id → tenants` |
| `tenants` | Multi-tenant workspaces | — |
| `memberships` | User↔Tenant join with role | `user_id → users`, `tenant_id → tenants` |
| `tracks` | Audio metadata + R2 keys | `tenant_id → tenants`, `uploader_id → users` |
| `artists` | Tenant-scoped artist names with unique `name_key` | `tenant_id → tenants` |
| `track_artists` | Ordered Track↔Artist links | `track_id → tracks`, `artist_id → artists` |
| `playlists` | Named collections | `tenant_id → tenants`, `owner_id → users` |
| `playlist_tracks` | Track ordering (real `position_frac`) | `playlist_id → playlists`, `track_id → tracks` |
| `playback_history` | Per-user play history (upsert by user+tenant+track) | `user_id → users`, `tenant_id → tenants`, `track_id → tracks` |
| `queue_items` | Persisted Now Playing queue (real `position_frac`) | `user_id → users`, `tenant_id → tenants`, `track_id → tracks` |
| `user_preferences` | Settings per user (`user_id` PK) | `user_id → users` |
| `audit_logs` | Append-only admin action trail | `actor_id → users`, `tenant_id → tenants` |

## KV Usage

| KV Key Pattern | Data | TTL | Purpose |
|---------------|------|-----|---------|
| `session:<tokenHash>` | Session data (userId, activeTenantId, expiresAt) | 30 days | Cookie-based auth sessions |
| `rate:auth:<ip>:<window>` | Counter | 60s | Auth endpoint rate limiting |
| `rate:api:<userId>:<window>` | Counter | 60s | API rate limiting per user |
| `prefs:<userId>` | User preferences JSON | 10 min | Read-through cache for preferences |
| `cache:user:<userId>` | User record | 10 min | Read-through cache for user lookups |
| `cache:user:username:<name>` | User record | 10 min | Read-through cache for user lookups |
| `cache:session:user:<userId>` | Active user session projection | 10 min | Read-through cache for session validation user reads |
| `cache:authz:*` | Tenant membership and role lookups | 60s-10 min | Read-through cache for tenant authorization and auth session tenant lists |
| `cache:tenant:<tenantId>` | Tenant DTO | 10 min | Read-through cache for active tenant lookups |
| `cache:admin:*` | Admin list/detail/count pages | 60s-10 min | Read-through cache for admin user, tenant, membership, and aggregate reads |
| `cache:track:<tenantId>:<trackId>` | Track DTO | 5 min | Read-through cache for track detail lookups |
| `cache:tracks:list:<tenantId>:<query>` | Track page DTO | 5 min | Read-through cache for tenant-scoped track list/search pages |
| `cache:tracks:row:<tenantId>:<trackId>` | Track row | 5 min | Read-through cache for service-level track row checks |
| `cache:artists:list:<tenantId>:<query>` | Artist page DTO | 5 min | Read-through cache for artist autocomplete/list pages |
| `cache:playlist:<tenantId>:<playlistId>` | Playlist aggregate | 5 min | Read-through cache for playlist detail lookups |
| `cache:playlists:list:<tenantId>:<query>` | Playlist aggregate page | 5 min | Read-through cache for playlist list pages |
| `cache:playlist-by-name:<tenantId>:<query>` | Playlist row | 5 min | Read-through cache for playlist name uniqueness reads |
| `cache:playlist-tracks:*` | Playlist track rows | 5 min | Read-through cache for playlist track list/order reads |
| `cache:queue:*` | Queue item rows and queue state rows | 5 min | Read-through cache for per-user tenant queue reads |
| `cache:playback:*` | Recent/continue/visible playback pages | 60s | Read-through cache for playback history views and visibility filters |
| `cache:search:<tenantId>:<query>` | Search results DTO | 60s | Search result caching |
| `buffer:history:<userId>:<tenantId>` | Buffered playback events array | 1 hour | Playback history buffering (drained inline on reads) |

KV is a performance layer only. Read-through cache misses and KV failures fall back to D1, not-found DB results are not cached, entity/detail entries are refreshed after successful writes when fresh data is available, and list/search/admin aggregate pages are invalidated by prefix after related mutations.

## R2 Key Patterns

| R2 Key Pattern | Purpose |
|---------------|---------|
| `audio/{sha256hex}.{ext}` | Content-addressable audio blob (SHA-256 of file bytes). Deduplication: if a file with the same hash has already been uploaded, the R2 object is reused. Multiple track rows can reference the same R2 blob. |

The `tracks.audio_hash` column stores the hex-encoded SHA-256 hash. Combined with the `tracks.audio_r2_key` column pointing to the content-addressable R2 key, duplicate uploads are caught by checking `r2.head()` before storing.
