import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import { memberships, tenants } from '../tenants/tenants.orm';
import type { TenantAccessInput, TenantAccessResult } from './middleware.type';
import { cacheKey, createKvCache, KV_TTL } from '../lib/kv-cache';

export async function resolveTenantAccess(
	db: Db,
	kv: KVNamespace,
	input: TenantAccessInput
): Promise<TenantAccessResult | null> {
	const activeTenantId = input.session.activeTenantId;
	if (!activeTenantId) return null;
	const cache = createKvCache(kv, { defaultTtlSeconds: 120 });

	const tenantExists = await cache.get(
		cacheKey('cache:authz:tenant-exists', activeTenantId),
		async () => {
			const tenantRows = await db
				.select({ id: tenants.id })
				.from(tenants)
				.where(and(eq(tenants.id, activeTenantId), isNull(tenants.deletedAt)))
				.limit(1);
			return tenantRows[0] ? true : null;
		},
		KV_TTL.highChurn
	);

	if (!tenantExists) return null;

	if (input.session.user.isAdmin) {
		return { activeTenantId, role: null };
	}

	const role = await cache.get<TenantAccessResult['role']>(
		cacheKey('cache:authz:role', activeTenantId, input.session.user.id),
		async () => {
			const membershipRows = await db
				.select({ role: memberships.role })
				.from(memberships)
				.where(
					and(
						eq(memberships.userId, input.session.user.id),
						eq(memberships.tenantId, activeTenantId),
						isNull(memberships.deletedAt)
					)
				)
				.limit(1);
			return membershipRows[0]?.role ?? null;
		},
		KV_TTL.highChurn
	);

	return role ? { activeTenantId, role } : null;
}
