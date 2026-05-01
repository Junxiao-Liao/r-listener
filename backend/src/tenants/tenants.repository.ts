import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import type { Id } from '../shared/shared.type';
import type { UserId } from '../users/users.type';
import { memberships, tenants } from './tenants.orm';
import { toTenantDto, toTenantMembershipDto } from './tenants.dto';
import type { TenantDto, TenantMembershipDto } from './tenants.type';
import { cacheKey, createKvCache, KV_TTL } from '../lib/kv-cache';

export type TenantsRepository = {
	listActiveMembershipsForUser(userId: UserId): Promise<TenantMembershipDto[]>;
	findActiveTenantById(tenantId: Id<'tenant'>): Promise<TenantDto | null>;
	findActiveMembership(input: {
		userId: UserId;
		tenantId: Id<'tenant'>;
	}): Promise<TenantMembershipDto | null>;
};

export function createTenantsRepository(db: Db, kv?: KVNamespace): TenantsRepository {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: KV_TTL.authz }) : null;

	return {
		listActiveMembershipsForUser: async (userId) => {
			const key = cacheKey('cache:authz:user-memberships', userId);
			const cached = await cache?.tryGet<TenantMembershipDto[]>(key);
			if (cached) return cached;

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
			const result = rows.map(({ membership, tenant }) => toTenantMembershipDto(membership, tenant));
			await cache?.put(key, result);
			return result;
		},
		findActiveTenantById: async (tenantId) => {
			const key = cacheKey('cache:tenant', tenantId);
			const cached = await cache?.tryGet<TenantDto>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(tenants)
				.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
				.limit(1);
			const result = rows[0] ? toTenantDto(rows[0]) : null;
			if (result) await cache?.put(key, result);
			return result;
		},
		findActiveMembership: async ({ userId, tenantId }) => {
			const key = cacheKey('cache:authz:membership', tenantId, userId);
			const cached = await cache?.tryGet<TenantMembershipDto>(key);
			if (cached) return cached;

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
			const result = rows[0] ? toTenantMembershipDto(rows[0].membership, rows[0].tenant) : null;
			if (result) await cache?.put(key, result);
			return result;
		}
	};
}
