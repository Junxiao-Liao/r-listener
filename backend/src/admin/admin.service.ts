import type { AuditTargetType } from '../audit/audit.type';
import { hashPassword as defaultHashPassword } from '../auth/password';
import { passwordMeetsPolicy } from '../auth/auth.service';
import type { Db } from '../db';
import { apiError } from '../http/api-error';
import type { Id } from '../shared/shared.type';
import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';
import { createAdminRepository, type AdminRepository } from './admin.repository';
import type {
	AdminCreateMembershipInput,
	AdminCreateTenantInput,
	AdminCreateUserInput,
	AdminListQuery,
	AdminListResponse,
	AdminResetPasswordInput,
	AdminTenantListItemDto,
	AdminTenantMemberDto,
	AdminUpdateMembershipInput,
	AdminUpdateTenantInput,
	AdminUpdateUserInput,
	AdminUserDetailDto,
	AdminUserListItemDto,
	AdminUserListQuery
} from './admin.type';

export type AdminActor = {
	id: Id<'user'>;
};

export type AdminService = {
	readonly adminRepository: AdminRepository;
	listUsers(query: AdminUserListQuery): Promise<AdminListResponse<AdminUserListItemDto>>;
	getUser(userId: Id<'user'>): Promise<AdminUserDetailDto>;
	createUser(input: { actor: AdminActor; body: AdminCreateUserInput }): Promise<UserDto>;
	updateUser(input: {
		actor: AdminActor;
		userId: Id<'user'>;
		body: AdminUpdateUserInput;
	}): Promise<UserDto>;
	resetPassword(input: {
		actor: AdminActor;
		userId: Id<'user'>;
		body: AdminResetPasswordInput;
	}): Promise<void>;
	deleteUser(input: { actor: AdminActor; userId: Id<'user'> }): Promise<void>;
	listTenants(query: AdminListQuery): Promise<AdminListResponse<AdminTenantListItemDto>>;
	getTenant(tenantId: Id<'tenant'>): Promise<TenantDto>;
	createTenant(input: {
		actor: AdminActor;
		body: AdminCreateTenantInput;
	}): Promise<{ tenant: TenantDto; ownership: TenantMembershipDto }>;
	updateTenant(input: {
		actor: AdminActor;
		tenantId: Id<'tenant'>;
		body: AdminUpdateTenantInput;
	}): Promise<TenantDto>;
	deleteTenant(input: { actor: AdminActor; tenantId: Id<'tenant'> }): Promise<void>;
	listTenantMembers(input: {
		tenantId: Id<'tenant'>;
		limit: number;
		cursor?: string | undefined;
	}): Promise<AdminListResponse<AdminTenantMemberDto>>;
	createMembership(input: {
		actor: AdminActor;
		tenantId: Id<'tenant'>;
		body: AdminCreateMembershipInput;
	}): Promise<TenantMembershipDto>;
	updateMembership(input: {
		actor: AdminActor;
		tenantId: Id<'tenant'>;
		userId: Id<'user'>;
		body: AdminUpdateMembershipInput;
	}): Promise<TenantMembershipDto>;
	deleteMembership(input: {
		actor: AdminActor;
		tenantId: Id<'tenant'>;
		userId: Id<'user'>;
	}): Promise<void>;
};

export type AdminServiceDependencies = {
	adminRepository: AdminRepository;
	hashPassword?: (password: string) => Promise<string>;
	now?: () => Date;
};

export function createAdminService(deps: AdminServiceDependencies): AdminService {
	const hashPassword = deps.hashPassword ?? defaultHashPassword;
	const now = deps.now ?? (() => new Date());

	const audit = (
		repository: AdminRepository,
		input: {
			actor: AdminActor;
			action: string;
			targetType: AuditTargetType;
			targetId: string;
			tenantId: Id<'tenant'> | null;
			body: unknown;
		}
	) =>
		repository.insertAudit({
			actorId: input.actor.id,
			action: input.action,
			targetType: input.targetType,
			targetId: input.targetId,
			tenantId: input.tenantId,
			meta: { request: redactSecrets(input.body) },
			now: now()
		});

	return {
		adminRepository: deps.adminRepository,
		listUsers: (query) => deps.adminRepository.listUsers(query),
		getUser: async (userId) => {
			const user = await deps.adminRepository.getUserDetail(userId);
			if (!user) throw apiError(404, 'user_not_found', 'User not found.');
			return user;
		},
		createUser: async ({ actor, body }) => {
			if (!passwordMeetsPolicy(body.password)) {
				throw weakPassword();
			}
			if (await deps.adminRepository.findUserByUsername(body.username)) {
				throw apiError(409, 'username_conflict', 'Username is already in use.');
			}
			if (body.initialMembership) {
				await requireTenant(deps.adminRepository, body.initialMembership.tenantId);
			}

			return deps.adminRepository.withTransaction(async (repository) => {
				const created = await repository.createUser({
					username: body.username,
					passwordHash: await hashPassword(body.password),
					isAdmin: body.isAdmin,
					now: now()
				});
				if (body.initialMembership) {
					await repository.createMembership({
						tenantId: body.initialMembership.tenantId,
						userId: created.id,
						role: body.initialMembership.role,
						now: now()
					});
				}
				await audit(repository, {
					actor,
					action: 'user.create',
					targetType: 'user',
					targetId: created.id,
					tenantId: body.initialMembership?.tenantId ?? null,
					body
				});
				return created;
			});
		},
		updateUser: async ({ actor, userId, body }) => {
			await requireUser(deps.adminRepository, userId);
			if (actor.id === userId && (body.isAdmin === false || body.isActive === false)) {
				throw apiError(422, 'cannot_self_downgrade', 'You cannot demote or deactivate yourself.');
			}
			if (body.username) {
				const existing = await deps.adminRepository.findUserByUsername(body.username);
				if (existing && existing.id !== userId) {
					throw apiError(409, 'username_conflict', 'Username is already in use.');
				}
			}
			return deps.adminRepository.withTransaction(async (repository) => {
				const user = await repository.updateUser({ userId, patch: body, now: now() });
				if (!user) throw apiError(404, 'user_not_found', 'User not found.');
				await audit(repository, {
					actor,
					action: 'user.update',
					targetType: 'user',
					targetId: userId,
					tenantId: null,
					body
				});
				return user;
			});
		},
		resetPassword: async ({ actor, userId, body }) => {
			await requireUser(deps.adminRepository, userId);
			if (!passwordMeetsPolicy(body.newPassword)) throw weakPassword();
			await deps.adminRepository.withTransaction(async (repository) => {
				const updated = await repository.resetUserPassword({
					userId,
					passwordHash: await hashPassword(body.newPassword),
					now: now()
				});
				if (!updated) throw apiError(404, 'user_not_found', 'User not found.');
				await repository.revokeUserSessions(userId);
				await audit(repository, {
					actor,
					action: 'user.reset_password',
					targetType: 'user',
					targetId: userId,
					tenantId: null,
					body
				});
			});
		},
		deleteUser: async ({ actor, userId }) => {
			if (actor.id === userId) {
				throw apiError(422, 'cannot_self_delete', 'You cannot delete yourself.');
			}
			const detail = await deps.adminRepository.getUserDetail(userId);
			if (!detail) throw apiError(404, 'user_not_found', 'User not found.');
			for (const membership of detail.memberships) {
				if (membership.role === 'owner') {
					await assertNotLastOwner(deps.adminRepository, membership.tenantId);
				}
			}
			await deps.adminRepository.withTransaction(async (repository) => {
				const deleted = await repository.deleteUser({ userId, now: now() });
				if (!deleted) throw apiError(404, 'user_not_found', 'User not found.');
				await audit(repository, {
					actor,
					action: 'user.delete',
					targetType: 'user',
					targetId: userId,
					tenantId: null,
					body: {}
				});
			});
		},
		listTenants: (query) => deps.adminRepository.listTenants(query),
		getTenant: async (tenantId) => requireTenant(deps.adminRepository, tenantId),
		createTenant: async ({ actor, body }) => {
			await requireUser(deps.adminRepository, body.ownerUserId);
			return deps.adminRepository.withTransaction(async (repository) => {
				const tenant = await repository.createTenant({ name: body.name, now: now() });
				const ownership = await repository.createMembership({
					tenantId: tenant.id,
					userId: body.ownerUserId,
					role: 'owner',
					now: now()
				});
				await audit(repository, {
					actor,
					action: 'tenant.create',
					targetType: 'tenant',
					targetId: tenant.id,
					tenantId: tenant.id,
					body
				});
				return { tenant, ownership };
			});
		},
		updateTenant: async ({ actor, tenantId, body }) => {
			await requireTenant(deps.adminRepository, tenantId);
			return deps.adminRepository.withTransaction(async (repository) => {
				const tenant = await repository.updateTenant({ tenantId, name: body.name, now: now() });
				if (!tenant) throw apiError(404, 'tenant_not_found', 'Tenant not found.');
				await audit(repository, {
					actor,
					action: 'tenant.update',
					targetType: 'tenant',
					targetId: tenantId,
					tenantId,
					body
				});
				return tenant;
			});
		},
		deleteTenant: async ({ actor, tenantId }) => {
			await requireTenant(deps.adminRepository, tenantId);
			await deps.adminRepository.withTransaction(async (repository) => {
				const deleted = await repository.deleteTenant({ tenantId, now: now() });
				if (!deleted) throw apiError(404, 'tenant_not_found', 'Tenant not found.');
				await audit(repository, {
					actor,
					action: 'tenant.delete',
					targetType: 'tenant',
					targetId: tenantId,
					tenantId,
					body: {}
				});
			});
		},
		listTenantMembers: async (input) => {
			await requireTenant(deps.adminRepository, input.tenantId);
			return deps.adminRepository.listTenantMembers(input);
		},
		createMembership: async ({ actor, tenantId, body }) => {
			await requireTenant(deps.adminRepository, tenantId);
			await requireUser(deps.adminRepository, body.userId);
			if (await deps.adminRepository.findActiveMembership({ tenantId, userId: body.userId })) {
				throw apiError(409, 'already_member', 'User is already a member.');
			}
			return deps.adminRepository.withTransaction(async (repository) => {
				const membership = await repository.createMembership({
					tenantId,
					userId: body.userId,
					role: body.role,
					now: now()
				});
				await audit(repository, {
					actor,
					action: 'membership.create',
					targetType: 'membership',
					targetId: `${tenantId}:${body.userId}`,
					tenantId,
					body
				});
				return membership;
			});
		},
		updateMembership: async ({ actor, tenantId, userId, body }) => {
			const existing = await requireMembership(deps.adminRepository, tenantId, userId);
			if (existing.role === 'owner' && body.role !== 'owner') {
				await assertNotLastOwner(deps.adminRepository, tenantId);
			}
			return deps.adminRepository.withTransaction(async (repository) => {
				const membership = await repository.updateMembership({
					tenantId,
					userId,
					role: body.role,
					now: now()
				});
				if (!membership) throw apiError(404, 'tenant_not_found', 'Membership not found.');
				await audit(repository, {
					actor,
					action: 'membership.update',
					targetType: 'membership',
					targetId: `${tenantId}:${userId}`,
					tenantId,
					body
				});
				return membership;
			});
		},
		deleteMembership: async ({ actor, tenantId, userId }) => {
			const existing = await requireMembership(deps.adminRepository, tenantId, userId);
			if (existing.role === 'owner') {
				await assertNotLastOwner(deps.adminRepository, tenantId);
			}
			await deps.adminRepository.withTransaction(async (repository) => {
				const deleted = await repository.deleteMembership({ tenantId, userId, now: now() });
				if (!deleted) throw apiError(404, 'tenant_not_found', 'Membership not found.');
				await audit(repository, {
					actor,
					action: 'membership.delete',
					targetType: 'membership',
					targetId: `${tenantId}:${userId}`,
					tenantId,
					body: {}
				});
			});
		}
	};
}

export function createAdminServiceForDb(db: Db): AdminService {
	return createAdminService({ adminRepository: createAdminRepository(db) });
}

export function redactSecrets(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactSecrets);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, child]) => [
			key,
			key.toLowerCase().includes('password') || key.toLowerCase().includes('token')
				? '[REDACTED]'
				: redactSecrets(child)
		])
	);
}

async function requireUser(repository: AdminRepository, userId: Id<'user'>): Promise<UserDto> {
	const user = await repository.findUserById(userId);
	if (!user) throw apiError(404, 'user_not_found', 'User not found.');
	return user;
}

async function requireTenant(repository: AdminRepository, tenantId: Id<'tenant'>): Promise<TenantDto> {
	const tenant = await repository.findTenantById(tenantId);
	if (!tenant) throw apiError(404, 'tenant_not_found', 'Tenant not found.');
	return tenant;
}

async function requireMembership(
	repository: AdminRepository,
	tenantId: Id<'tenant'>,
	userId: Id<'user'>
): Promise<TenantMembershipDto> {
	await requireTenant(repository, tenantId);
	await requireUser(repository, userId);
	const membership = await repository.findActiveMembership({ tenantId, userId });
	if (!membership) throw apiError(404, 'tenant_not_found', 'Membership not found.');
	return membership;
}

async function assertNotLastOwner(repository: AdminRepository, tenantId: Id<'tenant'>): Promise<void> {
	if ((await repository.countTenantOwners(tenantId)) <= 1) {
		throw apiError(
			422,
			'cannot_remove_last_owner',
			'Cannot remove or demote the last tenant owner.'
		);
	}
}

function weakPassword() {
	return apiError(
		422,
		'weak_password',
		'Password must be at least 12 characters and include at least 3 of lowercase, uppercase, digit, symbol.'
	);
}
