import { describe, expect, it, vi } from 'vitest';
import { internalError } from '../http/api-error';
import { createApp } from '../app';
import type { MiddlewareService, SessionContext } from './middleware.type';
import { createMiddlewareService } from './middleware.service';
import { requireAdmin, requireSession, requireTenant, requireTenantEditor } from './middleware.guard';
import { hashSessionToken } from '../auth/session';
import { createTestEnv } from '../test/test-env';

describe('backend middleware', () => {
	it('allows health without authentication', async () => {
		const app = createFixtureApp({ session: null });

		const res = await app.request('/api/health', {}, createTestEnv());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it('returns 401 for missing sessions', async () => {
		const app = createFixtureApp({ session: null });

		const res = await app.request('/api/fixture/session', {}, createTestEnv());

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: { code: 'unauthenticated', message: 'Authentication required.' }
		});
	});

	it('returns 401 for invalid sessions', async () => {
		const app = createFixtureApp({ session: null });

		const res = await app.request(
			'/api/fixture/session',
			{ headers: { cookie: 'session=invalid' } },
			createTestEnv()
		);

		expect(res.status).toBe(401);
		expect((await readError(res)).code).toBe('unauthenticated');
	});

	it('rolls the session cookie when expiry is refreshed', async () => {
		const app = createFixtureApp({
			session: sessionFixture(),
			refreshedSessionExpiresAt: '2026-05-26T00:00:00.000Z'
		});

		const res = await app.request(
			'/api/fixture/session',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		const setCookie = res.headers.get('Set-Cookie') ?? '';
		expect(setCookie).toMatch(/^session=valid/);
		expect(setCookie).toMatch(/HttpOnly/i);
		expect(setCookie).toMatch(/SameSite=Lax/i);
	});

	it('returns 403 when there is no active tenant', async () => {
		const app = createFixtureApp({ session: sessionFixture({ activeTenantId: null }) });

		const res = await app.request(
			'/api/fixture/tenant',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
		expect((await readError(res)).code).toBe('no_active_tenant');
	});

	it('returns 403 when the active tenant is not accessible', async () => {
		const app = createFixtureApp({ session: sessionFixture(), tenantAllowed: false });

		const res = await app.request(
			'/api/fixture/tenant',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
		expect((await readError(res)).code).toBe('tenant_forbidden');
	});

	it('returns 403 when a viewer hits an editor-only route', async () => {
		const app = createFixtureApp({ session: sessionFixture(), tenantRole: 'viewer' });

		const res = await app.request(
			'/api/fixture/editor',
			{ method: 'POST', headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
		expect((await readError(res)).code).toBe('insufficient_role');
	});

	it('returns 403 when a non-admin hits an admin route', async () => {
		const app = createFixtureApp({ session: sessionFixture() });

		const res = await app.request(
			'/api/fixture/admin',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
		expect((await readError(res)).code).toBe('admin_required');
	});

	it('returns 429 when an auth route is rate limited', async () => {
		const app = createFixtureApp({ session: sessionFixture(), rateLimitAllowed: false });

		const res = await app.request('/api/auth/signin', {}, createTestEnv());

		expect(res.status).toBe(429);
		expect((await readError(res)).code).toBe('rate_limited');
	});

	it('returns 500 when auth rate-limit infrastructure fails closed', async () => {
		const app = createFixtureApp({ session: sessionFixture(), rateLimitThrows: true });

		const res = await app.request('/api/auth/signin', {}, createTestEnv());

		expect(res.status).toBe(500);
		expect((await readError(res)).code).toBe('internal_error');
	});

	it('returns 429 when API rate limit is exceeded for non-admin users', async () => {
		const app = createFixtureApp({ session: sessionFixture(), apiRateLimitAllowed: false });

		const res = await app.request(
			'/api/fixture/session',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(429);
		expect((await readError(res)).code).toBe('rate_limited');
	});

	it('passes demo rate limit max when user is demo', async () => {
		const checkApiRateLimit = vi.fn(async () => ({ allowed: true }));
		const app = createFixtureApp({
			session: sessionFixture({ username: 'demo' }),
			checkApiRateLimitOverride: checkApiRateLimit
		});

		const res = await app.request(
			'/api/fixture/session',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(checkApiRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ max: 20 })
		);
	});

	it('does not pass demo max when user is not demo', async () => {
		const checkApiRateLimit = vi.fn(async () => ({ allowed: true }));
		const app = createFixtureApp({
			session: sessionFixture({ username: 'alice' }),
			checkApiRateLimitOverride: checkApiRateLimit
		});

		const res = await app.request(
			'/api/fixture/session',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(checkApiRateLimit).toHaveBeenCalledWith(
			expect.not.objectContaining({ max: expect.anything() })
		);
	});

	it('lets injected fixtures exercise successful protected routes', async () => {
		const app = createFixtureApp({ session: sessionFixture({ userIsAdmin: true }) });

		const res = await app.request(
			'/api/fixture/admin',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});

describe('real middleware service', () => {
	it('deletes expired session rows during validation', async () => {
		const deleteWhere = vi.fn();
		const db = createSessionValidationDb({
			session: {
				tokenHash: hashSessionToken('expired-token'),
				userId: 'usr_018f0000-0000-7000-8000-000000000000',
				activeTenantId: null,
				expiresAt: new Date('2026-04-25T00:00:00.000Z'),
				lastRefreshedAt: new Date('2026-04-24T00:00:00.000Z')
			},
			user: {
				id: 'usr_018f0000-0000-7000-8000-000000000000',
				username: 'user',
				isAdmin: false,
				isActive: true,
				lastActiveTenantId: null,
				createdAt: new Date('2026-04-01T00:00:00.000Z'),
				deletedAt: null
			},
			deleteWhere
		});
		const service = createMiddlewareService(db);

		const result = await service.validateSession({
			token: 'expired-token',
			now: new Date('2026-04-26T00:00:00.000Z'),
			ip: '127.0.0.1',
			userAgent: null
		});

		expect(result).toBeNull();
		expect(deleteWhere).toHaveBeenCalled();
	});

	it('refreshes old valid sessions and returns refreshed expiry metadata', async () => {
		const tokenHash = hashSessionToken('valid-token');
		const updateWhere = vi.fn();
		const db = createSessionValidationDb({
			session: {
				tokenHash,
				userId: 'usr_018f0000-0000-7000-8000-000000000000',
				activeTenantId: null,
				expiresAt: new Date('2026-05-01T00:00:00.000Z'),
				lastRefreshedAt: new Date('2026-04-24T00:00:00.000Z')
			},
			user: {
				id: 'usr_018f0000-0000-7000-8000-000000000000',
				username: 'user',
				isAdmin: false,
				isActive: true,
				lastActiveTenantId: null,
				createdAt: new Date('2026-04-01T00:00:00.000Z'),
				deletedAt: null
			},
			updateSet: vi.fn(() => ({ where: updateWhere }))
		});
		const service = createMiddlewareService(db);

		const result = await service.validateSession({
			token: 'valid-token',
			now: new Date('2026-04-26T00:00:00.000Z'),
			ip: '127.0.0.1',
			userAgent: null
		});

		expect(result?.refreshedSessionExpiresAt).toBe('2026-05-26T00:00:00.000Z');
		expect(updateWhere).toHaveBeenCalled();
	});

	it('fails closed when DB rate-limit storage throws', async () => {
		const service = createMiddlewareService(createRateLimitFailingDb());

		await expect(
			service.checkAuthRateLimit({ ip: '127.0.0.1', now: new Date('2026-04-26T00:00:00.000Z') })
		).rejects.toMatchObject({ status: 500, code: 'internal_error' });
	});
});

type FixtureOptions = {
	session: SessionContext | null;
	refreshedSessionExpiresAt?: string | null;
	tenantAllowed?: boolean;
	tenantRole?: 'owner' | 'member' | 'viewer' | null;
	rateLimitAllowed?: boolean;
	rateLimitThrows?: boolean;
	apiRateLimitAllowed?: boolean;
	apiRateLimitThrows?: boolean;
	checkApiRateLimitOverride?: ReturnType<typeof vi.fn>;
};

function createFixtureApp(options: FixtureOptions) {
	const service: MiddlewareService = {
		validateSession: vi.fn(async ({ token }) =>
			token === 'valid' && options.session
				? {
						...options.session,
						refreshedSessionExpiresAt: options.refreshedSessionExpiresAt ?? null
					}
				: null
		),
		resolveTenantAccess: vi.fn(async ({ session }) =>
			options.tenantAllowed === false || !session.activeTenantId
				? null
				: {
						activeTenantId: session.activeTenantId,
						role: session.user.isAdmin ? null : (options.tenantRole ?? 'member')
					}
		),
		checkAuthRateLimit: vi.fn(async () => {
			if (options.rateLimitThrows) throw internalError();
			return { allowed: options.rateLimitAllowed ?? true };
		}),
		checkApiRateLimit: (options.checkApiRateLimitOverride ?? vi.fn(async () => {
			if (options.apiRateLimitThrows) throw internalError();
			return { allowed: options.apiRateLimitAllowed ?? true };
		})) as (input: { userId: string; now: Date; max?: number }) => Promise<{ allowed: boolean }>
	};

	return createApp({
		createMiddlewareService: () => service,
		configure: (app) => {
			app.get('/fixture/session', requireSession(), (c) =>
				c.json({ userId: c.var.session.user.id })
			);
			app.get('/fixture/tenant', requireSession(), requireTenant(), (c) =>
				c.json({ tenantId: c.var.session.activeTenantId, role: c.var.session.role })
			);
			app.post(
				'/fixture/editor',
				requireSession(),
				requireTenant(),
				requireTenantEditor(),
				(c) => c.json({ ok: true })
			);
			app.get('/fixture/admin', requireSession(), requireAdmin(), (c) => c.json({ ok: true }));
			app.post('/auth/signin', (c) => c.json({ ok: true }));
		}
	});
}

function sessionFixture(
	overrides: { activeTenantId?: SessionContext['activeTenantId']; userIsAdmin?: boolean; username?: string } = {}
): SessionContext {
	return {
		user: {
			id: 'usr_018f0000-0000-7000-8000-000000000000' as SessionContext['user']['id'],
			username: overrides.username ?? 'user',
			isAdmin: overrides.userIsAdmin ?? false,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: '2026-04-26T00:00:00.000Z' as SessionContext['user']['createdAt']
		},
		sessionTokenHash: 'hash',
		activeTenantId:
			overrides.activeTenantId === undefined
				? ('tnt_018f0000-0000-7000-8000-000000000000' as SessionContext['activeTenantId'])
				: overrides.activeTenantId,
		role: null,
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

async function readError(res: Response): Promise<{ code: string; message: string }> {
	const body = (await res.json()) as { error: { code: string; message: string } };
	return body.error;
}

type SessionValidationDbOptions = {
	session: Record<string, unknown> | null;
	user: Record<string, unknown> | null;
	deleteWhere?: ReturnType<typeof vi.fn>;
	updateSet?: ReturnType<typeof vi.fn>;
};

function createSessionValidationDb(options: SessionValidationDbOptions) {
	let selectCount = 0;
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => {
						selectCount += 1;
						if (selectCount === 1) return options.session ? [options.session] : [];
						return options.user ? [options.user] : [];
					}
				})
			})
		}),
		delete: () => ({
			where: options.deleteWhere ?? vi.fn()
		}),
		update: () => ({
			set: options.updateSet ?? vi.fn(() => ({ where: vi.fn() }))
		})
	} as never;
}

function createRateLimitFailingDb() {
	return {
		insert: () => {
			throw new Error('db unavailable');
		}
	} as never;
}
