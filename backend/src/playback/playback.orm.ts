import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { playlists } from '../playlists/playlists.orm';
import { tenants } from '../tenants/tenants.orm';
import { tracks } from '../tracks/tracks.orm';
import { users } from '../users/users.orm';

export const playbackHistory = sqliteTable(
	'playback_history',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		trackId: text('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		lastPlaylistId: text('last_playlist_id').references(() => playlists.id, {
			onDelete: 'set null'
		}),
		lastPlayedAt: integer('last_played_at', { mode: 'timestamp' }).notNull(),
		lastPositionMs: integer('last_position_ms').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.tenantId, t.trackId] }),
		index('playback_recent_idx').on(t.userId, t.tenantId, t.lastPlayedAt)
	]
);
