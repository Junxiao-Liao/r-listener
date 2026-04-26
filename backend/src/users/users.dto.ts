import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { UserDto } from './users.type';
import type { users } from './users.orm';

export const usernameSchema = z
	.string()
	.trim()
	.transform((username) => username.toLowerCase())
	.pipe(
		z
			.string()
			.min(3)
			.max(32)
			.regex(/^[a-z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens.')
	);

export const userDtoSchema = z.object({
	id: z.string(),
	username: usernameSchema,
	isAdmin: z.boolean(),
	isActive: z.boolean(),
	lastActiveTenantId: z.string().nullable(),
	createdAt: z.string()
});

export function toUserDto(user: typeof users.$inferSelect): UserDto {
	return {
		id: user.id as UserDto['id'],
		username: usernameSchema.parse(user.username),
		isAdmin: user.isAdmin,
		isActive: user.isActive,
		lastActiveTenantId: user.lastActiveTenantId as UserDto['lastActiveTenantId'],
		createdAt: fromUnixTimestampSeconds(user.createdAt)
	};
}
