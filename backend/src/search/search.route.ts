import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseQuery } from '../http/validation';
import { requireSession, requireTenant } from '../middleware/middleware.guard';
import { searchQuerySchema } from './search.dto';
import { createSearchServiceForDb, type SearchService } from './search.service';

export type SearchRouteDeps = {
	createSearchService?: (db: Db, kv: KVNamespace) => SearchService;
};

export function createSearchRoute(deps: SearchRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createSearchService ?? createSearchServiceForDb;

	route.get('/search', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, searchQuerySchema);
		const service = serviceFactory(c.var.db, c.var.kv);
		return c.json(
			await service.search({
				tenantId: c.var.session.activeTenantId!,
				...query
			})
		);
	});

	return route;
}

export const searchRoute = createSearchRoute();
