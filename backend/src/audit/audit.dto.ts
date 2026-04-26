import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { AuditLogDto } from './audit.type';
import type { auditLogs } from './audit.orm';

export const auditTargetTypeSchema = z.enum(['user', 'tenant', 'membership', 'track', 'playlist']);

export const auditLogDtoSchema = z.object({
	id: z.string(),
	actorId: z.string(),
	action: z.string(),
	targetType: auditTargetTypeSchema,
	targetId: z.string(),
	tenantId: z.string().nullable(),
	meta: z.record(z.string(), z.unknown()),
	createdAt: z.string()
});

export function toAuditLogDto(log: typeof auditLogs.$inferSelect): AuditLogDto {
	return {
		id: log.id as AuditLogDto['id'],
		actorId: log.actorId as AuditLogDto['actorId'],
		action: log.action,
		targetType: log.targetType,
		targetId: log.targetId,
		tenantId: log.tenantId as AuditLogDto['tenantId'],
		meta: log.meta,
		createdAt: fromUnixTimestampSeconds(log.createdAt)
	};
}
