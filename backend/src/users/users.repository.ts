import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import { users } from './users.orm';
import { toUserDto } from './users.dto';
import type { UserDto, UserId } from './users.type';

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

export function createUsersRepository(db: Db): UsersRepository {
	const toPasswordRecord = (user: typeof users.$inferSelect): UserPasswordRecord => ({
		...toUserDto(user),
		passwordHash: user.passwordHash,
		deletedAt: user.deletedAt
	});

	return {
		findByUsername: async (username) => {
			const rows = await db
				.select()
				.from(users)
				.where(and(eq(users.username, username), isNull(users.deletedAt)))
				.limit(1);

			return rows[0] ? toPasswordRecord(rows[0]) : null;
		},
		findById: async (userId) => {
			const rows = await db
				.select()
				.from(users)
				.where(and(eq(users.id, userId), isNull(users.deletedAt)))
				.limit(1);

			return rows[0] ? toPasswordRecord(rows[0]) : null;
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
			return toUserDto(rows[0]);
		},
		updatePasswordHash: async ({ userId, passwordHash, now }) => {
			await db
				.update(users)
				.set({ passwordHash, updatedAt: now })
				.where(eq(users.id, userId));
		}
	};
}
