import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody } from '../http/validation';
import { requireSession } from '../middleware/middleware.guard';
import { createPrefsRepository } from './prefs.repository';
import { createPrefsService, type PrefsService } from './prefs.service';
import { preferencesPatchSchema } from './prefs.dto';

export type PrefsRouteDeps = {
	createPrefsService?: (db: Db) => PrefsService;
};

export function createPrefsRoute(deps: PrefsRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory =
		deps.createPrefsService ?? ((db: Db) => createPrefsService(createPrefsRepository(db)));

	route.get('/me/preferences', requireSession(), async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json(await service.getPreferences(c.var.session.user.id));
	});

	route.patch('/me/preferences', requireSession(), async (c) => {
		const patch = await parseJsonBody(c, preferencesPatchSchema);
		const service = serviceFactory(c.var.db);
		return c.json(await service.updatePreferences(c.var.session.user.id, patch));
	});

	return route;
}

export const prefsRoute = createPrefsRoute();
