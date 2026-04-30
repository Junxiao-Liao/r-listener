import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody } from '../http/validation';
import { requireSession } from '../middleware/middleware.guard';
import { getClientIp } from '../middleware/request-context';
import { changePasswordInputSchema, signinInputSchema, switchTenantInputSchema } from './auth.dto';
import { createAuthServiceForDb, type AuthService } from './auth.service';
import { clearSessionCookie, setSessionCookie } from './session.cookie';
import type { Id } from '../shared/shared.type';

export type AuthRouteDeps = {
	createAuthService?: (db: Db, kv: KVNamespace) => AuthService;
};

export function createAuthRoute(deps: AuthRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createAuthService ?? createAuthServiceForDb;

	route.post('/auth/signin', async (c) => {
		const body = await parseJsonBody(c, signinInputSchema);
		const service = serviceFactory(c.var.db, c.var.kv);
		const result = await service.signIn({
			...body,
			ip: getClientIp(c.req.raw.headers),
			userAgent: c.req.header('User-Agent') ?? null
		});
		setSessionCookie(c, result.sessionToken, result.sessionExpiresAt);
		const { sessionToken: _omit, ...response } = result;
		return c.json(response);
	});

	route.get('/auth/session', requireSession(), async (c) => {
		const service = serviceFactory(c.var.db, c.var.kv);
		return c.json(await service.getCurrentSession({ session: c.var.session }));
	});

	route.post('/auth/signout', requireSession(), async (c) => {
		const service = serviceFactory(c.var.db, c.var.kv);
		await service.signOut({ sessionTokenHash: c.var.session.sessionTokenHash });
		clearSessionCookie(c);
		return c.body(null, 204);
	});

	route.post('/auth/switch-tenant', requireSession(), async (c) => {
		const body = await parseJsonBody(c, switchTenantInputSchema);
		const service = serviceFactory(c.var.db, c.var.kv);
		return c.json(
			await service.switchTenant({
				session: c.var.session,
				tenantId: body.tenantId as Id<'tenant'>
			})
		);
	});

	route.post('/auth/change-password', requireSession(), async (c) => {
		const body = await parseJsonBody(c, changePasswordInputSchema);
		const service = serviceFactory(c.var.db, c.var.kv);
		await service.changePassword({ session: c.var.session, ...body });
		return c.body(null, 204);
	});

	return route;
}

export const authRoute = createAuthRoute();
