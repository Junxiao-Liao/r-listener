import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { createTestEnv } from '../test/test-env';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { AdminService } from './admin.service';
import type { AdminTenantListItemDto } from './admin.type';

describe('admin route', () => {
	it('returns active tenants for admins without requiring an active tenant', async () => {
		const tenants = [tenantFixture({ memberCount: 3, trackCount: 12 })];
		const app = createFixtureApp({ session: sessionFixture({ userIsAdmin: true }), tenants });

		const res = await app.request(
			'/api/admin/tenants',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ tenants });
	});

	it('rejects non-admin users', async () => {
		const service = createAdminService([]);
		const app = createFixtureApp({ session: sessionFixture(), service });

		const res = await app.request(
			'/api/admin/tenants',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			error: { code: 'admin_required', message: 'Admin access required.' }
		});
		expect(service.listTenants).not.toHaveBeenCalled();
	});
});

type FixtureOptions = {
	session: SessionContext | null;
	tenants?: AdminTenantListItemDto[];
	service?: AdminService;
};

function createFixtureApp(options: FixtureOptions) {
	const middlewareService: MiddlewareService = {
		validateSession: vi.fn(async ({ token }) =>
			token === 'valid' && options.session
				? { ...options.session, refreshedSessionExpiresAt: null }
				: null
		),
		resolveTenantAccess: vi.fn(),
		checkAuthRateLimit: vi.fn(async () => ({ allowed: true }))
	};
	const service = options.service ?? createAdminService(options.tenants ?? []);

	return createApp({
		createMiddlewareService: () => middlewareService,
		createAdminService: () => service
	});
}

function createAdminService(tenants: AdminTenantListItemDto[]): AdminService {
	return {
		adminRepository: {} as never,
		listTenants: vi.fn(async () => tenants)
	};
}

function sessionFixture(
	overrides: { activeTenantId?: SessionContext['activeTenantId']; userIsAdmin?: boolean } = {}
): SessionContext {
	return {
		user: {
			id: 'usr_018f0000-0000-7000-8000-000000000000' as SessionContext['user']['id'],
			username: 'user',
			isAdmin: overrides.userIsAdmin ?? false,
			isActive: true,
			lastActiveTenantId: null,
			createdAt: '2026-04-26T00:00:00.000Z' as SessionContext['user']['createdAt']
		},
		sessionTokenHash: 'hash',
		activeTenantId: overrides.activeTenantId ?? null,
		role: null,
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

function tenantFixture(overrides: Partial<AdminTenantListItemDto> = {}): AdminTenantListItemDto {
	return {
		id: 'tnt_a' as AdminTenantListItemDto['id'],
		name: 'Tenant A',
		createdAt: '2026-04-01T00:00:00.000Z' as AdminTenantListItemDto['createdAt'],
		memberCount: 0,
		trackCount: 0,
		...overrides
	};
}
