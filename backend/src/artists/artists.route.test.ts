import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id, Iso8601 } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import { createArtistsRoute } from './artists.route';
import type { ArtistsService } from './artists.service';
import type { ArtistAggregateDto, ArtistTrackListResult } from './artists.type';

const FIXED_NOW = '2026-05-02T12:00:00.000Z' as Iso8601;

function makeArtistAggregate(overrides: Partial<ArtistAggregateDto> = {}): ArtistAggregateDto {
	return {
		id: 'art_a' as Id<'artist'>,
		name: 'Test Artist',
		trackCount: 5,
		totalDurationMs: 900000,
		...overrides
	};
}

function makeArtistTrackListResult(): ArtistTrackListResult {
	return {
		items: [
			{
				id: 'trk_a' as Id<'track'>,
				tenantId: 'tnt_a' as Id<'tenant'>,
				title: 'Song A',
				artists: [{ id: 'art_a' as Id<'artist'>, name: 'Test Artist' }],
				album: null,
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
				createdAt: FIXED_NOW,
				updatedAt: FIXED_NOW
			}
		]
	};
}

describe('artists route', () => {
	describe('GET /artists/:id', () => {
		it('returns artist aggregate', async () => {
			const service = createService({
				getArtist: vi.fn(async () => makeArtistAggregate())
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/artists/art_a',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toMatchObject({ id: 'art_a', trackCount: 5 });
			expect(service.getArtist).toHaveBeenCalled();
		});

		it('returns 404 when artist not found', async () => {
			const { apiError } = await import('../http/api-error');
			const service = createService({
				getArtist: vi.fn(async () => {
					throw apiError(404, 'artist_not_found', 'Artist not found.');
				})
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/artists/missing',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(404);
			expect(await res.json()).toMatchObject({ error: { code: 'artist_not_found' } });
		});

		it('returns 401 without session', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: null });
			const res = await app.request('/artists/art_a', {}, createTestEnv());
			expect(res.status).toBe(401);
		});

		it('returns 403 without active tenant', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: sessionWithoutTenant() });
			const res = await app.request(
				'/artists/art_a',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(403);
		});

		it('viewer can access artist detail', async () => {
			const service = createService({
				getArtist: vi.fn(async () => makeArtistAggregate())
			});
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/artists/art_a',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});
	});

	describe('GET /artists/:id/tracks', () => {
		it('returns artist tracks', async () => {
			const service = createService({
				listArtistTracks: vi.fn(async () => makeArtistTrackListResult())
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/artists/art_a/tracks',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
			const body = ((await res.json()) as { items: Array<{ title: string }> });
			expect(body.items).toHaveLength(1);
			expect(body.items[0]!.title).toBe('Song A');
		});

		it('returns 404 when artist not found', async () => {
			const { apiError } = await import('../http/api-error');
			const service = createService({
				listArtistTracks: vi.fn(async () => {
					throw apiError(404, 'artist_not_found', 'Artist not found.');
				})
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/artists/missing/tracks',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(404);
		});

		it('returns 401 without session', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: null });
			const res = await app.request('/artists/art_a/tracks', {}, createTestEnv());
			expect(res.status).toBe(401);
		});

		it('viewer can list artist tracks', async () => {
			const service = createService({
				listArtistTracks: vi.fn(async () => makeArtistTrackListResult())
			});
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/artists/art_a/tracks',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});
	});
});

type FixtureOptions = {
	service: ArtistsService;
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
	app.route('/', createArtistsRoute({ createArtistsService: () => options.service }));
	return app;
}

function createService(overrides: Partial<ArtistsService> = {}): ArtistsService {
	return {
		listArtists: vi.fn(async () => ({ items: [], nextCursor: null })),
		getArtist: vi.fn(async () => makeArtistAggregate()),
		listArtistTracks: vi.fn(async () => makeArtistTrackListResult()),
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
