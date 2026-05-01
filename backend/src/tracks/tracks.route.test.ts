import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { createTestEnv } from '../test/test-env';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { TracksService } from './tracks.service';
import { createTracksRoute } from './tracks.route';
import type { TrackDto } from './tracks.type';
import type { Id } from '../shared/shared.type';

describe('tracks route', () => {
	it('GET /tracks returns track list for tenant member', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request('/tracks', { headers: { cookie: 'session=valid' } }, createTestEnv());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: [trackFixture()], nextCursor: null });
		expect(service.listTracks).toHaveBeenCalled();
	});

	it('GET /tracks returns 401 without session', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: null });

		const res = await app.request('/tracks', { headers: {} }, createTestEnv());

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: { code: 'unauthenticated', message: 'Authentication required.' }
		});
	});

	it('GET /tracks returns 403 without active tenant', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: sessionWithoutTenant() });

		const res = await app.request(
			'/tracks',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('GET /tracks/:id returns single track', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(trackFixture());
	});

	it('POST /tracks returns 403 for viewer', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const formData = new FormData();
		formData.set('file', new File(['audio'], 'test.mp3', { type: 'audio/mpeg' }));

		const res = await app.request(
			'/tracks',
			{
				method: 'POST',
				headers: { cookie: 'session=valid' },
				body: formData
			},
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('POST /tracks/:id/finalize returns 403 for viewer', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/tracks/trk_a/finalize',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ durationMs: 180000 })
			},
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('PATCH /tracks/:id returns 403 for viewer', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/tracks/trk_a',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ title: 'New' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('PUT /tracks/:id/lyrics returns 403 for viewer', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/tracks/trk_a/lyrics',
			{
				method: 'PUT',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ lyricsLrc: '[00:01.00]Test' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('DELETE /tracks/:id/lyrics returns 403 for viewer', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/tracks/trk_a/lyrics',
			{
				method: 'DELETE',
				headers: { cookie: 'session=valid' }
			},
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('DELETE /tracks/:id returns 403 for viewer', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: viewerSession() });

		const res = await app.request(
			'/tracks/trk_a',
			{
				method: 'DELETE',
				headers: { cookie: 'session=valid' }
			},
			createTestEnv()
		);

		expect(res.status).toBe(403);
	});

	it('POST /tracks/:id/finalize succeeds for editor', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a/finalize',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ durationMs: 180000 })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(trackFixture());
		expect(service.finalizeTrack).toHaveBeenCalled();
	});

	it('POST /tracks passes repeated artistNames metadata for editor', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });
		const formData = new FormData();
		formData.set('file', new File(['audio'], 'test.mp3', { type: 'audio/mpeg' }));
		formData.set('title', 'Title');
		formData.append('artistNames', 'A');
		formData.append('artistNames', 'B');

		const res = await app.request(
			'/tracks',
			{
				method: 'POST',
				headers: { cookie: 'session=valid' },
				body: formData
			},
			createTestEnv()
		);

		expect(res.status).toBe(201);
		expect(service.createTrack).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: { title: 'Title', artistNames: ['A', 'B'] } })
		);
	});

	it('PATCH /tracks/:id updates metadata for editor', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a',
			{
				method: 'PATCH',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ title: 'Updated Title' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(trackFixture());
		expect(service.updateTrack).toHaveBeenCalledWith(
			expect.objectContaining({ input: { title: 'Updated Title' } })
		);
	});

	it('PUT /tracks/:id/lyrics sets lyrics for editor', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a/lyrics',
			{
				method: 'PUT',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ lyricsLrc: '[00:01.00]Hello\n[00:02.00]World' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(trackFixture());
	});

	it('DELETE /tracks/:id/lyrics clears lyrics for editor', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a/lyrics',
			{
				method: 'DELETE',
				headers: { cookie: 'session=valid' }
			},
			createTestEnv()
		);

		expect(res.status).toBe(204);
		expect(service.clearLyrics).toHaveBeenCalled();
	});

	it('DELETE /tracks/:id soft-deletes for editor', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a',
			{
				method: 'DELETE',
				headers: { cookie: 'session=valid' }
			},
			createTestEnv()
		);

		expect(res.status).toBe(204);
		expect(service.softDeleteTrack).toHaveBeenCalled();
	});

	it('GET /tracks/:id/stream returns audio stream', async () => {
		const service = createService();
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a/stream',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
	});

	it('GET /tracks/:id/stream returns 404 for pending track', async () => {
		const service = createService({
			getStream: vi.fn(async () => {
				const { apiError } = await import('../http/api-error');
				throw apiError(404, 'track_not_ready', 'Track is not ready for streaming.');
			})
		});
		const app = createFixtureApp({ service, session: memberSession() });

		const res = await app.request(
			'/tracks/trk_a/stream',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(404);
	});
});

type FixtureOptions = {
	service: TracksService;
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
	app.route('/', createTracksRoute({ createTracksService: () => options.service }));
	return app;
}

function createService(overrides: Partial<TracksService> = {}): TracksService {
	return {
		listTracks: vi.fn(async () => ({ items: [trackFixture()], nextCursor: null })),
		getTrack: vi.fn(async () => trackFixture()),
		createTrack: vi.fn(async () => trackFixture()),
		finalizeTrack: vi.fn(async () => trackFixture()),
		updateTrack: vi.fn(async () => trackFixture()),
		setLyrics: vi.fn(async () => trackFixture()),
		clearLyrics: vi.fn(async () => trackFixture()),
		softDeleteTrack: vi.fn(async () => trackFixture()),
		getStream: vi.fn(
			async () =>
				({
					body: 'stream' as unknown as ReadableStream,
					httpMetadata: {},
					size: 1000
				}) as never
		),
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
	return {
		...memberSession(),
		role: 'viewer'
	};
}

function sessionWithoutTenant(): SessionContext {
	return {
		...memberSession(),
		activeTenantId: null,
		role: null
	};
}

function trackFixture(): TrackDto {
	return {
		id: 'trk_a' as Id<'track'>,
		tenantId: 'tnt_a' as Id<'tenant'>,
		title: 'Test Song',
		artists: [{ id: 'art_a' as Id<'artist'>, name: 'Test Artist' }],
		album: 'Test Album',
		trackNumber: null,
		genre: null,
		year: null,
		durationMs: 180000,
		coverUrl: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		contentType: 'audio/mpeg',
		sizeBytes: 1024,
		status: 'ready',
		createdAt: '2026-04-26T00:00:00.000Z' as TrackDto['createdAt'],
		updatedAt: '2026-04-26T00:00:00.000Z' as TrackDto['updatedAt']
	};
}
