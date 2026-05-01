import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';
import { users } from '../users/users.orm';

export const tracks = sqliteTable(
	'tracks',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		uploaderId: text('uploader_id')
			.notNull()
			.references(() => users.id),
		title: text('title').notNull(),
		album: text('album'),
		durationMs: integer('duration_ms'),
		contentType: text('content_type').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		trackNumber: integer('track_number'),
		genre: text('genre'),
		year: integer('year'),
		lyricsLrc: text('lyrics_lrc'),
		lyricsStatus: text('lyrics_status', { enum: ['none', 'synced', 'plain', 'invalid'] })
			.notNull()
			.default('none'),
		audioR2Key: text('audio_r2_key').notNull(),
		coverR2Key: text('cover_r2_key'),
		status: text('status', { enum: ['pending', 'ready'] }).notNull().default('pending'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		index('tracks_tenant_idx').on(t.tenantId, t.deletedAt, t.status),
		index('tracks_tenant_created_idx').on(t.tenantId, t.createdAt),
		index('tracks_tenant_title_idx').on(t.tenantId, t.title),
		index('tracks_tenant_album_idx').on(t.tenantId, t.album),
		index('tracks_pending_cleanup_idx').on(t.status, t.createdAt)
	]
);
