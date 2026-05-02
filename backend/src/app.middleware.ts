import { createMiddleware } from 'hono/factory';
import { createDb, type Db } from './db';
import type { BackendEnv } from './app.type';
import type { MiddlewareService } from './middleware/middleware.type';

export type MiddlewareServiceFactory = (input: {
	db: Db;
}) => MiddlewareService;

export function createAppContextMiddleware(createMiddlewareService: MiddlewareServiceFactory) {
	return createMiddleware<BackendEnv>(async (c, next) => {
		const db = createDb(c.env.DB);
		c.set('db', db);
		c.set('middlewareService', createMiddlewareService({ db }));
		await next();
	});
}
