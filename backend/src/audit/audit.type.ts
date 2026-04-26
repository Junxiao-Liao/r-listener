import type { Id, Iso8601 } from '../shared/shared.type';

export type AuditTargetType = 'user' | 'tenant' | 'membership' | 'track' | 'playlist';

export type AuditLogDto = {
	id: Id<'audit'>;
	actorId: Id<'user'>;
	action: string;
	targetType: AuditTargetType;
	targetId: string;
	tenantId: Id<'tenant'> | null;
	meta: Record<string, unknown>;
	createdAt: Iso8601;
};
