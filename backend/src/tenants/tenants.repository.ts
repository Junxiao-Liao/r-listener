import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import type { UserId } from '../users/users.type';
import { memberships, tenants } from './tenants.orm';
import { toTenantDto, toTenantMembershipDto } from './tenants.dto';
import type { TenantDto, TenantMembershipDto } from './tenants.type';

export type TenantsRepository = {
	listActiveMembershipsForUser(userId: UserId): Promise<TenantMembershipDto[]>;
	findActiveTenantById(tenantId: Id<'tenant'>): Promise<TenantDto | null>;
	findActiveMembership(input: {
		userId: UserId;
		tenantId: Id<'tenant'>;
	}): Promise<TenantMembershipDto | null>;
};

export function createTenantsRepository(db: Db): TenantsRepository {
	return {
		listActiveMembershipsForUser: async (userId) => {
			const rows = await db
				.select({ membership: memberships, tenant: tenants })
				.from(memberships)
				.innerJoin(tenants, eq(memberships.tenantId, tenants.id))
				.where(
					and(
						eq(memberships.userId, userId),
						isNull(memberships.deletedAt),
						isNull(tenants.deletedAt)
					)
				)
				.orderBy(asc(memberships.createdAt));
			return rows.map(({ membership, tenant }) => toTenantMembershipDto(membership, tenant));
		},
		findActiveTenantById: async (tenantId) => {
			const rows = await db
				.select()
				.from(tenants)
				.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
				.limit(1);
			return rows[0] ? toTenantDto(rows[0]) : null;
		},
		findActiveMembership: async ({ userId, tenantId }) => {
			const rows = await db
				.select({ membership: memberships, tenant: tenants })
				.from(memberships)
				.innerJoin(tenants, eq(memberships.tenantId, tenants.id))
				.where(
					and(
						eq(memberships.userId, userId),
						eq(memberships.tenantId, tenantId),
						isNull(memberships.deletedAt),
						isNull(tenants.deletedAt)
					)
				)
				.limit(1);
			return rows[0] ? toTenantMembershipDto(rows[0].membership, rows[0].tenant) : null;
		}
	};
}
