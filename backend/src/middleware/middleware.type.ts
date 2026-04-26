import type { Id } from '../shared/shared.type';
import type { TenantRole } from '../tenants/tenants.type';
import type { UserDto } from '../users/users.type';

export type SessionContext = {
	user: UserDto;
	sessionTokenHash: string;
	activeTenantId: Id<'tenant'> | null;
	role: TenantRole | null;
	sessionExpiresAt: string;
};

export type SessionValidationInput = {
	token: string;
	now: Date;
	ip: string | null;
	userAgent: string | null;
};

export type SessionValidationResult = SessionContext & {
	refreshedSessionExpiresAt: string | null;
};

export type TenantAccessInput = {
	session: SessionContext;
	now: Date;
};

export type TenantAccessResult = {
	activeTenantId: Id<'tenant'>;
	role: TenantRole | null;
};

export type AuthRateLimitInput = {
	ip: string;
	now: Date;
};

export type AuthRateLimitResult = {
	allowed: boolean;
};

export type MiddlewareService = {
	validateSession(input: SessionValidationInput): Promise<SessionValidationResult | null>;
	resolveTenantAccess(input: TenantAccessInput): Promise<TenantAccessResult | null>;
	checkAuthRateLimit(input: AuthRateLimitInput): Promise<AuthRateLimitResult>;
};
