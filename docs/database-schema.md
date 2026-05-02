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
| D1 | SQLite (Drizzle ORM) | Domain data, sessions, rate limiting, preferences, queue, playback history, audit logs |
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
| `sessions` | Hashed cookie session tokens, active tenant, expiry, sliding refresh metadata | `user_id → users`, `active_tenant_id → tenants` |
| `rate_limits` | Fixed-window auth/API rate-limit counters | — |
| `audit_logs` | Append-only admin action trail (hard-delete tracks records audioR2Key, sizeBytes, r2Deleted boolean per row) | `actor_id → users`, `tenant_id → tenants` |

## R2 Key Patterns

| R2 Key Pattern | Purpose |
|---------------|---------|
| `audio/{sha256hex}.{ext}` | Content-addressable audio blob (SHA-256 of file bytes). Deduplication: if a file with the same hash has already been uploaded, the R2 object is reused. Multiple track rows can reference the same R2 blob. |

The `tracks.audio_hash` column stores the hex-encoded SHA-256 hash. Combined with the `tracks.audio_r2_key` column pointing to the content-addressable R2 key, duplicate uploads are caught by checking `r2.head()` before storing.
