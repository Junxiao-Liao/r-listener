# API Routes

All routes under `/api/*`. Session cookie (first-party). JSON bodies unless noted.

## Health
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check (no auth) |

## Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/signin` | Sign in |
| GET | `/auth/session` | Get current session |
| POST | `/auth/signout` | Sign out |
| POST | `/auth/switch-tenant` | Switch active tenant |
| POST | `/auth/change-password` | Change own password |

## Tracks
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/tracks` | List tracks (cursor, sort by `title`, `album`, `year`, `durationMs`, `createdAt`, or `updatedAt`; search includes linked artists) |
| GET | `/tracks/{id}` | Get track with ordered `artists: { id, name }[]` |
| POST | `/tracks` | Upload audio (multipart, step 1 of 2; repeat `artistNames` for artists) |
| POST | `/tracks/{id}/finalize` | Finalize upload (step 2 of 2) |
| PATCH | `/tracks/{id}` | Edit metadata (`artistNames: string[]` replaces links when present) |
| PUT | `/tracks/{id}/lyrics` | Upload/replace lyrics |
| DELETE | `/tracks/{id}/lyrics` | Remove lyrics |
| DELETE | `/tracks/{id}` | Soft delete |
| GET | `/tracks/{id}/stream` | Stream audio (supports Range) |

## Artists
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/artists?q=&cursor=&limit=` | Tenant-scoped cursor-paginated artist autocomplete |

## Playlists
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/playlists` | List playlists |
| GET | `/playlists/{id}` | Get playlist |
| POST | `/playlists` | Create playlist |
| PATCH | `/playlists/{id}` | Edit playlist |
| DELETE | `/playlists/{id}` | Soft delete |
| GET | `/playlists/{id}/tracks` | List playlist tracks |
| POST | `/playlists/{id}/tracks` | Add track |
| PATCH | `/playlists/{id}/tracks/{trackId}` | Reorder track |
| DELETE | `/playlists/{id}/tracks/{trackId}` | Remove track |

## Playback
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/playback-events` | Ingest batched playback events |
| GET | `/me/recent-tracks` | Recently played |
| GET | `/me/continue-listening` | Resume-able tracks |

## Queue
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/queue` | Get queue state |
| POST | `/queue/items` | Add tracks (1..100) |
| PATCH | `/queue/items/{id}` | Reorder / set current |
| DELETE | `/queue/items/{id}` | Remove item |
| DELETE | `/queue` | Clear queue |

## Search
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/search` | Search tracks and playlists |

## Preferences
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/me/preferences` | Get preferences |
| PATCH | `/me/preferences` | Update preferences |

## Admin — Users
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/users` | List users |
| GET | `/admin/users/{id}` | Get user detail |
| POST | `/admin/users` | Create user |
| PATCH | `/admin/users/{id}` | Edit user |
| POST | `/admin/users/{id}/reset-password` | Reset password |
| DELETE | `/admin/users/{id}` | Soft delete user |

## Admin — Tenants
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/tenants` | List tenants |
| GET | `/admin/tenants/{id}` | Get tenant |
| POST | `/admin/tenants` | Create tenant |
| PATCH | `/admin/tenants/{id}` | Edit tenant |
| DELETE | `/admin/tenants/{id}` | Soft delete tenant |
| GET | `/admin/tenants/{id}/members` | List members |
| POST | `/admin/tenants/{id}/members` | Add member |
| PATCH | `/admin/tenants/{id}/members/{userId}` | Update membership |
| DELETE | `/admin/tenants/{id}/members/{userId}` | Remove member |
