import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { SESSION_COOKIE } from '../auth/session';
import { setSessionCookie } from '../auth/session.cookie';
import type { BackendEnv } from '../app.type';
import { apiError } from '../http/api-error';
import { getClientIp } from './request-context';
import { DEMO_API_RATE_LIMIT_MAX } from './rate-limit.service';

export const enforceAuthRateLimit = () =>
	createMiddleware<BackendEnv>(async (c, next) => {
		if (!c.req.path.startsWith('/api/auth/') || c.req.path === '/api/auth/session') {
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
			setSessionCookie(c, token, refreshedSessionExpiresAt);
		}

		if (!sessionContext.user.isAdmin) {
			const isDemoUser = sessionContext.user.username === 'demo';
			const apiLimitResult = await c.var.middlewareService.checkApiRateLimit({
				userId: sessionContext.user.id,
				now: new Date(),
				...(isDemoUser ? { max: DEMO_API_RATE_LIMIT_MAX } : {})
			});
			if (!apiLimitResult.allowed) {
				throw apiError(429, 'rate_limited', 'Too many API requests. Try again later.');
			}
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

function unauthenticated() {
	return apiError(401, 'unauthenticated', 'Authentication required.');
}
