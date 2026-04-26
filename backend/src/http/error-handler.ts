import type { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { BackendEnv } from '../app.type';
import { ApiError, apiError, formatApiError, internalError } from './api-error';

export function registerErrorHandlers(app: Hono<BackendEnv>): void {
	app.onError((error, c) => {
		const apiErr = error instanceof ApiError ? error : internalError();
		return c.json(formatApiError(apiErr), apiErr.status as ContentfulStatusCode);
	});

	app.notFound((c) =>
		c.json(formatApiError(apiError(404, 'not_found', 'Route not found.')), 404)
	);
}
