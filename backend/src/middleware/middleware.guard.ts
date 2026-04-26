import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { SESSION_COOKIE } from '../auth/session';
import type { BackendEnv } from '../app.type';
import { apiError } from '../http/api-error';
import { getClientIp } from './request-context';

export const enforceMutationOrigin = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		if (!isStateChangingMethod(c.req.method)) {
			await next();
			return;
		}

		if (c.req.header('Origin') !== c.env.FRONTEND_ORIGIN) {
			throw apiError(403, 'forbidden_origin', 'Request origin is not allowed.');
		}

		await next();
	});

export const enforceAuthRateLimit = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		if (!c.req.path.startsWith('/auth/')) {
			await next();
			return;
		}

		const result = await c.var.middlewareService.checkAuthRateLimit({
			ip: getClientIp(c.req.raw.headers),
			now: new Date()
		});

		if (!result.allowed) {
			throw apiError(429, 'rate_limited', 'Too many auth requests. Try again later.');
		}

		await next();
	});

export const requireSession = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		const token = getCookie(c, SESSION_COOKIE);
		if (!token) {
			throw unauthenticated();
		}

		const session = await c.var.middlewareService.validateSession({
			token,
			now: new Date(),
			ip: getClientIp(c.req.raw.headers),
			userAgent: c.req.header('User-Agent') ?? null
		});

		if (!session) {
			throw unauthenticated();
		}

		const { refreshedSessionExpiresAt, ...sessionContext } = session;
		c.set('session', sessionContext);
		if (refreshedSessionExpiresAt) {
			c.header('X-Session-Expires-At', refreshedSessionExpiresAt);
		}

		await next();
	});

export const requireTenant = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		const session = c.var.session;
		if (!session.activeTenantId) {
			throw apiError(403, 'no_active_tenant', 'No active tenant selected.');
		}

		const tenantAccess = await c.var.middlewareService.resolveTenantAccess({
			session,
			now: new Date()
		});

		if (!tenantAccess) {
			throw apiError(403, 'tenant_forbidden', 'You do not have access to this tenant.');
		}

		c.set('session', {
			...session,
			activeTenantId: tenantAccess.activeTenantId,
			role: tenantAccess.role
		});

		await next();
	});

export const requireTenantEditor = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		const session = c.var.session;
		if (!session.user.isAdmin && session.role !== 'owner' && session.role !== 'member') {
			throw apiError(403, 'insufficient_role', 'Editor role required.');
		}

		await next();
	});

export const requireAdmin = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		if (!c.var.session.user.isAdmin) {
			throw apiError(403, 'admin_required', 'Admin access required.');
		}

		await next();
	});

function isStateChangingMethod(method: string): boolean {
	return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function unauthenticated() {
	return apiError(401, 'unauthenticated', 'Authentication required.');
}
