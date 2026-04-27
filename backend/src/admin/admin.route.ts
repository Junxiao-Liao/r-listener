import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { requireAdmin, requireSession } from '../middleware/middleware.guard';
import { createAdminServiceForDb, type AdminService } from './admin.service';

export type AdminRouteDeps = {
	createAdminService?: (db: Db) => AdminService;
};

export function createAdminRoute(deps: AdminRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createAdminService ?? createAdminServiceForDb;

	route.get('/admin/tenants', requireSession(), requireAdmin(), async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json({ tenants: await service.listTenants() });
	});

	return route;
}

export const adminRoute = createAdminRoute();
