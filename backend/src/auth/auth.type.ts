import type { Id, Iso8601 } from '../shared/shared.type';
import type { TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';
import type { PreferencesDto } from '../prefs/prefs.type';

export type CurrentSessionDto = {
	user: UserDto;
	tenants: TenantMembershipDto[];
	preferences: PreferencesDto;
	activeTenantId: Id<'tenant'> | null;
	sessionExpiresAt: Iso8601;
};
