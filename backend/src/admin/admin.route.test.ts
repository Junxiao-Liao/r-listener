import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { createTestEnv } from '../test/test-env';
import type { MiddlewareService, SessionContext } from '../middleware/middleware.type';
import type { AdminService } from './admin.service';
import type { AdminTenantListItemDto, AdminUserListItemDto } from './admin.type';

describe('admin route', () => {
	it('returns canonical tenant list responses for admins without requiring an active tenant', async () => {
		const tenants = [tenantFixture({ memberCount: 3, trackCount: 12 })];
		const service = createAdminService({ tenants });
		const app = createFixtureApp({ session: sessionFixture({ userIsAdmin: true }), service });

		const res = await app.request(
			'/api/admin/tenants',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: tenants, nextCursor: null });
		expect(service.listTenants).toHaveBeenCalledWith({ limit: 50, q: undefined, cursor: undefined });
	});

	it('rejects non-admin users before calling the service', async () => {
		const service = createAdminService();
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

	it('wires user creation and reset password endpoints without exposing audit logs', async () => {
		const service = createAdminService();
		const app = createFixtureApp({ session: sessionFixture({ userIsAdmin: true }), service });

		const createRes = await app.request(
			'/api/admin/users',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({
					username: 'Alice',
					password: 'Stronger123!',
					isAdmin: false,
					initialMembership: { tenantId: 'tnt_a', role: 'viewer' }
				})
			},
			createTestEnv()
		);
		const resetRes = await app.request(
			'/api/admin/users/usr_b/reset-password',
			{
				method: 'POST',
				headers: { cookie: 'session=valid', 'content-type': 'application/json' },
				body: JSON.stringify({ newPassword: 'Stronger123!' })
			},
			createTestEnv()
		);
		const auditRes = await app.request(
			'/api/admin/audit-logs?action=user.create',
			{ headers: { cookie: 'session=valid' } },
			createTestEnv()
		);

		expect(createRes.status).toBe(201);
		expect(resetRes.status).toBe(204);
		expect(auditRes.status).toBe(404);
		expect(service.createUser).toHaveBeenCalledWith({
			actor: expect.objectContaining({ id: 'usr_a' }),
			body: {
				username: 'alice',
				password: 'Stronger123!',
				isAdmin: false,
				initialMembership: { tenantId: 'tnt_a', role: 'viewer' }
			}
		});
		expect(service.resetPassword).toHaveBeenCalledWith({
			actor: expect.objectContaining({ id: 'usr_a' }),
			userId: 'usr_b',
			body: { newPassword: 'Stronger123!' }
		});
	});
});

type FixtureOptions = {
	session: SessionContext | null;
	service: AdminService;
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

	return createApp({
		createMiddlewareService: () => middlewareService,
		createAdminService: () => options.service
	});
}

function createAdminService(
	options: { tenants?: AdminTenantListItemDto[]; users?: AdminUserListItemDto[] } = {}
): AdminService {
	const user = userFixture({ id: 'usr_b' as AdminUserListItemDto['id'], isAdmin: false });
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
				tenantId: 'tnt_a' as AdminTenantListItemDto['id'],
				tenantName: 'Tenant A',
				role: 'owner' as const,
				createdAt: '2026-04-01T00:00:00.000Z' as AdminTenantListItemDto['createdAt']
			}
		})),
		updateTenant: vi.fn(async () => tenantFixture()),
		deleteTenant: vi.fn(async () => undefined),
		listTenantMembers: vi.fn(async () => ({ items: [], nextCursor: null })),
		createMembership: vi.fn(async () => ({
			tenantId: 'tnt_a' as AdminTenantListItemDto['id'],
			tenantName: 'Tenant A',
			role: 'viewer' as const,
			createdAt: '2026-04-01T00:00:00.000Z' as AdminTenantListItemDto['createdAt']
		})),
		updateMembership: vi.fn(async () => ({
			tenantId: 'tnt_a' as AdminTenantListItemDto['id'],
			tenantName: 'Tenant A',
			role: 'viewer' as const,
			createdAt: '2026-04-01T00:00:00.000Z' as AdminTenantListItemDto['createdAt']
		})),
		deleteMembership: vi.fn(async () => undefined)
	};
}

function sessionFixture(
	overrides: { activeTenantId?: SessionContext['activeTenantId']; userIsAdmin?: boolean } = {}
): SessionContext {
	return {
		user: userFixture({ isAdmin: overrides.userIsAdmin ?? false }),
		sessionTokenHash: 'hash',
		activeTenantId: overrides.activeTenantId ?? null,
		role: null,
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

function userFixture(
	overrides: Partial<SessionContext['user']> = {}
): SessionContext['user'] {
	return {
		id: 'usr_a' as SessionContext['user']['id'],
		username: 'user',
		isAdmin: true,
		isActive: true,
		lastActiveTenantId: null,
		createdAt: '2026-04-26T00:00:00.000Z' as SessionContext['user']['createdAt'],
		...overrides
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
