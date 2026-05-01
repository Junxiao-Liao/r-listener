import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import { users } from './users.orm';
import { toUserDto } from './users.dto';
import type { UserDto, UserId } from './users.type';
import { cacheKey, cachePrefix, createKvCache, KV_TTL } from '../lib/kv-cache';

export type UserPasswordRecord = UserDto & {
	readonly passwordHash: string;
	readonly deletedAt: Date | null;
};

export type UsersRepository = {
	findByUsername(username: string): Promise<UserPasswordRecord | null>;
	findById(userId: UserId): Promise<UserPasswordRecord | null>;
	updateLastActiveTenant(input: {
		userId: UserId;
		tenantId: UserDto['lastActiveTenantId'];
		now: Date;
	}): Promise<UserDto>;
	updatePasswordHash(input: { userId: UserId; passwordHash: string; now: Date }): Promise<void>;
};

export function createUsersRepository(db: Db, kv?: KVNamespace): UsersRepository {
	const cache = kv ? createKvCache(kv, { defaultTtlSeconds: KV_TTL.authz }) : null;

	const toPasswordRecord = (user: typeof users.$inferSelect): UserPasswordRecord => ({
		...toUserDto(user),
		passwordHash: user.passwordHash,
		deletedAt: user.deletedAt
	});

	function userKey(userId: UserId): string {
		return `cache:user:${userId}`;
	}

	function usernameKey(username: string): string {
		return `cache:user:username:${username}`;
	}

	async function cacheUserRecord(record: UserPasswordRecord): Promise<void> {
		if (cache) {
			await cache.put(userKey(record.id), record);
			await cache.put(usernameKey(record.username), record);
		}
	}

	async function invalidateUserCache(userId: UserId, username: string): Promise<void> {
		if (cache) {
			await cache.invalidate(userKey(userId));
			await cache.invalidate(usernameKey(username));
			await cache.invalidate(cacheKey('cache:session:user', userId));
			await cache.invalidate(cacheKey('cache:authz:user-memberships', userId));
			await cache.invalidatePrefix(cachePrefix('cache:authz:membership'));
			await cache.invalidatePrefix('cache:admin:users:');
		}
	}

	return {
		findByUsername: async (username) => {
			const key = usernameKey(username);
			const cached = await cache?.tryGet<UserPasswordRecord>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(users)
				.where(and(eq(users.username, username), isNull(users.deletedAt)))
				.limit(1);

			const result = rows[0] ? toPasswordRecord(rows[0]) : null;
			if (cache && result) await cacheUserRecord(result);
			return result;
		},
		findById: async (userId) => {
			const key = userKey(userId);
			const cached = await cache?.tryGet<UserPasswordRecord>(key);
			if (cached) return cached;

			const rows = await db
				.select()
				.from(users)
				.where(and(eq(users.id, userId), isNull(users.deletedAt)))
				.limit(1);

			const result = rows[0] ? toPasswordRecord(rows[0]) : null;
			if (cache && result) await cacheUserRecord(result);
			return result;
		},
		updateLastActiveTenant: async ({ userId, tenantId, now }) => {
			const rows = await db
				.update(users)
				.set({ lastActiveTenantId: tenantId, updatedAt: now })
				.where(eq(users.id, userId))
				.returning();
			if (!rows[0]) {
				throw new Error('failed to update user active tenant');
			}
			const dto = toUserDto(rows[0]);
			if (cache) {
				await cacheUserRecord(toPasswordRecord(rows[0]));
				await cache.invalidate(cacheKey('cache:session:user', userId));
			}
			return dto;
		},
		updatePasswordHash: async ({ userId, passwordHash, now }) => {
			const existing = await db
				.select()
				.from(users)
				.where(eq(users.id, userId))
				.limit(1);

			await db
				.update(users)
				.set({ passwordHash, updatedAt: now })
				.where(eq(users.id, userId));

			if (cache && existing[0]) {
				await invalidateUserCache(userId, existing[0].username);
			}
		}
	};
}
