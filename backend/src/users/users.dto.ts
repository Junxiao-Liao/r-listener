import { z } from 'zod';
import { fromUnixTimestampSeconds } from '../shared/time';
import type { UserDto } from './users.type';
import type { users } from './users.orm';

export const userDtoSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	displayName: z.string().nullable(),
	isAdmin: z.boolean(),
	isActive: z.boolean(),
	lastActiveTenantId: z.string().nullable(),
	createdAt: z.string()
});

export function toUserDto(user: typeof users.$inferSelect): UserDto {
	return {
		id: user.id as UserDto['id'],
		email: user.email,
		displayName: user.displayName,
		isAdmin: user.isAdmin,
		isActive: user.isActive,
		lastActiveTenantId: user.lastActiveTenantId as UserDto['lastActiveTenantId'],
		createdAt: fromUnixTimestampSeconds(user.createdAt)
	};
}
