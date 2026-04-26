import type { Id } from '../shared/shared.type';
import type { TenantRole } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';

export type SessionContext = {
	user: UserDto;
	activeTenantId: Id<'tenant'> | null;
	role: TenantRole | null;
};
