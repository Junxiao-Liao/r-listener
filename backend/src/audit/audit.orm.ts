import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { tenants } from '../tenants/tenants.orm';
import { users } from '../users/users.orm';

export const auditLogs = sqliteTable(
	'audit_logs',
	{
		id: text('id').primaryKey(),
		actorId: text('actor_id')
			.notNull()
			.references(() => users.id),
		action: text('action').notNull(),
		targetType: text('target_type', {
			enum: ['user', 'tenant', 'membership', 'track', 'playlist']
		}).notNull(),
		targetId: text('target_id').notNull(),
		tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
		meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		index('audit_logs_created_idx').on(t.createdAt),
		index('audit_logs_actor_idx').on(t.actorId, t.createdAt),
		index('audit_logs_tenant_idx').on(t.tenantId, t.createdAt),
		index('audit_logs_action_idx').on(t.action, t.createdAt),
		index('audit_logs_target_idx').on(t.targetType, t.targetId)
	]
);
