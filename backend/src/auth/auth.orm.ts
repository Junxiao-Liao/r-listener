import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';
import { users } from '../users/users.orm';

export const sessions = sqliteTable(
	'sessions',
	{
		tokenHash: text('token_hash').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		activeTenantId: text('active_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		lastRefreshedAt: integer('last_refreshed_at', { mode: 'timestamp' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		userAgent: text('user_agent'),
		ip: text('ip')
	},
	(t) => [
		index('sessions_user_idx').on(t.userId),
		index('sessions_expires_idx').on(t.expiresAt)
	]
);
