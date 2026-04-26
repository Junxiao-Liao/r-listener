import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import { memberships, tenants } from '../tenants/tenants.orm';
import type { TenantAccessInput, TenantAccessResult } from './middleware.type';

export async function resolveTenantAccess(
	db: Db,
	input: TenantAccessInput
): Promise<TenantAccessResult | null> {
	const activeTenantId = input.session.activeTenantId;
	if (!activeTenantId) return null;

	const tenantRows = await db
		.select({ id: tenants.id })
		.from(tenants)
		.where(and(eq(tenants.id, activeTenantId), isNull(tenants.deletedAt)))
		.limit(1);

	if (!tenantRows[0]) return null;

	if (input.session.user.isAdmin) {
		return { activeTenantId, role: null };
	}

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
	const membership = membershipRows[0];

	return membership ? { activeTenantId, role: membership.role } : null;
}
