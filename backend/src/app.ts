import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from './db';
import type { BackendEnv } from './app.type';
import { createAppContextMiddleware } from './app.middleware';
import { registerErrorHandlers } from './http/error-handler';
import { healthRoute } from './health/health.route';
import { createMiddlewareService } from './middleware/middleware.service';
import { enforceAuthRateLimit, enforceMutationOrigin } from './middleware/middleware.guard';
import type { MiddlewareService } from './middleware/middleware.type';
import { authRoute } from './auth/auth.route';
import { prefsRoute } from './prefs/prefs.route';

export type AppOptions = {
	createMiddlewareService?: (input: { db: Db; kv: KVNamespace }) => MiddlewareService;
	configure?: (app: Hono<BackendEnv>) => void;
};

export function createApp(options: AppOptions = {}) {
	const app = new Hono<BackendEnv>();
	const middlewareServiceFactory =
		options.createMiddlewareService ?? (({ db, kv }) => createMiddlewareService(db, kv));

	registerErrorHandlers(app);

	app.use('*', createAppContextMiddleware(middlewareServiceFactory));

	app.use(
		'*',
		cors({
			origin: (_origin, c) => c.env.FRONTEND_ORIGIN,
			credentials: true
		})
	);

	app.use('*', enforceMutationOrigin());
	app.use('*', enforceAuthRateLimit());

	app.route('/', healthRoute);
	app.route('/', authRoute);
	app.route('/', prefsRoute);

	options.configure?.(app);

	return app;
}
