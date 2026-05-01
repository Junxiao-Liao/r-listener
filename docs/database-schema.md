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
| R2 | Cloudflare R2 | Audio file storage and streaming |

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
| `cache:track:<tenantId>:<trackId>` | Track DTO | 5 min | Read-through cache for track lookups |
| `cache:playlist:<tenantId>:<playlistId>` | Playlist aggregate | 5 min | Read-through cache for playlist lookups |
| `cache:search:<tenantId>:<hash>` | Search results DTO | 60s | Search result caching |
| `buffer:history:<userId>:<tenantId>` | Buffered playback events array | 1 hour | Playback history buffering (drained inline on reads)</td> |
