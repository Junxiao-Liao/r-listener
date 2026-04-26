import type { Id, Iso8601 } from '../shared/shared.type';

export type TenantRole = 'owner' | 'member' | 'viewer';

export type TenantDto = {
	id: Id<'tenant'>;
	name: string;
	createdAt: Iso8601;
};

export type TenantMembershipDto = {
	tenantId: Id<'tenant'>;
	tenantName: string;
	role: TenantRole;
	createdAt: Iso8601;
};
