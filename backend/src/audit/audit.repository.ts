import type { Db } from '../db';
import { createId } from '../shared/id';
import type { Id } from '../shared/shared.type';
import type { UserId } from '../users/users.type';
import { auditLogs } from './audit.orm';

export type AuditRepository = {
	insertAdminEnter(input: { actorId: UserId; tenantId: Id<'tenant'>; now: Date }): Promise<void>;
};

export function createAuditRepository(db: Db): AuditRepository {
	return {
		insertAdminEnter: async ({ actorId, tenantId, now }) => {
			await db.insert(auditLogs).values({
				id: createId('aud_'),
				actorId,
				action: 'tenant.admin_enter',
				targetType: 'tenant',
				targetId: tenantId,
				tenantId,
				meta: {},
				createdAt: now
			});
		}
	};
}
