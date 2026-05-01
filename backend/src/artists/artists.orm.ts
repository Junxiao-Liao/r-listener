import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';
import { tracks } from '../tracks/tracks.orm';

export const artists = sqliteTable(
	'artists',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		nameKey: text('name_key').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('artists_tenant_name_key_uq').on(t.tenantId, t.nameKey),
		index('artists_tenant_name_key_idx').on(t.tenantId, t.deletedAt, t.nameKey)
	]
);

export const trackArtists = sqliteTable(
	'track_artists',
	{
		trackId: text('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		artistId: text('artist_id')
			.notNull()
			.references(() => artists.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		primaryKey({ columns: [t.trackId, t.artistId] }),
		uniqueIndex('track_artists_track_position_uq').on(t.trackId, t.position),
		index('track_artists_artist_idx').on(t.artistId)
	]
);
