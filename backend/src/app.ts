import { Hono } from 'hono';
import type { Db } from './db';
import type { BackendEnv } from './app.type';
import { createAppContextMiddleware } from './app.middleware';
import { registerErrorHandlers } from './http/error-handler';
import { healthRoute } from './health/health.route';
import { createMiddlewareService } from './middleware/middleware.service';
import { enforceAuthRateLimit } from './middleware/middleware.guard';
import type { MiddlewareService } from './middleware/middleware.type';
import { authRoute } from './auth/auth.route';
import { prefsRoute } from './prefs/prefs.route';
import { createAdminRoute } from './admin/admin.route';
import type { AdminService } from './admin/admin.service';

export type AppOptions = {
	createMiddlewareService?: (input: { db: Db; kv: KVNamespace }) => MiddlewareService;
	createAdminService?: (db: Db) => AdminService;
	configure?: (app: Hono<BackendEnv>) => void;
};

export function createApp(options: AppOptions = {}) {
	const app = new Hono<BackendEnv>();
	const middlewareServiceFactory =
		options.createMiddlewareService ?? (({ db, kv }) => createMiddlewareService(db, kv));

	registerErrorHandlers(app);

	const api = new Hono<BackendEnv>();
	api.use('*', createAppContextMiddleware(middlewareServiceFactory));
	api.use('*', enforceAuthRateLimit());

	api.route('/', healthRoute);
	api.route('/', authRoute);
	api.route('/', prefsRoute);
	api.route('/', createAdminRoute({ createAdminService: options.createAdminService }));

	options.configure?.(api);

	app.route('/api', api);

	return app;
}
