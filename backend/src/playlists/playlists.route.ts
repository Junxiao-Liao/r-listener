import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody, parseQuery } from '../http/validation';
import {
	requireSession,
	requireTenant,
	requireTenantEditor
} from '../middleware/middleware.guard';
import type { Id } from '../shared/shared.type';
import {
	addPlaylistTrackInputSchema,
	createPlaylistInputSchema,
	movePlaylistTrackInputSchema,
	playlistQuerySchema,
	playlistTracksQuerySchema,
	updatePlaylistInputSchema
} from './playlists.dto';
import {
	createPlaylistsServiceForDb,
	type PlaylistsService
} from './playlists.service';

export type PlaylistsRouteDeps = {
	createPlaylistsService?: (db: Db) => PlaylistsService;
};

export function createPlaylistsRoute(deps: PlaylistsRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createPlaylistsService ?? createPlaylistsServiceForDb;

	route.get('/playlists', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, playlistQuerySchema);
		const service = serviceFactory(c.var.db);
		return c.json(
			await service.listPlaylists({
				tenantId: c.var.session.activeTenantId!,
				query
			})
		);
	});

	route.get('/playlists/:id', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json(
			await service.getPlaylist({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>
			})
		);
	});

	route.post(
		'/playlists',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const body = await parseJsonBody(c, createPlaylistInputSchema);
			const service = serviceFactory(c.var.db);
			const created = await service.createPlaylist({
				tenantId: c.var.session.activeTenantId!,
				ownerId: c.var.session.user.id,
				input: body
			});
			return c.json(created, 201);
		}
	);

	route.patch(
		'/playlists/:id',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const body = await parseJsonBody(c, updatePlaylistInputSchema);
			const service = serviceFactory(c.var.db);
			const updated = await service.updatePlaylist({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>,
				input: body
			});
			return c.json(updated);
		}
	);

	route.delete(
		'/playlists/:id',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const service = serviceFactory(c.var.db);
			await service.deletePlaylist({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>
			});
			return c.body(null, 204);
		}
	);

	route.get('/playlists/:id/tracks', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, playlistTracksQuerySchema);
		const service = serviceFactory(c.var.db);
		return c.json(
			await service.listTracks({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>,
				query
			})
		);
	});

	route.post(
		'/playlists/:id/tracks',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const body = await parseJsonBody(c, addPlaylistTrackInputSchema);
			const service = serviceFactory(c.var.db);
			const item = await service.addTrack({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>,
				input: body
			});
			return c.json(item, 201);
		}
	);

	route.patch(
		'/playlists/:id/tracks/:trackId',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const body = await parseJsonBody(c, movePlaylistTrackInputSchema);
			const service = serviceFactory(c.var.db);
			const item = await service.moveTrack({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>,
				trackId: c.req.param('trackId') as Id<'track'>,
				input: body
			});
			return c.json(item);
		}
	);

	route.delete(
		'/playlists/:id/tracks/:trackId',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const service = serviceFactory(c.var.db);
			await service.removeTrack({
				tenantId: c.var.session.activeTenantId!,
				playlistId: c.req.param('id') as Id<'playlist'>,
				trackId: c.req.param('trackId') as Id<'track'>
			});
			return c.body(null, 204);
		}
	);

	return route;
}

export const playlistsRoute = createPlaylistsRoute();
