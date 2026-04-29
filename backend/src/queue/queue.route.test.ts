import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import { createQueueRoute } from './queue.route';
import type { QueueService } from './queue.service';
import type { QueueStateDto } from './queue.type';

describe('queue route', () => {
	it('GET /queue returns state for tenant member', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(emptyState());
	});

	it('GET /queue returns 401 without session', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: null });

		const res = await app.request('/queue', { headers: {} }, createTestEnv());

		expect(res.status).toBe(401);
	});

	it('GET /queue returns state for viewer (personal data)', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/queue',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
	});

	it('POST /queue/items returns 201 with state', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue/items',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: ['trk_a'] })
			},
			createTestEnv()
		);

		expect(res.status).toBe(201);
		expect(service.addItems).toHaveBeenCalled();
	});

	it('POST /queue/items returns 400 for empty trackIds', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue/items',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: [] })
			},
			createTestEnv()
		);

		expect(res.status).toBe(400);
	});

	it('PATCH /queue/items/:id returns 200', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue/items/qi_a',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ position: 2 })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(service.updateItem).toHaveBeenCalled();
	});

	it('PATCH /queue/items/:id returns 400 when no fields', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue/items/qi_a',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({})
			},
			createTestEnv()
		);

		expect(res.status).toBe(400);
	});

	it('DELETE /queue/items/:id returns 200 with state', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue/items/qi_a',
			{ method: 'DELETE', headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(service.deleteItem).toHaveBeenCalled();
	});

	it('DELETE /queue returns 204', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/queue',
			{ method: 'DELETE', headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(204);
		expect(service.clearQueue).toHaveBeenCalled();
	});
});

type FixtureOptions = {
	service: QueueService;
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
	app.route('/', createQueueRoute({ createQueueService: () => options.service }));
	return app;
}

function emptyState(): QueueStateDto {
	return { items: [], currentItemId: null, updatedAt: null };
}

function createService(overrides: Partial<QueueService> = {}): QueueService {
	return {
		getState: vi.fn(async () => emptyState()),
		addItems: vi.fn(async () => emptyState()),
		updateItem: vi.fn(async () => emptyState()),
		deleteItem: vi.fn(async () => emptyState()),
		clearQueue: vi.fn(async () => undefined),
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
