import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import { createPlaybackRoute } from './playback.route';
import type { PlaybackService } from './playback.service';

describe('playback route', () => {
	it('POST /playback-events returns 204 for member', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/playback-events',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({
					events: [
						{
							trackId: 'trk_a',
							startedAt: '2026-04-29T11:00:00.000Z',
							positionMs: 0,
							event: 'play',
							playlistId: null
						}
					]
				})
			},
			createTestEnv()
		);

		expect(res.status).toBe(204);
		expect(service.recordEvents).toHaveBeenCalled();
	});

	it('POST /playback-events returns 204 for viewer (personal data)', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/playback-events',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({
					events: [
						{
							trackId: 'trk_a',
							startedAt: '2026-04-29T11:00:00.000Z',
							positionMs: 0,
							event: 'play',
							playlistId: null
						}
					]
				})
			},
			createTestEnv()
		);

		expect(res.status).toBe(204);
	});

	it('POST /playback-events returns 400 for malformed payload', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/playback-events',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ events: [] })
			},
			createTestEnv()
		);

		expect(res.status).toBe(400);
	});

	it('POST /playback-events returns 401 without session', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: null });

		const res = await app.request(
			'/playback-events',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ events: [] })
			},
			createTestEnv()
		);

		expect(res.status).toBe(401);
	});

	it('GET /me/recent-tracks returns list', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/me/recent-tracks',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: [], nextCursor: null });
	});

	it('GET /me/continue-listening returns list', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/me/continue-listening',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: [], nextCursor: null });
	});

	it('GET /me/recent-tracks returns 403 without active tenant', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: sessionWithoutTenant() });

		const res = await app.request(
			'/me/recent-tracks',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});
});

type FixtureOptions = {
	service: PlaybackService;
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
		checkAuthRateLimit: vi.fn(async () => ({ allowed: true }))
	};

	const app = new Hono<BackendEnv>();
	registerErrorHandlers(app);
	app.use('*', async (c, next) => {
		c.set('db', {} as never);
		c.set('middlewareService', middlewareService);
		await next();
	});
	app.route('/', createPlaybackRoute({ createPlaybackService: () => options.service }));
	return app;
}

function createService(overrides: Partial<PlaybackService> = {}): PlaybackService {
	return {
		recordEvents: vi.fn(async () => undefined),
		listRecent: vi.fn(async () => ({ items: [], nextCursor: null })),
		listContinueListening: vi.fn(async () => ({ items: [], nextCursor: null })),
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

function viewerSession(): SessionContext {
	return { ...memberSession(), role: 'viewer' };
}

function sessionWithoutTenant(): SessionContext {
	return { ...memberSession(), activeTenantId: null, role: null };
}
