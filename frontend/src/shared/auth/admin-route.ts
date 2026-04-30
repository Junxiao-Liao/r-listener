import type { CurrentSessionDto } from '$shared/types/dto';

export function canOpenAppPathWithoutActiveTenant(
	session: CurrentSessionDto,
	pathname: string
): boolean {
	if (pathname === '/tenants') return true;
	return session.user.isAdmin && (pathname === '/admin' || pathname.startsWith('/admin/'));
}
