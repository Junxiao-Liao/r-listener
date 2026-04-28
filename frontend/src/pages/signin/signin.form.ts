import { z } from 'zod';
import type { CurrentSessionDto } from '$shared/types/dto';

export const signinSchema = z.object({
	username: z.string().trim().min(1, 'Username is required.'),
	password: z.string().min(1, 'Password is required.')
});

export type SigninForm = z.infer<typeof signinSchema>;

export const defaultSigninForm: SigninForm = { username: '', password: '' };

export function postSigninRedirect(
	session: Pick<CurrentSessionDto, 'activeTenantId' | 'tenants'>
): '/' | '/tenants' {
	const onlyTenant = session.tenants.length === 1 ? session.tenants[0] : null;
	return onlyTenant && session.activeTenantId === onlyTenant.tenantId ? '/' : '/tenants';
}
