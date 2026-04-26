import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';
import { tracks } from '../tracks/tracks.orm';
import { users } from '../users/users.orm';

export const queueItems = sqliteTable(
	'queue_items',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		trackId: text('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		positionFrac: real('position_frac').notNull(),
		isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
		addedAt: integer('added_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		index('queue_items_user_tenant_position_idx').on(
			t.userId,
			t.tenantId,
			t.deletedAt,
			t.positionFrac
		),
		index('queue_items_track_idx').on(t.trackId),
		uniqueIndex('queue_items_one_current_uq')
			.on(t.userId, t.tenantId, t.isCurrent)
			.where(sql`${t.deletedAt} IS NULL AND ${t.isCurrent} = 1`)
	]
);
