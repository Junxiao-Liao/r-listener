import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AuditTargetType } from '../audit/audit.type';
import { auditLogs } from '../audit/audit.orm';
import { sessions } from '../auth/auth.orm';
import { hashPassword as defaultHashPassword } from '../auth/password';
import { passwordMeetsPolicy } from '../auth/auth.service';
import type { Db } from '../db';
import { apiError } from '../http/api-error';
import { playlistTracks, playlists } from '../playlists/playlists.orm';
import { createId } from '../shared/id';
import type { Id } from '../shared/shared.type';
import { toTenantDto, toTenantMembershipDto } from '../tenants/tenants.dto';
import { memberships, tenants } from '../tenants/tenants.orm';
import type { TenantDto, TenantMembershipDto } from '../tenants/tenants.type';
import { tracks } from '../tracks/tracks.orm';
import { toUserDto } from '../users/users.dto';
import { users } from '../users/users.orm';
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
		db: Db,
		input: {
			actor: AdminActor;
			action: string;
			targetType: AuditTargetType;
			targetId: string;
			tenantId: Id<'tenant'> | null;
			body: unknown;
		}
	) =>
		db.insert(auditLogs).values({
			id: createId('aud_'),
			actorId: input.actor.id,
			action: input.action,
			targetType: input.targetType,
			targetId: input.targetId,
			tenantId: input.tenantId,
			meta: { request: redactSecrets(input.body) },
			createdAt: now()
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

			const n = now();
			const userId = createId('usr_') as Id<'user'>;
			const passwordHash = await hashPassword(body.password);
			const db = deps.adminRepository.db;

			const userQ = db.insert(users).values({
				id: userId,
				username: body.username,
				passwordHash,
				isAdmin: body.isAdmin,
				isActive: true,
				lastActiveTenantId: null,
				createdAt: n,
				updatedAt: n
			}).returning();
			const auditQ = audit(db, {
				actor,
				action: 'user.create',
				targetType: 'user',
				targetId: userId,
				tenantId: body.initialMembership?.tenantId ?? null,
				body
			});

			if (body.initialMembership) {
				const results = await deps.adminRepository.batch([
					userQ,
					db.insert(memberships).values({
						id: createId('mem_') as Id<'membership'>,
						tenantId: body.initialMembership.tenantId,
						userId,
						role: body.initialMembership.role,
						createdAt: n,
						updatedAt: n
					}),
					auditQ
				] as const);
				return toUserDto((results[0] as unknown as Record<string, unknown>[])[0] as typeof users.$inferSelect);
			}

			const results = await deps.adminRepository.batch([
				userQ,
				auditQ
			] as const);
			return toUserDto((results[0] as unknown as Record<string, unknown>[])[0] as typeof users.$inferSelect);
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
			const db = deps.adminRepository.db;
			const n = now();
			const results = await deps.adminRepository.batch([
				db.update(users)
					.set({ ...body, updatedAt: n })
					.where(and(eq(users.id, userId), isNull(users.deletedAt)))
					.returning(),
				audit(db, {
					actor,
					action: 'user.update',
					targetType: 'user',
					targetId: userId,
					tenantId: null,
					body
				})
			] as const);
			const userRows = results[0] as unknown as (typeof users.$inferSelect)[];
			if (!userRows[0]) throw apiError(404, 'user_not_found', 'User not found.');
			return toUserDto(userRows[0]);
		},
		resetPassword: async ({ actor, userId, body }) => {
			await requireUser(deps.adminRepository, userId);
			if (!passwordMeetsPolicy(body.newPassword)) throw weakPassword();
			const db = deps.adminRepository.db;
			const n = now();
			const passwordHash = await hashPassword(body.newPassword);
			const results = await deps.adminRepository.batch([
				db.update(users)
					.set({ passwordHash, updatedAt: n })
					.where(and(eq(users.id, userId), isNull(users.deletedAt)))
					.returning(),
				db.delete(sessions).where(eq(sessions.userId, userId)),
				audit(db, {
					actor,
					action: 'user.reset_password',
					targetType: 'user',
					targetId: userId,
					tenantId: null,
					body
				})
			] as const);
			const userRows = results[0] as unknown as (typeof users.$inferSelect)[];
			if (userRows.length === 0) throw apiError(404, 'user_not_found', 'User not found.');
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
			const db = deps.adminRepository.db;
			const n = now();
			const results = await deps.adminRepository.batch([
				db.update(users)
					.set({ isActive: false, deletedAt: n, updatedAt: n })
					.where(and(eq(users.id, userId), isNull(users.deletedAt)))
					.returning(),
				db.update(memberships)
					.set({ deletedAt: n, updatedAt: n })
					.where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt))),
				db.delete(sessions).where(eq(sessions.userId, userId)),
				audit(db, {
					actor,
					action: 'user.delete',
					targetType: 'user',
					targetId: userId,
					tenantId: null,
					body: {}
				})
			] as const);
			const userRows = results[0] as unknown as (typeof users.$inferSelect)[];
			if (userRows.length === 0) throw apiError(404, 'user_not_found', 'User not found.');
		},
		listTenants: (query) => deps.adminRepository.listTenants(query),
		getTenant: async (tenantId) => requireTenant(deps.adminRepository, tenantId),
		createTenant: async ({ actor, body }) => {
			await requireUser(deps.adminRepository, body.ownerUserId);
			const db = deps.adminRepository.db;
			const n = now();
			const tenantId = createId('tnt_') as Id<'tenant'>;
			const results = await deps.adminRepository.batch([
				db.insert(tenants).values({ id: tenantId, name: body.name, createdAt: n, updatedAt: n }).returning(),
				db.insert(memberships).values({
					id: createId('mem_') as Id<'membership'>,
					tenantId,
					userId: body.ownerUserId,
					role: 'owner',
					createdAt: n,
					updatedAt: n
				}).returning(),
				audit(db, {
					actor,
					action: 'tenant.create',
					targetType: 'tenant',
					targetId: tenantId,
					tenantId,
					body
				})
			] as const);
			const tenantRow = (results[0] as unknown as (typeof tenants.$inferSelect)[])[0]!;
			const membershipRow = (results[1] as unknown as (typeof memberships.$inferSelect)[])[0]!;
			return { tenant: toTenantDto(tenantRow), ownership: toTenantMembershipDto(membershipRow, tenantRow) };
		},
		updateTenant: async ({ actor, tenantId, body }) => {
			await requireTenant(deps.adminRepository, tenantId);
			const db = deps.adminRepository.db;
			const n = now();
			const results = await deps.adminRepository.batch([
				db.update(tenants)
					.set({ name: body.name, updatedAt: n })
					.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
					.returning(),
				audit(db, {
					actor,
					action: 'tenant.update',
					targetType: 'tenant',
					targetId: tenantId,
					tenantId,
					body
				})
			] as const);
			const tenantRows = results[0] as unknown as (typeof tenants.$inferSelect)[];
			if (!tenantRows[0]) throw apiError(404, 'tenant_not_found', 'Tenant not found.');
			return toTenantDto(tenantRows[0]);
		},
		deleteTenant: async ({ actor, tenantId }) => {
			await requireTenant(deps.adminRepository, tenantId);
			const db = deps.adminRepository.db;
			const n = now();

			const playlistRows = await db
				.select({ id: playlists.id })
				.from(playlists)
				.where(and(eq(playlists.tenantId, tenantId), isNull(playlists.deletedAt)));
			const playlistIds = playlistRows.map((p) => p.id);

			const tenantQ = db.update(tenants)
				.set({ deletedAt: n, updatedAt: n })
				.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
				.returning();
			const membershipsQ = db.update(memberships)
				.set({ deletedAt: n, updatedAt: n })
				.where(and(eq(memberships.tenantId, tenantId), isNull(memberships.deletedAt)));
			const tracksQ = db.update(tracks)
				.set({ deletedAt: n, updatedAt: n })
				.where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)));
			const playlistsQ = db.update(playlists)
				.set({ deletedAt: n, updatedAt: n })
				.where(and(eq(playlists.tenantId, tenantId), isNull(playlists.deletedAt)));
			const sessionsQ = db.update(sessions)
				.set({ activeTenantId: null })
				.where(eq(sessions.activeTenantId, tenantId));
			const auditQ = audit(db, {
				actor,
				action: 'tenant.delete',
				targetType: 'tenant',
				targetId: tenantId,
				tenantId,
				body: {}
			});

			if (playlistIds.length > 0) {
				const results = await deps.adminRepository.batch([
					tenantQ,
					membershipsQ,
					tracksQ,
					db.update(playlistTracks)
						.set({ deletedAt: n })
						.where(and(inArray(playlistTracks.playlistId, playlistIds), isNull(playlistTracks.deletedAt))),
					playlistsQ,
					sessionsQ,
					auditQ
				] as const);
				const tenantRows = results[0] as unknown as (typeof tenants.$inferSelect)[];
				if (tenantRows.length === 0) throw apiError(404, 'tenant_not_found', 'Tenant not found.');
			} else {
				const results = await deps.adminRepository.batch([
					tenantQ,
					membershipsQ,
					tracksQ,
					playlistsQ,
					sessionsQ,
					auditQ
				] as const);
				const tenantRows = results[0] as unknown as (typeof tenants.$inferSelect)[];
				if (tenantRows.length === 0) throw apiError(404, 'tenant_not_found', 'Tenant not found.');
			}
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
			const db = deps.adminRepository.db;
			const n = now();
			const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
			const results = await deps.adminRepository.batch([
				db.insert(memberships).values({
					id: createId('mem_') as Id<'membership'>,
					tenantId,
					userId: body.userId,
					role: body.role,
					createdAt: n,
					updatedAt: n
				}).returning(),
				audit(db, {
					actor,
					action: 'membership.create',
					targetType: 'membership',
					targetId: `${tenantId}:${body.userId}`,
					tenantId,
					body
				})
			] as const);
			return toTenantMembershipDto(
				(results[0] as unknown as (typeof memberships.$inferSelect)[])[0]!,
				tenantRows[0]!
			);
		},
		updateMembership: async ({ actor, tenantId, userId, body }) => {
			const existing = await requireMembership(deps.adminRepository, tenantId, userId);
			if (existing.role === 'owner' && body.role !== 'owner') {
				await assertNotLastOwner(deps.adminRepository, tenantId);
			}
			const db = deps.adminRepository.db;
			const n = now();
			const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
			const results = await deps.adminRepository.batch([
				db.update(memberships)
					.set({ role: body.role, updatedAt: n })
					.where(
						and(
							eq(memberships.tenantId, tenantId),
							eq(memberships.userId, userId),
							isNull(memberships.deletedAt)
						)
					)
					.returning(),
				audit(db, {
					actor,
					action: 'membership.update',
					targetType: 'membership',
					targetId: `${tenantId}:${userId}`,
					tenantId,
					body
				})
			] as const);
			const membershipRows = results[0] as unknown as (typeof memberships.$inferSelect)[];
			if (!membershipRows[0]) throw apiError(404, 'tenant_not_found', 'Membership not found.');
			return toTenantMembershipDto(membershipRows[0], tenantRows[0]!);
		},
		deleteMembership: async ({ actor, tenantId, userId }) => {
			const existing = await requireMembership(deps.adminRepository, tenantId, userId);
			if (existing.role === 'owner') {
				await assertNotLastOwner(deps.adminRepository, tenantId);
			}
			const db = deps.adminRepository.db;
			const n = now();
			const results = await deps.adminRepository.batch([
				db.update(memberships)
					.set({ deletedAt: n, updatedAt: n })
					.where(
						and(
							eq(memberships.tenantId, tenantId),
							eq(memberships.userId, userId),
							isNull(memberships.deletedAt)
						)
					)
					.returning(),
				db.update(sessions)
					.set({ activeTenantId: null })
					.where(and(eq(sessions.activeTenantId, tenantId), eq(sessions.userId, userId))),
				audit(db, {
					actor,
					action: 'membership.delete',
					targetType: 'membership',
					targetId: `${tenantId}:${userId}`,
					tenantId,
					body: {}
				})
			] as const);
			const membershipRows = results[0] as unknown as (typeof memberships.$inferSelect)[];
			if (membershipRows.length === 0) throw apiError(404, 'tenant_not_found', 'Membership not found.');
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
