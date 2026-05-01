import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseQuery } from '../http/validation';
import { requireSession, requireTenant } from '../middleware/middleware.guard';
import { artistsQuerySchema } from './artists.dto';
import { createArtistsServiceForDb, type ArtistsService } from './artists.service';

export type ArtistsRouteDeps = {
	createArtistsService?: (db: Db) => ArtistsService;
};

export function createArtistsRoute(deps: ArtistsRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createArtistsService ?? createArtistsServiceForDb;

	route.get('/artists', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, artistsQuerySchema);
		const service = serviceFactory(c.var.db);
		return c.json(
			await service.listArtists({
				tenantId: c.var.session.activeTenantId!,
				query
			})
		);
	});

	return route;
}

export const artistsRoute = createArtistsRoute();
