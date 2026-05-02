import type { Id, Iso8601 } from '../shared/shared.type';
import type { TenantMembershipDto } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';
import type { PreferencesDto } from '../prefs/prefs.type';
import type { SessionContext } from '../middleware/middleware.type';

export type CurrentSessionDto = {
	user: UserDto;
	tenants: TenantMembershipDto[];
	preferences: PreferencesDto;
	activeTenantId: Id<'tenant'> | null;
	sessionExpiresAt: Iso8601;
};

export type SigninInput = {
	username: string;
	password: string;
	ip: string | null;
	userAgent: string | null;
};

export type DemoSigninInput = {
	ip: string | null;
	userAgent: string | null;
};

export type DemoSigninResult = CurrentSessionDto & {
	sessionToken: string;
};

export type SigninResult = CurrentSessionDto & {
	sessionToken: string;
};

export type CurrentSessionInput = {
	session: SessionContext;
};

export type SwitchTenantInput = {
	session: SessionContext;
	tenantId: Id<'tenant'>;
};

export type SwitchTenantResult = {
	user: UserDto;
	activeTenantId: Id<'tenant'>;
};

export type ChangePasswordInput = {
	session: SessionContext;
	currentPassword: string;
	newPassword: string;
};
