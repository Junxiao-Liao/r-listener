import { z } from 'zod';
import type { SigninResult } from '$shared/types/dto';

export const signinSchema = z.object({
	username: z.string().trim().min(1, 'Username is required.'),
	password: z.string().min(1, 'Password is required.')
});

export type SigninForm = z.infer<typeof signinSchema>;

export const defaultSigninForm: SigninForm = { username: '', password: '' };

export function postSigninRedirect(result: Pick<SigninResult, 'activeTenantId' | 'tenants'>): '/' | '/tenants' {
	const onlyTenant = result.tenants.length === 1 ? result.tenants[0] : null;
	return onlyTenant && result.activeTenantId === onlyTenant.tenantId ? '/' : '/tenants';
}
