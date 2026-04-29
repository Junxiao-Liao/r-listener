import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id, Iso8601 } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import { createPlaylistsRoute } from './playlists.route';
import type { PlaylistsService } from './playlists.service';
import type { PlaylistDto, PlaylistTrackDto } from './playlists.type';

const FIXED_NOW = '2026-04-29T12:00:00.000Z' as Iso8601;

function makePlaylistDto(overrides: Partial<PlaylistDto> = {}): PlaylistDto {
	return {
		id: 'pl_a' as Id<'playlist'>,
		tenantId: 'tnt_a' as Id<'tenant'>,
		name: 'Morning',
		description: null,
		trackCount: 0,
		totalDurationMs: 0,
		createdAt: FIXED_NOW,
		updatedAt: FIXED_NOW,
		...overrides
	};
}

function makePlaylistTrackDto(): PlaylistTrackDto {
	return {
		playlistId: 'pl_a' as Id<'playlist'>,
		trackId: 'trk_a' as Id<'track'>,
		position: 1,
		addedAt: FIXED_NOW,
		track: {
			id: 'trk_a' as Id<'track'>,
			tenantId: 'tnt_a' as Id<'tenant'>,
			title: 'a',
			artist: null,
			album: null,
			trackNumber: null,
			genre: null,
			year: null,
			durationMs: 1000,
			coverUrl: null,
			lyricsLrc: null,
			lyricsStatus: 'none',
			contentType: 'audio/mpeg',
			sizeBytes: 1024,
			status: 'ready',
			createdAt: FIXED_NOW,
			updatedAt: FIXED_NOW
		}
	};
}

describe('playlists route', () => {
	describe('GET /playlists', () => {
		it('returns list for tenant member', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
			expect(service.listPlaylists).toHaveBeenCalled();
		});

		it('returns 401 without session', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: null });
			const res = await app.request('/playlists', {}, createTestEnv());
			expect(res.status).toBe(401);
		});

		it('viewer can list playlists (read-only)', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});
	});

	describe('GET /playlists/:id', () => {
		it('returns playlist detail', async () => {
			const service = createService({
				getPlaylist: vi.fn(async () => makePlaylistDto())
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});
	});

	describe('POST /playlists', () => {
		it('creates a playlist for editor', async () => {
			const service = createService({
				createPlaylist: vi.fn(async () => makePlaylistDto())
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists',
				{
					method: 'POST',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'Morning' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(201);
			expect(service.createPlaylist).toHaveBeenCalled();
		});

		it('viewer gets 403 insufficient_role', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists',
				{
					method: 'POST',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'Morning' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(403);
			expect(await res.json()).toMatchObject({ error: { code: 'insufficient_role' } });
		});

		it('returns 400 for empty name', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists',
				{
					method: 'POST',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ name: '' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(400);
		});
	});

	describe('PATCH /playlists/:id', () => {
		it('updates name for editor', async () => {
			const service = createService({
				updatePlaylist: vi.fn(async () => makePlaylistDto({ name: 'New' }))
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a',
				{
					method: 'PATCH',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'New' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});

		it('viewer gets 403 insufficient_role', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists/pl_a',
				{
					method: 'PATCH',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'New' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(403);
		});

		it('returns 400 when no fields provided', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a',
				{
					method: 'PATCH',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({})
				},
				createTestEnv()
			);
			expect(res.status).toBe(400);
		});
	});

	describe('DELETE /playlists/:id', () => {
		it('soft-deletes for editor', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a',
				{ method: 'DELETE', headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(204);
			expect(service.deletePlaylist).toHaveBeenCalled();
		});

		it('viewer gets 403 insufficient_role', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists/pl_a',
				{ method: 'DELETE', headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(403);
		});
	});

	describe('GET /playlists/:id/tracks', () => {
		it('viewer can list playlist tracks', async () => {
			const service = createService({
				listTracks: vi.fn(async () => ({
					items: [makePlaylistTrackDto()],
					nextCursor: null
				}))
			});
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks',
				{ headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});
	});

	describe('POST /playlists/:id/tracks', () => {
		it('member can add a track', async () => {
			const service = createService({
				addTrack: vi.fn(async () => makePlaylistTrackDto())
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks',
				{
					method: 'POST',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ trackId: 'trk_a' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(201);
		});

		it('viewer gets 403 insufficient_role', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks',
				{
					method: 'POST',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ trackId: 'trk_a' })
				},
				createTestEnv()
			);
			expect(res.status).toBe(403);
		});

		it('returns 400 when trackId missing', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks',
				{
					method: 'POST',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({})
				},
				createTestEnv()
			);
			expect(res.status).toBe(400);
		});
	});

	describe('PATCH /playlists/:id/tracks/:trackId', () => {
		it('member can move a track', async () => {
			const service = createService({
				moveTrack: vi.fn(async () => makePlaylistTrackDto())
			});
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks/trk_a',
				{
					method: 'PATCH',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ position: 2 })
				},
				createTestEnv()
			);
			expect(res.status).toBe(200);
		});

		it('viewer gets 403 insufficient_role', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks/trk_a',
				{
					method: 'PATCH',
					headers: { cookie: 'session=valid', 'content-type': 'application/json' },
					body: JSON.stringify({ position: 2 })
				},
				createTestEnv()
			);
			expect(res.status).toBe(403);
		});
	});

	describe('DELETE /playlists/:id/tracks/:trackId', () => {
		it('member can remove a track', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: memberSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks/trk_a',
				{ method: 'DELETE', headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(204);
			expect(service.removeTrack).toHaveBeenCalled();
		});

		it('viewer gets 403 insufficient_role', async () => {
			const service = createService();
			const app = createFixtureApp({ service, session: viewerSession() });
			const res = await app.request(
				'/playlists/pl_a/tracks/trk_a',
				{ method: 'DELETE', headers: { cookie: 'session=valid' } },
				createTestEnv()
			);
			expect(res.status).toBe(403);
		});
	});
});

type FixtureOptions = {
	service: PlaylistsService;
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
	app.route('/', createPlaylistsRoute({ createPlaylistsService: () => options.service }));
	return app;
}

function createService(overrides: Partial<PlaylistsService> = {}): PlaylistsService {
	return {
		listPlaylists: vi.fn(async () => ({ items: [], nextCursor: null })),
		getPlaylist: vi.fn(async () => makePlaylistDto()),
		createPlaylist: vi.fn(async () => makePlaylistDto()),
		updatePlaylist: vi.fn(async () => makePlaylistDto()),
		deletePlaylist: vi.fn(async () => undefined),
		listTracks: vi.fn(async () => ({ items: [], nextCursor: null })),
		addTrack: vi.fn(async () => makePlaylistTrackDto()),
		moveTrack: vi.fn(async () => makePlaylistTrackDto()),
		removeTrack: vi.fn(async () => undefined),
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
