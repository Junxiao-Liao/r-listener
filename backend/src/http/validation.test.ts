import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../app';
import { createTestEnv } from '../test/test-env';
import { parseJsonBody, parseQuery } from './validation';

describe('validation helpers', () => {
	it('parses valid JSON request bodies', async () => {
		const app = createApp({
			configure: (app) => {
				app.post('/fixture/body', async (c) => {
					const body = await parseJsonBody(c, z.object({ name: z.string().min(1) }));
					return c.json(body);
				});
			}
		});

		const res = await app.request(
			'/api/fixture/body',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: 'R Listener' })
			},
			createTestEnv()
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ name: 'R Listener' });
	});

	it('maps invalid JSON to validation_failed', async () => {
		const app = createApp({
			configure: (app) => {
				app.post('/fixture/body', async (c) => {
					const body = await parseJsonBody(c, z.object({ name: z.string() }));
					return c.json(body);
				});
			}
		});

		const res = await app.request(
			'/api/fixture/body',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{'
			},
			createTestEnv()
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: {
				code: 'validation_failed',
				message: 'Invalid input.',
				fields: { _: 'Request body must be valid JSON.' }
			}
		});
	});

	it('maps schema failures to validation_failed field errors', async () => {
		const app = createApp({
			configure: (app) => {
				app.get('/fixture/query', (c) => {
					const query = parseQuery(c, z.object({ limit: z.coerce.number().int().min(1) }));
					return c.json(query);
				});
			}
		});

		const res = await app.request('/api/fixture/query?limit=0', {}, createTestEnv());

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: unknown };
		expect(body.error).toEqual({
			code: 'validation_failed',
			message: 'Invalid input.',
			fields: { limit: 'Too small: expected number to be >=1' }
		});
	});
});
