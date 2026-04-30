# Database

## Conventions

- **IDs:** Prefixed UUIDv7 (`usr_`, `tnt_`, `trk_`, `pls_`, `mbr_`, `qi_`, `plt_`, `aud_`)
- **Time:** `INTEGER` unix seconds in D1 → ISO-8601 on the wire
- **Soft delete:** `deleted_at INTEGER NULL` on domain rows; reads filter `WHERE deleted_at IS NULL`
- **Tenant scoping:** Tenant-scoped rows carry `tenant_id` FK; no cross-tenant visibility
- **ORM:** Drizzle. Each feature owns `*.orm.ts`; barrel export in `db/schema.ts`

## Tables

| Table | Purpose | Key FKs |
|-------|---------|---------|
| `users` | Identity, credentials, admin flag | `last_active_tenant_id → tenants` |
| `sessions` | Cookie-based auth (token hash as PK) | `user_id → users`, `active_tenant_id → tenants` |
| `tenants` | Multi-tenant workspaces | — |
| `memberships` | User↔Tenant join with role | `user_id → users`, `tenant_id → tenants` |
| `tracks` | Audio metadata + R2 keys | `tenant_id → tenants`, `uploader_id → users` |
| `playlists` | Named collections | `tenant_id → tenants`, `owner_id → users` |
| `playlist_tracks` | Track ordering (real `position_frac`) | `playlist_id → playlists`, `track_id → tracks` |
| `playback_history` | Per-user play history (upsert by user+tenant+track) | `user_id → users`, `tenant_id → tenants`, `track_id → tracks` |
| `queue_items` | Persisted Now Playing queue (real `position_frac`) | `user_id → users`, `tenant_id → tenants`, `track_id → tracks` |
| `user_preferences` | Settings per user (`user_id` PK) | `user_id → users` |
| `audit_logs` | Append-only admin action trail | `actor_id → users`, `tenant_id → tenants` |
