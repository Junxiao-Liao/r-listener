import type { AuthRepository } from './auth.repository';
import { createAuthRepository } from './auth.repository';
import type { Db } from '../db';
import { apiError } from '../http/api-error';
import type { AuditRepository } from '../audit/audit.repository';
import { createAuditRepository } from '../audit/audit.repository';
import type { PrefsService } from '../prefs/prefs.service';
import { createPrefsService } from '../prefs/prefs.service';
import { createPrefsRepository } from '../prefs/prefs.repository';
import type { TenantsRepository } from '../tenants/tenants.repository';
import { createTenantsRepository } from '../tenants/tenants.repository';
import type { UsersRepository } from '../users/users.repository';
import { createUsersRepository } from '../users/users.repository';
import type { UserDto } from '../users/users.type';
import type { Id } from '../shared/shared.type';
import { toIso8601 } from '../shared/time';
import { hashPassword as defaultHashPassword, verifyPassword as defaultVerifyPassword } from './password';
import type {
	ChangePasswordInput,
	CurrentSessionDto,
	CurrentSessionInput,
	SigninInput,
	SigninResult,
	SwitchTenantInput,
	SwitchTenantResult
} from './auth.type';

export type AuthService = {
	signIn(input: SigninInput): Promise<SigninResult>;
	getCurrentSession(input: CurrentSessionInput): Promise<CurrentSessionDto>;
	signOut(input: { sessionTokenHash: string }): Promise<void>;
	switchTenant(input: SwitchTenantInput): Promise<SwitchTenantResult>;
	changePassword(input: ChangePasswordInput): Promise<void>;
};

export type AuthServiceDependencies = {
	authRepository: AuthRepository;
	usersRepository: UsersRepository;
	tenantsRepository: TenantsRepository;
	prefsService: PrefsService;
	auditRepository: AuditRepository;
	verifyPassword?: (password: string, hash: string) => Promise<boolean>;
	hashPassword?: (password: string) => Promise<string>;
	now?: () => Date;
};

export function createAuthService(deps: AuthServiceDependencies): AuthService {
	const verifyPassword = deps.verifyPassword ?? defaultVerifyPassword;
	const hashPassword = deps.hashPassword ?? defaultHashPassword;
	const now = deps.now ?? (() => new Date());

	return {
		signIn: async (input) => {
			const user = await deps.usersRepository.findByUsername(input.username);
			if (!user) {
				throw invalidCredentials();
			}
			if (!user.isActive) {
				throw apiError(403, 'account_disabled', 'Account is disabled.');
			}
			if (!(await verifyPassword(input.password, user.passwordHash))) {
				throw invalidCredentials();
			}

			const tenants = await deps.tenantsRepository.listActiveMembershipsForUser(user.id);
			const suggestedTenantId = selectSuggestedTenant(user.lastActiveTenantId, tenants);
			const boundTenantId = tenants.length === 1 ? tenants[0]!.tenantId : null;
			const session = await deps.authRepository.createSession({
				userId: user.id,
				activeTenantId: boundTenantId,
				now: now(),
				ip: input.ip,
				userAgent: input.userAgent
			});
			const preferences = await deps.prefsService.getPreferences(user.id);

			return {
				user: toPublicUser(user),
				tenants,
				preferences,
				activeTenantId: suggestedTenantId,
				sessionToken: session.token,
				sessionExpiresAt: toIso8601(session.expiresAt)
			};
		},
		getCurrentSession: async ({ session }) => ({
			user: toPublicUser(session.user),
			tenants: await deps.tenantsRepository.listActiveMembershipsForUser(session.user.id),
			preferences: await deps.prefsService.getPreferences(session.user.id),
			activeTenantId: session.activeTenantId,
			sessionExpiresAt: session.sessionExpiresAt as CurrentSessionDto['sessionExpiresAt']
		}),
		signOut: async ({ sessionTokenHash }) => {
			await deps.authRepository.deleteSession(sessionTokenHash);
		},
		switchTenant: async ({ session, tenantId }) => {
			const tenant = await deps.tenantsRepository.findActiveTenantById(tenantId);
			if (!tenant) {
				throw apiError(404, 'tenant_not_found', 'Tenant not found.');
			}

			const membership = await deps.tenantsRepository.findActiveMembership({
				userId: session.user.id,
				tenantId
			});
			if (!membership && !session.user.isAdmin) {
				throw apiError(403, 'tenant_forbidden', 'You do not have access to this tenant.');
			}

			const user = await deps.usersRepository.updateLastActiveTenant({
				userId: session.user.id,
				tenantId,
				now: now()
			});
			await deps.authRepository.setSessionActiveTenant({
				sessionTokenHash: session.sessionTokenHash,
				tenantId
			});
			if (!membership && session.user.isAdmin) {
				await deps.auditRepository.insertAdminEnter({
					actorId: session.user.id,
					tenantId,
					now: now()
				});
			}

			return { user, activeTenantId: tenantId };
		},
		changePassword: async ({ session, currentPassword, newPassword }) => {
			const user = await deps.usersRepository.findById(session.user.id);
			if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
				throw invalidCredentials();
			}
			if (!passwordMeetsPolicy(newPassword)) {
				throw apiError(
					422,
					'weak_password',
					'Password must be at least 12 characters and include at least 3 of lowercase, uppercase, digit, symbol.'
				);
			}

			await deps.usersRepository.updatePasswordHash({
				userId: session.user.id,
				passwordHash: await hashPassword(newPassword),
				now: now()
			});
			await deps.authRepository.deleteSiblingSessions({
				userId: session.user.id,
				currentSessionTokenHash: session.sessionTokenHash
			});
		}
	};
}

export function createAuthServiceForDb(db: Db, kv: KVNamespace): AuthService {
	return createAuthService({
		authRepository: createAuthRepository(kv),
		usersRepository: createUsersRepository(db),
		tenantsRepository: createTenantsRepository(db),
		prefsService: createPrefsService(createPrefsRepository(db, kv)),
		auditRepository: createAuditRepository(db)
	});
}

export function passwordMeetsPolicy(password: string): boolean {
	const classes = [
		/[a-z]/.test(password),
		/[A-Z]/.test(password),
		/[0-9]/.test(password),
		/[^A-Za-z0-9]/.test(password)
	].filter(Boolean).length;
	return password.length >= 12 && classes >= 3;
}

function selectSuggestedTenant(
	lastActiveTenantId: Id<'tenant'> | null,
	tenants: { tenantId: Id<'tenant'> }[]
): Id<'tenant'> | null {
	if (lastActiveTenantId && tenants.some((tenant) => tenant.tenantId === lastActiveTenantId)) {
		return lastActiveTenantId;
	}
	return tenants[0]?.tenantId ?? null;
}

function invalidCredentials() {
	return apiError(401, 'invalid_credentials', 'Username or password is wrong.');
}

function toPublicUser(user: UserDto): UserDto {
	return {
		id: user.id,
		username: user.username,
		isAdmin: user.isAdmin,
		isActive: user.isActive,
		lastActiveTenantId: user.lastActiveTenantId,
		createdAt: user.createdAt
	};
}
