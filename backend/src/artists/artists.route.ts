import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseQuery } from '../http/validation';
import { requireSession, requireTenant } from '../middleware/middleware.guard';
import { artistsQuerySchema } from './artists.dto';
import type { Id } from '../shared/shared.type';
import { createArtistsServiceForDb, type ArtistsService } from './artists.service';

export type ArtistsRouteDeps = {
	createArtistsService?: (db: Db, kv: KVNamespace) => ArtistsService;
};

export function createArtistsRoute(deps: ArtistsRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createArtistsService ?? createArtistsServiceForDb;

	route.get('/artists', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, artistsQuerySchema);
		const service = serviceFactory(c.var.db, c.var.kv);
		return c.json(
			await service.listArtists({
				tenantId: c.var.session.activeTenantId!,
				query
			})
		);
	});

	route.get('/artists/:id', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db, c.var.kv);
		return c.json(
			await service.getArtist({
				tenantId: c.var.session.activeTenantId!,
				artistId: c.req.param('id') as Id<'artist'>
			})
		);
	});

	route.get('/artists/:id/tracks', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db, c.var.kv);
		return c.json(
			await service.listArtistTracks({
				tenantId: c.var.session.activeTenantId!,
				artistId: c.req.param('id') as Id<'artist'>
			})
		);
	});

	return route;
}

export const artistsRoute = createArtistsRoute();
