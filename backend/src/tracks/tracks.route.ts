import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody, parseQuery } from '../http/validation';
import { requireSession, requireTenant, requireTenantEditor } from '../middleware/middleware.guard';
import { apiError } from '../http/api-error';
import {
	createTrackInputSchema,
	finalizeTrackInputSchema,
	lyricsInputSchema,
	trackQuerySchema,
	updateTrackInputSchema
} from './tracks.dto';
import { createTracksServiceForDb, type TracksService, type UploadFile } from './tracks.service';
import type { Id } from '../shared/shared.type';

export type TracksRouteDeps = {
	createTracksService?: (db: Db, r2: R2Bucket) => TracksService;
};

export function createTracksRoute(deps: TracksRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createTracksService ?? createTracksServiceForDb;

	route.get('/tracks', requireSession(), requireTenant(), async (c) => {
		const query = parseQuery(c, trackQuerySchema);
		const service = serviceFactory(c.var.db, c.env.R2);
		const isEditor =
			c.var.session.user.isAdmin || c.var.session.role === 'owner' || c.var.session.role === 'member';

		return c.json(
			await service.listTracks({
				tenantId: c.var.session.activeTenantId!,
				isEditor,
				query
			})
		);
	});

	route.get('/tracks/:id', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db, c.env.R2);
		const track = await service.getTrack(
			c.req.param('id') as Id<'track'>,
			c.var.session.activeTenantId!
		);

		if (!track) {
			throw apiError(404, 'track_not_found', 'Track not found.');
		}

		return c.json(track);
	});

	route.post('/tracks', requireSession(), requireTenant(), requireTenantEditor(), async (c) => {
		const formData = await c.req.formData();
		const file = formData.get('file');

		if (!file || typeof file === 'string') {
			throw apiError(400, 'upload_missing', 'Audio file is required.');
		}

		const metadata = createTrackInputSchema.parse({
			title: formData.get('title')?.toString() || undefined,
			artistNames: formData.getAll('artistNames').map((value) => value.toString()),
			album: formData.get('album')?.toString() || undefined
		});

		const service = serviceFactory(c.var.db, c.env.R2);
		const track = await service.createTrack({
			tenantId: c.var.session.activeTenantId!,
			uploaderId: c.var.session.user.id,
			file: file as unknown as UploadFile,
			metadata
		});

		return c.json(track, 201);
	});

	route.post(
		'/tracks/:id/finalize',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const body = await parseJsonBody(c, finalizeTrackInputSchema);
			const service = serviceFactory(c.var.db, c.env.R2);

			const track = await service.finalizeTrack({
				trackId: c.req.param('id') as Id<'track'>,
				tenantId: c.var.session.activeTenantId!,
				input: body
			});

			return c.json(track);
		}
	);

	route.patch('/tracks/:id', requireSession(), requireTenant(), requireTenantEditor(), async (c) => {
		const body = await parseJsonBody(c, updateTrackInputSchema);
		const service = serviceFactory(c.var.db, c.env.R2);

		const track = await service.updateTrack({
			trackId: c.req.param('id') as Id<'track'>,
			tenantId: c.var.session.activeTenantId!,
			input: body
		});

		return c.json(track);
	});

	route.put(
		'/tracks/:id/lyrics',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const body = await parseJsonBody(c, lyricsInputSchema);
			const service = serviceFactory(c.var.db, c.env.R2);

			const track = await service.setLyrics({
				trackId: c.req.param('id') as Id<'track'>,
				tenantId: c.var.session.activeTenantId!,
				input: body
			});

			return c.json(track);
		}
	);

	route.delete(
		'/tracks/:id/lyrics',
		requireSession(),
		requireTenant(),
		requireTenantEditor(),
		async (c) => {
			const service = serviceFactory(c.var.db, c.env.R2);

			await service.clearLyrics(
				c.req.param('id') as Id<'track'>,
				c.var.session.activeTenantId!
			);

			return c.body(null, 204);
		}
	);

	route.delete('/tracks/:id', requireSession(), requireTenant(), requireTenantEditor(), async (c) => {
		const service = serviceFactory(c.var.db, c.env.R2);

		const deleted = await service.softDeleteTrack(
			c.req.param('id') as Id<'track'>,
			c.var.session.activeTenantId!
		);

		if (!deleted) {
			throw apiError(404, 'track_not_found', 'Track not found.');
		}

		return c.body(null, 204);
	});

	route.get('/tracks/:id/stream', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db, c.env.R2);
		const rangeHeader = c.req.header('Range');

		const object = await service.getStream({
			trackId: c.req.param('id') as Id<'track'>,
			tenantId: c.var.session.activeTenantId!,
			rangeHeader
		});

		const headers = new Headers();
		headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
		headers.set('Accept-Ranges', 'bytes');

		if (object.httpMetadata?.cacheControl) {
			headers.set('Cache-Control', object.httpMetadata.cacheControl);
		}

		if (object.range) {
			const range = object.range as { offset: number; length?: number };
			const rangeStart = range.offset;
			const rangeEnd = range.length ? range.offset + range.length - 1 : object.size - 1;
			return new Response(object.body as ReadableStream, {
				status: 206,
				headers: {
					'Content-Type': headers.get('Content-Type') ?? 'application/octet-stream',
					'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${object.size}`,
					'Accept-Ranges': 'bytes'
				}
			});
		}

		return new Response(object.body as ReadableStream, {
			headers: {
				'Content-Type': headers.get('Content-Type') ?? 'application/octet-stream',
				'Accept-Ranges': 'bytes',
				'Content-Length': String(object.size)
			}
		});
	});

	return route;
}

export const tracksRoute = createTracksRoute();
