import {
	and,
	asc,
	eq,
	inArray,
	isNull,
	like,
	notExists,
	sql
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AuditTargetType } from '../audit/audit.type';
import { auditLogs } from '../audit/audit.orm';
import type { Db } from '../db';
import { cacheKey, cachePrefix, createKvCache, KV_TTL } from '../lib/kv-cache';
import { deleteSiblingSessionsInKv } from '../lib/session-kv';
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
import type {
	AdminListQuery,
	AdminListResponse,
	AdminTenantListItemDto,
	AdminTenantMemberDto,
	AdminUserListItemDto,
	AdminUserListQuery
} from './admin.type';

export type AdminRepository = {
	readonly db: Db;
	batch: Db['batch'];
	listUsers(query: AdminUserListQuery): Promise<AdminListResponse<AdminUserListItemDto>>;
	findUserById(userId: Id<'user'>): Promise<UserDto | null>;
	findUserByUsername(username: string): Promise<UserDto | null>;
	getUserDetail(userId: Id<'user'>): Promise<(UserDto & { memberships: TenantMembershipDto[] }) | null>;
	createUser(input: {
		username: string;
		passwordHash: string;
		isAdmin: boolean;
		now: Date;
	}): Promise<UserDto>;
	updateUser(input: {
		userId: Id<'user'>;
		patch: { username?: string; isAdmin?: boolean; isActive?: boolean };
		now: Date;
	}): Promise<UserDto | null>;
	resetUserPassword(input: { userId: Id<'user'>; passwordHash: string; now: Date }): Promise<boolean>;
	revokeUserSessions(userId: Id<'user'>): Promise<void>;
	deleteUser(input: { userId: Id<'user'>; now: Date }): Promise<boolean>;
	listTenants(query: AdminListQuery): Promise<AdminListResponse<AdminTenantListItemDto>>;
	findTenantById(tenantId: Id<'tenant'>): Promise<TenantDto | null>;
	createTenant(input: { name: string; now: Date }): Promise<TenantDto>;
	updateTenant(input: { tenantId: Id<'tenant'>; name: string; now: Date }): Promise<TenantDto | null>;
	deleteTenant(input: { tenantId: Id<'tenant'>; now: Date }): Promise<boolean>;
	listTenantMembers(input: {
		tenantId: Id<'tenant'>;
		limit: number;
		cursor?: string | undefined;
	}): Promise<AdminListResponse<AdminTenantMemberDto>>;
	findActiveMembership(input: {
		tenantId: Id<'tenant'>;
		userId: Id<'user'>;
	}): Promise<TenantMembershipDto | null>;
	createMembership(input: {
		tenantId: Id<'tenant'>;
		userId: Id<'user'>;
		role: TenantMembershipDto['role'];
		now: Date;
	}): Promise<TenantMembershipDto>;
	updateMembership(input: {
		tenantId: Id<'tenant'>;
		userId: Id<'user'>;
		role: TenantMembershipDto['role'];
		now: Date;
	}): Promise<TenantMembershipDto | null>;
	deleteMembership(input: {
		tenantId: Id<'tenant'>;
		userId: Id<'user'>;
		now: Date;
	}): Promise<boolean>;
	countTenantOwners(tenantId: Id<'tenant'>): Promise<number>;
	clearActiveTenantSessions(input: { tenantId: Id<'tenant'>; userId?: Id<'user'> | undefined }): Promise<void>;
	insertAudit(input: {
		actorId: Id<'user'>;
		action: string;
		targetType: AuditTargetType;
		targetId: string;
		tenantId: Id<'tenant'> | null;
		meta: Record<string, unknown>;
		now: Date;
	}): Promise<void>;
};

export function createAdminRepository(db: Db, kv: KVNamespace): AdminRepository {
	const cache = createKvCache(kv, { defaultTtlSeconds: KV_TTL.authz });

	async function invalidateUsers(): Promise<void> {
		await cache.invalidatePrefix('cache:admin:users:');
		await cache.invalidatePrefix('cache:user:');
		await cache.invalidatePrefix('prefs:');
		await cache.invalidatePrefix('cache:session:user:');
		await cache.invalidatePrefix('cache:authz:');
	}

	async function invalidateTenants(tenantId?: Id<'tenant'>): Promise<void> {
		await cache.invalidatePrefix('cache:admin:tenants:');
		await cache.invalidatePrefix('cache:admin:tenant-owner-count:');
		await cache.invalidatePrefix('cache:tenant:');
		await cache.invalidatePrefix('cache:authz:');
		if (tenantId) {
			await cache.invalidatePrefix(cachePrefix('cache:tracks:list', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:artists:list', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playlist', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playlists:list', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:queue:items', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:queue:track', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playback:recent', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playback:continue', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:playback:visible-tracks', tenantId));
			await cache.invalidatePrefix(cachePrefix('cache:search', tenantId));
		}
	}

	const revokeUserSessionsKv = async (userId: Id<'user'>) => {
		const list = await kv.list({ prefix: 'session:' });
		for (const key of list.keys) {
			const raw = await kv.get(key.name, 'json');
			if (!raw) continue;
			const data = raw as { userId: string };
			if (data.userId === userId) {
				await kv.delete(key.name);
			}
		}
	};

	const clearActiveTenantSessionsKv = async (input: { tenantId: Id<'tenant'>; userId?: Id<'user'> | undefined }) => {
		const list = await kv.list({ prefix: 'session:' });
		for (const key of list.keys) {
			const raw = await kv.get(key.name, 'json');
			if (!raw) continue;
			const data = raw as { activeTenantId: string | null; userId: string; expiresAt: number };
			if (data.activeTenantId !== input.tenantId) continue;
			if (input.userId && data.userId !== input.userId) continue;
			data.activeTenantId = null;
			const ttlSeconds = Math.max(1, Math.ceil((data.expiresAt - Date.now()) / 1000));
			await kv.put(key.name, JSON.stringify(data), { expirationTtl: ttlSeconds });
		}
	};
	const repository: AdminRepository = {
		db,
		batch: (...args: any[]) => (db.batch as any)(...args),
		listUsers: async (query) => {
			const cacheKeyValue = cacheKey('cache:admin:users:list', {
				cursor: query.cursor,
				excludeTenantId: query.excludeTenantId,
				includeInactive: query.includeInactive,
				limit: query.limit,
				q: query.q
			});
			const cached = await cache.tryGet<AdminListResponse<AdminUserListItemDto>>(cacheKeyValue);
			if (cached) return cached;

			const offset = decodeCursor(query.cursor);
			const filters = [isNull(users.deletedAt)];
			if (!query.includeInactive) filters.push(eq(users.isActive, true));
			if (query.q) filters.push(like(users.username, `%${escapeLike(query.q.toLowerCase())}%`));
			if (query.excludeTenantId) {
				const activeMembership = alias(memberships, 'active_membership');
				filters.push(
					notExists(
						db
							.select({ id: activeMembership.id })
							.from(activeMembership)
							.where(
								and(
									eq(activeMembership.userId, users.id),
									eq(activeMembership.tenantId, query.excludeTenantId),
									isNull(activeMembership.deletedAt)
								)
							)
					)
				);
			}

			const rows = await db
				.select()
				.from(users)
				.where(and(...filters))
				.orderBy(asc(users.username), asc(users.id))
				.limit(query.limit + 1)
				.offset(offset);
			const page = rows.slice(0, query.limit);
			const counts = await workspaceCounts(page.map((user) => user.id));

			const result = {
				items: page.map((user) => ({ ...toUserDto(user), workspaceCount: counts.get(user.id) ?? 0 })),
				nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null
			};
			await cache.put(cacheKeyValue, result, KV_TTL.highChurn);
			return result;
		},
		findUserById: async (userId) => {
			const key = cacheKey('cache:admin:users:detail', userId);
			const cached = await cache.tryGet<UserDto>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(users)
				.where(and(eq(users.id, userId), isNull(users.deletedAt)))
				.limit(1);
			const result = rows[0] ? toUserDto(rows[0]) : null;
			if (result) await cache.put(key, result);
			return result;
		},
		findUserByUsername: async (username) => {
			const key = cacheKey('cache:admin:users:username', username);
			const cached = await cache.tryGet<UserDto>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(users)
				.where(and(eq(users.username, username), isNull(users.deletedAt)))
				.limit(1);
			const result = rows[0] ? toUserDto(rows[0]) : null;
			if (result) await cache.put(key, result);
			return result;
		},
		getUserDetail: async (userId) => {
			const key = cacheKey('cache:admin:users:full', userId);
			const cached = await cache.tryGet<UserDto & { memberships: TenantMembershipDto[] }>(key);
			if (cached) return cached;

			const user = await repository.findUserById(userId);
			if (!user) return null;
			const membershipRows = await db
				.select({ membership: memberships, tenant: tenants })
				.from(memberships)
				.innerJoin(tenants, eq(memberships.tenantId, tenants.id))
				.where(
					and(
						eq(memberships.userId, userId),
						isNull(memberships.deletedAt),
						isNull(tenants.deletedAt)
					)
				)
				.orderBy(asc(tenants.name));
			const result = {
				...user,
				memberships: membershipRows.map(({ membership, tenant }) =>
					toTenantMembershipDto(membership, tenant)
				)
			};
			await cache.put(key, result);
			return result;
		},
		createUser: async ({ username, passwordHash, isAdmin, now }) => {
			const rows = await db
				.insert(users)
				.values({
					id: createId('usr_'),
					username,
					passwordHash,
					isAdmin,
					isActive: true,
					lastActiveTenantId: null,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			const dto = toUserDto(rows[0]!);
			await invalidateUsers();
			await cache.put(cacheKey('cache:admin:users:detail', dto.id), dto);
			await cache.put(cacheKey('cache:admin:users:username', dto.username), dto);
			return dto;
		},
		updateUser: async ({ userId, patch, now }) => {
			const rows = await db
				.update(users)
				.set({ ...patch, updatedAt: now })
				.where(and(eq(users.id, userId), isNull(users.deletedAt)))
				.returning();
			const result = rows[0] ? toUserDto(rows[0]) : null;
			await invalidateUsers();
			if (result) {
				await cache.put(cacheKey('cache:admin:users:detail', result.id), result);
				await cache.put(cacheKey('cache:admin:users:username', result.username), result);
			}
			return result;
		},
		resetUserPassword: async ({ userId, passwordHash, now }) => {
			const rows = await db
				.update(users)
				.set({ passwordHash, updatedAt: now })
				.where(and(eq(users.id, userId), isNull(users.deletedAt)))
				.returning();
			const ok = rows.length > 0;
			if (ok) await invalidateUsers();
			return ok;
		},
		revokeUserSessions: async (userId) => {
			await revokeUserSessionsKv(userId);
			await invalidateUsers();
		},
		deleteUser: async ({ userId, now }) => {
			const rows = await db
				.update(users)
				.set({ isActive: false, deletedAt: now, updatedAt: now })
				.where(and(eq(users.id, userId), isNull(users.deletedAt)))
				.returning();
			if (rows.length === 0) return false;
			await db
				.update(memberships)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)));
			await repository.revokeUserSessions(userId);
			await invalidateUsers();
			return true;
		},
		listTenants: async (query) => {
			const cacheKeyValue = cacheKey('cache:admin:tenants:list', {
				cursor: query.cursor,
				excludeUserId: query.excludeUserId,
				limit: query.limit,
				q: query.q
			});
			const cached = await cache.tryGet<AdminListResponse<AdminTenantListItemDto>>(cacheKeyValue);
			if (cached) return cached;

			const offset = decodeCursor(query.cursor);
			const filters = [isNull(tenants.deletedAt)];
			if (query.q) filters.push(like(tenants.name, `%${escapeLike(query.q)}%`));
			if (query.excludeUserId) {
				const activeMembership = alias(memberships, 'active_membership');
				filters.push(
					notExists(
						db
							.select({ id: activeMembership.id })
							.from(activeMembership)
							.where(
								and(
									eq(activeMembership.tenantId, tenants.id),
									eq(activeMembership.userId, query.excludeUserId),
									isNull(activeMembership.deletedAt)
								)
							)
					)
				);
			}
			const rows = await db
				.select()
				.from(tenants)
				.where(and(...filters))
				.orderBy(asc(tenants.name), asc(tenants.id))
				.limit(query.limit + 1)
				.offset(offset);
			const page = rows.slice(0, query.limit);
			const tenantIds = page.map((tenant) => tenant.id);
			const memberCounts = await membershipCounts(tenantIds);
			const trackCounts = await trackCountsForTenants(tenantIds);
			const result = {
				items: page.map((tenant) => ({
					...toTenantDto(tenant),
					memberCount: memberCounts.get(tenant.id) ?? 0,
					trackCount: trackCounts.get(tenant.id) ?? 0
				})),
				nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null
			};
			await cache.put(cacheKeyValue, result, KV_TTL.highChurn);
			return result;
		},
		findTenantById: async (tenantId) => {
			const key = cacheKey('cache:admin:tenants:detail', tenantId);
			const cached = await cache.tryGet<TenantDto>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(tenants)
				.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
				.limit(1);
			const result = rows[0] ? toTenantDto(rows[0]) : null;
			if (result) await cache.put(key, result);
			return result;
		},
		createTenant: async ({ name, now }) => {
			const rows = await db
				.insert(tenants)
				.values({ id: createId('tnt_'), name, createdAt: now, updatedAt: now })
				.returning();
			const dto = toTenantDto(rows[0]!);
			await invalidateTenants(dto.id);
			await cache.put(cacheKey('cache:admin:tenants:detail', dto.id), dto);
			return dto;
		},
		updateTenant: async ({ tenantId, name, now }) => {
			const rows = await db
				.update(tenants)
				.set({ name, updatedAt: now })
				.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
				.returning();
			const result = rows[0] ? toTenantDto(rows[0]) : null;
			await invalidateTenants(tenantId);
			if (result) await cache.put(cacheKey('cache:admin:tenants:detail', result.id), result);
			return result;
		},
		deleteTenant: async ({ tenantId, now }) => {
			const rows = await db
				.update(tenants)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
				.returning();
			if (rows.length === 0) return false;
			await db
				.update(memberships)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(memberships.tenantId, tenantId), isNull(memberships.deletedAt)));
			await db
				.update(tracks)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)));
			const playlistRows = await db
				.select({ id: playlists.id })
				.from(playlists)
				.where(and(eq(playlists.tenantId, tenantId), isNull(playlists.deletedAt)));
			const playlistIds = playlistRows.map((playlist) => playlist.id);
			if (playlistIds.length > 0) {
				await db
					.update(playlistTracks)
					.set({ deletedAt: now })
					.where(and(inArray(playlistTracks.playlistId, playlistIds), isNull(playlistTracks.deletedAt)));
			}
			await db
				.update(playlists)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(playlists.tenantId, tenantId), isNull(playlists.deletedAt)));
			await repository.clearActiveTenantSessions({ tenantId });
			await invalidateTenants(tenantId);
			return true;
		},
		listTenantMembers: async ({ tenantId, limit, cursor }) => {
			const key = cacheKey('cache:admin:tenants:members', tenantId, { cursor, limit });
			const cached = await cache.tryGet<AdminListResponse<AdminTenantMemberDto>>(key);
			if (cached) return cached;

			const offset = decodeCursor(cursor);
			const rows = await db
				.select({ membership: memberships, tenant: tenants, user: users })
				.from(memberships)
				.innerJoin(tenants, eq(memberships.tenantId, tenants.id))
				.innerJoin(users, eq(memberships.userId, users.id))
				.where(
					and(
						eq(memberships.tenantId, tenantId),
						isNull(memberships.deletedAt),
						isNull(tenants.deletedAt),
						isNull(users.deletedAt)
					)
				)
				.orderBy(asc(users.username), asc(users.id))
				.limit(limit + 1)
				.offset(offset);
			const page = rows.slice(0, limit);
			const result = {
				items: page.map(({ membership, tenant, user }) => ({
					...toTenantMembershipDto(membership, tenant),
					user: toUserDto(user)
				})),
				nextCursor: rows.length > limit ? encodeCursor(offset + limit) : null
			};
			await cache.put(key, result, KV_TTL.highChurn);
			return result;
		},
		findActiveMembership: async ({ tenantId, userId }) => {
			const key = cacheKey('cache:admin:membership', tenantId, userId);
			const cached = await cache.tryGet<TenantMembershipDto>(key);
			if (cached) return cached;

			const rows = await db
				.select({ membership: memberships, tenant: tenants })
				.from(memberships)
				.innerJoin(tenants, eq(memberships.tenantId, tenants.id))
				.where(
					and(
						eq(memberships.tenantId, tenantId),
						eq(memberships.userId, userId),
						isNull(memberships.deletedAt),
						isNull(tenants.deletedAt)
					)
				)
				.limit(1);
			const result = rows[0] ? toTenantMembershipDto(rows[0].membership, rows[0].tenant) : null;
			if (result) await cache.put(key, result);
			return result;
		},
		createMembership: async ({ tenantId, userId, role, now }) => {
			const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
			const rows = await db
				.insert(memberships)
				.values({
					id: createId('mem_'),
					tenantId,
					userId,
					role,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			const dto = toTenantMembershipDto(rows[0]!, tenantRows[0]!);
			await invalidateUsers();
			await invalidateTenants(tenantId);
			await cache.put(cacheKey('cache:admin:membership', tenantId, userId), dto);
			return dto;
		},
		updateMembership: async ({ tenantId, userId, role, now }) => {
			const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
			const rows = await db
				.update(memberships)
				.set({ role, updatedAt: now })
				.where(
					and(
						eq(memberships.tenantId, tenantId),
						eq(memberships.userId, userId),
						isNull(memberships.deletedAt)
					)
				)
				.returning();
			const result = rows[0] && tenantRows[0] ? toTenantMembershipDto(rows[0], tenantRows[0]) : null;
			await invalidateUsers();
			await invalidateTenants(tenantId);
			if (result) await cache.put(cacheKey('cache:admin:membership', tenantId, userId), result);
			return result;
		},
		deleteMembership: async ({ tenantId, userId, now }) => {
			const rows = await db
				.update(memberships)
				.set({ deletedAt: now, updatedAt: now })
				.where(
					and(
						eq(memberships.tenantId, tenantId),
						eq(memberships.userId, userId),
						isNull(memberships.deletedAt)
					)
				)
				.returning();
			if (rows.length === 0) return false;
			await repository.clearActiveTenantSessions({ tenantId, userId });
			await invalidateUsers();
			await invalidateTenants(tenantId);
			return true;
		},
		countTenantOwners: async (tenantId) => {
			const key = cacheKey('cache:admin:tenant-owner-count', tenantId);
			const cached = await cache.tryGet<number>(key);
			if (cached !== null) return cached;

			const rows = await db
				.select({ count: sql<number>`count(*)` })
				.from(memberships)
				.where(
					and(
						eq(memberships.tenantId, tenantId),
						eq(memberships.role, 'owner'),
						isNull(memberships.deletedAt)
					)
				);
			const result = Number(rows[0]?.count ?? 0);
			await cache.put(key, result, KV_TTL.highChurn);
			return result;
		},
		clearActiveTenantSessions: async ({ tenantId, userId }) => {
			await clearActiveTenantSessionsKv({ tenantId, userId });
		},
		insertAudit: async ({ actorId, action, targetType, targetId, tenantId, meta, now }) => {
			await db.insert(auditLogs).values({
				id: createId('aud_'),
				actorId,
				action,
				targetType,
				targetId,
				tenantId,
				meta,
				createdAt: now
			});
		}
	};

	async function workspaceCounts(userIds: string[]): Promise<Map<string, number>> {
		if (userIds.length === 0) return new Map();
		const rows = await db
			.select({ userId: memberships.userId, count: sql<number>`count(*)` })
			.from(memberships)
			.where(and(inArray(memberships.userId, userIds), isNull(memberships.deletedAt)))
			.groupBy(memberships.userId);
		return countMap(rows, 'userId');
	}

	async function membershipCounts(tenantIds: string[]): Promise<Map<string, number>> {
		if (tenantIds.length === 0) return new Map();
		const rows = await db
			.select({ tenantId: memberships.tenantId, count: sql<number>`count(*)` })
			.from(memberships)
			.where(and(inArray(memberships.tenantId, tenantIds), isNull(memberships.deletedAt)))
			.groupBy(memberships.tenantId);
		return countMap(rows, 'tenantId');
	}

	async function trackCountsForTenants(tenantIds: string[]): Promise<Map<string, number>> {
		if (tenantIds.length === 0) return new Map();
		const rows = await db
			.select({ tenantId: tracks.tenantId, count: sql<number>`count(*)` })
			.from(tracks)
			.where(and(inArray(tracks.tenantId, tenantIds), isNull(tracks.deletedAt)))
			.groupBy(tracks.tenantId);
		return countMap(rows, 'tenantId');
	}

	return repository;
}

function countMap<TKey extends 'userId' | 'tenantId'>(
	rows: Array<Record<TKey, string> & { count: number }>,
	key: TKey
): Map<string, number> {
	return new Map(rows.map((row) => [row[key], Number(row.count)]));
}

function encodeCursor(offset: number): string {
	return btoa(JSON.stringify({ offset }));
}

function decodeCursor(cursor: string | undefined): number {
	if (!cursor) return 0;
	try {
		const value = JSON.parse(atob(cursor)) as { offset?: unknown };
		return typeof value.offset === 'number' && value.offset >= 0 ? value.offset : 0;
	} catch {
		return 0;
	}
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
