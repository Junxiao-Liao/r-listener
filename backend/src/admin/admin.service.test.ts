import { describe, expect, it, vi } from 'vitest';
import type { Id, Iso8601 } from '../shared/shared.type';
import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';
import type { AdminRepository } from './admin.repository';
import { createAdminService, redactSecrets } from './admin.service';

describe('admin service', () => {
	it('rejects duplicate usernames and weak passwords on create', async () => {
		const duplicate = createAdminService({
			adminRepository: repositoryFixture({ userByUsername: userFixture() }),
			hashPassword: vi.fn()
		});
		const weak = createAdminService({ adminRepository: repositoryFixture() });

		await expect(
			duplicate.createUser({
				actor: actor(),
				body: { username: 'alice', password: 'Stronger123!', isAdmin: false }
			})
		).rejects.toMatchObject({ status: 409, code: 'username_conflict' });
		await expect(
			weak.createUser({
				actor: actor(),
				body: { username: 'alice', password: 'weak-password', isAdmin: false }
			})
		).rejects.toMatchObject({ status: 422, code: 'weak_password' });
	});

	it('creates users with optional viewer membership and redacted audit metadata', async () => {
		const repository = repositoryFixture();
		const service = createAdminService({
			adminRepository: repository,
			hashPassword: vi.fn(async () => 'hash'),
			now
		});

		const created = await service.createUser({
			actor: actor(),
			body: {
				username: 'Alice',
				password: 'Stronger123!',
				isAdmin: false,
				initialMembership: { tenantId: tenantId('tnt_a'), role: 'viewer' }
			}
		});

		expect(created.id).toBe('usr_b');
		expect(repository.createMembership).toHaveBeenCalledWith({
			tenantId: 'tnt_a',
			userId: 'usr_b',
			role: 'viewer',
			now: now()
		});
		expect(repository.insertAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'user.create',
				meta: {
					request: expect.objectContaining({ password: '[REDACTED]' })
				}
			})
		);
	});

	it('revokes sessions when resetting passwords', async () => {
		const repository = repositoryFixture();
		const service = createAdminService({
			adminRepository: repository,
			hashPassword: vi.fn(async () => 'new-hash'),
			now
		});

		await service.resetPassword({
			actor: actor(),
			userId: userId('usr_b'),
			body: { newPassword: 'Stronger123!' }
		});

		expect(repository.resetUserPassword).toHaveBeenCalledWith({
			userId: 'usr_b',
			passwordHash: 'new-hash',
			now: now()
		});
		expect(repository.revokeUserSessions).toHaveBeenCalledWith('usr_b');
		expect(repository.insertAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'user.reset_password' })
		);
	});

	it('rejects self demotion, self deactivation, and self deletion', async () => {
		const service = createAdminService({ adminRepository: repositoryFixture() });

		await expect(
			service.updateUser({ actor: actor('usr_a'), userId: userId('usr_a'), body: { isAdmin: false } })
		).rejects.toMatchObject({ status: 422, code: 'cannot_self_downgrade' });
		await expect(
			service.updateUser({ actor: actor('usr_a'), userId: userId('usr_a'), body: { isActive: false } })
		).rejects.toMatchObject({ status: 422, code: 'cannot_self_downgrade' });
		await expect(
			service.deleteUser({ actor: actor('usr_a'), userId: userId('usr_a') })
		).rejects.toMatchObject({ status: 422, code: 'cannot_self_delete' });
	});

	it('creates tenants with a required initial owner in one audited operation', async () => {
		const repository = repositoryFixture();
		const service = createAdminService({ adminRepository: repository, now });

		const result = await service.createTenant({
			actor: actor(),
			body: { name: 'New Tenant', ownerUserId: userId('usr_b') }
		});

		expect(result.tenant.id).toBe('tnt_b');
		expect(repository.createMembership).toHaveBeenCalledWith({
			tenantId: 'tnt_b',
			userId: 'usr_b',
			role: 'owner',
			now: now()
		});
		expect(repository.insertAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'tenant.create', tenantId: 'tnt_b' })
		);
	});

	it('rejects last-owner demotion and removal', async () => {
		const repository = repositoryFixture({ ownerCount: 1 });
		const service = createAdminService({ adminRepository: repository });

		await expect(
			service.updateMembership({
				actor: actor(),
				tenantId: tenantId('tnt_a'),
				userId: userId('usr_b'),
				body: { role: 'viewer' }
			})
		).rejects.toMatchObject({ status: 422, code: 'cannot_remove_last_owner' });
		await expect(
			service.deleteMembership({
				actor: actor(),
				tenantId: tenantId('tnt_a'),
				userId: userId('usr_b')
			})
		).rejects.toMatchObject({ status: 422, code: 'cannot_remove_last_owner' });
		await expect(
			service.deleteUser({ actor: actor(), userId: userId('usr_b') })
		).rejects.toMatchObject({ status: 422, code: 'cannot_remove_last_owner' });
	});

	it('supports viewer membership create, update, and list', async () => {
		const repository = repositoryFixture({ ownerCount: 2 });
		const service = createAdminService({ adminRepository: repository, now });

		await expect(
			service.createMembership({
				actor: actor(),
				tenantId: tenantId('tnt_a'),
				body: { userId: userId('usr_c'), role: 'viewer' }
			})
		).resolves.toMatchObject({ role: 'viewer' });
		await expect(
			service.updateMembership({
				actor: actor(),
				tenantId: tenantId('tnt_a'),
				userId: userId('usr_b'),
				body: { role: 'viewer' }
			})
		).resolves.toMatchObject({ role: 'viewer' });
		await expect(
			service.listTenantMembers({ tenantId: tenantId('tnt_a'), limit: 50 })
		).resolves.toMatchObject({ items: [expect.objectContaining({ role: 'owner' })] });
	});

	it('recursively redacts password and token keys', () => {
		expect(
			redactSecrets({
				password: 'a',
				profile: { apiToken: 'b', nested: [{ newPassword: 'c' }] }
			})
		).toEqual({
			password: '[REDACTED]',
			profile: { apiToken: '[REDACTED]', nested: [{ newPassword: '[REDACTED]' }] }
		});
	});
});

type RepositoryOptions = {
	userByUsername?: UserDto | null;
	ownerCount?: number;
};

function repositoryFixture(options: RepositoryOptions = {}): AdminRepository {
	const tenant = tenantFixture();
	const user = userFixture({ id: userId('usr_b'), username: 'bob' });
	const membership = membershipFixture({ role: 'owner' });
	const repository = {
		db: {} as never,
		withTransaction: vi.fn((fn) => fn(repository as unknown as AdminRepository)),
		listUsers: vi.fn(async () => ({ items: [], nextCursor: null })),
		findUserById: vi.fn(async () => user),
		findUserByUsername: vi.fn(async () => options.userByUsername ?? null),
		getUserDetail: vi.fn(async () => ({ ...user, memberships: [membership] })),
		createUser: vi.fn(async () => user),
		updateUser: vi.fn(async ({ patch }) => ({ ...user, ...patch })),
		resetUserPassword: vi.fn(async () => true),
		revokeUserSessions: vi.fn(async () => undefined),
		deleteUser: vi.fn(async () => true),
		listTenants: vi.fn(async () => ({ items: [], nextCursor: null })),
		findTenantById: vi.fn(async () => tenant),
		createTenant: vi.fn(async () => tenantFixture({ id: tenantId('tnt_b'), name: 'New Tenant' })),
		updateTenant: vi.fn(async ({ name }) => ({ ...tenant, name })),
		deleteTenant: vi.fn(async () => true),
		listTenantMembers: vi.fn(async () => ({
			items: [{ ...membership, user }],
			nextCursor: null
		})),
		findActiveMembership: vi.fn(async ({ userId }) => (userId === 'usr_c' ? null : membership)),
		createMembership: vi.fn(async ({ role, tenantId }) =>
			membershipFixture({ role, tenantId: tenantId as Id<'tenant'> })
		),
		updateMembership: vi.fn(async ({ role, tenantId }) =>
			membershipFixture({ role, tenantId: tenantId as Id<'tenant'> })
		),
		deleteMembership: vi.fn(async () => true),
		countTenantOwners: vi.fn(async () => options.ownerCount ?? 2),
		clearActiveTenantSessions: vi.fn(async () => undefined),
		insertAudit: vi.fn(async () => undefined)
	};
	return repository as unknown as AdminRepository;
}

function now(): Date {
	return new Date('2026-04-26T00:00:00.000Z');
}

function actor(id = 'usr_a') {
	return { id: userId(id) };
}

function userFixture(overrides: Partial<UserDto> = {}): UserDto {
	return {
		id: userId('usr_a'),
		username: 'alice',
		isAdmin: true,
		isActive: true,
		lastActiveTenantId: null,
		createdAt: iso('2026-04-01T00:00:00.000Z'),
		...overrides
	};
}

function tenantFixture(overrides: Partial<TenantDto> = {}): TenantDto {
	return {
		id: tenantId('tnt_a'),
		name: 'Tenant A',
		createdAt: iso('2026-04-01T00:00:00.000Z'),
		...overrides
	};
}

function membershipFixture(overrides: Partial<TenantMembershipDto> = {}): TenantMembershipDto {
	return {
		tenantId: tenantId('tnt_a'),
		tenantName: 'Tenant A',
		role: 'owner',
		createdAt: iso('2026-04-01T00:00:00.000Z'),
		...overrides
	};
}

function userId(value: string): Id<'user'> {
	return value as Id<'user'>;
}

function tenantId(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

function iso(value: string): Iso8601 {
	return value as Iso8601;
}
