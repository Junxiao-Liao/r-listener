import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { BackendEnv } from '../app.type';
import {
	ApiError,
	apiError,
	formatApiError,
	internalError
} from './api-error';
import type { ApiErrorBody } from './api-error.type';

type ErrorDetails = NonNullable<ApiErrorBody['error']['details']>;

function serializeUnknown(value: unknown): string | undefined {
	if (value === undefined) return undefined;
	if (value instanceof Error) return `${value.name}: ${value.message}`;
	if (typeof value === 'string') return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function toErrorDetails(error: unknown): ErrorDetails {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			...(error.stack ? { stack: error.stack } : {}),
			...(serializeUnknown(error.cause) ? { cause: serializeUnknown(error.cause) } : {})
		};
	}
	return {
		name: typeof error,
		message: serializeUnknown(error) ?? 'Unknown error'
	};
}

function isLocalHostname(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function exposesUnexpectedErrorDetails(c: Context<BackendEnv>): boolean {
	const environment = c.env.ENVIRONMENT?.toLowerCase();
	if (environment) return environment !== 'production';
	return isLocalHostname(new URL(c.req.url).hostname);
}

function logUnexpectedError(error: unknown, c: Context<BackendEnv>): void {
	const details = toErrorDetails(error);
	console.error('Unexpected API error', {
		method: c.req.method,
		path: c.req.path,
		name: details.name,
		message: details.message,
		...(details.stack ? { stack: details.stack } : {}),
		...(details.cause ? { cause: details.cause } : {})
	});
}

function formatUnexpectedError(error: unknown, c: Context<BackendEnv>): ApiErrorBody {
	const body = formatApiError(internalError());
	if (exposesUnexpectedErrorDetails(c)) {
		body.error.details = toErrorDetails(error);
	}
	return body;
}

export function registerErrorHandlers(app: Hono<BackendEnv>): void {
	app.onError((error, c) => {
		if (error instanceof ApiError) {
			return c.json(formatApiError(error), error.status as ContentfulStatusCode);
		}

		logUnexpectedError(error, c);
		return c.json(formatUnexpectedError(error, c), 500 as ContentfulStatusCode);
	});

	app.notFound((c) =>
		c.json(formatApiError(apiError(404, 'not_found', 'Route not found.')), 404)
	);
}
