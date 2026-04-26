import type { Context } from 'hono';
import type { z } from 'zod';
import { fieldsFromZodError, validationError } from './api-error';

export async function parseJsonBody<T>(
	c: Context,
	schema: z.ZodType<T>
): Promise<T> {
	let payload: unknown;

	try {
		payload = await c.req.json();
	} catch {
		throw validationError({ _: 'Request body must be valid JSON.' });
	}

	const result = schema.safeParse(payload);
	if (!result.success) {
		throw validationError(fieldsFromZodError(result.error));
	}

	return result.data;
}

export function parseQuery<T>(c: Context, schema: z.ZodType<T>): T {
	const result = schema.safeParse(c.req.query());
	if (!result.success) {
		throw validationError(fieldsFromZodError(result.error));
	}

	return result.data;
}
