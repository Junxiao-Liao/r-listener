import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreferencesDto } from '../prefs/prefs.type';
import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import type { Id, Iso8601 } from '../shared/shared.type';
import type { UserDto } from '../users/users.type';
import type { UserPasswordRecord } from '../users/users.repository';
import type { AuthRepository } from './auth.repository';
import { createAuthService, passwordMeetsPolicy } from './auth.service';

describe('auth service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('signs in, creates a session, and returns token plus expiry', async () => {
		const deps = createDeps({
			user: userFixture(),
			memberships: [membershipFixture({ tenantId: tenantId('tnt_a') })]
		});
		const service = createAuthService(deps);

		const result = await service.signIn({
			username: 'alice',
			password: 'correct',
			ip: '127.0.0.1',
			userAgent: 'vitest'
		});

		expect(result.sessionToken).toBe('raw-token');
		expect(result.sessionExpiresAt).toBe('2026-05-26T00:00:00.000Z');
		expect(result.activeTenantId).toBe('tnt_a');
		expect(deps.authRepository.createSession).toHaveBeenCalledWith({
			userId: 'usr_a',
			activeTenantId: 'tnt_a',
			now: new Date('2026-04-26T00:00:00.000Z'),
			ip: '127.0.0.1',
			userAgent: 'vitest'
		});
	});

	it('leaves multi-workspace signin sessions unbound while returning a suggested tenant', async () => {
		const deps = createDeps({
			user: userFixture({ lastActiveTenantId: tenantId('tnt_b') }),
			memberships: [
				membershipFixture({ tenantId: tenantId('tnt_a') }),
				membershipFixture({ tenantId: tenantId('tnt_b') })
			]
		});
		const service = createAuthService(deps);

		const result = await service.signIn({
			username: 'alice',
			password: 'correct',
			ip: null,
			userAgent: null
		});

		expect(result.activeTenantId).toBe('tnt_b');
		expect(deps.authRepository.createSession).toHaveBeenCalledWith(
			expect.objectContaining({ activeTenantId: null })
		);
	});

	it('rejects disabled users distinctly from bad credentials', async () => {
		const disabled = createAuthService(createDeps({ user: userFixture({ isActive: false }) }));
		const unknown = createAuthService(createDeps({ user: null }));
		const wrongPassword = createAuthService(createDeps({ passwordValid: false }));

		await expect(signIn(disabled)).rejects.toMatchObject({ status: 403, code: 'account_disabled' });
		await expect(signIn(unknown)).rejects.toMatchObject({
			status: 401,
			code: 'invalid_credentials'
		});
		await expect(signIn(wrongPassword)).rejects.toMatchObject({
			status: 401,
			code: 'invalid_credentials'
		});
	});

	it('returns current session state with memberships, preferences, active tenant, and expiry', async () => {
		const deps = createDeps({
			memberships: [membershipFixture({ tenantId: tenantId('tnt_a') })],
			preferences: prefsFixture({ language: 'zh' })
		});
		const service = createAuthService(deps);

		const result = await service.getCurrentSession({
			session: {
				user: toPublicUser(userFixture()),
				sessionTokenHash: 'hash',
				activeTenantId: tenantId('tnt_a'),
				role: null,
				sessionExpiresAt: '2026-05-26T00:00:00.000Z'
			}
		});

		expect(result).toEqual({
			user: toPublicUser(userFixture()),
			tenants: [membershipFixture({ tenantId: tenantId('tnt_a') })],
			preferences: prefsFixture({ language: 'zh' }),
			activeTenantId: tenantId('tnt_a'),
			sessionExpiresAt: '2026-05-26T00:00:00.000Z'
		});
	});

	it('signs out by deleting the current session', async () => {
		const deps = createDeps();
		const service = createAuthService(deps);

		await service.signOut({ sessionTokenHash: 'hash' });

		expect(deps.authRepository.deleteSession).toHaveBeenCalledWith('hash');
	});

	it('rejects missing tenants and forbidden non-member switches', async () => {
		const missingTenant = createAuthService(createDeps({ tenantExists: false }));
		const forbidden = createAuthService(createDeps({ membership: null }));

		await expect(
			missingTenant.switchTenant({ session: sessionFixture(), tenantId: tenantId('tnt_missing') })
		).rejects.toMatchObject({ status: 404, code: 'tenant_not_found' });
		await expect(
			forbidden.switchTenant({ session: sessionFixture(), tenantId: tenantId('tnt_b') })
		).rejects.toMatchObject({ status: 403, code: 'tenant_forbidden' });
	});

	it('allows admins into non-member tenants and writes an audit log', async () => {
		const deps = createDeps({ membership: null });
		const service = createAuthService(deps);

		const result = await service.switchTenant({
			session: sessionFixture({ user: toPublicUser(userFixture({ isAdmin: true })) }),
			tenantId: tenantId('tnt_b')
		});

		expect(result.activeTenantId).toBe('tnt_b');
		expect(deps.authRepository.setSessionActiveTenant).toHaveBeenCalledWith({
			sessionTokenHash: 'hash',
			tenantId: 'tnt_b'
		});
		expect(deps.auditRepository.insertAdminEnter).toHaveBeenCalledWith({
			actorId: 'usr_a',
			tenantId: 'tnt_b',
			now: new Date('2026-04-26T00:00:00.000Z')
		});
	});

	it('requires the current password, enforces policy, and revokes sibling sessions', async () => {
		const wrongCurrent = createAuthService(createDeps({ passwordValid: false }));
		const weakPassword = createAuthService(createDeps());
		const deps = createDeps();
		const service = createAuthService(deps);

		await expect(
			wrongCurrent.changePassword({
				session: sessionFixture(),
				currentPassword: 'wrong',
				newPassword: 'Stronger123!'
			})
		).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
		await expect(
			weakPassword.changePassword({
				session: sessionFixture(),
				currentPassword: 'correct',
				newPassword: 'longbutnoclasses'
			})
		).rejects.toMatchObject({ status: 422, code: 'weak_password' });

		await service.changePassword({
			session: sessionFixture(),
			currentPassword: 'correct',
			newPassword: 'Stronger123!'
		});

		expect(deps.usersRepository.updatePasswordHash).toHaveBeenCalledWith({
			userId: 'usr_a',
			passwordHash: 'new-hash',
			now: new Date('2026-04-26T00:00:00.000Z')
		});
		expect(deps.authRepository.deleteSiblingSessions).toHaveBeenCalledWith({
			userId: 'usr_a',
			currentSessionTokenHash: 'hash'
		});
	});

	it('codifies the locked password policy', () => {
		expect(passwordMeetsPolicy('lowercase123!')).toBe(true);
		expect(passwordMeetsPolicy('LOWERCASE123!')).toBe(true);
		expect(passwordMeetsPolicy('LongPassword!')).toBe(true);
		expect(passwordMeetsPolicy('Short1!')).toBe(false);
		expect(passwordMeetsPolicy('longbutnoclasses')).toBe(false);
	});
});

function signIn(service: ReturnType<typeof createAuthService>) {
	return service.signIn({ username: 'alice', password: 'correct', ip: null, userAgent: null });
}

type DepsOptions = {
	user?: UserPasswordRecord | null;
	memberships?: TenantMembershipDto[];
	membership?: TenantMembershipDto | null;
	preferences?: PreferencesDto;
	passwordValid?: boolean;
	tenantExists?: boolean;
};

function createDeps(options: DepsOptions = {}) {
	const user = options.user === undefined ? userFixture() : options.user;
	const memberships = options.memberships ?? [membershipFixture({ tenantId: tenantId('tnt_a') })];
	const membership = options.membership === undefined ? (memberships[0] ?? null) : options.membership;
	const preferences = options.preferences ?? prefsFixture();
	const passwordValid = options.passwordValid ?? true;

	return {
		authRepository: {
			createSession: vi.fn(async () => ({
				token: 'raw-token',
				tokenHash: 'hash',
				expiresAt: new Date('2026-05-26T00:00:00.000Z')
			})),
			deleteSession: vi.fn(async () => undefined),
			setSessionActiveTenant: vi.fn(async () => undefined),
			deleteSiblingSessions: vi.fn(async () => undefined)
		} satisfies AuthRepository,
		usersRepository: {
			findByUsername: vi.fn(async () => user),
			findById: vi.fn(async () => user),
			updateLastActiveTenant: vi.fn(async ({ tenantId }) =>
				toPublicUser(
					user
						? { ...user, lastActiveTenantId: tenantId }
						: userFixture({ lastActiveTenantId: tenantId })
				)
			),
			updatePasswordHash: vi.fn(async () => undefined)
		},
		tenantsRepository: {
			listActiveMembershipsForUser: vi.fn(async () => memberships),
			findActiveTenantById: vi.fn(async (): Promise<TenantDto | null> =>
				options.tenantExists === false ? null : tenantFixture({ id: tenantId('tnt_b') })
			),
			findActiveMembership: vi.fn(async () => membership)
		},
		prefsService: {
			getPreferences: vi.fn(async () => preferences),
			updatePreferences: vi.fn()
		},
		auditRepository: {
			insertAdminEnter: vi.fn(async () => undefined)
		},
		verifyPassword: vi.fn(async () => passwordValid),
		hashPassword: vi.fn(async () => 'new-hash'),
		now: () => new Date('2026-04-26T00:00:00.000Z')
	};
}

function sessionFixture(overrides: { user?: UserDto } = {}) {
	return {
		user: overrides.user ?? toPublicUser(userFixture()),
		sessionTokenHash: 'hash',
		activeTenantId: null,
		role: null,
		sessionExpiresAt: '2026-05-26T00:00:00.000Z'
	};
}

function userFixture(overrides: Partial<UserPasswordRecord> = {}): UserPasswordRecord {
	return {
		id: 'usr_a' as UserDto['id'],
		username: 'alice',
		isAdmin: false,
		isActive: true,
		lastActiveTenantId: null,
		createdAt: '2026-04-01T00:00:00.000Z' as UserDto['createdAt'],
		passwordHash: 'password-hash',
		deletedAt: null,
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

function tenantFixture(overrides: Partial<TenantDto> = {}): TenantDto {
	return {
		id: tenantId('tnt_a'),
		name: 'Tenant A',
		createdAt: iso('2026-04-01T00:00:00.000Z'),
		...overrides
	};
}

function tenantId(value: string): Id<'tenant'> {
	return value as Id<'tenant'>;
}

function iso(value: string): Iso8601 {
	return value as Iso8601;
}

function toPublicUser(user: UserPasswordRecord): UserDto {
	return {
		id: user.id,
		username: user.username,
		isAdmin: user.isAdmin,
		isActive: user.isActive,
		lastActiveTenantId: user.lastActiveTenantId,
		createdAt: user.createdAt
	};
}

function prefsFixture(overrides: Partial<PreferencesDto> = {}): PreferencesDto {
	return {
		language: 'en',
		theme: 'system',
		autoPlayNext: true,
		showMiniPlayer: true,
		preferSyncedLyrics: true,
		defaultLibrarySort: 'createdAt:desc',
		updatedAt: '2026-04-26T00:00:00.000Z' as PreferencesDto['updatedAt'],
		...overrides
	};
}
