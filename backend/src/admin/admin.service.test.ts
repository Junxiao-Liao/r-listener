import { describe, expect, it, vi } from 'vitest';
import type { Id, Iso8601 } from '../shared/shared.type';
import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';
import type { AdminRepository } from './admin.repository';
import { createAdminService, redactSecrets } from './admin.service';
import type { Db } from '../db';

let idCounter = 0;
vi.mock('../shared/id', () => ({
	createId: vi.fn((prefix: string) => {
		idCounter++;
		if (prefix === 'usr_') return 'usr_b' as any;
		if (prefix === 'tnt_') return 'tnt_b' as any;
		return `${prefix}${idCounter}` as any;
	}),
	isPrefixedUuidV7: vi.fn(() => true)
}));

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
		const db = createMockDb();
		const repository = repositoryFixture({ db });
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
		const batchArgs = (db.batch as any).mock.calls[0][0] as any[];
		expect(batchArgs.length).toBe(3);
		// third query should be the audit with redacted password
		expect(batchArgs[2]).toHaveProperty('__values');
		expect(batchArgs[2].__values.meta.request).toEqual(
			expect.objectContaining({ password: '[REDACTED]' })
		);
	});

	it('revokes sessions when resetting passwords', async () => {
		const db = createMockDb();
		const repository = repositoryFixture({ db });
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

		const batchArgs2 = (db.batch as any).mock.calls[0][0] as any[];
		expect(batchArgs2.length).toBe(2);
		expect(batchArgs2[1].__values).toHaveProperty('action', 'user.reset_password');
		expect(repository.revokeUserSessions).toHaveBeenCalledWith('usr_b');
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
		const db = createMockDb();
		const repository = repositoryFixture({ db });
		const service = createAdminService({ adminRepository: repository, now });

		const result = await service.createTenant({
			actor: actor(),
			body: { name: 'New Tenant', ownerUserId: userId('usr_b') }
		});

		expect(result.tenant.id).toBe('tnt_b');
		const batchArgs3 = (db.batch as any).mock.calls[0][0] as any[];
		expect(batchArgs3.length).toBe(3);
		// third query should be audit with tenantId
		expect(batchArgs3[2].__values).toHaveProperty('action', 'tenant.create');
		expect(batchArgs3[2].__values).toHaveProperty('tenantId', 'tnt_b');
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
		const db = createMockDb();
		const repository = repositoryFixture({ db, ownerCount: 2 });
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
	db?: ReturnType<typeof createMockDb>;
};

function createMockDb() {
	const baseTimestamp = now();

	const batch = vi.fn(async (queries: any[]) =>
		queries.map((q: any) => {
			if (!q.__returning) return [];
			return [{ ...q.__defaults, ...q.__values, ...q.__inserted }];
		})
	);

	function chainable(overrides: Record<string, unknown> = {}) {
		const obj: Record<string, any> = {
			__defaults: {},
			...overrides,
			returning: vi.fn(function (this: any) {
				this.__returning = true;
				return this;
			}),
			values: vi.fn(function (this: any, vals: any) {
				this.__values = { ...this.__values, ...vals };
				this.__defaults = { createdAt: baseTimestamp, updatedAt: baseTimestamp, deletedAt: null };
				return this;
			}),
			set: vi.fn(function (this: any, vals: any) {
				this.__values = { ...this.__values, ...vals };
				return this;
			}),
			where: vi.fn(function (this: any) {
				return this;
			}),
			limit: vi.fn(function (this: any) {
				return this;
			})
		};
		return obj;
	}

	const db = {
		batch,
		insert: vi.fn((_table: any) => {
			const builder = chainable();
			builder.values = vi.fn(function (vals: any) {
				builder.__values = { ...vals };
				builder.__inserted = { id: vals.id };
				builder.__defaults = {
					createdAt: baseTimestamp,
					updatedAt: baseTimestamp,
					deletedAt: null
				};
				return builder;
			});
			return builder;
		}),
		update: vi.fn((_table: any) => {
			const builder = chainable();
			builder.__defaults = {
				createdAt: baseTimestamp,
				updatedAt: baseTimestamp,
				deletedAt: null
			};
			builder.set = vi.fn(function (vals: any) {
				builder.__values = { ...builder.__values, ...vals };
				return builder;
			});
			builder.where = vi.fn(function () {
				return builder;
			});
			return builder;
		}),
		select: vi.fn((_fields?: any) => {
			const query: any = {
				from: vi.fn((_table: any) => query),
				where: vi.fn(() => query),
				limit: vi.fn(async () => [{
					id: 'tnt_a',
					name: 'Tenant A',
					createdAt: baseTimestamp,
					updatedAt: baseTimestamp,
					deletedAt: null
				}]),
				orderBy: vi.fn(() => query),
			};
			return query;
		}),
		delete: vi.fn((_table: any) => {
			const builder = chainable();
			builder.where = vi.fn(function () {
				return builder;
			});
			return builder;
		})
	};

	return db as unknown as Db;
}

function repositoryFixture(options: RepositoryOptions = {}): AdminRepository {
	const db = options.db ?? (createMockDb() as unknown as Db);
	const tenant = tenantFixture();
	const user = userFixture({ id: userId('usr_b'), username: 'bob' });
	const membership = membershipFixture({ role: 'owner' });
	const repository = {
		db,
		batch: (...args: any[]) => (db.batch as any)(...args),
		listUsers: vi.fn(async () => ({ items: [], nextCursor: null })),
		findUserById: vi.fn(async () => user),
		findUserByUsername: vi.fn(async () => options.userByUsername ?? null),
		getUserDetail: vi.fn(async () => ({ ...user, memberships: [membership] })),
		createUser: vi.fn(async () => user),
		updateUser: vi.fn(async ({ patch }: any) => ({ ...user, ...patch })),
		resetUserPassword: vi.fn(async () => true),
		revokeUserSessions: vi.fn(async () => undefined),
		deleteUser: vi.fn(async () => true),
		listTenants: vi.fn(async () => ({ items: [], nextCursor: null })),
		findTenantById: vi.fn(async () => tenant),
		createTenant: vi.fn(async () => tenantFixture({ id: tenantId('tnt_b'), name: 'New Tenant' })),
		updateTenant: vi.fn(async ({ name }: any) => ({ ...tenant, name })),
		deleteTenant: vi.fn(async () => true),
		listTenantMembers: vi.fn(async () => ({
			items: [{ ...membership, user }],
			nextCursor: null
		})),
		findActiveMembership: vi.fn(async ({ userId }: any) => (userId === 'usr_c' ? null : membership)),
		createMembership: vi.fn(async ({ role, tenantId }: any) =>
			membershipFixture({ role, tenantId: tenantId as Id<'tenant'> })
		),
		updateMembership: vi.fn(async ({ role, tenantId }: any) =>
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
