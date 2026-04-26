import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';
import { tracks } from '../tracks/tracks.orm';
import { users } from '../users/users.orm';

export const playlists = sqliteTable(
	'playlists',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id),
		name: text('name').notNull(),
		description: text('description'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('playlists_tenant_name_uq')
			.on(t.tenantId, t.name)
			.where(sql`${t.deletedAt} IS NULL`),
		index('playlists_tenant_idx').on(t.tenantId, t.updatedAt)
	]
);

export const playlistTracks = sqliteTable(
	'playlist_tracks',
	{
		id: text('id').primaryKey(),
		playlistId: text('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		trackId: text('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		positionFrac: real('position_frac').notNull(),
		addedAt: integer('added_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('playlist_tracks_uq')
			.on(t.playlistId, t.trackId)
			.where(sql`${t.deletedAt} IS NULL`),
		index('playlist_tracks_position_idx').on(
			t.playlistId,
			t.deletedAt,
			t.positionFrac
		)
	]
);
