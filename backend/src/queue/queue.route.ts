import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody } from '../http/validation';
import { requireSession, requireTenant } from '../middleware/middleware.guard';
import type { Id } from '../shared/shared.type';
import { addQueueItemsInputSchema, updateQueueItemInputSchema } from './queue.dto';
import { createQueueServiceForDb, type QueueService } from './queue.service';

export type QueueRouteDeps = {
	createQueueService?: (db: Db) => QueueService;
};

export function createQueueRoute(deps: QueueRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createQueueService ?? createQueueServiceForDb;

	route.get('/queue', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db);
		const state = await service.getState({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!
		});
		return c.json(state);
	});

	route.post('/queue/items', requireSession(), requireTenant(), async (c) => {
		const body = await parseJsonBody(c, addQueueItemsInputSchema);
		const service = serviceFactory(c.var.db);

		const state = await service.addItems({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!,
			trackIds: body.trackIds as Id<'track'>[],
			position: body.position ?? null
		});

		return c.json(state, 201);
	});

	route.patch('/queue/items/:id', requireSession(), requireTenant(), async (c) => {
		const body = await parseJsonBody(c, updateQueueItemInputSchema);
		const service = serviceFactory(c.var.db);

		const state = await service.updateItem({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!,
			itemId: c.req.param('id') as Id<'queue_item'>,
			position: body.position,
			isCurrent: body.isCurrent
		});

		return c.json(state);
	});

	route.delete('/queue/items/:id', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db);
		const state = await service.deleteItem({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!,
			itemId: c.req.param('id') as Id<'queue_item'>
		});
		return c.json(state);
	});

	route.delete('/queue', requireSession(), requireTenant(), async (c) => {
		const service = serviceFactory(c.var.db);
		await service.clearQueue({
			userId: c.var.session.user.id,
			tenantId: c.var.session.activeTenantId!
		});
		return c.body(null, 204);
	});

	return route;
}

export const queueRoute = createQueueRoute();
