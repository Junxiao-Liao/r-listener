import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../app.type';
import { registerErrorHandlers } from '../http/error-handler';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { Id, Iso8601 } from '../shared/shared.type';
import { createTestEnv } from '../test/test-env';
import type { AdminTracksService } from './admin.tracks.service';
import { createAdminRoute } from './admin.route';
import type { AdminService } from './admin.service';
import type { AdminTrackListItemDto, AdminHardDeleteTracksResult } from './admin.tracks.type';
import type { AdminTenantListItemDto, AdminUserListItemDto } from './admin.type';

describe('admin tracks route', () => {
	it('returns 401 without a session', async () => {
		const tracksService = createTracksService();
		const app = createFixtureApp({
			session: null,
			adminService: createAdminService(),
			tracksService
		});

		const res = await app.request('/admin/tracks', { headers: {} }, createTestEnv());

		expect(res.status).toBe(401);
		expect(tracksService.listTracks).not.toHaveBeenCalled();
	});

	it('returns 403 for non-admin users', async () => {
		const tracksService = createTracksService();
		const app = createFixtureApp({
			session: sessionFixture({ isAdmin: false }),
			adminService: createAdminService(),
			tracksService
		});

		const res = await app.request('/admin/tracks', { headers: { cookie: 'session=valid' } }, createTestEnv());

		expect(res.status).toBe(403);
		expect(tracksService.listTracks).not.toHaveBeenCalled();
	});

	it('passes list query params to admin tracks service', async () => {
		const tracksService = createTracksService();
		const app = createFixtureApp({
			session: sessionFixture({ isAdmin: true }),
			adminService: createAdminService(),
			tracksService
		});

		const res = await app.request(
			'/admin/tracks?limit=25&q=song&tenantId=tnt_a',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(tracksService.listTracks).toHaveBeenCalledWith({
			limit: 25,
			cursor: undefined,
			q: 'song',
			tenantId: 'tnt_a'
		});
	});

	it('validates bulk delete payload with max 50 IDs and non-empty array', async () => {
		const tracksService = createTracksService();
		const app = createFixtureApp({
			session: sessionFixture({ isAdmin: true }),
			adminService: createAdminService(),
			tracksService
		});

		const tooManyIds = Array.from({ length: 51 }, (_, i) => `trk_${i}`);
		const tooManyRes = await app.request(
			'/admin/tracks/bulk-delete',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: tooManyIds })
			},
			createTestEnv()
		);
		const emptyRes = await app.request(
			'/admin/tracks/bulk-delete',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: [] })
			},
			createTestEnv()
		);

		expect(tooManyRes.status).toBe(400);
		expect(emptyRes.status).toBe(400);
		expect(tracksService.hardDeleteTracks).not.toHaveBeenCalled();
	});

	it('executes bulk delete and returns result shape', async () => {
		const tracksService = createTracksService({
			hardDeleteTracks: vi.fn(async () => ({
				deletedCount: 2,
				freedBytes: 1024,
				r2KeysDeleted: 1,
				r2KeysRetained: 0
			}))
		});
		const app = createFixtureApp({
			session: sessionFixture({ isAdmin: true }),
			adminService: createAdminService(),
			tracksService
		});

		const res = await app.request(
			'/admin/tracks/bulk-delete',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: ['trk_a', 'trk_b'] })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			deletedCount: 2,
			freedBytes: 1024,
			r2KeysDeleted: 1,
			r2KeysRetained: 0
		});
		expect(tracksService.hardDeleteTracks).toHaveBeenCalledWith({
			actor: expect.objectContaining({ id: 'usr_a' }),
			input: { trackIds: ['trk_a', 'trk_b'] }
		});
	});
});

type FixtureOptions = {
	session: SessionContext | null;
	adminService: AdminService;
	tracksService: AdminTracksService;
};

function createFixtureApp(options: FixtureOptions) {
	const middlewareService: MiddlewareService = {
		validateSession: vi.fn(async ({ token }) =>
			token === 'valid' && options.session
				? { ...options.session, refreshedSessionExpiresAt: null }
				: null
		),
		resolveTenantAccess: vi.fn(),
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
	app.route(
		'/',
		createAdminRoute({
			createAdminService: () => options.adminService,
			createAdminTracksService: () => options.tracksService
		})
	);
	return app;
}

function createTracksService(overrides: Partial<AdminTracksService> = {}): AdminTracksService {
	return {
		adminTracksRepository: {} as never,
		listTracks: vi.fn(async () => ({ items: [trackFixture()], nextCursor: null })),
		hardDeleteTracks: vi.fn(
			async (): Promise<AdminHardDeleteTracksResult> => ({
				deletedCount: 1,
				freedBytes: 100,
				r2KeysDeleted: 1,
				r2KeysRetained: 0
			})
		),
		...overrides
	};
}

function createAdminService(
	options: { tenants?: AdminTenantListItemDto[]; users?: AdminUserListItemDto[] } = {}
): AdminService {
	const user = userFixture({ id: userId('usr_b'), isAdmin: false });
	return {
		adminRepository: {} as never,
		listUsers: vi.fn(async () => ({ items: options.users ?? [], nextCursor: null })),
		getUser: vi.fn(async () => ({ ...user, memberships: [] })),
		createUser: vi.fn(async () => user),
		updateUser: vi.fn(async () => user),
		resetPassword: vi.fn(async () => undefined),
		deleteUser: vi.fn(async () => undefined),
		listTenants: vi.fn(async () => ({ items: options.tenants ?? [], nextCursor: null })),
		getTenant: vi.fn(async () => tenantFixture()),
		createTenant: vi.fn(async () => ({
			tenant: tenantFixture(),
			ownership: {
				tenantId: tenantId('tnt_a'),
				tenantName: 'Tenant A',
				role: 'owner' as const,
				createdAt: iso('2026-04-01T00:00:00.000Z')
			}
		})),
		updateTenant: vi.fn(async () => tenantFixture()),
		deleteTenant: vi.fn(async () => undefined),
		listTenantMembers: vi.fn(async () => ({ items: [], nextCursor: null })),
		createMembership: vi.fn(async () => ({
			tenantId: tenantId('tnt_a'),
			tenantName: 'Tenant A',
			role: 'viewer' as const,
			createdAt: iso('2026-04-01T00:00:00.000Z')
		})),
		updateMembership: vi.fn(async () => ({
			tenantId: tenantId('tnt_a'),
			tenantName: 'Tenant A',
			role: 'viewer' as const,
			createdAt: iso('2026-04-01T00:00:00.000Z')
		})),
		deleteMembership: vi.fn(async () => undefined)
	};
}

function sessionFixture(overrides: { isAdmin: boolean }): SessionContext {
	return {
		user: userFixture({ isAdmin: overrides.isAdmin }),
		sessionTokenHash: 'hash',
		activeTenantId: null,
		role: null,
		sessionExpiresAt: iso('2026-05-26T00:00:00.000Z')
	};
}

function userFixture(overrides: Partial<SessionContext['user']> = {}): SessionContext['user'] {
	return {
		id: userId('usr_a'),
		username: 'admin',
		isAdmin: true,
		isActive: true,
		lastActiveTenantId: null,
		createdAt: iso('2026-04-26T00:00:00.000Z'),
		...overrides
	};
}

function tenantFixture(overrides: Partial<AdminTenantListItemDto> = {}): AdminTenantListItemDto {
	return {
		id: tenantId('tnt_a'),
		name: 'Tenant A',
		createdAt: iso('2026-04-01T00:00:00.000Z'),
		memberCount: 0,
		trackCount: 0,
		...overrides
	};
}

function trackFixture(overrides: Partial<AdminTrackListItemDto> = {}): AdminTrackListItemDto {
	return {
		id: trackId('trk_a'),
		tenantId: tenantId('tnt_a'),
		title: 'Song A',
		artists: [],
		album: null,
		trackNumber: null,
		genre: null,
		year: null,
		durationMs: null,
		coverUrl: null,
		lyricsLrc: null,
		lyricsStatus: 'none',
		contentType: 'audio/mpeg',
		sizeBytes: 100,
		status: 'ready',
		createdAt: iso('2026-04-26T00:00:00.000Z'),
		updatedAt: iso('2026-04-26T00:00:00.000Z'),
		tenantName: 'Tenant A',
		tenantDeleted: false,
		isDeleted: false,
		audioR2Key: 'audio/a.mp3',
		...overrides
	};
}

function userId(value: string): Id<'user'> {
	return value as Id<'user'>;
}

function tenantId(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

function trackId(value: string): Id<'track'> {
	return value as Id<'track'>;
}

function iso(value: string): Iso8601 {
	return value as Iso8601;
}

