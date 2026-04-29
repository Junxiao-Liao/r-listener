import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody, parseQuery } from '../http/validation';
import { requireSession, requireTenant } from '../middleware/middleware.guard';
import type { Id } from '../shared/shared.type';
import {
	continueListeningQuerySchema,
	playbackEventsBatchSchema,
	recentTracksQuerySchema
} from './playback.dto';
import {
	createPlaybackServiceForDb,
	type PlaybackService
} from './playback.service';
import type { PlaybackEventInput } from './playback.type';

export type PlaybackRouteDeps = {
	createPlaybackService?: (db: Db) => PlaybackService;
};

export function createPlaybackRoute(deps: PlaybackRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createPlaybackService ?? createPlaybackServiceForDb;

	route.post('/playback-events', requireSession(), requireTenant(), async (c) => {
		const body = await parseJsonBody(c, playbackEventsBatchSchema);
		const service = serviceFactory(c.var.db);

		await service.recordEvents({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!,
			events: body.events as PlaybackEventInput[]
		});

		return c.body(null, 204);
	});

	route.get('/me/recent-tracks', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, recentTracksQuerySchema);
		const service = serviceFactory(c.var.db);

		const page = await service.listRecent({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!,
			limit: query.limit,
			cursor: query.cursor
		});

		return c.json(page);
	});

	route.get('/me/continue-listening', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, continueListeningQuerySchema);
		const service = serviceFactory(c.var.db);

		const page = await service.listContinueListening({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId! as Id<'tenant'>,
			limit: query.limit
		});

		return c.json(page);
	});

	return route;
}

export const playbackRoute = createPlaybackRoute();
