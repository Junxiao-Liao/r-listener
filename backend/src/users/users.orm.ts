import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		passwordHash: text('password_hash').notNull(),
		displayName: text('display_name'),
		isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		lastActiveTenantId: text('last_active_tenant_id').references(() => tenants.id, {
			onDelete: 'set null'
		}),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('users_email_uq')
			.on(t.email)
			.where(sql`${t.deletedAt} IS NULL`)
	]
);
