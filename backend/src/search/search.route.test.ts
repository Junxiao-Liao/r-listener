import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import { createSearchRoute } from './search.route';
import type { SearchService } from './search.service';

describe('search route', () => {
	it('GET /search rejects empty query', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/search?q=',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_failed' } });
		expect(service.search).not.toHaveBeenCalled();
	});

	it('GET /search searches inside the active tenant', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/search?q=sun&limit=5&kinds=track,playlist',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: [], nextCursor: null });
		expect(service.search).toHaveBeenCalledWith({
			tenantId: 'tnt_a',
			q: 'sun',
			limit: 5,
			cursor: undefined,
			kinds: ['track', 'playlist']
		});
	});

	it('GET /search requires an active tenant', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: { ...memberSession(), activeTenantId: null, role: null } });

		const res = await app.request(
			'/search?q=sun',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});
});

type FixtureOptions = {
	service: SearchService;
	session: SessionContext | null;
};

function createFixtureApp(options: FixtureOptions) {
	const middlewareService: MiddlewareService = {
		validateSession: vi.fn(async ({ token }) =>
			token === 'valid' && options.session
				? { ...options.session, refreshedSessionExpiresAt: null }
				: null
		),
		resolveTenantAccess: vi.fn(async ({ session }) =>
			session.activeTenantId
				? { activeTenantId: session.activeTenantId, role: session.role }
				: null
		),
		checkAuthRateLimit: vi.fn(async () => ({ allowed: true })),
		checkApiRateLimit: vi.fn(async () => ({ allowed: true }))
	};

	const app = new Hono<BackendEnv>();
	registerErrorHandlers(app);
	app.use('*', async (c, next) => {
		c.set('db', {} as never);
		c.set('middlewareService', middlewareService);
		await next();
	});
	app.route('/', createSearchRoute({ createSearchService: () => options.service }));
	return app;
}

function createService(overrides: Partial<SearchService> = {}): SearchService {
	return {
		search: vi.fn(async () => ({ items: [], nextCursor: null })),
		...overrides
	};
}

function memberSession(): SessionContext {
	return {
		user: {
			id: 'usr_a' as Id<'user'>,
			username: 'member',
			isAdmin: false,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: '2026-04-26T00:00:00.000Z' as SessionContext['user']['createdAt']
		},
		sessionTokenHash: 'hash',
		activeTenantId: 'tnt_a' as Id<'tenant'>,
		role: 'member',
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}
