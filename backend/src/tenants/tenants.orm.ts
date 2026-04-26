import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from '../users/users.orm';

export const tenants = sqliteTable(
	'tenants',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('tenants_name_uq')
			.on(t.name)
			.where(sql`${t.deletedAt} IS NULL`)
	]
);

export const memberships = sqliteTable(
	'memberships',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'member', 'viewer'] }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('memberships_user_tenant_uq')
			.on(t.userId, t.tenantId)
			.where(sql`${t.deletedAt} IS NULL`),
		index('memberships_tenant_idx').on(t.tenantId)
	]
);
