import type { Id, Iso8601 } from '../shared/shared.type';

export type UserId = Id<'user'>;
export type UserDto = {
	id: UserId;
	username: string;
	isAdmin: boolean;
	isActive: boolean;
	lastActiveTenantId: Id<'tenant'> | null;
	createdAt: Iso8601;
};
