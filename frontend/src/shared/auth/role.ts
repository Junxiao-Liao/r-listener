import type { CurrentSessionDto, Id, TenantRole } from '$shared/types/dto';

export type SessionRole = TenantRole | 'admin-no-membership' | null;

// Resolve the effective role for the active tenant. Platform admins always
// behave as editors regardless of membership. Returns null when there is no
// session or active tenant.
export function effectiveRole(session: CurrentSessionDto | null | undefined): SessionRole {
	if (!session) return null;
	const activeId = session.activeTenantId as Id<'tenant'> | null;
	if (!activeId) return null;
	const membership = session.tenants.find((t) => t.tenantId === activeId);
	if (membership) return membership.role;
	if (session.user.isAdmin) return 'admin-no-membership';
	return null;
}

export function isEditor(session: CurrentSessionDto | null | undefined): boolean {
	const role = effectiveRole(session);
	if (!role) return false;
	if (role === 'viewer') return false;
	return true;
}

export function isViewer(session: CurrentSessionDto | null | undefined): boolean {
	return effectiveRole(session) === 'viewer';
}
