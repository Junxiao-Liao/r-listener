import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import { createArtistsRoute } from './artists.route';
import type { ArtistsService } from './artists.service';

describe('artists route', () => {
	it('GET /artists returns tenant-scoped autocomplete results', async () => {
		const service = createService();
		const app = createFixtureApp(service);

		const res = await app.request(
			'/artists?q=ad&limit=5',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			items: [{ id: 'art_a', name: 'Adele' }],
			nextCursor: null
		});
		expect(service.listArtists).toHaveBeenCalledWith({
			tenantId: 'tnt_a',
			query: { q: 'ad', limit: 5 }
		});
	});

	it('GET /artists requires an active tenant', async () => {
		const service = createService();
		const app = createFixtureApp(service, { ...session(), activeTenantId: null, role: null });

		const res = await app.request('/artists', { headers: { cookie: 'session=valid' } }, createTestEnv());

		expect(res.status).toBe(403);
	});
});

function createFixtureApp(service: ArtistsService, sessionContext: SessionContext | null = session()) {
	const middlewareService: MiddlewareService = {
		validateSession: vi.fn(async ({ token }) =>
			token === 'valid' && sessionContext
				? { ...sessionContext, refreshedSessionExpiresAt: null }
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
	app.route('/', createArtistsRoute({ createArtistsService: () => service }));
	return app;
}

function createService(): ArtistsService {
	return {
		listArtists: vi.fn(async () => ({
			items: [{ id: 'art_a' as Id<'artist'>, name: 'Adele' }],
			nextCursor: null
		}))
	};
}

function session(): SessionContext {
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
