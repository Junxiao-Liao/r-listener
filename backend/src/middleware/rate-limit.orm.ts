import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rateLimits = sqliteTable('rate_limits', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});
