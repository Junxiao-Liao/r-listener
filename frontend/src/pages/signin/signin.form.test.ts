import { describe, expect, it } from 'vitest';
import type { SigninResult } from '$shared/types/dto';
import { postSigninRedirect, signinSchema } from './signin.form';

describe('signinSchema', () => {
	it('rejects empty username and password', () => {
		const r = signinSchema.safeParse({ username: '', password: '' });
		expect(r.success).toBe(false);
	});

	it('accepts trimmed username + non-empty password', () => {
		const r = signinSchema.safeParse({ username: '  alice  ', password: 'pw' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.username).toBe('alice');
	});
});

describe('postSigninRedirect', () => {
	it('enters the app only for a single bound workspace', () => {
		expect(
			postSigninRedirect({
				activeTenantId: 'tnt_a',
				tenants: [membershipFixture('tnt_a')]
			})
		).toBe('/');
	});

	it('sends multi-workspace users to the picker even when activeTenantId is suggested', () => {
		expect(
			postSigninRedirect({
				activeTenantId: 'tnt_b',
				tenants: [membershipFixture('tnt_a'), membershipFixture('tnt_b')]
			})
		).toBe('/tenants');
	});

	it('sends unbound sessions to the picker', () => {
		expect(
			postSigninRedirect({
				activeTenantId: null,
				tenants: [membershipFixture('tnt_a')]
			})
		).toBe('/tenants');
	});
});

function membershipFixture(tenantId: string): SigninResult['tenants'][number] {
	return {
		tenantId,
		tenantName: tenantId,
		role: 'owner',
		createdAt: '2026-04-01T00:00:00.000Z'
	};
}
